import re
import stat
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from prepare import KEYS, prepare


class TestPrepare(unittest.TestCase):
    def test_generates_all_private_secrets(self):
        with tempfile.TemporaryDirectory() as temporary:
            runtime = Path(temporary) / ".runtime"

            self.assertTrue(prepare(runtime))

            target = runtime / ".env"
            fields = dict(line.split("=", 1) for line in target.read_text().splitlines())
            self.assertEqual(set(fields), set(KEYS))
            self.assertEqual(
                set(KEYS),
                {
                    "JWT_SECRET",
                    "API_KEY_SECRET",
                    "INITIAL_PASSWORD",
                    "STORAGE_ENCRYPTION_KEY",
                    "OMNIROUTE_WS_BRIDGE_SECRET",
                },
            )
            self.assertTrue(all(re.fullmatch(r"[0-9a-f]{64}", value) for value in fields.values()))
            self.assertEqual(stat.S_IMODE(target.stat().st_mode), 0o600)

    def test_preserves_existing_secrets(self):
        with tempfile.TemporaryDirectory() as temporary:
            runtime = Path(temporary) / ".runtime"
            prepare(runtime)
            target = runtime / ".env"
            original = target.read_bytes()

            self.assertFalse(prepare(runtime))
            self.assertEqual(target.read_bytes(), original)

    def test_rejects_incomplete_existing_env_without_modifying_it(self):
        with tempfile.TemporaryDirectory() as temporary:
            runtime = Path(temporary) / ".runtime"
            runtime.mkdir(mode=0o700)
            target = runtime / ".env"
            target.write_text("JWT_SECRET=" + "a" * 64 + "\n")
            target.chmod(0o600)
            original = target.read_bytes()

            with self.assertRaisesRegex(ValueError, "incomplete"):
                prepare(runtime)
            self.assertEqual(target.read_bytes(), original)

    def test_rejects_insecure_existing_env_without_modifying_it(self):
        with tempfile.TemporaryDirectory() as temporary:
            runtime = Path(temporary) / ".runtime"
            runtime.mkdir(mode=0o700)
            target = runtime / ".env"
            target.write_text("".join(f"{key}={'a' * 64}\n" for key in KEYS))
            target.chmod(0o644)
            original = target.read_bytes()

            with self.assertRaisesRegex(ValueError, "mode 600"):
                prepare(runtime)
            self.assertEqual(target.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
