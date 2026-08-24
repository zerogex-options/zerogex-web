#!/usr/bin/env python3
"""Verify a NinjaTrader export archive really contains our indicator source.

The archive is produced by NinjaTrader on someone else's machine (we have no
NT8 in this toolchain), and it becomes a public download from zerogex.io. So
before publishing it we prove that the source inside is the source of record —
byte for byte, after normalisation — rather than trusting the sender.

It also catches the duller but likelier failure: a stale archive exported
before the last edit to the .cs, which would silently ship an old indicator.

What NinjaTrader's export actually looks like (measured, not assumed):

    Indicators\\<name>.cs      the file you pasted in, CRLF, UTF-8 BOM
    Info.xml                   tiny manifest; its presence is what makes the
                               archive importable

Two things stop the comparison being a plain diff:

* Paths use BACKSLASHES and the .cs is named after whatever the user called
  the indicator in the editor, not after our filename. So the member is found
  by class declaration, not by path.
* NinjaTrader APPENDS a "#region NinjaScript generated code" block holding the
  factory overloads it derives from the [NinjaScriptProperty] members. That
  region is not in our source and legitimately varies with the property set.

So: everything before that marker must equal our source exactly, and the
generated tail is checked separately.

LIMITS, stated plainly: the tail is compiled too, and this script does not
prove it is benign — it only rejects a denylist of constructs NinjaTrader's
factory code never emits, and prints the tail's hash so a reviewer can pin or
eyeball it. Full assurance needs a human to read the tail once per property
change. Exit 0 = pass, 1 = reject.
"""

import hashlib
import re
import sys
import zipfile

GENERATED_MARKER = "#region NinjaScript generated code"
CLASS_DECL = re.compile(r"class\s+ZeroGexGammaLevels\b")

# Constructs NinjaTrader's generated factory block never contains. This is a
# tripwire, not a sandbox: it catches code smuggled into the one section we
# cannot diff, without pretending to be a full audit.
TAIL_DENYLIST = (
    "HttpClient", "WebClient", "WebRequest", "Socket",
    "System.IO", "File.", "Directory.", "StreamWriter",
    "Process", "Registry", "DllImport", "Assembly.Load", "AppDomain",
    "Environment.", "Marshal.",
)


def normalise(raw: bytes) -> str:
    """Strip the UTF-8 BOM and collapse CRLF, so a Windows round trip is a no-op."""
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    return raw.decode("utf-8").replace("\r\n", "\n").replace("\r", "\n")


def fail(message: str) -> None:
    print("  ✗ %s" % message)
    sys.exit(1)


def main() -> None:
    if len(sys.argv) != 3:
        print("usage: verify-ninjatrader-package.py <archive.zip> <source.cs>")
        sys.exit(2)

    archive_path, source_path = sys.argv[1], sys.argv[2]

    with open(source_path, "rb") as handle:
        source = normalise(handle.read())

    try:
        archive = zipfile.ZipFile(archive_path)
    except zipfile.BadZipFile:
        fail("%s is not a readable zip archive" % archive_path)

    with archive:
        if archive.testzip() is not None:
            fail("archive contains a corrupt member")

        names = archive.namelist()
        # NinjaTrader writes backslash separators; normalise before matching.
        if not any(n.replace("\\", "/").rsplit("/", 1)[-1].lower() == "info.xml" for n in names):
            fail("no Info.xml — NinjaTrader will not import this archive")

        candidates = [n for n in names if n.lower().endswith(".cs")]
        if not candidates:
            fail("archive contains no .cs source")

        matches = []
        for name in candidates:
            try:
                text = normalise(archive.read(name))
            except UnicodeDecodeError:
                continue
            if CLASS_DECL.search(text):
                matches.append((name, text))

        if not matches:
            fail("no member declares class ZeroGexGammaLevels (found: %s)" % ", ".join(candidates))
        if len(matches) > 1:
            fail("several members declare the indicator: %s" % ", ".join(n for n, _ in matches))

        member_name, embedded = matches[0]

    if GENERATED_MARKER in embedded:
        split_at = embedded.index(GENERATED_MARKER)
        body, tail = embedded[:split_at], embedded[split_at:]
    else:
        # Not fatal: an archive can be exported before NinjaTrader appends the
        # region. The body still has to match.
        body, tail = embedded, ""

    if body.rstrip() != source.rstrip():
        print("  ✗ the source inside the archive is NOT the source of record")
        print("    archive member : %s" % member_name)
        print("    expected sha256: %s" % hashlib.sha256(source.rstrip().encode()).hexdigest())
        print("    embedded sha256: %s" % hashlib.sha256(body.rstrip().encode()).hexdigest())
        print("    Re-export from NinjaTrader against the current .cs.")
        sys.exit(1)

    for token in TAIL_DENYLIST:
        if token in tail:
            fail("generated region contains %r, which NinjaTrader never emits" % token)

    print("  ✓ archive source matches %s" % source_path)
    print("    member %s, %d lines, generated tail %d bytes (sha256 %s)"
          % (member_name, body.count("\n"), len(tail),
             hashlib.sha256(tail.encode()).hexdigest()[:16] if tail else "none"))


if __name__ == "__main__":
    main()
