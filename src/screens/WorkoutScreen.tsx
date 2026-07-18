import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Body, Button, Card, Chip, H1, Input, ProgressBar, Row, Screen, Stat, Title } from '../components/UI';
import { colors, spacing } from '../theme';
import { useStore } from '../store/useStore';
import { Exercise } from '../lib/exercises';
import { KP, toPoseMap } from '../lib/geometry';
import { SmartCoach } from '../lib/smartCoach';
import { PoseEngine } from '../lib/poseEngine';
import { CoachCamera } from '../components/CoachCamera';
import { VoiceControl, VoiceCommand, speak, setSpeechEnabled, voiceSupported } from '../lib/voice';
import { displayWeight, kgToLb, parseWeightToKg, weightUnit } from '../lib/units';
import { ManualLogScreen } from './ManualLogScreen';
import { HeartRateMonitor, bluetoothSupported, hrZone, restRecommendation } from '../lib/bluetoothHR';
import { adaptNextSet, setFatigueScore } from '../lib/fatigue';
import { ExerciseLog, SetLog, WorkoutLog } from '../types';

const uid = () => Math.random().toString(36).slice(2, 12);

type Phase = 'setup' | 'active' | 'paused' | 'rpe' | 'rest' | 'summary';

interface LiveSetPlan {
  targetReps: number; // soft guide the coach references — not counted
  weightKg: number;
  restSec: number;
}

