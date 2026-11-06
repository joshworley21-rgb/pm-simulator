import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useGame } from '../../state';
import { Button, Chip, EffectChips } from '../ui';
import {
  buildCabinetMeeting,
  type CabinetAttendee,
  type CabinetMeetingOption,
  type CabinetMeetingOutcome,
  type CabinetMeetingPlan,
  resolveCabinetMeeting,
} from '../../cabinetMeeting';
import { colors, fileFontFamily, font, headingFontFamily, spacing } from '../../theme';
import type { Effects } from '../../types';

export interface CabinetMeetingModalProps {
  visible: boolean;
  onClose: () => void;
}

type Phase = 'briefing' | 'agenda' | 'collective' | 'summary';

const TONE_COLOR = {
  support: colors.success,
  caution: colors.warning,
  challenge: colors.danger,
} as const;

const COLLECTIVE_OPTIONS: CabinetMeetingOption[] = [
  {
    id: 'collective-united',
    label: 'Present a united front',
    summary: 'Collective responsibility holds. The party absorbs the cost, but the government looks in control.',
    effects: { partyConfidence: 2, approval: -1 },
    cohesionDelta: 2,
    factionUnrestDelta: -1,
  },
  {
    id: 'collective-free',
    label: 'Let ministers speak freely',
    summary: 'The debate goes public. It may play well in the country, but not in the whips’ office.',
    effects: { approval: 1, partyConfidence: -2 },
    cohesionDelta: -3,
    factionUnrestDelta: 2,
  },
];

