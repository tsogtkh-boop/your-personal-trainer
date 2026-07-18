// Health-tracker connectors: feeds workout + recovery data out of the app.
// On the web build this exports standard-format files (JSON / CSV) that
// Apple Health, Google Fit, Fitbit and Garmin can import, and simulates the
// connector sync handshake. Native builds would swap in HealthKit / Health
// Connect APIs behind the same interface.

import { WorkoutLog, RecoveryEntry } from '../types';

export const CONNECTOR_INFO: { key: 'appleHealth' | 'googleFit' | 'fitbit' | 'garmin'; label: string }[] = [
  { key: 'appleHealth', label: 'Apple Health' },
  { key: 'googleFit', label: 'Google Fit' },
  { key: 'fitbit', label: 'Fitbit' },
  { key: 'garmin', label: 'Garmin Connect' },
];

export function workoutsToCSV(logs: WorkoutLog[]): string {
  const rows = ['date,exercise,set,reps,duration_sec,weight_kg,form_score,grade,avg_hr,rpe'];
  for (const w of logs) {
    for (const ex of w.exercises) {
      ex.sets.forEach((s, i) => {
        rows.push(
          [
            w.date.slice(0, 10),
            ex.name,
            i + 1,
            s.reps ?? '',
            s.durationSec,
            s.weightKg,
            s.formScore ?? '',
            s.grade ?? '',
            s.avgHr ?? '',
            s.rpe ?? '',
          ].join(','),
        );
      });
    }
  }
  return rows.join('\n');
}

export function healthExportJSON(logs: WorkoutLog[], recovery: RecoveryEntry[]): string {
  return JSON.stringify(
    {
      schema: 'open-fitness-export/v1',
      exportedAt: new Date().toISOString(),
      workouts: logs.map((w) => ({
        start: w.date,
        durationMin: w.durationMin,
        activityType: 'strength_training',
        avgFormScore: w.avgFormScore,
        avgHeartRate: w.avgHr,
        exercises: w.exercises,
      })),
      sleepAndRecovery: recovery,
    },
    null,
    2,
  );
}

export function downloadFile(filename: string, content: string, mime = 'application/json'): boolean {
  const doc = (globalThis as any).document;
  if (!doc) return false;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = filename;
  doc.body.appendChild(a);
  a.click();
  doc.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

/** Simulated connector sync — pushes workouts, pulls recovery. */
export async function syncConnector(
  connector: string,
  logs: WorkoutLog[],
): Promise<{ pushed: number; message: string }> {
  await new Promise((r) => setTimeout(r, 900)); // handshake
  const unsynced = logs.filter((l) => !l.synced).length;
  return {
    pushed: unsynced,
    message: `${connector}: pushed ${unsynced} workout${unsynced === 1 ? '' : 's'}, pulled latest sleep & HRV data.`,
  };
}
