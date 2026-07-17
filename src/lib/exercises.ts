import { PoseMap, jointAngle, verticalTiltDeg, side, angleDeg } from './geometry';

export interface FormRule {
  id: string;
  message: string;
  /** Returns true when a fault is detected on this frame. */
  check: (m: PoseMap) => boolean;
}

export interface ExerciseDef {
  id: string;
  name: string;
  category: 'legs' | 'push' | 'pull' | 'core' | 'full body' | 'arms' | 'shoulders';
  equipment: 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' | 'cable';
  defaultWeightKg: number;
  weighted: boolean;
  /** Tracked joint angle for rep counting. */
  angle: (m: PoseMap) => number | null;
  /** Angle value considered the extreme of the rep. */
  bottomThreshold: number;
  /** Angle value considered the start/lockout position. */
  topThreshold: number;
  /** 'high' = rep starts at large angle (squat standing), 'low' = starts at small angle (press racked). */
  startAt: 'high' | 'low';
  formRules: FormRule[];
  cues: string[];
  muscles: string[];
}

const torsoLean = (m: PoseMap, limit: number) => {
  const sh = side(m, 'shoulder');
  const hip = side(m, 'hip');
  if (!sh || !hip) return false;
  return verticalTiltDeg(sh, hip) > limit;
};

const torsoTooUpright = (m: PoseMap, minLean: number) => {
  const sh = side(m, 'shoulder');
  const hip = side(m, 'hip');
  if (!sh || !hip) return false;
  return verticalTiltDeg(sh, hip) < minLean;
};

const elbowDrift = (m: PoseMap) => {
  const sh = side(m, 'shoulder');
  const el = side(m, 'elbow');
  const hip = side(m, 'hip');
  if (!sh || !el || !hip) return false;
  const torso = Math.hypot(sh.x - hip.x, sh.y - hip.y);
  return Math.abs(el.x - sh.x) > torso * 0.45;
};

const hipsSag = (m: PoseMap) => {
  const sh = side(m, 'shoulder');
  const hip = side(m, 'hip');
  const ank = side(m, 'ankle');
  if (!sh || !hip || !ank) return false;
  return angleDeg(sh, hip, ank) < 152;
};

