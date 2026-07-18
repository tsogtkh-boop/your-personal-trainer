// Camera + pose detection engine (web). Uses TensorFlow.js MoveNet.
import { KP } from './geometry';
import { JOINT_TRIPLE, Posture, TrackedJoint } from './exercises';

export type PoseCallback = (keypoints: KP[]) => void;

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

// ---------------------------------------------------------------------------
// Demo simulator: generates a synthetic pose whose tracked joint moves through
// a plausible range of motion, so the SmartCoach can be demonstrated with no
// camera. The keypoints are never drawn — they only feed the coach.
// ---------------------------------------------------------------------------

interface Pt {
  x: number;
  y: number;
}

const rotate = (u: Pt, deg: number): Pt => {
  const r = (deg * Math.PI) / 180;
  return { x: u.x * Math.cos(r) - u.y * Math.sin(r), y: u.x * Math.sin(r) + u.y * Math.cos(r) };
};

// which endpoint of the joint triple represents the moving limb
const ANIMATE_A: Record<TrackedJoint, boolean> = { knee: false, elbow: false, hip: true, shoulder: true };

export class PoseSimulator {
  private t = 0;
  private period = 2.6;
  private joint: TrackedJoint;
  private posture: Posture;

  constructor(ex: { trackedJoint: TrackedJoint; posture: Posture }) {
    this.joint = ex.trackedJoint;
    this.posture = ex.posture;
  }

  tick(dt: number): KP[] {
    this.t += dt;
    const flex = (1 - Math.cos((2 * Math.PI * this.t) / this.period)) / 2; // 0 (extended) .. 1 (flexed)
    const target = 165 - flex * 100; // 165° extended → 65° flexed

    // neutral standing skeleton (image space ~640x480)
    const base: Record<string, Pt> = {
      nose: { x: 320, y: 70 },
      left_shoulder: { x: 288, y: 140 },
      right_shoulder: { x: 352, y: 140 },
      left_elbow: { x: 276, y: 205 },
      right_elbow: { x: 364, y: 205 },
      left_wrist: { x: 270, y: 262 },
      right_wrist: { x: 370, y: 262 },
      left_hip: { x: 300, y: 272 },
      right_hip: { x: 340, y: 272 },
      left_knee: { x: 298, y: 356 },
      right_knee: { x: 342, y: 356 },
      left_ankle: { x: 297, y: 440 },
      right_ankle: { x: 343, y: 440 },
    };

    // lean the torso forward for hinge exercises so posture reads correctly
    if (this.posture === 'hinge') {
      for (const s of ['left', 'right'] as const) {
        base[`${s}_shoulder`].x += 95;
        base[`${s}_elbow`].x += 95;
        base[`${s}_wrist`].x += 95;
        base.nose.x += 95;
      }
    }

    const [aN, bN, cN] = JOINT_TRIPLE[this.joint];
    const animateA = ANIMATE_A[this.joint];
    const movedName = animateA ? aN : cN;
    const refName = animateA ? cN : aN;
    const R = 84;

    for (const s of ['left', 'right'] as const) {
      const pivot = base[`${s}_${bN}`];
      const ref = base[`${s}_${refName}`];
      let u = { x: ref.x - pivot.x, y: ref.y - pivot.y };
      const mag = Math.hypot(u.x, u.y) || 1;
      u = { x: u.x / mag, y: u.y / mag };
      // rotate the reference direction by `target` to place the moving limb; sign
      // mirrored per side keeps left/right symmetric
      const sign = s === 'left' ? 1 : -1;
      const dir = rotate(u, sign * target);
      base[`${s}_${movedName}`] = { x: pivot.x + dir.x * R, y: pivot.y + dir.y * R };
    }

    return Object.entries(base).map(([name, p]) => ({
      name,
      x: p.x + (Math.random() - 0.5) * 1.4,
      y: p.y + (Math.random() - 0.5) * 1.4,
      score: 0.9,
    }));
  }
}
