import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '../state';
import { colors, font, fileFontFamily, headingFontFamily, spacing } from '../theme';
import { Button, Card } from '../components/ui';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Menu'>;

const FEATURES: { file: string; title: string; body: string }[] = [
  {
    file: 'SECTION 01',
    title: 'Proceedings',
    body: 'PMQs, bills, votes and a House that can turn against its government.',
  },
  {
    file: 'SECTION 02',
    title: 'The Office',
    body: 'Cabinet, public services and the Treasury record the consequences of every decision.',
  },
  {
    file: 'SECTION 03',
    title: 'The Record',
    body: 'Crises, standards, diplomacy and the electorate remember what your government did.',
  },
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
      contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + spacing.xxl }}
    >
      {/* The title page of the official record. */}
      <View style={[styles.masthead, { paddingTop: insets.top + spacing.xxl }]}> 
        <View style={styles.goldRule} />
        <Text style={styles.mastheadEyebrow}>THE RED BOX · OFFICIAL RECORD</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>House of Commons</Text>
          <View style={styles.stamp}>
            <Text style={styles.stampText}>HC 01</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          A government in the record. Form a ministry, pass its programme and answer for every decision.
        </Text>
        <View style={styles.issueLine}>
          <Text style={styles.issueText}>650 SEATS · FIVE PARTIES · ONE TERM</Text>
          <Text style={styles.issueText}>VOL. 01</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button label="Open a new record" onPress={startNew} />
        {hasSave && <Button label="Continue current record" variant="secondary" onPress={continueGame} />}
      </View>

      {/* Indexed sections, presented as the contents page of a parliamentary record. */}
      <View style={styles.dossierHeader}>
        <View style={styles.dossierRule} />
        <Text style={styles.dossierLabel}>RECORD CONTENTS</Text>
        <View style={styles.dossierRule} />
      </View>
      <View style={styles.files}>
        {FEATURES.map((f, i) => (
          <View key={f.title} style={i < FEATURES.length - 1 ? styles.fileGap : undefined}>
            <View style={styles.fileTab}>
              <Text style={styles.fileTabText}>{f.file}</Text>
            </View>
            <Card>
              <Text style={styles.fileTitle}>{f.title}</Text>
              <Text style={styles.fileBody}>{f.body}</Text>
            </Card>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>THE OFFICIAL RECORD · A GOVERNMENT IS JUDGED BY WHAT IT DOES.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  masthead: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  goldRule: {
    height: 1,
    backgroundColor: colors.ink,
    marginBottom: spacing.sm,
  },
  mastheadEyebrow: {
    color: colors.accent,
    fontSize: font.tiny,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: fileFontFamily,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44,
    fontFamily: headingFontFamily,
    flex: 1,
  },
  stamp: {
    borderWidth: 1,
    borderColor: colors.stamp,
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: spacing.xs,
    backgroundColor: colors.card,
  },
  stampText: {
    color: colors.stamp,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: fileFontFamily,
  },
  subtitle: {
    color: colors.muted,
    fontSize: font.body,
    lineHeight: 23,
    marginTop: spacing.sm,
    fontFamily: headingFontFamily,
  },
  issueLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.ink,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  issueText: { color: colors.muted, fontSize: font.tiny, fontWeight: '700', letterSpacing: 0.7, fontFamily: fileFontFamily },
  actions: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  dossierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  dossierRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.ink,
  },
  dossierLabel: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: '700',
    letterSpacing: 1.5,
    fontFamily: fileFontFamily,
    marginHorizontal: spacing.sm,
  },
  files: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  fileGap: {
    marginTop: spacing.lg,
  },
  fileTab: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bg,
    paddingHorizontal: 0,
    paddingVertical: 5,
    marginBottom: -1,
    borderTopWidth: 1,
    borderColor: colors.ink,
    zIndex: 1,
  },
  fileTabText: {
    color: colors.gold,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 1.2,
    fontFamily: headingFontFamily,
  },
  fileTitle: {
    color: colors.text,
    fontSize: font.h3,
    fontWeight: '700',
    fontFamily: headingFontFamily,
  },
  fileBody: {
    color: colors.muted,
    fontSize: font.small,
    lineHeight: 19,
    marginTop: 4,
    fontFamily: fileFontFamily,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xxl,
    alignItems: 'center',
  },
  footerText: {
    color: colors.muted,
    fontSize: font.tiny,
    letterSpacing: 1,
    textAlign: 'center',
    fontFamily: fileFontFamily,
  },
});
