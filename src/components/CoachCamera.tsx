// Web build: camera coaching runs through the imperative PoseEngine (TF.js +
// getUserMedia) wired directly in WorkoutScreen, so this component is only a
// placeholder that keeps the shared `./CoachCamera` import resolvable. It never
// actually mounts on web (WorkoutScreen gates it behind Platform.OS !== 'web').
import React from 'react';
import { CoachCameraProps } from './CoachCamera.types';

export const CoachCamera: React.FC<CoachCameraProps> = () => null;

export default CoachCamera;
