import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Divider } from './ui';
import { colors, font, fileFontFamily, headingFontFamily, radius, spacing } from '../theme';
import { useGame } from '../state';
import { activeSwanEvent, SWAN_WINDOW_WEEKS } from '../blackSwans';
import { backbenchBody } from '../westminster';
import type { SwanKind } from '../blackSwans';

/** Party confidence at or below this reads as existential collapse risk. */
const CONFIDENCE_EXISTENTIAL_THRESHOLD = 15;
/** A tabled no-confidence division within this many weeks is "looming". */
const NO_CONFIDENCE_LOOMING_WEEKS = 4;

function months(value: number): string {
  return `${value} month${value === 1 ? '' : 's'}`;
}

const KIND_LABEL: Record<SwanKind, string> = {
  natural: 'NATURAL DISASTER',
  security: 'NATIONAL SECURITY',
  economic: 'ECONOMIC SHOCK',
  infrastructure: 'INFRASTRUCTURE',
  health: 'PUBLIC HEALTH',
};

function severityOf(weeksRemaining: number): { label: string; tone: 'danger' | 'warning' } {
  if (weeksRemaining <= 1) return { label: 'CRITICAL', tone: 'danger' };
  if (weeksRemaining <= 2) return { label: 'SEVERE', tone: 'danger' };
  return { label: 'ELEVATED', tone: 'warning' };
}

/**
 * Global Crisis overlay.
 *
 * Sits above every screen and surfaces the two genuinely interrupting states:
 *
 *  1. A live Black Swan (state.blackSwanState.active). This is BLOCKING — the
 *     engine only clears the shock when it is answered (ANSWER_BLACK_SWAN) or
 *     when its response window expires, so there is deliberately no dismiss.
 *  2. A confidence alert: a looming no-confidence division, letters at the 1922
 *     threshold, or party confidence below the collapse line. This is advisory
 *     and dismissable; it never dispatches on the player's behalf.
 *
 * The catalogue carries no explicit severity field, so the badge is derived from
 * the remaining response window (the only real urgency signal) and the event's
 * own `kind` — nothing is invented beyond those two readings.
 */
