// SmartCoach — the camera personal trainer. Watches a pose stream and coaches
// technique like a real trainer: posture & alignment, left/right symmetry,
// range of motion, tempo & control, and stability. It speaks prioritized,
// varied cues, keeps a live form score, and produces an end-of-set summary.
// It does NOT count reps — it coaches the movement.

import { Exercise, JOINT_TRIPLE } from './exercises';
import { PoseMap, angleDeg, bodyVisibility, levelOffset, side, sideJointAngle, verticalTiltDeg } from './geometry';

export type CueKind = 'correction' | 'praise' | 'info';

export interface CoachUpdate {
  formScore: number; // 0..100 (live, smoothed)
  primaryAngle: number | null;
  visibility: number; // 0..1
  torsoTilt: number | null;
  symmetryPct: number | null; // 0..100 higher = more balanced
  tempo: 'idle' | 'controlled' | 'good' | 'fast';
  postureOk: boolean | null;
  activeIssues: string[]; // short labels for the live UI
  cue: string | null; // speak this (throttled)
  cueKind: CueKind | null;
}

export interface CoachSummary {
  grade: 'A' | 'B' | 'C' | 'D';
  score: number;
  headline: string;
  highlights: string[];
  tips: string[];
  movements: number; // observed movement cycles (for interest, not a rep count)
}

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

interface Candidate {
  priority: number;
  kind: CueKind;
  category: string;
  msg: string;
}

export class SmartCoach {
  private ex: Exercise;
  private triple: [string, string, string];

  private smoothAngle: number | null = null;
  private lastAngle: number | null = null;
  private lastT = 0;
  private vel = 0;
  private extreme: { angle: number; t: number; dir: 1 | -1 } | null = null;
  private amplitudes: number[] = [];
  private bestAmp = 0;
  private movements = 0;

  private prevMid: { x: number; y: number } | null = null;
  private jitter = 0;

  private formEMA = 100;
  private faultTime: Record<string, number> = {}; // seconds each fault was active
  private praiseGiven = 0;
  private goodStreakStart = 0;

  private lastCueAt = -999;
  private lastCueText = '';
  private recentCues: { text: string; t: number }[] = [];
  private startedT = 0;
  private promptedStart = false;

  constructor(ex: Exercise) {
    this.ex = ex;
    this.triple = JOINT_TRIPLE[ex.trackedJoint];
  }

  private both(m: PoseMap): { left: number | null; right: number | null; primary: number | null } {
    const [a, b, c] = this.triple;
    const left = sideJointAngle(m, 'left', a, b, c);
    const right = sideJointAngle(m, 'right', a, b, c);
    const vals = [left, right].filter((v): v is number => v !== null);
    const primary = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
    return { left, right, primary };
  }

