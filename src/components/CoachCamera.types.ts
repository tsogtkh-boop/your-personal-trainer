import { ViewStyle } from 'react-native';
import { KP } from '../lib/geometry';

// Shared contract for the camera+pose layer. The web build keeps its imperative
// PoseEngine path (this component is a no-op stub there); the native build
// implements it with vision-camera + a TFLite MoveNet frame processor. Either
// way the output is the same KP[] the SmartCoach already consumes — so the
// coaching brain never changes.
export interface CoachCameraProps {
  /** Feed frames to the coach only while a set is in progress (saves battery otherwise). */
  active: boolean;
  /** Called with MoveNet keypoints (named, in frame-pixel coords) each processed frame. */
  onPose: (kps: KP[]) => void;
  /** Camera + model are up and coaching can begin. */
  onReady?: () => void;
  /** Permission denied or model failed to load. */
  onError?: (message: string) => void;
  style?: ViewStyle;
}
