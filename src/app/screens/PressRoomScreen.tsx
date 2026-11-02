import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { HeadlineFeed } from '../components/press/HeadlineFeed';
import { SpinSheet } from '../components/press/SpinSheet';
import type { SpinAngle } from '../components/press/SpinSheet';
import { Button, Card, EmptyState, Meter, SectionTitle, StatTile } from '../components/ui';
import { useGame } from '../state';
import { colors, font, spacing } from '../theme';
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

  const moodTone = pressMood >= 55 ? 'success' : pressMood >= 40 ? 'warning' : 'danger';
  const hostilityTone =
    hostility < 40 ? 'success' : hostility < MEDIA_HOSTILITY_FLOOR ? 'warning' : 'danger';
  const approvalTone =
    approval >= 50 ? 'success' : approval >= PRESS_APPROVAL_FLOOR ? 'warning' : 'danger';

  const brief = (outletId: PaperId, angle: SpinAngle) => {
    dispatch({ type: 'BRIEF_PRESS', outletId, angle });
    setSpinOpen(false);
  };

  const body = (
    <>
      <Text style={styles.eyebrow}>FLEET STREET</Text>
      <Text style={styles.title}>Press Room</Text>
      <Text style={styles.subtitle}>Month {state.week} · {state.headlines.length} line(s) on the record</Text>

      <SectionTitle title="The Press" hint="Mood warms or cools by outlet; hostility is accumulated." />
      <View style={styles.statRow}>
        <View style={styles.statTile}>
          <StatTile label="Press Mood" value={Math.round(pressMood)} tone={moodTone} />
        </View>
        <View style={styles.statTile}>
          <StatTile
            label="Hostility"
            value={Math.round(hostility)}
            tone={hostilityTone}
            hint={hostility >= MEDIA_HOSTILITY_FLOOR ? 'over floor' : `floor ${MEDIA_HOSTILITY_FLOOR}`}
          />
        </View>
        <View style={styles.statTile}>
          <StatTile
            label="Press Approval"
            value={Math.round(approval)}
            tone={approvalTone}
            hint={approval < PRESS_APPROVAL_FLOOR ? 'drag active' : `floor ${PRESS_APPROVAL_FLOOR}`}
          />
        </View>
      </View>

      <Card tone={hostility >= MEDIA_HOSTILITY_FLOOR || approval < PRESS_APPROVAL_FLOOR ? 'danger' : 'default'}>
        <View style={styles.meterRow}>
          <Text style={styles.meterLabel}>Press Approval</Text>
          <Text style={styles.meterValue}>{Math.round(approval)}</Text>
        </View>
        <Meter
          value={approval}
          color={approval < PRESS_APPROVAL_FLOOR ? colors.danger : colors.success}
        />
        <Text style={[styles.meterLabel, styles.secondMeter]}>Hostility</Text>
        <Meter
          value={hostility}
          color={hostility >= MEDIA_HOSTILITY_FLOOR ? colors.danger : colors.warning}
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
    color: colors.accent,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.text,
    fontSize: font.h1,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.muted,
    fontSize: font.small,
    marginTop: spacing.xs,
  },
  statRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginHorizontal: -spacing.xs,
  },
  statTile: {
    flex: 1,
    marginHorizontal: spacing.xs,
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
