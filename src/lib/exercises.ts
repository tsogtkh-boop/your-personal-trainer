// Serializable exercise model. Exercises (built-in and user-created) are plain
// data so they can live in the store, be added, and be deleted. The SmartCoach
// derives all its analysis from `trackedJoint` + `posture`, so any exercise —
// including custom ones — gets intelligent camera coaching.

export type TrackedJoint = 'knee' | 'elbow' | 'hip' | 'shoulder';
export type Posture = 'upright' | 'hinge' | 'plank' | 'any';
export type Category = 'legs' | 'push' | 'pull' | 'core' | 'full body' | 'arms' | 'shoulders';
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' | 'cable';

export interface Exercise {
  id: string;
  name: string;
  category: Category;
  equipment: Equipment;
  emoji: string;
  weighted: boolean;
  defaultWeightKg: number;
  trackedJoint: TrackedJoint;
  posture: Posture;
  cues: string[];
  muscles: string[];
  custom?: boolean;
}

/** hip-knee-ankle etc. — the three landmarks whose angle we track per joint. */
export const JOINT_TRIPLE: Record<TrackedJoint, [string, string, string]> = {
  knee: ['hip', 'knee', 'ankle'],
  elbow: ['shoulder', 'elbow', 'wrist'],
  hip: ['shoulder', 'hip', 'knee'],
  shoulder: ['elbow', 'shoulder', 'hip'],
};

