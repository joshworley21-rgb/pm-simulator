#!/usr/bin/env python3
"""
Extract character/NPC names and descriptions from hermes_strings.txt.
Searches for political roles, titles, party affiliations, character names, etc.
"""

import re
import sys
from collections import Counter

INPUT_FILE = "/workspace/pm-sim/apk_decompile/hermes_strings.txt"
OUTPUT_FILE = "/workspace/pm-sim/apk_decompile/analysis/analysis_content_characters.txt"

# --- Pattern groups ---

# Case-insensitive compound patterns
COMPOUND_PATTERNS = [
    # MP / Parliament
    r'\bMP\b', r'\bMPs\b',
    r'\bMember\s+of\s+Parliament\b',
    r'\bbackbencher\b', r'\bfrontbencher\b',

    # Advisor / Consultant
    r'\badvis[oe]r\b', r'\bconsultant\b',

    # Civil Service
    r'\bcivil\s+servant\b', r'\bmandarin\b', r'\bWhitehall\b',

    # Spin Doctor / Press
    r'\bspin\s+doctor\b', r'\bpress\s+secretary\b',
    r'\bcommunication[s]?\s*director\b', r'\bcomms?\s*director\b',

    # Ministers / Secretaries of State
    r'\bminister\b', r'\bsecretary\s+of\s+state\b',
    r'\bchancellor\b',
    r'\bhome\s+secretary\b', r'\bforeign\s+secretary\b',
    r'\bdefence\s+secretary\b', r'\bdefense\s+secretary\b',
    r'\bhealth\s+secretary\b', r'\beducation\s+secretary\b',
    r'\btransport\s+secretary\b', r'\btrade\s+secretary\b',
    r'\bculture\s+secretary\b', r'\bwork\s+and\s+pensions\s+secretary\b',
    r'\benvironment\s+secretary\b', r'\bjustice\s+secretary\b',
    r'\bscotland\s+secretary\b', r'\bwales\s+secretary\b',
    r'\bnorthern\s+ireland\s+secretary\b',
    r'\bprime\s+minister\b', r'\bdeputy\s+prime\s+minister\b',
    r'\bchief\s+secretary\b', r'\bfirst\s+secretary\b',
    r'\bwhip\b', r'\bchief\s+whip\b',

    # Party affiliations
    r'\bLabour\b', r'\bConservative\b', r'\bLib\s*Dem\b',
    r'\bLiberal\s+Democrat\b', r'\bTory\b', r'\bTories\b',
    r'\bSNP\b', r'\bGreen\s+Party\b', r'\bUKIP\b',
    r'\bReform\s+UK\b', r'\bDUP\b',

    # Relationship descriptors
    r'\bally\b', r'\ballets\b', r'\brival\b', r'\brivals\b',
    r'\benemy\b', r'\benemies\b', r'\bfoe\b', r'\bfoes\b',
    r'\bfriend\b', r'\bfriends\b', r'\bcolleague\b', r'\bcolleagues\b',
    r'\bmentor\b', r'\bprot[eé]g[eé]\b', r'\bopponent\b',
    r'\bsupporter\b', r'\bcritic\b',
]

# Title + name patterns (capitalized name following a title)
TITLE_NAME_PATTERNS = [
    r'\bMr\.?\s+[A-Z][a-z]+\b',
    r'\bMr\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b',
    r'\bMs\.?\s+[A-Z][a-z]+\b',
    r'\bMs\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b',
    r'\bMrs\.?\s+[A-Z][a-z]+\b',
    r'\bMrs\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b',
    r'\bMiss\s+[A-Z][a-z]+\b',
    r'\bDr\.?\s+[A-Z][a-z]+\b',
    r'\bDr\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b',
    r'\bSir\s+[A-Z][a-z]+\b',
    r'\bSir\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b',
    r'\bLord\s+[A-Z][a-z]+\b',
    r'\bLord\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b',
    r'\bLady\s+[A-Z][a-z]+\b',
    r'\bLady\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b',
    r'\bBaroness\s+[A-Z][a-z]+\b',
    r'\bBaroness\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b',
    r'\bDame\s+[A-Z][a-z]+\b',
    r'\bDame\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b',
    r'\bRt\.?\s*Hon\.?\s+[A-Z][a-z]+\b',
    r'\bRt\.?\s*Hon\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b',
    r'\bKing\s+[A-Z][a-z]+\b',
    r'\bQueen\s+[A-Z][a-z]+\b',
    r'\bPrince\s+[A-Z][a-z]+\b',
    r'\bPrincess\s+[A-Z][a-z]+\b',
    r'\bDuke\s+of\s+[A-Z][a-z]+\b',
    r'\bDuchess\s+of\s+[A-Z][a-z]+\b',
    r'\bEarl\s+of\s+[A-Z][a-z]+\b',
    r'\bViscount\s+[A-Z][a-z]+\b',
    r'\bArchbishop\s+of\s+[A-Z][a-z]+\b',
    r'\bBishop\s+of\s+[A-Z][a-z]+\b',
]

