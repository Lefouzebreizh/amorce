"""Unit tests for video delivery preflight (no FFmpeg execution or API credits)."""
import importlib.util
import pathlib
import tempfile
import unittest
from unittest.mock import patch

MODULE = pathlib.Path(__file__).with_name("validate_video_delivery.py")
spec = importlib.util.spec_from_file_location("validate_video_delivery", MODULE)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

class ValidateVideoTests(unittest.TestCase):
    def test_missing_file_is_rejected(self):
        self.assertEqual(validator.validate(pathlib.Path("/missing-video.mp4"))["status"], "failed")

    def test_valid_streams_are_only_technical_pass(self):
        with tempfile.TemporaryDirectory() as folder:
            file = pathlib.Path(folder) / "film.mp4"
            file.write_bytes(b"placeholder")
            with patch.object(validator, "probe", return_value={
                "format": {"duration": "125.0"},
                "streams": [{"codec_type": "video", "codec_name": "h264"},
                            {"codec_type": "audio", "codec_name": "aac"}]
            }):
                result = validator.validate(file)
            self.assertEqual(result["status"], "technical_pass")
            self.assertTrue(result["editorial_review_required"])
            self.assertFalse(result["voice_identity_verified"])
            self.assertFalse(result["drive_mobile_access_verified"])

    def test_missing_audio_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            file = pathlib.Path(folder) / "film.mp4"
            file.write_bytes(b"placeholder")
            with patch.object(validator, "probe", return_value={
                "format": {"duration": "125"},
                "streams": [{"codec_type": "video", "codec_name": "h264"}]
            }):
                result = validator.validate(file)
            self.assertEqual(result["status"], "failed")
            self.assertIn("Piste audio absente", result["errors"])

    def test_wrong_codecs_and_duration_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            file = pathlib.Path(folder) / "film.mp4"
            file.write_bytes(b"placeholder")
            with patch.object(validator, "probe", return_value={
                "format": {"duration": "2"},
                "streams": [{"codec_type": "video", "codec_name": "vp9"},
                            {"codec_type": "audio", "codec_name": "opus"}]
            }):
                result = validator.validate(file)
            self.assertEqual(result["status"], "failed")
            self.assertEqual(len(result["errors"]), 3)

if __name__ == "__main__":
    unittest.main()
