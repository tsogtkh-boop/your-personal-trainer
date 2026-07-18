import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Body, Button, Card, Chip, H1, Input, Row, Screen, Title } from '../components/UI';
import { colors, spacing } from '../theme';
import { useStore } from '../store/useStore';
import { ActivityLevel, Experience, Goal, Sex, UserProfile } from '../types';
import { parseWeightToKg } from '../lib/units';

const GOALS: { key: Goal; label: string }[] = [
  { key: 'weight_loss', label: 'Lose fat' },
  { key: 'muscle_gain', label: 'Build muscle' },
  { key: 'strength', label: 'Get stronger' },
  { key: 'endurance', label: 'Endurance' },
];

export const AuthScreen: React.FC = () => {
  const { signIn, signUp, settings, setSettings } = useStore();
  const units = settings.units;
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('30');
  const [heightCm, setHeightCm] = useState('178');
  const [weight, setWeight] = useState(units === 'imperial' ? '172' : '78'); // value shown in the chosen unit
  const [sex, setSex] = useState<Sex>('male');
  const [goal, setGoal] = useState<Goal>('muscle_gain');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [experience, setExperience] = useState<Experience>('beginner');
  const [diet, setDiet] = useState<UserProfile['dietaryPreference']>('omnivore');

  const switchUnits = (u: 'metric' | 'imperial') => {
    if (u === units) return;
    const n = parseFloat(weight) || 0;
    // convert the currently-shown number into the new unit
    setWeight(u === 'imperial' ? `${Math.round(n * 2.2046)}` : `${Math.round((n / 2.2046) * 10) / 10}`);
    setSettings({ units: u });
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    let err: string | null;
    if (mode === 'in') {
      err = await signIn(email, password);
    } else {
      const profile: UserProfile = {
        age: parseInt(age, 10) || 30,
        sex,
        heightCm: parseFloat(heightCm) || 175,
        weightKg: parseWeightToKg(weight, units) || 75,
        goal,
        activityLevel: activity,
        experience,
        dietaryPreference: diet,
      };
      err = await signUp(name, email, password, profile);
    }
    setError(err);
    setBusy(false);
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginTop: spacing(3), marginBottom: spacing(2) }}>
        <Text style={{ fontSize: 44 }}>🏋️</Text>
        <Title>Your Personal Trainer</Title>
        <Body dim>AI form coaching · live camera · adaptive plans</Body>
      </View>

      <Card>
        <Row style={{ marginBottom: spacing(1.5) }}>
          <Chip label="Create account" active={mode === 'up'} onPress={() => setMode('up')} />
          <Chip label="Sign in" active={mode === 'in'} onPress={() => setMode('in')} />
        </Row>

        {mode === 'up' && <Input value={name} onChangeText={setName} placeholder="Your name" />}
        <Input value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" />
        <Input value={password} onChangeText={setPassword} placeholder="Password (min 6 chars)" secure />

        {mode === 'up' && (
          <>
            <H1 style={{ marginTop: spacing(1) }}>About you</H1>
            <Body dim style={{ marginBottom: 4 }}>Units</Body>
            <Row style={{ flexWrap: 'wrap' }}>
              <Chip label="Kilograms (kg)" active={units === 'metric'} onPress={() => switchUnits('metric')} />
              <Chip label="Pounds (lb)" active={units === 'imperial'} onPress={() => switchUnits('imperial')} />
            </Row>
            <Row>
              <Input value={age} onChangeText={setAge} placeholder="Age" keyboardType="numeric" style={{ flex: 1 }} />
              <Input value={heightCm} onChangeText={setHeightCm} placeholder="Height (cm)" keyboardType="numeric" style={{ flex: 1 }} />
              <Input
                value={weight}
                onChangeText={setWeight}
                placeholder={units === 'imperial' ? 'Weight (lb)' : 'Weight (kg)'}
                keyboardType="numeric"
                style={{ flex: 1 }}
              />
            </Row>
            <Row style={{ flexWrap: 'wrap' }}>
              <Chip label="Male" active={sex === 'male'} onPress={() => setSex('male')} />
              <Chip label="Female" active={sex === 'female'} onPress={() => setSex('female')} />
            </Row>

            <Body dim style={{ marginTop: spacing(1), marginBottom: 4 }}>Goal</Body>
            <Row style={{ flexWrap: 'wrap' }}>
              {GOALS.map((g) => (
                <Chip key={g.key} label={g.label} active={goal === g.key} onPress={() => setGoal(g.key)} />
              ))}
            </Row>

            <Body dim style={{ marginTop: spacing(1), marginBottom: 4 }}>Experience</Body>
            <Row style={{ flexWrap: 'wrap' }}>
              {(['beginner', 'intermediate', 'advanced'] as Experience[]).map((e) => (
                <Chip key={e} label={e} active={experience === e} onPress={() => setExperience(e)} />
              ))}
            </Row>

            <Body dim style={{ marginTop: spacing(1), marginBottom: 4 }}>Weekly activity</Body>
            <Row style={{ flexWrap: 'wrap' }}>
              {(['sedentary', 'light', 'moderate', 'active', 'athlete'] as ActivityLevel[]).map((a) => (
                <Chip key={a} label={a} active={activity === a} onPress={() => setActivity(a)} />
              ))}
            </Row>

            <Body dim style={{ marginTop: spacing(1), marginBottom: 4 }}>Diet</Body>
            <Row style={{ flexWrap: 'wrap' }}>
              {(['omnivore', 'vegetarian', 'vegan', 'pescatarian'] as UserProfile['dietaryPreference'][]).map((d) => (
                <Chip key={d} label={d} active={diet === d} onPress={() => setDiet(d)} />
              ))}
            </Row>
          </>
        )}

        {error && (
          <Body style={{ color: colors.danger, marginTop: spacing(1) }}>{error}</Body>
        )}

        <Button
          title={mode === 'in' ? 'Sign in' : 'Start training'}
          onPress={submit}
          loading={busy}
          style={{ marginTop: spacing(2) }}
        />
      </Card>

      <Card>
        <Body dim>
          Accounts are stored locally in your browser for this demo build. The Free tier includes 3 tracked
          workouts/week — upgrade to Pro or Elite anytime from your Profile.
        </Body>
      </Card>
    </Screen>
  );
};
