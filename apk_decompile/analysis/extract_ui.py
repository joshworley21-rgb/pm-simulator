#!/usr/bin/env python3
"""
extract_ui.py - Stream through hermes_strings.txt and extract UI labels,
menus, screen structure, button labels, navigation, modals, etc.
"""

import re
import sys
from pathlib import Path

INPUT = Path("/workspace/pm-sim/apk_decompile/hermes_strings.txt")
OUTPUT = Path("/workspace/pm-sim/apk_decompile/analysis/analysis_ui.txt")

# ---- Pattern groups ------------------------------------------------------------
# Each group: (label, list_of_compiled_regexes)
# Case-insensitive matching.

patterns = {
    # Screen names ending in "Screen" (PascalCase/camelCase)
    "Screen names (ending in Screen)": [
        re.compile(r"[A-Za-z_][A-Za-z0-9_]*Screen\b", re.IGNORECASE),
    ],
    # Tab / navigation labels (common RN / mobile patterns)
    "Tab / navigation labels": [
        re.compile(r"\b(tab|tabs|nav(igation)?|navBar|bottomBar|topBar|headerBar)\b", re.IGNORECASE),
        re.compile(r"^(Home|Profile|Shop|Store|Inventory|Map|Quest|Battle|Arena|Rank|Leaderboard|Clan|Guild|Chat|Mail|Settings|Options|Help|About)$", re.IGNORECASE),
    ],
    # Menu / settings / options / configuration
    "Menu / settings / options / config": [
        re.compile(r"\b(menu|menus|setting(?:s)?|option(?:s)?|config(?:uration)?|preference(?:s)?)\b", re.IGNORECASE),
    ],
    # Headers / titles / subtitles / captions
    "Header / title / subtitle / caption": [
        re.compile(r"\b(header|title|subtitle|caption|heading|label|placeholder|tooltip|tagline)\b", re.IGNORECASE),
    ],
    # Button labels
    "Button labels": [
        re.compile(r"^(Continue|Start|Begin|Load|Save|Exit|Quit|Next|Back|Close|OK|Cancel|Retry|Skip|Done|Submit|Apply|Confirm|Dismiss|Accept|Decline|Reject|Pause|Resume|Restart|Replay|Play|Stop|Sign\s*In|Sign\s*Out|Log\s*In|Log\s*Out|Register|Sign\s*Up|Buy|Purchase|Sell|Trade|Equip|Unequip|Use|Upgrade|Evolve|Enhance|Refine|Craft|Forge|Cook|Brew|Smith)$", re.IGNORECASE),
        re.compile(r"^(Yes|No|On|Off|Enable|Disable|Show|Hide|Open|Close|Add|Remove|Delete|Edit|Rename|Copy|Paste|Select|Deselect|Filter|Sort|Refresh|Reload|Synchronize|Synchronise|Upload|Download|Share|Invite|Join|Leave|Kick|Ban|Mute|Unmute|Report|Block|Unblock|Follow|Unfollow|Like|Unlike|Rate|Review|Comment|Post|Send|Reply|Forward|Search|Find|Clear|Reset|Undo|Redo|Import|Export|Print|Preview)$", re.IGNORECASE),
        re.compile(r"\b(button|btn|cta|action|tap\s*to|click\s*to)\b", re.IGNORECASE),
        re.compile(r"\b(swipe|press|drag|drop|pinch|zoom|scroll|flick|long\s*press|double\s*tap|tap|click)\b", re.IGNORECASE),
    ],
    # Modal / dialog titles
    "Modal / dialog": [
        re.compile(r"\b(modal|dialog(?:ue)?|popup|pop\s*up|alert|toast|snackbar|banner|notification|overlay)\b", re.IGNORECASE),
        re.compile(r"\b(are\s*you\s*sure|confirm|dismiss|cancel|proceed|go\s*back)\b", re.IGNORECASE),
    ],
    # Tutorial / help
    "Tutorial / help": [
        re.compile(r"\b(tutorial|how\s*to|guide|help|faq|hint|tip|onboard(?:ing)?|walkthrough|couch|firt[- ]time)\b", re.IGNORECASE),
    ],
    # Achievement / unlock
    "Achievement / unlock": [
        re.compile(r"\b(unlock(?:ed)?|achievement|trophy|badge|reward|milestone|challenge|quest|mission|complete(?:d)?\b)", re.IGNORECASE),
    ],
    # Short candidate UI labels (2-30 chars, single words or short phrases)
    "Short UI candidate (2-30 chars)": [
        # matched in code below because it's length-based, not regex-based
    ],
}

# Minimums tring length to consider for short-UI matching
MIN_LEN = 2
MAX_LEN = 30

# Line format: [NNNNNN] actual_string
LINE_RE = re.compile(r"^\[(\d{6})\]\s+(.*)$")

