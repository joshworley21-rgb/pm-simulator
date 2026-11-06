import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Check } from 'lucide-react-native';
import { useGame } from '../../state';
import { Card, Chip } from '../ui';
import { colors, fileFontFamily, font, headingFontFamily, spacing } from '../../theme';

export interface FirstMonthChecklistProps {
  onOpenPapers: () => void;
  onOpenCabinet: () => void;
  onAdvance: () => void;
}

/**
 * The first month is the tutorial. Four durable milestones replace a wall of
 * help text: read, decide, meet the Cabinet, then turn the month over.
 */
export function FirstMonthChecklist({
  onOpenPapers,
  onOpenCabinet,
  onAdvance,
}: FirstMonthChecklistProps) {
  const { state, dispatch } = useGame();
  if (state.phase !== 'playing' || state.week !== 1 || state.gameOver || state.isElection) return null;

  const read = (state.viewedDossierIds?.length ?? 0) > 0;
  const decided = (state.resolvedDossierIds?.length ?? 0) > 0;
  const met = state.lastCabinetMeetingWeek !== undefined;
  const advanced = state.week > 1;
  const openFirstPaper = () => {
    const first = state.redBox[0];
    if (first) dispatch({ type: 'OPEN_DOSSIER', dossierId: first.id });
    else onOpenPapers();
  };
  const steps = [
    { key: 'read', label: 'Read a submission from the red box', done: read, onPress: openFirstPaper },
    { key: 'decide', label: 'Take and sign a decision', done: decided, onPress: openFirstPaper },
    { key: 'cabinet', label: 'Hold your first Cabinet meeting', done: met, onPress: onOpenCabinet },
    { key: 'advance', label: 'Advance the month', done: advanced, onPress: onAdvance },
  ];
  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) return null;

  return (
    <Card tone="accent">
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>YOUR FIRST MONTH</Text>
          <Text style={styles.title}>The first day in office</Text>
        </View>
        <Chip label={`${done}/${steps.length}`} tone="accent" />
      </View>
      <Text style={styles.intro}>
        There is no single right order, but a Prime Minister who never reads the box, meets the Cabinet or turns the month over will not last long.
      </Text>
      <View style={styles.steps}>
        {steps.map((step, index) => (
          <Pressable
            key={step.key}
            accessibilityRole="button"
            accessibilityLabel={step.label}
            accessibilityState={{ checked: step.done }}
            onPress={step.onPress}
            style={styles.step}
          >
            <View style={[styles.marker, step.done && styles.markerDone]}>
              {step.done ? <Check size={12} color={colors.onAccent} strokeWidth={3} /> : <Text style={styles.markerText}>{index + 1}</Text>}
            </View>
            <Text style={[styles.stepLabel, step.done && styles.stepDone]}>{step.label}</Text>
            {!step.done ? <ArrowRight size={14} color={colors.accent} strokeWidth={2} /> : null}
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  eyebrow: {
    color: colors.gold,
    fontFamily: fileFontFamily,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    marginTop: 2,
    color: colors.text,
    fontFamily: headingFontFamily,
    fontSize: font.h3,
    fontWeight: '700',
  },
  intro: { marginTop: spacing.xs, color: colors.muted, fontSize: font.small, lineHeight: 18 },
  steps: { marginTop: spacing.sm },
  step: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.cardBorderLight,
  },
  marker: {
    width: 22,
    height: 22,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.cardAlt,
  },
  markerDone: { backgroundColor: colors.success, borderColor: colors.success },
  markerText: {
    color: colors.faint,
    fontFamily: fileFontFamily,
    fontSize: 9,
    fontWeight: '800',
  },
  stepLabel: { flex: 1, color: colors.text, fontSize: font.small, lineHeight: 18 },
  stepDone: { color: colors.faint, textDecorationLine: 'line-through' },
});
