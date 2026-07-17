import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { colors, font, radius, spacing } from '../theme';

export const Screen: React.FC<{ children: React.ReactNode; scroll?: boolean; style?: ViewStyle }> = ({
  children,
  scroll = true,
  style,
}) =>
  scroll ? (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, style]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screen, styles.screenContent, style]}>{children}</View>
  );

export const Title: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.title}>{children}</Text>
);

export const H1: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => (
  <Text style={[styles.h1, style]}>{children}</Text>
);

export const Body: React.FC<{ children: React.ReactNode; dim?: boolean; style?: any }> = ({
  children,
  dim,
  style,
}) => <Text style={[styles.body, dim && { color: colors.textDim }, style]}>{children}</Text>;

/** Section heading with an optional "See all"-style pill, like the mock. */
export const SectionHeader: React.FC<{ title: string; actionLabel?: string; onAction?: () => void }> = ({
  title,
  actionLabel,
  onAction,
}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {actionLabel ? (
      <Pressable onPress={onAction} style={styles.seeAll}>
        <Text style={styles.seeAllText}>{actionLabel}</Text>
      </Pressable>
    ) : null}
  </View>
);

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle; accent?: boolean }> = ({
  children,
  style,
  accent,
}) => <View style={[styles.card, accent && { borderColor: colors.primary }, style]}>{children}</View>;

/** Purple gradient hero card (the "My Plan For Today" card in the mock). */
export const GradientCard: React.FC<{ children: React.ReactNode; style?: ViewStyle; onPress?: () => void }> = ({
  children,
  style,
  onPress,
}) => {
  const inner = (
    <LinearGradient
      colors={[colors.gradientA, colors.gradientB]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradientCard, style]}
    >
      {children}
    </LinearGradient>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.9 }}>
      {inner}
    </Pressable>
  ) : (
    inner
  );
};

/** SVG progress ring, like the 25% ring / calorie donut in the mock. */
export const Ring: React.FC<{
  size: number;
  stroke?: number;
  pct: number; // 0..100
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
}> = ({ size, stroke = 10, pct, color = colors.amber, trackColor = 'rgba(255,255,255,0.14)', children }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          strokeDashoffset={c * (1 - clamped / 100)}
        />
      </Svg>
      {children}
    </View>
  );
};

/** Tinted stat tile (Calories / Steps / Sleep / Water grid in the mock). */
export const StatTile: React.FC<{
  label: string;
  value: string;
  unit?: string;
  emoji: string;
  tint: string;
  style?: ViewStyle;
}> = ({ label, value, unit, emoji, tint, style }) => (
  <View style={[styles.statTile, { backgroundColor: tint }, style]}>
    <View style={styles.statTileTop}>
      <Text style={styles.statTileLabel}>{label}</Text>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
      <Text style={styles.statTileValue}>{value}</Text>
      {unit ? <Text style={styles.statTileUnit}>{unit}</Text> : null}
    </View>
  </View>
);

/** Round play button, like the task rows in the mock. */
export const PlayButton: React.FC<{ onPress?: () => void; size?: number }> = ({ onPress, size = 42 }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.playBtn,
      { width: size, height: size, borderRadius: size / 2 },
      pressed && { opacity: 0.7 },
    ]}
  >
    <Text style={{ color: '#0A0A0E', fontSize: size * 0.38, fontWeight: '900', marginLeft: 2 }}>▶</Text>
  </Pressable>
);

/** Exercise / task row: photo (or emoji) thumbnail, title, meta line, play button. */
export const TaskRow: React.FC<{
  emoji: string;
  emojiTint?: string;
  image?: any;
  title: string;
  meta: string;
  onPlay?: () => void;
  right?: React.ReactNode;
}> = ({ emoji, emojiTint = colors.tintPurple, image, title, meta, onPlay, right }) => (
  <View style={styles.taskRow}>
    <View style={[styles.taskThumb, { backgroundColor: emojiTint, overflow: 'hidden' }]}>
      {image ? (
        <Image source={image} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
      )}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.taskTitle}>{title}</Text>
      <Text style={styles.taskMeta}>{meta}</Text>
    </View>
    {right ?? (onPlay ? <PlayButton onPress={onPlay} /> : null)}
  </View>
);

export const Button: React.FC<{
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: ViewStyle;
}> = ({ title, onPress, kind = 'primary', disabled, loading, small, style }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled || loading}
    style={({ pressed }) => [
      styles.btn,
      small && styles.btnSmall,
      kind === 'ghost' && styles.btnGhost,
      kind === 'danger' && styles.btnDanger,
      (disabled || loading) && { opacity: 0.45 },
      pressed && { opacity: 0.75 },
      style,
    ]}
  >
    {loading ? (
      <ActivityIndicator color={kind === 'ghost' ? colors.text : '#fff'} />
    ) : (
      <Text
        style={[
          styles.btnText,
          small && { fontSize: font.small + 1 },
          kind === 'ghost' && { color: colors.text },
        ]}
      >
        {title}
      </Text>
    )}
  </Pressable>
);

