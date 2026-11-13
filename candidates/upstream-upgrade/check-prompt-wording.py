#!/usr/bin/env python3
"""Check the unselected prompt patch and its missing-source failure behavior."""
from pathlib import Path
import subprocess
import sys
import tempfile

PATCH = Path(__file__).with_name("prompt-wording.patch").resolve()
SOURCE = Path("plugins/bb-guide/introduction.ts")
REQUIRED = (
    "to inspect or wait for other BB threads.",
    "except your parent thread (shown in `bb status`)",
)


def check(root):
    source = (root / SOURCE).read_text()
    for text in REQUIRED:
        if source.count(text) != 1:
            raise ValueError(f"required prompt source match: expected 1, found {source.count(text)}: {text}")
    result = subprocess.run(
        ["git", "apply", "--check", str(PATCH)], cwd=root,
        text=True, capture_output=True,
    )
    if result.returncode:
        raise ValueError(result.stderr.strip())


def main():
    if len(sys.argv) != 2:
        raise ValueError("usage: check-prompt-wording.py UPSTREAM_CHECKOUT")
    root = Path(sys.argv[1]).resolve()
    check(root)
    touched = subprocess.check_output(
        ["git", "apply", "--numstat", str(PATCH)], cwd=root, text=True,
    ).splitlines()
    if touched != [f"2\t2\t{SOURCE}"]:
        raise ValueError(f"unexpected patch footprint: {touched}")
    with tempfile.TemporaryDirectory(prefix="bb-prompt-wording-") as directory:
        fixture = Path(directory)
        subprocess.run(["git", "init", "-q", str(fixture)], check=True)
        (fixture / SOURCE).parent.mkdir(parents=True)
        (fixture / SOURCE).write_text((root / SOURCE).read_text())
        check(fixture)
        for expected in REQUIRED:
            (fixture / SOURCE).write_text((root / SOURCE).read_text().replace(expected, "upstream changed this wording"))
            try:
                check(fixture)
            except ValueError as error:
                if "required prompt source match" not in str(error):
                    raise
            else:
                raise AssertionError("missing required wording was accepted")
    print("PASS: native patch application; introduction-only footprint; both missing-match failures")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError) as error:
        sys.exit(str(error))
