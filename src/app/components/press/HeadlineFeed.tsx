import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Chip } from '../ui';
import { colors, font, spacing } from '../../theme';
import { PRESS_HOSTILE_MARK, PRESS_WARM_MARK } from '../../media';

/** Structurally identical to an element of GameState.headlines. */
export interface HeadlineItem {
  paper: string;
  title: string;
  stance: 'left' | 'centrist' | 'right';
}

export interface HeadlineFeedProps {
  headlines: HeadlineItem[];
  /** Cap the number rendered (most recent first). */
  limit?: number;
}

/** A paper's political lean, as a chip. */
const STANCE_TONE: Record<HeadlineItem['stance'], 'accent' | 'neutral' | 'warning'> = {
  left: 'accent',
  centrist: 'neutral',
  right: 'warning',
};

const STANCE_LABEL: Record<HeadlineItem['stance'], string> = {
  left: 'Left',
  centrist: 'Centrist',
  right: 'Right',
};

/**
 * Recent coverage.
 *
 * The hostile / warm marks are the engine's own appended suffixes
 * (PRESS_HOSTILE_MARK / PRESS_WARM_MARK), so the badge reflects what the
 * media module actually did to the copy rather than a UI guess.
 */
export function HeadlineFeed({ headlines, limit }: HeadlineFeedProps) {
  const items = typeof limit === 'number' ? headlines.slice(0, limit) : headlines;

  return (
    <View>
      {items.map((h, i) => {
        const hostile = h.title.endsWith(PRESS_HOSTILE_MARK);
        const warm = h.title.endsWith(PRESS_WARM_MARK);
        return (
          <Card key={`${h.paper}-${i}`} tone={hostile ? 'danger' : 'default'}>
            <View style={styles.header}>
              <Text style={styles.paper} numberOfLines={1}>
                {h.paper.toUpperCase()}
              </Text>
              <Chip label={STANCE_LABEL[h.stance]} tone={STANCE_TONE[h.stance]} />
            </View>
            <Text style={styles.title}>{h.title}</Text>
            {hostile || warm ? (
              <View style={styles.markRow}>
                <Chip
                  label={hostile ? 'HOSTILE COVERAGE' : 'WARM COVERAGE'}
                  tone={hostile ? 'danger' : 'success'}
                />
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paper: {
    color: colors.accent,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 0.8,
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: font.h3,
    fontWeight: '800',
    marginTop: spacing.xs,
    lineHeight: 22,
  },
  markRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
});
