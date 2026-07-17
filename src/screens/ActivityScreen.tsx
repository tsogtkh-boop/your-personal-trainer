import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';
import { Tab, useStore } from '../store/useStore';
import { PlanScreen } from './PlanScreen';
import { MealsScreen } from './MealsScreen';
import { RecoveryScreen } from './RecoveryScreen';

const SEGMENTS: { key: Tab; label: string }[] = [
  { key: 'plan', label: 'My Plan' },
  { key: 'meals', label: 'Calories' },
  { key: 'recovery', label: 'Recovery' },
];

/** Activity tab — groups Plan / Calories / Recovery behind a segmented switch. */
export const ActivityScreen: React.FC = () => {
  const { tab, setTab } = useStore();
  const active = SEGMENTS.some((s) => s.key === tab) ? tab : 'plan';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.segments}>
        {SEGMENTS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setTab(s.key)}
            style={[styles.segment, active === s.key && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active === s.key && styles.segmentTextActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {active === 'plan' && <PlanScreen />}
        {active === 'meals' && <MealsScreen />}
        {active === 'recovery' && <RecoveryScreen />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    margin: spacing(2),
    marginBottom: spacing(0.5),
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing(1),
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.textDim, fontSize: font.small + 1.5, fontWeight: '600' },
  segmentTextActive: { color: '#fff', fontWeight: '800' },
});
