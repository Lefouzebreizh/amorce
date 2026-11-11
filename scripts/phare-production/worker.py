"""Private remote worker. Default is a quote, never a paid generation.

Runs on a CPU host with ffmpeg/ffprobe. Keeps source media and provider IDs.
Use --assets for an offline end-to-end render; --allow-paid is a separate,
explicit opt-in, additionally requiring PHARE_PAID_GENERATION_ENABLED=true.
No automatic retries of an uncertain billable POST. Output is a rough cut,
not a claim of artistic approval, lyric accuracy or ownership clearance.
"""
import argparse
import base64
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

API = 'https://generativelanguage.googleapis.com/v1beta/interactions'
DATE = '2026-11-11'


def validate(plan):
    if not isinstance(plan, dict) or plan.get('version') != 1:
        raise ValueError('Plan version 1 requis.')
    for key, maximum in [('title', 120), ('lyrics', 20000), ('musicDirection', 4000), ('visualDirection', 4000)]:
        if not isinstance(plan.get(key), str) or len(plan[key]) > maximum:
            raise ValueError('Champ invalide : ' + key)
    if not plan['title'].strip() or type(plan.get('duration')) is not int or not 15 <= plan['duration'] <= 300:
        raise ValueError('Titre et durée de 15 à 300 secondes requis.')
    if type(plan.get('takes')) is not int or not 1 <= plan['takes'] <= 4 or plan.get('resolution') not in ('720p', '1080p') or plan.get('aspect') not in ('16:9', '9:16'):
        raise ValueError('Format ou variantes invalides.')
    scenes = plan.get('scenes')
    if not isinstance(scenes, list) or len(scenes) > 100:
        raise ValueError('Liste de plans invalide.')
    for scene in scenes:
        if not isinstance(scene, dict) or not isinstance(scene.get('prompt'), str) or len(scene['prompt']) > 4000 or type(scene.get('duration')) is not int or not 3 <= scene['duration'] <= 15:
            raise ValueError('Chaque plan doit durer de 3 à 15 secondes.')
    if scenes and sum(s['duration'] for s in scenes) < plan['duration']:
        raise ValueError('Les plans ne couvrent pas la chanson.')
    return plan


def scenes_for(plan):
    if plan['scenes']:
        return plan['scenes']
    count = math.ceil(plan['duration'] / 15)
    return [{'duration': 15, 'prompt': f"Plan {i+1}/{count}. {plan['visualDirection']}\nÉvoquer ce passage, sans texte incrusté : {line}"}
            for i, line in enumerate(split_text(plan['lyrics'], count))]


