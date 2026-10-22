import React from 'react';
import { View, Text, Pressable, ScrollView, Modal } from 'react-native';
import { useGame } from '../state';
import { g, colors } from '../theme';
import type { GameEvent } from '../types';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{Math.round(value)}</Text>
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function EventModal({ event, onClose }: { event: GameEvent; onClose: () => void }) {
  const { state, dispatch } = useGame();

  const speakerName = (speaker: string | null) => {
    if (!speaker) return 'Narrator';
    return state.parties.find((p) => p.id === speaker)?.name ?? speaker;
  };

  const isOutcome = !!state.chosenId;

  return (
    <Modal visible transparent animationType="slide">
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' }}>
          <Text style={g.title}>{event.title}</Text>
          <Text style={[g.muted, { marginTop: 4 }]}>{event.summary}</Text>

          {!isOutcome && !state.showChoices && (
            <>
              <ScrollView style={{ marginTop: 14, flexGrow: 0 }}>
                {event.dialogs.slice(0, state.dialogIndex + 1).map((d, i) => (
                  <View key={i} style={{ marginBottom: 12 }}>
                    <Text style={{ color: d.speaker ? colors.accent : colors.muted, fontSize: 13, fontWeight: d.speaker ? '700' : '400', fontStyle: d.speaker ? 'normal' : 'italic', marginBottom: 2 }}>
                      {speakerName(d.speaker)}
                    </Text>
                    <Text style={g.body}>{d.text}</Text>
                  </View>
                ))}
              </ScrollView>
              <Pressable style={g.btn} onPress={() => dispatch({ type: 'ADVANCE_DIALOG' })}>
                <Text style={g.btnText}>Continue</Text>
              </Pressable>
            </>
          )}

          {!isOutcome && state.showChoices && (
            <>
              <Text style={[g.cardTitle, { marginTop: 16 }]}>What do you do?</Text>
              {event.choices.map((c) => (
                <Pressable key={c.id} style={g.btnGhost} onPress={() => dispatch({ type: 'CHOOSE', choiceId: c.id })}>
                  <Text style={g.btnGhostText}>{c.text}</Text>
                </Pressable>
              ))}
            </>
          )}

          {isOutcome && (
            <>
              <View style={[g.card, { borderColor: colors.accent }]}>
                <Text style={g.cardTitle}>Outcome</Text>
                <Text style={[g.body, { marginTop: 8 }]}>{state.lastOutcome}</Text>
              </View>
              <Pressable style={g.btn} onPress={onClose}>
                <Text style={g.btnText}>Return to Number 10</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function GameScreen() {
  const { state, dispatch } = useGame();
  const player = state.player;
  const party = state.parties.find((p) => p.id === player?.partyId);
  const ranked = [...state.parties].sort((a, b) => b.seats - a.seats);

  return (
    <ScrollView style={g.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={g.row}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Prime Minister</Text>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
            {player?.firstName} {player?.lastName}
          </Text>
          <Text style={{ color: party?.color, fontSize: 14, fontWeight: '700' }}>{party?.name}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Week {state.week}</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Election in {state.turnsUntilElection}</Text>
        </View>
      </View>

      <View style={g.card}>
        <Text style={g.cardTitle}>Your Government</Text>
        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          <Stat label="Approval" value={state.metrics.approval} />
          <Stat label="Party confidence" value={state.metrics.partyConfidence} />
          <Stat label="Economy" value={state.metrics.economy} />
        </View>
        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          <Stat label="Public services" value={state.metrics.publicServices} />
          <Stat label="Security" value={state.metrics.security} />
          <Stat label="Media" value={state.metrics.mediaAttention} />
        </View>
      </View>

      <View style={g.card}>
        <Text style={g.cardTitle}>House of Commons</Text>
        {ranked.map((p) => (
          <View key={p.id} style={[g.row, { marginTop: 10 }]}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: p.color, marginRight: 10 }} />
            <Text style={{ color: colors.text, flex: 1, fontSize: 15 }}>{p.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 15, marginRight: 12 }}>{p.currentSupport}%</Text>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', width: 70, textAlign: 'right' }}>
              {p.seats}
            </Text>
          </View>
        ))}
      </View>

      <Pressable style={g.btn} onPress={() => dispatch({ type: 'START_TURN' })}>
        <Text style={g.btnText}>Advance Week</Text>
      </Pressable>

      <View style={g.card}>
        <Text style={g.cardTitle}>Recent</Text>
        {state.log.slice(0, 5).map((line, i) => (
          <Text key={i} style={[g.muted, { marginTop: i === 0 ? 8 : 4 }]}>
            {'\u2022'} {line}
          </Text>
        ))}
        {state.log.length === 0 && <Text style={[g.muted, { marginTop: 8 }]}>No events yet.</Text>}
      </View>

      {state.activeEvent && (
        <EventModal event={state.activeEvent} onClose={() => dispatch({ type: 'DISMISS_EVENT' })} />
      )}
    </ScrollView>
  );
}