  update(m: PoseMap, tSec: number): CoachUpdate {
    if (this.startedT === 0) this.startedT = tSec;
    const dt = this.lastT ? Math.max(0.001, tSec - this.lastT) : 0.05;
    this.lastT = tSec;

    const visibility = bodyVisibility(m);
    const { left, right, primary } = this.both(m);

    // smooth the tracked angle + velocity + movement detection
    if (primary !== null) {
      this.smoothAngle = this.smoothAngle === null ? primary : this.smoothAngle * 0.6 + primary * 0.4;
      if (this.lastAngle !== null) this.vel = (this.smoothAngle - this.lastAngle) / dt;
      this.lastAngle = this.smoothAngle;
    }

    // jitter / stability from torso midpoint motion
    const sh = side(m, 'shoulder');
    const hip = side(m, 'hip');
    const mid = sh && hip ? { x: (sh.x + hip.x) / 2, y: (sh.y + hip.y) / 2 } : null;
    if (mid && this.prevMid) {
      const torso = sh && hip ? Math.hypot(sh.x - hip.x, sh.y - hip.y) || 100 : 100;
      const d = Math.hypot(mid.x - this.prevMid.x, mid.y - this.prevMid.y) / torso;
      this.jitter = this.jitter * 0.85 + d * 0.15;
    }
    this.prevMid = mid;

    const candidates: Candidate[] = [];
    const activeIssues: string[] = [];

    // --- 1. visibility (highest priority) ---
    if (visibility < 0.4) {
      candidates.push({
        priority: 100,
        kind: 'info',
        category: 'visibility',
        msg: pick([
          "I can't see your full body — step back so I can watch your whole form.",
          'Move back a bit and turn side-on so I can see you head to toe.',
        ]),
      });
      activeIssues.push('step back');
      this.accumFault('visibility', dt);
      return this.build(primary, visibility, null, null, activeIssues, candidates, tSec, 'idle');
    }

    // --- posture / alignment ---
    const tilt = sh && hip ? verticalTiltDeg(sh, hip) : null;
    let postureOk: boolean | null = null;
    if (tilt !== null && this.ex.posture !== 'any') {
      if (this.ex.posture === 'upright') {
        postureOk = tilt <= 22;
        if (tilt > 30) {
          candidates.push({
            priority: 78,
            kind: 'correction',
            category: 'posture',
            msg: pick(['Stay tall — chest up, brace your core.', "Don't lean — keep your torso upright.", 'Ribs down, chest proud.']),
          });
          activeIssues.push('leaning');
          this.accumFault('posture', dt);
        }
      } else if (this.ex.posture === 'hinge') {
        const knee = side(m, 'knee');
        const backAngle = sh && hip && knee ? angleDeg(sh, hip, knee) : null;
        postureOk = tilt >= 25 && (backAngle === null || backAngle > 150);
        if (tilt < 22) {
          candidates.push({
            priority: 72,
            kind: 'correction',
            category: 'posture',
            msg: pick(['Hinge at your hips — push them back.', 'Fold forward from the hips, not the knees.']),
          });
          activeIssues.push('hinge more');
          this.accumFault('posture', dt);
        } else if (backAngle !== null && backAngle < 142) {
          candidates.push({
            priority: 90,
            kind: 'correction',
            category: 'back',
            msg: pick(['Flatten your back — chest proud, no rounding.', 'Keep a flat back to protect your spine.']),
          });
          activeIssues.push('back rounding');
          this.accumFault('back', dt);
        }
      } else if (this.ex.posture === 'plank') {
        const ank = side(m, 'ankle');
        const line = sh && hip && ank ? angleDeg(sh, hip, ank) : null;
        postureOk = line === null || line > 155;
        if (line !== null && line < 150) {
          candidates.push({
            priority: 82,
            kind: 'correction',
            category: 'plank',
            msg: pick(['Hips in line — squeeze your glutes, one straight line.', "Don't let your hips sag — brace your core."]),
          });
          activeIssues.push('hips sagging');
          this.accumFault('plank', dt);
        }
      }
    }

    // --- symmetry ---
    const shLevel = levelOffset(m, 'shoulder');
    const hipLevel = levelOffset(m, 'hip');
    let symmetryPct: number | null = null;
    let worstSym = 0;
    if (shLevel !== null) worstSym = Math.max(worstSym, shLevel);
    if (hipLevel !== null) worstSym = Math.max(worstSym, hipLevel);
    let angleDiff: number | null = null;
    if (left !== null && right !== null) {
      angleDiff = Math.abs(left - right);
      worstSym = Math.max(worstSym, angleDiff / 90);
    }
    if (shLevel !== null || hipLevel !== null || angleDiff !== null) {
      symmetryPct = Math.round(Math.max(0, 100 - worstSym * 220));
    }
    if (shLevel !== null && shLevel > 0.14) {
      candidates.push({
        priority: 60,
        kind: 'correction',
        category: 'symmetry',
        msg: pick(['Level your shoulders — you\'re dipping to one side.', 'Even out your shoulders, stay balanced.']),
      });
      activeIssues.push('uneven shoulders');
      this.accumFault('symmetry', dt);
    } else if (hipLevel !== null && hipLevel > 0.14) {
      candidates.push({
        priority: 58,
        kind: 'correction',
        category: 'symmetry',
        msg: pick(['Keep your hips even and square.', 'Balance your weight — hips level.']),
      });
      activeIssues.push('uneven hips');
      this.accumFault('symmetry', dt);
    } else if (angleDiff !== null && angleDiff > 20) {
      candidates.push({
        priority: 56,
        kind: 'correction',
        category: 'symmetry',
        msg: pick(['You\'re favoring one side — match your left and right.', 'Even it out — both sides working equally.']),
      });
      activeIssues.push('favoring a side');
      this.accumFault('symmetry', dt);
    }

    // --- range of motion + tempo from movement reversals ---
    let tempo: CoachUpdate['tempo'] = 'idle';
    if (this.smoothAngle !== null) {
      const moving = Math.abs(this.vel) > 22;
      if (moving) tempo = Math.abs(this.vel) > 190 ? 'fast' : Math.abs(this.vel) > 60 ? 'good' : 'controlled';
      const dir: 1 | -1 = this.vel >= 0 ? 1 : -1;
      if (this.extreme === null) {
        this.extreme = { angle: this.smoothAngle, t: tSec, dir };
      } else if (dir !== this.extreme.dir && Math.abs(this.vel) > 22) {
        // direction reversed → we just passed an extreme; measure the completed swing
        const amp = Math.abs(this.smoothAngle - this.extreme.angle);
        const swingT = tSec - this.extreme.t;
        if (amp > 22) {
          this.movements += 1;
          this.amplitudes.push(amp);
          this.bestAmp = Math.max(this.bestAmp, amp);
          // ROM feedback
          if (this.bestAmp > 40 && amp < this.bestAmp * 0.62) {
            candidates.push({
              priority: 52,
              kind: 'correction',
              category: 'rom',
              msg: pick(['Give me full range on that one — all the way.', 'A little short — go through the complete range.']),
            });
            activeIssues.push('partial range');
          } else if (amp >= this.bestAmp * 0.9 && this.movements > 2) {
            candidates.push({
              priority: 20,
              kind: 'praise',
              category: 'rom',
              msg: pick(['Great range on that one.', 'Full range — that\'s it.', 'Beautiful depth.']),
            });
          }
          // tempo feedback
          if (swingT < 0.45) {
            candidates.push({
              priority: 46,
              kind: 'correction',
              category: 'tempo',
              msg: pick(['Slow it down — stay in control.', "Don't rush it, control the movement.", 'Smooth and controlled, no bouncing.']),
            });
            activeIssues.push('too fast');
          } else if (swingT > 0.8 && swingT < 3) {
            candidates.push({
              priority: 16,
              kind: 'praise',
              category: 'tempo',
              msg: pick(['Lovely tempo — really controlled.', 'Nice and controlled, keep that pace.']),
            });
          }
        }
        this.extreme = { angle: this.smoothAngle, t: tSec, dir };
      } else if (
        (this.extreme.dir === 1 && this.smoothAngle > this.extreme.angle) ||
        (this.extreme.dir === -1 && this.smoothAngle < this.extreme.angle)
      ) {
        this.extreme.angle = this.smoothAngle; // extend current extreme
        this.extreme.t = tSec;
      }
    }

    // --- stability ---
    if (this.jitter > 0.05) {
      candidates.push({
        priority: 34,
        kind: 'correction',
        category: 'stability',
        msg: pick(['Steady your base — control the movement.', 'Plant your feet, minimize the wobble.']),
      });
      activeIssues.push('unsteady');
      this.accumFault('stability', dt);
    }

    // --- start prompt / periodic encouragement ---
    if (!this.promptedStart && tSec - this.startedT > 1.5 && this.movements === 0) {
      this.promptedStart = true;
      candidates.push({
        priority: 25,
        kind: 'info',
        category: 'start',
        msg: pick([`Whenever you're ready — start your ${this.ex.name.toLowerCase()}. I'm watching your form.`, "Take your time and begin — I've got my eye on your technique."]),
      });
    }
    if (activeIssues.length === 0 && this.movements > 1) {
      candidates.push({
        priority: 8,
        kind: 'praise',
        category: 'encourage',
        msg: pick([
          'Looking strong — clean technique.',
          "That's textbook, keep it up.",
          'Beautiful form, stay locked in.',
          "You're moving really well.",
        ]),
      });
    }

    // live form score
    const livePenalty =
      (activeIssues.includes('back rounding') ? 32 : 0) +
      (activeIssues.includes('hips sagging') ? 26 : 0) +
      (activeIssues.includes('leaning') || activeIssues.includes('hinge more') ? 18 : 0) +
      (activeIssues.some((i) => i.includes('uneven') || i.includes('favoring')) ? 16 : 0) +
      (activeIssues.includes('unsteady') ? 12 : 0) +
      (activeIssues.includes('partial range') ? 14 : 0) +
      (activeIssues.includes('too fast') ? 10 : 0);
    const target = Math.max(35, 100 - livePenalty);
    this.formEMA += (target - this.formEMA) * 0.04;

    return this.build(primary, visibility, tilt, symmetryPct, activeIssues, candidates, tSec, tempo, postureOk);
  }

