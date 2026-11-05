import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, fileFontFamily, headingFontFamily, radius, spacing } from '../theme';
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
    tone === 'danger'
      ? colors.accent
      : tone === 'success'
        ? colors.success
        : tone === 'accent'
          ? colors.gold
          : colors.cardBorderLight;
  return <View style={[styles.card, { borderColor: border }, style]}>{children}</View>;
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionBar} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Grid({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.grid, style]}>{children}</View>;
}

export function GridItem({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.gridItem, style]}>{children}</View>;
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
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  compact?: boolean;
  testID?: string;
  /** Optional overrides merged last — keeps hit targets above 44px. */
  style?: object;
}) {
  const bg =
    variant === 'primary'
      ? colors.accent
      : variant === 'secondary'
        ? colors.accentSoft
        : variant === 'danger'
          ? colors.accentDeep
          : 'transparent';
  /* Ghost = stamped ink on whatever surface it sits on. */
  const textColor = variant === 'ghost' ? colors.muted : variant === 'secondary' ? colors.accent : colors.card;
  const border =
    variant === 'danger' || variant === 'ghost' ? colors.accent : variant === 'secondary' ? colors.cardBorderLight : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: bg, borderColor: border },
        disabled && { opacity: 0.45 },
        pressed && styles.buttonPressed,
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: textColor }, compact && styles.buttonTextCompact]} numberOfLines={1}>
        {label}
      </Text>
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
      ? colors.accent
      : tone === 'warning'
        ? colors.warning
        : tone === 'success'
          ? colors.success
          : tone === 'accent'
            ? colors.gold
            : colors.textOnPaper;
  const body = (
    <View style={[styles.chip, { borderColor: color }]}>
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}>
      {body}
    </Pressable>
  ) : (
    body
  );
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
  tone?: 'default' | 'danger' | 'warning' | 'success';
  hint?: string;
}) {
  const color =
    tone === 'danger'
      ? colors.accent
      : tone === 'warning'
        ? colors.warning
        : tone === 'success'
          ? colors.success
          : colors.text;
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
  height = 5,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <View style={[styles.meter, { height }]}>
      <View style={[styles.meterFill, { width: `${pct}%`, backgroundColor: color ?? colors.accent }]} />
    </View>
  );
}

/**
 * The mandate — a single bar against the 50% line that decides elections.
 * Replaces grids of stat tiles: one glance says whether you are winning.
 */
