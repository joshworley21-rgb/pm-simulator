import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chip } from '../ui';
import { colors, font, spacing } from '../../theme';
import { PRESS_HOSTILE_MARK, PRESS_WARM_MARK } from '../../media';

/** Structurally identical to an element of GameState.headlines. */
export interface HeadlineItem {
  paper: string;
  title: string;
  stance: 'left' | 'centrist' | 'right';
}

export interface NewsTickerProps {
  headlines: HeadlineItem[];
  /** Cap the number rendered (most recent first). */
  limit?: number;
}

/**
 * Broadcast-style rolling news wire.
 *
 * The newest line runs in a red "live" bar; older lines sit in compact wire
 * slips beside it. Deliberately not newspaper front pages — this is how the
 * rolling channels carry the story, not how the papers print it.
 */
export function NewsTicker({ headlines, limit }: NewsTickerProps) {
  const items = typeof limit === 'number' ? headlines.slice(0, limit) : headlines;
  const lead = items[0];
  const rest = items.slice(1);
  const leadOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!lead) return;
    leadOpacity.setValue(0.65);
    Animated.timing(leadOpacity, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [lead?.title, leadOpacity]);
  if (!lead) return null;

  return (
    <View>
      <View style={styles.liveBar}>
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
        <Animated.View style={[styles.liveText, { opacity: leadOpacity }]}>
          <Text style={styles.livePaper} numberOfLines={1}>
            {lead.paper.toUpperCase()}
          </Text>
          <Text style={styles.liveHeadline} numberOfLines={2}>
            {stripMark(lead.title)}
          </Text>
        </Animated.View>
      </View>

      {rest.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.wire}>
          {rest.map((h, i) => {
            const hostile = h.title.endsWith(PRESS_HOSTILE_MARK);
            const warm = h.title.endsWith(PRESS_WARM_MARK);
            return (
              <View key={`${h.paper}-${i}`} style={styles.slip}>
                <Text style={styles.slipPaper} numberOfLines={1}>
                  {h.paper.toUpperCase()}
                </Text>
                <Text style={styles.slipHeadline} numberOfLines={3}>
                  {stripMark(h.title)}
                </Text>
                {hostile || warm ? (
                  <View style={styles.slipMark}>
                    <Chip
                      label={hostile ? 'HOSTILE' : 'WARM'}
                      tone={hostile ? 'danger' : 'success'}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/** The engine appends its coverage mark to the raw copy; the wire reads clean. */
function stripMark(title: string): string {
  if (title.endsWith(PRESS_HOSTILE_MARK)) return title.slice(0, -PRESS_HOSTILE_MARK.length).trim();
  if (title.endsWith(PRESS_WARM_MARK)) return title.slice(0, -PRESS_WARM_MARK.length).trim();
  return title;
}

const styles = StyleSheet.create({
  liveBar: {
    backgroundColor: colors.card,
    borderTopWidth: 2,
    borderBottomWidth: 1,
    borderColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  liveBadge: {
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 0,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginRight: spacing.sm,
  },
  liveBadgeText: {
    color: colors.onAccent,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  liveText: { flex: 1 },
  livePaper: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  liveHeadline: {
    color: colors.text,
    fontSize: font.small,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 2,
  },
  wire: { marginTop: spacing.sm },
  slip: {
    width: 220,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorderLight,
    borderTopWidth: 1,
    borderTopColor: colors.ink,
    borderRadius: 0,
    padding: spacing.md,
    marginRight: spacing.sm,
  },
  slipPaper: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  slipHeadline: {
    color: colors.text,
    fontSize: font.small,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 4,
  },
  slipMark: { flexDirection: 'row', marginTop: spacing.sm },
});
