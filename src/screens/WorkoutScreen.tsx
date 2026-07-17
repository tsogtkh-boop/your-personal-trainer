import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import { Body, Button, Card, Chip, H1, ProgressBar, Row, Screen, Stat, Title } from '../components/UI';
import { colors, spacing } from '../theme';
import { useStore } from '../store/useStore';
import { EXERCISES, ExerciseDef, exerciseById } from '../lib/exercises';
import { RepCounter } from '../lib/repCounter';
import { toPoseMap, KP } from '../lib/geometry';
import { PoseEngine, PoseSimulator } from '../lib/poseEngine';
import { VoiceControl, VoiceCommand, speak, setSpeechEnabled, voiceSupported } from '../lib/voice';
import { demoVideoUri, exerciseImage } from '../lib/demoMedia';
import { metaFor } from '../lib/exerciseMeta';
import { displayWeight, kgToLb, weightUnit } from '../lib/units';
import { HeartRateMonitor, bluetoothSupported, hrZone, restRecommendation } from '../lib/bluetoothHR';
import { adaptNextSet, setFatigueScore } from '../lib/fatigue';
import { ExerciseLog, PlannedExercise, SetLog, WorkoutLog } from '../types';

const uid = () => Math.random().toString(36).slice(2, 12);

type Phase = 'setup' | 'active' | 'paused' | 'rpe' | 'rest' | 'summary';

interface LiveSetPlan {
  targetReps: number;
  weightKg: number;
  restSec: number;
}

