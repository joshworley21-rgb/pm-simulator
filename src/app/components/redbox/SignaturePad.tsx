import React, { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fileFontFamily, font, spacing } from '../../theme';

export interface SignaturePadProps {
  /** Called whenever ink starts or is cleared. */
  onChange: (hasInk: boolean) => void;
}

/**
 * A real-time signature pad. The path is kept locally; the parent only needs to
 * know whether the minister has actually put pen to paper.
 */
export function SignaturePad({ onChange }: SignaturePadProps) {
  const [path, setPath] = useState('');
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const pathRef = useRef('');
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const isDrawing = useRef(false);

  const updatePath = (next: string) => {
    pathRef.current = next;
    setPath(next);
  };

  const pointFor = (event: { nativeEvent: { locationX: number; locationY: number } }) => {
    const width = layout.width || 300;
    const height = layout.height || 160;
    return {
      x: Math.max(0, Math.min(width, event.nativeEvent.locationX)),
      y: Math.max(0, Math.min(height, event.nativeEvent.locationY)),
    };
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          isDrawing.current = true;
          const point = pointFor(event);
          lastPoint.current = point;
          updatePath(`M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
          onChange(true);
        },
        onPanResponderMove: (event) => {
          if (!isDrawing.current) return;
          const point = pointFor(event);
          const previous = lastPoint.current;
          if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 1.2) return;
          lastPoint.current = point;
          updatePath(`${pathRef.current} L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
          onChange(true);
        },
        onPanResponderRelease: () => {
          isDrawing.current = false;
          lastPoint.current = null;
        },
        onPanResponderTerminate: () => {
          isDrawing.current = false;
          lastPoint.current = null;
        },
      }),
    [layout.height, layout.width, onChange],
  );

  const clear = () => {
    updatePath('');
    lastPoint.current = null;
    onChange(false);
  };

  return (
    <View>
      <View
        style={styles.pad}
        onLayout={(event: LayoutChangeEvent) => setLayout(event.nativeEvent.layout)}
        {...panResponder.panHandlers}
        accessibilityLabel="Signature pad. Draw your signature with a finger or mouse."
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width="100%" height="100%">
            {path ? (
              <Path
                d={path}
                stroke={colors.ink}
                strokeWidth={2.2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </Svg>
        </View>
        {!path ? <Text style={styles.placeholder}>Sign here</Text> : null}
        <View style={styles.baseline} pointerEvents="none" />
        <Text style={styles.cross} pointerEvents="none">X</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.caption}>DRAWN IN INK · NOT STORED</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear signature"
          onPress={clear}
          disabled={!path}
          hitSlop={8}
        >
          <Text style={[styles.clear, !path && styles.clearDisabled]}>Clear signature</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    position: 'relative',
    height: 168,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  placeholder: {
    position: 'absolute',
    left: spacing.lg,
    top: 54,
    color: colors.faint,
    fontFamily: 'cursive',
    fontSize: 27,
    opacity: 0.55,
  },
  baseline: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 37,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorderLight,
  },
  cross: {
    position: 'absolute',
    left: spacing.lg - 2,
    bottom: 23,
    color: colors.gold,
    fontFamily: fileFontFamily,
    fontSize: font.small,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  caption: {
    color: colors.faint,
    fontFamily: fileFontFamily,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  clear: {
    color: colors.accent,
    fontSize: font.small,
    fontWeight: '700',
  },
  clearDisabled: { color: colors.faint, opacity: 0.55 },
});
