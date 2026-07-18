import React, { useState } from 'react';
import { Switch, View } from 'react-native';
import { Body, Button, Card, Chip, H1, Input, Row, Screen, Title } from '../components/UI';
import { colors, spacing } from '../theme';
import { useStore } from '../store/useStore';
import { CONNECTOR_INFO, downloadFile, healthExportJSON, syncConnector, workoutsToCSV } from '../lib/health';
import { SubscriptionTier } from '../types';
import { displayWeight, parseWeightToKg, weightUnit } from '../lib/units';
import { setVoiceGender, speak } from '../lib/voice';

const TIERS: { key: SubscriptionTier; name: string; price: string; perks: string[] }[] = [
  { key: 'free', name: 'Free', price: '$0', perks: ['3 tracked workouts / week', 'Built-in coach', 'Manual logging'] },
  {
    key: 'pro',
    name: 'Pro',
    price: '$9.99/mo',
    perks: ['Unlimited camera workouts', 'Adaptive plans & meal plans', 'Heart-rate guided rests', 'Health tracker sync'],
  },
  {
    key: 'elite',
    name: 'Elite',
    price: '$19.99/mo',
    perks: ['Everything in Pro', 'Live AI coach (bring your Claude key)', 'Recovery-based auto deloads', 'Priority support'],
  },
];

