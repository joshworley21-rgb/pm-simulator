import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGame } from '../state';
import { g, colors } from '../theme';
import { BACKGROUNDS } from '../data';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Create'>;

export default function CreateScreen() {
  const { state, dispatch } = useGame();
  const nav = useNavigation<Nav>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [partyId, setPartyId] = useState<string>('reform');
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [termLength, setTermLength] = useState<number>(60);

  const canStart = firstName.trim().length > 0 && lastName.trim().length > 0;

  const start = () => {
    dispatch({ type: 'SET_TERM_LENGTH', weeks: termLength });
    dispatch({
      type: 'CREATE_PLAYER',
      player: { firstName: firstName.trim(), lastName: lastName.trim(), partyId, background },
    });
    nav.navigate('Game');
  };

  return (
    <ScrollView style={g.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={g.title}>Create your Prime Minister</Text>
      <Text style={g.subtitle}>Choose your party and your past.</Text>

      <Text style={[g.cardTitle, { marginTop: 20 }]}>Name</Text>
      <TextInput
        style={[input, { marginTop: 10 }]}
        placeholder="First name"
        placeholderTextColor={colors.muted}
        value={firstName}
        onChangeText={setFirstName}
      />
      <TextInput
        style={[input, { marginTop: 10 }]}
        placeholder="Last name"
        placeholderTextColor={colors.muted}
        value={lastName}
        onChangeText={setLastName}
      />

      <Text style={[g.cardTitle, { marginTop: 24 }]}>Party</Text>
      {state.parties.map((p) => {
        const selected = p.id === partyId;
        return (
          <Pressable
            key={p.id}
            onPress={() => setPartyId(p.id)}
            style={[
              g.card,
              { borderColor: selected ? colors.accent : colors.cardBorder, marginTop: 10 },
            ]}
          >
            <View style={g.row}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: p.color, marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={g.cardTitle}>{p.name}</Text>
                <Text style={g.muted}>{p.description}</Text>
              </View>
            </View>
          </Pressable>
        );
      })}

      <Text style={[g.cardTitle, { marginTop: 24 }]}>Background</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
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
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 10,
                marginRight: 8,
              }}
            >
              <Text style={{ color: selected ? colors.text : colors.muted, fontWeight: '600' }}>{b}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[g.cardTitle, { marginTop: 24 }]}>Campaign Length</Text>
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        {[36, 48, 60, 72].map((w) => {
          const selected = w === termLength;
          return (
            <Pressable
              key={w}
              onPress={() => setTermLength(w)}
              style={{
                backgroundColor: selected ? colors.accentSoft : colors.card,
                borderColor: selected ? colors.accent : colors.cardBorder,
                borderWidth: 1,
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 10,
                marginRight: 8,
              }}
            >
              <Text style={{ color: selected ? colors.text : colors.muted, fontWeight: '600' }}>
                {w / 12} yrs
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[g.muted, { marginTop: 8, fontSize: 12 }]}>
        Weeks until the next general election (12 weeks ≈ one year).
      </Text>

      <Pressable
        style={[g.btn, { opacity: canStart ? 1 : 0.4 }]}
        disabled={!canStart}
        onPress={start}
      >
        <Text style={g.btnText}>Enter Number 10</Text>
      </Pressable>
    </ScrollView>
  );
}

const input = {
  backgroundColor: colors.card,
  borderColor: colors.cardBorder,
  borderWidth: 1,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  color: colors.text,
  fontSize: 16,
};
