# Native camera coaching (iOS / Android)

The camera form-coach runs two ways behind one interface, so `SmartCoach` and
the whole coaching UI are identical on every platform:

| Platform | Capture + pose inference | File |
| --- | --- | --- |
| Web | TF.js MoveNet (WebGL) + `getUserMedia` | [`src/lib/poseEngine.ts`](src/lib/poseEngine.ts) |
| iOS / Android | vision-camera frame processor + TFLite MoveNet | [`src/components/CoachCamera.native.tsx`](src/components/CoachCamera.native.tsx) |

Both emit the same `KP[]` keypoints; [`src/components/CoachCamera.tsx`](src/components/CoachCamera.tsx)
is a no-op web stub so the shared import resolves.

## Native stack

- `react-native-vision-camera` v4 — camera + frame processors
- `react-native-fast-tflite` v1.6 — runs the `.tflite` model on-device
- `vision-camera-resize-plugin` — resizes each frame to MoveNet's 192×192 uint8 input inside the worklet
- `react-native-worklets-core` — the worklet runtime (babel plugin in `babel.config.js`)
- Model: `assets/movenet-lightning-int8.tflite` (MoveNet SinglePose Lightning, int8, ~2.9 MB), bundled via the `tflite` asset ext in `metro.config.js`

## Why it can't run in Expo Go

Frame processors need native modules that Expo Go doesn't ship. You must build a
**custom dev client**.

## Build + test on a real phone

```bash
# one-time
npm install -g eas-cli
eas login
eas build:configure          # already scaffolded in eas.json

# build a dev client (pick your platform)
eas build --profile development --platform ios      # needs an Apple Developer account
eas build --profile development --platform android   # simplest to start with

# install the build on your device (scan the QR from the EAS page), then:
npx expo start --dev-client
```

Open the app, go to **Workout → Start coached workout**, allow the camera when
prompted, and stand back far enough that your whole body is in frame (side-on
for squats/presses). Pose runs at ~12 fps on the camera thread.

## Tuning

- **Frame rate:** `TARGET_FPS` in `CoachCamera.native.tsx` (12 is a good balance; raise for smoother tempo detection, lower to save battery).
- **GPU delegate (faster):** pass a delegate to `useTensorflowModel(movenetModel, 'core-ml')` on iOS or `'android-gpu'` on Android, and add the `react-native-fast-tflite` config plugin to `app.json`. Not every device supports every delegate — test before shipping.
- **Model:** swap in MoveNet **Thunder** (larger, more accurate, slower) by replacing the `.tflite` asset and keeping the same 17-keypoint output layout.

## Not yet verified on-device

This wiring type-checks and the web build is unaffected, but the native path has
**not** been run on a physical device in this environment (no EAS build / device
here). Expect to iterate on: iOS camera permission text, frame-processor
performance on older phones, and front/back camera orientation/mirroring.
