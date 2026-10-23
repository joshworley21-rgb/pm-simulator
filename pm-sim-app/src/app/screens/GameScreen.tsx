import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGame } from '../state';
import { g, colors } from '../theme';
import { BILL_POOL } from '../bills';
import { BUDGET_PACKAGES } from '../budget';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Game'>;

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.card, padding: 10, borderRadius: 10, marginHorizontal: 3, alignItems: 'center' }}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function fiscalLabel(v: number): string {
  if (v < 0) return `Raises \u00a3${-v}bn/yr`;
  return `Costs \u00a3${v}bn/yr`;
}

function budgetLabel(v: number): string {
  if (v < 0) return `\u00a3${Math.round(Math.abs(v))}bn deficit`;
  return `\u00a3${Math.round(v)}bn surplus`;
}

type Tab = 'redbox' | 'legislation' | 'cabinet' | 'nation' | 'parliament' | 'diplomacy' | 'press';

export default function GameScreen() {
  const { state, dispatch } = useGame();
  const nav = useNavigation<Nav>();
  const [activeTab, setActiveTab] = useState<Tab>('redbox');
  const player = state.player;
  const party = state.parties.find((p) => p.id === player?.partyId);
  const activeDossier = state.redBox.find((d) => d.id === state.selectedDossierId);
  const rankedParties = [...state.parties].sort((a, b) => b.seats - a.seats);

  const inFlightIds = new Set(state.bills.map((b) => b.id));
  const passedTitles = new Set(state.passedLaws);
  const proposable = BILL_POOL.filter((b) => !inFlightIds.has(b.id) && !passedTitles.has(b.title));

  const threshold = state.stats.lettersThreshold || 15;
  const revoltPct = Math.min(100, Math.round((state.stats.lettersOfNoConfidence / threshold) * 100));

  const restart = () => {
    dispatch({ type: 'NEW_GAME' });
    nav.navigate('Menu');
  };

  return (
    <View style={[g.screen, { paddingBottom: 0 }]}>
      {/* Downing Street header */}
      <View style={[g.row, { paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1 }}>10 DOWNING STREET</Text>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>
            {player?.firstName} {player?.lastName}
          </Text>
          <Text style={{ color: party?.color, fontSize: 12, fontWeight: '700' }}>
            {party?.name} - Week {state.week}
          </Text>
        </View>

        <Pressable
          style={[g.btn, { marginTop: 0, paddingVertical: 10, paddingHorizontal: 14 }]}
          onPress={() => dispatch({ type: 'START_TURN' })}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Advance Week →</Text>
        </Pressable>
      </View>

      {/* Core vitals bar */}
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        <StatPill label="Approval" value={`${Math.round(state.metrics.approval)}%`} />
        <StatPill label="Party Conf" value={`${Math.round(state.metrics.partyConfidence)}%`} />
        <StatPill label="Inflation" value={`${state.stats.cpiInflation}%`} />
        <StatPill label="Economy" value={`${Math.round(state.metrics.economy)}`} />
      </View>

      {/* Desk tabs (horizontally scrollable to avoid clipping) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, borderBottomWidth: 1, borderBottomColor: colors.cardBorder, flexGrow: 0 }} contentContainerStyle={{ alignItems: 'center' }}>
        {[
          { key: 'redbox', label: `Red Box (${state.redBox.length})` },
          { key: 'legislation', label: 'Bills' },
          { key: 'cabinet', label: 'Cabinet' },
          { key: 'nation', label: 'Economy' },
          { key: 'parliament', label: 'Westminster' },
          { key: 'diplomacy', label: 'World' },
          { key: 'press', label: 'Press' },
        ].map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setActiveTab(t.key as Tab)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              alignItems: 'center',
              borderBottomWidth: activeTab === t.key ? 2 : 0,
              borderBottomColor: colors.accent,
            }}
          >
            <Text numberOfLines={1} style={{ color: activeTab === t.key ? colors.text : colors.muted, fontSize: 13, fontWeight: '700' }}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Tab content */}
      <ScrollView style={{ flex: 1, marginTop: 10 }} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* RED BOX */}
        {activeTab === 'redbox' && (
          <View>
            <Text style={[g.cardTitle, { marginBottom: 6 }]}>Prime Minister's Despatch Box</Text>
            <Text style={[g.muted, { marginBottom: 12 }]}>
              Whitehall policy submissions and urgent crises awaiting your determination.
            </Text>

            {state.redBox.map((d) => (
              <Pressable
                key={d.id}
                onPress={() => dispatch({ type: 'OPEN_DOSSIER', dossierId: d.id })}
                style={[
                  g.card,
                  {
                    marginTop: 8,
                    borderColor: d.urgent ? colors.danger : colors.cardBorder,
                    backgroundColor: d.urgent ? '#251522' : colors.card,
                  },
                ]}
              >
                <View style={g.row}>
                  <Text style={{ color: d.urgent ? colors.danger : colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, flex: 1 }}>
                    {d.department.toUpperCase()} {d.urgent ? '\u2022 URGENT' : ''}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{d.weeksRemaining}w left</Text>
                </View>
                <Text style={[g.cardTitle, { fontSize: 16, marginTop: 4 }]}>{d.title}</Text>
                <Text style={[g.muted, { marginTop: 4 }]} numberOfLines={2}>{d.leadParagraph}</Text>
              </Pressable>
            ))}

            {state.redBox.length === 0 && (
              <View style={[g.card, { alignItems: 'center', padding: 24 }]}>
                <Text style={{ color: colors.success, fontSize: 18, fontWeight: '800' }}>Red Box Cleared</Text>
                <Text style={[g.muted, { textAlign: 'center', marginTop: 6 }]}>
                  All ministerial papers dispatched for this week. Tap 'Advance Week' to continue.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* LEGISLATION */}
        {activeTab === 'legislation' && (
          <View>
            <Text style={[g.cardTitle, { marginBottom: 8 }]}>Legislative Agenda</Text>

            {state.bills.length > 0 && (
              <>
                <Text style={[g.muted, { marginBottom: 6, fontWeight: '700' }]}>IN PARLIAMENT</Text>
                {state.bills.map((b) => (
                  <View key={b.id} style={[g.card, { marginTop: 6 }]}>
                    <View style={g.row}>
                      <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800', flex: 1 }}>{b.department.toUpperCase()}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>{b.weeksToPass}w to division</Text>
                    </View>
                    <Text style={[g.cardTitle, { fontSize: 16, marginTop: 4 }]}>{b.title}</Text>
                    <Text style={[g.muted, { marginTop: 4 }]}>{fiscalLabel(b.fiscalCost)} - rebellion risk {b.rebellionRisk}%</Text>
                  </View>
                ))}
              </>
            )}

            <Text style={[g.muted, { marginTop: 14, marginBottom: 6, fontWeight: '700' }]}>PROPOSE NEW LEGISLATION</Text>
            {proposable.map((b) => (
              <View key={b.id} style={[g.card, { marginTop: 6 }]}>
                <View style={g.row}>
                  <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800', flex: 1 }}>{b.department.toUpperCase()}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{fiscalLabel(b.fiscalCost)}</Text>
                </View>
                <Text style={[g.cardTitle, { fontSize: 16, marginTop: 4 }]}>{b.title}</Text>
                <Text style={[g.muted, { marginTop: 4 }]}>{b.description}</Text>
                <Text style={[g.muted, { marginTop: 6, fontSize: 11 }]}>Rebellion risk {b.rebellionRisk}%</Text>
                <Pressable style={[g.btnGhost, { marginTop: 8, paddingVertical: 8 }]} onPress={() => dispatch({ type: 'PROPOSE_BILL', billId: b.id })}>
                  <Text style={g.btnGhostText}>Introduce to Parliament</Text>
                </Pressable>
              </View>
            ))}

            {state.passedLaws.length > 0 && (
              <>
                <Text style={[g.muted, { marginTop: 14, marginBottom: 6, fontWeight: '700' }]}>ON THE STATUTE BOOK</Text>
                {state.passedLaws.map((title, i) => (
                  <Text key={i} style={{ color: colors.success, fontSize: 14, marginTop: 4 }}>{'\u2713'} {title}</Text>
                ))}
              </>
            )}
          </View>
        )}

        {/* CABINET */}
        {activeTab === 'cabinet' && (
          <View>
            <Text style={[g.cardTitle, { marginBottom: 4 }]}>Your Cabinet</Text>
            <Text style={[g.muted, { marginBottom: 8 }]}>Faction unrest: {state.factionUnrest}% - manage your team to keep the party behind you.</Text>
            {state.cabinet.map((m) => (
              <View key={m.name} style={[g.card, { marginTop: 6 }]}>
                <View style={g.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{m.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{m.post} - {m.faction}</Text>
                  </View>
                  <Pressable onPress={() => dispatch({ type: 'SACK_MINISTER', name: m.name })} style={{ padding: 6 }}>
                    <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '700' }}>Sack</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, flex: 1 }}>Loyalty {m.loyalty}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Competence {m.competence}</Text>
                </View>
              </View>
            ))}

            {state.backbenchers.length > 0 && state.cabinet.length < 8 && (
              <>
                <Text style={[g.muted, { marginTop: 16, marginBottom: 6, fontWeight: '700' }]}>BACKBENCHERS AWAITING PROMOTION</Text>
                {state.backbenchers.map((b) => (
                  <View key={b.name} style={[g.card, { marginTop: 6 }]}>
                    <View style={g.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{b.name}</Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>{b.faction} - ambition {b.ambition}</Text>
                      </View>
                      <Pressable
                        onPress={() => dispatch({ type: 'APPOINT_MINISTER', post: 'Minister of State' })}
                        style={{ padding: 6 }}
                      >
                        <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>Promote</Text>
                      </Pressable>
                    </View>
                    <View style={{ flexDirection: 'row', marginTop: 6 }}>
                      <Text style={{ color: colors.muted, fontSize: 11, flex: 1 }}>Loyalty {b.loyalty}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Competence {b.competence}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* ECONOMY */}
        {activeTab === 'nation' && (
          <View>
            <View style={g.card}>
              <Text style={g.cardTitle}>HM Treasury & Economy</Text>
              <View style={{ flexDirection: 'row', marginTop: 12 }}>
                <StatPill label="GDP Growth" value={`${state.stats.gdpGrowth}%`} />
                <StatPill label="CPI Inflation" value={`${state.stats.cpiInflation}%`} />
                <StatPill label="10Y Gilt" value={`${state.stats.giltYield}%`} />
              </View>
              <View style={{ flexDirection: 'row', marginTop: 10 }}>
                <StatPill label="Tax Rate" value={`${state.stats.taxRate}%`} />
                <StatPill label="Debt/GDP" value={`${state.stats.debtToGdp}%`} />
                <StatPill label="Unemployment" value={`${state.stats.unemployment}%`} />
              </View>
              <Text style={[g.body, { marginTop: 12, fontWeight: '700', color: state.stats.budgetBalance < 0 ? colors.danger : colors.success }]}>
                Budget: {budgetLabel(state.stats.budgetBalance)}
              </Text>
            </View>

            <View style={g.card}>
              <Text style={g.cardTitle}>Public Services & Society</Text>
              <View style={{ flexDirection: 'row', marginTop: 12 }}>
                <StatPill label="NHS Waiting" value={`${state.stats.nhsWaitingList}m`} />
                <StatPill label="Net Migration" value={`${state.stats.netMigration}k`} />
                <StatPill label="Security" value={`${Math.round(state.metrics.security)}`} />
              </View>
            </View>
          </View>
        )}

        {/* WESTMINSTER */}
        {activeTab === 'parliament' && (
          <View>
            <View style={g.card}>
              <Text style={g.cardTitle}>1922 Committee Revolt Meter</Text>
              <Text style={[g.muted, { marginTop: 4 }]}>
                Letters of No Confidence lodged: {state.stats.lettersOfNoConfidence} / {threshold} (Threshold)
              </Text>
              <View style={{ height: 8, backgroundColor: colors.bg, borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
                <View style={{ height: 8, width: `${revoltPct}%`, backgroundColor: state.stats.lettersOfNoConfidence >= Math.round(threshold * 0.65) ? colors.danger : colors.accent }} />
              </View>
              <Text style={[g.muted, { marginTop: 6, fontSize: 11 }]}>Reaching the threshold triggers an automatic confidence vote among your own MPs.</Text>
            </View>

            <View style={g.card}>
              <Text style={g.cardTitle}>House of Commons (650 Seats)</Text>
              {rankedParties.map((p) => (
                <View key={p.id} style={[g.row, { marginTop: 8 }]}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color, marginRight: 8 }} />
                  <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>{p.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13, marginRight: 10 }}>{p.currentSupport}%</Text>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{p.seats} seats</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* DIPLOMACY */}
        {activeTab === 'diplomacy' && (
          <View>
            <Text style={[g.cardTitle, { marginBottom: 8 }]}>Foreign Affairs</Text>
            {state.foreignIssues.length === 0 && <Text style={g.muted}>No outstanding summits or calls.</Text>}
            {state.foreignIssues.map((f) => (
              <View key={f.id} style={[g.card, { marginTop: 6 }]}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }}>{f.country.toUpperCase()} - {f.leader}</Text>
                <Text style={[g.cardTitle, { fontSize: 16, marginTop: 4 }]}>{f.topic}</Text>
                {f.options.map((o) => (
                  <Pressable key={o.id} style={[g.btnGhost, { marginTop: 8, paddingVertical: 8 }]} onPress={() => dispatch({ type: 'RESOLVE_FOREIGN', issueId: f.id, optionId: o.id })}>
                    <Text style={g.btnGhostText}>{o.label}</Text>
                    <Text style={[g.muted, { marginTop: 2 }]}>{o.summary}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* PRESS */}
        {activeTab === 'press' && (
          <View>
            <Text style={[g.cardTitle, { marginBottom: 10 }]}>Fleet Street Headlines</Text>
            {state.headlines.map((h, i) => (
              <View key={i} style={[g.card, { marginTop: 8 }]}>
                <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '800' }}>{h.paper.toUpperCase()}</Text>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 4 }}>{h.title}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Dossier modal */}
      <Modal visible={!!activeDossier} transparent animationType="slide">
        {activeDossier && (
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' }}>
              <View style={g.row}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1, flex: 1 }}>{activeDossier.department.toUpperCase()} SUBMISSION</Text>
                <Pressable onPress={() => dispatch({ type: 'CLOSE_DOSSIER' })}><Text style={{ color: colors.muted, fontSize: 16, fontWeight: '700' }}>X</Text></Pressable>
              </View>
              <Text style={[g.title, { fontSize: 22, marginTop: 6 }]}>{activeDossier.title}</Text>
              <ScrollView style={{ marginTop: 12, maxHeight: 300 }}>
                <Text style={[g.body, { fontWeight: '700', marginBottom: 8 }]}>{activeDossier.leadParagraph}</Text>
                <Text style={g.body}>{activeDossier.body}</Text>
              </ScrollView>
              <Text style={[g.cardTitle, { fontSize: 15, marginTop: 16, marginBottom: 8 }]}>Ministerial Determination:</Text>
              {activeDossier.choices.map((c) => (
                <Pressable key={c.id} style={[g.card, { marginTop: 6, borderColor: colors.cardBorder }]} onPress={() => dispatch({ type: 'RESOLVE_DOSSIER', dossierId: activeDossier.id, choiceId: c.id })}>
                  <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '700' }}>{c.label}</Text>
                  <Text style={[g.body, { fontSize: 13, marginTop: 2 }]}>{c.summary}</Text>
                  <Text style={[g.muted, { fontSize: 11, fontStyle: 'italic', marginTop: 4 }]}>Advice: {c.advice}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </Modal>

      {/* PMQs modal */}
      <Modal visible={!!state.pmq} transparent animationType="slide">
        {state.pmq && (
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>PRIME MINISTER'S QUESTIONS</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{state.pmq.from}</Text>
              <Text style={[g.body, { marginTop: 10, fontWeight: '600' }]}>{state.pmq.question}</Text>
              <Text style={[g.cardTitle, { fontSize: 15, marginTop: 16, marginBottom: 8 }]}>Your response:</Text>
              {state.pmq.options.map((o) => (
                <Pressable key={o.id} style={[g.card, { marginTop: 6 }]} onPress={() => dispatch({ type: 'ANSWER_PMQ', optionId: o.id })}>
                  <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '700' }}>{o.label}</Text>
                </Pressable>
              ))}
              <Pressable style={g.btn} onPress={() => dispatch({ type: 'DISMISS_PMQ' })}><Text style={g.btnText}>Skip</Text></Pressable>
            </View>
          </View>
        )}
      </Modal>

      {/* Budget modal */}
      <Modal visible={state.budgetDue} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>HM TREASURY - ANNUAL BUDGET</Text>
            <Text style={[g.title, { fontSize: 22, marginTop: 6 }]}>Set the Nation's Course</Text>
            <Text style={[g.muted, { marginTop: 4 }]}>Choose the package your Chancellor will deliver to the Commons.</Text>
            {BUDGET_PACKAGES.map((b) => (
              <Pressable key={b.id} style={[g.card, { marginTop: 10 }]} onPress={() => dispatch({ type: 'DELIVER_BUDGET', packageId: b.id })}>
                <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '700' }}>{b.title}</Text>
                <Text style={[g.muted, { marginTop: 4 }]}>{b.description}</Text>
              </Pressable>
            ))}
            <Pressable style={g.btn} onPress={() => dispatch({ type: 'SKIP_BUDGET' })}><Text style={g.btnText}>Defer Budget</Text></Pressable>
          </View>
        </View>
      </Modal>

      {/* Election results modal */}
      <Modal visible={state.isElection && !state.gameOver} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)', padding: 24 }}>
          <View style={{ backgroundColor: colors.bg, borderRadius: 16, padding: 24, width: '100%' }}>
            <Text style={{ color: colors.accent, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>GENERAL ELECTION</Text>
            <View style={{ marginTop: 16 }}>
              {rankedParties.map((p) => (
                <View key={p.id} style={[g.row, { marginTop: 8 }]}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color, marginRight: 8 }} />
                  <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>{p.name}</Text>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{p.seats} seats</Text>
                </View>
              ))}
            </View>
            <Pressable style={g.btn} onPress={() => dispatch({ type: 'DISMISS_ELECTION' })}><Text style={g.btnText}>Continue Governing</Text></Pressable>
          </View>
        </View>
      </Modal>

      {/* Game over */}
      <Modal visible={!!state.gameOver} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)', padding: 24 }}>
          <View style={{ backgroundColor: colors.bg, borderRadius: 16, padding: 24, borderColor: colors.danger, borderWidth: 1, width: '100%' }}>
            <Text style={{ color: colors.danger, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>ELECTION DEFEAT</Text>
            <Text style={[g.body, { textAlign: 'center', marginTop: 12 }]}>{state.gameOver}</Text>
            <Text style={[g.muted, { textAlign: 'center', marginTop: 8 }]}>Your premiership has come to an end. The backbenches have spoken.</Text>
            <Pressable style={g.btn} onPress={restart}><Text style={g.btnText}>Return to Main Menu</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
