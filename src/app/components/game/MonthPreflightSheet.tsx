import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useGame } from '../../state';
import { Button, Chip, Sheet } from '../ui';
import { isCabinetMeetingDue } from '../../cabinetMeeting';
import { PURDAH_TURNS } from '../../calendar';
import { colors, fileFontFamily, font, headingFontFamily, spacing } from '../../theme';

export interface MonthPreflightSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdvance: () => void;
}

type Item = {
  label: string;
  detail: string;
  tone: 'danger' | 'warning' | 'accent' | 'success';
};

/**
 * A deliberate pause before the month turns over. It surfaces every deadline
 * that will still be waiting on the other side, then lets the player advance.
 */
export function MonthPreflightSheet({ visible, onClose, onAdvance }: MonthPreflightSheetProps) {
  const { state } = useGame();
  const urgent = state.redBox.filter((dossier) => dossier.urgent).length;
  const meetingDue = isCabinetMeetingDue(state);
  const inPurdah = state.turnsUntilElection <= PURDAH_TURNS;

  const items: Item[] = [];
  if (urgent > 0) {
    items.push({
      label: `${urgent} urgent submission${urgent === 1 ? '' : 's'} unsigned`,
      detail: 'Ignored urgent papers can become scandals.',
      tone: 'danger',
    });
  }
  if (meetingDue) {
    items.push({
      label: 'Cabinet meeting not yet held',
      detail: 'The Cabinet Secretary is still waiting for you in the Cabinet Room.',
      tone: 'warning',
    });
  }
  if (state.pmq) {
    items.push({
      label: 'PMQs waiting',
      detail: 'The Opposition has questions ready.',
      tone: 'warning',
    });
  }
  if (state.budgetDue) {
    items.push({
      label: state.fiscalEventKind === 'autumn' ? 'Autumn Statement due' : 'Budget due',
      detail: 'The Treasury needs a decision before the fiscal event passes.',
      tone: 'warning',
    });
  }
  if (inPurdah) {
    items.push({
      label: `Purdah in force · ${Math.max(0, state.turnsUntilElection)} month${Math.max(0, state.turnsUntilElection) === 1 ? '' : 's'} to polling`,
      detail: 'No new bills and no emergency fiscal action.',
      tone: 'accent',
    });
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={`MONTH ${state.week} · PRE-FLIGHT`}
      title={`Advance to Month ${state.week + 1}?`}
    >
      <View>
        <Text style={styles.intro}>
          The month will move on whether or not the red box is clear. These items will still be waiting when it does.
        </Text>

        {items.length === 0 ? (
          <View style={styles.clean}>
            <Chip label="CLEAR" tone="success" />
            <Text style={styles.cleanText}>No urgent papers, meetings or fiscal events are outstanding.</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.label} style={styles.row}>
              <View style={[styles.marker, { backgroundColor: colors[item.tone === 'accent' ? 'accent' : item.tone] }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowDetail}>{item.detail}</Text>
              </View>
            </View>
          ))
        )}

        <View style={styles.actions}>
          <Button
            label={`Advance to Month ${state.week + 1}`}
            onPress={onAdvance}
            testID="confirm-advance-week"
          />
          <View style={{ marginTop: spacing.xs }}>
            <Button label={`Stay in Month ${state.week}`} variant="ghost" onPress={onClose} />
          </View>
        </View>
        <Text style={styles.footnote}>
          Anything still unsigned will carry into the new month with one less month on its clock.
        </Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, fontSize: font.small, lineHeight: 19 },
  clean: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.success,
  },
  cleanText: { flex: 1, color: colors.text, fontSize: font.small, marginLeft: spacing.sm, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorderLight,
  },
  marker: { width: 3, alignSelf: 'stretch', marginRight: spacing.sm },
  rowLabel: { color: colors.text, fontSize: font.body, fontWeight: '700', fontFamily: headingFontFamily },
  rowDetail: { marginTop: 2, color: colors.muted, fontSize: font.small, lineHeight: 18 },
  actions: { marginTop: spacing.lg },
  footnote: { marginTop: spacing.md, color: colors.faint, fontSize: font.tiny, lineHeight: 17, fontFamily: fileFontFamily },
});
