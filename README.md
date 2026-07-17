# Your Personal Trainer 🏋️

An AI personal trainer built with **React Native + Expo** that runs in your web browser on localhost.
It watches your exercises through the camera, counts your reps, corrects your form out loud, times your
rests against your heart rate, adapts the workout to your fatigue, and plans your training and meals.

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
| **Camera exercise tracking** | On-device TensorFlow.js **MoveNet** pose estimation — nothing leaves your browser. 14 exercises: squat, deadlift, bench press, overhead press, bicep curl, leg extension, pull-up, push-up, lunge, bent-over row, lateral raise, hip thrust, sit-up, jumping jack. |
| **Rep counting** | Joint-angle state machine with hysteresis per exercise (e.g. knee angle for squats, elbow angle for curls). Partial reps don't count — and the coach tells you why. |
| **Form correction** | Per-exercise rules (torso lean, elbow drift, hip sag, over-raising…) evaluated every frame; faults are spoken in real time and lower the set's form score. |
| **Real-time feedback** | Spoken via speech synthesis + on-screen feedback strip, form score, joint-angle readout, skeleton overlay. |
| **Bluetooth heart rate + rest timing** | Standard BLE Heart Rate service (0x180D) via Web Bluetooth ("Connect HR strap" during a workout). Rest timer ends early once your HR recovers, or extends if you're still redlining. Simulated HR is used when no strap is connected. |
| **Fatigue adaptation** | Rep-speed slowdown + RPE + heart rate + form score → next-set weight/reps/rest adjustments. Daily readiness (from sleep/HRV) scales the whole session. |
| **Meal plans** | Mifflin-St Jeor TDEE, goal-adjusted calories, protein-first macros, menu respecting your dietary preference. |
| **Training plans** | Goal-based programs (fat loss / muscle / strength / endurance), 2–5 days/week splits, bodyweight-scaled starting loads, progressive-overload rules. |
| **Voice commands** | "pause workout", "resume", "make this harder", "make this easier", "skip rest", "next exercise", "how am I doing", "end workout" (Web Speech API). |
| **Auto logging** | Every set (weight, reps, duration, rep tempo, faults, form score, RPE, avg HR) is logged automatically and persisted. |
| **Health tracker feed** | Toggle Apple Health / Google Fit / Fitbit / Garmin connectors, push workouts with one tap (simulated handshake in this build), and export JSON/CSV in an importable format. |
| **Recovery & sleep analysis** | Recovery score from sleep, HRV, resting HR and soreness; 7-day trend; feeds directly into workout intensity. |
| **Accounts & subscriptions** | Local accounts (SHA-256 hashed passwords), Free/Pro/Elite tiers with a free-tier workout limit and simulated checkout. |

## Trying it without a camera

Pick **🎮 Demo (no camera)** on the Workout tab — a simulated athlete moves through each exercise's
range of motion so the entire pipeline (rep counting, form feedback, adaptation, rest timing, logging)
runs end-to-end. Pick **📷 Camera (pose AI)** and grant camera access for real tracking: stand back so
your full body is visible, side-on for squats/presses/deadlifts.

## Project layout

```
App.tsx                      root + tab navigation
src/
  lib/
    exercises.ts             14 exercise definitions: tracked angle, thresholds, form rules, cues
    repCounter.ts            hysteresis rep state machine, fault tracking, velocity loss
    geometry.ts              joint-angle math over MoveNet keypoints
    poseEngine.ts            MoveNet loader, webcam loop, skeleton renderer, demo simulator
    voice.ts                 Web Speech recognition (commands) + speech synthesis (coach voice)
    bluetoothHR.ts           Web Bluetooth HR service, HR zones, HR-guided rest logic
    fatigue.ts               set fatigue score, next-set adaptation, daily readiness
    trainingPlanner.ts       goal-based program generator
    mealPlanner.ts           TDEE + macro + menu generator
    recovery.ts              recovery scoring & trend analysis
    coach.ts                 built-in coach brain + optional Claude API coach
    health.ts                tracker connectors + JSON/CSV export
  store/useStore.ts          persisted app state (accounts, logs, plans, settings)
  screens/                   Auth, Dashboard, Workout, Coach, Plan, Meals, Recovery, Profile
```

## Demo footage credits

Demo mode plays real-athlete exercise clips and runs the live pose AI on them. Videos and poster
photos are from [Wikimedia Commons](https://commons.wikimedia.org), used under their Creative
Commons licenses:

| Asset | Source file | License |
|---|---|---|
| squat, deadlift, bench press, shoulder press, pull-ups, bent-over row (`assets/demo/*.webm`, `assets/img/*.jpg`) | "*<exercise>* — exercise demonstration video.webm" series by Everkinetic | CC BY 3.0 |
| bicep_curl | "Video of EZ Bar Curl and Straight Bar Curl.webm" | CC BY 3.0 |
| lunge | "Forward lunge training.webm" | CC BY-SA 4.0 |
| push_up | "Interval Push-ups.webm" by Taco Fleur | CC BY-SA 4.0 |

## Notes

- All data is stored locally (browser localStorage via AsyncStorage). No backend required.
- The Claude API key (optional, Profile → Coach settings) is only kept in your browser and used
  directly against the Anthropic API from the client.
- This is a demo/prototype build: subscriptions don't charge, and tracker sync simulates the
  platform handshake while producing real export files.