export const EXERCISES: ExerciseDef[] = [
  {
    id: 'squat',
    name: 'Squat',
    category: 'legs',
    equipment: 'barbell',
    defaultWeightKg: 40,
    weighted: true,
    angle: (m) => jointAngle(m, 'hip', 'knee', 'ankle'),
    bottomThreshold: 100,
    topThreshold: 160,
    startAt: 'high',
    formRules: [
      { id: 'lean', message: 'Chest up — keep your torso more upright.', check: (m) => torsoLean(m, 55) },
    ],
    cues: ['Sit back and down', 'Knees track over toes', 'Drive through your heels'],
    muscles: ['quads', 'glutes', 'core'],
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    category: 'full body',
    equipment: 'barbell',
    defaultWeightKg: 60,
    weighted: true,
    angle: (m) => jointAngle(m, 'shoulder', 'hip', 'knee'),
    bottomThreshold: 95,
    topThreshold: 165,
    startAt: 'high',
    formRules: [],
    cues: ['Flat back, proud chest', 'Push the floor away', 'Finish tall — lock the hips'],
    muscles: ['hamstrings', 'glutes', 'back'],
  },
  {
    id: 'bench_press',
    name: 'Bench Press',
    category: 'push',
    equipment: 'barbell',
    defaultWeightKg: 40,
    weighted: true,
    angle: (m) => jointAngle(m, 'shoulder', 'elbow', 'wrist'),
    bottomThreshold: 90,
    topThreshold: 155,
    startAt: 'low',
    formRules: [],
    cues: ['Touch the chest under control', 'Wrists stacked over elbows', 'Drive the bar up evenly'],
    muscles: ['chest', 'triceps', 'front delts'],
  },
  {
    id: 'overhead_press',
    name: 'Overhead Press',
    category: 'shoulders',
    equipment: 'barbell',
    defaultWeightKg: 25,
    weighted: true,
    angle: (m) => jointAngle(m, 'shoulder', 'elbow', 'wrist'),
    bottomThreshold: 85,
    topThreshold: 155,
    startAt: 'low',
    formRules: [
      { id: 'lean_back', message: "Brace your core — don't lean back.", check: (m) => torsoLean(m, 22) },
    ],
    cues: ['Squeeze glutes and abs', 'Press straight overhead', 'Full lockout at the top'],
    muscles: ['shoulders', 'triceps', 'core'],
  },
  {
    id: 'bicep_curl',
    name: 'Bicep Curl',
    category: 'arms',
    equipment: 'dumbbell',
    defaultWeightKg: 10,
    weighted: true,
    angle: (m) => jointAngle(m, 'shoulder', 'elbow', 'wrist'),
    bottomThreshold: 60,
    topThreshold: 150,
    startAt: 'high',
    formRules: [
      { id: 'drift', message: 'Pin your elbows to your sides.', check: elbowDrift },
      { id: 'swing', message: "Don't swing — keep your torso still.", check: (m) => torsoLean(m, 25) },
    ],
    cues: ['Squeeze at the top', 'Lower slowly — 2 seconds down', 'No momentum'],
    muscles: ['biceps', 'forearms'],
  },
  {
    id: 'leg_extension',
    name: 'Leg Extension',
    category: 'legs',
    equipment: 'machine',
    defaultWeightKg: 30,
    weighted: true,
    angle: (m) => jointAngle(m, 'hip', 'knee', 'ankle'),
    bottomThreshold: 110,
    topThreshold: 155,
    startAt: 'low',
    formRules: [],
    cues: ['Extend fully and squeeze the quad', 'Control the way down'],
    muscles: ['quads'],
  },
  {
    id: 'pull_up',
    name: 'Pull-Up',
    category: 'pull',
    equipment: 'bodyweight',
    defaultWeightKg: 0,
    weighted: false,
    angle: (m) => jointAngle(m, 'shoulder', 'elbow', 'wrist'),
    bottomThreshold: 80,
    topThreshold: 150,
    startAt: 'high',
    formRules: [],
    cues: ['Chin over the bar', 'Full hang at the bottom', 'Lead with your chest'],
    muscles: ['lats', 'biceps', 'upper back'],
  },
  {
    id: 'push_up',
    name: 'Push-Up',
    category: 'push',
    equipment: 'bodyweight',
    defaultWeightKg: 0,
    weighted: false,
    angle: (m) => jointAngle(m, 'shoulder', 'elbow', 'wrist'),
    bottomThreshold: 95,
    topThreshold: 155,
    startAt: 'high',
    formRules: [
      { id: 'sag', message: 'Keep your hips in line — squeeze your glutes.', check: hipsSag },
    ],
    cues: ['Body in one straight line', 'Chest to the floor', 'Elbows about 45 degrees'],
    muscles: ['chest', 'triceps', 'core'],
  },
  {
    id: 'lunge',
    name: 'Lunge',
    category: 'legs',
    equipment: 'dumbbell',
    defaultWeightKg: 10,
    weighted: true,
    angle: (m) => jointAngle(m, 'hip', 'knee', 'ankle'),
    bottomThreshold: 105,
    topThreshold: 160,
    startAt: 'high',
    formRules: [
      { id: 'lean', message: 'Stay tall — torso upright.', check: (m) => torsoLean(m, 30) },
    ],
    cues: ['Step out with control', 'Back knee toward the floor', 'Push through the front heel'],
    muscles: ['quads', 'glutes'],
  },
  {
    id: 'bent_over_row',
    name: 'Bent-Over Row',
    category: 'pull',
    equipment: 'barbell',
    defaultWeightKg: 30,
    weighted: true,
    angle: (m) => jointAngle(m, 'shoulder', 'elbow', 'wrist'),
    bottomThreshold: 90,
    topThreshold: 150,
    startAt: 'high',
    formRules: [
      { id: 'upright', message: 'Hinge forward more — keep your back flat.', check: (m) => torsoTooUpright(m, 25) },
    ],
    cues: ['Pull to your lower ribs', 'Squeeze the shoulder blades', 'No jerking'],
    muscles: ['lats', 'rhomboids', 'biceps'],
  },
  {
    id: 'lateral_raise',
    name: 'Lateral Raise',
    category: 'shoulders',
    equipment: 'dumbbell',
    defaultWeightKg: 6,
    weighted: true,
    angle: (m) => jointAngle(m, 'elbow', 'shoulder', 'hip'),
    bottomThreshold: 35,
    topThreshold: 78,
    startAt: 'low',
    formRules: [
      {
        id: 'too_high',
        message: 'Stop at shoulder height.',
        check: (m) => {
          const a = jointAngle(m, 'elbow', 'shoulder', 'hip');
          return a !== null && a > 115;
        },
      },
    ],
    cues: ['Lead with the elbows', 'Slight bend in the arms', 'Slow on the way down'],
    muscles: ['side delts'],
  },
  {
    id: 'hip_thrust',
    name: 'Hip Thrust',
    category: 'legs',
    equipment: 'barbell',
    defaultWeightKg: 40,
    weighted: true,
    angle: (m) => jointAngle(m, 'shoulder', 'hip', 'knee'),
    bottomThreshold: 125,
    topThreshold: 165,
    startAt: 'low',
    formRules: [],
    cues: ['Chin tucked', 'Squeeze the glutes hard at the top', 'Full hip extension'],
    muscles: ['glutes', 'hamstrings'],
  },
  {
    id: 'sit_up',
    name: 'Sit-Up',
    category: 'core',
    equipment: 'bodyweight',
    defaultWeightKg: 0,
    weighted: false,
    angle: (m) => jointAngle(m, 'shoulder', 'hip', 'knee'),
    bottomThreshold: 80,
    topThreshold: 130,
    startAt: 'high',
    formRules: [],
    cues: ['Exhale on the way up', 'Control the descent'],
    muscles: ['abs', 'hip flexors'],
  },
  {
    id: 'jumping_jack',
    name: 'Jumping Jack',
    category: 'full body',
    equipment: 'bodyweight',
    defaultWeightKg: 0,
    weighted: false,
    angle: (m) => jointAngle(m, 'elbow', 'shoulder', 'hip'),
    bottomThreshold: 45,
    topThreshold: 130,
    startAt: 'low',
    formRules: [],
    cues: ['Light on your feet', 'Full range with the arms'],
    muscles: ['cardio', 'full body'],
  },
];

export const exerciseById = (id: string): ExerciseDef => {
  const e = EXERCISES.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown exercise: ${id}`);
  return e;
};
