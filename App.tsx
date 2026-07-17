import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Tab, useStore } from './src/store/useStore';
import { setSpeechEnabled, setVoiceGender } from './src/lib/voice';
import { PHONE_MAX_WIDTH, colors, font, radius, spacing } from './src/theme';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { CoachScreen } from './src/screens/CoachScreen';
import { ActivityScreen } from './src/screens/ActivityScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

const ACTIVITY_TABS: Tab[] = ['plan', 'meals', 'recovery'];

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'workout', label: 'Workout', icon: '▶' },
  { key: 'coach', label: 'Coach', icon: '✦' },
  { key: 'plan', label: 'Activity', icon: '▥' },
  { key: 'profile', label: 'Settings', icon: '⚙' },
];

export default function App() {
  const { hydrated, currentEmail, tab, setTab, settings } = useStore();

  // Keep the speech engine in sync with the user's voice settings.
  useEffect(() => {
    setSpeechEnabled(settings.voiceEnabled);
    setVoiceGender(settings.voiceGender);
  }, [settings.voiceEnabled, settings.voiceGender]);

  const content = !hydrated ? (
    <View style={[styles.phone, styles.center]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  ) : !currentEmail ? (
    <View style={styles.phone}>
      <AuthScreen />
    </View>
  ) : (
    <View style={styles.phone}>
      <View style={{ flex: 1 }}>
        {tab === 'home' && <DashboardScreen />}
        {tab === 'workout' && <WorkoutScreen />}
        {tab === 'coach' && <CoachScreen />}
        {ACTIVITY_TABS.includes(tab) && <ActivityScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </View>
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = t.key === tab || (t.key === 'plan' && ACTIVITY_TABS.includes(tab));
          return (
            <Pressable key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabIcon, active && { color: colors.primaryLight }]}>{t.icon}</Text>
              <Text style={[styles.tabLabel, active && { color: colors.primaryLight, fontWeight: '700' }]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.backdrop}>
      <StatusBar style="light" />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#050507',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phone: {
    flex: 1,
    width: '100%',
    maxWidth: PHONE_MAX_WIDTH,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? {
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: '#1B1B22',
        }
      : {}),
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(18,18,24,0.98)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: spacing(1.25),
    paddingTop: spacing(1),
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  tabIcon: { fontSize: 20, color: colors.textDim, fontWeight: '600', lineHeight: 24 },
  tabLabel: { fontSize: font.small - 0.5, color: colors.textDim },
});
