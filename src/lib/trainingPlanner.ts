// Personalized training plan generation based on goal, experience and schedule.
// Works from the user's active exercise library, skipping any exercise they've
// deleted. Reps are a soft target the coach references — the workout is
// form-coached, not rep-counted.

import { Goal, PlanDay, PlannedExercise, TrainingPlan, UserProfile } from '../types';
import { Exercise } from './exercises';
import { findExercise } from './exerciseMeta';

const uid = () => Math.random().toString(36).slice(2, 10);

interface Rx {
  sets: number;
  reps: number;
  restSec: number;
  intensity: number;
}

function prescription(goal: Goal, experience: UserProfile['experience']): Rx {
  const base: Record<Goal, Rx> = {
    strength: { sets: 4, reps: 5, restSec: 150, intensity: 1.15 },
    muscle_gain: { sets: 4, reps: 10, restSec: 90, intensity: 1.0 },
    weight_loss: { sets: 3, reps: 14, restSec: 55, intensity: 0.8 },
    endurance: { sets: 3, reps: 18, restSec: 45, intensity: 0.65 },
  };
  const rx = { ...base[goal] };
  if (experience === 'beginner') {
    rx.sets = Math.max(2, rx.sets - 1);
    rx.intensity *= 0.85;
  }
  if (experience === 'advanced') rx.sets += 1;
  return rx;
}

function startWeight(ex: Exercise, p: UserProfile, intensity: number): number {
  if (!ex.weighted) return 0;
  const expMult = p.experience === 'beginner' ? 0.7 : p.experience === 'advanced' ? 1.35 : 1.0;
  const sexMult = p.sex === 'female' ? 0.72 : 1.0;
  const bwRatio: Record<string, number> = {
    squat: 0.6,
    deadlift: 0.8,
    bench_press: 0.45,
    overhead_press: 0.28,
    bent_over_row: 0.4,
    hip_thrust: 0.7,
    lunge: 0.15,
    bicep_curl: 0.1,
    lateral_raise: 0.06,
    leg_extension: 0.35,
  };
  const raw = p.weightKg * (bwRatio[ex.id] ?? 0.2) * expMult * sexMult * intensity;
  return Math.max(2.5, Math.round(raw / 2.5) * 2.5);
}

function mkExercise(ex: Exercise, p: UserProfile, rx: Rx): PlannedExercise {
  const w = startWeight(ex, p, rx.intensity);
  return {
    exerciseId: ex.id,
    name: ex.name,
    sets: Array.from({ length: rx.sets }, () => ({
      targetReps: ex.weighted ? rx.reps : Math.round(rx.reps * 1.2),
      targetWeightKg: w,
      restSec: rx.restSec,
    })),
  };
}

const SPLITS: Record<number, { name: string; focus: string; ids: string[] }[]> = {
  2: [
    { name: 'Day A — Full Body', focus: 'squat + push + pull', ids: ['squat', 'bench_press', 'bent_over_row', 'push_up', 'sit_up'] },
    { name: 'Day B — Full Body', focus: 'hinge + press + arms', ids: ['deadlift', 'overhead_press', 'pull_up', 'bicep_curl', 'jumping_jack'] },
  ],
  3: [
    { name: 'Day 1 — Push', focus: 'chest, shoulders, triceps', ids: ['bench_press', 'overhead_press', 'push_up', 'lateral_raise'] },
    { name: 'Day 2 — Pull', focus: 'back and biceps', ids: ['deadlift', 'bent_over_row', 'pull_up', 'bicep_curl'] },
    { name: 'Day 3 — Legs & Core', focus: 'lower body', ids: ['squat', 'lunge', 'leg_extension', 'hip_thrust', 'sit_up'] },
  ],
  4: [
    { name: 'Day 1 — Upper Push', focus: 'chest and shoulders', ids: ['bench_press', 'overhead_press', 'lateral_raise', 'push_up'] },
    { name: 'Day 2 — Lower', focus: 'quads and glutes', ids: ['squat', 'lunge', 'leg_extension', 'sit_up'] },
    { name: 'Day 3 — Upper Pull', focus: 'back and arms', ids: ['bent_over_row', 'pull_up', 'bicep_curl'] },
    { name: 'Day 4 — Lower Posterior', focus: 'hinge and conditioning', ids: ['deadlift', 'hip_thrust', 'jumping_jack', 'sit_up'] },
  ],
  5: [
    { name: 'Day 1 — Push', focus: 'chest and triceps', ids: ['bench_press', 'push_up', 'lateral_raise'] },
    { name: 'Day 2 — Pull', focus: 'back and biceps', ids: ['bent_over_row', 'pull_up', 'bicep_curl'] },
    { name: 'Day 3 — Legs', focus: 'quads and glutes', ids: ['squat', 'lunge', 'leg_extension'] },
    { name: 'Day 4 — Shoulders & Core', focus: 'delts and abs', ids: ['overhead_press', 'lateral_raise', 'sit_up'] },
    { name: 'Day 5 — Posterior & Conditioning', focus: 'hinge + cardio', ids: ['deadlift', 'hip_thrust', 'jumping_jack'] },
  ],
};

export function generateTrainingPlan(p: UserProfile, daysPerWeek: number, library: Exercise[]): TrainingPlan {
  const days = Math.min(5, Math.max(2, daysPerWeek));
  const rx = prescription(p.goal, p.experience);
  const split = SPLITS[days];

  let planDays: PlanDay[] = split.map((d) => {
    const exs = d.ids
      .map((id) => findExercise(library, id))
      .filter((e): e is Exercise => !!e)
      .map((ex) => mkExercise(ex, p, rx));
    return { name: d.name, focus: d.focus, exercises: exs };
  });

  // if the user deleted a lot of built-ins, backfill empty days from the library
  planDays = planDays.map((d) => {
    if (d.exercises.length > 0) return d;
    return { ...d, exercises: library.slice(0, 4).map((ex) => mkExercise(ex, p, rx)) };
  });

  const goalNames: Record<Goal, string> = {
    weight_loss: 'Lean Down',
    muscle_gain: 'Muscle Builder',
    strength: 'Strength Block',
    endurance: 'Engine Builder',
  };
  const progression: Record<Goal, string> = {
    weight_loss: 'Keep rests short and quality high. When your form score holds above 80, add a set or a touch of weight.',
    muscle_gain: 'When you finish a session with a form score above 80, add 2.5 kg (upper) / 5 kg (lower) next time.',
    strength: 'Add 2.5 kg per session on main lifts while your form grade stays A/B. Deload 10% every 5th week.',
    endurance: 'Add time under tension each week. Every 3rd week, cut rest by 5 seconds.',
  };

  return {
    id: uid(),
    goal: p.goal,
    name: `${goalNames[p.goal]} — ${days}x/week`,
    daysPerWeek: days,
    weeks: 8,
    createdAt: new Date().toISOString(),
    days: planDays,
    progression: progression[p.goal],
  };
}
