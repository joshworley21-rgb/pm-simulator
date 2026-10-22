#!/usr/bin/env python3
import os
import re

INPUT_FILE = "/workspace/pm-sim/apk_decompile/hermes_strings.txt"
OUTPUT_FILE = "/workspace/pm-sim/apk_decompile/analysis/analysis_content_events.txt"

os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

MATCHERS = [
    re.compile(r, re.IGNORECASE) for r in [
        r"\{APPROVAL\}",
        r"\{ECONOMY\}",
        r"\{INSERT\}",
        r"\{VARIABLE\}",
        r"\{[A-Z_]{3,}\}",
        r"\bcrisis\b",
        r"\bdisaster\b",
        r"\bscandal\b",
        r"\bemergency\b",
        r"\bdiplomatic\s+incident\b",
        r"\bdomestic\b",
        r"\bpolicy\b",
        r"\bdecision\b",
        r"\bcabinet\b",
        r"\bminister\b",
        r"\bparliament\b",
        r"\bcongress\b",
        r"\belection\b",
        r"\bprotest\b",
        r"\briot\b",
        r"\bassassination\b",
        r"\bcoup\b",
        r"\bterroris",
        r"\bwar\b",
        r"\bconflict\b",
        r"\breform\b",
        r"\bcorruption\b",
    ]
]

JUNK_MARKERS = re.compile(
    r"rror generating stack|enerating stack|Error generating stack|"
    r"or generating stack|rating stack|r generating stack|nerating stack|"
    r"worklet_|_init_data|addNativeThreadCpuProfile|ArrayBuffer|"
    r"ViewManager|hasViewManagerConfig|ViewConfig|native ViewConfig|"
    r"gba\(\d+|NO WINSUFFICIENT_SPACE|Hooks\[RevenueCat\]|Native module \(RN|"
    r"getViewManagerConfig|parameter \d is not of type|"
    r"on 'EventTarget'|MAYBE_JSON_TRUNCATED|_JSON_TRUNCATED|JSON_TRUNCATED|"
    r"ContentLoadedEvent|MathRandom|"
    r"TRUNCATEDIS_DROUGHT|CHALLENGER_BY_CONTEXT|"
    r"REACT_MOUNT|PCT03_NUCLEAR|WASTEALTH|_AB_SPLIT",
    re.IGNORECASE
)

def word_count(text):
    return len(text.split())

def max_run_no_space(text):
    runs = re.findall(r'\S+', text)
    if not runs:
        return 0
    return max(len(r) for r in runs)

def camelcase_density(text):
    tokens = re.findall(r'[a-zA-Z_][a-z]+(?:[A-Z][a-z]+)+', text)
    return sum(len(t) for t in tokens) / max(len(text), 1)

def consecutive_upper_run_ratio(text):
    runs = re.findall(r'[A-Z_]{4,}', text)
    return sum(len(r) for r in runs) / max(len(text), 1)

def has_natural_sentences(text):
    """Check for natural sentence boundaries: period/question-mark/exclamation
    followed by space and capital letter, or end of string."""
    return bool(re.search(r'[.!?]["\']?\s+[A-Z]', text))

def is_narrative(text):
    t = text.strip()
    if len(t) < 50:
        return False
    if " " not in t:
        return False
    if not any(ch in t for ch in ".!?,"):
        return False
    wc = word_count(t)
    if wc < 6:
        return False
    if JUNK_MARKERS.search(t):
        return False
    if consecutive_upper_run_ratio(t) > 0.12:
        return False
    if max_run_no_space(t) > 40:
        return False
    if camelcase_density(t) > 0.15:
        return False
    return True

def matches_templates(text):
    for m in MATCHERS:
        if m.search(text):
            return True
    return False

def is_likely_code_or_data(text):
    t = text.strip()
    bracket_ratio = (t.count("{") + t.count("}") + t.count("[") + t.count("]") + t.count("(") + t.count(")")) / max(len(t), 1)
    if bracket_ratio > 0.15:
        return True
    if t.startswith("function") or t.startswith("var ") or t.startswith("const "):
        return True
    if re.match(r"^[\s\{\}\[\](),;:]+$", t):
        return True
    return False

events = []
top_candidates = []

with open(INPUT_FILE, "r", encoding="utf-8", errors="replace") as f:
    for line in f:
        line = line.rstrip("\n\r")
        m = re.match(r"^\[(\d+)\]\s+(.*)", line)
        if not m:
            continue
        line_num = m.group(1)
        content = m.group(2)

        if is_likely_code_or_data(content):
            continue

        hit = False
        if is_narrative(content):
            hit = True
        elif matches_templates(content) and len(content.strip()) >= 30:
            hit = True

        if hit:
            outline = f"[{line_num}] {content}"
            events.append(outline)
            top_candidates.append((len(content), outline))

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    for ev in events:
        f.write(ev + "\n")

print(f"Total events found: {len(events)}")

top_candidates.sort(key=lambda x: x[0], reverse=True)
unique_top = []
seen = set()
for _, s in top_candidates:
    norm = s.lower().strip()
    if norm not in seen:
        seen.add(norm)
        unique_top.append(s)
    if len(unique_top) >= 10:
        break

print("\nTop 10 most interesting/longest narrative strings:")
for i, s in enumerate(unique_top, 1):
    print(f"  {i}. {s}")