  private accumFault(cat: string, dt: number) {
    this.faultTime[cat] = (this.faultTime[cat] ?? 0) + dt;
  }

  private build(
    primary: number | null,
    visibility: number,
    tilt: number | null,
    symmetryPct: number | null,
    activeIssues: string[],
    candidates: Candidate[],
    tSec: number,
    tempo: CoachUpdate['tempo'],
    postureOk: boolean | null = null,
  ): CoachUpdate {
    // choose a cue (throttled, non-repeating)
    let cue: string | null = null;
    let cueKind: CueKind | null = null;
    const gap = 3.3;
    this.recentCues = this.recentCues.filter((c) => tSec - c.t < 12);
    const sorted = candidates.sort((a, b) => b.priority - a.priority);
    if (tSec - this.lastCueAt >= gap) {
      for (const c of sorted) {
        // don't repeat a message we said recently
        if (this.recentCues.some((r) => r.text === c.msg)) continue;
        // praise sparingly
        if (c.kind === 'praise' && tSec - this.lastCueAt < 6) continue;
        cue = c.msg;
        cueKind = c.kind;
        this.lastCueAt = tSec;
        this.lastCueText = c.msg;
        this.recentCues.push({ text: c.msg, t: tSec });
        break;
      }
    }

    return {
      formScore: Math.round(this.formEMA),
      primaryAngle: primary,
      visibility,
      torsoTilt: tilt,
      symmetryPct,
      tempo,
      postureOk,
      activeIssues,
      cue,
      cueKind,
    };
  }

