#!/usr/bin/env python3
"""Attach an authentic, explicitly supplied narration to an image-only video.

Fail closed: do not stretch, loop, synthesize or replace the user's voice.
"""
import argparse
import json
import subprocess
from pathlib import Path

def duration(path):
    result = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
        "format=duration", "-of", "default=noprint_wrappers=1:nokey=1",
        str(path)], capture_output=True, text=True, check=True)
    return float(result.stdout.strip())

def attach(visual, narration, output, tolerance=0.5):
    if not visual.is_file() or not narration.is_file():
        raise ValueError("Video or authentic narration missing")
    if output.resolve() in (visual.resolve(), narration.resolve()):
        raise ValueError("Output must not overwrite source")
    v, a = duration(visual), duration(narration)
    if abs(v - a) > tolerance:
        raise ValueError(f"Narration mismatch: video {v:.2f}s, voice {a:.2f}s. "
                         "Rebuild visual scenes to match actual spoken narration.")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(visual), "-i", str(narration),
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
        "-t", str(min(v, a)), "-movflags", "+faststart",
        str(output)], check=True)
    return {"status": "audio_attached_review_required", "video_seconds": v,
            "narration_seconds": a, "voice_identity_verified": False,
            "editorial_review_required": True, "publishable": False,
            "output": str(output)}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("visual", type=Path)
    parser.add_argument("narration", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    print(json.dumps(attach(args.visual, args.narration, args.output),
                     ensure_ascii=False, indent=2))
