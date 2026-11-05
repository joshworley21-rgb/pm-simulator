import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '../state';
import { colors, font, fileFontFamily, headingFontFamily, radius, spacing } from '../theme';
import { Button, Card } from '../components/ui';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Menu'>;

const FEATURES: { file: string; title: string; body: string }[] = [
  {
    file: 'N°01',
    title: 'The Dispatch Box',
    body: 'Weekly crises land on your desk. Every choice trades popularity against the public finances.',
  },
  {
    file: 'N°02',
    title: 'Fiscal reality',
    body: 'Budget for the NHS, tax the country and watch frozen thresholds drag more money out of voters.',
  },
  {
    file: 'N°03',
    title: 'Party management',
    body: 'Backbench letters, cabinet leaks and a 1922 Committee that will move against you.',
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
      {/* Masthead — the leather cover of the box, opened */}
      <View style={[styles.masthead, { paddingTop: insets.top + spacing.xxl }]}>
        <View style={styles.goldRule} />
        <Text style={styles.mastheadEyebrow}>DOWNING STREET · PRIVATE SECRETARY'S DESK</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>PM Simulator</Text>
          <View style={styles.stamp}>
            <Text style={styles.stampText}>CONFIDENTIAL</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          Five parties. 650 seats. One Prime Minister. Form a government, survive the headlines and win a second term.
        </Text>
        <View style={[styles.goldRule, styles.goldRuleBottom]} />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button label={hasSave ? 'New game' : 'Start a new game'} onPress={startNew} />
        {hasSave && <Button label="Continue where you left off" variant="secondary" onPress={continueGame} />}
      </View>

      {/* Contents of the box — numbered dossier files, not a card grid */}
      <View style={styles.dossierHeader}>
        <View style={styles.dossierRule} />
        <Text style={styles.dossierLabel}>CONTENTS OF THE RED BOX</Text>
        <View style={styles.dossierRule} />
      </View>
      <View style={styles.files}>
        {FEATURES.map((f, i) => (
          <View key={f.title} style={i < FEATURES.length - 1 ? styles.fileGap : undefined}>
            <View style={styles.fileTab}>
              <Text style={styles.fileTabText}>FILE {f.file}</Text>
            </View>
            <Card>
              <Text style={styles.fileTitle}>{f.title}</Text>
              <Text style={styles.fileBody}>{f.body}</Text>
            </Card>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>FILE CLOSED — A WORK IN PROGRESS. FEEDBACK SHAPES WHAT GETS BUILT NEXT.</Text>
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
    height: 2,
    backgroundColor: colors.gold,
    opacity: 0.55,
    marginBottom: spacing.sm,
  },
  goldRuleBottom: {
    marginBottom: 0,
    marginTop: spacing.md,
    opacity: 0.35,
  },
  mastheadEyebrow: {
    color: colors.gold,
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
    color: colors.card,
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44,
    fontFamily: headingFontFamily,
    flex: 1,
  },
  stamp: {
    borderWidth: 2,
    borderColor: colors.stamp,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: spacing.xs,
    transform: [{ rotate: '6deg' }],
    backgroundColor: colors.bg,
  },
  stampText: {
    color: colors.stamp,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: fileFontFamily,
  },
  subtitle: {
    color: colors.faint,
    fontSize: font.body,
    lineHeight: 21,
    marginTop: spacing.sm,
    fontFamily: fileFontFamily,
  },
  actions: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
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
    backgroundColor: colors.cardBorder,
  },
  dossierLabel: {
    color: colors.faint,
    fontSize: font.tiny,
    fontWeight: '700',
    letterSpacing: 2,
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
    backgroundColor: colors.leather,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: -1,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.cardBorder,
    zIndex: 1,
  },
  fileTabText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontFamily: fileFontFamily,
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
    color: colors.faint,
    fontSize: font.tiny,
    letterSpacing: 1,
    textAlign: 'center',
    fontFamily: fileFontFamily,
  },
});
