import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '../state';
import { colors, font, spacing } from '../theme';
import { Button, Card, SectionTitle } from '../components/ui';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Menu'>;

const FEATURES: { title: string; body: string }[] = [
  { title: 'The Red Box', body: 'Weekly crises land on your desk. Every choice trades popularity against the public finances.' },
  { title: 'Fiscal reality', body: 'Budget for the NHS, tax the country and watch frozen thresholds drag more money out of voters.' },
  { title: 'Party management', body: 'Backbench letters, cabinet leaks and a 1922 Committee that will move against you.' },
];

export default function MenuScreen() {
  const { state, dispatch } = useGame();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const hasSave = state.phase === 'playing' || state.phase === 'create';

  const startNew = () => {
    dispatch({ type: 'NEW_GAME' });
    nav.navigate('Create');
  };

  const continueGame = () => {
    nav.navigate(state.phase === 'create' ? 'Create' : 'Game');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl, paddingTop: insets.top + spacing.xxl }}
    >
      <Text style={{ color: colors.accent, fontSize: font.tiny, fontWeight: '800', letterSpacing: 2 }}>WESTMINSTER SIMULATION</Text>
      <Text style={{ color: colors.text, fontSize: 40, fontWeight: '800', marginTop: spacing.xs, lineHeight: 44 }}>PM Simulator</Text>
      <Text style={{ color: colors.muted, fontSize: font.body, lineHeight: 21, marginTop: spacing.sm }}>
        Five parties. 650 seats. One Prime Minister. Form a government, survive the headlines and win a second term.
      </Text>

      <Button label={hasSave ? 'New game' : 'Start a new game'} onPress={startNew} />
      {hasSave && <Button label="Continue where you left off" variant="secondary" onPress={continueGame} />}

      <SectionTitle title="What you are signing up for" />
      {FEATURES.map((f) => (
        <Card key={f.title}>
          <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '700' }}>{f.title}</Text>
          <Text style={{ color: colors.muted, fontSize: font.small, lineHeight: 19, marginTop: 4 }}>{f.body}</Text>
        </Card>
      ))}

      <View style={{ height: spacing.xxl }} />
      <Text style={{ color: colors.muted, fontSize: font.tiny, textAlign: 'center' }}>
        A work in progress. Feedback shapes what gets built next.
      </Text>
    </ScrollView>
  );
}