export const DEFAULT_EXERCISES: Exercise[] = [
  {
    id: 'squat',
    name: 'Squat',
    category: 'legs',
    equipment: 'barbell',
    emoji: '🏋️',
    weighted: true,
    defaultWeightKg: 40,
    trackedJoint: 'knee',
    posture: 'upright',
    cues: ['Sit back and down', 'Knees track over toes', 'Drive through your heels', 'Chest up'],
    muscles: ['quads', 'glutes', 'core'],
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    category: 'full body',
    equipment: 'barbell',
    emoji: '🏋️‍♂️',
    weighted: true,
    defaultWeightKg: 60,
    trackedJoint: 'hip',
    posture: 'hinge',
    cues: ['Flat back, proud chest', 'Push the floor away', 'Finish tall — lock the hips'],
    muscles: ['hamstrings', 'glutes', 'back'],
  },
  {
    id: 'bench_press',
    name: 'Bench Press',
    category: 'push',
    equipment: 'barbell',
    emoji: '💪',
    weighted: true,
    defaultWeightKg: 40,
    trackedJoint: 'elbow',
    posture: 'any',
    cues: ['Touch the chest under control', 'Wrists stacked over elbows', 'Drive the bar up evenly'],
    muscles: ['chest', 'triceps', 'front delts'],
  },
  {
    id: 'overhead_press',
    name: 'Overhead Press',
    category: 'shoulders',
    equipment: 'barbell',
    emoji: '🙆',
    weighted: true,
    defaultWeightKg: 25,
    trackedJoint: 'elbow',
    posture: 'upright',
    cues: ['Squeeze glutes and abs', 'Press straight overhead', 'Full lockout at the top'],
    muscles: ['shoulders', 'triceps', 'core'],
  },
  {
    id: 'bicep_curl',
    name: 'Bicep Curl',
    category: 'arms',
    equipment: 'dumbbell',
    emoji: '💪',
    weighted: true,
    defaultWeightKg: 10,
    trackedJoint: 'elbow',
    posture: 'upright',
    cues: ['Squeeze at the top', 'Lower slowly — 2 seconds down', 'Pin your elbows', 'No swinging'],
    muscles: ['biceps', 'forearms'],
  },
  {
    id: 'leg_extension',
    name: 'Leg Extension',
    category: 'legs',
    equipment: 'machine',
    emoji: '🦵',
    weighted: true,
    defaultWeightKg: 30,
    trackedJoint: 'knee',
    posture: 'any',
    cues: ['Extend fully and squeeze the quad', 'Control the way down'],
    muscles: ['quads'],
  },
  {
    id: 'pull_up',
    name: 'Pull-Up',
    category: 'pull',
    equipment: 'bodyweight',
    emoji: '🧗',
    weighted: false,
    defaultWeightKg: 0,
    trackedJoint: 'elbow',
    posture: 'any',
    cues: ['Chin over the bar', 'Full hang at the bottom', 'Lead with your chest'],
    muscles: ['lats', 'biceps', 'upper back'],
  },
  {
    id: 'push_up',
    name: 'Push-Up',
    category: 'push',
    equipment: 'bodyweight',
    emoji: '🤸',
    weighted: false,
    defaultWeightKg: 0,
    trackedJoint: 'elbow',
    posture: 'plank',
    cues: ['Body in one straight line', 'Chest to the floor', 'Elbows about 45 degrees', 'Squeeze your glutes'],
    muscles: ['chest', 'triceps', 'core'],
  },
  {
    id: 'lunge',
    name: 'Lunge',
    category: 'legs',
    equipment: 'dumbbell',
    emoji: '🚶',
    weighted: true,
    defaultWeightKg: 10,
    trackedJoint: 'knee',
    posture: 'upright',
    cues: ['Step out with control', 'Back knee toward the floor', 'Push through the front heel', 'Stay tall'],
    muscles: ['quads', 'glutes'],
  },
  {
    id: 'bent_over_row',
    name: 'Bent-Over Row',
    category: 'pull',
    equipment: 'barbell',
    emoji: '🚣',
    weighted: true,
    defaultWeightKg: 30,
    trackedJoint: 'elbow',
    posture: 'hinge',
    cues: ['Pull to your lower ribs', 'Squeeze the shoulder blades', 'Flat back', 'No jerking'],
    muscles: ['lats', 'rhomboids', 'biceps'],
  },
  {
    id: 'lateral_raise',
    name: 'Lateral Raise',
    category: 'shoulders',
    equipment: 'dumbbell',
    emoji: '🕊️',
    weighted: true,
    defaultWeightKg: 6,
    trackedJoint: 'shoulder',
    posture: 'upright',
    cues: ['Lead with the elbows', 'Stop at shoulder height', 'Slow on the way down'],
    muscles: ['side delts'],
  },
  {
    id: 'hip_thrust',
    name: 'Hip Thrust',
    category: 'legs',
    equipment: 'barbell',
    emoji: '🍑',
    weighted: true,
    defaultWeightKg: 40,
    trackedJoint: 'hip',
    posture: 'any',
    cues: ['Chin tucked', 'Squeeze the glutes hard at the top', 'Full hip extension'],
    muscles: ['glutes', 'hamstrings'],
  },
  {
    id: 'sit_up',
    name: 'Sit-Up',
    category: 'core',
    equipment: 'bodyweight',
    emoji: '🧘',
    weighted: false,
    defaultWeightKg: 0,
    trackedJoint: 'hip',
    posture: 'any',
    cues: ['Exhale on the way up', 'Control the descent', "Don't yank your neck"],
    muscles: ['abs', 'hip flexors'],
  },
  {
    id: 'jumping_jack',
    name: 'Jumping Jack',
    category: 'full body',
    equipment: 'bodyweight',
    emoji: '⭐',
    weighted: false,
    defaultWeightKg: 0,
    trackedJoint: 'shoulder',
    posture: 'any',
    cues: ['Light on your feet', 'Full range with the arms', 'Keep a steady rhythm'],
    muscles: ['cardio', 'full body'],
  },
];

export const CATEGORIES: Category[] = ['legs', 'push', 'pull', 'core', 'arms', 'shoulders', 'full body'];
export const EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];
export const TRACKED_JOINTS: TrackedJoint[] = ['knee', 'elbow', 'hip', 'shoulder'];

export const slugify = (name: string): string =>
  'custom_' +
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') +
  '_' +
  Math.random().toString(36).slice(2, 6);
