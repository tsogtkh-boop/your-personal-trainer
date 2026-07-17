import React from 'react';
import { Body, Button, Card, H1, ProgressBar, Row, Screen, Stat, Title } from '../components/UI';
import { colors, spacing } from '../theme';
import { useStore } from '../store/useStore';
import { generateMealPlan, tdee } from '../lib/mealPlanner';

export const MealsScreen: React.FC = () => {
  const store = useStore();
  const user = store.currentUser();
  const data = store.data();
  const plan = data.mealPlan;

  const generate = () => {
    if (!user) return;
    store.setMealPlan(generateMealPlan(user.profile));
  };

  return (
    <Screen>
      <Title>Meal Plan</Title>

      <Card accent>
        <H1>{plan ? 'Your nutrition targets' : 'Personalized nutrition'}</H1>
        {user && (
          <Body dim style={{ marginBottom: spacing(1.5) }}>
            {`Based on your stats (${user.profile.weightKg} kg, ${user.profile.heightCm} cm, ${user.profile.age}y, ${user.profile.activityLevel}) your estimated maintenance is ${tdee(user.profile)} kcal/day. Goal: ${user.profile.goal.replace('_', ' ')} · diet: ${user.profile.dietaryPreference}.`}
          </Body>
        )}
        <Button title={plan ? 'Regenerate meals 🔀' : 'Generate my meal plan'} onPress={generate} />
      </Card>

      {plan && (
        <>
          <Row style={{ gap: spacing(1), marginBottom: spacing(1.5) }}>
            <Stat label="kcal / day" value={`${plan.targetKcal}`} />
            <Stat label="protein (g)" value={`${plan.proteinG}`} />
            <Stat label="carbs (g)" value={`${plan.carbsG}`} />
            <Stat label="fat (g)" value={`${plan.fatG}`} />
          </Row>

          {plan.meals.map((m, i) => (
            <Card key={i}>
              <Row style={{ justifyContent: 'space-between' }}>
                <H1 style={{ marginBottom: 2 }}>{m.name}</H1>
                <Body dim>{m.time}</Body>
              </Row>
              <Body style={{ marginBottom: spacing(1) }}>{m.items.join(', ')}</Body>
              <Body dim style={{ marginBottom: 6 }}>
                {`${m.kcal} kcal · ${m.proteinG}P / ${m.carbsG}C / ${m.fatG}F`}
              </Body>
              <ProgressBar pct={(m.proteinG * 4 * 100) / Math.max(1, m.kcal)} color={colors.accent} />
              <Body dim style={{ fontSize: 11.5, marginTop: 2 }}>protein share of calories</Body>
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
