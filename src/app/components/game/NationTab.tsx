import React from 'react';
import { Text, View } from 'react-native';
import { useGame } from '../../state';
import { colors, fileFontFamily, font, headingFontFamily, spacing } from '../../theme';
import { Button, Card, Chip, Meter, SectionTitle, StatTile } from '../ui';
import { NATIONS, DEVOLUTION_PRESSURE_FLOOR } from '../../devolution';
import { councilsAtRisk, DELIVERY_GAP_FLOOR, SECTION_114_STRESS } from '../../localGovernment';
import {
  BACKLOG_ALERT,
  BACKLOG_CEILING,
  accommodationCost,
  backlogAlertRisk,
} from '../../immigration';
import {
  COMMITTEE_HOSTILITY_FLOOR,
  LOBBY_COOLDOWN_WEEKS,
  PETITION_DEBATE_THRESHOLD,
  petitionPressure,
  revolvingDoorRisk,
} from '../../lobbying';
import { CREDIBILITY_PREMIUM_FLOOR, independenceReading } from '../../centralBank';
import { PURDAH_TURNS } from '../../calendar';

const money = (v: number) => `£${Math.round(v * 10) / 10}bn`;
const pct = (v: number) => `${Math.round(v)}%`;
const blocTone = (mood: string): 'danger' | 'warning' | 'neutral' | 'success' =>
  mood === 'hostile' ? 'danger' : mood === 'restless' ? 'warning' : mood === 'loyal' ? 'success' : 'neutral';

/**
 * The Nation: everything the simulation runs that the desk and Treasury don't
 * already cover — the Union, councils, the Home Office, the lobbying industry,
 * the Bank of England and standards in public life.
 */
