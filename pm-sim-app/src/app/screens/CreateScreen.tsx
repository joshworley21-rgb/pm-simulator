import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '../state';
import { colors, font, radius, spacing } from '../theme';
import { Button, Card, SectionTitle } from '../components/ui';
import { BACKGROUNDS } from '../data';
import { SCENARIOS, DEFAULT_SCENARIO_ID } from '../scenarios';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Create'>;

const TERM_OPTIONS = [
  { weeks: 36, label: '3 years' },
  { weeks: 48, label: '4 years' },
  { weeks: 60, label: '5 years' },
  { weeks: 72, label: '6 years' },
];

export default function CreateScreen() {
  const { state, dispatch } = useGame();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [partyId, setPartyId] = useState<string>('reform');
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [termLength, setTermLength] = useState<number>(60);
  const [scenarioId, setScenarioId] = useState<string>(DEFAULT_SCENARIO_ID);

  const canStart = firstName.trim().length > 0 && lastName.trim().length > 0;

  const start = () => {
    dispatch({ type: 'SET_TERM_LENGTH', weeks: termLength });
    dispatch({
      type: 'CREATE_PLAYER',
      player: { firstName: firstName.trim(), lastName: lastName.trim(), partyId, background, scenario: scenarioId },
    });
    nav.navigate('Game');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxl }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ color: colors.text, fontSize: font.h1, fontWeight: '800' }}>Create your Prime Minister</Text>
      <Text style={{ color: colors.muted, fontSize: font.body, marginTop: 4 }}>Pick a name, a party and a past.</Text>

      <SectionTitle title="Name" />
      <TextInput
        style={input}
        placeholder="First name"
        placeholderTextColor={colors.muted}
        value={firstName}
        onChangeText={setFirstName}
        returnKeyType="next"
        autoCapitalize="words"
      />
      <TextInput
        style={[input, { marginTop: spacing.sm }]}
        placeholder="Last name"
        placeholderTextColor={colors.muted}
        value={lastName}
        onChangeText={setLastName}
        returnKeyType="done"
        autoCapitalize="words"
      />

      <SectionTitle title="Party" hint="This sets your starting base of support and your natural allies." />
      {state.parties.map((p) => {
        const selected = p.id === partyId;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => setPartyId(p.id)}
            style={{
              backgroundColor: selected ? colors.accentSoft : colors.card,
              borderColor: selected ? colors.accent : colors.cardBorder,
              borderWidth: selected ? 2 : 1,
              borderRadius: radius.md,
              padding: spacing.md,
              marginTop: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: p.color, marginRight: 10 }} />
              <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '700', flex: 1 }}>{p.name}</Text>
              <Text style={{ color: colors.muted, fontSize: font.tiny }}>{p.baseSupport}% base</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4, lineHeight: 17 }}>{p.description}</Text>
          </Pressable>
        );
      })}

      <SectionTitle title="Background" hint="Where you came from — and what the party makes of you." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {BACKGROUNDS.map((b) => {
          const selected = b === background;
          return (
            <Pressable
              key={b}
              onPress={() => setBackground(b)}
              style={{
                backgroundColor: selected ? colors.accentSoft : colors.card,
                borderColor: selected ? colors.accent : colors.cardBorder,
                borderWidth: 1,
                borderRadius: radius.pill,
                paddingHorizontal: 14,
                paddingVertical: 9,
                marginRight: spacing.sm,
                marginBottom: spacing.sm,
              }}
            >
              <Text style={{ color: selected ? colors.text : colors.muted, fontSize: font.small, fontWeight: '600' }}>{b}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle
        title="Starting position"
        hint="Same decisions, very different country. This is the main source of replay value."
      />
      {SCENARIOS.map((sc) => {
        const selected = sc.id === scenarioId;
        const tone =
          sc.difficulty === 'easy' ? colors.success : sc.difficulty === 'normal' ? colors.accent : sc.difficulty === 'hard' ? colors.warning : colors.danger;
        return (
          <Pressable
            key={sc.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => setScenarioId(sc.id)}
            style={{
              backgroundColor: selected ? colors.accentSoft : colors.card,
              borderColor: selected ? colors.accent : colors.cardBorder,
              borderWidth: selected ? 2 : 1,
              borderRadius: radius.md,
              padding: spacing.md,
              marginTop: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '700', flex: 1 }}>{sc.name}</Text>
              <Text style={{ color: tone, fontSize: font.tiny, fontWeight: '800', textTransform: 'uppercase' }}>
                {sc.difficulty}
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>{sc.tagline}</Text>
            {selected && (
              <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 6, lineHeight: 17 }}>{sc.blurb}</Text>
            )}
          </Pressable>
        );
      })}

      <SectionTitle title="Parliament length" hint="How long until you must face the voters." />
      <View style={{ flexDirection: 'row' }}>
        {TERM_OPTIONS.map((o) => {
          const selected = o.weeks === termLength;
          return (
            <Pressable
              key={o.weeks}
              onPress={() => setTermLength(o.weeks)}
              style={{
                flex: 1,
                backgroundColor: selected ? colors.accentSoft : colors.card,
                borderColor: selected ? colors.accent : colors.cardBorder,
                borderWidth: 1,
                borderRadius: radius.md,
                paddingVertical: 10,
                marginRight: spacing.sm,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: selected ? colors.text : colors.muted, fontSize: font.small, fontWeight: '700' }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Card>
        <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>Ready, candidate?</Text>
        <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4, lineHeight: 17 }}>
          You start with your party's current standing, a cabinet, and a red box that is already filling up.
        </Text>
      </Card>

      <Button label="Enter Number 10" onPress={start} disabled={!canStart} />
      {!canStart && (
        <Text style={{ color: colors.muted, fontSize: font.tiny, textAlign: 'center', marginTop: spacing.sm }}>
          Add a first and last name to begin.
        </Text>
      )}
    </ScrollView>
  );
}

const input = {
  backgroundColor: colors.card,
  borderColor: colors.cardBorder,
  borderWidth: 1,
  borderRadius: radius.md,
  paddingHorizontal: 14,
  paddingVertical: 12,
  color: colors.text,
  fontSize: font.body,
};
