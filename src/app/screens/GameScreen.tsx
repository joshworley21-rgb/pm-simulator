import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowRight,
  BookOpenText,
  BriefcaseBusiness,
  CircleQuestionMark,
  Earth,
  Files,
  Flag,
  Landmark,
  Megaphone,
  UsersRound,
  Vote,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useGame } from '../state';
import { DossierDeck } from '../components/redbox/DossierDeck';
import { DossierMemo } from '../components/redbox/DossierMemo';
import { colors, font, headingFontFamily, fileFontFamily, radius, spacing } from '../theme';
import { Button, Card, Chip, EffectChips, Meter, SectionTitle, Sheet } from '../components/ui';
import { FUEL_DUTY_FREEZE_COST, STAMP_DUTY_RELIEF_COST } from '../budget';
import { BILL_POOL } from '../bills';
import { BILL_POOL_2 } from '../bills2';
import { evaluatePledges } from '../pledges';
import { PURDAH_TURNS } from '../calendar';
import { isCabinetMeetingDue } from '../cabinetMeeting';
import { backbenchBody } from '../westminster';
import { MonthPreflightSheet } from '../components/game/MonthPreflightSheet';
import { FirstMonthChecklist } from '../components/game/FirstMonthChecklist';
import { DIVISION_SLOTS_PER_SESSION } from '../parliament';
import { getTraitDetails } from '../backgrounds';
import { ElectionMap } from '../components/ElectionMap';
import RedBoxScreen from './RedBoxScreen';
import CabinetRoomScreen from './CabinetRoomScreen';
import DivisionLobbyScreen from './DivisionLobbyScreen';
import PressRoomScreen from './PressRoomScreen';
import { BudgetWorkbench } from '../components/BudgetWorkbench';
import MoneyTab from '../components/game/MoneyTab';
import WorldTab from '../components/game/WorldTab';
import NationTab from '../components/game/NationTab';
import ElectionNightModal from '../components/election/ElectionNightModal';
import type { RootStackParamList } from '../types';
import type { Bill, Effects } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Game'>;

type Tab = 'record' | 'papers' | 'divisions' | 'office';
type OfficeSection = 'cabinet' | 'treasury' | 'nation' | 'world' | 'press';

const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'record', label: 'Record', icon: BookOpenText },
  { key: 'papers', label: 'Papers', icon: Files },
  { key: 'divisions', label: 'Divisions', icon: Vote },
  { key: 'office', label: 'Office', icon: BriefcaseBusiness },
];

const OFFICE_SECTIONS: { key: OfficeSection; label: string; icon: LucideIcon }[] = [
  { key: 'cabinet', label: 'Cabinet', icon: UsersRound },
  { key: 'treasury', label: 'Treasury', icon: Landmark },
  { key: 'nation', label: 'Nation', icon: Flag },
  { key: 'world', label: 'World', icon: Earth },
  { key: 'press', label: 'Press', icon: Megaphone },
];

function money(v: number): string {
  return `£${Math.round(v)}bn`;
}

function months(v: number): string {
  return `${Math.max(0, v)} month${Math.max(0, v) === 1 ? '' : 's'}`;
}