export function MandateBar({
  approval,
  marker = 50,
  height = 14,
}: {
  approval: number;
  /** The line your mandate is judged against (default: overall swing needed). */
  marker?: number;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, approval));
  const markerPct = Math.max(0, Math.min(100, marker));
  const color = approval >= marker ? colors.success : approval >= marker - 10 ? colors.warning : colors.accent;
  return (
    <View style={[styles.mandate, { height }]}>
      <View style={[styles.mandateFill, { width: `${pct}%`, backgroundColor: color }]} />
      <View style={[styles.mandateMarker, { left: `${markerPct}%` }]} />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Effect previews
 * ------------------------------------------------------------------ */

type EffectKind = 'score' | 'pct' | 'bn' | 'm' | 'k';

const EFFECT_META: { key: keyof Effects; label: string; kind: EffectKind }[] = [
  { key: 'approval', label: 'Approval', kind: 'score' },
  { key: 'partyConfidence', label: 'Party unity', kind: 'score' },
  { key: 'cpiInflation', label: 'Inflation', kind: 'pct' },
  { key: 'budgetBalance', label: 'Budget', kind: 'bn' },
  { key: 'gdpGrowth', label: 'GDP', kind: 'pct' },
  { key: 'giltYield', label: 'Gilts', kind: 'pct' },
  { key: 'unemployment', label: 'Unemployment', kind: 'pct' },
  { key: 'nhsWaitingList', label: 'NHS wait', kind: 'm' },
  { key: 'netMigration', label: 'Migration', kind: 'k' },
  { key: 'lettersDelta', label: '1922 letters', kind: 'score' },
];

const LOWER_IS_BETTER = new Set<keyof Effects>([
  'cpiInflation',
  'giltYield',
  'unemployment',
  'nhsWaitingList',
  'lettersDelta',
]);

function formatValue(v: number, kind: EffectKind): string {
  const rounded = Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
  switch (kind) {
    case 'pct':
      return `${rounded}pp`;
    case 'bn':
      return `£${rounded}bn`;
    case 'm':
      return `${rounded}m`;
    case 'k':
      return `${rounded}k`;
    default:
      return `${rounded}`;
  }
}

export function EffectChips({ effects, max = 6 }: { effects: Effects; max?: number }) {
  const entries = EFFECT_META.filter(({ key }) => typeof effects[key] === 'number').slice(0, max);
  if (entries.length === 0) return null;
  return (
    <View style={styles.chipWrap}>
      {entries.map(({ key, label, kind }) => {
        const value = effects[key] as number;
        const good = LOWER_IS_BETTER.has(key) ? value < 0 : value > 0;
        const tone = value === 0 ? 'neutral' : good ? 'success' : 'danger';
        return <Chip key={key} label={`${label} ${formatValue(value, kind)}`} tone={tone} />;
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Segmented control / sheets
 * ------------------------------------------------------------------ */

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
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.key)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Sheet({
  visible,
  onClose,
  eyebrow,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  eyebrow?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropHit} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
              {title ? <Text style={styles.sheetTitle}>{title}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  section: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionBar: {
    height: 2,
    width: 40,
    backgroundColor: colors.accent,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.card,
    fontSize: font.h3,
    fontWeight: '700',
    fontFamily: headingFontFamily,
    letterSpacing: 0.4,
  },
  hint: { color: colors.faint, fontSize: font.small, lineHeight: 18, marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.cardBorderLight, marginVertical: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs, marginTop: spacing.sm },
  gridItem: { width: '50%', paddingHorizontal: spacing.xs, marginBottom: spacing.sm },
  button: {
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
  },
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  buttonCompact: { paddingVertical: 8, paddingHorizontal: 12, minHeight: 32, marginTop: 0 },
  buttonText: { fontSize: font.body, fontWeight: '700', letterSpacing: 0.3 },
  buttonTextCompact: { fontSize: font.small, letterSpacing: 0.2 },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  chipText: { fontSize: font.tiny, fontWeight: '700', letterSpacing: 0.3 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  effectChip: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  effectChipText: { fontSize: font.tiny, fontWeight: '600' },
  statTile: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.cardBorderLight,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginHorizontal: 2,
    alignItems: 'center',
    flex: 1,
  },
  statValue: { fontSize: font.h3, fontWeight: '800', fontFamily: fileFontFamily },
  statLabel: { color: colors.muted, fontSize: font.tiny, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  statHint: { color: colors.faint, fontSize: 9, marginTop: 1 },
  meter: {
    height: 5,
    backgroundColor: colors.cardBorderLight,
    borderRadius: 1,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  meterFill: { height: '100%' },
  mandate: {
    backgroundColor: colors.cardBorderLight,
    borderRadius: 1,
    overflow: 'hidden',
  },
  mandateFill: { height: '100%' },
  mandateMarker: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    width: 2,
    backgroundColor: colors.ink,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.cardBorderLight,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.leather },
  segmentText: { fontSize: font.small, color: colors.textOnPaper, fontWeight: '600' },
  segmentTextActive: { color: colors.card, fontWeight: '800' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23,17,13,0.7)',
    justifyContent: 'flex-end',
  },
  backdropHit: { flex: 1 },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopWidth: 2,
    borderTopColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  sheetTitle: { color: colors.card, fontSize: font.h2, fontWeight: '700', fontFamily: headingFontFamily },
  eyebrow: {
    color: colors.gold,
    fontSize: font.tiny,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  sheetBody: { flex: 1 },
  close: { padding: 4 },
  closeText: { color: colors.faint, fontSize: 16 },
  empty: {
    borderWidth: 1,
    borderColor: colors.cardBorderLight,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    padding: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.cardAlt,
  },
  emptyTitle: { color: colors.text, fontWeight: '700' },
  emptyBody: { color: colors.faint, fontSize: font.small, marginTop: 4, lineHeight: 18 },
});
