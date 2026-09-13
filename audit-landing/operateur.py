#!/usr/bin/env python3
"""Opérations explicites du pilote : produire, approuver puis livrer un audit.

Le paiement ne déclenche jamais une livraison aveugle. Une commande enregistrée
est traitée une fois, puis attend une approbation humaine nominative avant envoi.
"""
from __future__ import annotations

import argparse
import dataclasses
import json
import os
from pathlib import Path

from analyser_captures import analyser_page, rendre_markdown
from capturer_page import (
    FACTEUR_ECHELLE,
    HAUTEUR_VIEWPORT,
    LARGEUR_VIEWPORT,
    capturer_url,
    installer_filtre_reseau,
    nom_dossier_pour_url,
    sync_playwright,
)
from commandes import Commandes
from livraison import livrer
from rapport_html import rendre_html


def produire(base: Commandes, session: str, captures: Path, chromium: str | None = None) -> Path:
    commande = base.lire(session)
    if not commande or commande["etat"] != "attente":
        raise ValueError("Commande absente ou déjà prise")
    if not base.prendre(session):
        raise RuntimeError("Commande prise par un autre processus")

    captures.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        executable = chromium if chromium and Path(chromium).is_file() else None
        navigateur = pw.chromium.launch(executable_path=executable)
        contexte = navigateur.new_context(
            viewport={"width": LARGEUR_VIEWPORT, "height": HAUTEUR_VIEWPORT},
            device_scale_factor=FACTEUR_ECHELLE,
        )
        installer_filtre_reseau(contexte)
        try:
            capturer_url(contexte.new_page(), commande["url"], captures)
        finally:
            contexte.close()
            navigateur.close()

    dossier = captures / nom_dossier_pour_url(commande["url"])
    dossier.mkdir(parents=True, exist_ok=True)
    rapport = analyser_page(dossier)
    (dossier / "rapport.md").write_text(
        rendre_markdown(rapport, nom_page=dossier.name), encoding="utf-8"
    )
    (dossier / "rapport.json").write_text(
        json.dumps(dataclasses.asdict(rapport), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    chemin_html = dossier / "rapport.html"
    chemin_html.write_text(
        rendre_html(rapport, nom_page=dossier.name, dossier_page=dossier), encoding="utf-8"
    )
    if not base.deposer(session, chemin_html):
        raise RuntimeError("Rapport produit mais transition vers relecture refusée")
    return chemin_html


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", type=Path, required=True)
    sous = parser.add_subparsers(dest="action", required=True)
    sous.add_parser("lister")
    p_produire = sous.add_parser("produire")
    p_produire.add_argument("session")
    p_produire.add_argument("--captures", type=Path, required=True)
    p_produire.add_argument("--chromium")
    p_approuver = sous.add_parser("approuver")
    p_approuver.add_argument("session")
    p_approuver.add_argument("--relecteur", required=True)
    p_livrer = sous.add_parser("livrer")
    p_livrer.add_argument("session")
    args = parser.parse_args()

    base = Commandes(args.base)
    try:
        if args.action == "lister":
            print(json.dumps(base.a_traiter(), ensure_ascii=False, indent=2))
        elif args.action == "produire":
            print(produire(base, args.session, args.captures, args.chromium))
        elif args.action == "approuver":
            if not base.approuver(args.session, args.relecteur):
                raise SystemExit("Commande non disponible pour relecture")
            print("Rapport approuvé")
        elif args.action == "livrer":
            identifiant = livrer(
                base,
                args.session,
                cle_resend=os.environ.get("RESEND_API_KEY", ""),
                expediteur=os.environ.get("AUDIT_EXPEDITEUR", ""),
            )
            if not identifiant:
                raise SystemExit("Commande non disponible pour envoi")
            print(f"Envoi accepté : {identifiant}")
    finally:
        base.fermer()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