def is_likely_ui_short(label: str) -> bool:
    """Heuristic: does this short string look like a UI piece?"""
    # Skip pure numbers, single letters, JS keywords, camelCase props
    if label.isdigit():
        return False
    if len(label) == 1:
        return False
    # Skip things that look like pure variable names (camelCase or snake_case
    # with no spaces and starting lowercase)
    # But keep Title Case things, ALL CAPS, and things with spaces
    has_space = " " in label or "\t" in label
    is_all_caps = label == label.upper() and any(c.isalpha() for c in label)
    is_title = label[0].isupper() and not label.isupper() and not label.islower()
    is_mixed_phrase = has_space and any(c.isupper() for c in label) and any(c.islower() for c in label)

    # Skips pure camelCase (starts lower, no spaces)
    if not has_space and label[0].islower() and not is_all_caps:
        # But keep if it contains known UI substrings
        if not any(kw in label.lower() for kw in [
            "screen", "page", "view", "modal", "dialog", "tab", "menu",
            "button", "btn", "icon", "label", "title", "header",
        ]):
            return False

    # Skip purely snake_case identifiers (no spaces, al lower with underscores)
    if not has_space and "_" in label and label == label.lower():
        return False

    return True

def main():
    total_lines = 0
    total_found = 0
    matched_by_group = {k: 0 for k in patterns}

    # All matches stored as (line_num, string, group_label) for final output
    all_matches = []  # list of (line_num, raw_line)

    unique_lines_seen = set()  # dedup identical output lines

    print(f"Reading {INPUT} ...", file=sys.stderr)
    print(f"Writing results to {OUTPUT}", file=sys.stderr)

    with open(INPUT, "r", encoding="utf-8", errors="replace") as fh_in, \
         open(OUTPUT, "w", encoding="utf-8") as fh_out:

        fh_out.write("# UI Label Extraction Results\n")
        fh_out.write(f"# Source: {INPUT}\n")
        fh_out.write("# Group matches and short UI candidates follow.\n\n")

        for raw_line in fh_in:
            total_lines += 1
            if total_lines % 2000 == 0:
                print(f"  P rocessed {total_lines} lines ...", file=sys.stderr)

            m = LINE_RE.match(raw_line.rstrip("\n\r"))
            if not m:
                continue

            line_num_str = m.group(1)
            line_num = int(line_num_str)
            label = m.group(2).strip()

            if not label:
                continue

            matched = False

            # Check a ll regex groups
            for group_name, regex_list in patterns.items():
                if group_name == "Short UI candidate (2-30 chars)":
                    continue  # handled separately
                for regex in regex_list:
                    if regex.search(label):
                        line_key = (line_num, raw_line.rstrip("\n\r"))
                        if line_key not in unique_lines_seen:
                            unique_lines_seen.add(line_key)
                            fh_out.write(f"[{line_num_str}] {label}\n")
                            all_matches.append((line_num, label, group_name))
                            matched_by_group[group_name] += 1
                            total_found += 1
                            matched = True
                        break  # next group
                if matched:
                    break

            if matched:
                continue

            # Short UI candidate chec k (only for strings not already matched)
            if MIN_LEN <= len(label) <= MAX_LEN:
                if is_likely_ui_short(label):
                    line_key = (line_num, raw_line.rstrip("\n\r"))
                    if line_key not in unique_lines_seen:
                        unique_lines_seen.add(line_key)
                        fh_out.write(f"[{line_num_str}] {label}\n")
                        all_matches.append((line_num, label, "Short UI candidate"))
                        matched_by_group["Short UI candidate (2-30 chars)"] += 1
                        total_found += 1

    # ---- Summary ----
    print(f"\n{'='*70}")
    print(f"TOTAL LINES PROCESSED: {total_lines}")
    print(f"TOTAL UI STRINGS FOUND: {total_found}")
    print(f"\nBreakdown by group:")
    for group_name, count in sorted(matched_by_group.items(), key=lambda x: -x[1]):
        print(f"  {group_name}: {count}")

    print(f"\n{'='*70}")
    print(f"Top 30 most interesting UI/structural strings:")
    print(f"{'='*70}")

    # Score and sort by "interestingness" (on ger strings with multiple words, screen names, etc.)
    def interest_key(item):
        _, label, group = item
        score = 0
        # Pref er longer strings
        score += min(len(label), 50)
        # Pref er strings with spaces (phrases)
        if " " in label:
            score += 20
        # Pref er screen names, modal, achievement etc.
        if "Screen" in group or "Modal" in group or "Achievement" in group or "Tutorial" in group:
            score += 15
        if "Button" in group:
            score += 10
        # Pref er Title Case or ALL CAPS
        if label and label[0].isupper() and not label.isupper():
            score += 10
        # Downweight single chars andvery short
        if len(label) <= 2:
            score -= 20
        return -score  # negatve so sorted ascending gives high scores first

    #Deduplicate by label for the "top 30" display
    seen_labels = set()
    deduped = []
    for item in all_matches:
        if item[1].lower() not in seen_labels:
            seen_labels.add(item[1].lower())
            deduped.append(item)

    deduped.sort(key=interest_key)

    for i, (line_num, label, group) in enumerate(deduped[:30]):
        print(f"  [{line_num:06d}] {label[:90]}")
        if len(label) > 90:
            print(f"       ... (truncated, {len(label)} chars)")

    print(f"\nDone. Results written to {OUTPUT}")

if __name__ == "__main__":
    main()