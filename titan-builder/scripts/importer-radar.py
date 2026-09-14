#!/usr/bin/env python3
"""Raccordement en lecture seule de la base audit-radar à TITAN.

Les titres de recherche ne sont jamais traités comme des raisons sociales,
et le score des audits IA n'est pas utilisé pour sélectionner des artisans.
"""
import argparse
import json
import sqlite3
import subprocess
from pathlib import Path
from urllib.parse import urlsplit

STATUTS_BLOQUES = {'suppressed', 'rejected', 'contacted', 'replied', 'paid', 'lost'}


def url_cle(value):
    parsed = urlsplit(value)
    if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.username:
        raise ValueError('URL de rapprochement HTTP(S) requise')
    return value.rstrip('/')


def importer(db, catalogue):
    """Ne transmet que les fiches enrichies explicitement pour Artisan Express."""
    profils = {}
    for p in catalogue['prospects']:
        key = url_cle(p['radar_url'])
        if key in profils:
            raise ValueError('Deux profils portent la même radar_url : attribution ambiguë')
        profils[key] = p
    suppressions = {str(r[0]).strip().casefold() for r in db.execute('SELECT value FROM suppressions')}
    sortie = {**catalogue, 'prospects': []}
    attente, exclus = [], []
    # Toutes les oppositions et tous les états terminaux sont lus, sans plafonner
    # avant le filtrage : une opposition tardive ne doit pas disparaître du lot.
    for row in db.execute('SELECT * FROM leads ORDER BY discovered_at, id'):
        r = dict(row)
        try:
            key = url_cle(r['url'])
        except ValueError:
            exclus.append({'radar_id': r['id'], 'reason': 'URL invalide'})
            continue
        p = profils.get(key)
        emails = {str(r.get('contact_email', '')).casefold(), str((p or {}).get('email', '')).casefold()}
        domain = (urlsplit(key).hostname or '').casefold()
        if r['status'] in STATUTS_BLOQUES or domain in suppressions or key.casefold() in suppressions or bool((emails - {''}) & suppressions):
            exclus.append({'radar_id': r['id'], 'reason': 'opposition ou contact déjà traité'})
            # Propage à TITAN, qui bloque les autres fiches partageant ces identités.
            if p:
                sortie['prospects'].append({**p, 'opposition': True})
            continue
        if p is None:
            attente.append({'radar_id': r['id'], 'url': key, 'titre_source': r['product'], 'extrait_source': r['snippet'], 'status': 'a_documenter'})
            continue
        sortie['prospects'].append({**p, 'radar_id': r['id'], 'approved': False})
    presents = set()
    for r in db.execute('SELECT url FROM leads'):
        try:
            presents.add(url_cle(r['url']))
        except (TypeError, ValueError):
            # La ligne a déjà été classée comme URL invalide plus haut. Elle ne
            # doit pas faire tomber le rapport des profils valides ou absents.
            continue
    for key, p in profils.items():
        if key not in presents:
            attente.append({'id': p['id'], 'url': key, 'status': 'absent_du_radar'})
    return sortie, {'a_documenter': attente, 'exclus': exclus}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, required=True)
    parser.add_argument('--catalogue', type=Path, required=True)
    parser.add_argument('--sortie', type=Path, required=True)
    args = parser.parse_args()
    # mode=ro interdit toute modification des validations ou de l'historique.
    with sqlite3.connect(args.db.resolve().as_uri() + '?mode=ro', uri=True) as db:
        db.row_factory = sqlite3.Row
        with db:
            db.execute('BEGIN')
            entree, rapport = importer(db, json.loads(args.catalogue.read_text()))
    args.sortie.mkdir(parents=False, exist_ok=False)
    entree_path = args.sortie / 'entree-titan.json'
    entree_path.write_text(json.dumps(entree, ensure_ascii=False, indent=2))
    (args.sortie / 'qualification.json').write_text(json.dumps(rapport, ensure_ascii=False, indent=2))
    subprocess.run(['node', str(Path(__file__).with_name('preparer-prospects.mjs')), str(entree_path), str(args.sortie / 'demos')], check=True)
    print(f"{len(rapport['a_documenter'])} fiche(s) à documenter, {len(rapport['exclus'])} exclue(s). Aucun envoi, aucune recherche payante.")


if __name__ == '__main__':
    main()
