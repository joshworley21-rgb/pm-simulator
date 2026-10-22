#!/usr/bin/env python3
"""Parse a Hermes bytecode bundle (v96) and extract the full string table."""
import struct, sys, os

PATH = sys.argv[1] if len(sys.argv) > 1 else "extracted/assets/index.android.bundle"
OUT = sys.argv[2] if len(sys.argv) > 2 else "hermes_strings.txt"

data = open(PATH, "rb").read()
print(f"[*] file size = {len(data)}")

off = 0
def rd(n):
    global off
    b = data[off:off+n]; off += n
    return b

def u8():  return rd(1)[0]
def u32(): return struct.unpack("<I", rd(4))[0]

# --- header ---
magic = rd(8)
version = u32()
print(f"[*] magic = {magic.hex()}  version = {version}")

src_hash = rd(20)
fileLength      = u32(); print(f"    fileLength      = {fileLength}")
globalCodeIndex = u32(); print(f"    globalCodeIndex = {globalCodeIndex}")
functionCount   = u32(); print(f"    functionCount   = {functionCount}")
stringKindCount = u32(); print(f"    stringKindCount = {stringKindCount}")
identifierCount = u32(); print(f"    identifierCount = {identifierCount}")
stringCount     = u32(); print(f"    stringCount     = {stringCount}")
overflowStrCnt  = u32(); print(f"    overflowStrCnt  = {overflowStrCnt}")
stringStorSize  = u32(); print(f"    stringStorSize  = {stringStorSize}")
regExpCount     = u32(); print(f"    regExpCount     = {regExpCount}")
regExpStorSize  = u32(); print(f"    regExpStorSize  = {regExpStorSize}")
arrayBufSize    = u32(); print(f"    arrayBufSize    = {arrayBufSize}")
objKeyBufSize   = u32(); print(f"    objKeyBufSize   = {objKeyBufSize}")
objValBufSize   = u32(); print(f"    objValBufSize   = {objValBufSize}")
cjsModOffset    = u32(); print(f"    cjsModOffset    = {cjsModOffset}")
cjsModCount     = u32(); print(f"    cjsModCount     = {cjsModCount}")
debugInfoOffset = u32(); print(f"    debugInfoOffset = {debugInfoOffset}")
option          = u8()
padding         = rd(31)

header_end = off
print(f"[*] header size = {header_end}")

# --- skip function headers (16 bytes each, byte-aligned) ---
fn_start = off
off += functionCount * 16
# align 4
while off % 4: off += 1
print(f"[*] function headers: {fn_start}..{off}  ({functionCount * 16} bytes)")

# --- string kinds ---
off += stringKindCount * 4
# --- identifier hashes ---
off += identifierCount * 4

# --- small string table entries (4 bytes each) ---
st_start = off
small_entries = []
for i in range(stringCount):
    b = rd(4)
    val = struct.unpack("<I", b)[0]
    is_utf16 = val & 1
    s_offset = (val >> 1) & 0x7FFFFF   # 23 bits
    s_len    = (val >> 24) & 0xFF       # 8 bits
    small_entries.append((is_utf16, s_offset, s_len))
off += overflowStrCnt * 8  # overflow entries: offset(32) + length(32)

# align 4
while off % 4: off += 1
storage_start = off
print(f"[*] string storage at {storage_start}, size {stringStorSize}")

# --- extract strings ---
strings = []
for idx, (is_utf16, s_offset, s_len) in enumerate(small_entries):
    pos = storage_start + s_offset
    if is_utf16:
        raw = data[pos:pos + s_len*2]
        try:
            s = raw.decode("utf-16-le", errors="replace")
        except:
            s = "<utf16 error>"
    else:
        s = data[pos:pos + s_len].decode("utf-8", errors="replace")
    strings.append((idx, s))

print(f"[*] extracted {len(strings)} small strings")

# also dump overflow entries (long strings, e.g. big JSON blobs)
# re-read overflow entries
off2 = st_start + stringCount * 4
overflow = []
for i in range(overflowStrCnt):
    o = struct.unpack("<I", data[off2:off2+4])[0]; off2 += 4
    l = struct.unpack("<I", data[off2:off2+4])[0]; off2 += 4
    overflow.append((o, l))

print(f"[*] extracted {len(overflow)} overflow entries")

with open(OUT, "w", encoding="utf-8") as f:
    for idx, s in strings:
        f.write(f"[{idx:06d}] {s}\n")
print(f"[*] wrote {OUT}")

# dump overflow strings separately
with open(OUT + ".overflow", "w", encoding="utf-8") as f:
    for i, (o, l) in enumerate(overflow):
        pos = storage_start + o
        s = data[pos:pos+l].decode("utf-8", errors="replace")
        f.write(f"[{i:05d}] {s}\n")
print(f"[*] wrote {OUT}.overflow")
