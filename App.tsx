import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Tab, useStore } from './src/store/useStore';
import { colors, spacing } from './src/theme';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { CoachScreen } from './src/screens/CoachScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { MealsScreen } from './src/screens/MealsScreen';
import { RecoveryScreen } from './src/screens/RecoveryScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'workout', label: 'Workout', icon: '📷' },
  { key: 'coach', label: 'Coach', icon: '💬' },
  { key: 'plan', label: 'Plan', icon: '📋' },
  { key: 'meals', label: 'Meals', icon: '🥗' },
  { key: 'recovery', label: 'Recovery', icon: '😴' },
  { key: 'profile', label: 'Profile', icon: '👤' },
];

export default function App() {
  const { hydrated, currentEmail, tab, setTab } = useStore();

  if (!hydrated) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!currentEmail) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <AuthScreen />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        {tab === 'home' && <DashboardScreen />}
        {tab === 'workout' && <WorkoutScreen />}
        {tab === 'coach' && <CoachScreen />}
        {tab === 'plan' && <PlanScreen />}
        {tab === 'meals' && <MealsScreen />}
        {tab === 'recovery' && <RecoveryScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </View>
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)}>
            <Text style={{ fontSize: 18, opacity: tab === t.key ? 1 : 0.55 }}>{t.icon}</Text>
            <Text style={[styles.tabLabel, tab === t.key && { color: colors.primary, fontWeight: '700' }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: spacing(0.5),
    paddingTop: spacing(0.75),
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 10.5, color: colors.textDim },
});