export default function GameScreen() {
  const { state, dispatch } = useGame();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>('record');
  const [officeSection, setOfficeSection] = useState<OfficeSection>('cabinet');
  const [helpOpen, setHelpOpen] = useState(false);
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);

  /* ---- weekly briefing: diff the log before/after advancing ---- */
  const contentScroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const previousLog = useRef<string[]>(state.log);
  const [briefing, setBriefing] = useState<string[] | null>(null);
  const [showBriefing, setShowBriefing] = useState(true);
  const awaitingTurn = useRef(false);

  useEffect(() => {
    if (!awaitingTurn.current) return;
    awaitingTurn.current = false;
    const before = previousLog.current;
    const grew = state.log.length - before.length;
    const fresh =
      grew > 0 ? state.log.slice(0, grew) : state.log.filter((line) => !before.includes(line));
    // Never stack a briefing on top of an election or game-over modal.
    setBriefing(state.gameOver || state.isElection || !showBriefing ? null : fresh.slice(0, 8));
  }, [state.log, state.gameOver, state.isElection, showBriefing]);

  useEffect(() => {
    contentScroll.current?.scrollTo({ y: 0, animated: false });
  }, [tab, officeSection]);

  const advanceWeek = () => {
    previousLog.current = state.log;
    awaitingTurn.current = true;
    dispatch({ type: 'START_TURN' });
  };

  /* ---- derived data ---- */
  const player = state.player;
  const party = state.parties.find((p) => p.id === player?.partyId);
  const rankedParties = useMemo(() => [...state.parties].sort((a, b) => b.seats - a.seats), [state.parties]);
  const ownSeats = party ? party.seats : 0;
  const partnerSeats = state.parties.find((p) => p.id === state.supplyPartnerId)?.seats ?? 0;
  const workingMajority = ownSeats + partnerSeats;
  const majorityDelta = workingMajority - 326;
  const backbench = backbenchBody(party);

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
  // Single source of truth: same constant the engine's inPurdah() uses.
  const inPurdah = state.turnsUntilElection <= PURDAH_TURNS;
  const lastLostByElection = [...(state.byElections ?? [])].reverse().find((b) => !b.held);
  const byElectionPending =
    !!lastLostByElection &&
    state.week - lastLostByElection.week <= 8 &&
    (state.byElectionResponseWeek ?? 0) < lastLostByElection.week;
  // Commons time is a resource: every bill in progress holds a division slot.
  const orderPaperFull = state.bills.length >= DIVISION_SLOTS_PER_SESSION;

  /** Lets a Red Box urgent briefing jump to the surface that resolves it. */
  const handleRedBoxNavigate = (target: string, subTab?: string) => {
    if (target === 'desk' || target === 'record') setTab('record');
    else if (target === 'govern' || target === 'papers') setTab('papers');
    else if (target === 'politics' && subTab === 'westminster') setTab('divisions');
    else if (target === 'politics') {
      setTab('office');
      setOfficeSection(subTab === 'press' ? 'press' : 'cabinet');
    } else if (target === 'money') {
      setTab('office');
      setOfficeSection('treasury');
    } else if (target === 'nation' || target === 'world') {
      setTab('office');
      setOfficeSection(target);
    }
  };
  const traitDetails = useMemo(() => getTraitDetails(player?.background), [player?.background]);

  const activeDossier = state.redBox.find((d) => d.id === state.selectedDossierId) ?? null;
  const dossierIndex = activeDossier ? redBox.findIndex((d) => d.id === activeDossier.id) + 1 : 0;

  /* ---- alerts ---- */
  const alerts: {
    label: string;
    tone: 'danger' | 'warning' | 'accent';
    onPress?: () => void;
  }[] = [];
  if (urgentCount > 0) {
    alerts.push({
      label: `${urgentCount} urgent submission${urgentCount > 1 ? 's' : ''}`,
      tone: 'danger',
      onPress: () => setTab('record'),
    });
  }
  if (state.pmq) alerts.push({ label: 'PMQs waiting', tone: 'warning' });
  if (isCabinetMeetingDue(state)) {
    alerts.push({
      label: 'Cabinet meeting due',
      tone: 'warning',
      onPress: () => {
        setTab('office');
        setOfficeSection('cabinet');
      },
    });
  }
  if (state.budgetDue) alerts.push({ label: state.fiscalEventKind === 'autumn' ? 'Autumn Statement due' : 'Budget due', tone: 'warning' });
  if (revoltPct >= 65) {
    alerts.push({
      label: `Leadership threat ${revoltPct}%`,
      tone: 'danger',
      onPress: () => setTab('divisions'),
    });
  }
  if (inPurdah) alerts.push({ label: 'Purdah in force', tone: 'accent' });
  if (state.foreignIssues.length > 0) {
    alerts.push({
      label: `${state.foreignIssues.length} diplomatic call${state.foreignIssues.length > 1 ? 's' : ''}`,
      tone: 'accent',
      onPress: () => {
        setTab('office');
        setOfficeSection('world');
      },
    });
  }
  const ethicsOpen = state.ethics?.activeInvestigations.length ?? 0;
  if (ethicsOpen > 0) {
    alerts.push({
      label: `${ethicsOpen} ethics investigation${ethicsOpen > 1 ? 's' : ''}`,
      tone: 'danger',
      onPress: () => {
        setTab('office');
        setOfficeSection('nation');
      },
    });
  }

  const restart = () => {
    dispatch({ type: 'NEW_GAME' });
    nav.navigate('Menu');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* ================= HEADER ================= */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerEyebrow}>OFFICIAL RECORD · VOL. 01</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="How to play"
            onPress={() => setHelpOpen(true)}
            hitSlop={6}
            style={styles.helpButton}
          >
            <CircleQuestionMark size={22} color={colors.muted} strokeWidth={1.8} />
          </Pressable>
        </View>
        <View style={styles.headerIdentity}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.headerName} numberOfLines={1}>
                {player?.firstName} {player?.lastName}
              </Text>
              {traitDetails && (
                <View style={{ marginLeft: spacing.xs }}>
                  <Chip label={traitDetails.badge} tone="accent" />
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: party?.color ?? colors.muted, marginRight: 6 }} />
              <Text style={styles.headerMeta} numberOfLines={1}>
                {party ? party.abbreviation : '--'} · Month {state.week} · {state.turnsUntilElection}m to election
              </Text>
            </View>
          </View>
          <Button
            label="Next month"
            onPress={() => setMonthSheetOpen(true)}
            compact
            disabled={!!state.gameOver}
            testID="advance-week"
          />
        </View>

        {/* alerts — the only status that belongs on every tab; full vitals live
            on the desk tab ("State of the Nation") to avoid duplication. */}
        {alerts.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
            {alerts.map((a) => (
              <Chip key={a.label} label={a.label} tone={a.tone} onPress={a.onPress} />
            ))}
          </ScrollView>
        )}
      </View>

      {/* ================= CONTENT ================= */}
      <ScrollView
        ref={contentScroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {briefing && briefing.length > 0 && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: colors.accent, fontSize: font.tiny, fontWeight: '800', flex: 1 }}>
                MONTH {state.week} BRIEFING
              </Text>
              <Pressable onPress={() => setShowBriefing(false)} hitSlop={8} style={{ marginRight: 14 }}>
                <Text style={{ color: colors.muted, fontSize: font.tiny, fontWeight: '700' }}>Don't show again</Text>
              </Pressable>
              <Pressable onPress={() => setBriefing(null)} hitSlop={8} testID="briefing-dismiss">
                <Text style={{ color: colors.accent, fontSize: font.small, fontWeight: '800' }}>Dismiss</Text>
              </Pressable>
            </View>
            {briefing.map((line, i) => (
              <View key={`brief-${i}`} style={{ flexDirection: 'row', marginTop: 6 }}>
                <Text style={{ color: colors.accent, marginRight: 8 }}>-</Text>
                <Text style={{ color: colors.text, flex: 1, fontSize: font.small, lineHeight: 18 }}>{line}</Text>
              </View>
            ))}
            {!!state.lastOutcome && (
              <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: spacing.sm, lineHeight: 17 }}>
                Last decision: {state.lastOutcome}
              </Text>
            )}
          </Card>
        )}

        {tab === 'record' && (
          <View>
            <View style={styles.recordFolio}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recordFolioLabel}>OFFICIAL RECORD · FOLIO {String(state.week).padStart(2, '0')}</Text>
                <Text style={styles.recordFolioSub}>Proceedings and papers before the House</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open papers"
                onPress={() => setTab('papers')}
                testID="record-index"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.recordIndex}>INDEX</Text>
                  <ArrowRight size={15} color={colors.accent} strokeWidth={2} />
                </View>
              </Pressable>
            </View>

            <FirstMonthChecklist
              onOpenPapers={() => setTab('record')}
              onOpenCabinet={() => {
                setTab('office');
                setOfficeSection('cabinet');
              }}
              onAdvance={() => setMonthSheetOpen(true)}
            />

            {/* Dashboard: triad, fiscal watch and urgent briefings. Embedded so it
                shares GameScreen's scroll container instead of nesting another. */}
            <RedBoxScreen embedded onNavigate={handleRedBoxNavigate} />

            <SectionTitle title="Papers on your desk" hint="Swipe left to shelve, right to open. Ignored urgent papers become scandals." />
            <DossierDeck
              dossiers={redBox}
              onOpen={(dossierId) => dispatch({ type: 'OPEN_DOSSIER', dossierId })}
            />

            {!!state.lastOutcome && (
              <Card tone="success">
                <Text style={{ color: colors.success, fontSize: font.tiny, fontWeight: '800', letterSpacing: 1 }}>LAST DECISION</Text>
                <Text style={{ color: colors.text, fontSize: font.small, lineHeight: 19, marginTop: 4 }}>{state.lastOutcome}</Text>
              </Card>
            )}
          </View>
        )}

        {tab === 'papers' && (
          <View>
            <SectionTitle title="Legislative agenda" hint={inPurdah ? 'Purdah: no new bills until after polling day.' : 'Bills take several months to reach a division.'} />

            {state.bills.length > 0 && (
              <>
                <Text style={styles.label}>IN PARLIAMENT</Text>
                {state.bills.map((b: Bill) => (
                  <Card key={b.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: colors.accent, fontSize: font.tiny, fontWeight: '800', flex: 1 }} numberOfLines={1}>
                        {b.department.toUpperCase()}
                      </Text>
                      {b.whipLevel && (
                        <View style={{ marginRight: 6 }}>
                          <Chip
                            label={b.whipLevel === 'three-line' ? 'Three-Line Whip' : b.whipLevel === 'free-vote' ? 'Free Vote' : 'Two-Line Whip'}
                            tone={b.whipLevel === 'three-line' ? 'danger' : b.whipLevel === 'free-vote' ? 'neutral' : 'accent'}
                          />
                        </View>
                      )}
                      <Chip label={`${b.weeksToPass}m to division`} tone="accent" />
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

            {/* Commons time: the Order Paper has fixed division slots. */}
            <View style={[styles.orderPaperRow, { marginTop: spacing.lg }]}>
              <Chip
                label={`ORDER PAPER · ${state.bills.length} OF ${DIVISION_SLOTS_PER_SESSION} SLOTS`}
                tone={orderPaperFull ? 'danger' : 'neutral'}
              />
              {orderPaperFull && (
                <Text style={styles.orderPaperNote}>
                  Commons time is full — a bill must fall or pass before another is tabled.
                </Text>
              )}
            </View>
            <Text style={styles.label}>PROPOSE NEW LEGISLATION</Text>
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
                <View style={{ flexDirection: 'row', marginTop: spacing.sm, flexWrap: 'wrap' }}>
                  <View style={{ marginRight: spacing.sm, marginBottom: 4 }}>
                    <Button label="Two-Line Whip" variant="secondary" compact disabled={inPurdah || orderPaperFull} onPress={() => dispatch({ type: 'PROPOSE_BILL', billId: b.id, whipLevel: 'two-line' })} testID={`propose-${b.id}-two-line`} />
                  </View>
                  <View style={{ marginRight: spacing.sm, marginBottom: 4 }}>
                    <Button label="Three-Line Whip" compact disabled={inPurdah || orderPaperFull} onPress={() => dispatch({ type: 'PROPOSE_BILL', billId: b.id, whipLevel: 'three-line' })} testID={`propose-${b.id}-three-line`} />
                  </View>
                  <View style={{ marginBottom: 4 }}>
                    <Button label="Free Vote" variant="ghost" compact disabled={inPurdah || orderPaperFull} onPress={() => dispatch({ type: 'PROPOSE_BILL', billId: b.id, whipLevel: 'free-vote' })} testID={`propose-${b.id}-free-vote`} />
                  </View>
                </View>
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



        {tab === 'divisions' && (
          <View>
            <SectionTitle title="The House" hint="The order paper, confidence of the House and the numbers behind each vote." />
      <Card>
        <View style={styles.confidenceHeading}>
          <Text style={styles.confidenceTitle} numberOfLines={1}>Confidence of the House</Text>
          <Text style={styles.confidenceFolio} numberOfLines={1}>COMMONS</Text>
        </View>
        <Text style={{ color: colors.text, fontSize: font.small, marginTop: 5, lineHeight: 18 }}>
          Working majority {majorityDelta >= 0 ? `+${majorityDelta}` : majorityDelta} ({workingMajority} seats
          {partnerSeats > 0 ? `, including ${partnerSeats} from the supply partner` : ''}).
        </Text>
        {state.oppositionMotion ? (
          <Text style={{ color: colors.danger, fontSize: font.tiny, marginTop: 5, fontWeight: '700' }}>
            Opposition motion of no confidence: division in {months(state.oppositionMotion.scheduledWeek - state.week)}.
          </Text>
        ) : (
          <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 5 }}>No motion of no confidence has been tabled.</Text>
        )}
      </Card>
<View>
                {/* Division Lobby: majority, whips and motions. Embedded so it shares
                    GameScreen's scroll container instead of nesting another. */}
                <DivisionLobbyScreen embedded />

                {byElectionPending && lastLostByElection && (
                  <Card tone="danger">
                    <Text style={{ color: colors.danger, fontSize: font.tiny, fontWeight: '800', letterSpacing: 1 }}>
                      BY-ELECTION POST-MORTEM
                    </Text>
                    <Text style={{ color: colors.text, fontSize: font.small, marginTop: 4, lineHeight: 18 }}>
                      The government lost {lastLostByElection.regionId.replace(/-/g, ' ')}. Respond in the country
                      before the loss settles in.
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm }}>
                      <Button
                        label="Visit the seat (£1bn)"
                        variant="secondary"
                        compact
                        disabled={inPurdah}
                        onPress={() => dispatch({ type: 'BY_ELECTION_RESPONSE', mode: 'visit' })}
                      />
                      <View style={{ marginLeft: spacing.sm }}>
                        <Button
                          label="Defend with ministers"
                          variant="ghost"
                          compact
                          disabled={inPurdah}
                          onPress={() => dispatch({ type: 'BY_ELECTION_RESPONSE', mode: 'defend' })}
                        />
                      </View>
                    </View>
                  </Card>
                )}

                {!!state.oppositionMotion && (
                  <Card tone="danger">
                    <Text style={{ color: colors.danger, fontSize: font.tiny, fontWeight: '800', letterSpacing: 1 }}>
                      MOTION OF NO CONFIDENCE
                    </Text>
                    <Text style={{ color: colors.text, fontSize: font.small, marginTop: 4, lineHeight: 18 }}>
                      Tabled by {state.parties.find((p) => p.id === state.oppositionMotion?.sponsorPartyId)?.name ?? 'the opposition'}.
                      Division in {months(state.oppositionMotion.scheduledWeek - state.week)}.
                    </Text>
                  </Card>
                )}
                <Card tone={revoltPct >= 65 ? 'danger' : 'default'}>
                  <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '800' }}>{backbench.full}</Text>
                  <Text style={{ color: colors.muted, fontSize: font.small, marginTop: 4 }}>
                    {backbench.pressureLabel} {letters} / {threshold} | {revoltPct}% of the way to a challenge
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

                {ownSeats < 326 && (
                  <>
                    <Text style={[styles.label, { marginTop: spacing.lg }]}>CONFIDENCE AND SUPPLY</Text>
                    <Card tone="danger">
                      <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>
                        You are {326 - ownSeats} seats short of a majority
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4, lineHeight: 17 }}>
                        Without a deal the opposition can move a confidence motion at any time. A partner
                        votes with you on money and confidence, at a price.
                      </Text>
                    </Card>
                    {!state.supplyPartnerId &&
                      state.parties
                        .filter((p) => p.id !== player?.partyId)
                        .sort((a, b) => b.seats - a.seats)
                        .map((p) => {
                          const rel = state.relations.find((r) => r.from === player?.partyId && r.to === p.id)?.score ?? -50;
                          const willing = Math.min(100, Math.max(0, 50 + rel / 2));
                          const rate = willing < 40 ? 0.04 : 0.02;
                          const cost = Math.min(12, Math.round(p.seats * rate * 10) / 10);
                          const canGovern = ownSeats + p.seats >= 326;
                          return (
                            <Card key={p.id}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color, marginRight: 8 }} />
                                <Text style={{ color: colors.text, flex: 1, fontSize: font.body, fontWeight: '700' }}>{p.name}</Text>
                                <Text style={{ color: colors.muted, fontSize: font.tiny }}>{p.seats} seats</Text>
                              </View>
                              <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4 }}>
                                Wants £{cost}bn a year | willingness {Math.round(willing)}
                                {canGovern ? '' : ' | still short of a majority'}
                              </Text>
                              <Button
                                label="Negotiate confidence and supply"
                                variant="secondary"
                                compact
                                disabled={!canGovern || willing < 40}
                                onPress={() => dispatch({ type: 'NEGOTIATE_SUPPLY', partyId: p.id })}
                              />
                              {p.seats >= 40 && (
                                <Button
                                  label="Invite into coalition"
                                  variant="primary"
                                  compact
                                  disabled={!canGovern}
                                  onPress={() => dispatch({ type: 'FORM_COALITION', partyId: p.id })}
                                />
                              )}
                            </Card>
                          );
                        })}
                  </>
                )}

                <Text style={[styles.label, { marginTop: spacing.lg }]}>VOTER BLOCS</Text>
                {(state.blocs ?? []).map((b) => (
                  <View
                    key={b.id}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}
                  >
                    <Text style={{ color: colors.text, flex: 1, fontSize: font.small }}>{b.name}</Text>
                    <Text style={{ color: colors.faint, fontSize: font.tiny, marginRight: 8 }}>
                      {b.seats} seats | {Math.round(b.weight * 100)}%
                    </Text>
                    <Text style={{ color: b.support >= 45 ? colors.success : colors.danger, fontSize: font.body, fontWeight: '700' }}>
                      {b.support}
                    </Text>
                  </View>
                ))}

                <Text style={[styles.label, { marginTop: spacing.lg }]}>HOUSE OF COMMONS | 650 SEATS</Text>
                {rankedParties.map((p) => (
                  <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color, marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: font.body }} numberOfLines={1}>{p.name}</Text>
                      {p.leaderPersona && (
                        <Text style={{ color: colors.faint, fontSize: font.tiny }}>{p.leader} • {p.leaderPersona}</Text>
                      )}
                    </View>
                    <Text style={{ color: colors.faint, fontSize: font.small, marginRight: 12 }}>{p.currentSupport}%</Text>
                    <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>{p.seats}</Text>
                  </View>
                ))}

                <Text style={[styles.label, { marginTop: spacing.lg }]}>REGIONAL ELECTORAL MAP</Text>
                <ElectionMap
                  regionSeats={state.regionSeats ?? {}}
                  parties={state.parties}
                  playerPartyId={state.player?.partyId}
                  defaultFilter="england"
                />

                <Text style={[styles.label, { marginTop: spacing.lg }]}>DISSOLUTION OF PARLIAMENT</Text>
                <Card>
                  <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>
                    Call Snap General Election
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4, lineHeight: 17 }}>
                    Under the Dissolution and Calling of Parliament Act 2022, the Prime Minister may dissolve Parliament early to seek a fresh mandate or secure a working majority.
                  </Text>
                  <View style={{ marginTop: spacing.sm }}>
                    <Button
                      label="Dissolve Parliament & Call Election"
                      variant="secondary"
                      compact
                      disabled={state.week < 6 || inPurdah || !!state.gameOver || state.isElection}
                      onPress={() => dispatch({ type: 'CALL_EARLY_ELECTION' })}
                    />
                    {state.week < 6 && (
                      <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4 }}>
                        Available after 6 months in office.
                      </Text>
                    )}
                    {inPurdah && (
                      <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4 }}>
                        Purdah in force: scheduled election is already imminent.
                      </Text>
                    )}
                  </View>
                </Card>
              </View>
          </View>
        )}

        {tab === 'office' && (
          <View>
            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.cardBorder, marginTop: spacing.md, marginBottom: spacing.sm }}>
              {OFFICE_SECTIONS.map((section) => {
                const active = section.key === officeSection;
                return (
                  <Pressable
                    key={section.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => setOfficeSection(section.key)}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: active ? 2 : 0, borderBottomColor: colors.ink }}
                  >
                    <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4 }}>
                      <section.icon size={14} color={active ? colors.ink : colors.muted} strokeWidth={1.7} />
                      <Text style={{ color: active ? colors.text : colors.muted, fontSize: font.tiny, fontWeight: active ? '800' : '600', letterSpacing: 0.1 }} numberOfLines={1}>
                        {section.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {officeSection === 'cabinet' && (
<View>
                {state.reshuffleDisciplineBonus !== undefined && state.lastReshuffleWeek !== undefined && (
                  <Card tone="success">
                    <Text style={{ color: colors.success, fontSize: font.tiny, fontWeight: '800', letterSpacing: 1 }}>
                      CABINET HONEYMOON ACTIVE
                    </Text>
                    <Text style={{ color: colors.text, fontSize: font.small, marginTop: 4 }}>
                      +{state.reshuffleDisciplineBonus}% party unity discipline bonus (
                      {months(Math.max(1, (state.lastReshuffleWeek + 4) - state.week + 1))} remaining)
                    </Text>
                  </Card>
                )}
                <CabinetRoomScreen embedded />
              </View>
            )}
            {officeSection === 'treasury' && <MoneyTab />}
            {officeSection === 'nation' && <NationTab />}
            {officeSection === 'world' && <WorldTab />}
            {officeSection === 'press' && (
<View>
                {/* Press Room: meters, headlines and the lobby briefing. Embedded so
                    it shares GameScreen's scroll container instead of nesting another. */}
                <PressRoomScreen embedded />

                <Text style={[styles.label, { marginTop: spacing.md }]}>FLAGSHIP POLICIES</Text>
                {(state.pledges ?? []).length === 0 ? (
                  <Text style={[styles.hint, { marginTop: 4 }]}>No flagship policies on the record yet.</Text>
                ) : (
                  evaluatePledges(state, state.pledges ?? []).map((r) => (
                    <View key={r.pledge.id} style={{ marginTop: 6 }}>
                      <Text style={{ color: r.kept ? colors.success : colors.text, fontSize: font.small, fontWeight: '700' }}>
                        {r.kept ? 'KEPT' : 'ON TRACK?'} - {r.pledge.text}
                      </Text>
                      <Text style={{ color: colors.faint, fontSize: font.tiny, fontFamily: fileFontFamily }}>
                        now {r.current}, from {r.pledge.baseline}, target {r.pledge.target}
                      </Text>
                    </View>
                  ))
                )}

                <Text style={[styles.label, { marginTop: spacing.lg }]}>MONTH IN REVIEW</Text>
                {state.log.slice(0, 10).map((line, i) => (
                  <Text key={`log-${i}`} style={{ color: colors.faint, fontSize: font.small, lineHeight: 20, marginTop: 2, fontFamily: fileFontFamily }}>
                    - {line}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {TABS.map((item) => {
            const active = item.key === tab;
            const Icon = item.icon;
            return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => setTab(item.key)}
              style={styles.bottomNavItem}
              testID={`tab-${item.key}`}
            >
              <Icon size={18} color={active ? colors.ink : colors.faint} strokeWidth={active ? 2.1 : 1.6} />
              <Text style={[styles.bottomNavLabel, active && styles.bottomNavLabelActive]}>{item.label}</Text>
              {active && <View style={styles.bottomNavRule} />}
            </Pressable>
          );
        })}
      </View>

      <DossierMemo
        dossier={activeDossier}
        index={dossierIndex}
        total={redBox.length}
        onClose={() => dispatch({ type: 'CLOSE_DOSSIER' })}
      />

      {/* ================= PMQ SHEET ================= */}
      <Sheet
        visible={!!state.pmq}
        onClose={() => dispatch({ type: 'DISMISS_PMQ' })}
        eyebrow={
          state.pmq?.total
            ? `PRIME MINISTER'S QUESTIONS | ${state.pmq.asker === 'third' ? 'THIRD PARTY' : 'OPPOSITION LEADER'} | QUESTION ${state.pmq.round ?? 1} OF ${state.pmq.total}`
            : "PRIME MINISTER'S QUESTIONS"
        }
        title={state.pmq ? state.pmq.from : ''}
      >
        {state.pmq && (
          <View>
            <Text style={{ color: colors.text, fontSize: font.body, lineHeight: 22 }}>{state.pmq.question}</Text>
            <Text style={[styles.label, { marginTop: spacing.lg }]}>YOUR ANSWER</Text>
            {state.pmq.options.map((o) => (
              <Pressable
                key={o.id}
                testID={`pmq-option-${o.id}`}
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
        eyebrow={state.fiscalEventKind === 'autumn' ? 'HM TREASURY · AUTUMN STATEMENT' : 'HM TREASURY · ANNUAL BUDGET'}
        title={state.fiscalEventKind === 'autumn' ? 'Autumn Statement' : 'The Annual Budget'}
      >
        {state.fiscalEventKind === 'autumn' ? (
          <View>
            <Text style={{ color: colors.muted, fontSize: font.small, lineHeight: 19 }}>
              The Autumn Statement allows mid-cycle calibration of non-DEL tax toggles and locks in your tax levers until the Spring Budget.
            </Text>

            <View style={{ marginTop: spacing.md }}>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>Fuel Duty (52.95p/l)</Text>
                    <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>
                      {state.fuelDutyFrozen !== false
                        ? `5p freeze active (costs £${FUEL_DUTY_FREEZE_COST}bn/yr).`
                        : `Escalator restored (+£${FUEL_DUTY_FREEZE_COST}bn revenue).`}
                    </Text>
                  </View>
                  <Button
                    label={state.fuelDutyFrozen !== false ? 'Restore Duty' : 'Freeze 5p'}
                    variant="ghost"
                    compact
                    onPress={() =>
                      dispatch({
                        type: 'DELIVER_CUSTOM_BUDGET',
                        plan: {
                          title: 'Autumn Statement (Fuel Duty Adjustment)',
                          departmentBudgets: {},
                          taxRates: {},
                          personalAllowance: state.personalAllowance ?? 12570,
                          personalAllowanceFreezeYears: state.personalAllowanceFreezeYears ?? 0,
                          fuelDutyFrozen: !(state.fuelDutyFrozen !== false),
                          stampDutyRelief: state.stampDutyRelief ?? false,
                          tripleLock: state.tripleLock !== false,
                          publicSectorPay: state.publicSectorPay ?? 'full',
                          thresholdsFrozen: state.thresholdsFrozen !== false,
                        },
                      })
                    }
                  />
                </View>
              </Card>

              <Card style={{ marginTop: spacing.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>Stamp Duty (SDLT)</Text>
                    <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>
                      {state.stampDutyRelief === true
                        ? `Nil-rate relief active (costs £${STAMP_DUTY_RELIEF_COST}bn/yr).`
                        : `Standard SDLT rates (saves £${STAMP_DUTY_RELIEF_COST}bn/yr).`}
                    </Text>
                  </View>
                  <Button
                    label={state.stampDutyRelief === true ? 'End Relief' : 'Raise Bands'}
                    variant="ghost"
                    compact
                    onPress={() =>
                      dispatch({
                        type: 'DELIVER_CUSTOM_BUDGET',
                        plan: {
                          title: 'Autumn Statement (SDLT Adjustment)',
                          departmentBudgets: {},
                          taxRates: {},
                          personalAllowance: state.personalAllowance ?? 12570,
                          personalAllowanceFreezeYears: state.personalAllowanceFreezeYears ?? 0,
                          fuelDutyFrozen: state.fuelDutyFrozen !== false,
                          stampDutyRelief: !(state.stampDutyRelief === true),
                          tripleLock: state.tripleLock !== false,
                          publicSectorPay: state.publicSectorPay ?? 'full',
                          thresholdsFrozen: state.thresholdsFrozen !== false,
                        },
                      })
                    }
                  />
                </View>
              </Card>
            </View>

            <View style={{ marginTop: spacing.lg }}>
              <Button label="Deliver Autumn Statement" onPress={() => dispatch({ type: 'SET_AUTUMN_TAXES' })} />
            </View>
            <View style={{ marginTop: spacing.xs }}>
              <Button label="Defer" variant="ghost" onPress={() => dispatch({ type: 'SKIP_BUDGET' })} />
            </View>
          </View>
        ) : (
          <BudgetWorkbench
            state={state}
            onDeliver={(plan) => dispatch({ type: 'DELIVER_CUSTOM_BUDGET', plan })}
            onDefer={() => dispatch({ type: 'SKIP_BUDGET' })}
          />
        )}
      </Sheet>

      {/* weekly briefing is now a non-blocking banner at the top of the desk */}

      <MonthPreflightSheet
        visible={monthSheetOpen}
        onClose={() => setMonthSheetOpen(false)}
        onAdvance={() => {
          setMonthSheetOpen(false);
          advanceWeek();
        }}
      />

      {/* ================= HELP ================= */}
      <Sheet visible={helpOpen} onClose={() => setHelpOpen(false)} eyebrow="HOW TO PLAY" title="Running the country">
        <View>
          {HELP_ROWS.map((row) => (
            <View key={row.title} style={{ marginTop: spacing.md }}>
              <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>{row.title}</Text>
              <Text style={{ color: colors.faint, fontSize: font.small, lineHeight: 19, marginTop: 2 }}>{row.body}</Text>
            </View>
          ))}
          <Button label="Got it" onPress={() => setHelpOpen(false)} />
        </View>
      </Sheet>



      <ElectionNightModal />

      {/* ================= GAME OVER ================= */}
      <Modal visible={!!state.gameOver} transparent animationType="fade">
        <View style={styles.centerBackdrop}>
          <View style={[styles.centerCard, { borderColor: colors.danger, borderWidth: 1 }]}>
            <Text style={{ color: colors.danger, fontSize: font.h2, fontWeight: '800', textAlign: 'center' }}>PREMIERSHIP OVER</Text>
            <Text style={{ color: colors.text, fontSize: font.body, textAlign: 'center', marginTop: spacing.md, lineHeight: 21 }}>
              {state.gameOver}
            </Text>
            <Text style={{ color: colors.faint, fontSize: font.small, textAlign: 'center', marginTop: spacing.sm }}>
              {state.week} months in office | {state.passedLaws.length} laws passed | pledges kept{' '}
              {evaluatePledges(state, state.pledges ?? []).filter((r) => r.kept).length} of {(state.pledges ?? []).length}
            </Text>
            <Text style={{ color: colors.faint, fontSize: font.small, textAlign: 'center', marginTop: 4 }}>
              By-elections: {(state.byElections ?? []).filter((b) => !b.held).length} lost of {(state.byElections ?? []).length}
            </Text>
            <Text style={{ color: colors.faint, fontSize: font.small, textAlign: 'center', marginTop: 4 }}>
              Final legacy score {state.legacyScore}.
            </Text>
            <Button label="Return to main menu" onPress={restart} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const HELP_ROWS: { title: string; body: string }[] = [
  { title: 'Next month', body: 'Moves the calendar one month. Urgent papers left unanswered become scandals.' },
  { title: 'Record', body: 'The daily account of government: proceedings, papers and consequences in sequence.' },
  { title: 'Papers', body: 'Read submissions, introduce bills and track legislation through Parliament.' },
  { title: 'Divisions', body: 'Manage the order paper, party confidence and votes in the House.' },
  { title: 'Office', body: 'Manage the Cabinet, Treasury, the Union, public services and foreign affairs.' },
  { title: 'Elections', body: 'Every term ends in a general election. Seats come from regional support, not national polls alone. Your flagship policies are judged at the next election.' },
];

const styles = {
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
  },
  headerTop: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
  headerIdentity: { flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: 3 },
  headerEyebrow: {
    color: colors.muted,
    fontSize: font.tiny,
    letterSpacing: 1.7,
    fontWeight: '800' as const,
    fontFamily: fileFontFamily,
  },
  headerName: {
    color: colors.text,
    fontSize: font.h2,
    fontWeight: '700' as const,
    fontFamily: headingFontFamily,
  },
  headerMeta: { color: colors.muted, fontSize: font.small },
  helpButton: { padding: spacing.xs },
  recordFolio: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.ink,
    marginTop: spacing.md,
  },
  recordFolioLabel: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: '800' as const,
    letterSpacing: 1.1,
    fontFamily: fileFontFamily,
  },
  recordFolioSub: { color: colors.text, fontSize: font.small, marginTop: 3, fontFamily: headingFontFamily },
  recordIndex: {
    color: colors.accent,
    fontSize: font.tiny,
    fontWeight: '800' as const,
    letterSpacing: 1,
    marginLeft: spacing.sm,
  },
  label: { color: colors.muted, fontSize: font.tiny, fontWeight: '800' as const, letterSpacing: 1.4 },
  hint: { color: colors.muted, fontSize: font.small, lineHeight: 19 },
  confidenceHeading: { flexDirection: 'row' as const, alignItems: 'baseline' as const },
  confidenceTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700' as const, fontFamily: headingFontFamily, flex: 1, marginRight: spacing.sm },
  confidenceFolio: { color: colors.gold, fontSize: font.tiny, fontWeight: '800' as const, letterSpacing: 0.7, fontFamily: fileFontFamily, flexShrink: 0 },
  bottomNav: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.ink,
    paddingTop: 7,
  },
  bottomNavItem: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    position: 'relative' as const,
  },
  bottomNavLabel: { color: colors.faint, fontSize: font.tiny, marginTop: 2 },
  bottomNavLabelActive: { color: colors.ink, fontWeight: '800' as const },
  bottomNavRule: {
    position: 'absolute' as const,
    top: -8,
    width: 28,
    height: 2,
    backgroundColor: colors.gold,
  },
  deltaRow: { marginTop: spacing.sm },
  orderPaperRow: { flexDirection: 'row' as const, alignItems: 'center' as const, flexWrap: 'wrap' as const },
  orderPaperNote: {
    color: colors.faint,
    fontSize: font.tiny,
    lineHeight: 16,
    fontFamily: fileFontFamily,
    marginTop: spacing.xs,
    flexBasis: '100%' as const,
  },
  deltaLabel: {
    color: colors.gold,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: fileFontFamily,
    marginBottom: spacing.xs,
  },
  deltaChips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
  deltaItem: { flexDirection: 'row' as const, alignItems: 'center' as const, marginRight: spacing.md, marginBottom: 2 },
  deltaText: {
    color: colors.text,
    fontSize: font.tiny,
    fontWeight: '700',
    fontFamily: fileFontFamily,
  },
  centerBackdrop: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(23,17,13,0.75)',
    padding: spacing.xl,
  },
  centerCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: 0,
    borderColor: colors.ink,
    borderWidth: 1,
    padding: spacing.xl,
    width: '100%' as const,
  },
} as const;
