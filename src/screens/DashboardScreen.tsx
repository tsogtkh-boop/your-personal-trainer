import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Body, Button, Card, H1, ProgressBar, Row, Screen, Stat, Title } from '../components/UI';
import { colors, spacing } from '../theme';
import { useStore } from '../store/useStore';
import { dailyReadiness } from '../lib/fatigue';
import { analyzeRecovery } from '../lib/recovery';

export const DashboardScreen: React.FC = () => {
  const store = useStore();
  const user = store.currentUser();
  const data = store.data();

  const stats = useMemo(() => {
    const week = data.logs.filter((l) => Date.now() - new Date(l.date).getTime() < 7 * 864e5);
    const volume = week.reduce((a, b) => a + b.totalVolumeKg, 0);
    const reps = week.reduce((a, w) => a + w.exercises.reduce((x, e) => x + e.sets.reduce((y, s) => y + s.reps, 0), 0), 0);
    const minutes = week.reduce((a, b) => a + b.durationMin, 0);
    return { workouts: week.length, volume, reps, minutes };
  }, [data.logs]);

  const readiness = dailyReadiness(data.recovery.slice(-7));
  const rec = analyzeRecovery(data.recovery);
  const nextDay = data.plan ? data.plan.days[data.logs.length % data.plan.days.length] : null;

  return (
    <Screen>
      <Title>
        {`Hey ${user?.name ?? 'Athlete'} 👋`}
      </Title>

      <Card accent>
        <H1>Today's readiness</H1>
        <Row style={{ marginBottom: spacing(1) }}>
          <Body style={{ fontSize: 34, fontWeight: '800', color: readiness.score >= 60 ? colors.primary : colors.warn }}>
            {`${readiness.score}`}
          </Body>
          <Body dim>/ 100</Body>
        </Row>
        <ProgressBar pct={readiness.score} color={readiness.score >= 60 ? colors.primary : colors.warn} />
        <Body dim style={{ marginTop: spacing(1) }}>{readiness.advice}</Body>
      </Card>

      <Row style={{ gap: spacing(1), marginBottom: spacing(1.5) }}>
        <Stat label="workouts this week" value={`${stats.workouts}`} />
        <Stat label="total volume (kg)" value={`${Math.round(stats.volume).toLocaleString()}`} />
        <Stat label="reps counted" value={`${stats.reps}`} />
      </Row>

      <Card>
        <H1>{nextDay ? `Next up: ${nextDay.name}` : 'No training plan yet'}</H1>
        {nextDay ? (
          <>
            <Body dim style={{ marginBottom: spacing(1) }}>
              {`${nextDay.focus} · ${nextDay.exercises.length} exercises`}
            </Body>
            <Body style={{ marginBottom: spacing(1.5) }}>
              {nextDay.exercises.map((e) => e.name).join('  ·  ')}
            </Body>
            <Button title="Start workout →" onPress={() => store.setTab('workout')} />
          </>
        ) : (
          <>
            <Body dim style={{ marginBottom: spacing(1.5) }}>
              Generate a personalized program for your goal and I'll run every session — camera tracking, rep
              counting, live coaching.
            </Body>
            <Button title="Create my plan" onPress={() => store.setTab('plan')} />
          </>
        )}
      </Card>

      <Card>
        <H1>Recovery</H1>
        <Body style={{ marginBottom: spacing(0.5) }}>{rec.headline}</Body>
        <Body dim>{rec.details[0]}</Body>
        <Row style={{ marginTop: spacing(1.5) }}>
          <Button title="Recovery details" kind="ghost" small onPress={() => store.setTab('recovery')} />
          <Button title="Ask your coach" kind="ghost" small onPress={() => store.setTab('coach')} />
        </Row>
      </Card>

      {data.logs.length > 0 && (
        <Card>
          <H1>Last session</H1>
          {(() => {
            const last = data.logs[data.logs.length - 1];
            return (
              <>
                <Body dim style={{ marginBottom: spacing(0.5) }}>
                  {`${new Date(last.date).toLocaleDateString()} · ${last.durationMin} min · ${Math.round(last.totalVolumeKg)} kg volume${last.avgHr ? ` · avg HR ${last.avgHr}` : ''}`}
                </Body>
                {last.exercises.map((e) => (
                  <Body key={e.exerciseId} style={{ marginTop: 4 }}>
                    {`• ${e.name}: ${e.sets.map((s) => `${s.reps}×${s.weightKg > 0 ? `${s.weightKg}kg` : 'BW'}`).join(', ')}`}
                  </Body>
                ))}
              </>
            );
          })()}
        </Card>
      )}

      <View style={{ height: spacing(2) }} />
    </Screen>
  );
};