export default function NationTab() {
  const { state, dispatch } = useGame();
  const inPurdah = state.turnsUntilElection <= PURDAH_TURNS;
  const devolution = state.devolutionState;
  const local = state.localGovernmentState;
  const immigration = state.immigrationState;
  const lobbying = state.lobbyingState;
  const bank = state.centralBankState;
  const ethics = state.ethics;

  const authorities = [...(local?.authorities ?? [])].sort(
    (a, b) => Number(b.section114) - Number(a.section114) || b.stress - a.stress,
  );
  const atRisk = local ? councilsAtRisk(local) : 0;
  const failed = local?.authorities.filter((a) => a.section114).length ?? 0;
  const lobbyReady =
    !lobbying ||
    lobbying.lastLobbyWeek === null ||
    state.week - lobbying.lastLobbyWeek >= LOBBY_COOLDOWN_WEEKS;
  const lobbyCooldownLeft =
    lobbying && lobbying.lastLobbyWeek !== null
      ? Math.max(0, LOBBY_COOLDOWN_WEEKS - (state.week - lobbying.lastLobbyWeek))
      : 0;
  const investigations = ethics?.activeInvestigations ?? [];
  const coverUp = ethics?.coverUpActive ?? false;

  return (
    <View>
      <SectionTitle
        title="The Nation"
        hint="The machinery beyond Westminster: the Union, councils, the Home Office, lobbyists and the Bank."
      />

      <Text style={styles.label}>THE ELECTORATE</Text>
      <Card>
        {(state.blocs ?? []).map((bloc, index) => (
          <View key={bloc.id} style={[styles.electorateRow, index > 0 && styles.rowBordered]}>
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <Text style={styles.rowTitle}>{bloc.name}</Text>
              <Text style={styles.rowMeta}>{bloc.driver}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.blocSupport, { color: bloc.support >= 45 ? colors.success : colors.danger }]}>
                {Math.round(bloc.support)}%
              </Text>
              <Text style={[styles.blocMood, { color: blocTone(bloc.mood) === 'danger' ? colors.danger : blocTone(bloc.mood) === 'warning' ? colors.warning : blocTone(bloc.mood) === 'success' ? colors.success : colors.muted }]}>
                {bloc.mood.toUpperCase()}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      {/* ---------------- The Union ---------------- */}
      <Text style={styles.label}>THE UNION</Text>
      <Card>
        <Text style={styles.note}>
          Sewel consent is needed for laws that touch devolved policy. Denying it raises
          independence pressure and costs goodwill.
        </Text>
        {NATIONS.map(({ id, name }, index) => {
          const nation = devolution?.nations[id];
          if (!nation) return null;
          const strained = nation.independencePressure >= DEVOLUTION_PRESSURE_FLOOR;
          return (
            <View key={id} style={[styles.row, index > 0 && styles.rowBordered]}>
              <View style={styles.rowBody}>
                <View style={styles.rowHead}>
                  <Text style={styles.rowTitle}>{name}</Text>
                  <Chip
                    label={strained ? 'STRAINED' : pct(nation.independencePressure)}
                    tone={strained ? 'danger' : 'neutral'}
                  />
                </View>
                <Text style={styles.rowMeta}>
                  Satisfaction {pct(nation.satisfaction)} · independence pressure{' '}
                  {pct(nation.independencePressure)} · Sewel denials {nation.sewelDenials}
                </Text>
                <Meter
                  value={nation.independencePressure}
                  color={strained ? colors.danger : colors.warning}
                />
                <View style={styles.buttonRow}>
                  <Button
                    label="Deny Sewel consent"
                    variant="ghost"
                    compact
                    disabled={inPurdah}
                    onPress={() => dispatch({ type: 'DENY_SEWEL_CONSENT', nationId: id })}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </Card>

      {/* ---------------- Local government ---------------- */}
      <Text style={styles.label}>LOCAL GOVERNMENT</Text>
      <Card>
        <View style={styles.chipRow}>
          <Chip label={`${atRisk} COUNCILS AT RISK`} tone={atRisk > 0 ? 'warning' : 'success'} />
          <Chip label={`${failed} IN SECTION 114`} tone={failed > 0 ? 'danger' : 'neutral'} />
          <Chip label={`DELIVERY GAP ${pct(local?.deliveryGap ?? 0)}`} tone={(local?.deliveryGap ?? 0) >= DELIVERY_GAP_FLOOR ? 'warning' : 'neutral'} />
        </View>
        <Text style={[styles.note, { marginTop: spacing.sm }]}>
          Section 114 notices happen at {SECTION_114_STRESS}% stress. A grant costs £0.5bn;
          commissioners clear the notice but leave the stress behind.
        </Text>
        {authorities.slice(0, 6).map((authority, index) => (
          <View key={authority.id} style={[styles.row, index > 0 && styles.rowBordered]}>
            <View style={styles.rowHead}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {authority.name}
              </Text>
              <Chip
                label={authority.section114 ? 'SECTION 114' : pct(authority.stress)}
                tone={authority.section114 ? 'danger' : authority.stress >= 70 ? 'warning' : 'neutral'}
              />
            </View>
            <Meter
              value={authority.stress}
              color={authority.section114 ? colors.danger : colors.warning}
            />
            {(authority.section114 || authority.stress >= 55) && (
              <View style={styles.buttonRow}>
                <Button
                  label="Emergency grant"
                  variant="secondary"
                  compact
                  disabled={inPurdah}
                  onPress={() => dispatch({ type: 'EMERGENCY_GRANT', authorityId: authority.id })}
                />
                {authority.section114 && (
                  <View style={{ marginLeft: spacing.sm }}>
                    <Button
                      label="Send commissioners"
                      variant="ghost"
                      compact
                      disabled={inPurdah}
                      onPress={() => dispatch({ type: 'SEND_COMMISSIONERS', authorityId: authority.id })}
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        ))}
      </Card>

      {/* ---------------- Immigration ---------------- */}
      <Text style={styles.label}>IMMIGRATION & ASYLUM</Text>
      <Card>
        <View style={styles.statRow}>
          <StatTile
            label="Backlog"
            value={`${Math.round(immigration?.backlog ?? 0)}k`}
            tone={(immigration?.backlog ?? 0) >= BACKLOG_ALERT ? 'danger' : 'default'}
            hint={`alert ${BACKLOG_ALERT}k`}
          />
          <StatTile label="Arrivals" value={`${Math.round(immigration?.arrivalsThisYear ?? 0)}k`} hint="this year" />
          <StatTile label="Removals" value={`${Math.round(immigration?.removalsThisTerm ?? 0)}k`} hint="this term" />
        </View>
        <View style={[styles.rowHead, { marginTop: spacing.md }]}>
          <Text style={styles.rowMeta}>Caseworker capacity {pct(immigration?.caseworkerCapacity ?? 0)}</Text>
          <Text style={styles.rowMeta}>Accommodation {money(accommodationCost(immigration ?? { backlog: 0, arrivalsThisYear: 0, caseworkerCapacity: 0, removalsBlocked: false, removalsThisTerm: 0 }))}/mo</Text>
        </View>
        <Meter value={immigration?.caseworkerCapacity ?? 0} color={colors.accent} />
        <View style={styles.buttonRow}>
          {[50, 70, 90, 100].map((capacity) => (
            <Button
              key={capacity}
              label={`${capacity}%`}
              variant={immigration?.caseworkerCapacity === capacity ? 'secondary' : 'ghost'}
              compact
              disabled={inPurdah}
              onPress={() => dispatch({ type: 'SET_CASEWORKER_CAPACITY', capacity })}
            />
          ))}
        </View>
        <Text style={[styles.note, { marginTop: spacing.sm }]}>
          Backlog alert risk {pct(backlogAlertRisk(immigration ?? { backlog: 0, arrivalsThisYear: 0, caseworkerCapacity: 0, removalsBlocked: false, removalsThisTerm: 0 }) * 100)} · ceiling {BACKLOG_CEILING}k.
        </Text>
        <View style={styles.buttonRow}>
          <Button
            label={immigration?.removalsBlocked ? 'Lift removals injunction' : 'Block removals (injunction)'}
            variant="ghost"
            compact
            disabled={inPurdah}
            onPress={() => dispatch({ type: 'TOGGLE_REMOVALS_BLOCKED' })}
          />
          <View style={{ marginLeft: spacing.sm }}>
            <Button
              label="Order removal flight (£0.2bn)"
              variant="secondary"
              compact
              disabled={inPurdah || (immigration?.removalsBlocked ?? true)}
              onPress={() => dispatch({ type: 'REMOVAL_FLIGHT', count: 20 })}
            />
          </View>
        </View>
      </Card>

      {/* ---------------- Lobbying ---------------- */}
      <Text style={styles.label}>LOBBYING & COMMITTEES</Text>
      <Card>
        <View style={styles.chipRow}>
          <Chip
            label={lobbyReady ? 'LOBBYING READY' : `COOLDOWN ${lobbyCooldownLeft}m`}
            tone={lobbyReady ? 'success' : 'warning'}
          />
          <Chip label={`REVOLVING DOOR ${pct(revolvingDoorRisk(lobbying ?? { groups: [], committees: [], lastLobbyWeek: null, petitionsDebated: 0, revolvingDoors: 0, livePetition: 0 }) * 100)}`} tone="neutral" />
          <Chip label={`PETITION ${Math.round(lobbying?.livePetition ?? 0)}k/${PETITION_DEBATE_THRESHOLD}k`} tone={(lobbying?.livePetition ?? 0) >= PETITION_DEBATE_THRESHOLD ? 'warning' : 'neutral'} />
        </View>
        {(lobbying?.groups ?? []).map((group, index) => (
          <View key={group.id} style={[styles.row, index > 0 && styles.rowBordered]}>
            <View style={styles.rowHead}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {group.name}
              </Text>
              <Text style={styles.rowMeta}>{group.kind} · {Math.round(group.influence)}</Text>
            </View>
            <Meter value={group.influence} color={colors.accent} />
            <View style={styles.buttonRow}>
              <Button
                label="Court"
                variant="secondary"
                compact
                disabled={inPurdah || !lobbyReady}
                onPress={() => dispatch({ type: 'LOBBY_GROUP', groupId: group.id, mode: 'court' })}
              />
              <View style={{ marginLeft: spacing.sm }}>
                <Button
                  label="Snub"
                  variant="ghost"
                  compact
                  disabled={inPurdah || !lobbyReady}
                  onPress={() => dispatch({ type: 'LOBBY_GROUP', groupId: group.id, mode: 'snub' })}
                />
              </View>
            </View>
          </View>
        ))}
        <Text style={[styles.note, { marginTop: spacing.sm }]}>
          Hostile committees { (lobbying?.committees ?? []).filter((c) => c.hostility >= COMMITTEE_HOSTILITY_FLOOR).length } of{' '}
          {(lobbying?.committees ?? []).length} · petition pressure {pct(petitionPressure(lobbying ?? { groups: [], committees: [], lastLobbyWeek: null, petitionsDebated: 0, revolvingDoors: 0, livePetition: 0 }) * 100)}.
          Hostile committees delay bills by up to two months.
        </Text>
      </Card>

      {/* ---------------- The Bank ---------------- */}
      <Text style={styles.label}>THE BANK OF ENGLAND</Text>
      <Card>
        <View style={styles.statRow}>
          <StatTile label="Bank rate" value={`${(bank?.bankRate ?? 0).toFixed(2)}%`} />
          <StatTile
            label="Bank indep."
            value={pct(independenceReading(bank ?? { bankRate: 0, credibility: 0, pressure: 0, hawkishness: 0, lastReviewWeek: null }) * 100)}
            tone={(bank?.credibility ?? 0) < CREDIBILITY_PREMIUM_FLOOR ? 'danger' : 'success'}
          />
          <StatTile label="Pressure" value={bank?.pressure ?? 0} hint="this term" />
        </View>
        <Text style={[styles.note, { marginTop: spacing.sm }]}>
          Leaning on the Bank buys the rate you want but costs credibility; below{' '}
          {CREDIBILITY_PREMIUM_FLOOR} the market charges a premium. Committee balance{' '}
          {bank?.hawkishness ?? 0} (positive = hawks).
        </Text>
        <View style={styles.buttonRow}>
          <Button
            label="Lean on the Bank"
            variant="ghost"
            compact
            disabled={inPurdah}
            onPress={() => dispatch({ type: 'LEAN_ON_BANK' })}
          />
          <View style={{ marginLeft: spacing.sm }}>
            <Button
              label="Appoint hawk"
              variant="secondary"
              compact
              disabled={inPurdah}
              onPress={() => dispatch({ type: 'APPOINT_MPC_MEMBER', kind: 'hawk' })}
            />
          </View>
          <View style={{ marginLeft: spacing.sm }}>
            <Button
              label="Appoint dove"
              variant="secondary"
              compact
              disabled={inPurdah}
              onPress={() => dispatch({ type: 'APPOINT_MPC_MEMBER', kind: 'dove' })}
            />
          </View>
        </View>
      </Card>

      {/* ---------------- Standards ---------------- */}
      <Text style={styles.label}>STANDARDS IN PUBLIC LIFE</Text>
      <Card tone={investigations.length > 0 || coverUp ? 'danger' : 'default'}>
        <View style={styles.chipRow}>
          <Chip label={`STANDARDS RISK ${pct(ethics?.standardsRisk ?? 0)}`} tone={(ethics?.standardsRisk ?? 0) >= 50 ? 'danger' : 'neutral'} />
          <Chip label={`MEDIA HEAT ${pct(ethics?.mediaHeat ?? 0)}`} tone={(ethics?.mediaHeat ?? 0) >= 50 ? 'warning' : 'neutral'} />
          {coverUp && <Chip label="COVER-UP ACTIVE" tone="danger" />}
        </View>
        {investigations.length === 0 && !coverUp ? (
          <Text style={[styles.note, { marginTop: spacing.sm }]}>
            No live investigations. Sacking senior ministers can trigger one.
          </Text>
        ) : (
          <>
            {investigations.map((investigation, index) => (
              <View key={investigation.id} style={[styles.row, index > 0 && styles.rowBordered]}>
                <View style={styles.rowHead}>
                  <Text style={styles.rowTitle}>Investigation {index + 1}</Text>
                  <Chip label={`SEVERITY ${Math.round(investigation.severity)}`} tone={investigation.severity >= 40 ? 'danger' : 'warning'} />
                </View>
                <Text style={styles.rowMeta}>
                  Publishes in {investigation.weeksRemaining} month{investigation.weeksRemaining === 1 ? '' : 's'}.
                </Text>
                <View style={styles.buttonRow}>
                  <Button
                    label="Admit and apologise"
                    variant="secondary"
                    compact
                    onPress={() =>
                      dispatch({ type: 'ADMIT_INVESTIGATION', investigationId: investigation.id })
                    }
                  />
                  {!coverUp && (
                    <View style={{ marginLeft: spacing.sm }}>
                      <Button
                        label="Cover it up"
                        variant="danger"
                        compact
                        onPress={() => dispatch({ type: 'START_COVER_UP' })}
                      />
                    </View>
                  )}
                </View>
              </View>
            ))}
            {coverUp && (
              <>
                <Text style={[styles.note, { marginTop: spacing.sm }]}>
                  The cover-up suppresses findings, but if it is ever exposed the deferred damage
                  lands at once.
                </Text>
                <View style={styles.buttonRow}>
                  <Button
                    label="Come clean"
                    variant="ghost"
                    compact
                    onPress={() => dispatch({ type: 'END_COVER_UP' })}
                  />
                </View>
              </>
            )}
          </>
        )}
      </Card>
    </View>
  );
}

const styles = {
  label: {
    color: colors.accent,
    fontSize: font.tiny,
    fontWeight: '800' as const,
    letterSpacing: 1.2,
    marginTop: spacing.lg,
  },
  note: { color: colors.muted, fontSize: font.small, lineHeight: 18 },
  chipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
  statRow: { flexDirection: 'row' as const, marginTop: spacing.sm },
  row: { marginTop: spacing.sm, paddingTop: spacing.sm },
  electorateRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: spacing.sm },
  rowBordered: { borderTopWidth: 1, borderTopColor: colors.cardBorderLight },
  rowBody: { flex: 1 },
  blocSupport: { fontSize: font.h3, fontWeight: '700' as const, fontFamily: headingFontFamily },
  blocMood: { fontSize: font.tiny, fontWeight: '800' as const, letterSpacing: 0.8, marginTop: 2 },
  rowHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 3,
  },
  rowTitle: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '700' as const,
    flex: 1,
    marginRight: spacing.sm,
  },
  rowMeta: { color: colors.muted, fontSize: font.tiny, lineHeight: 16 },
  buttonRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, marginTop: spacing.sm },
};
