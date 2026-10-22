#!/usr/bin/env python3
"""Extract pledge/manifesto/campaign/promise/election strings from hermes_strings.txt."""

import re
import os

INPUT_FILE = "/workspace/pm-sim/apk_decompile/hermes_strings.txt"
OUTPUT_FILE = "/workspace/pm-sim/apk_decompile/analysis/analysis_content_pledges.txt"

# ---- Primary keyword patterns (case-insensitive) ----
PRIMARY_KEYWORDS = [
    "pledge", "pledged", "pledging",
    "manifesto", "manifestos",
    "promise", "promised", "promising",
    "campaign", "campaigned", "campaigning",
    "election", "elect", "voter", "voting",
    "commitment", "committed",
    "ballot", "referendum", "polling", "poll",
    "vote", "voted", "votes",
]

# ---- Phrase patterns: "We will...", "I promise to...", "Our commitment to..." ----
PHRASE_PATTERNS = [
    re.compile(r"\bwe\s+will\b", re.IGNORECASE),
    re.compile(r"\bi\s+promise\s+to\b", re.IGNORECASE),
    re.compile(r"\bour\s+commitment\s+to\b", re.IGNORECASE),
    re.compile(r"\bi\s+vow\s+to\b", re.IGNORECASE),
    re.compile(r"\bwe\s+vow\s+to\b", re.IGNORECASE),
    re.compile(r"\bi\s+will\s+(fight|champion|deliver|protect|build|create|ensure|guarantee)\b", re.IGNORECASE),
    re.compile(r"\bwe\s+shall\b", re.IGNORECASE),
    re.compile(r"\bif\s+elected\b", re.IGNORECASE),
    re.compile(r"\bwhen\s+elected\b", re.IGNORECASE),
]

# ---- Policy areas to look for in combination with promise language ----
POLICY_AREAS = [
    "nhs", "national health", "healthcare", "health service",
    "education", "school", "schools", "university", "universities", "student",
    "tax", "taxes", "taxation", "taxpayer",
    "immigration", "immigrant", "border", "asylum", "refugee",
    "defence", "defense", "military", "armed forces", "national security",
    "housing", "homes", "housebuilding", "rent",
    "economy", "economic", "jobs", "employment", "unemployment", "wage", "wages",
    "climate", "environment", "green", "carbon", "net zero", "net-zero",
    "police", "policing", "crime", "criminal", "justice",
    "pension", "pensions", "benefit", "benefits", "welfare",
    "transport", "infrastructure", "railway", "rail", "road",
    "energy", "fuel", "electricity", "renewable",
    "farming", "agriculture", "fisheries", "fishing",
    "social care", "social services", "childcare", "elderly",
    "business", "businesses", "small business", "industry",
    "brexit", "europe", "trade deal", "trade agreement",
    "scotland", "wales", "northern ireland", "devolution",
    "foreign policy", "foreign affairs", "international",
]

# Compile the primary keyword regex (word-boundary match)
_primary_pattern = re.compile(
    r"\b(?:" + "|".join(PRIMARY_KEYWORDS) + r")\b",
    re.IGNORECASE,
)

# Compile the policy-area regex
_policy_pattern = re.compile(
    r"\b(?:" + "|".join(POLICY_AREAS) + r")\b",
    re.IGNORECASE,
)


def matches_any(text: str) -> bool:
    """Return True if the string matches any of our search criteria."""
    # Check primary keywords
    if _primary_pattern.search(text):
        return True
    # Check phrase patterns
    for pat in PHRASE_PATTERNS:
        if pat.search(text):
            return True
    # Check policy area combos: policy keyword + promise language nearby
    if _policy_pattern.search(text):
        # Does the same string also contain a promise-like word?
        # Use a broader second-pass check
        if re.search(r"\b(promise|pledge|commit|guarantee|will\b|shall\b|vow)", text, re.IGNORECASE):
            return True
    return False


def main():
    print(f"Reading: {INPUT_FILE}")
    print(f"Writing: {OUTPUT_FILE}")

    matched_lines = []
    total_lines = 0

    with open(INPUT_FILE, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            total_lines += 1
            if matches_any(line):
                matched_lines.append(line.rstrip("\n"))

    # Write all matches to output
    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        for line in matched_lines:
            fh.write(line + "\n")

    count = len(matched_lines)

    # ---- Scoring for "most interesting" ----
    # Score each match by how many distinct keyword/pattern families it triggers
    def interest_score(text: str) -> int:
        s = 0
        lower = text.lower()
        # Primary keywords
        for kw in PRIMARY_KEYWORDS:
            if kw in lower:
                s += 1
        # Phrase patterns
        for pat in PHRASE_PATTERNS:
            if pat.search(text):
                s += 2  # phrase matches are more interesting
        # Policy areas
        policy_hits = len([pa for pa in POLICY_AREAS if pa in lower])
        s += policy_hits * 3  # policy area combos are quite interesting
        # Prefer longer strings (more content)
        s += min(len(text) // 40, 5)
        return s

    # Sort by interest score descending, then by length descending
    ranked = sorted(matched_lines, key=lambda t: (interest_score(t), len(t)), reverse=True)
    top10 = ranked[:10]

    print(f"\nTotal lines scanned:   {total_lines:,}")
    print(f"Pledge/manifesto hits:  {count:,}")
    print(f"Output written to:      {OUTPUT_FILE}")
    print(f"\n=== Top 10 Most Interesting Pledge/Manifesto Strings ===\n")

    for i, line in enumerate(top10, 1):
        # Show line number extracted from the start of the line
        print(f"[{i}] {line[:300]}")  # truncate to 300 chars for display

    return count


if __name__ == "__main__":
    main()