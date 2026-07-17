// Camera + pose detection engine (web). Uses TensorFlow.js MoveNet.
import { KP } from './geometry';

export type PoseCallback = (keypoints: KP[]) => void;

const CONNECTIONS: [string, string][] = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
];

export class PoseEngine {
  private detector: any = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private running = false;
  private rafId: number | null = null;

  async init(video: HTMLVideoElement): Promise<void> {
    this.video = video;
    const tf = await import('@tensorflow/tfjs');
    await tf.ready();
    if (tf.getBackend() !== 'webgl') {
      try {
        await tf.setBackend('webgl');
      } catch {
        await tf.setBackend('cpu');
      }
    }
    const poseDetection = await import('@tensorflow-models/pose-detection');
    this.detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    });
  }

  async openCamera(): Promise<void> {
    if (!this.video) throw new Error('call init first');
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await new Promise<void>((resolve) => {
      this.video!.onloadedmetadata = () => resolve();
    });
    await this.video.play();
  }

  /** Play a prerecorded clip (real-athlete demo) and run pose detection on it. */
  async openVideoFile(uri: string): Promise<void> {
    if (!this.video) throw new Error('call init first');
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
    this.video.crossOrigin = 'anonymous';
    this.video.loop = true;
    this.video.muted = true;
    this.video.src = uri;
    await new Promise<void>((resolve, reject) => {
      const v = this.video!;
      const onErr = () => reject(new Error('demo video failed to load'));
      v.onloadeddata = () => resolve();
      v.onerror = onErr;
      setTimeout(onErr, 15000);
    });
    // Autoplay may be blocked until a user gesture — don't treat that as fatal;
    // the clip is loaded and will play on the first interaction.
    try {
      await this.video.play();
    } catch {
      /* autoplay blocked — keep the loaded clip on screen anyway */
    }
  }

  start(onPose: PoseCallback): void {
    this.running = true;
    const loop = async () => {
      if (!this.running || !this.detector || !this.video) return;
      try {
        const poses = await this.detector.estimatePoses(this.video);
        if (poses.length > 0) onPose(poses[0].keypoints as KP[]);
      } catch {
        // skip frame
      }
      if (this.running) this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.video) this.video.srcObject = null;
  }

  dispose(): void {
    this.stop();
    this.detector?.dispose?.();
    this.detector = null;
  }
}

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  kps: KP[],
  width: number,
  height: number,
  scaleX = 1,
  scaleY = 1,
  color = '#22D3A5',
): void {
  ctx.clearRect(0, 0, width, height);
  const map: Record<string, KP> = {};
  for (const k of kps) if (k.name) map[k.name] = k;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const [a, b] of CONNECTIONS) {
    const ka = map[a];
    const kb = map[b];
    if (ka && kb && (ka.score ?? 1) > 0.3 && (kb.score ?? 1) > 0.3) {
      ctx.beginPath();
      ctx.moveTo(ka.x * scaleX, ka.y * scaleY);
      ctx.lineTo(kb.x * scaleX, kb.y * scaleY);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#FFFFFF';
  for (const k of kps) {
    if ((k.score ?? 1) > 0.3) {
      ctx.beginPath();
      ctx.arc(k.x * scaleX, k.y * scaleY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------------
// Demo simulator: generates a synthetic skeleton moving through an exercise's
// range of motion so rep counting / form feedback works with no camera.
// ---------------------------------------------------------------------------

const SIM_TRIPLES: Record<string, [string, string, string]> = {
  squat: ['hip', 'knee', 'ankle'],
  leg_extension: ['hip', 'knee', 'ankle'],
  lunge: ['hip', 'knee', 'ankle'],
  deadlift: ['shoulder', 'hip', 'knee'],
  hip_thrust: ['shoulder', 'hip', 'knee'],
  sit_up: ['shoulder', 'hip', 'knee'],
  bench_press: ['shoulder', 'elbow', 'wrist'],
  overhead_press: ['shoulder', 'elbow', 'wrist'],
  bicep_curl: ['shoulder', 'elbow', 'wrist'],
  pull_up: ['shoulder', 'elbow', 'wrist'],
  push_up: ['shoulder', 'elbow', 'wrist'],
  bent_over_row: ['shoulder', 'elbow', 'wrist'],
  lateral_raise: ['elbow', 'shoulder', 'hip'],
  jumping_jack: ['elbow', 'shoulder', 'hip'],
};

interface SimExercise {
  bottomThreshold: number;
  topThreshold: number;
  startAt: 'high' | 'low';
  id: string;
}

export class PoseSimulator {
  private t = 0;
  private repPeriodSec: number;
  private ex: SimExercise;

  constructor(ex: SimExercise, repPeriodSec = 3.2) {
    this.ex = ex;
    this.repPeriodSec = repPeriodSec;
  }

  /** Advance by dt seconds and return the synthetic keypoints (640x480 space). */
  tick(dt: number): KP[] {
    this.t += dt;
    const lo = this.ex.bottomThreshold - 12;
    const hi = this.ex.topThreshold + 12;
    const mid = (lo + hi) / 2;
    const amp = (hi - lo) / 2;
    const phase = (2 * Math.PI * this.t) / this.repPeriodSec;
    // startAt 'high' → begin near hi (cos starts at +1); 'low' → begin near lo
    const sign = this.ex.startAt === 'high' ? 1 : -1;
    const jitter = (Math.random() - 0.5) * 2.5;
    const angle = mid + sign * amp * Math.cos(phase) + jitter;

    const [aN, bN, cN] = SIM_TRIPLES[this.ex.id] ?? ['shoulder', 'elbow', 'wrist'];
    const b = { x: 320, y: 260 };
    const R = 110;
    const a = { x: b.x, y: b.y - R };
    const rad = (angle * Math.PI) / 180;
    const c = { x: b.x + R * Math.sin(rad), y: b.y - R * Math.cos(rad) };

    // neutral upright skeleton for context/drawing + form rules
    const base: Record<string, { x: number; y: number }> = {
      nose: { x: 320, y: 80 },
      left_shoulder: { x: 290, y: 140 },
      right_shoulder: { x: 350, y: 140 },
      left_elbow: { x: 275, y: 200 },
      right_elbow: { x: 365, y: 200 },
      left_wrist: { x: 268, y: 255 },
      right_wrist: { x: 372, y: 255 },
      left_hip: { x: 298, y: 265 },
      right_hip: { x: 342, y: 265 },
      left_knee: { x: 295, y: 350 },
      right_knee: { x: 345, y: 350 },
      left_ankle: { x: 295, y: 435 },
      right_ankle: { x: 345, y: 435 },
    };
    base[`left_${aN}`] = a;
    base[`left_${bN}`] = b;
    base[`left_${cN}`] = c;

    return Object.entries(base).map(([name, p]) => ({
      name,
      x: p.x + (Math.random() - 0.5) * 1.5,
      y: p.y + (Math.random() - 0.5) * 1.5,
      // keep right side less confident so the left (simulated) side is dominant
      score: name.startsWith('right_') ? 0.35 : 0.95,
    }));
  }
}