export const WorkoutScreen: React.FC = () => {
  const store = useStore();
  const user = store.currentUser();
  const data = store.data();
  const settings = store.settings;
  const units = settings.units;
  // Weight spoken by the coach, in the user's unit.
  const spokenWeight = (kg: number) =>
    units === 'imperial' ? `${Math.round(kgToLb(kg))} pounds` : `${Math.round(kg * 10) / 10} kilos`;

  // ---- workout plan for this session ----
  const [phase, setPhase] = useState<Phase>('setup');
  const [session, setSession] = useState<{ dayName: string | null; exercises: { def: ExerciseDef; sets: LiveSetPlan[] }[] }>({
    dayName: null,
    exercises: [],
  });
  const [exIdx, setExIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0);
  const [useCamera, setUseCamera] = useState(false);

  // ---- live state ----
  const [reps, setReps] = useState(0);
  const [feedback, setFeedback] = useState('Get in position…');
  const [formScore, setFormScore] = useState(100);
  const [hr, setHr] = useState<number | null>(null);
  const [restLeft, setRestLeft] = useState(0);
  const [restMsg, setRestMsg] = useState('');
  const [coachMsg, setCoachMsg] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');
  const [voiceOn, setVoiceOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [engineLoading, setEngineLoading] = useState(false);
  const [demoSource, setDemoSource] = useState<'video' | 'sim' | null>(null);
  const [stageAspect, setStageAspect] = useState(4 / 3);

  // ---- refs (avoid stale closures in loops) ----
  const counterRef = useRef<RepCounter | null>(null);
  const engineRef = useRef<PoseEngine | null>(null);
  const simRef = useRef<PoseSimulator | null>(null);
  const simTimerRef = useRef<any>(null);
  const restTimerRef = useRef<any>(null);
  const watchdogRef = useRef<any>(null);
  const syntheticCountRef = useRef(false);
  const hrRef = useRef<HeartRateMonitor | null>(null);
  const hrSamplesRef = useRef<number[]>([]);
  const allHrRef = useRef<number[]>([]);
  const voiceRef = useRef<VoiceControl | null>(null);
  const phaseRef = useRef<Phase>('setup');
  const stageRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const setStartRef = useRef(0);
  const workoutStartRef = useRef(0);
  const logsRef = useRef<ExerciseLog[]>([]);
  const restElapsedRef = useRef(0);
  const sessionRef = useRef(session);
  const idxRef = useRef({ exIdx: 0, setIdx: 0 });

  phaseRef.current = phase;
  sessionRef.current = session;
  idxRef.current = { exIdx, setIdx };

  useEffect(() => {
    setSpeechEnabled(settings.voiceEnabled);
  }, [settings.voiceEnabled]);

  const planDay = data.plan ? data.plan.days[data.logs.length % data.plan.days.length] : null;

  const currentEx = session.exercises[exIdx];
  const currentSet: LiveSetPlan | undefined = currentEx?.sets[setIdx];

  // ------------------------------------------------------------------
  // session assembly
  // ------------------------------------------------------------------
  const startFromPlan = () => {
    if (!planDay) return;
    const exercises = planDay.exercises.map((pe: PlannedExercise) => ({
      def: exerciseById(pe.exerciseId),
      sets: pe.sets.map((s) => ({ targetReps: s.targetReps, weightKg: s.targetWeightKg, restSec: s.restSec })),
    }));
    beginSession(planDay.name, exercises);
  };

  const startQuick = (def: ExerciseDef) => {
    const sets: LiveSetPlan[] = [1, 2, 3].map(() => ({
      targetReps: 10,
      weightKg: def.defaultWeightKg,
      restSec: 75,
    }));
    beginSession(null, [{ def, sets }]);
  };

  const beginSession = (dayName: string | null, exercises: { def: ExerciseDef; sets: LiveSetPlan[] }[]) => {
    logsRef.current = exercises.map((e) => ({ exerciseId: e.def.id, name: e.def.name, sets: [] }));
    workoutStartRef.current = Date.now();
    allHrRef.current = [];
    setSession({ dayName, exercises });
    setExIdx(0);
    setSetIdx(0);
    startSet(exercises[0].def, 0, exercises);
    startHeartRate();
    startVoice();
    const first = exercises[0];
    speak(
      `Let's go! ${dayName ?? first.def.name} session. First up: ${first.def.name}, ${first.sets[0].targetReps} reps${first.def.weighted ? ` at ${spokenWeight(first.sets[0].weightKg)}` : ''}. ${first.def.cues[0]}.`,
      { interrupt: true },
    );
  };

  // ------------------------------------------------------------------
  // set lifecycle
  // ------------------------------------------------------------------
  const startSet = (def: ExerciseDef, _setIdx: number, exercises?: { def: ExerciseDef; sets: LiveSetPlan[] }[]) => {
    counterRef.current = new RepCounter(def);
    hrSamplesRef.current = [];
    setReps(0);
    setFormScore(100);
    setFeedback('Get in position…');
    setStartRef.current = Date.now();
    setPhase('active');
    hrRef.current?.setSimulatedLoad(0.85);
    startTracking(def);
  };

  // Feed a pose into the rep counter and reflect it in the UI.
  const feedCounter = (m: ReturnType<typeof toPoseMap>) => {
    const counter = counterRef.current;
    if (!counter) return;
    const st = counter.update(m, Date.now() / 1000);
    setReps(st.reps);
    setFormScore(st.formScore);
    if (st.feedback) {
      setFeedback(st.feedback);
      speak(st.feedback);
    }
    const { exIdx: e, setIdx: s } = idxRef.current;
    const target = sessionRef.current.exercises[e]?.sets[s]?.targetReps ?? 999;
    if (st.reps >= target) finishSet();
  };

  // From MoveNet (live camera or real-athlete video): count reps from the pose,
  // unless we've handed counting to the synthetic cadence. No overlay is drawn.
  const onPoseFrame = useCallback((kps: KP[]) => {
    if (phaseRef.current !== 'active') return;
    if (!syntheticCountRef.current) feedCounter(toPoseMap(kps));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pure simulator (exercises with no demo clip): drives the rep counter only.
  const onSimFrame = useCallback((kps: KP[]) => {
    if (phaseRef.current !== 'active') return;
    feedCounter(toPoseMap(kps));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hybrid: real athlete video on screen, rep cadence driven synthetically.
  const onSyntheticCountFrame = useCallback((kps: KP[]) => {
    if (phaseRef.current !== 'active') return;
    feedCounter(toPoseMap(kps));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPoseFrameRef = useRef(onPoseFrame);
  onPoseFrameRef.current = onPoseFrame;
  const onSimFrameRef = useRef(onSimFrame);
  onSimFrameRef.current = onSimFrame;
  const onSyntheticCountFrameRef = useRef(onSyntheticCountFrame);
  onSyntheticCountFrameRef.current = onSyntheticCountFrame;

  /** Create the DOM video element early so tracking can start before the mount effect runs. */
  const ensureStageEls = () => {
    if (Platform.OS !== 'web') return;
    if (!videoRef.current) {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
      videoRef.current = video;
    }
  };

  const configureStage = (srcW: number, srcH: number, mirror: boolean, showVideo: boolean) => {
    const video = videoRef.current;
    if (video) {
      video.style.transform = mirror ? 'scaleX(-1)' : 'none';
      video.style.display = showVideo ? 'block' : 'none';
    }
    setStageAspect(srcW / srcH);
  };

  const startSimInterval = (def: ExerciseDef, cb: (kps: KP[]) => void) => {
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    simRef.current = new PoseSimulator(def);
    let last = Date.now();
    simTimerRef.current = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      cb(simRef.current!.tick(dt));
    }, 50);
  };

  // Pure synthetic athlete — used only for exercises that have no demo clip.
  const startSimulator = (def: ExerciseDef, note?: string) => {
    engineRef.current?.stop();
    syntheticCountRef.current = false;
    configureStage(640, 480, false, false);
    setDemoSource('sim');
    if (note !== undefined) setCameraError(note);
    startSimInterval(def, (kps) => onSimFrameRef.current(kps));
  };

  // Keep the real athlete video playing & visible, but count reps synthetically.
  const startHybridCounting = (def: ExerciseDef) => {
    syntheticCountRef.current = true;
    startSimInterval(def, (kps) => onSyntheticCountFrameRef.current(kps));
  };

  const startTracking = async (def: ExerciseDef) => {
    stopTracking();
    ensureStageEls();
    syntheticCountRef.current = false;

    // 1) live camera
    if (useCamera && Platform.OS === 'web') {
      try {
        setEngineLoading(true);
        if (!engineRef.current) {
          engineRef.current = new PoseEngine();
          await engineRef.current.init(videoRef.current!);
        }
        await engineRef.current.openCamera();
        configureStage(640, 480, true, true);
        setDemoSource(null);
        engineRef.current.start((kps) => onPoseFrameRef.current(kps));
        setEngineLoading(false);
        setCameraError(null);
        return;
      } catch (err: any) {
        setEngineLoading(false);
        setCameraError(`Camera unavailable (${err?.message ?? 'denied'}) — using athlete demo instead.`);
      }
    }

    // 2) real-athlete demo footage with live pose detection
    const uri = Platform.OS === 'web' ? demoVideoUri(def.id) : null;
    if (uri) {
      try {
        setEngineLoading(true);
        if (!engineRef.current) {
          engineRef.current = new PoseEngine();
          await engineRef.current.init(videoRef.current!);
        }
        await engineRef.current.openVideoFile(uri);
        const v = videoRef.current!;
        configureStage(v.videoWidth || 640, v.videoHeight || 480, false, true);
        setDemoSource('video');
        setCameraError(null);
        engineRef.current.start((kps) => onPoseFrameRef.current(kps));
        setEngineLoading(false);
        // Real clips vary — if the pose AI hasn't counted a rep from this footage
        // shortly, keep the athlete on screen and drive the rep cadence ourselves.
        watchdogRef.current = setTimeout(() => {
          if (phaseRef.current === 'active' && (counterRef.current?.state.reps ?? 0) === 0) {
            startHybridCounting(def);
          }
        }, 9000);
        return;
      } catch {
        setEngineLoading(false);
      }
    }

    // 3) synthetic simulator (no clip for this exercise)
    startSimulator(def);
  };

  const stopTracking = () => {
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    simTimerRef.current = null;
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = null;
    engineRef.current?.stop();
    try {
      videoRef.current?.pause?.();
    } catch {
      /* noop */
    }
  };

  const finishSet = (viaVoice = false) => {
    if (phaseRef.current !== 'active') return;
    stopTracking();
    hrRef.current?.setSimulatedLoad(0.3);
    const counter = counterRef.current!;
    const st = counter.state;
    const dur = (Date.now() - setStartRef.current) / 1000;
    const avgHr = hrSamplesRef.current.length
      ? Math.round(hrSamplesRef.current.reduce((a, b) => a + b, 0) / hrSamplesRef.current.length)
      : null;
    const { exIdx: e, setIdx: s } = idxRef.current;
    const plan = sessionRef.current.exercises[e].sets[s];
    const log: SetLog = {
      reps: st.reps,
      weightKg: sessionRef.current.exercises[e].def.weighted ? plan.weightKg : 0,
      durationSec: Math.round(dur),
      avgRepSec: st.avgRepSec ?? 0,
      faults: st.faultsThisSet,
      formScore: st.formScore,
      rpe: null,
      avgHr,
    };
    logsRef.current[e].sets.push(log);
    setPhase('rpe');
    speak(`Set done — ${st.reps} reps, form score ${st.formScore}. How hard was that, 6 to 10?`, { interrupt: viaVoice });
  };

  const submitRpe = (rpe: number | null) => {
    const { exIdx: e, setIdx: s } = idxRef.current;
    const exLog = logsRef.current[e];
    const setLog = exLog.sets[exLog.sets.length - 1];
    if (setLog) setLog.rpe = rpe;

    const counter = counterRef.current!;
    const sess = sessionRef.current;
    const plan = sess.exercises[e].sets[s];
    const adj = adaptNextSet({
      velocityLossRatio: counter.velocityLossRatio(),
      rpe,
      avgHr: setLog?.avgHr ?? null,
      age: user?.profile.age ?? 30,
      formScore: setLog?.formScore ?? 100,
      targetRepsHit: (setLog?.reps ?? 0) >= plan.targetReps,
      repsOverTarget: (setLog?.reps ?? 0) - plan.targetReps,
    });

    // apply adaptation to remaining sets of this exercise
    const nextSets = sess.exercises[e].sets;
    for (let i = s + 1; i < nextSets.length; i++) {
      if (sess.exercises[e].def.weighted) {
        nextSets[i].weightKg = Math.max(0, Math.round((nextSets[i].weightKg * (1 + adj.weightDeltaPct / 100)) / 2.5) * 2.5);
      }
      nextSets[i].targetReps = Math.max(3, nextSets[i].targetReps + adj.repsDelta);
      nextSets[i].restSec = Math.max(20, nextSets[i].restSec + adj.restDeltaSec);
    }
    setSession({ ...sess });
    setCoachMsg(adj.message);
    speak(adj.message);
    startRest(plan.restSec + (adj.restDeltaSec > 0 ? adj.restDeltaSec : 0));
  };

  const startRest = (sec: number) => {
    // last set of last exercise → straight to summary
    const { exIdx: e, setIdx: s } = idxRef.current;
    const sess = sessionRef.current;
    const isLastSet = s >= sess.exercises[e].sets.length - 1;
    const isLastEx = e >= sess.exercises.length - 1;
    if (isLastSet && isLastEx) {
      finishWorkout();
      return;
    }
    setPhase('rest');
    setRestLeft(sec);
    restElapsedRef.current = 0;
    setRestMsg('');
    hrRef.current?.setSimulatedLoad(0.2);
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    restTimerRef.current = setInterval(() => {
      restElapsedRef.current += 1;
      setRestLeft((prev) => {
        const next = prev - 1;
        return next;
      });
    }, 1000);
  };

  // rest countdown / HR-based early finish
  useEffect(() => {
    if (phase !== 'rest') return;
    const planned = currentSetPlannedRest();
    const rec = restRecommendation(hr, user?.profile.age ?? 30, restElapsedRef.current, planned);
    if (rec.reason) setRestMsg(rec.reason);
    if (restLeft <= 0 || (rec.ready && restElapsedRef.current >= 20)) {
      advanceAfterRest();
    } else if (restLeft === 5) {
      speak('5 seconds. Get set.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restLeft, phase]);

  const currentSetPlannedRest = () => {
    const { exIdx: e, setIdx: s } = idxRef.current;
    return sessionRef.current.exercises[e]?.sets[s]?.restSec ?? 60;
  };

  const advanceAfterRest = (skip = false) => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    const sess = sessionRef.current;
    let { exIdx: e, setIdx: s } = idxRef.current;
    if (s < sess.exercises[e].sets.length - 1) {
      s += 1;
    } else if (e < sess.exercises.length - 1) {
      e += 1;
      s = 0;
      speak(`Next exercise: ${sess.exercises[e].def.name}. ${sess.exercises[e].def.cues[0]}.`, { interrupt: true });
    } else {
      finishWorkout();
      return;
    }
    setExIdx(e);
    setSetIdx(s);
    const def = sess.exercises[e].def;
    const plan = sess.exercises[e].sets[s];
    if (!skip) speak(`Set ${s + 1}: ${plan.targetReps} reps${def.weighted ? ` at ${spokenWeight(plan.weightKg)}` : ''}. Go when ready.`);
    startSet(def, s);
  };

  const skipToNextExercise = () => {
    const sess = sessionRef.current;
    const { exIdx: e } = idxRef.current;
    if (e >= sess.exercises.length - 1) {
      finishWorkout();
      return;
    }
    stopTracking();
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    const ne = e + 1;
    setExIdx(ne);
    setSetIdx(0);
    speak(`Moving on: ${sess.exercises[ne].def.name}.`, { interrupt: true });
    startSet(sess.exercises[ne].def, 0);
  };

  const finishWorkout = () => {
    stopTracking();
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    hrRef.current?.setSimulatedLoad(0.05);
    setPhase('summary');

    const exercises = logsRef.current.filter((e) => e.sets.length > 0);
    if (exercises.length) {
      const totalVolumeKg = exercises.reduce(
        (a, e) => a + e.sets.reduce((x, s) => x + s.reps * (s.weightKg || (user?.profile.weightKg ?? 75) * 0.3), 0),
        0,
      );
      const avgHr = allHrRef.current.length
        ? Math.round(allHrRef.current.reduce((a, b) => a + b, 0) / allHrRef.current.length)
        : null;
      const fatigueScores = exercises.flatMap((e) =>
        e.sets.map((s) =>
          setFatigueScore({
            velocityLossRatio: null,
            rpe: s.rpe,
            avgHr: s.avgHr,
            age: user?.profile.age ?? 30,
            formScore: s.formScore,
            targetRepsHit: true,
            repsOverTarget: 0,
          }),
        ),
      );
      const log: WorkoutLog = {
        id: uid(),
        date: new Date().toISOString(),
        planDayName: sessionRef.current.dayName,
        exercises,
        totalVolumeKg,
        durationMin: Math.max(1, Math.round((Date.now() - workoutStartRef.current) / 60000)),
        avgHr,
        fatigueScore: fatigueScores.length
          ? Math.round(fatigueScores.reduce((a, b) => a + b, 0) / fatigueScores.length)
          : null,
        synced: false,
      };
      store.addWorkoutLog(log);
      speak(
        `Workout complete! ${exercises.length} exercises, ${spokenWeight(totalVolumeKg)} of total volume. Everything is logged. Great work!`,
        { interrupt: true },
      );
    }
  };

  const endEverything = () => {
    stopVoice();
    hrRef.current?.disconnect();
    hrRef.current = null;
    engineRef.current?.dispose();
    engineRef.current = null;
    setPhase('setup');
    setSession({ dayName: null, exercises: [] });
    setHr(null);
  };

  // ------------------------------------------------------------------
  // pause / adjust
  // ------------------------------------------------------------------
  const pauseWorkout = () => {
    if (phaseRef.current !== 'active') return;
    stopTracking();
    setPhase('paused');
    hrRef.current?.setSimulatedLoad(0.2);
    speak('Workout paused. Say resume when you are ready.', { interrupt: true });
  };

  const resumeWorkout = () => {
    if (phaseRef.current !== 'paused') return;
    const { exIdx: e } = idxRef.current;
    setPhase('active');
    hrRef.current?.setSimulatedLoad(0.85);
    startTracking(sessionRef.current.exercises[e].def);
    speak("Back at it — let's go.");
  };

  const adjustDifficulty = (dir: 1 | -1) => {
    const sess = sessionRef.current;
    const { exIdx: e, setIdx: s } = idxRef.current;
    const ex = sess.exercises[e];
    if (!ex) return;
    for (let i = s; i < ex.sets.length; i++) {
      if (ex.def.weighted) {
        ex.sets[i].weightKg = Math.max(0, Math.round((ex.sets[i].weightKg * (1 + dir * 0.1)) / 2.5) * 2.5);
      } else {
        ex.sets[i].targetReps = Math.max(3, ex.sets[i].targetReps + dir * 2);
      }
    }
    setSession({ ...sess });
    const msg =
      dir > 0
        ? ex.def.weighted
          ? `Cranking it up — ${spokenWeight(ex.sets[s].weightKg)} now.`
          : `More reps — target is ${ex.sets[s].targetReps}.`
        : ex.def.weighted
          ? `Easing off — ${spokenWeight(ex.sets[s].weightKg)} now.`
          : `Fewer reps — target is ${ex.sets[s].targetReps}.`;
    setCoachMsg(msg);
    speak(msg, { interrupt: true });
  };

  // ------------------------------------------------------------------
  // voice + HR wiring
  // ------------------------------------------------------------------
  const handleVoice = (cmd: VoiceCommand) => {
    switch (cmd) {
      case 'pause':
        pauseWorkout();
        break;
      case 'resume':
      case 'start':
        resumeWorkout();
        break;
      case 'harder':
        adjustDifficulty(1);
        break;
      case 'easier':
        adjustDifficulty(-1);
        break;
      case 'next':
        skipToNextExercise();
        break;
      case 'skip_rest':
        if (phaseRef.current === 'rest') advanceAfterRest(true);
        break;
      case 'end':
        finishWorkout();
        break;
      case 'status': {
        const { exIdx: e, setIdx: s } = idxRef.current;
        const sess = sessionRef.current;
        speak(
          `You're on ${sess.exercises[e]?.def.name}, set ${s + 1} of ${sess.exercises[e]?.sets.length}. ${counterRef.current?.state.reps ?? 0} reps so far, form score ${counterRef.current?.state.formScore ?? 100}.`,
          { interrupt: true },
        );
        break;
      }
    }
  };

  const startVoice = () => {
    if (!voiceSupported()) return;
    voiceRef.current = new VoiceControl();
    voiceRef.current.onTranscript = (t) => setLastTranscript(t);
    const ok = voiceRef.current.start((cmd) => handleVoice(cmd));
    setVoiceOn(ok);
  };

  const stopVoice = () => {
    voiceRef.current?.stop();
    voiceRef.current = null;
    setVoiceOn(false);
  };

  const startHeartRate = () => {
    if (hrRef.current) return;
    hrRef.current = new HeartRateMonitor();
    hrRef.current.startSimulated((bpm) => {
      setHr(bpm);
      hrSamplesRef.current.push(bpm);
      allHrRef.current.push(bpm);
    });
  };

  const connectBle = async () => {
    try {
      const mon = hrRef.current ?? new HeartRateMonitor();
      mon.disconnect();
      await mon.connectBluetooth((bpm) => {
        setHr(bpm);
        hrSamplesRef.current.push(bpm);
        allHrRef.current.push(bpm);
      });
      hrRef.current = mon;
      speak('Heart rate monitor connected.');
    } catch (err: any) {
      setCoachMsg(`Bluetooth: ${err?.message ?? 'connection cancelled'} — staying on simulated HR.`);
      if (hrRef.current?.mode !== 'sim') startHeartRate();
    }
  };

  // mount the video element into the stage div (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const host: HTMLElement | null = stageRef.current as any;
    if (!host || phase === 'setup' || phase === 'summary') return;
    ensureStageEls();
    const video = videoRef.current!;
    if (video.parentElement !== host) host.appendChild(video);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // cleanup on unmount
  useEffect(
    () => () => {
      stopTracking();
      stopVoice();
      hrRef.current?.disconnect();
      engineRef.current?.dispose();
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ------------------------------------------------------------------
  // free-tier gate
  // ------------------------------------------------------------------
  const weekWorkouts = data.logs.filter((l) => Date.now() - new Date(l.date).getTime() < 7 * 864e5).length;
  const gated = (user?.subscription.tier ?? 'free') === 'free' && weekWorkouts >= 3 && phase === 'setup';

  const zone = hr !== null ? hrZone(hr, user?.profile.age ?? 30) : null;

  // ==================================================================
  // RENDER
  // ==================================================================
  if (phase === 'setup') {
    return (
      <Screen>
        <Title>Workout</Title>
        {gated && (
          <Card style={{ borderColor: colors.warn }}>
            <H1>Free plan limit reached</H1>
            <Body dim style={{ marginBottom: spacing(1.5) }}>
              You've used your 3 tracked workouts this week. Upgrade to Pro for unlimited camera-tracked sessions.
            </Body>
            <Button title="See plans" onPress={() => store.setTab('profile')} />
          </Card>
        )}
        {!gated && (
          <>
            <Card accent>
              <H1>Tracking mode</H1>
              <Row style={{ flexWrap: 'wrap', marginBottom: spacing(1) }}>
                <Chip label="📷 Camera (pose AI)" active={useCamera} onPress={() => setUseCamera(true)} />
                <Chip label="🎬 Demo (no camera)" active={!useCamera} onPress={() => setUseCamera(false)} />
              </Row>
              <Body dim>
                {useCamera
                  ? 'Uses your webcam + on-device MoveNet pose AI. Stand back so your whole body is visible, side-on for squats and presses. Nothing is uploaded — all processing stays in your browser.'
                  : 'Demo mode plays footage of real athletes performing each exercise and runs the same live pose AI on it — rep counting, form feedback, rest timing and voice control, no camera needed.'}
              </Body>
            </Card>

            {planDay && (
              <Card>
                <H1>{`From your plan: ${planDay.name}`}</H1>
                <Body dim style={{ marginBottom: spacing(1.5) }}>
                  {planDay.exercises.map((e) => `${e.name} ${e.sets.length}×${e.sets[0].targetReps}`).join('  ·  ')}
                </Body>
                <Button title="Start planned workout" onPress={startFromPlan} />
              </Card>
            )}

            <Card>
              <H1>Quick start an exercise</H1>
              <Row style={{ flexWrap: 'wrap' }}>
                {EXERCISES.map((e) => (
                  <Chip key={e.id} label={e.name} onPress={() => startQuick(e)} />
                ))}
              </Row>
            </Card>

            <Card>
              <Body dim>
                {`🎤 Voice commands during a workout: "pause workout", "resume", "make this harder", "make this easier", "skip rest", "next exercise", "how am I doing", "end workout".${voiceSupported() ? '' : ' (Voice input needs Chrome or Edge.)'}`}
              </Body>
            </Card>
          </>
        )}
      </Screen>
    );
  }

  if (phase === 'summary') {
    const exercises = logsRef.current.filter((e) => e.sets.length > 0);
    const vol = exercises.reduce((a, e) => a + e.sets.reduce((x, s) => x + s.reps * s.weightKg, 0), 0);
    return (
      <Screen>
        <Title>Workout complete 🎉</Title>
        <Row style={{ gap: spacing(1), marginBottom: spacing(1.5) }}>
          <Stat label="exercises" value={`${exercises.length}`} />
          <Stat
            label={`volume (${weightUnit(units)})`}
            value={`${Math.round(units === 'imperial' ? kgToLb(vol) : vol).toLocaleString()}`}
          />
          <Stat
            label="avg form"
            value={`${
              exercises.length
                ? Math.round(
                    exercises.flatMap((e) => e.sets).reduce((a, s) => a + s.formScore, 0) /
                      Math.max(1, exercises.flatMap((e) => e.sets).length),
                  )
                : 100
            }`}
          />
        </Row>
        {exercises.map((e) => (
          <Card key={e.exerciseId}>
            <H1>{e.name}</H1>
            {e.sets.map((s, i) => (
              <Body key={i} dim>
                {`Set ${i + 1}: ${s.reps} reps${s.weightKg ? ` × ${displayWeight(s.weightKg, units)} ${weightUnit(units)}` : ''} · form ${s.formScore}${s.rpe ? ` · RPE ${s.rpe}` : ''}${s.avgHr ? ` · HR ${s.avgHr}` : ''}${s.faults.length ? `\n   ⚠ ${s.faults.join(' ')}` : ''}`}
              </Body>
            ))}
          </Card>
        ))}
        <Body dim style={{ marginBottom: spacing(1.5) }}>
          ✅ Logged automatically. Sync to your health tracker from Profile → Connected services.
        </Body>
        <Button title="Done" onPress={endEverything} />
      </Screen>
    );
  }

  // active / paused / rpe / rest
  const def = currentEx?.def;
  const targetReps = currentSet?.targetReps ?? 0;

  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing(1) }}>
        <H1 style={{ marginBottom: 0 }}>{def?.name ?? ''}</H1>
        <Body dim>{`Set ${setIdx + 1}/${currentEx?.sets.length ?? 0} · Exercise ${exIdx + 1}/${session.exercises.length}`}</Body>
      </Row>

      {/* camera / demo stage */}
      <View
        ref={stageRef}
        style={{
          width: '100%',
          aspectRatio: stageAspect,
          backgroundColor: '#000',
          borderRadius: 14,
          overflow: 'hidden',
          marginBottom: spacing(1.5),
          position: 'relative',
        }}
      >
        {/* placeholder visual for exercises with no demo clip (photo, else emoji) */}
        {demoSource === 'sim' && def && (
          <View style={{ position: 'absolute', inset: 0 as any, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            {exerciseImage(def.id) ? (
              <Image source={exerciseImage(def.id)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <>
                <Text style={{ fontSize: 96 }}>{metaFor(def.id).emoji}</Text>
                <Text style={{ color: colors.textDim, fontSize: 14, marginTop: spacing(1) }}>{def.name}</Text>
              </>
            )}
          </View>
        )}
        {(demoSource || cameraError) && (
          <View style={{ position: 'absolute', top: 8, left: 8, zIndex: 5, backgroundColor: '#0009', borderRadius: 8, padding: 6, maxWidth: '70%' }}>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>
              {cameraError ?? (demoSource === 'video' ? '🎬 real athlete demo' : '🎮 demo mode')}
            </Text>
          </View>
        )}
        {engineLoading && (
          <View style={{ position: 'absolute', inset: 0 as any, alignItems: 'center', justifyContent: 'center', zIndex: 6 }}>
            <Text style={{ color: colors.text }}>Loading pose AI…</Text>
          </View>
        )}
        {/* big rep counter overlay */}
        <View style={{ position: 'absolute', right: 12, top: 8, zIndex: 5, alignItems: 'flex-end' }}>
          <Text style={{ color: colors.primary, fontSize: 64, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 8 }}>
            {reps}
          </Text>
          <Text style={{ color: colors.text, fontSize: 14, marginTop: -8 }}>{`/ ${targetReps} reps`}</Text>
        </View>
      </View>

      {/* live feedback strip */}
      <Card accent style={{ paddingVertical: spacing(1.2) }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body style={{ flex: 1, fontWeight: '600' }}>{`🗣 ${phase === 'paused' ? 'Paused — say "resume" or tap Resume.' : feedback}`}</Body>
        </Row>
      </Card>

      <Row style={{ gap: spacing(1), marginBottom: spacing(1.5) }}>
        <Stat label="form score" value={`${formScore}`} color={formScore >= 80 ? colors.primary : colors.warn} />
        <Stat
          label={zone ? `HR · zone ${zone.zone} ${zone.label}` : 'heart rate'}
          value={hr !== null ? `${hr}` : '—'}
          color={zone && zone.zone >= 4 ? colors.danger : colors.accent}
        />
        <Stat
          label={def?.weighted ? `weight (${weightUnit(units)})` : 'bodyweight'}
          value={def?.weighted ? displayWeight(currentSet?.weightKg ?? 0, units) : 'BW'}
        />
      </Row>

      {phase === 'rpe' && (
        <Card>
          <H1>How hard was that set? (RPE)</H1>
          <Row style={{ flexWrap: 'wrap' }}>
            {[6, 7, 8, 9, 10].map((r) => (
              <Chip key={r} label={`${r}`} onPress={() => submitRpe(r)} />
            ))}
            <Chip label="skip" onPress={() => submitRpe(null)} />
          </Row>
        </Card>
      )}

      {phase === 'rest' && (
        <Card accent>
          <H1>{`Rest — ${Math.max(0, restLeft)}s`}</H1>
          <ProgressBar pct={(restLeft / Math.max(1, currentSetPlannedRest())) * 100} color={colors.accent} />
          <Body dim style={{ marginTop: spacing(1) }}>
            {restMsg || 'Breathe. I\'m watching your heart rate — I\'ll start you early once you\'ve recovered.'}
          </Body>
          <Button title="Skip rest" kind="ghost" small onPress={() => advanceAfterRest(true)} style={{ marginTop: spacing(1) }} />
        </Card>
      )}

      {coachMsg ? (
        <Card>
          <Body>{`🤖 Coach: ${coachMsg}`}</Body>
        </Card>
      ) : null}

      {/* controls */}
      <Row style={{ flexWrap: 'wrap', gap: spacing(1) }}>
        {phase === 'active' && <Button title="⏸ Pause" kind="ghost" onPress={pauseWorkout} />}
        {phase === 'paused' && <Button title="▶ Resume" onPress={resumeWorkout} />}
        {phase === 'active' && <Button title="End set" kind="ghost" onPress={() => finishSet()} />}
        <Button title="Harder +" kind="ghost" onPress={() => adjustDifficulty(1)} />
        <Button title="Easier −" kind="ghost" onPress={() => adjustDifficulty(-1)} />
        <Button title="Next exercise ▶" kind="ghost" onPress={skipToNextExercise} />
        {bluetoothSupported() && hrRef.current?.mode !== 'ble' && (
          <Button title="❤ Connect HR strap" kind="ghost" onPress={connectBle} />
        )}
        <Button title="Finish workout" kind="danger" onPress={finishWorkout} />
      </Row>

      <Card style={{ marginTop: spacing(1.5) }}>
        <Body dim>
          {`🎤 Voice ${voiceOn ? 'listening' : voiceSupported() ? 'starting…' : 'not supported in this browser'}${lastTranscript ? ` · heard: “${lastTranscript.trim()}”` : ' — try "pause workout" or "make this harder"'}`}
        </Body>
      </Card>
    </Screen>
  );
};
