import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '../state';
import { colors, font, radius, spacing } from '../theme';
import { Button, Card, Chip, EffectChips, EmptyState, Meter, SectionTitle, Segmented, Sheet, StatTile } from '../components/ui';
import { BILL_POOL } from '../bills';
import { BILL_POOL_2 } from '../bills2';
import { BUDGET_PACKAGES } from '../budget';
import { TAX_YIELD_PER_POINT } from '../taxes';
import type { RootStackParamList } from '../types';
import type { Bill, Dossier, Effects } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Game'>;

type Tab = 'desk' | 'govern' | 'money' | 'politics' | 'world';
type MoneyTab = 'spending' | 'taxes';
type PoliticsTab = 'cabinet' | 'westminster' | 'press';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'desk', label: 'Red Box', icon: 'D' },
  { key: 'govern', label: 'Laws', icon: 'L' },
  { key: 'money', label: 'Money', icon: 'M' },
  { key: 'politics', label: 'Politics', icon: 'P' },
  { key: 'world', label: 'World', icon: 'W' },
];

/** Plain-English wording for how much the public cares about a tax. */
function angerLabel(weight: number): { text: string; tone: 'danger' | 'warning' | 'neutral' } {
  if (weight >= 1.8) return { text: 'Very high anger', tone: 'danger' };
  if (weight >= 1.2) return { text: 'High anger', tone: 'warning' };
  if (weight >= 0.7) return { text: 'Moderate anger', tone: 'neutral' };
  return { text: 'Low anger', tone: 'neutral' };
}

function budgetLabel(v: number): string {
  return v < 0 ? `-£${Math.abs(Math.round(v))}bn` : `£${Math.round(v)}bn`;
}

function money(v: number): string {
  return `£${Math.round(v)}bn`;
}

function dossierTone(d: Dossier): 'danger' | 'default' {
  return d.urgent ? 'danger' : 'default';
}

