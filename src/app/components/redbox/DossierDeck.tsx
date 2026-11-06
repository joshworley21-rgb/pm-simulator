import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { Button, EmptyState } from '../ui';
import { colors, fileFontFamily, font, headingFontFamily, spacing } from '../../theme';
import { readStorageString, writeStorageString } from '../../../storage/saveManager';
import type { Dossier } from '../../types';

export interface DossierDeckProps {
  dossiers: Dossier[];
  onOpen: (dossierId: string) => void;
}

/**
 * The red box as a physical deck of papers.
 *
 * Swipe left to move a submission to the back of the box; swipe right to open
 * it. The buttons below the card do the same thing for keyboard and screen
 * reader users — gestures are an accelerator, never the only route.
 */
const HINT_KEY = 'pm-sim-deck-hint-seen';
const HINT_TEXT = 'Swipe left to shelve · right to open. The buttons work too.';

export function DossierDeck({ dossiers, onOpen }: DossierDeckProps) {
  const [order, setOrder] = useState<string[]>(() => dossiers.map((d) => d.id));
  const [showHint, setShowHint] = useState(false);
  const pan = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const value = readStorageString(HINT_KEY);
    if (value !== '1' && dossiers.length > 0) setShowHint(true);
  }, [dossiers.length]);

  const dismissHint = () => {
    setShowHint(false);
    writeStorageString(HINT_KEY, '1');
  };

  useEffect(() => {
    setOrder((previous) => {
      const ids = new Set(dossiers.map((d) => d.id));
      const kept = previous.filter((id) => ids.has(id));
      const added = dossiers.map((d) => d.id).filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [dossiers]);

  const current = dossiers.find((d) => d.id === order[0]) ?? dossiers[0];
  const next = dossiers.find((d) => d.id === order[1]);
  const after = dossiers.find((d) => d.id === order[2]);

  useEffect(() => {
    pan.setValue(0);
  }, [current?.id, pan]);

  const moveToBack = () => {
    setOrder((previous) => (previous.length <= 1 ? previous : [...previous.slice(1), previous[0]]));
  };

  const shelve = () => {
    Animated.timing(pan, {
      toValue: -430,
      duration: 170,
      useNativeDriver: true,
    }).start(() => {
      pan.setValue(0);
      moveToBack();
    });
  };

  const open = () => {
    if (!current) return;
    const id = current.id;
    Animated.timing(pan, {
      toValue: 430,
      duration: 170,
      useNativeDriver: true,
    }).start(() => {
      pan.setValue(0);
      onOpen(id);
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 7 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.15,
        onPanResponderMove: (_, gesture) => {
          pan.setValue(gesture.dx);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > 78) {
            open();
          } else if (gesture.dx < -78) {
            shelve();
          } else {
            Animated.spring(pan, {
              toValue: 0,
              speed: 22,
              bounciness: 5,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(pan, {
            toValue: 0,
            speed: 22,
            bounciness: 5,
            useNativeDriver: true,
          }).start();
        },
      }),
    [pan, current?.id],
  );

  if (!current) {
    return <EmptyState title="Box cleared" body="Nothing awaiting signature. Advance the month to see what lands next." />;
  }

  const rotate = pan.interpolate({
    inputRange: [-220, 0, 220],
    outputRange: ['-5deg', '0deg', '5deg'],
    extrapolate: 'clamp',
  });
  const shelveOpacity = pan.interpolate({
    inputRange: [-100, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const openOpacity = pan.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.deck} testID="dossier-deck">
      {showHint ? (
        <View style={styles.firstHint}>
          <Text style={styles.firstHintText}>{HINT_TEXT}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss swipe hint"
            onPress={dismissHint}
            hitSlop={8}
          >
            <Text style={styles.firstHintDismiss}>GOT IT</Text>
          </Pressable>
        </View>
      ) : null}
      {after ? <View style={[styles.back, styles.backTwo]} /> : null}
      {next ? <View style={[styles.back, styles.backOne]} /> : null}

      <Animated.View
        style={[styles.cardWrap, { transform: [{ translateX: pan }, { rotate }] }]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.card, current.urgent && styles.cardUrgent]}>
          <View style={styles.metaRow}>
            <Text style={[styles.department, current.urgent && styles.departmentUrgent]} numberOfLines={1}>
              {current.department.toUpperCase()}
            </Text>
            <Text style={[styles.deadline, current.urgent && styles.deadlineUrgent]}>
              {current.urgent ? 'URGENT · ' : ''}
              {current.weeksRemaining}M LEFT
            </Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {current.title}
          </Text>
          <Text style={styles.body} numberOfLines={3}>
            {current.leadParagraph}
          </Text>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Shelve paper"
              onPress={shelve}
              hitSlop={8}
              style={styles.shelve}
            >
              <ArrowLeft size={13} color={colors.faint} strokeWidth={2} />
              <Text style={styles.shelveText}>SHELVE</Text>
            </Pressable>
            <View style={styles.decide}>
              <Button label="Decide" onPress={open} compact testID={`open-dossier-${current.id}`} />
            </View>
          </View>
        </View>

        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampShelve, { opacity: shelveOpacity }]}>
          <Text style={styles.stampText}>SHELVE</Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampOpen, { opacity: openOpacity }]}>
          <Text style={styles.stampText}>OPEN</Text>
        </Animated.View>
      </Animated.View>

      <View style={styles.hintRow}>
        <Text style={styles.hint}>← SWIPE TO SHELVE</Text>
        <Text style={styles.count}>
          {Math.min(dossiers.findIndex((d) => d.id === current.id) + 1, dossiers.length)} OF {dossiers.length}
        </Text>
        <Text style={styles.hint}>SWIPE TO OPEN →</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deck: {
    position: 'relative',
    minHeight: 224,
    marginTop: spacing.sm,
    paddingBottom: 20,
  },
  back: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 8,
    height: 168,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.cardBorderLight,
  },
  backOne: { transform: [{ translateY: -6 }, { scaleX: 0.975 }] },
  backTwo: { transform: [{ translateY: -12 }, { scaleX: 0.95 }], opacity: 0.72 },
  cardWrap: { position: 'relative' },
  card: {
    minHeight: 172,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorderLight,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 3,
  },
  cardUrgent: { borderLeftWidth: 4, borderLeftColor: colors.danger },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  department: {
    flex: 1,
    color: colors.accent,
    fontFamily: fileFontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  departmentUrgent: { color: colors.danger },
  deadline: {
    color: colors.faint,
    fontFamily: fileFontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  deadlineUrgent: { color: colors.danger },
  title: {
    marginTop: spacing.xs,
    color: colors.text,
    fontFamily: headingFontFamily,
    fontSize: font.h3,
    fontWeight: '700',
    lineHeight: 21,
  },
  body: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: font.small,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorderLight,
  },
  shelve: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32, paddingRight: spacing.md },
  shelveText: {
    color: colors.faint,
    fontFamily: fileFontFamily,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  decide: { minWidth: 92 },
  stamp: {
    position: 'absolute',
    top: 62,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 2,
    backgroundColor: colors.card,
  },
  stampShelve: { left: 18, borderColor: colors.faint, transform: [{ rotate: '-8deg' }] },
  stampOpen: { right: 18, borderColor: colors.accent, transform: [{ rotate: '8deg' }] },
  stampText: {
    color: colors.ink,
    fontFamily: fileFontFamily,
    fontSize: font.small,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  hintRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hint: { color: colors.faint, fontFamily: fileFontFamily, fontSize: 8, letterSpacing: 0.55 },
  count: { color: colors.gold, fontFamily: fileFontFamily, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  firstHint: {
    position: 'relative',
    zIndex: 5,
    elevation: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.cardAlt,
  },
  firstHintText: {
    flex: 1,
    color: colors.text,
    fontSize: font.small,
    lineHeight: 17,
  },
  firstHintDismiss: {
    color: colors.accent,
    fontFamily: fileFontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: .7,
  },
});
