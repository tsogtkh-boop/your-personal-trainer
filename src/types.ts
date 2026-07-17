export type Goal = 'weight_loss' | 'muscle_gain' | 'strength' | 'endurance';
export type Sex = 'male' | 'female';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
export type SubscriptionTier = 'free' | 'pro' | 'elite';

export interface UserProfile {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  activityLevel: ActivityLevel;
  experience: Experience;
  dietaryPreference: 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian';
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  profile: UserProfile;
  subscription: { tier: SubscriptionTier; renewsAt: string | null };
}

export interface SetLog {
  reps: number;
  weightKg: number;
  durationSec: number;
  avgRepSec: number;
  faults: string[];
  formScore: number; // 0-100
  rpe: number | null;
  avgHr: number | null;
}

export interface ExerciseLog {
  exerciseId: string;
  name: string;
  sets: SetLog[];
}

export interface WorkoutLog {
  id: string;
  date: string; // ISO
  planDayName: string | null;
  exercises: ExerciseLog[];
  totalVolumeKg: number;
  durationMin: number;
  avgHr: number | null;
  fatigueScore: number | null;
  synced: boolean;
}

export interface PlannedSet {
  targetReps: number;
  targetWeightKg: number;
  restSec: number;
}

export interface PlannedExercise {
  exerciseId: string;
  name: string;
  sets: PlannedSet[];
  note?: string;
}

export interface PlanDay {
  name: string;
  focus: string;
  exercises: PlannedExercise[];
}

export interface TrainingPlan {
  id: string;
  goal: Goal;
  name: string;
  daysPerWeek: number;
  weeks: number;
  createdAt: string;
  days: PlanDay[];
  progression: string;
}

export interface Meal {
  name: string;
  time: string;
  items: string[];
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealPlan {
  id: string;
  createdAt: string;
  targetKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  tdee: number;
  meals: Meal[];
  notes: string[];
}

export interface RecoveryEntry {
  date: string; // yyyy-mm-dd
  sleepHours: number;
  sleepQuality: number; // 1-10
  restingHr: number;
  hrv: number; // ms
  soreness: number; // 1-10
  recoveryScore: number; // 0-100 computed
  source: 'manual' | 'tracker';
}

export interface ChatMsg {
  id: string;
  role: 'user' | 'coach';
  text: string;
  ts: number;
}

export interface Connectors {
  appleHealth: boolean;
  googleFit: boolean;
  fitbit: boolean;
  garmin: boolean;
  lastSync: string | null;
}
