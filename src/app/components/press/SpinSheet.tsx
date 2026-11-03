import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Sheet } from '../ui';
import { colors, font, headingFontFamily, spacing } from '../../theme';
import { BRIEFING_COOLDOWN_WEEKS, MEDIA_OUTLETS } from '../../media';
import type { MediaState, PaperId } from '../../media';

export type SpinAngle = 'boost' | 'attack';

export interface SpinSheetProps {
  visible: boolean;
  onClose: () => void;
  mediaState: MediaState;
  week: number;
  /** Dispatches the real BRIEF_PRESS action. */
  onBrief: (outletId: PaperId, angle: SpinAngle) => void;
}

type OutletLeaning = 'Friendly' | 'Neutral' | 'Hostile';

const LEANING_TONE: Record<OutletLeaning, 'success' | 'neutral' | 'danger'> = {
  Friendly: 'success',
  Neutral: 'neutral',
  Hostile: 'danger',
};

function leaningOf(mood: number): OutletLeaning {
  if (mood >= 55) return 'Friendly';
  if (mood <= 45) return 'Hostile';
  return 'Neutral';
}

/**
 * Lobby briefing (the "spin" lever).
 *
 * Mirrors lobbyBriefing(): one outlet per briefing, and it cannot be repeated
 * inside BRIEFING_COOLDOWN_WEEKS. The mood/hostility numbers quoted below are
 * the module's own deltas, so what the player reads is what the engine does.
 */
export function SpinSheet({ visible, onClose, mediaState, week, onBrief }: SpinSheetProps) {
  const weeksSince =
    mediaState.lastBriefingWeek === null ? null : week - mediaState.lastBriefingWeek;
  const weeksRemaining =
    weeksSince === null ? 0 : Math.max(0, BRIEFING_COOLDOWN_WEEKS - weeksSince);
  const ready = weeksRemaining <= 0;

  return (
    <Sheet visible={visible} onClose={onClose} eyebrow="FLEET STREET" title="Lobby Briefing">
      <Text style={styles.intro}>
        {ready
          ? 'Choose an outlet and an angle. A briefing always carries a whiff of manipulation.'
          : `No briefings for another ${weeksRemaining} week(s). The lobby is watching.`}
      </Text>

      <View style={styles.cooldownRow}>
        <Chip
          label={ready ? 'BRIEFING READY' : `COOLDOWN: ${weeksRemaining} WEEK(S)`}
          tone={ready ? 'success' : 'warning'}
        />
        <Chip label={`Hostility ${Math.round(mediaState.hostility)}`} tone="neutral" />
      </View>

      {MEDIA_OUTLETS.map((outlet) => {
        const mood = mediaState.pressMood[outlet.id] ?? 50;
        const leaning = leaningOf(mood);
        return (
          <View key={outlet.id} style={styles.outlet}>
            <View style={styles.outletHeader}>
              <Text style={styles.outletName} numberOfLines={1}>
                {outlet.name}
              </Text>
              <Chip label={leaning} tone={LEANING_TONE[leaning]} />
            </View>
            <Text style={styles.outletMeta}>
              {outlet.stance} · mood {Math.round(mood)}
            </Text>

            <View style={styles.actions}>
              <View style={styles.actionItem}>
                <Button
                  label="Boost (+6 mood, +2 hostility)"
                  variant="secondary"
                  disabled={!ready}
                  onPress={() => onBrief(outlet.id, 'boost')}
                  testID={`brief-boost-${outlet.id}`}
                />
              </View>
              <View style={styles.actionItem}>
                <Button
                  label="Attack (-8 mood, +4 hostility)"
                  variant="danger"
                  disabled={!ready}
                  onPress={() => onBrief(outlet.id, 'attack')}
                  testID={`brief-attack-${outlet.id}`}
                />
              </View>
            </View>
          </View>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  intro: {
    color: colors.muted,
    fontSize: font.small,
    lineHeight: 19,
  },
  cooldownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  outlet: {
    marginTop: spacing.lg,
  },
  outletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  outletName: {
    color: colors.text,
    fontSize: font.h3,
    fontWeight: '800',
    fontFamily: headingFontFamily,
    flex: 1,
    paddingRight: spacing.sm,
  },
  outletMeta: {
    color: colors.muted,
    fontSize: font.tiny,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    marginHorizontal: -spacing.xs,
  },
  actionItem: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
});
