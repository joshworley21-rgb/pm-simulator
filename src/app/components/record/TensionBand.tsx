import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import type { GameState } from '../../types';
import { deriveCalendar, deriveTensionIndex, type TensionTone } from '../../tension';
import { colors, fileFontFamily, font, headingFontFamily, spacing } from '../../theme';
import { Meter } from '../ui';

const TONE_COLOR: Record<TensionTone, string> = {
  success: colors.success,
  accent: colors.accent,
  warning: colors.warning,
  danger: colors.danger,
};

const SEGMENTS = 24;
const TENSION_STOPS = ['#2F6B44', '#8A6B2E', '#8A5A0B', '#9E2B20'];

const DRIVER_NOTES: Record<string, string> = {
  APPROVAL: '100 minus public approval. Higher means weaker approval.',
  PARTY: '100 minus party confidence. Higher means a more restive party.',
  PRESS: 'How hostile the press mood is, averaged across outlets.',
  LEADERSHIP: 'Progress toward the party’s leadership-challenge threshold.',
  FACTIONS: 'The engine’s faction-unrest reading.',
  GILTS: 'Bond-market pressure above a 2% gilt yield.',
  CRISIS: 'An active black swan drives this close to maximum.',
};

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function segmentColor(index: number): string {
  const t = index / (SEGMENTS - 1);
  const scaled = t * (TENSION_STOPS.length - 1);
  const from = Math.min(TENSION_STOPS.length - 2, Math.floor(scaled));
  const mix = scaled - from;
  const a = hexToRgb(TENSION_STOPS[from]);
  const b = hexToRgb(TENSION_STOPS[from + 1]);
  const rgb = a.map((channel, i) => Math.round(channel + (b[i] - channel) * mix));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/**
 * The State of the Nation strip: one tension reading, its inputs, and the
 * parliamentary calendar. Everything shown is derived from live engine state.
 */
export function TensionBand({ state }: { state: GameState }) {
  const [open, setOpen] = useState(false);
  const tension = deriveTensionIndex(state);
  const calendar = deriveCalendar(state);
  const tone = TONE_COLOR[tension.tone];

  return (
    <>
    <Pressable
      onPress={() => setOpen(true)}
      accessibilityRole="button"
      accessibilityLabel={`National tension ${tension.value}, ${tension.label}. Open the drivers.`}
    >
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>NATIONAL TENSION INDEX ›</Text>
        <Text style={[styles.value, { color: tone }]}>
          {tension.value} <Text style={styles.state}>{tension.label}</Text>
        </Text>
      </View>

      <View style={styles.track}>
        {Array.from({ length: SEGMENTS }).map((_, index) => (
          <View key={`tension-${index}`} style={[styles.segment, { backgroundColor: segmentColor(index) }]} />
        ))}
        <View style={[styles.marker, { left: `${tension.value}%` as `${number}%` }]} />
      </View>

      <View style={styles.components}>
        {tension.components.slice(0, 4).map((component) => (
          <Text key={component.label} style={styles.component}>
            {component.label} <Text style={styles.componentValue}>{component.value}</Text>
          </Text>
        ))}
      </View>

      <View style={styles.calendar}>
        {calendar.map((chip) => (
          <View key={chip.label} style={[styles.chip, { borderColor: TONE_COLOR[chip.tone] }]}>
            <Text style={[styles.chipText, { color: TONE_COLOR[chip.tone] }]} numberOfLines={1}>
              {chip.label}
            </Text>
          </View>
        ))}
      </View>

    </View>
    </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropHit} onPress={() => setOpen(false)} accessibilityLabel="Close" />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetEyebrow}>STATE OF THE NATION · DRIVERS</Text>
                <Text style={styles.sheetTitle}>Why tension is {tension.value}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setOpen(false)}
                hitSlop={8}
                style={styles.sheetClose}
              >
                <X size={20} color={colors.muted} strokeWidth={1.8} />
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetIntro}>
                The index weighs public approval, party confidence, press hostility, leadership pressure, faction unrest, gilt pressure and any live crisis.
              </Text>
              {tension.components.map((component) => (
                <View key={component.label} style={styles.driverRow}>
                  <View style={styles.driverHead}>
                    <Text style={styles.driverLabel}>{component.label}</Text>
                    <Text style={styles.driverValue}>{component.value}</Text>
                  </View>
                  <Meter
                    value={component.value}
                    color={component.value >= 70 ? colors.danger : component.value >= 45 ? colors.warning : colors.success}
                  />
                  <Text style={styles.driverNote}>{DRIVER_NOTES[component.label] ?? 'A live input to the index.'}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.ink,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  eyebrow: {
    color: colors.muted,
    fontFamily: fileFontFamily,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  value: {
    fontFamily: fileFontFamily,
    fontSize: font.h3,
    fontWeight: '800',
  },
  state: { fontSize: font.tiny, letterSpacing: 0.7 },
  track: {
    position: 'relative',
    flexDirection: 'row',
    height: 9,
    marginTop: spacing.sm,
    backgroundColor: colors.cardBorderLight,
  },
  segment: { flex: 1, height: '100%' },
  marker: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: 17,
    backgroundColor: colors.ink,
  },
  components: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  component: {
    color: colors.faint,
    fontFamily: fileFontFamily,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  componentValue: { color: colors.muted, fontWeight: '800' },
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: colors.cardAlt,
  },
  chipText: {
    fontFamily: fileFontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,17,13,0.7)' },
  backdropHit: { flex: 1 },
  sheet: {
    height: '78%',
    backgroundColor: colors.bgElevated,
    borderTopWidth: 2,
    borderTopColor: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  sheetEyebrow: { color: colors.gold, fontFamily: fileFontFamily, fontSize: font.tiny, fontWeight: '800', letterSpacing: 1 },
  sheetTitle: { marginTop: 2, color: colors.text, fontFamily: headingFontFamily, fontSize: font.h2, fontWeight: '700' },
  sheetClose: { padding: 4, marginLeft: spacing.sm },
  sheetIntro: { color: colors.muted, fontSize: font.small, lineHeight: 19, marginBottom: spacing.sm },
  driverRow: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.cardBorderLight },
  driverHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  driverLabel: { color: colors.text, fontFamily: fileFontFamily, fontSize: 10, fontWeight: '800', letterSpacing: .7 },
  driverValue: { color: colors.text, fontFamily: fileFontFamily, fontSize: 12, fontWeight: '800' },
  driverNote: { marginTop: 4, color: colors.faint, fontSize: font.tiny, lineHeight: 16 },
});
