// Presentation metadata derived from an exercise's category — works for
// built-in and custom exercises alike (emoji comes from the exercise itself).
import { colors } from '../theme';
import { Category, Exercise } from './exercises';

const CATEGORY_TINT: Record<Category, string> = {
  legs: colors.tintPurple,
  push: colors.tintPurple,
  pull: colors.tintBlue,
  core: colors.tintGreen,
  arms: colors.tintGreen,
  shoulders: colors.tintBlue,
  'full body': colors.tintOrange,
};

const CATEGORY_KCAL: Record<Category, number> = {
  legs: 8,
  push: 7,
  pull: 7,
  core: 5,
  arms: 4,
  shoulders: 5,
  'full body': 10,
};

export const tintFor = (ex: Exercise): string => CATEGORY_TINT[ex.category] ?? colors.tintPurple;
export const kcalPerMinFor = (ex: Exercise): number => CATEGORY_KCAL[ex.category] ?? 6;
export const blurbFor = (ex: Exercise): string => ex.muscles.slice(0, 3).join(', ');

/** kcal estimate for a coaching set of the given duration. */
export const setKcal = (ex: Exercise | undefined, durationSec: number): number =>
  Math.round(((ex ? kcalPerMinFor(ex) : 6) * durationSec) / 60);

export const findExercise = (list: Exercise[], id: string): Exercise | undefined => list.find((e) => e.id === id);
