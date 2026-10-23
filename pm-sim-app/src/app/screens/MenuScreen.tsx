import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGame } from '../state';
import { g } from '../theme';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Menu'>;

export default function MenuScreen() {
  const { state, dispatch } = useGame();
  const nav = useNavigation<Nav>();
  const hasSave = state.phase === 'playing' || state.phase === 'create';

  const startNew = () => {
    dispatch({ type: 'NEW_GAME' });
    nav.navigate('Create');
  };

  const continueGame = () => {
    nav.navigate(state.phase === 'create' ? 'Create' : 'Game');
  };

  return (
    <ScrollView style={g.screen} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <Text style={[g.title, { textAlign: 'center' }]}>PM Simulator</Text>
      <Text style={[g.subtitle, { textAlign: 'center' }]}>
        Westminster at your fingertips. Run the country, survive the headlines, and keep your majority.
      </Text>

      <Pressable style={g.btn} onPress={startNew}>
        <Text style={g.btnText}>New Game</Text>
      </Pressable>

      {hasSave && (
        <Pressable style={g.btnGhost} onPress={continueGame}>
          <Text style={g.btnGhostText}>Continue</Text>
        </Pressable>
      )}

      <View style={g.card}>
        <Text style={g.cardTitle}>A fresh start</Text>
        <Text style={[g.muted, { marginTop: 6 }]}>
          Five parties. 650 seats. One Prime Minister — you. Form a government, face weekly crises, and win re-election.
        </Text>
      </View>

      <Text style={[g.muted, { textAlign: 'center', marginTop: 24 }]}>
        A work-in-progress rebuild. Tap 'New Game' to begin.
      </Text>
    </ScrollView>
  );
}
