import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { HeadlineFeed } from '../components/press/HeadlineFeed';
import { SpinSheet } from '../components/press/SpinSheet';
import type { SpinAngle } from '../components/press/SpinSheet';
import { Button, Card, Chip, EmptyState, Meter, SectionTitle } from '../components/ui';
import { useGame } from '../state';
import { colors, font, fileFontFamily, headingFontFamily, spacing } from '../theme';
import {
  MEDIA_HOSTILITY_FLOOR,
  MEDIA_OUTLETS,
  PRESS_APPROVAL_FLOOR,
  createDefaultMediaState,
} from '../media';
import type { PaperId } from '../media';

export interface PressRoomScreenProps {
  /**
   * When true, renders without its own ScrollView so it can nest inside an
   * existing scroll container (e.g. the GameScreen tab shell).
   */
  embedded?: boolean;
}

/**
 * Press Room — the media cycle.
 *
 * Bound to the engine's media module: reads `state.mediaState` (pressMood,
 * hostility, pressApproval) and `state.headlines`, and dispatches the real
 * BRIEF_PRESS action. The three meters use the module's own thresholds
 * (PRESS_APPROVAL_FLOOR, MEDIA_HOSTILITY_FLOOR) rather than ad-hoc cutoffs.
 */
export default function PressRoomScreen({ embedded = false }: PressRoomScreenProps = {}) {
  const { state, dispatch } = useGame();
  const media = state.mediaState ?? createDefaultMediaState();
  const [spinOpen, setSpinOpen] = useState(false);

  const moodValues = MEDIA_OUTLETS.map((o) => media.pressMood[o.id] ?? 50);
  const pressMood = moodValues.reduce((sum, m) => sum + m, 0) / Math.max(1, moodValues.length);

  const hostility = media.hostility;
  const approval = media.pressApproval;

  const brief = (outletId: PaperId, angle: SpinAngle) => {
    dispatch({ type: 'BRIEF_PRESS', outletId, angle });
    setSpinOpen(false);
  };

  const body = (
    <>
      <Text style={styles.eyebrow}>FLEET STREET</Text>
      <Text style={styles.title}>Press Room</Text>
      <Text style={styles.subtitle}>Month {state.week} · {state.headlines.length} line(s) on the record</Text>

<SectionTitle title="Fleet Street" hint="Three papers, three stances. Warm them or face the consequences." />
      {MEDIA_OUTLETS.map((o) => {
        const mood = media.pressMood[o.id] ?? 50;
        const leaning = mood >= 60 ? 'warm' : mood >= 40 ? 'neutral' : 'cold';
        const leaningTone: 'success' | 'neutral' | 'danger' =
          leaning === 'warm' ? 'success' : leaning === 'neutral' ? 'neutral' : 'danger';
        return (
          <Card key={o.id}>
            <View style={styles.paperRow}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={styles.paperName} numberOfLines={1}>
                  {o.name}
                </Text>
                <Text style={styles.paperStance}>
                  {o.stance.toUpperCase()} · MOOD {Math.round(mood)}
                </Text>
              </View>
              <Chip label={leaning.toUpperCase()} tone={leaningTone} />
            </View>
            <Meter value={mood} color={mood >= 55 ? colors.success : mood >= 40 ? colors.warning : colors.accent} />
          </Card>
        );
      })}

      <Card tone={hostility >= MEDIA_HOSTILITY_FLOOR || approval < PRESS_APPROVAL_FLOOR ? 'danger' : 'default'}>
        <View style={styles.meterRow}>
          <Text style={styles.meterLabel}>PRESS APPROVAL</Text>
          <Text style={styles.meterValue}>{Math.round(approval)}</Text>
        </View>
        <Meter
          value={approval}
          color={approval < PRESS_APPROVAL_FLOOR ? colors.danger : colors.success}
        />
        <Text style={[styles.meterLabel, styles.secondMeter]}>HOSTILITY</Text>
        <Meter
          value={hostility}
          color={hostility >= MEDIA_HOSTILITY_FLOOR ? colors.accent : colors.warning}
        />
        <Text style={styles.meterSub}>
          {approval < PRESS_APPROVAL_FLOOR
            ? 'Below the floor: the press now amplifies every setback.'
            : 'Above the floor: coverage neither helps nor hurts on its own.'}
        </Text>
      </Card>

      <Button
        label="Call a lobby briefing"
        variant="secondary"
        onPress={() => setSpinOpen(true)}
        testID="open-spin-sheet"
      />

      <SectionTitle title="Recent Headlines" hint="The most recent lines, newest first." />
      {state.headlines.length === 0 ? (
        <EmptyState title="No coverage yet" body="Advance the calendar and Fleet Street will weigh in." />
      ) : (
        <HeadlineFeed headlines={state.headlines} limit={6} />
      )}

      <SpinSheet
        visible={spinOpen}
        onClose={() => setSpinOpen(false)}
        mediaState={media}
        week={state.week}
        onBrief={brief}
      />
    </>
  );

  return embedded ? (
    <View style={styles.content}>{body}</View>
  ) : (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: font.tiny,
    fontWeight: '700',
    fontFamily: fileFontFamily,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.card,
    fontSize: font.h1,
    fontWeight: '700',
    fontFamily: headingFontFamily,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.faint,
    fontSize: font.small,
    marginTop: spacing.xs,
    fontFamily: fileFontFamily,
  },
  paperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  paperName: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '700',
    fontFamily: headingFontFamily,
  },
  paperStance: {
    color: colors.muted,
    fontSize: font.tiny,
    letterSpacing: 0.8,
    marginTop: 2,
    fontFamily: fileFontFamily,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  meterLabel: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  meterValue: {
    color: colors.text,
    fontSize: font.h3,
    fontWeight: '800',
  },
  secondMeter: {
    marginTop: spacing.md,
  },
  meterSub: {
    color: colors.muted,
    fontSize: font.tiny,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
});