  summary(): CoachSummary {
    const score = Math.round(this.formEMA);
    const grade: CoachSummary['grade'] = score >= 88 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D';

    // rank faults by how long they were active
    const faults = Object.entries(this.faultTime).sort((a, b) => b[1] - a[1]);
    const tipFor: Record<string, string> = {
      back: 'Keep a flat back throughout — brace your core before each rep.',
      plank: 'Hold a rigid straight line — squeeze glutes and abs the whole time.',
      posture: 'Watch your torso angle — set your posture before you move.',
      symmetry: 'Work on left/right balance — film yourself from the front occasionally.',
      stability: 'Slow down and stabilize — control beats momentum.',
      visibility: 'Set the camera so your whole body stays in frame, side-on.',
    };
    const tips = faults.filter(([, t]) => t > 1.5).slice(0, 2).map(([c]) => tipFor[c] ?? 'Keep refining your technique.');

    const highlights: string[] = [];
    const avgAmp = this.amplitudes.length ? this.amplitudes.reduce((a, b) => a + b, 0) / this.amplitudes.length : 0;
    if (avgAmp > 55) highlights.push('Full, consistent range of motion 💪');
    if (!faults.some(([c]) => c === 'symmetry')) highlights.push('Well-balanced, symmetrical movement');
    if (!faults.some(([c]) => c === 'stability')) highlights.push('Steady and controlled');
    if (score >= 80) highlights.push('Strong overall technique');
    if (!highlights.length) highlights.push('You showed up and put in the work');

    const headline =
      grade === 'A'
        ? 'Excellent set — that was clean, controlled work.'
        : grade === 'B'
          ? 'Solid set with good technique overall.'
          : grade === 'C'
            ? "Decent set — a couple of things to tighten up."
            : "Good effort — let's clean up the technique next time.";

    return { grade, score, headline, highlights, tips: tips.length ? tips : ['Keep that quality high on every rep.'], movements: this.movements };
  }
}
