#!/usr/bin/env python3
"""
Streaming extractor for PM Questions / parliamentary content from hermes_strings.txt.

Reads the large ~121K-line file line-by-line (never loads it fully into memory),
matches against keyword/regex patterns, and outputs all hits to an analysis file.
"""

import re
import sys
from pathlib import Path

INPUT_FILE = Path("/workspace/pm-sim/apk_decompile/hermes_strings.txt")
OUTPUT_FILE = Path("/workspace/pm-sim/apk_decompile/analysis/analysis_content_pmqs.txt")

# ── Keyword groups (case-insensitive) ────────────────────────────────────────

# Group A: PMQ-specific
KW_PMQ = re.compile(
    r"\b(?:pmqs?|prime\s*minister['’]?s?\s*questions?|prime\s*minister\s*questions?)\b",
    re.IGNORECASE,
)

# Group B: Parliament / Westminster
KW_PARLIAMENT = re.compile(
    r"\b(?:parliament|parliamentary|house\s*of\s*commons|westminster|hansard|member\s*of\s*parliament)\b",
    re.IGNORECASE,
)

# Group C: Question time / oral questions / written question
KW_QUESTION_TIME = re.compile(
    r"\b(?:question\s*time|oral\s*questions?|written\s*questions?|urgent\s*questions?|topical\s*questions?)\b",
    re.IGNORECASE,
)

# Group D: Opposition / backbench / Speaker
KW_OPPOSITION = re.compile(
    r"\b(?:opposition|backbench|back\s*bench|speaker\s*of\s*the\s*house|mr\.?\s*speaker|madam\s*speaker|deputy\s*speaker|leader\s*of\s*the\s*opposition|loyal\s*opposition)\b",
    re.IGNORECASE,
)

# Group E: Minister / Shadow Minister
KW_MINISTER = re.compile(
    r"\b(?:minister|shadow\s*minister|cabinet\s*minister|prime\s*minister|chief\s*secretary|chancellor|home\s*secretary|foreign\s*secretary|secretary\s*of\s*state)\b",
    re.IGNORECASE,
)

# Group F: Parliamentary dialogue patterns
KW_DIALOGUE = re.compile(
    r"\b(?:hear\s*hear|order!|order\s*!|division!|the\s*ayes?|the\s*noes?|withdraw|point\s*of\s*order|maiden\s*speech|right\s*honourable|hon\.?\s*(?:member|friend|gentleman|lady)|right\s*hon\.?|honourable\s*(?:member|friend|gentleman|lady))\b",
    re.IGNORECASE,
)

# Group G: Q: / A: pattern or Q&A-like text
KW_QA = re.compile(
    r"^(?:Q[\s:.]|A[\s:.])",
    re.IGNORECASE,
)

# Group H: Strings that contain a "?" and are plausibly a question (length heuristics)
# Catched below in a function

# Complied list of all compiled patterns for fast iteration
ALL_PATTERNS = [
    ("PMQ", KW_PMQ),
    ("Parliament", KW_PARLIAMENT),
    ("QuestionTime", KW_QUESTION_TIME),
    ("Opposition/Speaker", KW_OPPOSITION),
    ("Minister", KW_MINISTER),
    ("Dialogue", KW_DIALOGUE),
    ("Q/A-prefix", KW_QA),
]


def looks_like_qa(text: str) -> bool:
    """
    Heuristic: does the line look like a question-and-answer exchange?
    - Contains '?' AND the line is between 30-500 chars
    - Or starts with 'Q:' or 'A:'
    """
    if KW_QA.match(text):
        return True
    stripped = text.strip()
    if len(stripped) < 30 or len(stripped) > 500:
        return False
    if "?" not in stripped:
        return False
    # Bonus: does it have a follow-up-looking structure?
    # e.g. "Question: ... Answer: ..." or ends with ? and carries on
    if re.search(r"(?:question|answer|reply|response|said|replied|stated)", stripped, re.IGNORECASE):
        return True
    return False


def main():
    if not INPUT_FILE.exists():
        print(f"ERROR: Input file not found: {INPUT_FILE}", file=sys.stderr)
        sys.exit(1)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    results = []  # (line_number, raw_line, matched_categories)

    print(f"Streaming through {INPUT_FILE} ...")

    with open(INPUT_FILE, "r", encoding="utf-8", errors="replace") as fh:
        for line_num, line in enumerate(fh, start=1):
            # Strip the [NNNNNN] prefix for matching but keep original for output
            # The format is "[NNNNNN] actual string content"
            m_idx = re.match(r"^\[\d+\]\s*", line)
            if m_idx:
                after_prefix = line[m_idx.end():]
                original = line.rstrip("\n\r")
            else:
                after_prefix = line
                original = line.rstrip("\n\r")

            matched = []
            for cat_name, pattern in ALL_PATTERNS:
                if pattern.search(after_prefix):
                    matched.append(cat_name)

            # Q&A heuristic (only if not already caught by Q/A-prefix)
            if "Q/A-prefix" not in matched and looks_like_qa(after_prefix):
                matched.append("QA-heuristic")

            if matched:
                results.append((line_num, original, matched))

    # ── Write output file ────────────────────────────────────────────────────
    print(f"Writing {len(results)} matches to {OUTPUT_FILE} ...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
        out.write(f"# PM Questions / Parliamentary content extracted from {INPUT_FILE.name}\n")
        out.write(f"# Total matches: {len(results)}\n")
        out.write(f"# Format: [LINE_NUMBER] (categories) original_line_content\n")
        out.write("# ============================================================================\n\n")
        for line_num, original, cats in results:
            cat_str = ", ".join(cats)
            out.write(f"[{line_num:06d}] ({cat_str}) {original}\n")

    # ── stdout summary ───────────────────────────────────────────────────────
    print(f"\n{'='*70}")
    print(f"Total PMQ/Parliamentary strings found: {len(results)}")
    print(f"{'='*70}")

    # Top 10 "most interesting": pick strings with the most category matches,
    # then longest among ties, to surface the richest content.
    scored = []
    for line_num, original, cats in results:
        # Score: 10 points per category match + length bonus
        score = len(cats) * 10 + min(len(original.strip()) / 20, 10)
        scored.append((score, line_num, original, cats))

    scored.sort(key=lambda x: x[0], reverse=True)

    print(f"\nTop 10 most interesting PMQ/Q&A strings:\n")
    for rank, (score, line_num, original, cats) in enumerate(scored[:10], 1):
        cat_str = ", ".join(cats)
        # Truncate for display if needed
        display = original.strip()
        if len(display) > 200:
            display = display[:197] + "..."
        print(f"  {rank:2d}. [L{line_num:06d}] ({cat_str})")
        print(f"      {display}")
        print()

    # ── Category breakdown ───────────────────────────────────────────────────
    from collections import Counter
    cat_counts = Counter()
    for _, _, cats in results:
        for c in cats:
            cat_counts[c] += 1

    print(f"{'='*70}")
    print("Category breakdown:")
    for cat, count in cat_counts.most_common():
        print(f"  {cat:25s}: {count:6d}")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()