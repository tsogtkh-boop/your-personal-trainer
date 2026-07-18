// Pose geometry helpers operating on MoveNet keypoints.

export interface KP {
  x: number;
  y: number;
  score?: number;
  name?: string;
}

export type PoseMap = Record<string, KP>;

export function toPoseMap(keypoints: KP[]): PoseMap {
  const m: PoseMap = {};
  for (const k of keypoints) if (k.name) m[k.name] = k;
  return m;
}

/** Inner angle at point b (degrees, 0..180) formed by segments b->a and b->c. */
export function angleDeg(a: KP, b: KP, c: KP): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 === 0 || m2 === 0) return 180;
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Angle of segment a->b measured from vertical (0 = perfectly vertical). */
export function verticalTiltDeg(a: KP, b: KP): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return 0;
  const cos = Math.abs(dy) / mag;
  return (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
}

/** Average of left/right keypoint pair when both visible, else whichever is. */
export function side(m: PoseMap, base: string, minScore = 0.3): KP | null {
  const l = m[`left_${base}`];
  const r = m[`right_${base}`];
  const lo = l && (l.score ?? 1) >= minScore ? l : null;
  const ro = r && (r.score ?? 1) >= minScore ? r : null;
  if (lo && ro) return { x: (lo.x + ro.x) / 2, y: (lo.y + ro.y) / 2, score: Math.min(lo.score ?? 1, ro.score ?? 1) };
  return lo || ro;
}

/** Pick the more visible body side ('left' | 'right') based on total keypoint score. */
export function dominantSide(m: PoseMap): 'left' | 'right' {
  const names = ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle'];
  let ls = 0;
  let rs = 0;
  for (const n of names) {
    ls += m[`left_${n}`]?.score ?? 0;
    rs += m[`right_${n}`]?.score ?? 0;
  }
  return ls >= rs ? 'left' : 'right';
}

export function jointAngle(m: PoseMap, aName: string, bName: string, cName: string): number | null {
  const s = dominantSide(m);
  return sideJointAngle(m, s, aName, bName, cName);
}

/** Joint angle at `bName` for a specific body side; null if keypoints missing/low-confidence. */
export function sideJointAngle(
  m: PoseMap,
  s: 'left' | 'right',
  aName: string,
  bName: string,
  cName: string,
  minScore = 0.25,
): number | null {
  const a = m[`${s}_${aName}`] ?? m[aName];
  const b = m[`${s}_${bName}`] ?? m[bName];
  const c = m[`${s}_${cName}`] ?? m[cName];
  if (!a || !b || !c) return null;
  if ((a.score ?? 1) < minScore || (b.score ?? 1) < minScore || (c.score ?? 1) < minScore) return null;
  return angleDeg(a, b, c);
}

/** Vertical offset between a left/right pair, normalized by torso length (0 = perfectly level). */
export function levelOffset(m: PoseMap, base: string): number | null {
  const l = m[`left_${base}`];
  const r = m[`right_${base}`];
  if (!l || !r || (l.score ?? 1) < 0.3 || (r.score ?? 1) < 0.3) return null;
  const sh = side(m, 'shoulder');
  const hip = side(m, 'hip');
  const torso = sh && hip ? Math.hypot(sh.x - hip.x, sh.y - hip.y) : 100;
  if (torso <= 0) return null;
  return Math.abs(l.y - r.y) / torso;
}

/** How confidently the whole body is visible (0..1) over the key landmarks. */
export function bodyVisibility(m: PoseMap): number {
  const names = [
    'left_shoulder',
    'right_shoulder',
    'left_hip',
    'right_hip',
    'left_knee',
    'right_knee',
    'left_ankle',
    'right_ankle',
  ];
  let sum = 0;
  for (const n of names) sum += m[n]?.score ?? 0;
  return sum / names.length;
}
