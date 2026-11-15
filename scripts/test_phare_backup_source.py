import hashlib
import importlib.util
import json
from pathlib import Path
import stat
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location("phare_backup_source", Path(__file__).with_name("phare-backup-source.py"))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class SourceBackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        (self.source / "paroles été.txt").write_text("La lumière\n", encoding="utf-8")
        (self.source / "src").mkdir()
        (self.source / "src" / "app.ts").write_text("export const hello = 'bonjour';")

    def tearDown(self):
        self.temp.cleanup()

    def snapshot(self, **kwargs):
        return backup.snapshot([("phare", self.source)], self.root / "snapshots", **kwargs)

    def malicious(self, names, *, manifest_extra=None):
        p = self.root / "malicious.zip"
        records = []
        with zipfile.ZipFile(p, "w") as z:
            for name in names:
                z.writestr(name, b"test")
                records.append({"path": name, "size": 4, "sha256": hashlib.sha256(b"test").hexdigest()})
            manifest = {"schemaVersion": 1, "scope": "source-files-only", "files": records}
            if manifest_extra:
                manifest.update(manifest_extra)
            z.writestr(backup.MANIFEST, json.dumps(manifest))
        return p

    def test_roundtrip_unicode_and_exclusions(self):
        for name in [".env", ".env.local", "credentials.json", "private.key", "notes.sqlite", "token.json",
                     "MON_API_KEY.txt", "Access_Token.cfg", "private_key.txt", "password-note.txt",
                     "mot-de-passe.txt"]:
            (self.source / name).write_text("must not be included")
        for name in ["node_modules", ".git", ".next-cache", "__pycache__"]:
            (self.source / name).mkdir()
            (self.source / name / "hidden.txt").write_text("no")
        result = self.snapshot()
        self.assertTrue(result["verified"])
        self.assertEqual(result["fileCount"], 2)
        self.assertEqual(backup.verify(result["archive"])["fileCount"], 2)
        destination = self.root / "restored"
        backup.restore(result["archive"], destination)
        self.assertEqual((destination / "phare" / "paroles été.txt").read_bytes(),
                         (self.source / "paroles été.txt").read_bytes())
        self.assertEqual((destination / "phare" / "src" / "app.ts").read_bytes(),
                         (self.source / "src" / "app.ts").read_bytes())
        self.assertFalse((destination / "phare" / ".env").exists())

    def test_snapshot_destination_within_source_is_excluded(self):
        output = self.source / "snapshots"
        output.mkdir()
        (output / "old.zip").write_bytes(b"old")
        result = backup.snapshot([("phare", self.source)], output)
        self.assertEqual(result["fileCount"], 2)
        self.assertEqual((output / "old.zip").read_bytes(), b"old")
        with zipfile.ZipFile(result["archive"]) as z:
            self.assertFalse(any("/snapshots/" in n for n in z.namelist()))

    def test_restore_never_overwrites_existing_destination(self):
        result = self.snapshot()
        destination = self.root / "existing"
        destination.mkdir()
        (destination / "important.txt").write_text("keep")
        with self.assertRaises(backup.BackupError):
            backup.restore(result["archive"], destination)
        self.assertEqual((destination / "important.txt").read_text(), "keep")

    def test_tampered_content_is_rejected_before_final_restore(self):
        result = self.snapshot()
        archive = Path(result["archive"])
        with zipfile.ZipFile(archive) as z:
            contents = {i.filename: z.read(i) for i in z.infolist()}
        contents["phare/src/app.ts"] = b"X" * len(contents["phare/src/app.ts"])
        tampered = self.root / "tampered.zip"
        with zipfile.ZipFile(tampered, "w") as z:
            for name, body in contents.items():
                z.writestr(name, body)
        with self.assertRaises(backup.BackupError):
            backup.verify(tampered)
        destination = self.root / "not-created"
        with self.assertRaises(backup.BackupError):
            backup.restore(tampered, destination)
        self.assertFalse(destination.exists())
        self.assertFalse(list(self.root.glob(".phare-restore-*")))

    def test_traversal_drives_and_windows_collisions_rejected(self):
        for names in [["../escape"], ["/absolute"], ["C:/escape"], ["a\\escape"],
                      ["phare/Readme.md", "phare/README.md"], ["phare/CON.txt"],
                      ["phare/e\u0301.txt", "phare/é.txt"]]:
            with self.subTest(names=names):
                p = self.malicious(names)
                with self.assertRaises(backup.BackupError):
                    backup.verify(p)

    def test_symlinks_excluded_in_source(self):
        target = self.root / "outside.txt"
        target.write_text("outside")
        try:
            (self.source / "link.txt").symlink_to(target)
        except OSError:
            self.skipTest("Symlinks not permitted on this platform")
        result = self.snapshot()
        self.assertEqual(result["fileCount"], 2)

    def test_symlink_zip_entry_rejected_even_without_os_link_privilege(self):
        p = self.root / "symlink.zip"
        with zipfile.ZipFile(p, "w") as z:
            info = zipfile.ZipInfo("phare/link")
            info.create_system = 3
            info.external_attr = (stat.S_IFLNK | 0o777) << 16
            z.writestr(info, b"outside")
            z.writestr(backup.MANIFEST, "{}")
        with self.assertRaises(backup.BackupError):
            backup.verify(p)

    def test_size_limit_failure_leaves_no_archive_or_partial(self):
        with self.assertRaises(backup.BackupError):
            self.snapshot(max_total=2)
        self.assertEqual(list((self.root / "snapshots").iterdir()), [])
        p = self.malicious(["phare/large"])
        with self.assertRaises(backup.BackupError):
            backup.verify(p, max_file=2)

    def test_changed_file_fails_without_publishing_snapshot(self):
        original = backup._stat_signature
        calls = 0
        def signature(value):
            nonlocal calls
            calls += 1
            # The recorded lstat equals first fstat; make after-read comparison differ.
            return (*original(value), 2 if calls == 4 else 1)
        with patch.object(backup, "_stat_signature", signature):
            with self.assertRaises(backup.BackupError):
                self.snapshot()
        self.assertEqual(list((self.root / "snapshots").iterdir()), [])

    def test_duplicate_aliases_and_overlapping_roots_fail(self):
        for sources in [[("phare", self.source), ("PHARE", self.root)],
                        [("phare", self.source), ("src", self.source / "src")]]:
            with self.assertRaises(backup.BackupError):
                backup.snapshot(sources, self.root / "snapshots")

    def test_snapshot_uses_fresh_stat_not_windows_direntry_identity(self):
        real_scandir = backup.os.scandir
        class EntryWithUnavailableIdentity:
            def __init__(self, entry):
                self.path = entry.path
                self.name = entry.name
            def stat(self, **kwargs):
                # DirEntry.stat identity must not determine a file's identity.
                raise AssertionError("Cached DirEntry.stat must not be used")
        def scandir(path):
            with real_scandir(path) as entries:
                return [EntryWithUnavailableIdentity(entry) for entry in entries]
        with patch.object(backup.os, "scandir", scandir):
            result = self.snapshot()
        self.assertTrue(result["verified"])
        self.assertEqual(result["fileCount"], 2)

    def test_windows_ctime_difference_does_not_invent_data_change(self):
        fields = {"st_dev": 11, "st_ino": 128, "st_size": 20,
                  "st_mtime_ns": 30, "st_ctime_ns": 40, "st_birthtime_ns": 10}
        stat_result = SimpleNamespace(**fields)
        fstat_result = SimpleNamespace(**{**fields, "st_ctime_ns": 41})
        with patch.object(backup.os, "name", "nt"):
            self.assertEqual(backup._stat_signature(stat_result), backup._stat_signature(fstat_result))
            for changed in [{"st_size": 21}, {"st_mtime_ns": 31}, {"st_ino": 129},
                            {"st_birthtime_ns": 12}]:
                with self.subTest(changed=changed):
                    self.assertNotEqual(backup._stat_signature(stat_result),
                                        backup._stat_signature(SimpleNamespace(**{**fields, **changed})))
        with patch.object(backup.os, "name", "posix"):
            self.assertNotEqual(backup._stat_signature(stat_result), backup._stat_signature(fstat_result))

    def test_snapshot_name_is_versioned_and_preserves_previous(self):
        first, second = self.snapshot(), self.snapshot()
        self.assertNotEqual(first["archive"], second["archive"])
        self.assertTrue(Path(first["archive"]).exists())
        self.assertTrue(Path(second["archive"]).exists())


if __name__ == "__main__":
    unittest.main()
