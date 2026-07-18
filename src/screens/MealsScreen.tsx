import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, H1, MacroBar, Ring, Row, Screen, SectionHeader } from '../components/UI';
import { colors, font, spacing } from '../theme';
import { useStore } from '../store/useStore';
import { generateMealPlan, tdee } from '../lib/mealPlanner';
import { findExercise, setKcal } from '../lib/exerciseMeta';

export const MealsScreen: React.FC = () => {
  const store = useStore();
  const user = store.currentUser();
  const data = store.data();
  const plan = data.mealPlan;

  const generate = () => {
    if (!user) return;
    store.setMealPlan(generateMealPlan(user.profile));
  };

  const library = store.exercises();
  const today = new Date().toISOString().slice(0, 10);
  const burned = Math.round(
    data.logs
      .filter((l) => l.date.slice(0, 10) === today)
      .reduce(
        (a, w) =>
          a +
          w.exercises.reduce(
            (x, e) => x + e.sets.reduce((y, s) => y + setKcal(findExercise(library, e.exerciseId), s.durationSec), 0),
            0,
          ),
        0,
      ),
  );
  const eaten = plan ? plan.targetKcal : 0;
  const net = eaten - burned;
  const ringPct = plan ? Math.min(100, (net / plan.targetKcal) * 100) : 0;

  const dayGood = burned > 100 && (data.recovery[data.recovery.length - 1]?.recoveryScore ?? 70) >= 60;

  return (
    <Screen>
      <SectionHeader title="Calories Details" actionLabel="See stats" onAction={() => store.setTab('recovery')} />

      {/* donut */}
      <View style={styles.donutRow}>
        <View style={styles.donutSide}>
          <Text style={styles.donutSideValue}>{eaten.toLocaleString()}</Text>
          <Text style={styles.donutSideLabel}>EATEN</Text>
        </View>
        <Ring size={190} stroke={20} pct={Math.max(4, ringPct)} color={colors.amber}>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.donutValue}>{Math.abs(net).toLocaleString()}</Text>
            <Text style={styles.donutLabel}>{net >= 0 ? 'KCAL TARGET' : 'KCAL UNDER'}</Text>
          </View>
        </Ring>
        <View style={styles.donutSide}>
          <Text style={styles.donutSideValue}>{burned.toLocaleString()}</Text>
          <Text style={styles.donutSideLabel}>BURNED</Text>
        </View>
      </View>

      {/* macros */}
      {plan && (
        <Card>
          <Row style={{ gap: spacing(2), alignItems: 'flex-start' }}>
            <MacroBar
              label="Carbs"
              valueText={`${plan.carbsG}g target`}
              pct={68}
              colorsPair={['#E879F9', '#A855F7']}
            />
            <MacroBar label="Fat" valueText={`${plan.fatG}g target`} pct={55} colorsPair={['#FB923C', '#EF4444']} />
            <MacroBar
              label="Protein"
              valueText={`${plan.proteinG}g target`}
              pct={80}
              colorsPair={['#F472B6', '#8B5CF6']}
            />
          </Row>
        </Card>
      )}

      {/* day rating */}
      <Card style={{ alignItems: 'center', paddingVertical: spacing(3) }}>
        <Text style={{ fontSize: 56, marginBottom: spacing(1) }}>{dayGood ? '😄' : '😔'}</Text>
        <H1 style={{ marginBottom: 4 }}>Day rating</H1>
        <Body dim style={{ textAlign: 'center', marginBottom: spacing(1.5) }}>
          {dayGood
            ? 'Training done and recovery is on point — great day!'
            : plan
              ? burned <= 100
                ? 'Get a workout in to boost your day rating!'
                : 'Sleep more tonight to boost your day rating!'
              : 'Generate a meal plan to start tracking your day rating.'}
        </Body>
        <Button
          title={plan ? 'See more ›' : 'Generate my meal plan'}
          kind={plan ? 'ghost' : 'primary'}
          small
          onPress={plan ? () => store.setTab('recovery') : generate}
        />
      </Card>

      {plan && (
        <>
          <SectionHeader title="Today's meals" actionLabel="Shuffle 🔀" onAction={generate} />
          {user && (
            <Body dim style={{ marginBottom: spacing(1.25) }}>
              {`Maintenance ≈ ${tdee(user.profile)} kcal · goal ${user.profile.goal.replace('_', ' ')} → target ${plan.targetKcal} kcal · ${user.profile.dietaryPreference}`}
            </Body>
          )}
          {plan.meals.map((m, i) => (
            <Card key={i}>
              <Row style={{ justifyContent: 'space-between' }}>
                <H1 style={{ marginBottom: 2 }}>{m.name}</H1>
                <Body dim>{m.time}</Body>
              </Row>
              <Body style={{ marginBottom: spacing(0.75) }}>{m.items.join(', ')}</Body>
              <Row style={{ gap: spacing(1.5) }}>
                <Text style={[styles.mealMeta, { color: colors.amber }]}>🔥 {m.kcal} kcal</Text>
                <Text style={[styles.mealMeta, { color: colors.pink }]}>{m.proteinG}P</Text>
                <Text style={[styles.mealMeta, { color: colors.primaryLight }]}>{m.carbsG}C</Text>
                <Text style={[styles.mealMeta, { color: colors.orange }]}>{m.fatG}F</Text>
              </Row>
            </Card>
          ))}
          <Card>
            <H1>Coach's notes</H1>
            {plan.notes.map((n, i) => (
              <Body key={i} dim style={{ marginBottom: 4 }}>{`• ${n}`}</Body>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing(2),
  },
  donutSide: { alignItems: 'center', width: 72 },
  donutSideValue: { color: colors.text, fontSize: font.h1, fontWeight: '800' },
  donutSideLabel: { color: colors.textDim, fontSize: font.small, letterSpacing: 1, marginTop: 2 },
  donutValue: { color: colors.text, fontSize: 34, fontWeight: '800' },
  donutLabel: { color: colors.textDim, fontSize: font.small, letterSpacing: 1 },
  mealMeta: { fontSize: font.small + 1, fontWeight: '700' },
});