export const Input: React.FC<{
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: any;
  style?: any;
}> = ({ value, onChangeText, placeholder, secure, keyboardType, style }) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor={colors.textDim}
    secureTextEntry={secure}
    keyboardType={keyboardType}
    autoCapitalize="none"
    style={[styles.input, style]}
  />
);

export const Row: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({ children, style }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing(1) }, style]}>{children}</View>
);

export const Chip: React.FC<{ label: string; active?: boolean; onPress?: () => void }> = ({
  label,
  active,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
  >
    <Text style={[styles.chipText, active && { color: '#fff', fontWeight: '700' }]}>{label}</Text>
  </Pressable>
);

export const Stat: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <View style={styles.stat}>
    <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export const ProgressBar: React.FC<{ pct: number; color?: string }> = ({ pct, color = colors.primary }) => (
  <View style={styles.progressOuter}>
    <View style={[styles.progressInner, { width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }]} />
  </View>
);

/** Horizontal gradient macro bar (Carbs / Fat / Protein in the mock). */
export const MacroBar: React.FC<{ label: string; valueText: string; pct: number; colorsPair: [string, string] }> = ({
  label,
  valueText,
  pct,
  colorsPair,
}) => (
  <View style={{ flex: 1 }}>
    <Text style={styles.macroLabel}>{label}</Text>
    <View style={styles.macroTrack}>
      <LinearGradient
        colors={colorsPair}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: `${Math.min(100, Math.max(4, pct))}%`, height: 6, borderRadius: 3 }}
      />
    </View>
    <Text style={styles.macroValue}>{valueText}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: spacing(2), paddingBottom: spacing(4) },
  title: { fontSize: font.title, fontWeight: '800', color: colors.text, marginBottom: spacing(1.5) },
  h1: { fontSize: font.h1, fontWeight: '700', color: colors.text, marginBottom: spacing(1) },
  body: { fontSize: font.body, color: colors.text, lineHeight: 21 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(1.25),
    marginTop: spacing(0.5),
  },
  sectionTitle: { fontSize: font.h1, fontWeight: '800', color: colors.text },
  seeAll: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seeAllText: { color: colors.text, fontSize: font.small + 0.5, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    marginBottom: spacing(1.5),
  },
  gradientCard: {
    borderRadius: radius.xl,
    padding: spacing(2.5),
    marginBottom: spacing(2),
  },
  statTile: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing(1.75),
    minHeight: 92,
    justifyContent: 'space-between',
  },
  statTileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statTileLabel: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  statTileValue: { color: colors.text, fontSize: 26, fontWeight: '800' },
  statTileUnit: { color: colors.textDim, fontSize: font.small + 1, fontWeight: '600' },
  playBtn: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1.5),
    marginBottom: spacing(1.25),
  },
  taskThumb: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: { color: colors.text, fontSize: font.h2, fontWeight: '700', marginBottom: 3 },
  taskMeta: { color: colors.textDim, fontSize: font.small + 0.5 },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing(1.6),
    paddingHorizontal: spacing(2.5),
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { paddingVertical: spacing(0.9), paddingHorizontal: spacing(1.75) },
  btnGhost: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  btnDanger: { backgroundColor: '#B91C1C' },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: font.body },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(1.3),
    paddingHorizontal: spacing(1.75),
    fontSize: font.body,
    marginBottom: spacing(1),
  },
  chip: {
    paddingVertical: spacing(0.8),
    paddingHorizontal: spacing(1.6),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginRight: spacing(0.75),
    marginBottom: spacing(0.75),
  },
  chipText: { color: colors.text, fontSize: font.small + 1 },
  stat: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing(1.5),
    alignItems: 'center',
  },
  statValue: { fontSize: 21, fontWeight: '800', color: colors.primaryLight },
  statLabel: { fontSize: font.small, color: colors.textDim, marginTop: 2, textAlign: 'center' },
  progressOuter: { height: 8, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 4, overflow: 'hidden' },
  progressInner: { height: 8, borderRadius: 4 },
  macroLabel: { color: colors.text, fontSize: font.body, fontWeight: '700', marginBottom: 8 },
  macroTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
    marginBottom: 6,
  },
  macroValue: { color: colors.textDim, fontSize: font.small + 0.5 },
});
