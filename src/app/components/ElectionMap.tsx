import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';
import { Card, Chip } from './ui';
import { REGIONS, REGION_COUNCIL_META } from '../data';
import type { RegionCouncilMeta } from '../data';
import type { Party } from '../types';

interface ElectionMapProps {
  regionSeats: Record<string, Record<string, number>>;
  parties: Party[];
  playerPartyId?: string;
  defaultFilter?: 'all' | 'england';
}

export function ElectionMap({ regionSeats, parties, playerPartyId, defaultFilter = 'england' }: ElectionMapProps) {
  const [filter, setFilter] = useState<'all' | 'england'>(defaultFilter);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('north');

  const partyMap = useMemo(() => {
    const map = new Map<string, Party>();
    for (const p of parties) map.set(p.id, p);
    return map;
  }, [parties]);

  const regionWinners = useMemo(() => {
    const winners: Record<string, { party: Party; seats: number; totalSeats: number; breakdown: { party: Party; seats: number }[] }> = {};

    for (const reg of REGIONS) {
      const seatData = regionSeats[reg.id] ?? {};
      const breakdown: { party: Party; seats: number }[] = [];
      let maxSeats = -1;
      let winningParty = parties[0];

      for (const p of parties) {
        const count = seatData[p.id] ?? 0;
        breakdown.push({ party: p, seats: count });
        if (count > maxSeats) {
          maxSeats = count;
          winningParty = p;
        }
      }

      breakdown.sort((a, b) => b.seats - a.seats);

      winners[reg.id] = {
        party: winningParty,
        seats: maxSeats,
        totalSeats: reg.seats,
        breakdown,
      };
    }

    return winners;
  }, [regionSeats, parties]);

  const displayedRegions = useMemo(() => {
    return REGIONS.filter((r) => (filter === 'england' ? REGION_COUNCIL_META[r.id]?.isEngland : true));
  }, [filter]);

  const selectedRegion = REGIONS.find((r) => r.id === selectedRegionId) ?? REGIONS[0];
  const selectedMeta = REGION_COUNCIL_META[selectedRegion.id];
  const selectedResult = regionWinners[selectedRegion.id];

  return (
    <View style={{ marginTop: spacing.md }}>
      {/* Filter Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, padding: 3, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.cardBorder }}>
        <Pressable
          onPress={() => setFilter('england')}
          style={[styles.filterBtn, filter === 'england' && styles.filterBtnActive]}
        >
          <Text style={[styles.filterText, filter === 'england' && styles.filterTextActive]}>
            England Councils (543 seats)
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setFilter('all')}
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Full UK (650 seats)
          </Text>
        </Pressable>
      </View>

      {/* Regional Map Grid */}
      <Text style={[styles.subhead, { marginBottom: spacing.xs }]}>
        {filter === 'england' ? 'REGIONAL COUNCIL BREAKDOWN (ENGLAND)' : 'ELECTORAL MAP OF THE UNITED KINGDOM'}
      </Text>
      <Text style={{ color: colors.muted, fontSize: font.tiny, marginBottom: spacing.sm }}>
        Tap any region to inspect council districts and local seat results.
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
        {displayedRegions.map((reg) => {
          const res = regionWinners[reg.id];
          const isSelected = reg.id === selectedRegionId;
          const winnerColor = res?.party?.color ?? colors.muted;

          return (
            <View key={reg.id} style={{ width: '50%', padding: 4 }}>
              <Pressable
                onPress={() => setSelectedRegionId(reg.id)}
                style={[
                  styles.regionCard,
                  isSelected && styles.regionCardSelected,
                  { borderLeftWidth: 4, borderLeftColor: winnerColor },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                    {reg.name}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: font.tiny }}>{reg.seats} seats</Text>
                </View>

                {/* Winner Pill */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: winnerColor, marginRight: 5 }} />
                  <Text style={{ color: winnerColor, fontSize: font.tiny, fontWeight: '800' }}>
                    {res?.party?.abbreviation} WIN ({res?.seats ?? 0})
                  </Text>
                </View>

                {/* Seat Distribution Micro Bar */}
                <View style={styles.microBar}>
                  {(res?.breakdown ?? []).map((b) => {
                    const pct = reg.seats > 0 ? (b.seats / reg.seats) * 100 : 0;
                    if (pct <= 0) return null;
                    return (
                      <View
                        key={b.party.id}
                        style={{ width: `${pct}%`, height: '100%', backgroundColor: b.party.color }}
                      />
                    );
                  })}
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Selected Region Detailed Inspection */}
      {selectedResult && (
        <Card style={{ marginTop: spacing.md, borderWidth: 1, borderColor: selectedResult.party.color }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '800' }}>
                {selectedRegion.name}
              </Text>
              <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>
                {selectedMeta?.bloc} • {selectedRegion.seats} parliamentary constituencies
              </Text>
            </View>
            <View style={{ backgroundColor: colors.accentSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.cardBorder }}>
              <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>
                {selectedResult.party.name} Lead
              </Text>
            </View>
          </View>

          {/* Seat Breakdown List */}
          <Text style={[styles.subhead, { marginTop: spacing.sm, marginBottom: 4 }]}>SEATS WON BY PARTY</Text>
          <View style={{ backgroundColor: colors.bgElevated, borderRadius: radius.sm, padding: spacing.sm }}>
            {selectedResult.breakdown.map((item) => {
              const isPlayer = item.party.id === playerPartyId;
              const pct = selectedRegion.seats > 0 ? Math.round((item.seats / selectedRegion.seats) * 100) : 0;

              return (
                <View key={item.party.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.party.color, marginRight: 8 }} />
                  <Text style={{ color: colors.text, flex: 1, fontSize: font.small, fontWeight: isPlayer ? '700' : '400' }} numberOfLines={1}>
                    {item.party.name} {isPlayer ? '(You)' : ''}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: font.tiny, marginRight: 8 }}>{pct}%</Text>
                  <Text style={{ color: item.seats > 0 ? colors.text : colors.muted, fontSize: font.small, fontWeight: '700', minWidth: 28, textAlign: 'right' }}>
                    {item.seats}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Councils & Counties in this Region */}
          <Text style={[styles.subhead, { marginTop: spacing.md, marginBottom: 4 }]}>
            {selectedMeta?.isEngland ? 'KEY COUNCILS & AUTHORITIES' : 'LOCAL GOVERNMENT AREAS'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 }}>
            {(selectedMeta?.councils ?? []).map((council) => (
              <View key={council} style={styles.councilChip}>
                <Text style={{ color: colors.muted, fontSize: font.tiny }}>{council}</Text>
              </View>
            ))}
          </View>

          {/* Key Major Cities */}
          <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: spacing.sm }}>
            Major urban centers: {(selectedMeta?.keyCities ?? []).join(', ')}
          </Text>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filterBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  filterBtnActive: {
    backgroundColor: colors.accentSoft,
  },
  filterText: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: '700',
  },
  filterTextActive: {
    color: colors.text,
  },
  subhead: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  regionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 64,
  },
  regionCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.bgElevated,
  },
  microBar: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: colors.cardBorder,
    marginTop: 6,
  },
  councilChip: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
});
