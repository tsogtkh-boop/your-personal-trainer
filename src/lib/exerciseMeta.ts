// Presentation metadata per exercise: thumbnail emoji, tile tint, calorie rate.
import { colors } from '../theme';

export interface ExerciseMeta {
  emoji: string;
  tint: string;
  kcalPerMin: number;
  blurb: string;
}

const M = (emoji: string, tint: string, kcalPerMin: number, blurb: string): ExerciseMeta => ({
  emoji,
  tint,
  kcalPerMin,
  blurb,
});

export const EXERCISE_META: Record<string, ExerciseMeta> = {
  squat: M('🏋️', colors.tintPurple, 8, 'Quads, glutes & core'),
  deadlift: M('🏋️‍♂️', colors.tintOrange, 9, 'Posterior chain power'),
  bench_press: M('💪', colors.tintPurple, 7, 'Chest, shoulder & triceps'),
  overhead_press: M('🙆', colors.tintBlue, 6, 'Shoulders & triceps'),
  bicep_curl: M('💪', colors.tintGreen, 4, 'Biceps & forearms'),
  leg_extension: M('🦵', colors.tintOrange, 5, 'Quad isolation'),
  pull_up: M('🧗', colors.tintPurple, 8, 'Lats & upper back'),
  push_up: M('🤸', colors.tintGreen, 6, 'Chest & core'),
  lunge: M('🚶', colors.tintOrange, 7, 'Quads & glutes'),
  bent_over_row: M('🚣', colors.tintBlue, 7, 'Back & biceps'),
  lateral_raise: M('🕊️', colors.tintBlue, 4, 'Side delts'),
  hip_thrust: M('🍑', colors.tintPurple, 6, 'Glutes & hamstrings'),
  sit_up: M('🧘', colors.tintGreen, 5, 'Abs & hip flexors'),
  jumping_jack: M('⭐', colors.tintOrange, 10, 'Full-body cardio'),
};

export const metaFor = (id: string): ExerciseMeta => EXERCISE_META[id] ?? M('🏋️', colors.tintPurple, 6, 'Strength');

/** Rough kcal estimate for a set. */
export const setKcal = (exerciseId: string, durationSec: number): number =>
  Math.round((metaFor(exerciseId).kcalPerMin * durationSec) / 60);
