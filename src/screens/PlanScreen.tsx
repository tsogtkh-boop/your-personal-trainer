import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  Body,
  Button,
  Card,
  Chip,
  H1,
  Row,
  Screen,
  SectionHeader,
  StatTile,
  TaskRow,
} from '../components/UI';
import { colors, spacing } from '../theme';
import { useStore } from '../store/useStore';
import { generateTrainingPlan } from '../lib/trainingPlanner';
import { metaFor, setKcal } from '../lib/exerciseMeta';
import { exerciseImage } from '../lib/demoMedia';
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
  const [days, setDays] = useState(3);
  const [goal, setGoal] = useState<Goal>(user?.profile.goal ?? 'muscle_gain');

  const generate = () => {
    if (!user) return;
    store.updateProfile({ goal });
    store.setPlan(generateTrainingPlan({ ...user.profile, goal }, days));
  };

  // daily plan tiles
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = data.logs.filter((l) => l.date.slice(0, 10) === today);
  const todayKcal = Math.round(
    todayLogs.reduce(
      (a, w) => a + w.exercises.reduce((x, e) => x + e.sets.reduce((y, s) => y + setKcal(e.exerciseId, s.durationSec), 0), 0),
      0,
    ),
  );
  const weekReps = useMemo(
    () =>
      data.logs
        .filter((l) => Date.now() - new Date(l.date).getTime() < 7 * 864e5)
        .reduce((a, w) => a + w.exercises.reduce((x, e) => x + e.sets.reduce((y, s) => y + s.reps, 0), 0), 0),
    [data.logs],
  );
  const lastSleep = data.recovery.length ? data.recovery[data.recovery.length - 1].sleepHours : null;

  const nextDay = data.plan ? data.plan.days[data.logs.length % data.plan.days.length] : null;

  return (
    <Screen>
      <SectionHeader title="Daily Plan" actionLabel="Statics" onAction={() => store.setTab('recovery')} />
      <Row style={{ gap: spacing(1.25), marginBottom: spacing(1.25) }}>
        <StatTile label="Calories" value={`${todayKcal}`} unit="Kcal" emoji="🔥" tint={colors.tintOrange} />
        <StatTile label="Reps" value={weekReps.toLocaleString()} unit="this week" emoji="👣" tint={colors.tintPurple} />
      </Row>
      <Row style={{ gap: spacing(1.25), marginBottom: spacing(1.5) }}>
        <StatTile
          label="Sleep"
          value={lastSleep !== null ? `${lastSleep}` : '—'}
          unit="Hours"
          emoji="🌙"
          tint={colors.tintGreen}
        />
        <StatTile label="Water" value="10" unit="Cups" emoji="💧" tint={colors.tintBlue} />
      </Row>

      <SectionHeader title="Goal in progress" actionLabel="See all" onAction={() => store.setTab('workout')} />
      {nextDay ? (
        nextDay.exercises.map((e) => {
          const m = metaFor(e.exerciseId);
          return (
            <TaskRow
              key={e.exerciseId}
              emoji={m.emoji}
              emojiTint={m.tint}
              image={exerciseImage(e.exerciseId)}
              title={e.name}
              meta={`🕐 ${e.sets.length} × ${e.sets[0].targetReps}${e.sets[0].targetWeightKg > 0 ? ` @ ${displayWeight(e.sets[0].targetWeightKg, units)}${weightUnit(units)}` : ''}   🔥 ${m.kcalPerMin * 5 * e.sets.length} cal`}
              onPlay={() => store.setTab('workout')}
            />
          );
        })
      ) : (
        <Body dim style={{ marginBottom: spacing(1.5) }}>
          No plan yet — generate one below and your daily tasks will appear here.
        </Body>
      )}

      <Card accent style={{ marginTop: spacing(1) }}>
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
              {d.exercises.map((e) => (
                <Row key={e.exerciseId} style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                  <Body>{`${metaFor(e.exerciseId).emoji}  ${e.name}`}</Body>
                  <Body dim>
                    {`${e.sets.length} × ${e.sets[0].targetReps}${e.sets[0].targetWeightKg > 0 ? ` @ ${displayWeight(e.sets[0].targetWeightKg, units)} ${weightUnit(units)}` : ''}`}
                  </Body>
                </Row>
              ))}
            </Card>
          ))}
          <Button title="Start today's workout ▶" onPress={() => store.setTab('workout')} />
          <View style={{ height: spacing(2) }} />
        </>
      )}
    </Screen>
  );
};