export default function GameScreen() {
  const { state, dispatch } = useGame();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>('desk');
  const [moneyTab, setMoneyTab] = useState<MoneyTab>('spending');
  const [politicsTab, setPoliticsTab] = useState<PoliticsTab>('cabinet');
  const [helpOpen, setHelpOpen] = useState(false);

  /* ---- weekly briefing: diff the log before/after advancing ---- */
  const previousLog = useRef<string[]>(state.log);
  const [briefing, setBriefing] = useState<string[] | null>(null);
  const awaitingTurn = useRef(false);

  useEffect(() => {
    if (!awaitingTurn.current) return;
    awaitingTurn.current = false;
    const before = previousLog.current;
    const grew = state.log.length - before.length;
    const fresh =
      grew > 0 ? state.log.slice(0, grew) : state.log.filter((line) => !before.includes(line));
    // Never stack a briefing on top of an election or game-over modal.
    setBriefing(state.gameOver || state.isElection ? null : fresh.slice(0, 8));
  }, [state.log, state.gameOver, state.isElection]);

  const advanceWeek = () => {
    previousLog.current = state.log;
    awaitingTurn.current = true;
    dispatch({ type: 'START_TURN' });
  };

  /* ---- derived data ---- */
  const player = state.player;
  const party = state.parties.find((p) => p.id === player?.partyId);
  const rankedParties = useMemo(() => [...state.parties].sort((a, b) => b.seats - a.seats), [state.parties]);

  const proposable = useMemo(() => {
    const inFlight = new Set(state.bills.map((b) => b.id));
    const passed = new Set(state.passedLaws);
    return [...BILL_POOL, ...BILL_POOL_2].filter((b) => !inFlight.has(b.id) && !passed.has(b.title));
  }, [state.bills, state.passedLaws]);

  const redBox = useMemo(
    () => [...state.redBox].sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.weeksRemaining - b.weeksRemaining),
    [state.redBox],
  );

  const threshold = state.stats.lettersThreshold || 15;
  const letters = state.stats.lettersOfNoConfidence;
  const revoltPct = Math.min(100, Math.round((letters / Math.max(1, threshold)) * 100));
  const urgentCount = state.redBox.filter((d) => d.urgent).length;
  const inPurdah = state.turnsUntilElection <= 6;

  const totalSpend = state.departments.reduce((sum, d) => sum + d.budget, 0);
  const revenueAssumption = 950;
  const headroom = Math.round(revenueAssumption - totalSpend);

  const fiscal = state as unknown as {
    fiscalDragRevenue?: number;
    fiscalDragIntensity?: string;
    thresholdFrozenTurns?: number;
    tradeDealStatus?: Record<string, { status?: string } | boolean>;
  };

  const activeDossier = state.redBox.find((d) => d.id === state.selectedDossierId) ?? null;

  /* ---- alerts ---- */
  const alerts: { label: string; tone: 'danger' | 'warning' | 'accent' }[] = [];
  if (urgentCount > 0) alerts.push({ label: `${urgentCount} urgent paper${urgentCount > 1 ? 's' : ''}`, tone: 'danger' });
  if (state.pmq) alerts.push({ label: 'PMQs waiting', tone: 'warning' });
  if (state.budgetDue) alerts.push({ label: state.fiscalEventKind === 'autumn' ? 'Autumn Statement due' : 'Budget due', tone: 'warning' });
  if (revoltPct >= 65) alerts.push({ label: `Leadership threat ${revoltPct}%`, tone: 'danger' });
  if (inPurdah) alerts.push({ label: 'Purdah in force', tone: 'accent' });
  if (state.foreignIssues.length > 0) alerts.push({ label: `${state.foreignIssues.length} diplomatic call${state.foreignIssues.length > 1 ? 's' : ''}`, tone: 'accent' });

  const restart = () => {
    dispatch({ type: 'NEW_GAME' });
    nav.navigate('Menu');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* ================= HEADER ================= */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.sm, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: font.tiny, letterSpacing: 1.4, fontWeight: '700' }}>
              10 DOWNING STREET
            </Text>
            <Text style={{ color: colors.text, fontSize: font.h2, fontWeight: '800' }} numberOfLines={1}>
              {player?.firstName} {player?.lastName}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: party?.color ?? colors.muted, marginRight: 6 }} />
              <Text style={{ color: colors.muted, fontSize: font.small }} numberOfLines={1}>
                {party ? party.abbreviation : '--'} | Week {state.week} | {state.turnsUntilElection}w to election
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="How to play"
            onPress={() => setHelpOpen(true)}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, borderWidth: 1, borderColor: colors.cardBorder }}
          >
            <Text style={{ color: colors.muted, fontWeight: '800' }}>?</Text>
          </Pressable>
          <Button label="Advance" onPress={advanceWeek} compact disabled={!!state.gameOver} />
        </View>

        {/* vitals */}
        <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
          <StatTile label="Approval" value={`${Math.round(state.metrics.approval)}%`} tone={state.metrics.approval >= 45 ? 'success' : 'danger'} />
          <StatTile label="Party unity" value={`${Math.round(state.metrics.partyConfidence)}%`} tone={state.metrics.partyConfidence >= 45 ? 'success' : 'danger'} />
          <StatTile label="Inflation" value={`${state.stats.cpiInflation}%`} tone={state.stats.cpiInflation <= 3 ? 'success' : 'warning'} />
          <StatTile label="Budget" value={budgetLabel(state.stats.budgetBalance)} tone={state.stats.budgetBalance < 0 ? 'danger' : 'success'} />
        </View>

        {/* alerts */}
        {alerts.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
            {alerts.map((a) => (
              <Chip key={a.label} label={a.label} tone={a.tone} />
            ))}
          </ScrollView>
        )}
      </View>

      {/* ================= CONTENT ================= */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'desk' && (
          <View>
            <SectionTitle title="Your Red Box" hint="Papers needing a decision. Ignored urgent items become scandals." />
            {redBox.length === 0 && <EmptyState title="Box cleared" body="Nothing awaiting signature. Advance the week to see what lands next." />}

            {redBox.map((d) => (
              <Pressable key={d.id} onPress={() => dispatch({ type: 'OPEN_DOSSIER', dossierId: d.id })}>
                <Card tone={dossierTone(d)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: d.urgent ? colors.danger : colors.accent, fontSize: font.tiny, fontWeight: '800', flex: 1 }} numberOfLines={1}>
                      {d.department.toUpperCase()}
                    </Text>
                    <Text style={{ color: d.urgent ? colors.danger : colors.muted, fontSize: font.tiny, fontWeight: '700' }}>
                      {d.urgent ? 'URGENT | ' : ''}{d.weeksRemaining}w left
                    </Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '700', marginTop: 4 }}>{d.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: font.small, lineHeight: 18, marginTop: 4 }} numberOfLines={2}>
                    {d.leadParagraph}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
                    <Text style={{ color: colors.accent, fontSize: font.small, fontWeight: '800' }}>Decide</Text>
                    <Text style={{ color: colors.muted, fontSize: font.tiny, marginLeft: 8 }}>
                      {d.choices.length} option{d.choices.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            ))}

            {!!state.lastOutcome && (
              <Card tone="success">
                <Text style={{ color: colors.success, fontSize: font.tiny, fontWeight: '800', letterSpacing: 1 }}>LAST DECISION</Text>
                <Text style={{ color: colors.text, fontSize: font.small, lineHeight: 19, marginTop: 4 }}>{state.lastOutcome}</Text>
              </Card>
            )}
          </View>
        )}

        {tab === 'govern' && (
          <View>
            <SectionTitle title="Legislative agenda" hint={inPurdah ? 'Purdah: no new bills until after polling day.' : 'Bills take several weeks to reach a division.'} />

            {state.bills.length > 0 && (
              <>
                <Text style={styles.label}>IN PARLIAMENT</Text>
                {state.bills.map((b: Bill) => (
                  <Card key={b.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: colors.accent, fontSize: font.tiny, fontWeight: '800', flex: 1 }} numberOfLines={1}>
                        {b.department.toUpperCase()}
                      </Text>
                      <Chip label={`${b.weeksToPass}w to division`} tone="accent" />
                    </View>
                    <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '700', marginTop: 2 }}>{b.title}</Text>
                    <Text style={{ color: colors.muted, fontSize: font.small, marginTop: 4 }}>
                      {b.fiscalCost < 0 ? `Raises ${money(-b.fiscalCost)}/yr` : `Costs ${money(b.fiscalCost)}/yr`} | rebellion risk {b.rebellionRisk}%
                    </Text>
                    <View style={{ marginTop: spacing.sm }}>
                      <Meter value={b.rebellionRisk} color={b.rebellionRisk > 40 ? colors.danger : colors.warning} />
                    </View>
                  </Card>
                ))}
              </>
            )}

            <Text style={[styles.label, { marginTop: spacing.lg }]}>PROPOSE NEW LEGISLATION</Text>
            {proposable.map((b) => (
              <Card key={b.id}>
                <Text style={{ color: colors.accent, fontSize: font.tiny, fontWeight: '800' }} numberOfLines={1}>
                  {b.department.toUpperCase()}
                </Text>
                <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '700', marginTop: 2 }}>{b.title}</Text>
                <Text style={{ color: colors.muted, fontSize: font.small, lineHeight: 18, marginTop: 4 }}>{b.description}</Text>
                <EffectChips effects={b.effects} max={5} />
                <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4 }}>
                  {b.fiscalCost < 0 ? `Raises ${money(-b.fiscalCost)}/yr` : `Costs ${money(b.fiscalCost)}/yr`} | rebellion risk {b.rebellionRisk}%
                </Text>
                <Button label="Introduce to Parliament" variant="secondary" compact disabled={inPurdah} onPress={() => dispatch({ type: 'PROPOSE_BILL', billId: b.id })} />
              </Card>
            ))}

            {state.passedLaws.length > 0 && (
              <>
                <Text style={[styles.label, { marginTop: spacing.lg }]}>ON THE STATUTE BOOK</Text>
                {state.passedLaws.map((title) => (
                  <Text key={title} style={{ color: colors.success, fontSize: font.body, marginTop: 6 }}>
                    {title}
                  </Text>
                ))}
              </>
            )}
          </View>
        )}

        {tab === 'money' && (
          <View>
            <SectionTitle title="HM Treasury" hint="Every pound spent or cut moves approval, services and the deficit." />
            <Segmented
              options={[
                { key: 'spending', label: 'Spending' },
                { key: 'taxes', label: 'Taxes' },
              ]}
              value={moneyTab}
              onChange={setMoneyTab}
            />

            {moneyTab === 'spending' && (
              <View>
                <Card tone={headroom < 0 ? 'danger' : 'success'}>
                  <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '800' }}>Total spend {money(totalSpend)}</Text>
                  <Text style={{ color: headroom < 0 ? colors.danger : colors.success, fontSize: font.small, fontWeight: '700', marginTop: 4 }}>
                    {headroom < 0 ? `${money(-headroom)} over plan` : `${money(headroom)} headroom`}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4 }}>
                    Planning assumption: {money(revenueAssumption)} of revenue. Each step costs or saves cash and shifts services.
                  </Text>
                </Card>

                {state.departments.map((d) => (
                  <Card key={d.id}>
                    <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '700' }}>{d.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>{d.desc}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
                      <Button label="-" variant="ghost" compact onPress={() => dispatch({ type: 'ADJUST_SPENDING', deptId: d.id, delta: -d.step })} />
                      <Text style={{ flex: 1, textAlign: 'center', color: colors.accent, fontSize: font.h2, fontWeight: '800' }}>
                        {money(d.budget)}
                      </Text>
                      <Button label="+" variant="ghost" compact onPress={() => dispatch({ type: 'ADJUST_SPENDING', deptId: d.id, delta: d.step })} />
                    </View>
                    <View style={{ marginTop: spacing.sm }}>
                      <Meter value={d.budget - d.min} max={Math.max(1, d.max - d.min)} />
                    </View>
                    <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4 }}>
                      Range {money(d.min)} to {money(d.max)} | each step {money(d.step)}
                    </Text>
                    <EffectChips effects={d.benefit} max={4} />
                  </Card>
                ))}
              </View>
            )}

            {moneyTab === 'taxes' && (
              <View>
                <Text style={[styles.hint, { marginTop: spacing.md }]}>
                  Raising a rate improves the public finances but costs you popularity.
                </Text>
                {state.taxes.map((t) => {
                  const anger = angerLabel(t.popularityWeight);
                  const yieldPerPoint = TAX_YIELD_PER_POINT[t.id] ?? 0;
                  return (
                    <Card key={t.id}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '700', flex: 1 }}>{t.name}</Text>
                        <Chip label={anger.text} tone={anger.tone} />
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
                        <Button label="-" variant="ghost" compact onPress={() => dispatch({ type: 'ADJUST_TAX', taxId: t.id, delta: -t.step })} />
                        <Text style={{ flex: 1, textAlign: 'center', color: colors.accent, fontSize: font.h2, fontWeight: '800' }}>{t.rate}%</Text>
                        <Button label="+" variant="ghost" compact onPress={() => dispatch({ type: 'ADJUST_TAX', taxId: t.id, delta: t.step })} />
                      </View>
                      <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4 }}>
                        Range {t.min}-{t.max}% | 1pt is about {money(yieldPerPoint)}/yr for the Exchequer
                      </Text>
                    </Card>
                  );
                })}

                <Card>
                  <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>Fiscal drag</Text>
                  <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4, lineHeight: 17 }}>
                    Frozen thresholds quietly raise {money(fiscal.fiscalDragRevenue ?? 0)}/yr as inflation pushes pay into higher bands.
                    Intensity: {fiscal.fiscalDragIntensity ?? 'low'} | frozen for {fiscal.thresholdFrozenTurns ?? 0} week(s).
                  </Text>
                </Card>
              </View>
            )}
          </View>
        )}

        {tab === 'politics' && (
          <View>
            <SectionTitle title="Westminster" hint="Keep your MPs and the press onside or you will not survive the year." />
            <Segmented
              options={[
                { key: 'cabinet', label: 'Cabinet' },
                { key: 'westminster', label: 'Commons' },
                { key: 'press', label: 'Press' },
              ]}
              value={politicsTab}
              onChange={setPoliticsTab}
            />

            {politicsTab === 'cabinet' && (
              <View>
                <Text style={[styles.hint, { marginTop: spacing.md }]}>Faction unrest {state.factionUnrest}%</Text>
                {state.cabinet.map((m) => (
                  <Card key={m.name}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '700' }}>{m.name}</Text>
                        <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>
                          {m.post} | {m.faction}
                        </Text>
                      </View>
                      <Pressable onPress={() => dispatch({ type: 'SACK_MINISTER', name: m.name })} hitSlop={8}>
                        <Text style={{ color: colors.danger, fontSize: font.small, fontWeight: '700' }}>Sack</Text>
                      </Pressable>
                    </View>
                    <View style={{ marginTop: spacing.sm }}>
                      <Text style={{ color: colors.muted, fontSize: font.tiny }}>Loyalty {m.loyalty}</Text>
                      <Meter value={m.loyalty} color={m.loyalty > 60 ? colors.success : colors.warning} />
                      <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 6 }}>Competence {m.competence}</Text>
                      <Meter value={m.competence} />
                    </View>
                  </Card>
                ))}

                {state.backbenchers.length > 0 && (
                  <>
                    <Text style={[styles.label, { marginTop: spacing.lg }]}>BACKBENCHERS TO PROMOTE</Text>
                    {state.backbenchers.map((b) => (
                      <Card key={b.name}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '700' }}>{b.name}</Text>
                            <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>
                              {b.faction} | loyalty {b.loyalty} | competence {b.competence}
                            </Text>
                          </View>
                          <Button label="Promote" variant="secondary" compact onPress={() => dispatch({ type: 'PICK_MINISTER', name: b.name })} />
                        </View>
                      </Card>
                    ))}
                  </>
                )}
              </View>
            )}

            {politicsTab === 'westminster' && (
              <View>
                <Card tone={revoltPct >= 65 ? 'danger' : 'default'}>
                  <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '800' }}>1922 Committee</Text>
                  <Text style={{ color: colors.muted, fontSize: font.small, marginTop: 4 }}>
                    Letters of no confidence {letters} / {threshold} | {revoltPct}% of the way to a challenge
                  </Text>
                  <View style={{ marginTop: spacing.sm }}>
                    <Meter value={revoltPct} color={revoltPct >= 65 ? colors.danger : colors.accent} height={8} />
                  </View>
                  <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 6 }}>
                    Hit the threshold and your own MPs will force a confidence vote.
                  </Text>
                  {!!state.committeeMood && (
                    <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 6 }}>
                      Backbench loyalty {state.committeeMood.averageLoyalty} | defection risk {state.committeeMood.consideringDefection} | would challenge {state.committeeMood.readyToChallenge}
                    </Text>
                  )}
                  {!!state.lastVote && (
                    <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 6 }}>
                      Last confidence ballot: {state.lastVote.votesFor} for, {state.lastVote.votesAgainst} against
                      {state.lastVote.resignedWithoutBallot ? ' (resigned without a ballot)' : ''}
                    </Text>
                  )}
                </Card>

                <Text style={[styles.label, { marginTop: spacing.lg }]}>HOUSE OF COMMONS | 650 SEATS</Text>
                {rankedParties.map((p) => (
                  <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color, marginRight: 10 }} />
                    <Text style={{ color: colors.text, flex: 1, fontSize: font.body }} numberOfLines={1}>{p.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: font.small, marginRight: 12 }}>{p.currentSupport}%</Text>
                    <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>{p.seats}</Text>
                  </View>
                ))}
              </View>
            )}

            {politicsTab === 'press' && (
              <View>
                <Text style={[styles.label, { marginTop: spacing.md }]}>FLEET STREET</Text>
                {state.headlines.map((h, i) => (
                  <Card key={`${h.paper}-${i}`}>
                    <Text style={{ color: colors.accent, fontSize: font.tiny, fontWeight: '800', letterSpacing: 0.8 }}>{h.paper.toUpperCase()}</Text>
                    <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '800', marginTop: 4, lineHeight: 22 }}>{h.title}</Text>
                  </Card>
                ))}

                <Text style={[styles.label, { marginTop: spacing.lg }]}>WEEK IN REVIEW</Text>
                {state.log.slice(0, 10).map((line, i) => (
                  <Text key={`log-${i}`} style={{ color: colors.muted, fontSize: font.small, lineHeight: 20, marginTop: 2 }}>
                    - {line}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {tab === 'world' && (
          <View>
            <SectionTitle title="Abroad and the economy" hint="Summits, trade and the numbers that decide elections." />

            {state.foreignIssues.length === 0 ? (
              <Card>
                <Text style={{ color: colors.muted, fontSize: font.small }}>No outstanding summits or calls.</Text>
              </Card>
            ) : (
              state.foreignIssues.map((f) => (
                <Card key={f.id}>
                  <Text style={{ color: colors.accent, fontSize: font.tiny, fontWeight: '800' }}>
                    {f.country.toUpperCase()} | {f.leader}
                  </Text>
                  <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '700', marginTop: 4 }}>{f.topic}</Text>
                  {f.options.map((o) => (
                    <Pressable
                      key={o.id}
                      onPress={() => dispatch({ type: 'RESOLVE_FOREIGN', issueId: f.id, optionId: o.id })}
                      style={{ borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm }}
                    >
                      <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>{o.label}</Text>
                      <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>{o.summary}</Text>
                      <EffectChips effects={o.effects} max={4} />
                    </Pressable>
                  ))}
                </Card>
              ))
            )}

            <Text style={[styles.label, { marginTop: spacing.lg }]}>THE NUMBERS</Text>
            <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
              <StatTile label="GDP growth" value={`${state.stats.gdpGrowth}%`} tone={state.stats.gdpGrowth >= 1 ? 'success' : 'danger'} />
              <StatTile label="Inflation" value={`${state.stats.cpiInflation}%`} tone={state.stats.cpiInflation <= 3 ? 'success' : 'danger'} />
              <StatTile label="10y gilts" value={`${state.stats.giltYield}%`} tone={state.stats.giltYield <= 4.5 ? 'success' : 'danger'} />
            </View>
            <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
              <StatTile label="Debt / GDP" value={`${state.stats.debtToGdp}%`} />
              <StatTile label="Unemployment" value={`${state.stats.unemployment}%`} />
              <StatTile label="Security" value={Math.round(state.metrics.security)} />
            </View>
            <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
              <StatTile label="NHS waiting" value={`${state.stats.nhsWaitingList}m`} />
              <StatTile
                label="NHS perf"
                value={Math.round(state.nhsPerformance ?? 0)}
                tone={(state.nhsPerformance ?? 0) >= 55 ? 'success' : 'danger'}
              />
              <StatTile label="Services" value={Math.round(state.metrics.publicServices)} />
            </View>
            <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
              <StatTile label="Migration" value={`${state.stats.netMigration}k`} />
              <StatTile label="Trade effect" value={`${state.tradeGdpImpact ?? 0}%`} />
              <StatTile label="Fiscal drag" value={`£${state.fiscalDragRevenue ?? 0}bn`} />
            </View>

            <Card>
              <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>Trade relationships</Text>
              {TRADE_ROWS.map((row) => {
                const raw = fiscal.tradeDealStatus ? fiscal.tradeDealStatus[row.key] : undefined;
                const status = raw && typeof raw === 'object' ? raw.status ?? 'none' : 'none';
                const tone: 'success' | 'accent' | 'warning' | 'neutral' =
                  status === 'ratified' ? 'success' : status === 'signed' ? 'accent' : status === 'negotiating' ? 'warning' : 'neutral';
                return (
                  <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <Text style={{ color: colors.text, flex: 1, fontSize: font.small }}>{row.label}</Text>
                    <Chip label={status} tone={tone} />
                  </View>
                );
              })}
            </Card>

            <Card>
              <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>Legacy</Text>
              <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4 }}>
                Score {state.legacyScore} | terms won {state.termsWon}
              </Text>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* ================= BOTTOM NAV ================= */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
          backgroundColor: colors.bgElevated,
          borderTopWidth: 1,
          borderTopColor: colors.cardBorder,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        }}
      >
        {TABS.map((t) => {
          const active = t.key === tab;
          const badge = t.key === 'desk' ? urgentCount : 0;
          return (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
              onPress={() => setTab(t.key)}
              style={{ flex: 1, alignItems: 'center' }}
            >
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? colors.accentSoft : 'transparent',
                }}
              >
                <Text style={{ color: active ? colors.accent : colors.muted, fontSize: font.tiny, fontWeight: '800' }}>{t.icon}</Text>
                {badge > 0 && (
                  <View style={{ position: 'absolute', right: -4, top: -4, backgroundColor: colors.danger, borderRadius: 8, minWidth: 15, height: 15, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{badge}</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: active ? colors.text : colors.muted, fontSize: 10, fontWeight: '700', marginTop: 2 }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* ================= DOSSIER SHEET ================= */}
      <Sheet
        visible={!!activeDossier}
        onClose={() => dispatch({ type: 'CLOSE_DOSSIER' })}
        eyebrow={activeDossier ? `${activeDossier.department.toUpperCase()} SUBMISSION` : undefined}
        title={activeDossier ? activeDossier.title : ''}
      >
        {activeDossier && (
          <View>
            <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700', lineHeight: 21 }}>{activeDossier.leadParagraph}</Text>
            <Text style={{ color: colors.muted, fontSize: font.small, lineHeight: 19, marginTop: spacing.sm }}>{activeDossier.body}</Text>
            <Text style={[styles.label, { marginTop: spacing.lg }]}>YOUR DECISION</Text>
            {activeDossier.choices.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => dispatch({ type: 'RESOLVE_DOSSIER', dossierId: activeDossier.id, choiceId: c.id })}
                style={{ borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, backgroundColor: colors.card }}
              >
                <Text style={{ color: colors.accent, fontSize: font.body, fontWeight: '700' }}>{c.label}</Text>
                <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>{c.summary}</Text>
                <EffectChips effects={c.effects as Effects} />
                <Text style={{ color: colors.muted, fontSize: font.tiny, fontStyle: 'italic', marginTop: 6 }}>Adviser: {c.advice}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Sheet>

      {/* ================= PMQ SHEET ================= */}
      <Sheet visible={!!state.pmq} onClose={() => dispatch({ type: 'DISMISS_PMQ' })} eyebrow="PRIME MINISTER'S QUESTIONS" title={state.pmq ? state.pmq.from : ''}>
        {state.pmq && (
          <View>
            <Text style={{ color: colors.text, fontSize: font.body, lineHeight: 22 }}>{state.pmq.question}</Text>
            <Text style={[styles.label, { marginTop: spacing.lg }]}>YOUR ANSWER</Text>
            {state.pmq.options.map((o) => (
              <Pressable
                key={o.id}
                onPress={() => dispatch({ type: 'ANSWER_PMQ', optionId: o.id })}
                style={{ borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, backgroundColor: colors.card }}
              >
                <Text style={{ color: colors.accent, fontSize: font.body, fontWeight: '700' }}>{o.label}</Text>
                <EffectChips effects={o.effects as Effects} max={4} />
              </Pressable>
            ))}
            <Button label="Skip this session" variant="ghost" onPress={() => dispatch({ type: 'DISMISS_PMQ' })} />
          </View>
        )}
      </Sheet>

      {/* ================= BUDGET SHEET ================= */}
      <Sheet
        visible={state.budgetDue}
        onClose={() => dispatch({ type: 'SKIP_BUDGET' })}
        eyebrow={state.fiscalEventKind === 'autumn' ? 'HM TREASURY | AUTUMN STATEMENT' : 'HM TREASURY | THE BUDGET'}
        title={state.fiscalEventKind === 'autumn' ? 'Lock in your tax plans' : 'Set the direction of the country'}
      >
        {state.fiscalEventKind === 'autumn' ? (
          <View>
            <Text style={{ color: colors.muted, fontSize: font.small, lineHeight: 19 }}>
              Your tax levers are already set on the Money tab. Confirming today locks them in until the Spring Budget.
            </Text>
            <Button label="Deliver Autumn Statement" onPress={() => dispatch({ type: 'SET_AUTUMN_TAXES' })} />
            <Button label="Defer" variant="ghost" onPress={() => dispatch({ type: 'SKIP_BUDGET' })} />
          </View>
        ) : (
          <View>
            <Text style={{ color: colors.muted, fontSize: font.small, lineHeight: 19 }}>
              Choose the package your Chancellor delivers to the Commons.
            </Text>
            {BUDGET_PACKAGES.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => dispatch({ type: 'DELIVER_BUDGET', packageId: b.id })}
                style={{ borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, backgroundColor: colors.card }}
              >
                <Text style={{ color: colors.accent, fontSize: font.body, fontWeight: '700' }}>{b.title}</Text>
                <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>{b.description}</Text>
                <EffectChips effects={b.effects as Effects} max={5} />
              </Pressable>
            ))}
            <Button label="Defer Budget" variant="ghost" onPress={() => dispatch({ type: 'SKIP_BUDGET' })} />
          </View>
        )}
      </Sheet>

      {/* ================= WEEKLY BRIEFING ================= */}
      <Sheet visible={briefing !== null} onClose={() => setBriefing(null)} eyebrow={`WEEK ${state.week} BRIEFING`} title="What happened">
        <View>
          {(briefing ? briefing : []).length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: font.small, lineHeight: 19 }}>
              A quiet week. The papers kept to speculation and the whips kept counting.
            </Text>
          ) : (
            (briefing ? briefing : []).map((line, i) => (
              <View key={`brief-${i}`} style={{ flexDirection: 'row', marginTop: 8 }}>
                <Text style={{ color: colors.accent, marginRight: 8 }}>-</Text>
                <Text style={{ color: colors.text, flex: 1, fontSize: font.small, lineHeight: 19 }}>{line}</Text>
              </View>
            ))
          )}
          {!!state.lastOutcome && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={styles.label}>LAST DECISION</Text>
              <Text style={{ color: colors.muted, fontSize: font.small, lineHeight: 19 }}>{state.lastOutcome}</Text>
            </View>
          )}
          <Button label="Back to the desk" onPress={() => setBriefing(null)} />
        </View>
      </Sheet>

      {/* ================= HELP ================= */}
      <Sheet visible={helpOpen} onClose={() => setHelpOpen(false)} eyebrow="HOW TO PLAY" title="Running the country">
        <View>
          {HELP_ROWS.map((row) => (
            <View key={row.title} style={{ marginTop: spacing.md }}>
              <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '800' }}>{row.title}</Text>
              <Text style={{ color: colors.muted, fontSize: font.small, lineHeight: 19, marginTop: 2 }}>{row.body}</Text>
            </View>
          ))}
          <Button label="Got it" onPress={() => setHelpOpen(false)} />
        </View>
      </Sheet>

      {/* ================= MINISTER PICKER ================= */}
      <Sheet visible={!!state.ministerPicker} onClose={() => dispatch({ type: 'CANCEL_APPOINT' })} eyebrow="CABINET PROMOTION" title={state.ministerPicker ? state.ministerPicker : ''}>
        <View>
          <Text style={{ color: colors.muted, fontSize: font.small }}>Choose the post for this appointment.</Text>
          {MINISTER_POSTS.map((post) => (
            <Pressable
              key={post}
              onPress={() => dispatch({ type: 'CONFIRM_APPOINT', post })}
              style={{ borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, backgroundColor: colors.card }}
            >
              <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>{post}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>

      {/* ================= ELECTION ================= */}
      <Modal visible={state.isElection && !state.gameOver} transparent animationType="fade">
        <View style={styles.centerBackdrop}>
          <View style={styles.centerCard}>
            <Text style={{ color: colors.accent, fontSize: font.h2, fontWeight: '800', textAlign: 'center' }}>GENERAL ELECTION</Text>
            <Text style={{ color: colors.muted, fontSize: font.small, textAlign: 'center', marginTop: 4 }}>
              Terms won {state.termsWon} | legacy {state.legacyScore}
            </Text>
            <View style={{ marginTop: spacing.md }}>
              {rankedParties.map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color, marginRight: 10 }} />
                  <Text style={{ color: colors.text, flex: 1, fontSize: font.body }}>{p.name}</Text>
                  <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>{p.seats}</Text>
                </View>
              ))}
            </View>
            <Button label="Continue governing" onPress={() => dispatch({ type: 'DISMISS_ELECTION' })} />
          </View>
        </View>
      </Modal>

      {/* ================= GAME OVER ================= */}
      <Modal visible={!!state.gameOver} transparent animationType="fade">
        <View style={styles.centerBackdrop}>
          <View style={[styles.centerCard, { borderColor: colors.danger, borderWidth: 1 }]}>
            <Text style={{ color: colors.danger, fontSize: font.h2, fontWeight: '800', textAlign: 'center' }}>PREMIERSHIP OVER</Text>
            <Text style={{ color: colors.text, fontSize: font.body, textAlign: 'center', marginTop: spacing.md, lineHeight: 21 }}>
              {state.gameOver}
            </Text>
            <Text style={{ color: colors.muted, fontSize: font.small, textAlign: 'center', marginTop: spacing.sm }}>
              Final legacy score {state.legacyScore}.
            </Text>
            <Button label="Return to main menu" onPress={restart} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const TRADE_ROWS: { key: string; label: string }[] = [
  { key: 'euTradeDeal', label: 'European Union' },
  { key: 'usaTradeDeal', label: 'United States' },
  { key: 'chinaTradeDeal', label: 'China' },
  { key: 'indiaTradeDeal', label: 'India' },
  { key: 'cpTradeDeal', label: 'Commonwealth' },
];

