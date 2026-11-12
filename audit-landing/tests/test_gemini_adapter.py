"""Regression tests: real schema/HTML, synthetic API responses, no billed requests."""
import contextlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import urllib.error
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import analyser_captures_gemini as gemini

PNG = __import__("base64").b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="
)

def fixture():
    report = {
        "verdict_global": "a_ameliorer", "resume": "Fixture de test, aucun audit réel.",
        "categories": [{"nom": name, "note": 5, "constats": [{
            "segment": "01-hero.png", "severite": "mineur",
            "observation": "Observation synthétique", "recommandation": "Revoir le texte",
        }]} for name in gemini.CATEGORIES],
        "priorites": ["Vérifier le parcours", "Regarder la page", "Contrôler le rendu"],
    }
    return {"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(report)}]}}]}

class GeminiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp.name)
        (self.folder / "01-hero.png").write_bytes(PNG)
        self.segments = [self.folder / "01-hero.png"]

    def tearDown(self):
        self.temp.cleanup()

    def test_all_segments_and_reference_excluded(self):
        for i in range(2, 7):
            (self.folder / f"{i:02d}-milieu.png").write_bytes(PNG)
        (self.folder / "00-pleine-page.png").write_bytes(PNG)
        payload = gemini.build_payload(gemini.lister_segments(self.folder))
        images = [p for p in payload["contents"][0]["parts"] if "inlineData" in p]
        self.assertEqual(6, len(images))

    def test_blocked_and_truncated_do_not_pass(self):
        for reason in ("MAX_TOKENS", "SAFETY", None):
            response = fixture()
            response["candidates"][0]["finishReason"] = reason
            with self.assertRaises(ValueError):
                gemini.parse_response(response, self.segments)

    def test_unknown_capture_and_fractional_note_refused(self):
        for field, value in (("note", 5.5), ("segment", "../missing.png")):
            response = fixture()
            data = json.loads(response["candidates"][0]["content"]["parts"][0]["text"])
            category = data["categories"][0]
            (category if field == "note" else category["constats"][0])[field] = value
            response["candidates"][0]["content"]["parts"][0]["text"] = json.dumps(data)
            with self.assertRaises(ValueError):
                gemini.parse_response(response, self.segments)

    def test_failed_api_preserves_old_reports_without_new_success(self):
        old = self.folder / "rapport.md"
        old.write_text("ancienne analyse")
        with patch.object(gemini, "request_json", side_effect=RuntimeError("Gemini HTTP 401")):
            with self.assertRaises(RuntimeError):
                gemini.analyse(self.folder, "test-key", gemini.DEFAULT_MODEL)
        self.assertEqual(old.read_text(), "ancienne analyse")
        self.assertFalse((self.folder / "analyses").exists())

    def test_success_html_and_trace_are_compatible(self):
        with patch.object(gemini, "request_json", return_value=fixture()):
            output = gemini.analyse(self.folder, "test-key", gemini.DEFAULT_MODEL)
        html = (output / "rapport.html").read_text(encoding="utf-8")
        self.assertIn("Observation synthétique", html)
        self.assertRegex(html, r"data:image/(png|jpeg);base64,")
        trace = json.loads((output / "execution.json").read_text())
        self.assertEqual(trace["scope"], "visual_only")
        self.assertEqual(len(trace["captures"]), 1)
        self.assertNotIn("test-key", json.dumps(trace))

    def test_missing_key_and_explicit_env_file(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                gemini.read_key()
            env = self.folder / "secret.env"
            env.write_text('GEMINI_API_KEY="fixture-secret"\n')
            self.assertEqual(gemini.read_key(env), "fixture-secret")

    def test_429_no_retry_no_secret_in_error(self):
        error = urllib.error.HTTPError("https://example.invalid", 429, "secret", {}, None)
        with patch.object(gemini.urllib.request, "urlopen", side_effect=error) as call:
            with self.assertRaisesRegex(RuntimeError, "quota atteint") as caught:
                gemini.request_json("/models/example", "test-key")
            self.assertEqual(call.call_count, 1)
            self.assertNotIn("secret", str(caught.exception))

    def test_invalid_png_and_large_payload_rejected_before_network(self):
        self.segments[0].write_text("not an image")
        with self.assertRaises(ValueError):
            gemini.build_payload(self.segments)
        with patch.object(gemini, "MAX_REQUEST_BYTES", 10):
            with patch.object(gemini.urllib.request, "urlopen") as call:
                with self.assertRaises(ValueError):
                    gemini.request_json("/models/example", "test-key", {"text": "x" * 30})
                call.assert_not_called()

if __name__ == "__main__":
    unittest.main()
