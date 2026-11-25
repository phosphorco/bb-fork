import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('converter', Path(__file__).with_name('convert-offline-migration-ledger.py'))
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)


class OfflineLedgerTests(unittest.TestCase):
    def test_copy_preserves_data_and_refuses_unsafe_history(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            migrations = root/'drizzle'
            (migrations/'meta').mkdir(parents=True)
            (migrations/'native.sql').write_text('SELECT 1;')
            (migrations/'meta/_journal.json').write_text(json.dumps({'entries': [{'tag': 'native', 'when': 1}]}))
            manifest = root/'manifest.json'
            manifest.write_text(json.dumps({'retired_receipts': [{'hash': 'retired', 'created_at': 2}]}))
            source, output = root/'source.db', root/'output.db'
            with sqlite3.connect(source) as db:
                db.executescript('CREATE TABLE __drizzle_migrations(hash TEXT, created_at INTEGER); CREATE TABLE opaque(body TEXT); INSERT INTO opaque VALUES ("keep");')
                db.executemany('INSERT INTO __drizzle_migrations VALUES (?,?)', [(hashlib.sha256(b'SELECT 1;').hexdigest(), 1), ('retired', 2), ('unrelated', 3)])
            before = source.read_bytes()
            converter.convert(source, output, manifest, migrations)
            self.assertEqual(source.read_bytes(), before)
            with sqlite3.connect(output) as db:
                self.assertEqual(db.execute('SELECT * FROM opaque').fetchall(), [('keep',)])
                self.assertEqual(db.execute('SELECT * FROM __drizzle_migrations WHERE created_at > 1').fetchall(), [('unrelated', 3)])
            with self.assertRaises(FileExistsError): converter.convert(source, source, manifest, migrations)
            with self.assertRaises(FileExistsError): converter.convert(source, output, manifest, migrations)
            output.unlink()
            with sqlite3.connect(source) as db: db.execute('DELETE FROM __drizzle_migrations WHERE created_at = 1')
            with self.assertRaisesRegex(ValueError, 'incomplete'): converter.convert(source, output, manifest, migrations)
            self.assertFalse(output.exists())
            with sqlite3.connect(source) as db:
                db.execute('INSERT INTO __drizzle_migrations VALUES (?, 1)', (hashlib.sha256(b'SELECT 1;').hexdigest(),))
                db.execute('UPDATE __drizzle_migrations SET hash = "wrong" WHERE created_at = 2')
            with self.assertRaisesRegex(ValueError, 'exactly one'): converter.convert(source, output, manifest, migrations)
            self.assertFalse(output.exists())


if __name__ == '__main__': unittest.main()
