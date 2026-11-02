import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MinisterCard } from '../components/cabinet/MinisterCard';
import { Button, Card, Divider, EmptyState, Meter, SectionTitle, Sheet, StatTile } from '../components/ui';
import { useGame } from '../state';
import { colors, font, spacing } from '../theme';
import { CABINET_COHESION_FLOOR, createDefaultCabinetState, estimateResignationRisk } from '../cabinet';
import { CHANCELLOR_POST, chancellorLeakRisk } from '../cabinetEffects';
import type { Minister } from '../types';

/** Posts a promoted backbencher can be given (mirrors the engine's appointment picker). */
const MINISTER_POSTS = [
  'Chancellor of the Exchequer',
  'Home Secretary',
  'Health Secretary',
  'Foreign Secretary',
  'Defence Secretary',
  'Education Secretary',
  'Minister of State',
];

/**
 * Cabinet Room — personnel management.
 *
 * Strictly bound to the real engine surface: reads `state.cabinet` and
 * `state.cabinetState` (cohesion, tenure, resignationPressure) and dispatches
 * the existing SACK_MINISTER / PICK_MINISTER / CONFIRM_APPOINT actions.
 * Nothing is recomputed beyond deriving readings the engine already implies.
 */
export default function CabinetRoomScreen() {
  const { state, dispatch } = useGame();
  const cabinetState = state.cabinetState ?? createDefaultCabinetState();

  const [selected, setSelected] = useState<Minister | null>(null);
  const [promotingName, setPromotingName] = useState<string | null>(null);

  const cabinet = state.cabinet;

  const averageLoyalty =
    cabinet.length > 0 ? cabinet.reduce((sum, m) => sum + m.loyalty, 0) / cabinet.length : 0;

  // The engine stores no leak counter: a leak risk is the same predicate the
  // engine uses at a fiscal event (chancellorLeakRisk, Chancellor only).
  const leakRisks = cabinet.filter((m) => m.post === CHANCELLOR_POST && chancellorLeakRisk(m)).length;

  const resignRisks = cabinet.filter(
    (m) => estimateResignationRisk(cabinetState, m.name) >= 0.5,
  ).length;

  const cohesion = cabinetState.cohesion;
  const cohesionTone = cohesion >= 65 ? 'success' : cohesion >= CABINET_COHESION_FLOOR ? 'warning' : 'danger';

  const openSheet = (m: Minister) => {
    setSelected(m);
    setPromotingName(null);
  };

  const closeSheet = () => {
    setSelected(null);
    setPromotingName(null);
  };

  const sackMinister = (m: Minister) => {
    dispatch({ type: 'SACK_MINISTER', name: m.name });
    closeSheet();
  };

  const beginPromotion = (name: string) => {
    dispatch({ type: 'PICK_MINISTER', name });
    setPromotingName(name);
  };

  const confirmPost = (post: string) => {
    dispatch({ type: 'CONFIRM_APPOINT', post });
    closeSheet();
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>WESTMINSTER</Text>
      <Text style={styles.title}>Cabinet Room</Text>
      <Text style={styles.subtitle}>
        {cabinet.length} minister{cabinet.length === 1 ? '' : 's'} · Month {state.week}
      </Text>

      <SectionTitle title="Cabinet Cohesion" hint="Collective discipline. Below the floor it starts to cost you." />
      <Card tone={cohesionTone === 'danger' ? 'danger' : 'default'}>
        <View style={styles.meterRow}>
          <Text style={styles.meterLabel}>Cohesion</Text>
          <Text style={styles.meterValue}>{Math.round(cohesion)}</Text>
        </View>
        <Meter
          value={cohesion}
          color={cohesion >= 65 ? colors.success : cohesion >= CABINET_COHESION_FLOOR ? colors.warning : colors.danger}
        />
        <View style={styles.floorRow}>
          <Text style={styles.floorText}>
            Floor {CABINET_COHESION_FLOOR} · average loyalty {Math.round(averageLoyalty)}
          </Text>
        </View>
      </Card>

      <View style={styles.statRow}>
        <View style={styles.statTile}>
          <StatTile
            label="Avg Loyalty"
            value={Math.round(averageLoyalty)}
            tone={averageLoyalty >= 55 ? 'success' : averageLoyalty >= 40 ? 'warning' : 'danger'}
          />
        </View>
        <View style={styles.statTile}>
          <StatTile
            label="Leak Risks"
            value={leakRisks}
            tone={leakRisks > 0 ? 'danger' : 'success'}
            hint={leakRisks > 0 ? 'budget leak risk' : 'none'}
          />
        </View>
        <View style={styles.statTile}>
          <StatTile
            label="Resign Risks"
            value={resignRisks}
            tone={resignRisks > 0 ? 'warning' : 'success'}
            hint={resignRisks > 0 ? 'pressure >= 50%' : 'none'}
          />
        </View>
      </View>

      <SectionTitle title="Ministers" hint="Tap Manage for reshuffle and sacking options." />
      {cabinet.length === 0 ? (
        <EmptyState title="No ministers" body="Appoint a cabinet from the Politics tab to fill these posts." />
      ) : (
        cabinet.map((m) => (
          <MinisterCard
            key={m.name}
            minister={m}
            tenureWeeks={cabinetState.tenure[m.name] ?? 0}
            resignationRisk={estimateResignationRisk(cabinetState, m.name)}
            leakRisk={m.post === CHANCELLOR_POST && chancellorLeakRisk(m)}
            onPress={() => openSheet(m)}
            testID={`manage-${m.name}`}
          />
        ))
      )}

      <Sheet
        visible={selected !== null}
        onClose={closeSheet}
        eyebrow={selected ? selected.post.toUpperCase() : undefined}
        title={selected ? selected.name : ''}
      >
        {selected && promotingName === null ? (
          <View>
            <Text style={styles.sheetLine}>
              {selected.faction}
              {selected.coalition ? ' · coalition partner' : ''} · loyalty{' '}
              {Math.round(selected.loyalty)} · competence {Math.round(selected.competence)}
            </Text>

            <Button
              label={`Sack ${selected.name}`}
              variant="danger"
              onPress={() => sackMinister(selected)}
              testID="confirm-sack"
            />
            <Text style={styles.warningText}>
              {selected.coalition
                ? 'Sacking a coalition minister ends the agreement and your majority.'
                : 'This is final. You cannot re-appoint them this term.'}
            </Text>

            <Divider />

            <Text style={styles.sheetHeading}>Promote a backbencher</Text>
            {state.backbenchers.length === 0 ? (
              <Text style={styles.sheetLine}>No backbenchers available.</Text>
            ) : (
              state.backbenchers.slice(0, 6).map((b) => (
                <Pressable
                  key={b.name}
                  onPress={() => beginPromotion(b.name)}
                  style={styles.row}
                  accessibilityRole="button"
                  testID={`promote-${b.name}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{b.name}</Text>
                    <Text style={styles.rowMeta}>
                      {b.faction} · loyalty {Math.round(b.loyalty)} · competence {Math.round(b.competence)}
                    </Text>
                  </View>
                  <Text style={styles.rowAction}>Promote</Text>
                </Pressable>
              ))
            )}
          </View>
        ) : null}

        {selected && promotingName !== null ? (
          <View>
            <Text style={styles.sheetLine}>Choose the post for {promotingName}.</Text>
            {MINISTER_POSTS.map((post) => (
              <Pressable
                key={post}
                onPress={() => confirmPost(post)}
                style={styles.row}
                accessibilityRole="button"
                testID={`post-${post}`}
              >
                <Text style={styles.rowTitle}>{post}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Sheet>
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
  floorRow: {
    marginTop: spacing.sm,
  },
  floorText: {
    color: colors.muted,
    fontSize: font.tiny,
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
  sheetHeading: {
    color: colors.text,
    fontSize: font.h3,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  sheetLine: {
    color: colors.muted,
    fontSize: font.small,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  warningText: {
    color: colors.muted,
    fontSize: font.tiny,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomColor: colors.cardBorder,
    borderBottomWidth: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '700',
  },
  rowMeta: {
    color: colors.muted,
    fontSize: font.tiny,
    marginTop: 2,
  },
  rowAction: {
    color: colors.accent,
    fontSize: font.small,
    fontWeight: '800',
    marginLeft: spacing.sm,
  },
});
