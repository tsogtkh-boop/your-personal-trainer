# Your Personal Trainer 🏋️

An AI personal trainer built with **React Native + Expo** that runs in your web browser on localhost.
A smart camera coach watches your technique and talks you through every set like a real personal trainer —
posture, alignment, left/right symmetry, range of motion and tempo — times your rests against your heart
rate, adapts the workout to your fatigue, and plans your training and meals.

## Quick start

```bash
npm install
npm run web        # → opens http://localhost:8081
```

Requires Node.js 18+ (tested on Node 22). The same codebase also starts on iOS/Android via
`npm run ios` / `npm run android` (camera pose tracking is implemented for the web build; native
builds fall back to demo tracking).

**Best browser: Chrome or Edge** — they support all three device APIs the app uses
(webcam + Web Speech voice commands + Web Bluetooth heart-rate straps).

## Features

| Feature | How it works |
|---|---|
| **AI trainer that talks like a coach** | Built-in context-aware coach (chat + spoken feedback). Optional: paste a Claude API key in Profile → the coach becomes a live LLM with your full training context. |
| **Smart camera coach** | On-device TensorFlow.js **MoveNet** pose estimation — nothing leaves your browser. The coach continuously analyzes **posture & alignment** (upright / hip-hinge / plank per exercise, back rounding, hips sagging), **left/right symmetry** (level shoulders & hips, matched limb angles), **range of motion**, **tempo & control**, and **stability**, then speaks prioritized, varied cues like a real trainer — plus praise when you're moving well. |
| **Live technique read-outs** | Form score + letter grade, posture / symmetry / tempo indicators, active-issue chips, and a set timer — all live, no skeleton clutter over the video. |
| **Editable exercise library** | 14 built-in exercises; **add your own** (name, muscle group, the joint the coach should watch, weighted/bodyweight, cues) or **delete** any you don't do. The coach analyzes custom exercises from the tracked joint you pick. |
| **Bluetooth heart rate + rest timing** | Standard BLE Heart Rate service (0x180D) via Web Bluetooth ("Connect HR strap" during a workout). Rest timer ends early once your HR recovers, or extends if you're still redlining. Simulated HR is used when no strap is connected. |
| **Fatigue adaptation** | Form-score breakdown + RPE + heart rate → next-set weight & rest adjustments. Daily readiness (from sleep/HRV) scales the whole session. |
| **Meal plans** | Mifflin-St Jeor TDEE, goal-adjusted calories, protein-first macros, menu respecting your dietary preference. |
| **Training plans** | Goal-based programs (fat loss / muscle / strength / endurance), 2–5 days/week splits, built from your active exercise library. |
| **Voice commands** | "pause workout", "resume", "make this harder", "make this easier", "done set", "skip rest", "next exercise", "how am I doing", "end workout" (Web Speech API). |
| **Auto logging** | Every set (form score + grade, top coaching tips, weight, duration, RPE, avg HR) is logged automatically and persisted. |
| **Health tracker feed** | Toggle Apple Health / Google Fit / Fitbit / Garmin connectors, push workouts with one tap (simulated handshake in this build), and export JSON/CSV in an importable format. |
| **Recovery & sleep analysis** | Recovery score from sleep, HRV, resting HR and soreness; 7-day trend; feeds directly into workout intensity. |
| **Accounts & subscriptions** | Local accounts (SHA-256 hashed passwords), Free/Pro/Elite tiers with a free-tier workout limit and simulated checkout. |

## Using the camera coach

The workout is camera-only — grant camera access when you start a set. Stand back so your whole body is
in frame, side-on for squats, presses and deadlifts. All pose processing runs on-device (TensorFlow.js
MoveNet); nothing is uploaded. If camera access is denied, the app tells you the camera is required and
returns you to the setup screen rather than faking a session.

## Project layout

```
App.tsx                      root + tab navigation
src/
  lib/
    exercises.ts             serializable exercise model + 14 built-in defaults (tracked joint, posture, cues)
    smartCoach.ts            the camera coach — posture, symmetry, range, tempo, stability → live cues + grade
    geometry.ts              joint-angle & symmetry math over MoveNet keypoints
    poseEngine.ts            MoveNet loader + webcam pose-detection loop
    voice.ts                 Web Speech recognition (commands) + speech synthesis (male/female coach voice)
    bluetoothHR.ts           Web Bluetooth HR service, HR zones, HR-guided rest logic
    fatigue.ts               form-based set fatigue, next-set adaptation, daily readiness
    trainingPlanner.ts       goal-based program generator (from your active library)
    mealPlanner.ts           TDEE + macro + menu generator
    units.ts                 kg/lb conversion + formatting
    recovery.ts              recovery scoring & trend analysis
    coach.ts                 built-in coach brain + optional Claude API coach
    health.ts                tracker connectors + JSON/CSV export
  store/useStore.ts          persisted state (accounts, logs, plans, settings, editable exercise library)
  screens/                   Auth, Dashboard, Workout, Coach, Activity (Plan/Meals/Recovery), Profile
```

## Notes

- All data is stored locally (browser localStorage via AsyncStorage). No backend required.
- The Claude API key (optional, Profile → Coach settings) is only kept in your browser and used
  directly against the Anthropic API from the client.
- This is a demo/prototype build: subscriptions don't charge, and tracker sync simulates the
  platform handshake while producing real export files.
