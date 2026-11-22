#!/usr/bin/env python3
"""Validation locale ou CI d'un export vidéo avant livraison. Aucun appel API."""
import argparse
import json
import subprocess
from pathlib import Path

def probe(path):
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=codec_type,codec_name,width,height",
        "-of", "json", str(path)], capture_output=True, text=True, check=True)
    return json.loads(p.stdout)

def validate(path, min_duration=30, max_duration=900):
    if not path.is_file() or path.stat().st_size == 0:
        return {"status": "failed", "reason": "Fichier absent ou vide"}
    try:
        meta = probe(path)
        streams = meta.get("streams", [])
        video = [s for s in streams if s.get("codec_type") == "video"]
        audio = [s for s in streams if s.get("codec_type") == "audio"]
        duration = float(meta.get("format", {}).get("duration", 0))
        errors = []
        if not video: errors.append("Piste vidéo absente")
        if not audio: errors.append("Piste audio absente")
        if not min_duration <= duration <= max_duration: errors.append("Durée hors limites")
        if video and video[0].get("codec_name") != "h264": errors.append("Codec vidéo non H264")
        if audio and audio[0].get("codec_name") != "aac": errors.append("Codec audio non AAC")
        return {"status": "failed" if errors else "technical_pass",
                "duration_seconds": round(duration, 2),
                "video_codec": video[0].get("codec_name") if video else None,
                "audio_codec": audio[0].get("codec_name") if audio else None,
                "errors": errors,
                "editorial_review_required": True,
                "voice_identity_verified": False,
                "drive_mobile_access_verified": False}
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        return {"status": "failed", "reason": str(exc)}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("video", type=Path)
    ap.add_argument("--min-duration", type=float, default=30)
    ap.add_argument("--max-duration", type=float, default=900)
    args = ap.parse_args()
    result = validate(args.video, args.min_duration, args.max_duration)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["status"] == "technical_pass" else 1)
