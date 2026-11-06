import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fileFontFamily, font, headingFontFamily, spacing } from '../../theme';

export interface SwingometerProps {
  /** The player's party. */
  player: { abbreviation: string; color: string; currentSupport: number; baseSupport: number };
  /** The largest rival party. */
  rival: { abbreviation: string; color: string; currentSupport: number; baseSupport: number };
  /** Half-width of the swing scale in percentage points (default ±10). */
  range?: number;
}

const swingOf = (p: { currentSupport: number; baseSupport: number }) => p.currentSupport - p.baseSupport;

/**
 * The Swingometer.
 *
 * One needle for the government, one for the official opposition, both
 * measured against their result at the last election. Reads like the classic
 * election-night instrument rather than a poll grid.
 */
export function Swingometer({ player, rival, range = 10 }: SwingometerProps) {
  const playerSwing = swingOf(player);
  const rivalSwing = swingOf(rival);
  const pos = (swing: number) => 50 + (Math.max(-range, Math.min(range, swing)) / range) * 50;

  return (
    <View>
      <View style={styles.labels}>
        <Text style={styles.labelLeft}>LOST GROUND</Text>
        <Text style={styles.labelRight}>GAINED</Text>
      </View>

      <View style={styles.track}>
        <View style={styles.notch} />
        <View style={[styles.needle, { left: `${pos(playerSwing)}%`, backgroundColor: player.color, height: 26 }]} />
        <View style={[styles.needle, styles.needleRival, { left: `${pos(rivalSwing)}%`, backgroundColor: rival.color }]} />
      </View>
      <View style={styles.scaleRow}>
        <Text style={styles.scaleText}>-{range}pp</Text>
        <Text style={styles.scaleText}>no change</Text>
        <Text style={styles.scaleText}>+{range}pp</Text>
      </View>

      <View style={styles.readout}>
        <View style={styles.readoutItem}>
          <View style={[styles.dot, { backgroundColor: player.color }]} />
          <Text style={styles.readoutText}>
            {player.abbreviation} {playerSwing >= 0 ? '+' : ''}
            {playerSwing.toFixed(1)}pp
          </Text>
        </View>
        <View style={styles.readoutItem}>
          <View style={[styles.dot, { backgroundColor: rival.color }]} />
          <Text style={styles.readoutText}>
            {rival.abbreviation} {rivalSwing >= 0 ? '+' : ''}
            {rivalSwing.toFixed(1)}pp
          </Text>
        </View>
      </View>
      <Text style={styles.caption}>Swing since the last general election.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  labelLeft: { color: colors.muted, fontSize: font.tiny, fontWeight: '700', letterSpacing: 1 },
  labelRight: { color: colors.muted, fontSize: font.tiny, fontWeight: '700', letterSpacing: 1 },
  track: {
    height: 26,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.cardBorderLight,
    borderRadius: 4,
    justifyContent: 'center',
  },
  notch: { position: 'absolute', left: '50%', top: -3, bottom: -3, width: 2, backgroundColor: colors.cardBorder },
  needle: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    width: 6,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.onAccent,
  },
  needleRival: { width: 4, top: 4, bottom: 4, borderWidth: 0 },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  scaleText: { color: colors.faint, fontSize: 11, fontFamily: fileFontFamily },
  readout: { flexDirection: 'row', marginTop: spacing.sm },
  readoutItem: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.lg },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  readoutText: { color: colors.text, fontSize: font.small, fontWeight: '700', fontFamily: headingFontFamily },
  caption: { color: colors.faint, fontSize: font.tiny, marginTop: 4 },
});