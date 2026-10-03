from __future__ import annotations

import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

MODULE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MODULE_ROOT))
import runner  # noqa: E402


class PortfolioRunnerTests(unittest.TestCase):
    def test_repository_manifest_is_valid_and_studio_is_last(self):
        data = runner.load_manifest(runner.DEFAULT_MANIFEST)
        ordered = sorted(data["projects"], key=lambda item: item["order"])
        self.assertEqual("lefouzebreizh-studio", ordered[-1]["id"])
        self.assertEqual(24, len(ordered))

    def test_renamed_projects_keep_only_canonical_entries(self):
        data = runner.load_manifest(runner.DEFAULT_MANIFEST)
        by_id = {item["id"]: item for item in data["projects"]}
        self.assertIn("Artisan Express", by_id["artisan-express-v2"]["replaces"])
        self.assertIn("Rénov facile", by_id["ensemble-pour-renover"]["replaces"])
        self.assertIn("Ensemble MDPH", by_id["ensemble-pour-les-demarches"]["replaces"])
        self.assertIn("Orientation Express", by_id["ensemble-pour-sorienter"]["replaces"])

    def test_plan_only_never_starts_external_command(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "report"
            with patch.object(runner, "command_result") as command:
                code = runner.run([
                    "--project", "artisan-express-v2",
                    "--output", str(output),
                ])
            self.assertEqual(0, code)
            command.assert_not_called()
            report = json.loads((output / "report.json").read_text(encoding="utf-8"))
            self.assertEqual("plan-only", report["mode"])
            self.assertEqual("planifié", report["projects"][0]["result"])

    def test_gemini_needs_explicit_usage_acceptance(self):
        with self.assertRaisesRegex(ValueError, "accept-gemini-usage"):
            runner.run(["--project", "artisan-express-v2", "--execute-gemini"])

    def test_unknown_status_is_rejected(self):
        data = runner.load_manifest(runner.DEFAULT_MANIFEST)
        data["projects"][0]["status"] = "Fini"
        with self.assertRaisesRegex(ValueError, "Statut interdit"):
            runner.validate_manifest(data)

    def test_unknown_project_is_rejected(self):
        data = runner.load_manifest(runner.DEFAULT_MANIFEST)
        with self.assertRaisesRegex(ValueError, "inconnu"):
            runner.select_projects(data, ["absent"], [])


if __name__ == "__main__":
    unittest.main()
