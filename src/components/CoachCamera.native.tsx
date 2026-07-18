// Native camera coaching (iOS/Android). Real-time pose runs on a vision-camera
// frame-processor worklet: each frame is resized to MoveNet's 192x192 input,
// run through the TFLite model on the native side, and the resulting 17
// keypoints are shipped back to JS as the same KP[] the SmartCoach consumes.
//
// Requires a custom dev build (Expo Go can't load these native modules).
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { Worklets } from 'react-native-worklets-core';
import { KP } from '../lib/geometry';
import { CoachCameraProps } from './CoachCamera.types';
import movenetModel from '../../assets/movenet-lightning-int8.tflite';

// MoveNet SinglePose keypoint order (COCO). For keypoint i the model output holds
// [y, x, score] at offsets i*3+0, i*3+1, i*3+2, all normalised 0..1.
const KP_NAMES = [
  'nose',
  'left_eye',
  'right_eye',
  'left_ear',
  'right_ear',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
];

// Cap pose inference; the coach doesn't need every camera frame and this keeps
// the phone cool. MoveNet Lightning is fast, so 12fps feels live.
const TARGET_FPS = 12;

export const CoachCamera: React.FC<CoachCameraProps> = ({ active, onPose, onReady, onError, style }) => {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const { resize } = useResizePlugin();
  const plugin = useTensorflowModel(movenetModel);
  const tfModel = plugin.state === 'loaded' ? plugin.model : undefined;

  // request camera access on mount
  useEffect(() => {
    if (hasPermission) return;
    let cancelled = false;
    requestPermission().then((granted) => {
      if (!cancelled && !granted) {
        onError?.('I need your camera to coach your form. Enable camera access in Settings, then start again.');
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission]);

  // surface model / device readiness
  useEffect(() => {
    if (plugin.state === 'error') onError?.('Could not load the pose model. Try reinstalling the app.');
    else if (plugin.state === 'loaded' && hasPermission && device) onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugin.state, hasPermission, device]);

  // bridge worklet -> JS once, keyed to the callback identity
  const emitPose = useMemo(() => Worklets.createRunOnJS(onPose), [onPose]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (!active || tfModel == null) return;
      runAtTargetFps(TARGET_FPS, () => {
        'worklet';
        // resize + convert to the model's uint8 RGB 192x192 input, on the native side
        const input = resize(frame, {
          scale: { width: 192, height: 192 },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });
        const outputs = tfModel.runSync([input]);
        const kp = outputs[0]; // Float32Array length 51: [y, x, score] x 17
        const points: KP[] = [];
        for (let i = 0; i < 17; i++) {
          // multiply normalised coords by real frame size to undo the square
          // resize, restoring true aspect ratio so joint angles stay correct
          points.push({
            x: (kp[i * 3 + 1] as number) * frame.width,
            y: (kp[i * 3 + 0] as number) * frame.height,
            score: kp[i * 3 + 2] as number,
            name: KP_NAMES[i],
          });
        }
        emitPose(points);
      });
    },
    [active, tfModel, resize, emitPose],
  );

  if (!device) {
    return (
      <View style={[styles.fill, style]}>
        <Text style={styles.msg}>No camera found on this device.</Text>
      </View>
    );
  }
  if (!hasPermission || plugin.state !== 'loaded') {
    return (
      <View style={[styles.fill, style]}>
        <Text style={styles.msg}>{plugin.state === 'loading' ? 'Loading pose model…' : 'Waiting for camera…'}</Text>
      </View>
    );
  }

  return (
    <Camera
      style={[StyleSheet.absoluteFill, style]}
      device={device}
      isActive
      frameProcessor={frameProcessor}
    />
  );
};

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  msg: { color: '#8E8E99', fontSize: 13 },
});

export default CoachCamera;