export const ProfileScreen: React.FC = () => {
  const store = useStore();
  const user = store.currentUser();
  const data = store.data();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [keyDraft, setKeyDraft] = useState(store.settings.claudeApiKey);
  const units = store.settings.units;
  const [weight, setWeight] = useState(user ? displayWeight(user.profile.weightKg, units) : '');

  if (!user) return null;

  const changeUnits = (u: 'metric' | 'imperial') => {
    if (u === units) return;
    store.setSettings({ units: u });
    setWeight(displayWeight(user.profile.weightKg, u));
  };

  const doSync = async () => {
    setSyncing(true);
    const active = CONNECTOR_INFO.filter((c) => data.connectors[c.key]);
    if (!active.length) {
      setSyncMsg('Turn on at least one connector first.');
      setSyncing(false);
      return;
    }
    const results: string[] = [];
    for (const c of active) {
      const r = await syncConnector(c.label, data.logs);
      results.push(r.message);
    }
    store.markSynced();
    setSyncMsg(results.join('\n'));
    setSyncing(false);
  };

  return (
    <Screen>
      <Title>Profile</Title>

      <Card>
        <H1>{user.name}</H1>
        <Body dim>{user.email}</Body>
        <Body dim style={{ marginBottom: spacing(1) }}>
          {`${user.profile.age}y · ${user.profile.heightCm} cm · goal: ${user.profile.goal.replace('_', ' ')} · ${user.profile.experience}`}
        </Body>
        <Body dim style={{ marginBottom: 4 }}>Units</Body>
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip label="Kilograms (kg)" active={units === 'metric'} onPress={() => changeUnits('metric')} />
          <Chip label="Pounds (lb)" active={units === 'imperial'} onPress={() => changeUnits('imperial')} />
        </Row>
        <Row style={{ marginTop: spacing(0.5) }}>
          <Input
            value={weight}
            onChangeText={setWeight}
            placeholder={`Weight (${weightUnit(units)})`}
            keyboardType="numeric"
            style={{ flex: 1, marginBottom: 0 }}
          />
          <Button
            title="Update weight"
            kind="ghost"
            small
            onPress={() => store.updateProfile({ weightKg: parseWeightToKg(weight, units) || user.profile.weightKg })}
          />
        </Row>
      </Card>

      <Card accent>
        <H1>{`Subscription — ${user.subscription.tier.toUpperCase()}`}</H1>
        {user.subscription.renewsAt && (
          <Body dim style={{ marginBottom: spacing(1) }}>
            {`Renews ${new Date(user.subscription.renewsAt).toLocaleDateString()}`}
          </Body>
        )}
        <View style={{ gap: spacing(1.25) }}>
          {TIERS.map((t) => (
            <View
              key={t.key}
              style={{
                backgroundColor: colors.surfaceAlt,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: user.subscription.tier === t.key ? colors.primary : colors.border,
                padding: spacing(1.75),
              }}
            >
              <Row style={{ justifyContent: 'space-between', marginBottom: spacing(0.75) }}>
                <H1 style={{ marginBottom: 0 }}>{t.name}</H1>
                <Body style={{ color: colors.primaryLight, fontWeight: '800' }}>{t.price}</Body>
              </Row>
              {t.perks.map((p) => (
                <Body key={p} dim style={{ fontSize: 12.5, marginBottom: 3 }}>{`• ${p}`}</Body>
              ))}
              <Button
                title={user.subscription.tier === t.key ? 'Current plan' : t.key === 'free' ? 'Downgrade' : 'Upgrade'}
                small
                kind={user.subscription.tier === t.key ? 'ghost' : 'primary'}
                disabled={user.subscription.tier === t.key}
                onPress={() => store.setSubscription(t.key)}
                style={{ marginTop: spacing(1), alignSelf: 'flex-start' }}
              />
            </View>
          ))}
        </View>
        <Body dim style={{ marginTop: spacing(1), fontSize: 12 }}>
          Demo build: checkout is simulated — no payment is taken.
        </Body>
      </Card>

      <Card>
        <H1>Connected health services</H1>
        {CONNECTOR_INFO.map((c) => (
          <Row key={c.key} style={{ justifyContent: 'space-between', marginBottom: spacing(1) }}>
            <Body>{c.label}</Body>
            <Switch
              value={data.connectors[c.key]}
              onValueChange={(v) => store.setConnector(c.key, v)}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </Row>
        ))}
        <Body dim style={{ marginBottom: spacing(1) }}>
          {data.connectors.lastSync
            ? `Last sync: ${new Date(data.connectors.lastSync).toLocaleString()}`
            : 'Not synced yet.'}
        </Body>
        <Row style={{ flexWrap: 'wrap', gap: spacing(1) }}>
          <Button title={syncing ? 'Syncing…' : '🔄 Sync workouts now'} onPress={doSync} loading={syncing} small />
          <Button
            title="⬇ Export JSON"
            kind="ghost"
            small
            onPress={() => downloadFile('trainer-export.json', healthExportJSON(data.logs, data.recovery))}
          />
          <Button
            title="⬇ Export CSV"
            kind="ghost"
            small
            onPress={() => downloadFile('trainer-workouts.csv', workoutsToCSV(data.logs), 'text/csv')}
          />
        </Row>
        {syncMsg && <Body dim style={{ marginTop: spacing(1) }}>{syncMsg}</Body>}
      </Card>

      <Card>
        <H1>Coach settings</H1>
        <Row style={{ justifyContent: 'space-between', marginBottom: spacing(1) }}>
          <Body>Voice coaching (speech)</Body>
          <Switch
            value={store.settings.voiceEnabled}
            onValueChange={(v) => store.setSettings({ voiceEnabled: v })}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </Row>
        <Body dim style={{ marginBottom: 4 }}>Coach voice</Body>
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip
            label="Female voice"
            active={store.settings.voiceGender === 'female'}
            onPress={() => {
              store.setSettings({ voiceGender: 'female' });
              setVoiceGender('female');
              speak("Hey! I'm your coach. Let's get to work.", { interrupt: true });
            }}
          />
          <Chip
            label="Male voice"
            active={store.settings.voiceGender === 'male'}
            onPress={() => {
              store.setSettings({ voiceGender: 'male' });
              setVoiceGender('male');
              speak("Hey! I'm your coach. Let's get to work.", { interrupt: true });
            }}
          />
          <Chip label="🔊 Test voice" onPress={() => speak('Nice work — three more reps. Keep that core tight.', { interrupt: true })} />
        </Row>
        <Body dim style={{ marginTop: spacing(1), marginBottom: 6 }}>
          Claude API key (optional — powers the live LLM coach; stored only in your browser)
        </Body>
        <Row>
          <Input value={keyDraft} onChangeText={setKeyDraft} placeholder="sk-ant-…" secure style={{ flex: 1, marginBottom: 0 }} />
          <Button title="Save" small kind="ghost" onPress={() => store.setSettings({ claudeApiKey: keyDraft.trim() })} />
        </Row>
      </Card>

      <Card>
        <H1>{`Workout history (${data.logs.length})`}</H1>
        {data.logs.length === 0 && <Body dim>Nothing logged yet — every camera workout is saved here automatically.</Body>}
        {[...data.logs].reverse().slice(0, 8).map((l) => (
          <Body key={l.id} dim style={{ marginBottom: 4 }}>
            {`${new Date(l.date).toLocaleDateString()} — ${l.planDayName ?? 'Quick session'}: ${l.exercises.map((e) => e.name).join(', ')} · form ${Math.round(l.avgFormScore)} ${l.synced ? '· ✅ synced' : ''}`}
          </Body>
        ))}
      </Card>

      <Button title="Sign out" kind="danger" onPress={store.signOut} />
      <View style={{ height: spacing(3) }} />
    </Screen>
  );
};