const gradeOf = (score: number): string => (score >= 88 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D');
const gradeColor = (score: number): string =>
  score >= 75 ? colors.primary : score >= 60 ? colors.warn : colors.danger;

export const WorkoutScreen: React.FC = () => {
  const store = useStore();
  const user = store.currentUser();
  const data = store.data();
  const settings = store.settings;
  const units = settings.units;
  const library = store.exercises();
  const spokenWeight = (kg: number) =>
    units === 'imperial' ? `${Math.round(kgToLb(kg))} pounds` : `${Math.round(kg * 10) / 10} kilos`;

  const [phase, setPhase] = useState<Phase>('setup');
  const [session, setSession] = useState<{ dayName: string | null; exercises: { ex: Exercise; sets: LiveSetPlan[] }[] }>({
    dayName: null,
    exercises: [],
  });
  const [exIdx, setExIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0);

  // ---- live coaching state ----
  const [formScore, setFormScore] = useState(100);
  const [feedback, setFeedback] = useState('Get in position…');
  const [issues, setIssues] = useState<string[]>([]);
  const [postureOk, setPostureOk] = useState<boolean | null>(null);
  const [symmetryPct, setSymmetryPct] = useState<number | null>(null);
  const [tempo, setTempo] = useState<'idle' | 'controlled' | 'good' | 'fast'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [hr, setHr] = useState<number | null>(null);
  const [restLeft, setRestLeft] = useState(0);
  const [restMsg, setRestMsg] = useState('');
  const [coachMsg, setCoachMsg] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');
  const [voiceOn, setVoiceOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [engineLoading, setEngineLoading] = useState(false);
  // native only: whether the vision-camera coach component is mounted
  const [cameraActive, setCameraActive] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  // what you actually did this set (typed) — logged alongside the form grade
  const [weightInput, setWeightInput] = useState('');
  const [repsInput, setRepsInput] = useState('');

  // ---- refs ----
  const coachRef = useRef<SmartCoach | null>(null);
  const engineRef = useRef<PoseEngine | null>(null);
  const restTimerRef = useRef<any>(null);
  const elapsedTimerRef = useRef<any>(null);
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
  const promptedDoneRef = useRef(false);

  phaseRef.current = phase;
  sessionRef.current = session;
  idxRef.current = { exIdx, setIdx };

  useEffect(() => {
    setSpeechEnabled(settings.voiceEnabled);
  }, [settings.voiceEnabled]);

  const planDay = data.plan ? data.plan.days[data.logs.length % data.plan.days.length] : null;
  const currentEx = session.exercises[exIdx];
  const currentSet: LiveSetPlan | undefined = currentEx?.sets[setIdx];

  // prefill the weight/reps fields from the plan whenever a new set starts
  useEffect(() => {
    if (phase !== 'active') return;
    const cs = session.exercises[exIdx]?.sets[setIdx];
    const ex = session.exercises[exIdx]?.ex;
    if (cs && ex) {
      setWeightInput(ex.weighted ? displayWeight(cs.weightKg, units) : '');
      setRepsInput('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exIdx, setIdx, phase]);

  // ------------------------------------------------------------------ session
  const startFromPlan = () => {
    if (!planDay) return;
    const exercises = planDay.exercises
      .map((pe) => {
        const ex = library.find((x) => x.id === pe.exerciseId);
        return ex ? { ex, sets: pe.sets.map((s) => ({ targetReps: s.targetReps, weightKg: s.targetWeightKg, restSec: s.restSec })) } : null;
      })
      .filter((e): e is { ex: Exercise; sets: LiveSetPlan[] } => !!e);
    if (exercises.length) beginSession(planDay.name, exercises);
  };

  const startQuick = (ex: Exercise) => {
    const sets: LiveSetPlan[] = [1, 2, 3].map(() => ({ targetReps: 10, weightKg: ex.defaultWeightKg, restSec: 75 }));
    beginSession(null, [{ ex, sets }]);
  };

  const beginSession = async (dayName: string | null, exercises: { ex: Exercise; sets: LiveSetPlan[] }[]) => {
    logsRef.current = exercises.map((e) => ({ exerciseId: e.ex.id, name: e.ex.name, sets: [] }));
    workoutStartRef.current = Date.now();
    allHrRef.current = [];
    setSession({ dayName, exercises });
    setExIdx(0);
    setSetIdx(0);
    startSet(exercises[0].ex); // renders the stage so the camera can attach

    const ok = await openCameraLoop();
    if (!ok) {
      abortToSetup();
      return;
    }
    startHeartRate();
    startVoice();
    const first = exercises[0];
    speak(
      `Let's go! ${dayName ?? first.ex.name} session. First up: ${first.ex.name}${first.ex.weighted ? ` at ${spokenWeight(first.sets[0].weightKg)}` : ''}. ${first.ex.cues[0]}. I'm watching your form — tap Done set when you finish.`,
      { interrupt: true },
    );
  };

  // ------------------------------------------------------------------ set lifecycle
  const startSet = (ex: Exercise) => {
    coachRef.current = new SmartCoach(ex);
    hrSamplesRef.current = [];
    promptedDoneRef.current = false;
    setFormScore(100);
    setIssues([]);
    setPostureOk(null);
    setSymmetryPct(null);
    setTempo('idle');
    setElapsed(0);
    setFeedback('Get in position…');
    setStartRef.current = Date.now();
    setPhase('active');
    hrRef.current?.setSimulatedLoad(0.8);
    startElapsed();
  };

  const startElapsed = () => {
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => {
      if (phaseRef.current !== 'active') return;
      const secs = Math.round((Date.now() - setStartRef.current) / 1000);
      setElapsed(secs);
      if (secs >= 45 && !promptedDoneRef.current) {
        promptedDoneRef.current = true;
        speak('Strong work — tap Done set whenever you\'re ready to rest.');
      }
    }, 1000);
  };

  // feed a pose frame into the smart coach
  const feedCoach = (m: ReturnType<typeof toPoseMap>) => {
    const coach = coachRef.current;
    if (!coach) return;
    const r = coach.update(m, Date.now() / 1000);
    setFormScore(r.formScore);
    setIssues(r.activeIssues);
    setPostureOk(r.postureOk);
    setSymmetryPct(r.symmetryPct);
    setTempo(r.tempo);
    hrRef.current?.setSimulatedLoad(r.tempo === 'idle' ? 0.45 : r.tempo === 'fast' ? 0.95 : 0.8);
    if (r.cue) {
      setFeedback(r.cue);
      speak(r.cue);
    }
  };

  const onPoseFrame = useCallback((kps: KP[]) => {
    if (phaseRef.current !== 'active') return;
    feedCoach(toPoseMap(kps));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onPoseFrameRef = useRef(onPoseFrame);
  onPoseFrameRef.current = onPoseFrame;

  const ensureVideoEl = () => {
    if (Platform.OS !== 'web') return;
    if (!videoRef.current) {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1);';
      videoRef.current = video;
    }
  };

  // Open the webcam + start the continuous pose-detection loop for the session.
  // The loop only feeds the coach while a set is active (see onPoseFrame).
  const openCameraLoop = async (): Promise<boolean> => {
    if (Platform.OS !== 'web') {
      // Native: mount the vision-camera coach. Permission/model readiness and
      // failures come back asynchronously via the component's onError/onReady.
      setEngineLoading(true);
      setCameraError(null);
      setCameraActive(true);
      return true;
    }
    ensureVideoEl();
    try {
      setEngineLoading(true);
      if (!engineRef.current) {
        engineRef.current = new PoseEngine();
        await engineRef.current.init(videoRef.current!);
      }
      await engineRef.current.openCamera();
      if (videoRef.current) videoRef.current.style.display = 'block';
      setCameraError(null);
      engineRef.current.start((kps) => onPoseFrameRef.current(kps));
      setEngineLoading(false);
      return true;
    } catch (err: any) {
      setEngineLoading(false);
      setCameraError(
        `I need your camera to coach your form (${err?.message ?? 'permission denied'}). Allow camera access, then start again.`,
      );
      engineRef.current?.dispose();
      engineRef.current = null;
      return false;
    }
  };

  const stopTracking = () => {
    engineRef.current?.stop();
    if (Platform.OS !== 'web') setCameraActive(false);
  };

  // native camera callbacks (no-ops on web, where the component never mounts)
  const onCameraReady = useCallback(() => {
    setEngineLoading(false);
    setCameraError(null);
  }, []);
  const onCameraError = useCallback((message: string) => {
    setEngineLoading(false);
    setCameraActive(false);
    setCameraError(message);
    abortToSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abortToSetup = () => {
    stopTracking();
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    stopVoice();
    hrRef.current?.disconnect();
    hrRef.current = null;
    setHr(null);
    setSession({ dayName: null, exercises: [] });
    setPhase('setup');
  };

  const finishSet = (viaVoice = false) => {
    if (phaseRef.current !== 'active') return;
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    hrRef.current?.setSimulatedLoad(0.3);
    const coach = coachRef.current!;
    const sum = coach.summary();
    const dur = (Date.now() - setStartRef.current) / 1000;
    const avgHr = hrSamplesRef.current.length
      ? Math.round(hrSamplesRef.current.reduce((a, b) => a + b, 0) / hrSamplesRef.current.length)
      : null;
    const { exIdx: e, setIdx: s } = idxRef.current;
    const ex = sessionRef.current.exercises[e].ex;
    const plan = sessionRef.current.exercises[e].sets[s];
    // use the numbers you typed; fall back to the plan's weight
    const typedWeightKg = ex.weighted ? parseWeightToKg(weightInput, units) || plan.weightKg : 0;
    const typedReps = repsInput.trim() ? parseInt(repsInput, 10) || null : null;
    plan.weightKg = typedWeightKg; // so the next-set adaptation is based on what you actually lifted
    const log: SetLog = {
      reps: typedReps,
      weightKg: typedWeightKg,
      durationSec: Math.round(dur),
      formScore: sum.score,
      grade: sum.grade,
      faults: sum.tips,
      rpe: null,
      avgHr,
    };
    logsRef.current[e].sets.push(log);
    setPhase('rpe');
    speak(`${sum.headline} Form grade ${sum.grade}. How hard was that, 6 to 10?`, { interrupt: viaVoice });
  };

  const submitRpe = (rpe: number | null) => {
    const { exIdx: e, setIdx: s } = idxRef.current;
    const exLog = logsRef.current[e];
    const setLog = exLog.sets[exLog.sets.length - 1];
    if (setLog) setLog.rpe = rpe;

    const sess = sessionRef.current;
    const plan = sess.exercises[e].sets[s];
    const adj = adaptNextSet({
      rpe,
      avgHr: setLog?.avgHr ?? null,
      age: user?.profile.age ?? 30,
      formScore: setLog?.formScore ?? 100,
    });

    const nextSets = sess.exercises[e].sets;
    for (let i = s + 1; i < nextSets.length; i++) {
      if (sess.exercises[e].ex.weighted) {
        nextSets[i].weightKg = Math.max(0, Math.round((nextSets[i].weightKg * (1 + adj.weightDeltaPct / 100)) / 2.5) * 2.5);
      }
      nextSets[i].restSec = Math.max(20, nextSets[i].restSec + adj.restDeltaSec);
    }
    setSession({ ...sess });
    setCoachMsg(adj.message);
    speak(adj.message);
    startRest(plan.restSec + (adj.restDeltaSec > 0 ? adj.restDeltaSec : 0));
  };

  const startRest = (sec: number) => {
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
      setRestLeft((prev) => prev - 1);
    }, 1000);
  };

  useEffect(() => {
    if (phase !== 'rest') return;
    const planned = currentSetPlannedRest();
    const rec = restRecommendation(hr, user?.profile.age ?? 30, restElapsedRef.current, planned);
    if (rec.reason) setRestMsg(rec.reason);
    if (restLeft <= 0 || (rec.ready && restElapsedRef.current >= 20)) advanceAfterRest();
    else if (restLeft === 5) speak('5 seconds. Get set.');
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
      speak(`Next exercise: ${sess.exercises[e].ex.name}. ${sess.exercises[e].ex.cues[0]}.`, { interrupt: true });
    } else {
      finishWorkout();
      return;
    }
    setExIdx(e);
    setSetIdx(s);
    const ex = sess.exercises[e].ex;
    const plan = sess.exercises[e].sets[s];
    if (!skip) speak(`Set ${s + 1}${ex.weighted ? ` at ${spokenWeight(plan.weightKg)}` : ''}. Go when you're ready.`);
    startSet(ex);
  };

  const skipToNextExercise = () => {
    const sess = sessionRef.current;
    const { exIdx: e } = idxRef.current;
    if (e >= sess.exercises.length - 1) {
      finishWorkout();
      return;
    }
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    const ne = e + 1;
    setExIdx(ne);
    setSetIdx(0);
    speak(`Moving on: ${sess.exercises[ne].ex.name}.`, { interrupt: true });
    startSet(sess.exercises[ne].ex);
  };

  const finishWorkout = () => {
    stopTracking();
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    hrRef.current?.setSimulatedLoad(0.05);
    setPhase('summary');

    const exercises = logsRef.current.filter((e) => e.sets.length > 0);
    if (exercises.length) {
      const allSets = exercises.flatMap((e) => e.sets);
      const coached = allSets.filter((s) => s.formScore != null);
      const avgFormScore = coached.length
        ? Math.round(coached.reduce((a, s) => a + (s.formScore ?? 0), 0) / coached.length)
        : 0;
      const avgHr = allHrRef.current.length
        ? Math.round(allHrRef.current.reduce((a, b) => a + b, 0) / allHrRef.current.length)
        : null;
      const fatigueScores = allSets.map((s) =>
        setFatigueScore({ rpe: s.rpe, avgHr: s.avgHr, age: user?.profile.age ?? 30, formScore: s.formScore ?? 100 }),
      );
      const log: WorkoutLog = {
        id: uid(),
        date: new Date().toISOString(),
        planDayName: sessionRef.current.dayName,
        exercises,
        avgFormScore,
        durationMin: Math.max(1, Math.round((Date.now() - workoutStartRef.current) / 60000)),
        avgHr,
        fatigueScore: fatigueScores.length ? Math.round(fatigueScores.reduce((a, b) => a + b, 0) / fatigueScores.length) : null,
        synced: false,
      };
      store.addWorkoutLog(log);
      speak(
        `Workout complete! ${exercises.length} exercise${exercises.length === 1 ? '' : 's'} coached, average form grade ${gradeOf(avgFormScore)}. Everything is logged. Great work!`,
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

  // ------------------------------------------------------------------ pause / adjust
  // The camera loop keeps running; the phase guard in onPoseFrame stops coaching
  // while paused, so we don't drop (and re-prompt) the camera stream.
  const pauseWorkout = () => {
    if (phaseRef.current !== 'active') return;
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    setPhase('paused');
    hrRef.current?.setSimulatedLoad(0.2);
    speak('Paused. Say resume when you are ready.', { interrupt: true });
  };

  const resumeWorkout = () => {
    if (phaseRef.current !== 'paused') return;
    setPhase('active');
    hrRef.current?.setSimulatedLoad(0.8);
    startElapsed();
    speak("Back at it — let's go.");
  };

  const adjustDifficulty = (dir: 1 | -1) => {
    const sess = sessionRef.current;
    const { exIdx: e, setIdx: s } = idxRef.current;
    const item = sess.exercises[e];
    if (!item) return;
    let msg: string;
    if (item.ex.weighted) {
      for (let i = s; i < item.sets.length; i++) {
        item.sets[i].weightKg = Math.max(0, Math.round((item.sets[i].weightKg * (1 + dir * 0.1)) / 2.5) * 2.5);
      }
      setSession({ ...sess });
      setWeightInput(displayWeight(item.sets[s].weightKg, units)); // reflect in the input
      msg = dir > 0 ? `Cranking it up — ${spokenWeight(item.sets[s].weightKg)} now.` : `Easing off — ${spokenWeight(item.sets[s].weightKg)} now.`;
    } else {
      msg = dir > 0 ? 'Make it harder — add a slow pause at the hardest point.' : 'Easing off — shorten the range and stay controlled.';
    }
    setCoachMsg(msg);
    speak(msg, { interrupt: true });
  };

  const addSet = () => {
    const sess = sessionRef.current;
    const { exIdx: e } = idxRef.current;
    const item = sess.exercises[e];
    if (!item) return;
    const last = item.sets[item.sets.length - 1];
    item.sets.push({ ...last });
    setSession({ ...sess });
    speak('Added a set.');
  };

  const removeSet = () => {
    const sess = sessionRef.current;
    const { exIdx: e, setIdx: s } = idxRef.current;
    const item = sess.exercises[e];
    if (!item || item.sets.length <= s + 1) return; // keep at least the current set
    item.sets.pop();
    setSession({ ...sess });
    speak('Removed a set.');
  };

  // ------------------------------------------------------------------ voice + HR
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
        if (phaseRef.current === 'active') finishSet(true);
        else skipToNextExercise();
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
        const issueText = issues.length ? `Watch your ${issues[0]}.` : 'Your form is looking clean.';
        speak(
          `You're on ${sess.exercises[e]?.ex.name}, set ${s + 1} of ${sess.exercises[e]?.sets.length}. Form score ${formScore}, grade ${gradeOf(formScore)}. ${issueText}`,
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

  // mount the camera video element into the stage (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const host: HTMLElement | null = stageRef.current as any;
    if (!host || phase === 'setup' || phase === 'summary') return;
    ensureVideoEl();
    const video = videoRef.current!;
    if (video.parentElement !== host) host.appendChild(video);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(
    () => () => {
      stopTracking();
      stopVoice();
      hrRef.current?.disconnect();
      engineRef.current?.dispose();
      if (restTimerRef.current) clearInterval(restTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const weekWorkouts = data.logs.filter((l) => Date.now() - new Date(l.date).getTime() < 7 * 864e5).length;
  const gated = (user?.subscription.tier ?? 'free') === 'free' && weekWorkouts >= 3 && phase === 'setup';
  const zone = hr !== null ? hrZone(hr, user?.profile.age ?? 30) : null;

  // ================================================================== RENDER
  if (manualMode) {
    return <ManualLogScreen onDone={() => setManualMode(false)} />;
  }

  if (phase === 'setup') {
    return (
      <Screen>
        <Title>Workout</Title>
        {gated && (
          <Card style={{ borderColor: colors.warn }}>
            <H1>Free plan limit reached</H1>
            <Body dim style={{ marginBottom: spacing(1.5) }}>
              You've used your 3 coached workouts this week. Upgrade to Pro for unlimited camera-coached sessions.
            </Body>
            <Button title="See plans" onPress={() => store.setTab('profile')} />
          </Card>
        )}
        {!gated && (
          <>
            <Card accent style={cameraError ? { borderColor: colors.warn } : undefined}>
              <H1>📷 Live camera coach</H1>
              <Body dim>
                Your webcam + on-device MoveNet pose AI. Your coach watches your posture, alignment, symmetry,
                range of motion and tempo, and talks you through every set. Nothing is uploaded — it all stays in
                your browser. Stand back so your whole body is in frame, side-on for squats and presses.
              </Body>
              {cameraError && (
                <Body style={{ color: colors.warn, marginTop: spacing(1) }}>{`⚠ ${cameraError}`}</Body>
              )}
            </Card>

            {planDay && (
              <Card>
                <H1>{`From your plan: ${planDay.name}`}</H1>
                <Body dim style={{ marginBottom: spacing(1.5) }}>
                  {planDay.exercises.map((e) => `${e.name} ×${e.sets.length}`).join('  ·  ')}
                </Body>
                <Button title="Start coached workout" onPress={startFromPlan} />
              </Card>
            )}

            <Card>
              <H1>Quick start an exercise</H1>
              <Row style={{ flexWrap: 'wrap' }}>
                {library.map((e) => (
                  <Chip key={e.id} label={`${e.emoji} ${e.name}`} onPress={() => startQuick(e)} />
                ))}
              </Row>
              <Button
                title="＋ Manage exercises"
                kind="ghost"
                small
                onPress={() => store.setTab('plan')}
                style={{ marginTop: spacing(1), alignSelf: 'flex-start' }}
              />
            </Card>

            <Card>
              <H1>Already trained?</H1>
              <Body dim style={{ marginBottom: spacing(1.5) }}>
                Log the weights, reps and sets you did — no camera needed. Great for machines, cardio, or sessions
                away from your phone.
              </Body>
              <Button title="✎ Log a workout manually" onPress={() => setManualMode(true)} />
            </Card>

            <Card>
              <Body dim>
                {`🎤 Voice commands: "pause workout", "resume", "make this harder / easier", "done set" / "next", "skip rest", "how am I doing", "end workout".${voiceSupported() ? '' : ' (Voice input needs Chrome or Edge.)'}`}
              </Body>
            </Card>
          </>
        )}
      </Screen>
    );
  }

  if (phase === 'summary') {
    const exercises = logsRef.current.filter((e) => e.sets.length > 0);
    const coachedSets = exercises.flatMap((e) => e.sets).filter((s) => s.formScore != null);
    const avgForm = coachedSets.length
      ? Math.round(coachedSets.reduce((a, s) => a + (s.formScore ?? 0), 0) / coachedSets.length)
      : 0;
    return (
      <Screen>
        <Title>Workout complete 🎉</Title>
        <Row style={{ gap: spacing(1), marginBottom: spacing(1.5) }}>
          <Stat label="exercises" value={`${exercises.length}`} />
          <Stat label="avg form" value={avgForm ? `${avgForm}` : '—'} color={gradeColor(avgForm)} />
          <Stat label="grade" value={avgForm ? gradeOf(avgForm) : '—'} color={gradeColor(avgForm)} />
        </Row>
        {exercises.map((e) => (
          <Card key={e.exerciseId}>
            <H1>{e.name}</H1>
            {e.sets.map((s, i) => (
              <Body key={i} dim>
                {`Set ${i + 1}: ${s.reps != null ? `${s.reps} reps` : ''}${s.weightKg ? ` × ${displayWeight(s.weightKg, units)} ${weightUnit(units)}` : s.reps != null ? '' : ''}${s.grade ? `${s.reps != null || s.weightKg ? ' · ' : ''}form ${s.grade} (${s.formScore})` : ''} · ${s.durationSec}s${s.rpe ? ` · RPE ${s.rpe}` : ''}${s.avgHr ? ` · HR ${s.avgHr}` : ''}${s.faults.length ? `\n   💡 ${s.faults.join(' ')}` : ''}`}
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
  const ex = currentEx?.ex;
  const mm = Math.floor(elapsed / 60);
  const ss = (elapsed % 60).toString().padStart(2, '0');

  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing(1) }}>
        <H1 style={{ marginBottom: 0 }}>{`${ex?.emoji ?? ''} ${ex?.name ?? ''}`}</H1>
        <Body dim>{`Set ${setIdx + 1}/${currentEx?.sets.length ?? 0} · Ex ${exIdx + 1}/${session.exercises.length}`}</Body>
      </Row>

      {/* live camera stage */}
      <View
        ref={stageRef}
        style={{
          width: '100%',
          aspectRatio: 3 / 4,
          maxHeight: 360,
          backgroundColor: '#000',
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: spacing(1.5),
          position: 'relative',
        }}
      >
        {Platform.OS !== 'web' && cameraActive && (
          <CoachCamera
            active={phase === 'active'}
            onPose={(kps) => onPoseFrameRef.current(kps)}
            onReady={onCameraReady}
            onError={onCameraError}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        )}
        <View style={{ position: 'absolute', top: 10, left: 10, zIndex: 5, backgroundColor: '#0009', borderRadius: 8, padding: 6, maxWidth: '72%' }}>
          <Text style={{ color: colors.textDim, fontSize: 12 }}>📷 live camera · pose AI coaching</Text>
        </View>
        {engineLoading && (
          <View style={{ position: 'absolute', inset: 0 as any, alignItems: 'center', justifyContent: 'center', zIndex: 6 }}>
            <Text style={{ color: colors.text }}>Starting your coach…</Text>
          </View>
        )}
        {/* live form score */}
        <View style={{ position: 'absolute', right: 12, top: 8, zIndex: 5, alignItems: 'flex-end' }}>
          <Text style={{ color: gradeColor(formScore), fontSize: 60, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 8 }}>
            {formScore}
          </Text>
          <Text style={{ color: colors.text, fontSize: 13, marginTop: -6 }}>{`form · grade ${gradeOf(formScore)}`}</Text>
        </View>
        <View style={{ position: 'absolute', left: 12, bottom: 10, zIndex: 5 }}>
          <Text style={{ color: colors.textDim, fontSize: 12 }}>{`⏱ ${mm}:${ss}`}</Text>
        </View>
      </View>

      {/* live coach feedback */}
      <Card accent style={{ paddingVertical: spacing(1.3) }}>
        <Body style={{ fontWeight: '600' }}>{`🗣 ${phase === 'paused' ? 'Paused — say "resume" or tap Resume.' : feedback}`}</Body>
      </Card>

      {/* live technique read-outs */}
      <Row style={{ gap: spacing(1), marginBottom: spacing(1) }}>
        <Stat
          label="posture"
          value={postureOk === null ? '—' : postureOk ? 'good' : 'fix'}
          color={postureOk === false ? colors.warn : colors.primary}
        />
        <Stat
          label="symmetry"
          value={symmetryPct === null ? '—' : `${symmetryPct}`}
          color={symmetryPct !== null && symmetryPct < 70 ? colors.warn : colors.primary}
        />
        <Stat label="tempo" value={tempo} color={tempo === 'fast' ? colors.warn : colors.accent} />
      </Row>
      <Row style={{ gap: spacing(1), marginBottom: spacing(1.5) }}>
        <Stat
          label={zone ? `HR · Z${zone.zone} ${zone.label}` : 'heart rate'}
          value={hr !== null ? `${hr}` : '—'}
          color={zone && zone.zone >= 4 ? colors.danger : colors.accent}
        />
        <Stat
          label={ex?.weighted ? `weight (${weightUnit(units)})` : 'bodyweight'}
          value={ex?.weighted ? displayWeight(currentSet?.weightKg ?? 0, units) : 'BW'}
        />
      </Row>

      {/* log what you actually did this set */}
      {(phase === 'active' || phase === 'paused') && (
        <Card>
          <Row style={{ justifyContent: 'space-between', marginBottom: spacing(0.5) }}>
            <H1 style={{ marginBottom: 0 }}>Log this set</H1>
            <Body dim>{`Set ${setIdx + 1} of ${currentEx?.sets.length ?? 0}`}</Body>
          </Row>
          <Row>
            {ex?.weighted && (
              <View style={{ flex: 1 }}>
                <Body dim style={{ marginBottom: 4 }}>{`Weight (${weightUnit(units)})`}</Body>
                <Input value={weightInput} onChangeText={setWeightInput} placeholder="0" keyboardType="numeric" style={{ marginBottom: 0 }} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Body dim style={{ marginBottom: 4 }}>Reps</Body>
              <Input value={repsInput} onChangeText={setRepsInput} placeholder="e.g. 8" keyboardType="numeric" style={{ marginBottom: 0 }} />
            </View>
          </Row>
          <Row style={{ marginTop: spacing(1), flexWrap: 'wrap' }}>
            <Button title="＋ Add set" kind="ghost" small onPress={addSet} />
            <Button title="− Remove set" kind="ghost" small onPress={removeSet} />
          </Row>
          <Body dim style={{ marginTop: spacing(0.75), fontSize: 12 }}>
            Type what you actually lifted — it's saved with your form grade when you tap Done set.
          </Body>
        </Card>
      )}

      {issues.length > 0 && phase === 'active' && (
        <Row style={{ flexWrap: 'wrap', marginBottom: spacing(1) }}>
          {issues.slice(0, 3).map((i) => (
            <View
              key={i}
              style={{
                backgroundColor: 'rgba(251,191,36,0.15)',
                borderRadius: 999,
                paddingVertical: 5,
                paddingHorizontal: 12,
                marginRight: 8,
                marginBottom: 8,
              }}
            >
              <Text style={{ color: colors.warn, fontSize: 12.5, fontWeight: '600' }}>{`⚠ ${i}`}</Text>
            </View>
          ))}
        </Row>
      )}

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
            {restMsg || "Breathe. I'm watching your heart rate — I'll start you early once you've recovered."}
          </Body>
          <Button title="Skip rest" kind="ghost" small onPress={() => advanceAfterRest(true)} style={{ marginTop: spacing(1) }} />
        </Card>
      )}

      {coachMsg ? (
        <Card>
          <Body>{`🤖 Coach: ${coachMsg}`}</Body>
        </Card>
      ) : null}

      <Row style={{ flexWrap: 'wrap', gap: spacing(1) }}>
        {phase === 'active' && <Button title="✓ Done set" onPress={() => finishSet()} />}
        {phase === 'active' && <Button title="⏸ Pause" kind="ghost" onPress={pauseWorkout} />}
        {phase === 'paused' && <Button title="▶ Resume" onPress={resumeWorkout} />}
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
          {`🎤 Voice ${voiceOn ? 'listening' : voiceSupported() ? 'starting…' : 'not supported in this browser'}${lastTranscript ? ` · heard: “${lastTranscript.trim()}”` : ' — try "how am I doing" or "done set"'}`}
        </Body>
      </Card>
    </Screen>
  );
};
