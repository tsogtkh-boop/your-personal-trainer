import { ExerciseDef } from './exercises';
import { PoseMap } from './geometry';

export interface RepCounterState {
  reps: number;
  phase: 'start' | 'away';
  angle: number | null;
  lastRepSec: number | null;
  avgRepSec: number | null;
  faultsThisSet: string[];
  formScore: number;
  feedback: string | null; // new feedback generated on this frame (speak it)
}

/**
 * Hysteresis-based rep state machine over a single tracked joint angle.
 * A rep = leaving the start zone, crossing the bottom/extreme threshold,
 * and returning to the start zone.
 */
export class RepCounter {
  private def: ExerciseDef;
  private smoothed: number | null = null;
  private phase: 'start' | 'away' = 'start';
  private reps = 0;
  private leftStartAt = 0;
  private repDurations: number[] = [];
  private reachedExtreme = false;
  private extremeSeen: number | null = null;
  private faultsThisRep = new Set<string>();
  private faultsThisSet: string[] = [];
  private faultCounts = new Map<string, number>();
  private repScores: number[] = [];
  private lastFeedbackAt = 0;
  private partialWarned = false;

  constructor(def: ExerciseDef) {
    this.def = def;
  }

  get state(): RepCounterState {
    return {
      reps: this.reps,
      phase: this.phase,
      angle: this.smoothed,
      lastRepSec: this.repDurations.length ? this.repDurations[this.repDurations.length - 1] : null,
      avgRepSec: this.repDurations.length
        ? this.repDurations.reduce((a, b) => a + b, 0) / this.repDurations.length
        : null,
      faultsThisSet: [...this.faultsThisSet],
      formScore: this.formScore(),
      feedback: null,
    };
  }

  get durations(): number[] {
    return [...this.repDurations];
  }

  formScore(): number {
    if (!this.repScores.length) return 100;
    return Math.round(this.repScores.reduce((a, b) => a + b, 0) / this.repScores.length);
  }

  /** Slowdown ratio of last 2 reps vs first 2 reps — a fatigue proxy. */
  velocityLossRatio(): number | null {
    const d = this.repDurations;
    if (d.length < 4) return null;
    const first = (d[0] + d[1]) / 2;
    const last = (d[d.length - 1] + d[d.length - 2]) / 2;
    if (first <= 0) return null;
    return last / first;
  }

  update(m: PoseMap, tSec: number): RepCounterState {
    const raw = this.def.angle(m);
    let feedback: string | null = null;
    if (raw !== null) {
      this.smoothed = this.smoothed === null ? raw : this.smoothed * 0.65 + raw * 0.35;
    }
    const a = this.smoothed;
    if (a === null) return { ...this.state, feedback };

    const { bottomThreshold, topThreshold, startAt } = this.def;
    const inStartZone = startAt === 'high' ? a >= topThreshold : a <= bottomThreshold;
    const atExtreme = startAt === 'high' ? a <= bottomThreshold : a >= topThreshold;

    if (this.phase === 'start') {
      const leftStart = startAt === 'high' ? a < topThreshold - 8 : a > bottomThreshold + 8;
      if (leftStart) {
        this.phase = 'away';
        this.leftStartAt = tSec;
        this.reachedExtreme = false;
        this.extremeSeen = a;
        this.faultsThisRep.clear();
        this.partialWarned = false;
      }
    } else {
      // track extreme
      if (this.extremeSeen === null) this.extremeSeen = a;
      this.extremeSeen = startAt === 'high' ? Math.min(this.extremeSeen, a) : Math.max(this.extremeSeen, a);
      if (atExtreme) this.reachedExtreme = true;

      // run form rules while working
      for (const rule of this.def.formRules) {
        if (!this.faultsThisRep.has(rule.id) && rule.check(m)) {
          this.faultsThisRep.add(rule.id);
          this.faultCounts.set(rule.id, (this.faultCounts.get(rule.id) ?? 0) + 1);
          if (tSec - this.lastFeedbackAt > 3) {
            feedback = rule.message;
            this.lastFeedbackAt = tSec;
          }
        }
      }

      if (inStartZone) {
        if (this.reachedExtreme) {
          this.reps += 1;
          const dur = tSec - this.leftStartAt;
          this.repDurations.push(dur);
          const score = Math.max(40, 100 - this.faultsThisRep.size * 18);
          this.repScores.push(score);
          for (const f of this.faultsThisRep) {
            const msg = this.def.formRules.find((r) => r.id === f)?.message;
            if (msg && !this.faultsThisSet.includes(msg)) this.faultsThisSet.push(msg);
          }
          if (!feedback && this.faultsThisRep.size === 0 && this.reps % 5 === 0 && tSec - this.lastFeedbackAt > 4) {
            feedback = `${this.reps}. Looking strong.`;
            this.lastFeedbackAt = tSec;
          }
        } else if (!this.partialWarned && this.extremeSeen !== null) {
          // Returned to start without reaching full depth/extension.
          const missedBy =
            this.def.startAt === 'high'
              ? this.extremeSeen - this.def.bottomThreshold
              : this.def.topThreshold - this.extremeSeen;
          if (missedBy > 5 && missedBy < 60 && tSec - this.lastFeedbackAt > 3) {
            feedback =
              this.def.startAt === 'high'
                ? "That one didn't count — go deeper for full range."
                : "That one didn't count — extend all the way.";
            this.lastFeedbackAt = tSec;
            this.partialWarned = true;
          }
        }
        this.phase = 'start';
      }
    }

    return { ...this.state, feedback };
  }
}
