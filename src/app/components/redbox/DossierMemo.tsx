import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { Button, Chip, EffectChips } from '../ui';
import { SignaturePad } from './SignaturePad';
import { useGame } from '../../state';
import { getBriefingMeta } from '../../briefings';
import { colors, fileFontFamily, font, headingFontFamily, spacing } from '../../theme';
import type { Dossier, Effects } from '../../types';

export interface DossierMemoProps {
  dossier: Dossier | null;
  index: number;
  total: number;
  onClose: () => void;
}

const handFont = Platform.select({
  ios: 'Snell Roundhand',
  android: 'cursive',
  default: 'cursive',
});

function departmentStamp(department: string): string {
  if (department === 'HM Treasury') return 'HM\nTREASURY';
  if (department === 'DHSC (Health)') return 'DHSC';
  if (department === 'Foreign Office') return 'FCDO';
  if (department === 'Ministry of Defence') return 'MOD';
  if (department === 'Energy & Net Zero') return 'DESNZ';
  if (department === 'Number 10') return 'NO. 10';
  return department.toUpperCase();
}

/**
 * A ministerial submission delivered as paper, not a generic pop-up.
 *
 * Choosing a course of action leads to a real signature step: the player draws
 * a signature on the pad and only then does the engine resolve the dossier.
 */
