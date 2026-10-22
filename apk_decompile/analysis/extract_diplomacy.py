#!/usr/bin/env python3
"""
Extract diplomacy / foreign-policy related strings from hermes_strings.txt.
Reads line-by-line (streaming), writes all matches to an output file,
and prints summary statistics to stdout.
"""

import re
import os
import sys

INPUT_FILE = "/workspace/pm-sim/apk_decompile/hermes_strings.txt"
OUTPUT_DIR = "/workspace/pm-sim/apk_decompile/analysis"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "analysis_content_diplomacy.txt")

# ------------------- Search terms (case-insensitive) -------------------

# Simple keyword patterns (any substring match)
KEYWORDS = [
    # diplomacy / diplomats
    "diplomacy", "diplomatic", "diplomat",
    # foreign / international
    "foreign", "international", "overseas",
    # treaties & trade
    "treaty", "trade deal", "trade agreement", "free trade",
    # alliances & orgs
    "alliance", "nato", "united nations", "european union",
    # standalone "un" and "eu" are too noisy; only include with boundaries
    # sanctions / trade war
    "sanction", "embargo", "tariff",
    # diplomatic missions
    "ambassador", "embassy", "consulate",
    # high-level meetings
    "summit", "bilateral", "multilateral",
    # war / peace
    "war", "conflict", "peace", "ceasefire",
    # specific countries
    "france", "french",
    "germany", "german",
    "united states", "usa", "america",
    "china", "chinese",
    "russia", "russian",
    "united kingdom", "britain", "british", "uk",
    "japan", "japanese",
    "india", "indian",
    "brazil", "brazilian",
    "canada", "canadian",
    "australia", "australian",
    "italy", "italian",
    "spain", "spanish",
    "south korea", "korean",
    "north korea",
    "iran", "iranian",
    "israel", "israeli",
    "palestine", "palestinian",
    "turkey", "turkish",
    "saudi arabia", "saudi",
    "mexico", "mexican",
    "egypt", "egyptian",
    "pakistan", "pakistani",
    "indonesia", "indonesian",
    "nigeria", "nigerian",
    "vietnam", "vietnamese",
    "poland", "polish",
    "ukraine", "ukrainian",
]

# Word-boundary patterns for short acronyms (avoid false positives)
BOUNDARY_KEYWORDS = [
    r"\bUN\b",
    r"\bEU\b",
    r"\bUS\b",
    r"\bUSA\b",
    r"\bUK\b",
    r"\bNATO\b",
]


def build_regex():
    """Build a single compiled regex from all keyword groups."""
    patterns = []

    # Simple keywords: escape for regex, match anywhere case-insensitive
    for kw in KEYWORDS:
        patterns.append(re.escape(kw))

    # Boundary-wrapped patterns
    patterns.extend(BOUNDARY_KEYWORDS)

    # Join with alternation, case-insensitive
    full = "|".join(patterns)
    return re.compile(full, re.IGNORECASE)


def main():
    regex = build_regex()
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    total_lines = 0
    match_count = 0
    # Store (line_number, original_line, text) for ranking
    matches = []

    print(f"Reading {INPUT_FILE} ...", file=sys.stderr)

    with open(INPUT_FILE, "r", encoding="utf-8", errors="replace") as f_in:
        for line in f_in:
            total_lines += 1
            stripped = line.rstrip("\n\r")
            if regex.search(stripped):
                matches.append((total_lines, stripped))

    match_count = len(matches)

    print(f"Lines processed: {total_lines}", file=sys.stderr)
    print(f"Diplomacy matches: {match_count}", file=sys.stderr)

    # Write all matches to output
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f_out:
        for line_num, content in matches:
            f_out.write(f"[{line_num:06d}] {content}\n")

    print(f"\nOutput written to: {OUTPUT_FILE}", file=sys.stderr)

    # ---- Interest scoring for ranking ----
    # Score each match by how many distinct keyword categories it hits
    # Categories are the groups defined above
    CATEGORIES = {
        "diplomacy": re.compile(r"diplomacy|diplomatic|diplomat", re.IGNORECASE),
        "foreign": re.compile(r"foreign|international|overseas", re.IGNORECASE),
        "treaty_trade": re.compile(r"treaty|trade deal|trade agreement|free trade", re.IGNORECASE),
        "alliance": re.compile(r"alliance|\bNATO\b|\bUN\b|\bEU\b|european union|united nations", re.IGNORECASE),
        "sanctions": re.compile(r"sanction|embargo|tariff", re.IGNORECASE),
        "missions": re.compile(r"ambassador|embassy|consulate", re.IGNORECASE),
        "summits": re.compile(r"summit|bilateral|multilateral", re.IGNORECASE),
        "war_peace": re.compile(r"\bwar\b|conflict|peace|ceasefire", re.IGNORECASE),
        "countries": re.compile(
            r"france|french|germany|german|united states|\busa\b|america|"
            r"china|chinese|russia|russian|united kingdom|britain|british|\buk\b|"
            r"japan|japanese|india|indian|brazil|canada|italy|spain|"
            r"korea|iran|israel|palestine|turkey|saudi|mexico|egypt|"
            r"pakistan|indonesia|nigeria|vietnam|poland|ukraine",
            re.IGNORECASE,
        ),
    }

    scored = []
    for line_num, content in matches:
        score = sum(1 for cat_re in CATEGORIES.values() if cat_re.search(content))
        # Bonus for longer strings (more likely to be meaningful)
        length_bonus = min(len(content) / 200.0, 1.0)
        final_score = score + length_bonus
        scored.append((final_score, line_num, content))

    scored.sort(key=lambda x: x[0], reverse=True)

    # ---- Print results to stdout ----
    print(f"\n===== DIPLOMACY / FOREIGN POLICY EXTRACTION =====")
    print(f"Total lines in source:  {total_lines}")
    print(f"Total diplomacy matches: {match_count}")
    print(f"Hit rate:               {match_count / total_lines * 100:.2f}%")
    print(f"\n===== TOP 20 MOST INTERESTING (by keyword density) =====")
    for rank, (score, line_num, content) in enumerate(scored[:20], 1):
        # Truncate very long strings for display
        display = content if len(content) <= 160 else content[:157] + "..."
        print(f"{rank:2d}. [{line_num:06d}] (score={score:.1f}) {display}")


if __name__ == "__main__":
    main()