function initials(name: string): string {
  const parts = name.replace(/[^A-Za-z\u00C0-\u024F ]/g, '').trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

function shortPost(post: string): string {
  return post
    .replace('Chancellor of the Exchequer', 'Chancellor')
    .replace(' Secretary', '');
}

function attendeeLabel(attendee: CabinetAttendee): string {
  if (attendee.kind === 'pm') return 'PM';
  if (attendee.kind === 'official') return 'OFFICIAL';
  return attendee.coalition ? 'COALITION' : 'MINISTER';
}

/**
 * The full Cabinet in one room: every minister in state.cabinet, the Cabinet
 * Secretary, Chief Whip, Attorney General and National Security Adviser.
 *
 * The flow mirrors a real morning in No. 10: bilaterals, the Quad, the full
 * Cabinet agenda, collective responsibility, then the minutes. Only the final
 * plan is sent to the engine.
 */
export function CabinetMeetingModal({ visible, onClose }: CabinetMeetingModalProps) {
  const { state, dispatch } = useGame();
  const insets = useSafeAreaInsets();
  const meeting = useMemo(() => buildCabinetMeeting(state), [state]);

  const [phase, setPhase] = useState<Phase>('briefing');
  const [index, setIndex] = useState(0);
  const [bilateralChoices, setBilateralChoices] = useState<Record<string, string>>({});
  const [quadOptionId, setQuadOptionId] = useState<string | undefined>();
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [collective, setCollective] = useState<'united' | 'free' | undefined>();
  const [outcome, setOutcome] = useState<CabinetMeetingOutcome | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPhase('briefing');
    setIndex(0);
    setBilateralChoices({});
    setQuadOptionId(undefined);
    setDecisions({});
    setCollective(undefined);
    setOutcome(null);
  }, [visible, meeting.week]);

  const current = meeting.items[index];
  const selectedId = current ? decisions[current.id] : undefined;
  const selectedOption = current?.options.find((option) => option.id === selectedId);
  const lastItem = index === meeting.items.length - 1;
  const bilateralsReady = meeting.bilaterals.every((bilateral) => bilateralChoices[bilateral.id]);
  const briefingReady = bilateralsReady && !!quadOptionId;

  const buildPlan = (collectiveChoice?: 'united' | 'free'): CabinetMeetingPlan => ({
    decisions: meeting.items.map((item) => ({
      itemId: item.id,
      optionId: decisions[item.id],
    })),
    bilateralChoices,
    quadOptionId,
    collectiveResponsibility: collectiveChoice,
  });

  const finalise = (collectiveChoice?: 'united' | 'free') => {
    const plan = buildPlan(collectiveChoice);
    const result = resolve(plan);
    if (!result) return;
    setOutcome(result);
    setCollective(collectiveChoice);
    dispatch({ type: 'HOLD_CABINET_MEETING', plan });
    setPhase('summary');
  };

  const resolve = (plan: CabinetMeetingPlan) =>
    // `resolveCabinetMeeting` is imported lazily here to keep the validation and
    // the UI preview on exactly the same code path.
    resolveCabinetMeeting(meeting, plan, state);

  const advance = () => {
    if (!current || !selectedOption) return;
    if (!lastItem) {
      setIndex((value) => value + 1);
      return;
    }

    const preview = resolve(buildPlan());
    const divisive =
      !!preview &&
      (preview.cohesionDelta < 0 ||
        Object.values(preview.loyaltyByName).some((delta) => delta < 0));

    if (divisive) {
      setCollective(undefined);
      setPhase('collective');
    } else {
      finalise(undefined);
    }
  };

  const choose = (optionId: string) => {
    if (!current) return;
    setDecisions((previous) => ({ ...previous, [current.id]: optionId }));
  };

  const renderAttendees = () => (
    <>
      <View style={styles.attendeesHead}>
        <Text style={styles.sectionEyebrow}>IN THE ROOM</Text>
        <Text style={styles.sectionMeta}>
          {state.cabinet.length} MINISTER{state.cabinet.length === 1 ? '' : 'S'} · 4 OFFICIALS · SWIPE →
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attendeeRow}>
        {meeting.attendees.map((attendee) => (
          <View key={attendee.id} style={[styles.attendee, attendee.kind === 'pm' && styles.attendeePm]}>
            <View style={[styles.avatar, attendee.kind === 'pm' && styles.avatarPm]}>
              <Text style={[styles.avatarText, attendee.kind === 'pm' && styles.avatarTextPm]}>
                {initials(attendee.name)}
              </Text>
            </View>
            <Text style={styles.attendeeName} numberOfLines={1}>{attendee.name}</Text>
            <Text style={styles.attendeeRole} numberOfLines={2}>{attendee.role}</Text>
            <Text style={[styles.attendeeKind, attendee.kind === 'pm' && styles.attendeeKindPm]}>
              {attendeeLabel(attendee)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </>
  );

  const renderOption = (
    option: CabinetMeetingOption,
    active: boolean,
    onPress: () => void,
    compact = false,
  ) => (
    <Pressable
      key={option.id}
      testID={`meeting-option-${option.id}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.option, compact && styles.optionCompact, active && styles.optionSelected]}
    >
      <View style={styles.optionHead}>
        <Text style={[styles.optionLabel, active && styles.optionLabelSelected]}>{option.label}</Text>
        {active ? <Text style={styles.optionSelectedMark}>SELECTED</Text> : null}
      </View>
      <Text style={styles.optionSummary}>{option.summary}</Text>
      <EffectChips effects={option.effects as Effects} max={compact ? 4 : 6} />
      <View style={styles.optionFoot}>
        <Chip
          label={`UNITY ${option.cohesionDelta >= 0 ? '+' : ''}${option.cohesionDelta}`}
          tone={option.cohesionDelta > 0 ? 'success' : option.cohesionDelta < 0 ? 'danger' : 'neutral'}
        />
        {(() => {
          const entries = Object.entries(option.loyaltyByPost ?? {}).filter(([, delta]) => delta !== 0);
          const winners = entries.filter(([, delta]) => delta > 0).map(([post]) => shortPost(post));
          const losers = entries.filter(([, delta]) => delta < 0).map(([post]) => shortPost(post));
          if (winners.length === 0 && losers.length === 0) return null;
          return (
            <Text style={styles.optionRoom} numberOfLines={1}>
              ROOM: {winners.length > 0 ? `for ${winners.join(', ')}` : 'no clear winner'}
              {losers.length > 0 ? ` · against ${losers.join(', ')}` : ''}
            </Text>
          );
        })()}
      </View>
    </Pressable>
  );

  const renderBriefing = () => (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderAttendees()}

        <View style={styles.agendaHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionEyebrow}>PRE-MEETING · BILATERALS</Text>
            <Text style={styles.itemTitle}>The private conversations</Text>
            <Text style={styles.itemLead}>Before the full Cabinet, settle the room.</Text>
          </View>
        </View>

        {meeting.bilaterals.map((bilateral) => (
          <View key={bilateral.id} style={styles.bilateral}>
            <Text style={styles.bilateralTitle}>{bilateral.title}</Text>
            <Text style={styles.bilateralPerson}>
              {bilateral.personName} · {bilateral.personRole}
            </Text>
            <Text style={styles.bilateralBrief}>{bilateral.brief}</Text>
            {bilateral.options.map((option) =>
              renderOption(
                option,
                bilateralChoices[bilateral.id] === option.id,
                () => setBilateralChoices((previous) => ({ ...previous, [bilateral.id]: option.id })),
                true,
              ),
            )}
          </View>
        ))}

        <View style={styles.agendaHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionEyebrow}>THE QUAD</Text>
            <Text style={styles.itemTitle}>{meeting.quad.title}</Text>
            <Text style={styles.itemLead}>{meeting.quad.attendees.join(' · ')}</Text>
          </View>
          <View style={styles.itemNumber}>
            <Text style={styles.itemNumberText}>Q</Text>
          </View>
        </View>
        <Text style={styles.brief}>{meeting.quad.brief}</Text>
        {meeting.quad.options.map((option) =>
          renderOption(option, quadOptionId === option.id, () => setQuadOptionId(option.id), true),
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {!briefingReady ? (
          <Text style={styles.footerHint}>Choose one line in each bilateral and the Quad.</Text>
        ) : null}
        <View style={styles.footerActions}>
          <Button
            label="Take your seat"
            disabled={!briefingReady}
            onPress={() => {
              setIndex(0);
              setPhase('agenda');
            }}
            testID="meeting-take-seat"
            style={{ marginTop: 0, flex: 1 }}
          />
        </View>
      </View>
    </>
  );

  const renderAgenda = () => (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderAttendees()}

        <View style={styles.agendaHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionEyebrow}>
              ITEM {index + 1} OF {meeting.items.length} · CABINET AGENDA
            </Text>
            <Text style={styles.itemTitle}>{current?.title}</Text>
            <Text style={styles.itemLead}>Lead: {current?.lead}</Text>
          </View>
          <View style={styles.itemNumber}>
            <Text style={styles.itemNumberText}>{String(index + 1).padStart(2, '0')}</Text>
          </View>
        </View>

        <Text style={styles.brief}>{current?.brief}</Text>

        <Text style={styles.sectionEyebrow}>AROUND THE TABLE</Text>
        {current?.contributions.map((contribution) => (
          <View key={`${contribution.id}-${contribution.line.slice(0, 12)}`} style={styles.contribution}>
            <View style={[styles.contributionMark, { backgroundColor: TONE_COLOR[contribution.tone] }]} />
            <View style={{ flex: 1 }}>
              <View style={styles.contributionHead}>
                <Text style={styles.contributionName}>{contribution.name}</Text>
                <Text style={styles.contributionRole} numberOfLines={1}>{contribution.role}</Text>
              </View>
              <Text style={styles.contributionLine}>{contribution.line}</Text>
            </View>
          </View>
        ))}

        <Text style={[styles.sectionEyebrow, { marginTop: spacing.lg }]}>
          THE PRIME MINISTER'S DECISION
        </Text>
        {current?.options.map((option) =>
          renderOption(option, option.id === selectedId, () => choose(option.id)),
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.footerProgress}>
          <Text style={styles.footerProgressText}>
            {index + 1} / {meeting.items.length}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((index + 1) / meeting.items.length) * 100}%` }]} />
          </View>
        </View>
        {!selectedOption ? (
          <Text style={styles.footerHint}>Select a course of action to continue.</Text>
        ) : null}
        <View style={styles.footerActions}>
          {index > 0 ? (
            <Button
              label="Back"
              variant="ghost"
              compact
              onPress={() => setIndex((value) => Math.max(0, value - 1))}
            />
          ) : null}
          <View style={{ flex: 1, marginLeft: index > 0 ? spacing.sm : 0 }}>
            <Button
              label={lastItem ? 'Record decisions' : 'Next item'}
              disabled={!selectedOption}
              onPress={advance}
              testID="meeting-next"
              style={{ marginTop: 0 }}
            />
          </View>
        </View>
      </View>
    </>
  );

  const renderCollective = () => (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionEyebrow}>THE MEETING IS DIVIDED</Text>
      <Text style={styles.summaryTitle}>Collective responsibility</Text>
      <Text style={styles.summaryIntro}>
        The room did not agree unanimously. The Prime Minister must decide how the government leaves the Cabinet Room.
      </Text>
      {COLLECTIVE_OPTIONS.map((option) => {
        const active = collective === (option.id === 'collective-united' ? 'united' : 'free');
        return (
          <Pressable
            key={option.id}
            testID={`meeting-${option.id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => setCollective(option.id === 'collective-united' ? 'united' : 'free')}
            style={[styles.option, active && styles.optionSelected]}
          >
            <View style={styles.optionHead}>
              <Text style={[styles.optionLabel, active && styles.optionLabelSelected]}>{option.label}</Text>
              {active ? <Text style={styles.optionSelectedMark}>SELECTED</Text> : null}
            </View>
            <Text style={styles.optionSummary}>{option.summary}</Text>
            <EffectChips effects={option.effects as Effects} max={4} />
            <View style={styles.optionFoot}>
              <Chip
                label={`UNITY ${option.cohesionDelta >= 0 ? '+' : ''}${option.cohesionDelta}`}
                tone={option.cohesionDelta > 0 ? 'success' : option.cohesionDelta < 0 ? 'danger' : 'neutral'}
              />
            </View>
          </Pressable>
        );
      })}
      {!collective ? (
        <Text style={styles.footerHint}>Decide how the government leaves the room.</Text>
      ) : null}
      <View style={styles.summaryFoot}>
        <Button
          label="Close meeting and record decisions"
          disabled={!collective}
          onPress={() => finalise(collective)}
          testID="meeting-record"
        />
      </View>
    </ScrollView>
  );

  const renderSummary = () => {
    const record = outcome?.record;
    if (!record) return null;
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionEyebrow}>THE MEETING IS CLOSED</Text>
        <Text style={styles.summaryTitle}>Decisions taken</Text>
        <Text style={styles.summaryIntro}>
          The Cabinet has agreed the government's course. The decisions are now in the Official Record.
        </Text>

        <View style={styles.summaryList}>
          {record.quad ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryItem}>The Quad</Text>
              <Text style={styles.summaryChoice}>{record.quad.choice}</Text>
            </View>
          ) : null}
          {record.bilaterals.map((entry) => (
            <View key={entry.title} style={styles.summaryRow}>
              <Text style={styles.summaryItem}>{entry.title}</Text>
              <Text style={styles.summaryChoice}>{entry.choice}</Text>
            </View>
          ))}
          {record.items.map((entry) => (
            <View key={entry.title} style={styles.summaryRow}>
              <Text style={styles.summaryItem}>{entry.title}</Text>
              <Text style={styles.summaryChoice}>{entry.choice}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionEyebrow, { marginTop: spacing.lg }]}>EFFECT ON THE GOVERNMENT</Text>
        <EffectChips effects={record.effects} max={8} />
        <View style={styles.summaryChips}>
          <Chip
            label={`COHESION ${record.cohesionDelta >= 0 ? '+' : ''}${record.cohesionDelta}`}
            tone={record.cohesionDelta >= 0 ? 'success' : 'danger'}
          />
          <Chip
            label={`UNREST ${record.factionUnrestDelta >= 0 ? '+' : ''}${record.factionUnrestDelta}`}
            tone={record.factionUnrestDelta <= 0 ? 'success' : 'danger'}
          />
          {record.collectiveResponsibility ? (
            <Chip
              label={record.collectiveResponsibility === 'united' ? 'UNITED FRONT' : 'FREE TO SPEAK'}
              tone={record.collectiveResponsibility === 'united' ? 'accent' : 'warning'}
            />
          ) : null}
        </View>

        {record.loyaltyChanges.length > 0 ? (
          <>
            <Text style={[styles.sectionEyebrow, { marginTop: spacing.lg }]}>WHO MOVED</Text>
            {record.loyaltyChanges.map((entry) => (
              <View key={entry.name} style={styles.loyaltyRow}>
                <Text style={styles.loyaltyName}>{entry.name}</Text>
                <Text style={[styles.loyaltyDelta, { color: entry.delta >= 0 ? colors.success : colors.danger }]}>
                  {entry.delta >= 0 ? '+' : ''}{entry.delta} loyalty
                </Text>
              </View>
            ))}
          </>
        ) : null}

        <View style={styles.summaryFoot}>
          <Button label="Return to office" onPress={onClose} testID="meeting-close" />
        </View>
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>
              {phase === 'briefing'
                ? `PRE-MEETING · MONTH ${meeting.week}`
                : phase === 'collective'
                  ? 'COLLECTIVE RESPONSIBILITY'
                  : `CABINET MEETING · MONTH ${meeting.week}`}
            </Text>
            <Text style={styles.title}>No. 10 Downing Street</Text>
            <Text style={styles.subtitle}>
              {meeting.attendees.length} in the room · Cabinet Room · 09:30
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

        {phase === 'briefing' ? renderBriefing() : null}
        {phase === 'agenda' ? renderAgenda() : null}
        {phase === 'collective' ? renderCollective() : null}
        {phase === 'summary' ? renderSummary() : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  eyebrow: {
    color: colors.gold,
    fontFamily: fileFontFamily,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    marginTop: 2,
    color: colors.text,
    fontFamily: headingFontFamily,
    fontSize: font.h2,
    fontWeight: '700',
  },
  subtitle: { marginTop: 2, color: colors.faint, fontSize: font.tiny },
  close: { padding: 4, marginLeft: spacing.sm },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: spacing.sm, paddingBottom: spacing.xl },
  attendeesHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionEyebrow: {
    color: colors.muted,
    fontFamily: fileFontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionMeta: {
    color: colors.faint,
    fontFamily: fileFontFamily,
    fontSize: 8,
    letterSpacing: .5,
  },
  attendeeRow: { paddingTop: spacing.sm, paddingBottom: spacing.md },
  attendee: {
    width: 132,
    marginRight: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorderLight,
  },
  attendeePm: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  avatar: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardAlt,
  },
  avatarPm: { borderColor: colors.accent, backgroundColor: colors.accent },
  avatarText: { color: colors.muted, fontFamily: fileFontFamily, fontSize: 10, fontWeight: '800' },
  avatarTextPm: { color: colors.onAccent },
  attendeeName: {
    marginTop: spacing.xs,
    color: colors.text,
    fontFamily: headingFontFamily,
    fontSize: 12,
    fontWeight: '700',
  },
  attendeeRole: { marginTop: 1, color: colors.faint, fontSize: 9, lineHeight: 12 },
  attendeeKind: {
    marginTop: spacing.xs,
    color: colors.gold,
    fontFamily: fileFontFamily,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: .7,
  },
  attendeeKindPm: { color: colors.accent },
  agendaHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.ink,
  },
  itemTitle: {
    marginTop: 2,
    color: colors.text,
    fontFamily: headingFontFamily,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 25,
  },
  itemLead: { marginTop: 3, color: colors.faint, fontSize: font.tiny, fontFamily: fileFontFamily },
  itemNumber: {
    width: 42,
    height: 42,
    marginLeft: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  itemNumberText: { color: colors.gold, fontFamily: fileFontFamily, fontSize: 15, fontWeight: '800' },
  brief: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    color: colors.text,
    fontSize: font.small,
    lineHeight: 19,
  },
  bilateral: { marginTop: spacing.md },
  bilateralTitle: {
    color: colors.text,
    fontFamily: headingFontFamily,
    fontSize: font.h3,
    fontWeight: '700',
  },
  bilateralPerson: {
    marginTop: 2,
    color: colors.gold,
    fontFamily: fileFontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: .3,
  },
  bilateralBrief: { marginTop: 4, color: colors.muted, fontSize: font.small, lineHeight: 18 },
  contribution: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorderLight,
  },
  contributionMark: { width: 3, marginRight: spacing.sm, alignSelf: 'stretch' },
  contributionHead: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  contributionName: { color: colors.text, fontSize: font.small, fontWeight: '800', marginRight: 6 },
  contributionRole: { color: colors.faint, fontFamily: fileFontFamily, fontSize: 8, flexShrink: 1 },
  contributionLine: { marginTop: 3, color: colors.muted, fontSize: font.small, lineHeight: 18, fontStyle: 'italic' },
  option: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  optionCompact: { padding: spacing.sm, marginTop: spacing.xs },
  optionSelected: { borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  optionLabel: { flex: 1, color: colors.accent, fontSize: font.body, fontWeight: '700', lineHeight: 20 },
  optionLabelSelected: { color: colors.accentDeep },
  optionSelectedMark: {
    color: colors.success,
    fontFamily: fileFontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: .6,
    marginTop: 3,
  },
  optionSummary: { marginTop: 3, color: colors.muted, fontSize: font.small, lineHeight: 18 },
  optionFoot: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: spacing.xs },
  optionRoom: { color: colors.faint, fontFamily: fileFontFamily, fontSize: 8, marginLeft: spacing.xs, flexShrink: 1 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.ink,
    paddingTop: spacing.sm,
    backgroundColor: colors.bg,
  },
  footerProgress: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  footerProgressText: {
    color: colors.gold,
    fontFamily: fileFontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: .6,
    marginRight: spacing.sm,
  },
  progressTrack: { flex: 1, height: 4, backgroundColor: colors.cardBorderLight },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  footerActions: { flexDirection: 'row', alignItems: 'center' },
  footerHint: {
    color: colors.faint,
    fontFamily: fileFontFamily,
    fontSize: 8,
    letterSpacing: .4,
    marginBottom: spacing.xs,
  },
  summaryTitle: {
    marginTop: 2,
    color: colors.text,
    fontFamily: headingFontFamily,
    fontSize: 28,
    fontWeight: '700',
  },
  summaryIntro: { marginTop: spacing.sm, color: colors.muted, fontSize: font.body, lineHeight: 21 },
  summaryList: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.ink },
  summaryRow: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.cardBorderLight },
  summaryItem: {
    color: colors.gold,
    fontFamily: fileFontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: .7,
    textTransform: 'uppercase',
  },
  summaryChoice: { marginTop: 3, color: colors.text, fontFamily: headingFontFamily, fontSize: font.h3, fontWeight: '700' },
  summaryChips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  loyaltyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.cardBorderLight },
  loyaltyName: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  loyaltyDelta: { fontFamily: fileFontFamily, fontSize: 10, fontWeight: '800' },
  summaryFoot: { marginTop: spacing.xl },
});
