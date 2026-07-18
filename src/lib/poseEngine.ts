// Camera + pose detection engine (web). Uses TensorFlow.js MoveNet.
import { KP } from './geometry';

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
