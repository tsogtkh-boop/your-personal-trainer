// Recovery & sleep analysis. Computes a recovery score from sleep, HRV,
// resting HR and soreness, and can synthesize "tracker" data when a health
// connector is toggled on (stands in for real Apple Health / Google Fit sync).

import { RecoveryEntry } from '../types';

export function computeRecoveryScore(e: Omit<RecoveryEntry, 'recoveryScore'>): number {
  let s = 0;
  s += Math.min(35, Math.max(0, (e.sleepHours / 8) * 35));
  s += (e.sleepQuality / 10) * 15;
  s += Math.min(25, Math.max(0, ((e.hrv - 30) / 70) * 25));
  s += Math.min(15, Math.max(0, ((72 - e.restingHr) / 22) * 15 + 7.5));
  s += Math.max(0, 10 - e.soreness);
  return Math.round(Math.min(100, Math.max(0, s)));
}

export function makeEntry(
  date: string,
  data: { sleepHours: number; sleepQuality: number; restingHr: number; hrv: number; soreness: number },
  source: 'manual' | 'tracker',
): RecoveryEntry {
  const base = { date, ...data, source } as Omit<RecoveryEntry, 'recoveryScore'>;
  return { ...base, recoveryScore: computeRecoveryScore(base) };
}

/** Generate the last n days of plausible tracker data (used by connector "sync"). */
export function syntheticTrackerHistory(days = 7): RecoveryEntry[] {
  const out: RecoveryEntry[] = [];
  let hrv = 62;
  let rhr = 58;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    hrv += (Math.random() - 0.5) * 8;
    rhr += (Math.random() - 0.5) * 3;
    hrv = Math.min(95, Math.max(35, hrv));
    rhr = Math.min(72, Math.max(48, rhr));
    out.push(
      makeEntry(
        d.toISOString().slice(0, 10),
        {
          sleepHours: Math.round((6 + Math.random() * 2.6) * 10) / 10,
          sleepQuality: Math.round(5 + Math.random() * 4),
          restingHr: Math.round(rhr),
          hrv: Math.round(hrv),
          soreness: Math.round(1 + Math.random() * 5),
        },
        'tracker',
      ),
    );
  }
  return out;
}

export interface RecoveryAnalysis {
  headline: string;
  details: string[];
  trend: 'improving' | 'stable' | 'declining';
}

export function analyzeRecovery(entries: RecoveryEntry[]): RecoveryAnalysis {
  if (!entries.length) {
    return {
      headline: 'No recovery data yet',
      details: ['Log sleep manually or connect a health tracker to start recovery analysis.'],
      trend: 'stable',
    };
  }
  const last = entries[entries.length - 1];
  const week = entries.slice(-7);
  const avgSleep = week.reduce((a, b) => a + b.sleepHours, 0) / week.length;
  const avgScore = week.reduce((a, b) => a + b.recoveryScore, 0) / week.length;
  const firstHalf = week.slice(0, Math.ceil(week.length / 2));
  const secondHalf = week.slice(Math.ceil(week.length / 2));
  const t1 = firstHalf.reduce((a, b) => a + b.recoveryScore, 0) / Math.max(1, firstHalf.length);
  const t2 = secondHalf.reduce((a, b) => a + b.recoveryScore, 0) / Math.max(1, secondHalf.length);
  const trend: RecoveryAnalysis['trend'] = t2 - t1 > 5 ? 'improving' : t1 - t2 > 5 ? 'declining' : 'stable';

  const details: string[] = [
    `7-day average sleep: ${avgSleep.toFixed(1)} h (target 7–9 h).`,
    `7-day average recovery score: ${Math.round(avgScore)} / 100.`,
    `Last night: ${last.sleepHours} h sleep, HRV ${last.hrv} ms, resting HR ${last.restingHr} bpm.`,
  ];
  if (avgSleep < 7) details.push('Sleep is your biggest lever right now — an extra 45 min/night measurably improves strength and recovery.');
  if (last.soreness >= 7) details.push('High soreness reported — prioritize the affected muscles less today and hydrate well.');
  if (trend === 'declining') details.push('Recovery is trending down. Consider a lighter session or an extra rest day this week.');
  if (trend === 'improving') details.push('Recovery is trending up — your training load is well matched. Nice.');

  const headline =
    last.recoveryScore >= 80
      ? `Recovery ${last.recoveryScore}/100 — primed to perform`
      : last.recoveryScore >= 60
        ? `Recovery ${last.recoveryScore}/100 — good to train`
        : last.recoveryScore >= 40
          ? `Recovery ${last.recoveryScore}/100 — go moderate today`
          : `Recovery ${last.recoveryScore}/100 — take it easy`;

  return { headline, details, trend };
}
