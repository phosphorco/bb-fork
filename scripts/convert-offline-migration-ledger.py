#!/usr/bin/env python3
"""Produce a NEW offline database copy with explicitly reviewed receipts removed.

Never modifies the input. Retains every table, data row and unrelated receipt.
This is an operator preparation tool, never imported by the server.
"""
import argparse
from contextlib import closing
import os
import hashlib
import json
from pathlib import Path
import sqlite3


def convert(source, output, manifest, migrations):
    source, output = Path(source).resolve(strict=True), Path(output).absolute()
    reviewed = json.loads(Path(manifest).read_text())['retired_receipts']
    identities = [(row['hash'], row['created_at']) for row in reviewed]
    if not identities or len(set(identities)) != len(identities):
        raise ValueError('Receipt manifest must contain distinct exact identities')
    journal = json.loads((Path(migrations) / 'meta/_journal.json').read_text())
    expected = [(hashlib.sha256((Path(migrations) / (row['tag']+'.sql')).read_bytes()).hexdigest(), row['when']) for row in journal['entries']]
    if set(expected) & set(identities):
        raise ValueError('Refusing to remove a selected native migration receipt')
    # Exclusive creation also refuses existing files, symlinks and the live DB.
    # Every subsequent write uses this newly created output only.
    with source.open('rb'):
        os.close(os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600))
    try:
        with closing(sqlite3.connect(source.as_uri()+'?mode=ro', uri=True)) as src:
            with closing(sqlite3.connect(output)) as dst:
                src.backup(dst)
                rows = dst.execute('SELECT hash, created_at FROM __drizzle_migrations').fetchall()
                if any(rows.count(identity) != 1 for identity in identities):
                    raise ValueError('Reviewed receipts must each match exactly one installed row')
                if any(rows.count(identity) != 1 for identity in expected):
                    raise ValueError('Native migration history incomplete or mismatched; no schema inference or replay is permitted')
                with dst:
                    dst.executemany('DELETE FROM __drizzle_migrations WHERE hash = ? AND created_at = ?', identities)
                if dst.execute('PRAGMA quick_check').fetchall() != [('ok',)]:
                    raise ValueError('Converted database failed quick_check')
                remaining = dst.execute('SELECT hash, created_at FROM __drizzle_migrations').fetchall()
                if sorted(remaining) != sorted(row for row in rows if row not in identities):
                    raise ValueError('Unrelated receipt changed')
    except BaseException:
        output.unlink()
        raise
    return {'source': str(source), 'output': str(output), 'removed_receipts': reviewed,
            'retained_receipt_count': len(remaining), 'quick_check': 'ok',
            'activation': 'Not performed. Qualify the copy with the selected binary before any separately authorized cutover.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', help='Offline source snapshot, opened read-only')
    parser.add_argument('output', help='New output file; existing files are refused')
    parser.add_argument('manifest', help='Reviewed JSON with exact retired_receipts hash/created_at pairs')
    parser.add_argument('migrations', help='Selected source packages/db/drizzle directory')
    args = parser.parse_args()
    print(json.dumps(convert(args.source, args.output, args.manifest, args.migrations), indent=2))