const MINISTER_POSTS = [
  'Chancellor of the Exchequer',
  'Home Secretary',
  'Health Secretary',
  'Foreign Secretary',
  'Defence Secretary',
  'Education Secretary',
  'Minister of State',
];

const HELP_ROWS: { title: string; body: string }[] = [
  { title: 'Advance', body: 'Moves one week. Anything urgent left undecided becomes a scandal and costs you approval.' },
  { title: 'Red Box', body: 'Your inbox. Tap a paper to see each option and its likely effect before you decide.' },
  { title: 'Laws', body: 'Introduce bills. They take weeks to reach a division, and high rebellion risk means your own MPs may sink them.' },
  { title: 'Money', body: 'Set department budgets and tax rates. Spending buys services and approval but widens the deficit.' },
  { title: 'Politics', body: 'Watch the 1922 letters meter. Reach the threshold and you face a confidence vote among your own MPs.' },
  { title: 'World', body: 'Handle summits and keep an eye on growth, inflation, gilts and debt.' },
  { title: 'Elections', body: 'Every term ends in a general election. Seats come from regional support, not national polls alone.' },
];

const styles = {
  label: { color: colors.muted, fontSize: font.tiny, fontWeight: '800' as const, letterSpacing: 1 },
  hint: { color: colors.muted, fontSize: font.small, lineHeight: 19 },
  centerBackdrop: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(2,6,16,0.88)',
    padding: spacing.xl,
  },
  centerCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    padding: spacing.xl,
    width: '100%' as const,
  },
};
