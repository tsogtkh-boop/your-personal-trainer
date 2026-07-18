import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, Button, Card, Chip, H1, Input, Row, Screen, SectionHeader, StatTile, TaskRow } from '../components/UI';
import { colors, spacing } from '../theme';
import { useStore } from '../store/useStore';
import { generateTrainingPlan } from '../lib/trainingPlanner';
import { blurbFor, findExercise, kcalPerMinFor, setKcal, tintFor } from '../lib/exerciseMeta';
import { CATEGORIES, Category, Exercise, TRACKED_JOINTS, TrackedJoint, slugify } from '../lib/exercises';
import { displayWeight, weightUnit } from '../lib/units';
import { Goal } from '../types';

const GOALS: { key: Goal; label: string }[] = [
  { key: 'weight_loss', label: 'Lose fat' },
  { key: 'muscle_gain', label: 'Build muscle' },
  { key: 'strength', label: 'Get stronger' },
  { key: 'endurance', label: 'Endurance' },
];

export const PlanScreen: React.FC = () => {
  const store = useStore();
  const user = store.currentUser();
  const data = store.data();
  const units = store.settings.units;
  const library = store.exercises();
  const [days, setDays] = useState(3);
  const [goal, setGoal] = useState<Goal>(user?.profile.goal ?? 'muscle_gain');
  const [manage, setManage] = useState(false);

  // add-exercise form
  const [nName, setNName] = useState('');
  const [nEmoji, setNEmoji] = useState('🏋️');
  const [nCat, setNCat] = useState<Category>('legs');
  const [nJoint, setNJoint] = useState<TrackedJoint>('knee');
  const [nWeighted, setNWeighted] = useState(false);
  const [nCues, setNCues] = useState('');
  const [addMsg, setAddMsg] = useState<string | null>(null);

  const generate = () => {
    if (!user) return;
    store.updateProfile({ goal });
    store.setPlan(generateTrainingPlan({ ...user.profile, goal }, days, store.exercises()));
  };

  const addExercise = () => {
    if (!nName.trim()) {
      setAddMsg('Give your exercise a name.');
      return;
    }
    const ex: Exercise = {
      id: slugify(nName),
      name: nName.trim(),
      category: nCat,
      equipment: nWeighted ? 'dumbbell' : 'bodyweight',
      emoji: nEmoji.trim() || '🏋️',
      weighted: nWeighted,
      defaultWeightKg: nWeighted ? 10 : 0,
      trackedJoint: nJoint,
      posture: 'any',
      cues: nCues.trim() ? nCues.split(/[.,\n]/).map((c) => c.trim()).filter(Boolean) : ['Move with control', 'Full range of motion'],
      muscles: [nCat],
      custom: true,
    };
    store.addExercise(ex);
    setNName('');
    setNCues('');
    setNEmoji('🏋️');
    setAddMsg(`Added “${ex.name}” — it's now in your library.`);
  };

  const today = new Date().toISOString().slice(0, 10);
  const todayKcal = Math.round(
    data.logs
      .filter((l) => l.date.slice(0, 10) === today)
      .reduce(
        (a, w) => a + w.exercises.reduce((x, e) => x + e.sets.reduce((y, s) => y + setKcal(findExercise(library, e.exerciseId), s.durationSec), 0), 0),
        0,
      ),
  );
  const weekForm = useMemo(() => {
    const wk = data.logs.filter((l) => Date.now() - new Date(l.date).getTime() < 7 * 864e5);
    return wk.length ? Math.round(wk.reduce((a, w) => a + (w.avgFormScore || 0), 0) / wk.length) : 0;
  }, [data.logs]);
  const lastSleep = data.recovery.length ? data.recovery[data.recovery.length - 1].sleepHours : null;
  const nextDay = data.plan ? data.plan.days[data.logs.length % data.plan.days.length] : null;

  return (
    <Screen>
      <SectionHeader title="Daily Plan" actionLabel="Stats" onAction={() => store.setTab('recovery')} />
      <Row style={{ gap: spacing(1.25), marginBottom: spacing(1.25) }}>
        <StatTile label="Calories" value={`${todayKcal}`} unit="Kcal" emoji="🔥" tint={colors.tintOrange} />
        <StatTile label="Form" value={weekForm ? `${weekForm}` : '—'} unit="avg / week" emoji="🎯" tint={colors.tintPurple} />
      </Row>
      <Row style={{ gap: spacing(1.25), marginBottom: spacing(1.5) }}>
        <StatTile label="Sleep" value={lastSleep !== null ? `${lastSleep}` : '—'} unit="Hours" emoji="🌙" tint={colors.tintGreen} />
        <StatTile label="Water" value="10" unit="Cups" emoji="💧" tint={colors.tintBlue} />
      </Row>

      <SectionHeader title="Goal in progress" actionLabel="Start" onAction={() => store.setTab('workout')} />
      {nextDay ? (
        nextDay.exercises.map((e) => {
          const lib = findExercise(library, e.exerciseId);
          return (
            <TaskRow
              key={e.exerciseId}
              emoji={lib?.emoji ?? '🏋️'}
              emojiTint={lib ? tintFor(lib) : colors.tintPurple}
              title={e.name}
              meta={`🕐 ${e.sets.length} coaching sets${e.sets[0].targetWeightKg > 0 ? ` · ${displayWeight(e.sets[0].targetWeightKg, units)}${weightUnit(units)}` : ''}`}
              onPlay={() => store.setTab('workout')}
            />
          );
        })
      ) : (
        <Body dim style={{ marginBottom: spacing(1.5) }}>
          No plan yet — generate one below and your daily tasks will appear here.
        </Body>
      )}

      {/* ---- exercise library management ---- */}
      <Card style={{ marginTop: spacing(1) }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <H1 style={{ marginBottom: 0 }}>{`Exercise library (${library.length})`}</H1>
          <Button title={manage ? 'Done' : 'Manage'} kind="ghost" small onPress={() => setManage((v) => !v)} />
        </Row>
        {manage && (
          <>
            <Body dim style={{ marginTop: spacing(1) }}>
              Delete exercises you don't do, or add your own. Your coach analyzes any exercise from the tracked joint you pick.
            </Body>
            <View style={{ marginTop: spacing(1.25) }}>
              {library.map((e) => (
                <Row key={e.id} style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <Body>{`${e.emoji}  ${e.name}${e.custom ? '  ·  custom' : ''}`}</Body>
                  <Pressable
                    onPress={() => store.deleteExercise(e.id)}
                    style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(248,113,113,0.15)' }}
                  >
                    <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 13 }}>✕ delete</Text>
                  </Pressable>
                </Row>
              ))}
            </View>

            <H1 style={{ marginTop: spacing(1.5) }}>Add a custom exercise</H1>
            <Row>
              <Input value={nEmoji} onChangeText={setNEmoji} placeholder="🏋️" style={{ width: 64, textAlign: 'center', marginBottom: 0 }} />
              <Input value={nName} onChangeText={setNName} placeholder="Exercise name" style={{ flex: 1, marginBottom: 0 }} />
            </Row>
            <Body dim style={{ marginTop: spacing(1), marginBottom: 4 }}>Muscle group</Body>
            <Row style={{ flexWrap: 'wrap' }}>
              {CATEGORIES.map((c) => (
                <Chip key={c} label={c} active={nCat === c} onPress={() => setNCat(c)} />
              ))}
            </Row>
            <Body dim style={{ marginTop: spacing(1), marginBottom: 4 }}>Joint the coach should watch</Body>
            <Row style={{ flexWrap: 'wrap' }}>
              {TRACKED_JOINTS.map((j) => (
                <Chip key={j} label={j} active={nJoint === j} onPress={() => setNJoint(j)} />
              ))}
            </Row>
            <Row style={{ flexWrap: 'wrap', marginTop: spacing(1) }}>
              <Chip label="Bodyweight" active={!nWeighted} onPress={() => setNWeighted(false)} />
              <Chip label="Weighted" active={nWeighted} onPress={() => setNWeighted(true)} />
            </Row>
            <Input
              value={nCues}
              onChangeText={setNCues}
              placeholder="Coaching cues (comma-separated, optional)"
              style={{ marginTop: spacing(1) }}
            />
            <Button title="＋ Add to my library" onPress={addExercise} kind="ghost" />
            {addMsg && <Body dim style={{ marginTop: spacing(0.5) }}>{addMsg}</Body>}
            <Button
              title="↺ Restore deleted defaults"
              kind="ghost"
              small
              onPress={() => store.restoreDefaultExercises()}
              style={{ marginTop: spacing(1), alignSelf: 'flex-start' }}
            />
          </>
        )}
      </Card>

      <Card accent>
        <H1>{data.plan ? 'Regenerate your plan' : 'Create your personalized plan'}</H1>
        <Body dim style={{ marginBottom: 4 }}>Goal</Body>
        <Row style={{ flexWrap: 'wrap' }}>
          {GOALS.map((g) => (
            <Chip key={g.key} label={g.label} active={goal === g.key} onPress={() => setGoal(g.key)} />
          ))}
        </Row>
        <Body dim style={{ marginTop: spacing(1), marginBottom: 4 }}>Training days per week</Body>
        <Row style={{ flexWrap: 'wrap' }}>
          {[2, 3, 4, 5].map((d) => (
            <Chip key={d} label={`${d} days`} active={days === d} onPress={() => setDays(d)} />
          ))}
        </Row>
        <Button title={data.plan ? 'Regenerate plan' : 'Generate my plan'} onPress={generate} style={{ marginTop: spacing(2) }} />
      </Card>

      {data.plan && (
        <>
          <Card>
            <H1>{data.plan.name}</H1>
            <Body dim>{`${data.plan.weeks} weeks · created ${new Date(data.plan.createdAt).toLocaleDateString()}`}</Body>
            <Body style={{ marginTop: spacing(1) }}>{`📈 ${data.plan.progression}`}</Body>
          </Card>
          {data.plan.days.map((d) => (
            <Card key={d.name}>
              <H1>{d.name}</H1>
              <Body dim style={{ marginBottom: spacing(1) }}>{d.focus}</Body>
              {d.exercises.map((e) => {
                const lib = findExercise(library, e.exerciseId);
                return (
                  <Row key={e.exerciseId} style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                    <Body>{`${lib?.emoji ?? '🏋️'}  ${e.name}`}</Body>
                    <Body dim>
                      {`${e.sets.length} sets${e.sets[0].targetWeightKg > 0 ? ` · ${displayWeight(e.sets[0].targetWeightKg, units)} ${weightUnit(units)}` : ''}`}
                    </Body>
                  </Row>
                );
              })}
            </Card>
          ))}
          <Button title="Start today's workout ▶" onPress={() => store.setTab('workout')} />
          <View style={{ height: spacing(2) }} />
        </>
      )}
    </Screen>
  );
};
