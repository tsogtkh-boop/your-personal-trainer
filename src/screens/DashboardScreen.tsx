import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Body, GradientCard, Ring, Row, Screen, SectionHeader, StatTile, TaskRow } from '../components/UI';
import { colors, font, radius, spacing } from '../theme';
import { useStore } from '../store/useStore';
import { dailyReadiness } from '../lib/fatigue';
import { blurbFor, findExercise, kcalPerMinFor, tintFor } from '../lib/exerciseMeta';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning! 👋';
  if (h < 18) return 'Good Afternoon! 👋';
  return 'Good Evening! 👋';
};

export const DashboardScreen: React.FC = () => {
  const store = useStore();
  const user = store.currentUser();
  const data = store.data();

  const week = useMemo(
    () => data.logs.filter((l) => Date.now() - new Date(l.date).getTime() < 7 * 864e5),
    [data.logs],
  );
  const planned = data.plan?.daysPerWeek ?? 3;
  const done = Math.min(week.length, planned);
  const pct = Math.round((done / planned) * 100);
  const readiness = dailyReadiness(data.recovery.slice(-7));
  const weekKcal = Math.round(week.reduce((a, w) => a + w.durationMin * 7, 0));

  const nextDay = data.plan ? data.plan.days[data.logs.length % data.plan.days.length] : null;
  const library = store.exercises();
  const goalCards = library
    .filter((e) => ['bench_press', 'deadlift', 'squat', 'pull_up', 'hip_thrust'].includes(e.id))
    .concat(library.filter((e) => e.custom))
    .slice(0, 6);

  return (
    <Screen>
      {/* header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={{ fontSize: 20 }}>🏋️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.greet}>{greeting()}</Text>
          <Text style={styles.name}>{user?.name ?? 'Athlete'}</Text>
        </View>
        <Pressable style={styles.iconBtn} onPress={() => store.setTab('coach')}>
          <Text style={{ fontSize: 15 }}>💬</Text>
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={() => store.setTab('recovery')}>
          <Text style={{ fontSize: 15 }}>🔔</Text>
        </Pressable>
      </View>

      {/* gradient hero */}
      <GradientCard onPress={() => store.setTab('workout')}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: spacing(1) }}>
            <Text style={styles.heroTitle}>{'My Plan\nFor Today'}</Text>
            <Text style={styles.heroSub}>
              {data.plan ? `${done}/${planned} Complete` : 'Tap to start your first workout'}
            </Text>
          </View>
          <Ring size={96} stroke={11} pct={Math.max(4, pct)} color="#FFD166" trackColor="rgba(255,255,255,0.25)">
            <Text style={styles.heroPct}>
              {pct}
              <Text style={{ fontSize: 13 }}>%</Text>
            </Text>
          </Ring>
        </Row>
      </GradientCard>

      {/* readiness / burn tiles */}
      <Row style={{ gap: spacing(1.25), marginBottom: spacing(1) }}>
        <StatTile label="Readiness" value={`${readiness.score}`} unit="/100" emoji="⚡" tint={colors.tintPurple} />
        <StatTile label="Burned" value={`${weekKcal}`} unit="kcal this week" emoji="🔥" tint={colors.tintOrange} />
      </Row>

      {/* start new goal */}
      <SectionHeader title="Start new goal" actionLabel="See all" onAction={() => store.setTab('workout')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing(1) }}>
        {goalCards.map((e) => (
          <Pressable key={e.id} style={styles.goalCard} onPress={() => store.setTab('workout')}>
            <View style={[styles.goalThumb, { backgroundColor: tintFor(e) }]}>
              <Text style={{ fontSize: 52 }}>{e.emoji}</Text>
              <View style={styles.goalPlay}>
                <Text style={{ color: '#0A0A0E', fontSize: 12, fontWeight: '900', marginLeft: 1 }}>▶</Text>
              </View>
            </View>
            <Text style={styles.goalTitle}>{e.name}</Text>
            <Text style={styles.goalBlurb}>{blurbFor(e)}</Text>
            <Row style={{ gap: spacing(1.5), marginTop: 7 }}>
              <Text style={[styles.goalMeta, { color: colors.green }]}>🕐 ~5 min</Text>
              <Text style={[styles.goalMeta, { color: colors.amber }]}>🔥 {kcalPerMinFor(e) * 5} cal</Text>
            </Row>
          </Pressable>
        ))}
      </ScrollView>

      {/* today tasks */}
      <SectionHeader title="Today task" actionLabel="See all" onAction={() => store.setTab('plan')} />
      {nextDay ? (
        nextDay.exercises.map((e) => {
          const lib = findExercise(library, e.exerciseId);
          return (
            <TaskRow
              key={e.exerciseId}
              emoji={lib?.emoji ?? '🏋️'}
              emojiTint={lib ? tintFor(lib) : colors.tintPurple}
              title={e.name}
              meta={`🕐 ${e.sets.length} coaching sets   🔥 ~${(lib ? kcalPerMinFor(lib) : 6) * 5 * e.sets.length} cal`}
              onPlay={() => store.setTab('workout')}
            />
          );
        })
      ) : (
        <TaskRow
          emoji="📋"
          emojiTint={colors.tintPurple}
          title="Create your training plan"
          meta="Personalized program for your goal"
          onPlay={() => store.setTab('plan')}
        />
      )}

      {readiness.score < 60 && (
        <Body dim style={{ marginTop: spacing(0.5) }}>{`⚡ ${readiness.advice}`}</Body>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginBottom: spacing(2),
    marginTop: spacing(0.5),
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.tintPurple,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  greet: { color: colors.textDim, fontSize: font.small + 1 },
  name: { color: colors.text, fontSize: font.h1 + 1, fontWeight: '800' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800', lineHeight: 30, marginBottom: spacing(1) },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: font.small + 1.5, fontWeight: '600' },
  heroPct: { color: '#fff', fontSize: 24, fontWeight: '800' },
  goalCard: {
    width: 200,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1.25),
    marginRight: spacing(1.25),
  },
  goalThumb: {
    height: 110,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(1.25),
  },
  goalPlay: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalTitle: { color: colors.text, fontSize: font.h2, fontWeight: '800', marginBottom: 3 },
  goalBlurb: { color: colors.textDim, fontSize: font.small + 0.5 },
  goalMeta: { fontSize: font.small + 0.5, fontWeight: '700' },
});
