import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { colors, font, spacing } from '../theme';

export const Screen: React.FC<{ children: React.ReactNode; scroll?: boolean; style?: ViewStyle }> = ({
  children,
  scroll = true,
  style,
}) =>
  scroll ? (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.screenContent, style]}>
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

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle; accent?: boolean }> = ({
  children,
  style,
  accent,
}) => <View style={[styles.card, accent && { borderColor: colors.primary }, style]}>{children}</View>;

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
      <ActivityIndicator color={kind === 'primary' ? '#06281F' : colors.text} />
    ) : (
      <Text style={[styles.btnText, small && { fontSize: font.small + 1 }, kind !== 'primary' && { color: colors.text }]}>
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
    <Text style={[styles.chipText, active && { color: '#06281F', fontWeight: '700' }]}>{label}</Text>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: spacing(2), paddingBottom: spacing(4), maxWidth: 860, width: '100%', alignSelf: 'center' },
  title: { fontSize: font.title, fontWeight: '800', color: colors.text, marginBottom: spacing(1.5) },
  h1: { fontSize: font.h1, fontWeight: '700', color: colors.text, marginBottom: spacing(1) },
  body: { fontSize: font.body, color: colors.text, lineHeight: 21 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    marginBottom: spacing(1.5),
  },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing(1.4),
    paddingHorizontal: spacing(2.5),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { paddingVertical: spacing(0.8), paddingHorizontal: spacing(1.5), borderRadius: 9 },
  btnGhost: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  btnDanger: { backgroundColor: colors.danger },
  btnText: { color: '#06281F', fontWeight: '800', fontSize: font.body },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(1.2),
    paddingHorizontal: spacing(1.5),
    fontSize: font.body,
    marginBottom: spacing(1),
  },
  chip: {
    paddingVertical: spacing(0.7),
    paddingHorizontal: spacing(1.4),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginRight: spacing(0.75),
    marginBottom: spacing(0.75),
  },
  chipText: { color: colors.text, fontSize: font.small + 1 },
  stat: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: spacing(1.5), alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: font.small, color: colors.textDim, marginTop: 2, textAlign: 'center' },
  progressOuter: { height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  progressInner: { height: 8, borderRadius: 4 },
});
