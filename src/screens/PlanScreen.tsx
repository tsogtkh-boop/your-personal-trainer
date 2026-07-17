import React, { useState } from 'react';
import { Body, Button, Card, Chip, H1, Row, Screen, Title } from '../components/UI';
import { colors, spacing } from '../theme';
import { useStore } from '../store/useStore';
import { generateTrainingPlan } from '../lib/trainingPlanner';
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
  const [days, setDays] = useState(3);
  const [goal, setGoal] = useState<Goal>(user?.profile.goal ?? 'muscle_gain');

  const generate = () => {
    if (!user) return;
    store.updateProfile({ goal });
    const plan = generateTrainingPlan({ ...user.profile, goal }, days);
    store.setPlan(plan);
  };

  return (
    <Screen>
      <Title>Training Plan</Title>

      <Card accent>
        <H1>{data.plan ? 'Regenerate your plan' : 'Create your personalized plan'}</H1>
        <Body dim style={{ marginBottom: spacing(1) }}>Goal</Body>
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
        <Body dim style={{ marginTop: spacing(1), fontSize: 12.5 }}>
          Built from your body stats, experience and goal. Starting weights are estimates — the coach auto-adjusts
          them every set based on your speed, form and heart rate.
        </Body>
      </Card>

      {data.plan && (
        <>
          <Card>
            <H1>{data.plan.name}</H1>
            <Body dim>{`${data.plan.weeks} weeks · created ${new Date(data.plan.createdAt).toLocaleDateString()}`}</Body>
            <Body style={{ marginTop: spacing(1) }}>{`📈 Progression: ${data.plan.progression}`}</Body>
          </Card>
          {data.plan.days.map((d) => (
            <Card key={d.name}>
              <H1>{d.name}</H1>
              <Body dim style={{ marginBottom: spacing(1) }}>{d.focus}</Body>
              {d.exercises.map((e) => (
                <Row key={e.exerciseId} style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                  <Body>{e.name}</Body>
                  <Body dim>
                    {`${e.sets.length} × ${e.sets[0].targetReps}${e.sets[0].targetWeightKg > 0 ? ` @ ${e.sets[0].targetWeightKg} kg` : ''} · rest ${e.sets[0].restSec}s`}
                  </Body>
                </Row>
              ))}
            </Card>
          ))}
          <Button title="Start today's workout →" onPress={() => store.setTab('workout')} />
        </>
      )}
    </Screen>
  );
};