# Specific UK political roles (often capitalized)
ROLE_PATTERNS = [
    r'\bPrime\s+Minister\b',
    r'\bDeputy\s+Prime\s+Minister\b',
    r'\bChancellor\s+of\s+the\s+Exchequer\b',
    r'\bChancellor\s+of\s+the\s+Duchy\b',
    r'\bHome\s+Secretary\b',
    r'\bForeign\s+Secretary\b',
    r'\bDefence\s+Secretary\b',
    r'\bHealth\s+Secretary\b',
    r'\bEducation\s+Secretary\b',
    r'\bTransport\s+Secretary\b',
    r'\bTrade\s+Secretary\b',
    r'\bCulture\s+Secretary\b',
    r'\bJustice\s+Secretary\b',
    r'\bWork\s+and\s+Pensions\s+Secretary\b',
    r'\bEnvironment\s+Secretary\b',
    r'\bScotland\s+Secretary\b',
    r'\bWales\s+Secretary\b',
    r'\bNorthern\s+and?\s*Ireland\s+Secretary\b',
    r'\bChief\s+Secretary\s+to\s+the\s+Treasury\b',
    r'\bFirst\s+Secretary\s+of\s+State\b',
    r'\bLeader\s+of\s+the\s+House\b',
    r'\bLeader\s+of\s+the\s+Opposition\b',
    r'\bSpeaker\s+of\s+the\s+House\b',
    r'\bChief\s+Whip\b',
    r'\bAttorney\s+General\b',
    r'\bSolicitor\s+General\b',
    r'\bPaymaster\s+General\b',
    r'\bLord\s+Chancellor\b',
    r'\bLord\s+Privy\s+Seal\b',
    r'\bLord\s+President\s+of\s+the\s+Council\b',
    r'\bLeader\s+of\s+the\s+(?:House\s+of\s+)?Lords\b',
    r'\bLeader\s+of\s+the\s+(?:House\s+of\s+)?Commons\b',
    r'\bMayor\s+of\s+London\b',
    r'\bFirst\s+Minister\s+of\s+Scotland\b',
    r'\bFirst\s+Minister\s+of\s+Wales\b',
    r'\bFirst\s+Minister\s+of\s+Northern\s+Ireland\b',
]

# Patterns for detecting proper names (Two+ capitalized words in a row)
# This is intentionally broad - we only apply it to lines that already matched
# something to avoid flooding results with non-character strings.
PROPER_NAME_PATTERN = re.compile(
    r'\b([A-Z][a-z]+(?:\s+(?:[A-Z][a-z]+|van\s+der|de\s+|von\s+|al-|el-))+'
    r'[A-Z][a-z]+)\b'
)


def line_matches_patterns(line):
    """Return list of (pattern_str) that matched in line (case-insensitive)."""
    matched = []
    line_lower = line.lower()
    for pat in COMPOUND_PATTERNS:
        if re.search(pat, line_lower):
            matched.append(pat)
    for pat in TITLE_NAME_PATTERNS:
        if re.search(pat, line):
            matched.append(pat)
    for pat in ROLE_PATTERNS:
        if re.search(pat, line):
            matched.append(pat)
    return matched


def score_line(line, matched_patterns):
    """Score a line for 'interestingness' - used for top-N ranking."""
    score = 0
    # More matches = more relevant
    score += len(matched_patterns) * 10

    # Longer lines often contain more description
    score += min(len(line), 300) / 10.0

    # Prefer lines with proper names
    proper_names = PROPER_NAME_PATTERN.findall(line)
    score += len(proper_names) * 15

    # Prefer lines with titles
    title_keywords = ['mr', 'ms', 'mrs', 'miss', 'dr', 'sir', 'lord', 'lady',
                      'baroness', 'dame', 'prime minister', 'secretary',
                      'minister', 'chancellor', 'mp']
    line_lower = line.lower()
    for kw in title_keywords:
        if kw in line_lower:
            score += 5

    return score


def main():
    print(f"Reading {INPUT_FILE} ...")

    results = []  # List of (line_num, line, matched_patterns)

    with open(INPUT_FILE, 'r', encoding='utf-8', errors='replace') as f:
        for line_num, line in enumerate(f, start=1):
            line = line.rstrip('\n\r')
            if not line.strip():
                continue
            matched = line_matches_patterns(line)
            if matched:
                results.append((line_num, line, matched))

    print(f"\nTotal matches found: {len(results)}")

    # Write all results
    print(f"Writing results to {OUTPUT_FILE} ...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(f"Character/NPC Extraction Results\n")
        f.write(f"================================\n")
        f.write(f"Total matches: {len(results)}\n\n")
        for line_num, line, matched in results:
            f.write(f"[{line_num:06d}] {line}\n")

    # Score and rank for top-20
    scored_results = []
    for line_num, line, matched in results:
        s = score_line(line, matched)
        scored_results.append((s, line_num, line))

    scored_results.sort(key=lambda x: x[0], reverse=True)

    print("\nTop 20 Most Interesting Character/Name Strings:")
    print("=" * 70)
    for rank, (score, line_num, line) in enumerate(scored_results[:20], 1):
        # Truncate long lines for display
        display = line[:140] + ('...' if len(line) > 140 else '')
        print(f"{rank:2d}. [{line_num:06d}] (score={score:.0f}) {display}")

    print("\nDone.")


if __name__ == '__main__':
    main()