def split_text(text, count):
    words = text.split()
    return [' '.join(words[i * len(words) // count:(i+1) * len(words) // count]) for i in range(count)]


def quote(plan):
    validate(plan)
    seconds = sum(s['duration'] for s in scenes_for(plan))
    rate = (5792 if plan['resolution'] == '720p' else 8688) * 12 / 1000000
    video = seconds * plan['takes'] * rate
    music = plan['takes'] * .08
    return {'currency': 'USD', 'date': DATE, 'video': video, 'music': music, 'generation': video + music,
            'reserve': (video + music) * .25, 'renderExample': .0528,
            'indicative': (video + music) * 1.25 + .0528, 'seconds': seconds,
            'excluded': 'Taxes, exchange, input tokens, text/image calls, storage, egress, retries and subscriptions. CPU example only, not measured cloud runtime.'}


def write_json(path, data):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(path)


def run(args):
    result = subprocess.run(args, capture_output=True, text=True, check=False, timeout=1800)
    if result.returncode:
        raise RuntimeError('Échec du traitement média : ' + result.stderr[-1200:])
    return result.stdout


def probe(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))


def api_request(key, payload=None, interaction_id=None):
    url = API + ('/' + urllib.parse.quote(interaction_id, safe='') if interaction_id else '')
    req = urllib.request.Request(url, data=json.dumps(payload).encode() if payload is not None else None,
                                 headers={'x-goog-api-key': key, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'Fournisseur : HTTP {error.code}. Aucun nouvel essai payant automatique.') from None


def generate_media(key, payload, kind, name, output, state):
    path = output / name
    records = state['generations']
    record = records.get(name)
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    if record and record['requestHash'] != digest:
        raise ValueError('Le plan a changé : utiliser un nouveau dossier de production.')
    if record and record.get('fileHash') and path.exists():
        if hashlib.sha256(path.read_bytes()).hexdigest() != record['fileHash']:
            raise ValueError('Source générée altérée.')
        return path
    if record and not record.get('interactionId'):
        raise RuntimeError('Requête payante incertaine. Vérifier le compte fournisseur avant toute relance ; aucune requête doublée.')
    if not record:
        record = {'requestHash': digest, 'state': 'submitting'}
        records[name] = record
        write_json(output / 'state.json', state)  # Journal before the billable call.
        result = api_request(key, {**payload, 'background': True, 'store': True})
        interaction_id = result.get('id')
        if not isinstance(interaction_id, str) or not interaction_id:
            raise RuntimeError('Identifiant fournisseur absent ; vérifier le compte avant de relancer.')
        record.update(interactionId=interaction_id, state='submitted')
        write_json(output / 'state.json', state)
    else:
        result = api_request(key, interaction_id=record['interactionId'])
    deadline = time.monotonic() + 1800
    while result.get('status') in ('in_progress', 'requires_action', 'queued'):
        if result['status'] == 'requires_action':
            raise RuntimeError('Action fournisseur requise. Production arrêtée sans nouvelle dépense.')
        if time.monotonic() > deadline:
            raise TimeoutError('Production encore en cours ; reprise possible via son identifiant, sans nouvelle génération.')
        time.sleep(10)
        result = api_request(key, interaction_id=record['interactionId'])
    if result.get('status') != 'completed':
        record['state'] = 'failed'
        write_json(output / 'state.json', state)
        raise RuntimeError('Génération non terminée. Aucune variante supplémentaire lancée.')
    blocks = [block for step in result.get('steps', []) if step.get('type') == 'model_output' for block in step.get('content', [])]
    block = next((b for b in reversed(blocks) if b.get('type') == kind and b.get('data')), None)
    if not block:
        raise RuntimeError('Média absent du résultat fournisseur.')
    data = base64.b64decode(block['data'], validate=True)
    if len(data) > 512 * 1024 * 1024:
        raise ValueError('Média trop volumineux.')
    temp = path.with_suffix('.part'); temp.write_bytes(data); temp.replace(path)
    record.update(state='downloaded', fileHash=hashlib.sha256(data).hexdigest())
    # Keep generated lyric structure separate from the author's original lyrics.
    texts = [b['text'] for b in blocks if b.get('type') == 'text' and isinstance(b.get('text'), str)]
    if texts:
        write_json(output / (name + '.provider-text.json'), texts)
    write_json(output / 'state.json', state)
    return path


def render(audio, clips, output, plan):
    """Non-destructive normalized sources -> fades -> full-song rough cut.

    No generated shot audio is mixed into the selected master music.
    No burned lyric timestamps are invented. A separate lyric reference is kept.
    """
    audio_info = probe(audio)
    duration = float(audio_info['format']['duration'])
    if not any(s['codec_type'] == 'audio' for s in audio_info['streams']) or not 1 <= duration <= 330:
        raise ValueError('Audio absent ou durée invalide.')
    if not clips or len(clips) > 100:
        raise ValueError('Plans absents ou trop nombreux.')
    w, h = (1280, 720) if plan['resolution'] == '720p' else (1920, 1080)
    if plan['aspect'] == '9:16':
        w, h = h, w
    fade = min(.6, duration / len(clips) / 5)
    step = duration / len(clips)
    normalized = []
    # Render each source sequentially, keeping peak RAM independent of shot count.
    for i, clip in enumerate(clips):
        info = probe(clip)
        video = next((s for s in info['streams'] if s['codec_type'] == 'video'), None)
        if not video:
            raise ValueError('Plan vidéo invalide.')
        target = step + (fade if i < len(clips) - 1 else 0)
        source_duration = float(info['format']['duration'])
        speed_factor = target / source_duration
        if not .8 <= speed_factor <= 1.25:
            raise ValueError('La durée musicale exige un nouveau découpage. Aucun plan n’est artificiellement figé ni régénéré automatiquement.')
        filters = f'setpts=(PTS-STARTPTS)*{speed_factor},scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p,tpad=stop_mode=clone:stop_duration={target},trim=duration={target},setpts=PTS-STARTPTS'
        path = output / f'normalized-{i:03}.mp4'
        run(['ffmpeg', '-y', '-v', 'error', '-i', str(clip), '-an', '-vf', filters, '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-threads', '2', '-t', str(target), str(path)])
        normalized.append(path)
    # One final encode, never re-encode the growing timeline on each new shot.
    # Decoder threading is bounded independently of host core count.
    current = output / 'joined.mp4'
    if len(normalized) == 1:
        current = normalized[0]
    else:
        inputs = []
        for path in normalized:
            inputs += ['-threads', '1', '-i', str(path)]
        graph = []
        previous = '0:v'
        for i in range(1, len(normalized)):
            name = f'fade{i}'
            graph.append(f'[{previous}][{i}:v]xfade=transition=fade:duration={fade}:offset={step*i}[{name}]')
            previous = name
        run(['ffmpeg', '-y', '-v', 'error', '-filter_complex_threads', '1', *inputs, '-filter_complex', ';'.join(graph), '-map', f'[{previous}]', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-threads', '2', str(current)])
    # Two-pass loudness normalization: retain measured input values in report.
    measurement = subprocess.run(['ffmpeg', '-v', 'info', '-i', str(audio), '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True, timeout=1800)
    if measurement.returncode:
        raise RuntimeError('Mesure audio impossible.')
    match = re.search(r'\{\s*"input_i".*?\}', measurement.stderr, re.S)
    loudness = json.loads(match.group()) if match else None
    if not loudness or any(not math.isfinite(float(loudness[k])) for k in ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset']):
        raise ValueError('Audio silencieux ou mesure de niveau invalide.')
    norm = f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={loudness['input_i']}:measured_TP={loudness['input_tp']}:measured_LRA={loudness['input_lra']}:measured_thresh={loudness['input_thresh']}:offset={loudness['target_offset']}:linear=true"
    final = output / 'clip-premier-montage.mp4'
    run(['ffmpeg', '-y', '-v', 'error', '-i', str(current), '-i', str(audio), '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', norm, '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-t', str(duration), '-movflags', '+faststart', str(final)])
    result = probe(final)
    streams = {s['codec_type']: s for s in result['streams']}
    if set(streams) != {'audio', 'video'} or abs(float(result['format']['duration']) - duration) > .15 or streams['video']['width'] != w or streams['video']['height'] != h:
        raise RuntimeError('Contrôle export refusé : format, pistes ou durée inattendus.')
    output_measure = subprocess.run(['ffmpeg', '-v', 'info', '-i', str(final), '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True, timeout=1800)
    output_match = re.search(r'\{\s*"input_i".*?\}', output_measure.stderr, re.S)
    measured_output = json.loads(output_match.group()) if output_match else None
    if output_measure.returncode or not measured_output or not -15 <= float(measured_output['input_i']) <= -13 or not float(measured_output['input_tp']) <= -.8:
        raise RuntimeError('Contrôle du niveau audio après encodage refusé.')
    report = {'outputLoudness': measured_output, 'status': 'rough_cut_requires_review', 'duration': duration, 'width': w, 'height': h, 'fps': streams['video']['avg_frame_rate'], 'videoCodec': streams['video']['codec_name'], 'audioCodec': streams['audio']['codec_name'], 'sha256': hashlib.sha256(final.read_bytes()).hexdigest(), 'inputLoudness': loudness, 'targetLufs': -14, 'truePeakCeilingDb': -1, 'reviewRequired': ['Écouter le morceau entier et vérifier les paroles chantées.', 'Regarder chaque plan et les transitions.', 'Vérifier cohérence des personnages, défauts visuels, droits et crédits.', 'Synchroniser les paroles avant de les incruster ; aucune synchronisation inventée.']}
    write_json(output / 'controle-export.json', report)
    for path in normalized:
        path.unlink(missing_ok=True)
    if current.name == 'joined.mp4':
        current.unlink(missing_ok=True)
    return final


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan', type=Path)
    parser.add_argument('--output', type=Path, default=Path('work/phare-render'))
    parser.add_argument('--assets', type=Path, help='JSON: audio and clips (local paths relative to this JSON). No provider call.')
    parser.add_argument('--allow-paid', action='store_true')
    parser.add_argument('--budget-usd', type=float)
    args = parser.parse_args()
    data = json.loads(args.plan.read_text(encoding='utf-8'))
    plan = validate(data.get('plan', data))
    estimate = quote(plan)
    if not args.assets and not args.allow_paid:
        print(json.dumps({'quote': estimate, 'paidCallMade': False}, indent=2))
        return
    if args.assets and args.allow_paid:
        raise ValueError('Mode local et génération payante sont séparés.')
    args.output.mkdir(parents=True, exist_ok=True)
    with (args.output / '.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        plan_hash = hashlib.sha256(json.dumps(plan, sort_keys=True).encode()).hexdigest()
        state_file = args.output / 'state.json'
        state = json.loads(state_file.read_text()) if state_file.exists() else {'planHash': plan_hash, 'generations': {}}
        if state['planHash'] != plan_hash:
            raise ValueError('Dossier lié à une autre version ; conserver les sources et créer un nouveau dossier.')
        write_json(args.output / 'plan-source.json', plan)
        write_json(args.output / 'devis.json', estimate)
        (args.output / 'paroles-source.txt').write_text(plan['lyrics'], encoding='utf-8')
        if args.assets:
            assets = json.loads(args.assets.read_text())
            root = args.assets.resolve().parent
            def asset(name):
                path = (root / name).resolve()
                if not path.is_relative_to(root) or not path.is_file():
                    raise ValueError('Média local absent ou hors dossier.')
                return path
            audio, clips = asset(assets['audio']), [asset(p) for p in assets['clips']]
        else:
            if os.environ.get('PHARE_PAID_GENERATION_ENABLED') != 'true' or not args.budget_usd or not math.isfinite(args.budget_usd) or args.budget_usd < estimate['indicative']:
                raise ValueError('Budget explicite et activation serveur requis. Aucun appel payant.')
            key = os.environ.get('GEMINI_API_KEY')
            if not key or not plan['musicDirection'].strip() or not plan['visualDirection'].strip():
                raise ValueError('Clé privée et directions musicale/visuelle requises.')
            # A rough-cut run generates the quoted variants; all are retained for review.
            audios = [generate_media(key, {'model': 'lyria-3.5', 'input': f"Crée une chanson en français, environ {plan['duration']} secondes. {plan['musicDirection']}\nParoles de l’auteur à respecter :\n{plan['lyrics']}"}, 'audio', f'music-{take}.mp3', args.output, state) for take in range(plan['takes'])]
            audio = audios[0]
            clips = []
            for i, scene in enumerate(scenes_for(plan)):
                variants = [generate_media(key, {'model': 'gemini-omni-1.2-flash', 'input': f"Direction commune : {plan['visualDirection']}\n{scene['prompt']}\nAucun texte ni sous-titre incrusté.", 'response_format': {'type': 'video', 'aspect_ratio': plan['aspect'], 'resolution': plan['resolution'], 'duration': f"{scene['duration']}s"}}, 'video', f'scene-{i:03}-take-{take}.mp4', args.output, state) for take in range(plan['takes'])]
                clips.append(variants[0])
            write_json(args.output / 'selection-premier-montage.json', {'audio': audio.name, 'clips': [p.name for p in clips], 'selection': 'Premières variantes, à revoir. Toutes les autres prises sont conservées.'})
        print(str(render(audio, clips, args.output, plan)))


if __name__ == '__main__':
    main()
