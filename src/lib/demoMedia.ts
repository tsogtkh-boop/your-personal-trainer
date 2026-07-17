// Real-athlete demo media (Wikimedia Commons, CC BY 3.0 / CC BY-SA 4.0).
// Videos play in demo mode with live MoveNet pose detection running on them;
// photos are used for goal cards and task thumbnails. See README for credits.

import { Asset } from 'expo-asset';

const DEMO_VIDEOS: Record<string, any> = {
  squat: require('../../assets/demo/squat.webm'),
  deadlift: require('../../assets/demo/deadlift.webm'),
  bench_press: require('../../assets/demo/bench_press.webm'),
  overhead_press: require('../../assets/demo/overhead_press.webm'),
  pull_up: require('../../assets/demo/pull_up.webm'),
  bent_over_row: require('../../assets/demo/bent_over_row.webm'),
  bicep_curl: require('../../assets/demo/bicep_curl.webm'),
  lunge: require('../../assets/demo/lunge.webm'),
  push_up: require('../../assets/demo/push_up.webm'),
};

export const EXERCISE_IMAGES: Record<string, any> = {
  squat: require('../../assets/img/squat.jpg'),
  deadlift: require('../../assets/img/deadlift.jpg'),
  bench_press: require('../../assets/img/bench_press.jpg'),
  overhead_press: require('../../assets/img/overhead_press.jpg'),
  pull_up: require('../../assets/img/pull_up.jpg'),
  bent_over_row: require('../../assets/img/bent_over_row.jpg'),
  bicep_curl: require('../../assets/img/bicep_curl.jpg'),
  lunge: require('../../assets/img/lunge.jpg'),
  push_up: require('../../assets/img/push_up.jpg'),
};

export function demoVideoUri(exerciseId: string): string | null {
  const mod = DEMO_VIDEOS[exerciseId];
  if (!mod) return null;
  try {
    return Asset.fromModule(mod).uri;
  } catch {
    return null;
  }
}

export function exerciseImage(exerciseId: string): any | null {
  return EXERCISE_IMAGES[exerciseId] ?? null;
}