export function DossierMemo({ dossier, index, total, onClose }: DossierMemoProps) {
  const { state, dispatch } = useGame();
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'memo' | 'sign'>('memo');
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    setSelectedChoiceId(null);
    setPhase('memo');
    setHasInk(false);
  }, [dossier?.id]);

  if (!dossier) return null;

  const meta = getBriefingMeta(dossier);
  const selectedChoice = dossier.choices.find((choice) => choice.id === selectedChoiceId) ?? null;

  const sign = () => {
    if (!selectedChoice || !hasInk) return;
    dispatch({ type: 'RESOLVE_DOSSIER', dossierId: dossier.id, choiceId: selectedChoice.id });
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropHit}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerEyebrow}>
                {phase === 'memo' ? `CIVIL SERVICE BRIEFING · PAPER ${index} OF ${total}` : 'SIGNATURE REQUIRED'}
              </Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {phase === 'memo' ? 'Submission for decision' : 'Sign the order'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={8}
              style={styles.close}
            >
              <X size={20} color={colors.muted} strokeWidth={1.8} />
            </Pressable>
          </View>

          {phase === 'memo' ? (
            <>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.memoTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ref} numberOfLines={1}>
                      {dossier.department.toUpperCase()} · MONTH {state.week}
                    </Text>
                    <Text style={styles.from}>FROM THE PERMANENT SECRETARY</Text>
                    <Text style={styles.psName}>{meta.permanentSecretary}</Text>
                    <Text style={styles.psRole}>{meta.role}</Text>
                  </View>
                  <View style={styles.departmentStamp}>
                    <Text style={styles.departmentStampText}>{departmentStamp(dossier.department)}</Text>
                  </View>
                </View>

                <View style={styles.chipRow}>
                  <Chip label={dossier.urgent ? 'URGENT' : 'ROUTINE'} tone={dossier.urgent ? 'danger' : 'neutral'} />
                  <Chip label={`${dossier.weeksRemaining} MONTH${dossier.weeksRemaining === 1 ? '' : 'S'} LEFT`} tone="accent" />
                </View>

                <Text style={styles.memoTitle}>{dossier.title}</Text>
                <Text style={styles.lead}>{dossier.leadParagraph}</Text>
                <Text style={styles.body}>{dossier.body}</Text>

                <View style={styles.marginaliaWrap}>
                  <Text style={styles.marginalia}>{meta.marginalia}</Text>
                  <View style={styles.marginaliaRule} />
                </View>

                <Text style={styles.decisionLabel}>YOUR DECISION</Text>
                {dossier.choices.map((choice) => {
                  const selected = choice.id === selectedChoiceId;
                  return (
                    <Pressable
                      key={choice.id}
                      testID={`dossier-choice-${choice.id}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setSelectedChoiceId(choice.id)}
                      style={[styles.choice, selected && styles.choiceSelected]}
                    >
                      <View style={styles.choiceHead}>
                        <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>
                          {choice.label}
                        </Text>
                        {selected ? <Text style={styles.selectedMark}>SELECTED</Text> : null}
                      </View>
                      <Text style={styles.choiceSummary}>{choice.summary}</Text>
                      <EffectChips effects={choice.effects as Effects} />
                      {choice.effects.supportDelta && Object.values(choice.effects.supportDelta).some((value) => value !== 0) ? (
                        <View style={styles.coalitionRow}>
                          <Text style={styles.coalitionLabel}>WHO GAINS / LOSES</Text>
                          <View style={styles.coalitionChips}>
                            {Object.entries(choice.effects.supportDelta).map(([partyId, delta]) => {
                              const party = state.parties.find((p) => p.id === partyId);
                              if (!party || delta === 0) return null;
                              return (
                                <View key={partyId} style={styles.coalitionItem}>
                                  <View style={[styles.partyDot, { backgroundColor: party.color }]} />
                                  <Text style={styles.coalitionText}>
                                    {party.abbreviation} {delta > 0 ? '+' : ''}
                                    {delta}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      ) : null}
                      <Text style={styles.advice}>Adviser: {choice.advice}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.stickyFooter}>
                <View style={{ flex: 1, marginRight: spacing.md }}>
                  <Text style={styles.footerLabel}>
                    {selectedChoice ? 'READY FOR SIGNATURE' : 'SELECT A COURSE OF ACTION'}
                  </Text>
                  <Text style={styles.footerChoice} numberOfLines={1}>
                    {selectedChoice ? selectedChoice.label : 'Nothing is signed until you sign it.'}
                  </Text>
                </View>
                <Button
                  label="Sign"
                  disabled={!selectedChoice}
                  onPress={() => {
                    setHasInk(false);
                    setPhase('sign');
                  }}
                  testID="begin-signature"
                  style={{ marginTop: 0 }}
                />
              </View>
            </>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.signEyebrow}>ORDER OF THE PRIME MINISTER</Text>
              <Text style={styles.signTitle}>{selectedChoice?.label ?? dossier.title}</Text>
              <Text style={styles.signSummary}>{selectedChoice?.summary ?? dossier.leadParagraph}</Text>
              <View style={styles.signMeta}>
                <Text style={styles.signMetaText}>{dossier.department.toUpperCase()}</Text>
                <Text style={styles.signMetaText}>MONTH {state.week}</Text>
                <Text style={styles.signMetaText}>{dossier.urgent ? 'URGENT' : 'ROUTINE'}</Text>
              </View>

              <View style={styles.signatureHeading}>
                <Text style={styles.signatureLabel}>SIGNED BY THE PRIME MINISTER</Text>
                <Text style={styles.signatureHint}>Sign in the box below</Text>
              </View>
              <SignaturePad onChange={setHasInk} />

              <View style={styles.signActions}>
                <Button
                  label="Back to the paper"
                  variant="ghost"
                  compact
                  onPress={() => {
                    setHasInk(false);
                    setPhase('memo');
                  }}
                />
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Button
                    label="Sign and return"
                    compact
                    disabled={!hasInk}
                    onPress={sign}
                    testID="confirm-signature"
                  />
                </View>
              </View>
              <Text style={styles.signFootnote}>
                Your signature is drawn in the moment and is not stored. The decision is recorded in the Official Record.
              </Text>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(23, 17, 13, 0.7)',
  },
  backdropHit: { flex: 1 },
  sheet: {
    height: '94%',
    backgroundColor: colors.bgElevated,
    borderTopWidth: 2,
    borderTopColor: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  headerEyebrow: {
    color: colors.gold,
    fontFamily: fileFontFamily,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  headerTitle: {
    marginTop: 2,
    color: colors.text,
    fontFamily: headingFontFamily,
    fontSize: font.h2,
    fontWeight: '700',
  },
  close: { padding: 4, marginLeft: spacing.sm },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl },
  memoTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  ref: {
    color: colors.faint,
    fontFamily: fileFontFamily,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  from: {
    marginTop: spacing.md,
    color: colors.muted,
    fontFamily: fileFontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  psName: {
    marginTop: 3,
    color: colors.text,
    fontFamily: headingFontFamily,
    fontSize: font.h3,
    fontWeight: '700',
  },
  psRole: { marginTop: 2, color: colors.faint, fontSize: font.tiny },
  departmentStamp: {
    width: 58,
    height: 58,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '7deg' }],
  },
  departmentStampText: {
    color: colors.gold,
    fontFamily: fileFontFamily,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
    lineHeight: 9,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  memoTitle: {
    marginTop: spacing.md,
    color: colors.text,
    fontFamily: headingFontFamily,
    fontSize: 23,
    fontWeight: '700',
    lineHeight: 27,
  },
  lead: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: font.body,
    fontWeight: '700',
    lineHeight: 21,
  },
  body: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: font.small,
    lineHeight: 19,
  },
  marginaliaWrap: {
    alignSelf: 'flex-end',
    width: '58%',
    marginTop: spacing.sm,
    transform: [{ rotate: '-3deg' }],
  },
  marginalia: {
    color: colors.danger,
    fontFamily: handFont,
    fontSize: 23,
    lineHeight: 24,
    textAlign: 'right',
  },
  marginaliaRule: {
    height: 1,
    marginTop: spacing.xs,
    marginLeft: '35%',
    backgroundColor: colors.danger,
    opacity: 0.6,
    transform: [{ rotate: '-2deg' }],
  },
  decisionLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    color: colors.muted,
    fontFamily: fileFontFamily,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  choice: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  choiceSelected: { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.accentSoft },
  choiceHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  choiceLabel: { flex: 1, color: colors.accent, fontSize: font.body, fontWeight: '700', lineHeight: 20 },
  choiceLabelSelected: { color: colors.accentDeep },
  selectedMark: {
    color: colors.success,
    fontFamily: fileFontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 3,
  },
  choiceSummary: { marginTop: 3, color: colors.muted, fontSize: font.small, lineHeight: 18 },
  coalitionRow: { marginTop: spacing.sm },
  coalitionLabel: {
    color: colors.gold,
    fontFamily: fileFontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 3,
  },
  coalitionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  coalitionItem: { flexDirection: 'row', alignItems: 'center' },
  partyDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  coalitionText: { color: colors.text, fontFamily: fileFontFamily, fontSize: 10, fontWeight: '700' },
  advice: { marginTop: spacing.sm, color: colors.muted, fontSize: font.tiny, fontStyle: 'italic', lineHeight: 17 },
  stickyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  footerLabel: {
    color: colors.gold,
    fontFamily: fileFontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  footerChoice: { marginTop: 2, color: colors.text, fontSize: font.small, fontWeight: '700' },
  signEyebrow: {
    color: colors.gold,
    fontFamily: fileFontFamily,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 1,
  },
  signTitle: {
    marginTop: spacing.xs,
    color: colors.text,
    fontFamily: headingFontFamily,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  signSummary: { marginTop: spacing.sm, color: colors.muted, fontSize: font.body, lineHeight: 21 },
  signMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  signMetaText: {
    color: colors.faint,
    fontFamily: fileFontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  signatureHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  signatureLabel: {
    color: colors.muted,
    fontFamily: fileFontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  signatureHint: { color: colors.faint, fontSize: font.tiny, fontStyle: 'italic' },
  signActions: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  signFootnote: { marginTop: spacing.md, color: colors.faint, fontSize: font.tiny, lineHeight: 17 },
});
