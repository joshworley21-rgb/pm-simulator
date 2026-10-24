import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';
import type { Effects } from '../types';

/* ------------------------------------------------------------------ *
 * Layout primitives
 * ------------------------------------------------------------------ */

export function Card({
  children,
  tone = 'default',
  style,
}: {
  children: React.ReactNode;
  tone?: 'default' | 'danger' | 'success' | 'accent';
  style?: object;
}) {
  const border =
    tone === 'danger' ? colors.danger : tone === 'success' ? colors.success : tone === 'accent' ? colors.accent : colors.cardBorder;
  return <View style={[styles.card, { borderColor: border }, style]}>{children}</View>;
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.cardBorder, marginVertical: spacing.md }} />;
}

/* ------------------------------------------------------------------ *
 * Buttons / chips
 * ------------------------------------------------------------------ */

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  compact,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  compact?: boolean;
  testID?: string;
}) {
  const bg =
    variant === 'primary'
      ? colors.accent
      : variant === 'danger'
      ? 'rgba(255,97,97,0.14)'
      : variant === 'secondary'
      ? colors.accentSoft
      : 'transparent';
  const border = variant === 'danger' ? colors.danger : variant === 'ghost' ? colors.cardBorder : 'transparent';
  const textColor = variant === 'danger' ? colors.danger : variant === 'ghost' ? colors.text : '#ffffff';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: bg, borderColor: border, borderWidth: variant === 'ghost' || variant === 'danger' ? 1 : 0 },
        disabled && { opacity: 0.4 },
        pressed && !disabled && { opacity: 0.75 },
      ]}
    >
      <Text style={[styles.buttonText, { color: textColor }, compact && { fontSize: font.small }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  tone = 'neutral',
  onPress,
}: {
  label: string;
  tone?: 'neutral' | 'danger' | 'warning' | 'success' | 'accent';
  onPress?: () => void;
}) {
  const color =
    tone === 'danger'
      ? colors.danger
      : tone === 'warning'
      ? colors.warning
      : tone === 'success'
      ? colors.success
      : tone === 'accent'
      ? colors.accent
      : colors.muted;
  const body = (
    <View style={[styles.chip, { borderColor: color }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

/* ------------------------------------------------------------------ *
 * Data display
 * ------------------------------------------------------------------ */

export function StatTile({
  label,
  value,
  tone = 'default',
  hint,
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'danger' | 'success' | 'warning';
  hint?: string;
}) {
  const color =
    tone === 'danger' ? colors.danger : tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.text;
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      {hint ? (
        <Text style={styles.statHint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function Meter({
  value,
  max = 100,
  color,
  height = 6,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <View style={{ height, backgroundColor: colors.bg, borderRadius: height / 2, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height, backgroundColor: color ?? colors.accent }} />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Effect previews — the single biggest usability win
 * ------------------------------------------------------------------ */

type EffectKind = 'score' | 'pct' | 'bn' | 'm' | 'k';

const EFFECT_META: { key: keyof Effects; label: string; kind: EffectKind }[] = [
  { key: 'approval', label: 'Approval', kind: 'score' },
  { key: 'partyConfidence', label: 'Party unity', kind: 'score' },
  { key: 'publicServices', label: 'Services', kind: 'score' },
  { key: 'security', label: 'Security', kind: 'score' },
  { key: 'economy', label: 'Economy', kind: 'score' },
  { key: 'mediaAttention', label: 'Media', kind: 'score' },
  { key: 'cpiInflation', label: 'Inflation', kind: 'pct' },
  { key: 'gdpGrowth', label: 'Growth', kind: 'pct' },
  { key: 'giltYield', label: 'Gilts', kind: 'pct' },
  { key: 'unemployment', label: 'Unemployment', kind: 'pct' },
  { key: 'taxRate', label: 'Tax rate', kind: 'pct' },
  { key: 'debtToGdp', label: 'Debt/GDP', kind: 'pct' },
  { key: 'nhsWaitingList', label: 'NHS wait', kind: 'm' },
  { key: 'netMigration', label: 'Migration', kind: 'k' },
  { key: 'lettersDelta', label: 'Letters', kind: 'score' },
  { key: 'budgetBalance', label: 'Budget', kind: 'bn' },
  { key: 'fundsDelta', label: 'Party funds', kind: 'm' },
];

/** Lower is better for these. */
const LOWER_IS_BETTER = new Set<keyof Effects>([
  'cpiInflation',
  'giltYield',
  'nhsWaitingList',
  'lettersDelta',
  'debtToGdp',
  'unemployment',
]);

/** Politically contested — show neutral. */
const NEUTRAL_KEYS = new Set<keyof Effects>(['netMigration', 'mediaAttention', 'fundsDelta']);

function formatValue(v: number, kind: EffectKind): string {
  const abs = Math.abs(v);
  const pretty = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  if (kind === 'pct') return `${pretty}pp`;
  if (kind === 'bn') return `£${pretty}bn`;
  if (kind === 'm') return `${pretty}m`;
  if (kind === 'k') return `${pretty}k`;
  return pretty;
}

/** Renders a compact row of "what will this do" chips for an Effects object. */
export function EffectChips({ effects, max = 6 }: { effects: Effects; max?: number }) {
  const rows: { key: string; text: string; tone: 'success' | 'danger' | 'neutral' }[] = [];

  for (const meta of EFFECT_META) {
    const raw = effects[meta.key];
    if (typeof raw !== 'number' || raw === 0) continue;
    const dir = raw > 0 ? 'up' : 'down';
    let tone: 'success' | 'danger' | 'neutral' = 'neutral';
    if (!NEUTRAL_KEYS.has(meta.key)) {
      const good = LOWER_IS_BETTER.has(meta.key) ? dir === 'down' : dir === 'up';
      tone = good ? 'success' : 'danger';
    }
    rows.push({
      key: String(meta.key),
      text: `${meta.label} ${raw > 0 ? '▲' : '▼'}${formatValue(raw, meta.kind)}`,
      tone,
    });
  }

  if (rows.length === 0) return null;

  return (
    <View style={styles.chipWrap}>
      {rows.slice(0, max).map((r) => (
        <View
          key={r.key}
          style={[
            styles.effectChip,
            {
              borderColor:
                r.tone === 'success' ? colors.success : r.tone === 'danger' ? colors.danger : colors.muted,
            },
          ]}
        >
          <Text
            style={[
              styles.effectChipText,
              {
                color:
                  r.tone === 'success' ? colors.success : r.tone === 'danger' ? colors.danger : colors.muted,
              },
            ]}
          >
            {r.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Misc
 * ------------------------------------------------------------------ */

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card tone="success" style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
      <Text style={{ color: colors.success, fontSize: font.h3, fontWeight: '800' }}>{title}</Text>
      <Text style={[styles.hint, { textAlign: 'center', marginTop: spacing.xs }]}>{body}</Text>
    </Card>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.key)}
            style={[styles.segment, active && { backgroundColor: colors.accentSoft }]}
          >
            <Text style={[styles.segmentText, { color: active ? colors.text : colors.muted }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bottom-sheet style modal used for dossiers, PMQs, budgets, briefings. */
export function Sheet({
  visible,
  onClose,
  title,
  eyebrow,
  children,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
              <Text style={styles.sheetTitle}>{title}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
              <Text style={{ color: colors.muted, fontSize: 20, fontWeight: '700' }}>✕</Text>
            </Pressable>
          </View>
          {scroll ? (
            <ScrollView style={{ marginTop: spacing.md, maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          ) : (
            <View style={{ marginTop: spacing.md }}>{children}</View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  sectionTitle: { color: colors.text, fontSize: font.h2, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: font.small, lineHeight: 18, marginTop: 2 },
  button: {
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  buttonCompact: { paddingVertical: 8, paddingHorizontal: spacing.md, marginTop: 0 },
  buttonText: { fontSize: font.h3, fontWeight: '700' },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  chipText: { fontSize: font.tiny, fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  effectChip: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 6,
  },
  effectChipText: { fontSize: font.tiny, fontWeight: '700' },
  statTile: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: 3,
    alignItems: 'center',
  },
  statValue: { fontSize: font.h3, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: font.tiny, marginTop: 2 },
  statHint: { color: colors.muted, fontSize: 10, marginTop: 1, opacity: 0.8 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: 4,
    marginTop: spacing.md,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  segmentText: { fontSize: font.small, fontWeight: '700' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,16,0.75)' },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  sheetTitle: { color: colors.text, fontSize: font.h2, fontWeight: '800', marginTop: 2 },
  eyebrow: { color: colors.accent, fontSize: font.tiny, fontWeight: '800', letterSpacing: 1.2 },
});
