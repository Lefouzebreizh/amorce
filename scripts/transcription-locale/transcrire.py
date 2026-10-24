#!/usr/bin/env python3
"""Transcrit un audio français et aligne les mots avec WhisperX, hors ligne côté audio.

Les poids du modèle sont téléchargés depuis Hugging Face au premier lancement.
Le fichier audio reste sur la machine et n'est envoyé à aucun service.
"""

from __future__ import annotations

import argparse
import json
from importlib.metadata import version
from pathlib import Path
from typing import Any


class OneSentenceTokenizer:
    """Évite un téléchargement NLTK : WhisperX fournit déjà ses segments audio."""

    @staticmethod
    def tokenize(text: str) -> list[str]:
        return [text] if text.strip() else []

    @staticmethod
    def span_tokenize(text: str) -> list[tuple[int, int]]:
        stripped = text.strip()
        if not stripped:
            return []
        start = len(text) - len(text.lstrip())
        return [(start, start + len(stripped))]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('audio', type=Path, help='Fichier audio à transcrire (MP3, WAV, M4A…).')
    parser.add_argument('-o', '--output', type=Path, help='JSON de sortie (par défaut : <audio>.whisperx.json).')
    parser.add_argument('--model', default='small', help='Modèle WhisperX (défaut : small).')
    parser.add_argument('--threads', type=int, default=4, help='Nombre de threads CPU (défaut : 4).')
    parser.add_argument('--batch-size', type=int, default=2, help='Taille des lots (défaut : 2).')
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    audio_path: Path = args.audio.expanduser().resolve()
    if not audio_path.is_file():
        raise SystemExit(f'Fichier audio introuvable : {audio_path}')
    if args.threads < 1 or args.batch_size < 1:
        raise SystemExit('threads et batch-size doivent être supérieurs à zéro.')

    import torch
    import whisperx
    import whisperx.alignment as alignment_module

    torch.set_num_threads(args.threads)
    alignment_module.nltk_load = lambda _resource: OneSentenceTokenizer()

    print('Lecture locale du fichier audio…', flush=True)
    audio = whisperx.load_audio(str(audio_path))
    print(f'Transcription française avec WhisperX ({args.model})…', flush=True)
    asr = whisperx.load_model(args.model, 'cpu', compute_type='int8', language='fr')
    transcription = asr.transcribe(audio, batch_size=args.batch_size, language='fr')

    print('Calage mot à mot sur le signal audio…', flush=True)
    align_model, metadata = whisperx.load_align_model(language_code='fr', device='cpu')
    aligned = whisperx.align(
        transcription['segments'],
        align_model,
        metadata,
        audio,
        'cpu',
        return_char_alignments=False,
    )

    words: list[dict[str, Any]] = []
    for item in aligned.get('word_segments', []):
        text = str(item.get('word', '')).strip()
        start = item.get('start')
        end = item.get('end')
        if not text or not isinstance(start, (int, float)) or not isinstance(end, (int, float)):
            continue
        if end <= start:
            continue
        word: dict[str, Any] = {
            'text': text,
            'start': round(float(start), 3),
            'end': round(float(end), 3),
        }
        score = item.get('score')
        if isinstance(score, (int, float)):
            word['score'] = round(float(score), 3)
        words.append(word)

    if not words:
        raise SystemExit('WhisperX n’a fourni aucun repère mot à mot exploitable.')

    destination = args.output or audio_path.with_name(f'{audio_path.stem}.whisperx.json')
    destination = destination.expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        'format': 'amorce.word-timings.v1',
        'engine': f'WhisperX {version("whisperx")}',
        'language': 'fr',
        'audio': audio_path.name,
        'duration': round(len(audio) / 16_000, 3),
        'transcript': ' '.join(str(segment.get('text', '')).strip() for segment in transcription.get('segments', [])).strip(),
        'words': words,
        'reviewRecommended': True,
    }
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(words)} mots calés dans : {destination}')
    print('Relis les paroles et corrige les repères incertains dans Amorce avant l’export.')


if __name__ == '__main__':
    main()
