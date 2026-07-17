import React, { useState } from 'react';
import { View } from 'react-native';
import { Body, Button, Card, H1, Input, ProgressBar, Row, Screen, Stat, Title } from '../components/UI';
import { colors, spacing } from '../theme';
import { useStore } from '../store/useStore';
import { analyzeRecovery, makeEntry, syntheticTrackerHistory } from '../lib/recovery';
import { dailyReadiness } from '../lib/fatigue';

export const RecoveryScreen: React.FC = () => {
  const store = useStore();
  const data = store.data();
  const [sleepH, setSleepH] = useState('7.5');
  const [quality, setQuality] = useState('7');
  const [rhr, setRhr] = useState('58');
  const [hrv, setHrv] = useState('62');
  const [soreness, setSoreness] = useState('3');

  const analysis = analyzeRecovery(data.recovery);
  const readiness = dailyReadiness(data.recovery.slice(-7));
  const anyConnector = Object.entries(data.connectors).some(([k, v]) => k !== 'lastSync' && v === true);

  const logManual = () => {
    const entry = makeEntry(
      new Date().toISOString().slice(0, 10),
      {
        sleepHours: parseFloat(sleepH) || 7,
        sleepQuality: Math.min(10, Math.max(1, parseInt(quality, 10) || 7)),
        restingHr: parseInt(rhr, 10) || 60,
        hrv: parseInt(hrv, 10) || 60,
        soreness: Math.min(10, Math.max(1, parseInt(soreness, 10) || 3)),
      },
      'manual',
    );
    store.addRecovery([entry]);
  };

  const pullFromTracker = () => {
    store.addRecovery(syntheticTrackerHistory(7));
  };

  const last7 = data.recovery.slice(-7);

  return (
    <Screen>
      <Title>Recovery & Sleep</Title>

      <Card accent>
        <H1>{analysis.headline}</H1>
        <ProgressBar
          pct={readiness.score}
          color={readiness.score >= 60 ? colors.primary : readiness.score >= 40 ? colors.warn : colors.danger}
        />
        {analysis.details.map((d, i) => (
          <Body key={i} dim style={{ marginTop: spacing(0.75) }}>{`• ${d}`}</Body>
        ))}
        <Body style={{ marginTop: spacing(1) }}>
          {`Trend: ${analysis.trend === 'improving' ? '📈 improving' : analysis.trend === 'declining' ? '📉 declining' : '➡ stable'} · workouts auto-adjust to this score.`}
        </Body>
      </Card>

      {last7.length > 0 && (
        <Card>
          <H1>Last 7 days</H1>
          {last7.map((r) => (
            <Row key={r.date} style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <Body dim style={{ width: 92 }}>{r.date.slice(5)}</Body>
              <View style={{ flex: 1, marginHorizontal: spacing(1) }}>
                <ProgressBar pct={r.recoveryScore} color={r.recoveryScore >= 60 ? colors.primary : colors.warn} />
              </View>
              <Body dim>{`${r.recoveryScore} · ${r.sleepHours}h ${r.source === 'tracker' ? '⌚' : '✍️'}`}</Body>
            </Row>
          ))}
        </Card>
      )}

      <Card>
        <H1>Pull from your tracker</H1>
        <Body dim style={{ marginBottom: spacing(1.5) }}>
          {anyConnector
            ? 'A tracker is connected — pull the last 7 nights of sleep, HRV and resting HR.'
            : 'Connect Apple Health / Google Fit / Fitbit / Garmin in Profile, then sync sleep & HRV here. (Demo build generates realistic tracker data.)'}
        </Body>
        <Button title="⌚ Sync 7 days of sleep & HRV" onPress={pullFromTracker} />
      </Card>

      <Card>
        <H1>Log last night manually</H1>
        <Row>
          <Input value={sleepH} onChangeText={setSleepH} placeholder="Sleep (h)" keyboardType="numeric" style={{ flex: 1 }} />
          <Input value={quality} onChangeText={setQuality} placeholder="Quality 1-10" keyboardType="numeric" style={{ flex: 1 }} />
        </Row>
        <Row>
          <Input value={rhr} onChangeText={setRhr} placeholder="Resting HR" keyboardType="numeric" style={{ flex: 1 }} />
          <Input value={hrv} onChangeText={setHrv} placeholder="HRV (ms)" keyboardType="numeric" style={{ flex: 1 }} />
          <Input value={soreness} onChangeText={setSoreness} placeholder="Soreness 1-10" keyboardType="numeric" style={{ flex: 1 }} />
        </Row>
        <Button title="Save entry" kind="ghost" onPress={logManual} />
      </Card>
    </Screen>
  );
};