export default function CrisisModal() {
  const { state, dispatch } = useGame();
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const swan = state.blackSwanState;
  const event = swan ? activeSwanEvent(swan) : undefined;

  // ---- 1. Black Swan (blocking) ---------------------------------------
  if (swan?.active && event) {
    const severity = severityOf(swan.active.weeksRemaining);
    return (
      <Modal visible transparent={false} animationType="fade" onRequestClose={() => undefined}>
        <View style={styles.fullScreen}>
          <ScrollView contentContainerStyle={styles.fullContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.eyebrowDanger}>NATIONAL CRISIS</Text>
            <View style={styles.badgeRow}>
              <Chip label={severity.label} tone={severity.tone} />
              <Chip label={KIND_LABEL[event.kind]} tone="warning" />
              <Chip label={`${months(swan.active.weeksRemaining)} to respond`} tone="neutral" />
            </View>

            <Text style={styles.title}>{event.name}</Text>
            <Text style={styles.body}>{event.brief}</Text>

            <Divider />

            <Text style={styles.sectionLabel}>YOUR RESPONSE</Text>
            {event.options.map((option) => (
              <View key={option.id} style={styles.option}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <View style={styles.optionMeta}>
                  <Chip label={`Command ${option.commandScore}`} tone={option.commandScore >= 60 ? 'success' : 'warning'} />
                </View>
                {/* Non-compact: clears the 44px emergency-decision hit target. */}
                <Button
                  label="Take this decision"
                  variant={option.commandScore >= 60 ? 'primary' : 'secondary'}
                  onPress={() => dispatch({ type: 'ANSWER_BLACK_SWAN', optionId: option.id })}
                  testID={`swan-option-${option.id}`}
                />
              </View>
            ))}

            <Text style={styles.footnote}>
              Decision window is {SWAN_WINDOW_WEEKS} months. An unanswered shock expires and is recorded.
            </Text>
          </ScrollView>
        </View>
      </Modal>
    );
  }

  // ---- 2. Confidence alert (advisory, dismissable) --------------------
  const letters = state.stats.lettersOfNoConfidence;
  const lettersThreshold = state.stats.lettersThreshold;
  const lettersAtThreshold = letters >= lettersThreshold;
  const confidenceCritical = state.metrics.partyConfidence <= CONFIDENCE_EXISTENTIAL_THRESHOLD;

  const motion = state.oppositionMotion;
  const weeksToDivision = motion ? Math.max(0, motion.scheduledWeek - state.week) : null;
  const motionLooming =
    weeksToDivision !== null && weeksToDivision <= NO_CONFIDENCE_LOOMING_WEEKS;

  const alertKey = motionLooming
    ? `motion-${motion?.scheduledWeek}`
    : lettersAtThreshold
      ? 'letters'
      : confidenceCritical
        ? 'confidence'
        : null;

  if (!alertKey || dismissedKey === alertKey) return null;

  const sponsor = motion
    ? (state.parties.find((p) => p.id === motion.sponsorPartyId)?.name ?? 'the opposition')
    : null;
  const backbench = backbenchBody(state.parties.find((party) => party.id === state.player?.partyId));

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => setDismissedKey(alertKey)}
    >
      <View style={styles.backdrop}>
        <View style={styles.warningCard}>
          <Text style={styles.eyebrowWarning}>CONFIDENCE ALERT</Text>
          <Text style={styles.title}>
            {motionLooming ? 'Motion of no confidence' : 'Party confidence critical'}
          </Text>

          <View style={styles.badgeRow}>
            {motionLooming ? (
              <Chip label={`Division in ${months(weeksToDivision ?? 0)}`} tone="danger" />
            ) : null}
            <Chip label={`${backbench.pressureShort} ${letters}/${lettersThreshold}`} tone={lettersAtThreshold ? 'danger' : 'warning'} />
            <Chip
              label={`Party confidence ${Math.round(state.metrics.partyConfidence)}`}
              tone={confidenceCritical ? 'danger' : 'warning'}
            />
          </View>

          <Text style={styles.body}>
            {motionLooming
              ? `${sponsor} has tabled a motion of no confidence. Without 326 votes or a confidence-and-supply partner, the numbers decide it.`
              : lettersAtThreshold
                ? `${backbench.pressureLabel} have reached the threshold: a ${backbench.ballotLabel} among your own MPs is due.`
                : 'Party confidence has fallen to the collapse line. A leadership challenge becomes likely.'}
          </Text>

          <Divider />

          <Button
            label="I understand"
            variant="danger"
            onPress={() => setDismissedKey(alertKey)}
            testID="crisis-acknowledge"
          />
          <Text style={styles.footnote}>
            {`Open Divisions for the ${backbench.full} meter and confidence-and-supply options.`}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fullContent: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(23,17,13,0.75)',
    padding: spacing.xl,
  },
  warningCard: {
    width: '100%',
    backgroundColor: colors.bgElevated,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  eyebrowDanger: {
    color: colors.danger,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 2,
  },
  eyebrowWarning: {
    color: colors.warning,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: font.h1,
    fontWeight: '700',
    fontFamily: headingFontFamily,
    marginTop: spacing.md,
    lineHeight: 34,
  },
  body: {
    color: colors.faint,
    fontSize: font.body,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  sectionLabel: {
    color: colors.gold,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    fontFamily: fileFontFamily,
    textTransform: 'uppercase',
  },
  option: {
    marginBottom: spacing.lg,
  },
  optionLabel: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '700',
    lineHeight: 21,
  },
  optionMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  footnote: {
    color: colors.faint,
    fontSize: font.tiny,
    lineHeight: 16,
    marginTop: spacing.md,
  },
});
