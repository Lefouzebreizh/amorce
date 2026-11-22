#!/usr/bin/env python3
"""Build a silent image-only preview from an explicit scene manifest.

This is NOT a finished family video. Voice narration must be added and verified
before publishing. Refuses to consume pre-existing presentation MP4s.
"""
import argparse
import json
import subprocess
from pathlib import Path

def build(manifest_path, output):
    manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    scenes = manifest.get("scenes", [])
    if not scenes:
        raise ValueError("At least one scene is required")
    if output.suffix.lower() != ".mp4":
        raise ValueError("Output must be MP4")
    args = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    filters = []
    for index, scene in enumerate(scenes):
        source = Path(scene["image"]).expanduser().resolve()
        duration = float(scene["duration_seconds"])
        if source.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
            raise ValueError("Only still images accepted; no old video montages")
        if not source.is_file() or not 1 <= duration <= 30:
            raise ValueError("Missing image or invalid duration")
        args += ["-loop", "1", "-framerate", "25", "-t", str(duration), "-i", str(source)]
        filters.append(f"[{index}:v]scale=1280:720:force_original_aspect_ratio=decrease,"
                       f"pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25,"
                       f"format=yuv420p,trim=duration={duration},setpts=PTS-STARTPTS[v{index}]")
    filters.append("".join(f"[v{i}]" for i in range(len(scenes))) +
                   f"concat=n={len(scenes)}:v=1:a=0[out]")
    args += ["-filter_complex", ";".join(filters), "-map", "[out]",
             "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
             "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(output)]
    subprocess.run(args, check=True)
    return {"status": "visual_preview_only", "scenes": len(scenes),
            "narration_present": False, "publishable": False, "output": str(output)}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    opts = parser.parse_args()
    print(json.dumps(build(opts.manifest, opts.output), ensure_ascii=False))
