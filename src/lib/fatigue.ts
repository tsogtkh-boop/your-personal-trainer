// Fatigue & performance adaptation model.
// Combines within-set rep slowdown, heart-rate response, RPE, and daily
// recovery to adjust weight, reps, and rest for the next set / session.

import { RecoveryEntry, SetLog } from '../types';

export interface SetAdjustment {
  weightDeltaPct: number; // e.g. -10 → reduce weight 10%
  repsDelta: number;
  restDeltaSec: number;
  message: string;
}

export interface FatigueInputs {
  velocityLossRatio: number | null; // lastReps/firstReps duration ratio (>1 = slowing)
  rpe: number | null; // 1..10
  avgHr: number | null;
  age: number;
  formScore: number; // 0..100
  targetRepsHit: boolean;
  repsOverTarget: number;
}

/** 0..100 — how fatigued this set looked. */
export function setFatigueScore(i: FatigueInputs): number {
  let score = 0;
  if (i.velocityLossRatio !== null) {
    // 1.0 = no slowdown, 1.6+ = heavy slowdown
    score += Math.min(40, Math.max(0, (i.velocityLossRatio - 1.05) * 80));
  }
  if (i.rpe !== null) score += Math.min(35, Math.max(0, (i.rpe - 6) * 10));
  if (i.avgHr !== null) {
    const max = 208 - 0.7 * i.age;
    score += Math.min(25, Math.max(0, (i.avgHr / max - 0.72) * 120));
  }
  if (i.formScore < 75) score += 12;
  return Math.round(Math.min(100, score));
}

export function adaptNextSet(i: FatigueInputs): SetAdjustment {
  const fatigue = setFatigueScore(i);

  if (fatigue >= 65 || (i.rpe !== null && i.rpe >= 9.5)) {
    return {
      weightDeltaPct: -10,
      repsDelta: -2,
      restDeltaSec: +45,
      message: "That set took a lot out of you — I'm dropping the weight 10% and adding rest. Quality over grinding.",
    };
  }
  if (fatigue >= 45) {
    return {
      weightDeltaPct: -5,
      repsDelta: -1,
      restDeltaSec: +30,
      message: 'You slowed down noticeably at the end. Slightly lighter next set, and take a longer rest.',
    };
  }
  if (fatigue <= 15 && i.targetRepsHit && i.repsOverTarget >= 2 && i.formScore >= 85) {
    return {
      weightDeltaPct: +5,
      repsDelta: 0,
      restDeltaSec: -15,
      message: 'Too easy for you! Adding 5% next set — keep that clean form.',
    };
  }
  if (fatigue <= 25 && i.targetRepsHit && i.formScore >= 80) {
    return {
      weightDeltaPct: +2.5,
      repsDelta: 0,
      restDeltaSec: 0,
      message: 'Solid, controlled set. Nudging the weight up a touch.',
    };
  }
  return { weightDeltaPct: 0, repsDelta: 0, restDeltaSec: 0, message: 'Good set — same weight, same target. Stay consistent.' };
}

/** Daily readiness 0..100 from recovery data (sleep, HRV, resting HR, soreness). */
export function dailyReadiness(recent: RecoveryEntry[]): { score: number; advice: string } {
  if (!recent.length) return { score: 75, advice: 'No recovery data yet — log sleep or connect a tracker for smarter adjustments.' };
  const r = recent[recent.length - 1];
  const baselineHrv = recent.slice(0, -1).reduce((a, b) => a + b.hrv, 0) / Math.max(1, recent.length - 1) || r.hrv;
  const baselineRhr = recent.slice(0, -1).reduce((a, b) => a + b.restingHr, 0) / Math.max(1, recent.length - 1) || r.restingHr;

  let score = 50;
  score += Math.min(20, Math.max(-20, (r.sleepHours - 7) * 8));
  score += Math.min(10, Math.max(-10, (r.sleepQuality - 6) * 2.5));
  score += Math.min(15, Math.max(-15, ((r.hrv - baselineHrv) / Math.max(1, baselineHrv)) * 120));
  score += Math.min(10, Math.max(-15, ((baselineRhr - r.restingHr) / Math.max(1, baselineRhr)) * 150));
  score -= Math.max(0, (r.soreness - 4) * 4);
  score = Math.round(Math.min(100, Math.max(0, score)));

  let advice: string;
  if (score >= 80) advice = 'Fully recovered — great day to push intensity or add a set.';
  else if (score >= 60) advice = 'Solid readiness. Train as planned.';
  else if (score >= 40) advice = 'Somewhat run down — keep the volume but drop loads ~10% today.';
  else advice = 'Low recovery. I recommend a light technique session or active recovery (walk, mobility).';
  return { score, advice };
}

/** Multiplier applied to planned weights today based on readiness. */
export function readinessLoadMultiplier(readiness: number): number {
  if (readiness >= 80) return 1.05;
  if (readiness >= 60) return 1.0;
  if (readiness >= 40) return 0.9;
  return 0.8;
}

export function summarizeSetForCoach(s: SetLog): string {
  const faults = s.faults.length ? ` Watch: ${s.faults.join(' ')}` : ' Form was clean.';
  return `${s.reps} reps at ${s.weightKg} kg, form score ${s.formScore}.${faults}`;
}
