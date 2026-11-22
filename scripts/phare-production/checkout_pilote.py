"""Parcours privé de recette de l'achat unique du Phare. Stripe test uniquement."""
import argparse
import json
import os
import sqlite3
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, quote, urlsplit
from urllib.request import Request, urlopen
from uuid import UUID

PLANCHER_CENTIMES = 1000
SUGGESTION_CENTIMES = 2000


def creer_session(appeler, produit, compte, commande, montant, retour):
    if not compte.strip() or len(compte) > 200:
        raise ValueError("Compte de test requis.")
    if urlsplit(retour).scheme != "https" or not urlsplit(retour).hostname:
        raise ValueError("Une page de retour HTTPS de recette est requise.")
    commande = str(UUID(commande))
    if type(montant) is not int or montant < PLANCHER_CENTIMES:
        raise ValueError("Le minimum du pilote est de 10 euros.")
    return appeler("POST", "/checkout/sessions", {
        "mode": "payment",
        "payment_method_types[0]": "card",
        "client_reference_id": compte,
        "metadata[phare_commande]": commande,
        "line_items[0][quantity]": 1,
        "line_items[0][price_data][currency]": "eur",
        "line_items[0][price_data][product]": produit,
        "line_items[0][price_data][unit_amount]": montant,
        "success_url": retour,
    }, "phare-pilote-" + commande)


def verifier_acces(appeler, db, produit, compte, session_id):
    if not session_id.startswith("cs_test_") or not compte.strip():
        raise ValueError("Session et compte de test requis.")
    session = appeler("GET", "/checkout/sessions/" + quote(session_id, safe=""),
                      {"expand[]": "line_items"}, None)
    if (session.get("id") != session_id or session.get("livemode") is not False
            or session.get("mode") != "payment" or session.get("client_reference_id") != compte):
        raise ValueError("Cette session ne correspond pas au compte ou au mode de recette.")
    if session.get("status") != "complete" or session.get("payment_status") != "paid":
        return "en_attente"
    lignes = session.get("line_items") or {}
    articles = lignes.get("data", [])
    if lignes.get("has_more") is not False or len(articles) != 1:
        raise ValueError("Panier différent de l'offre de recette.")
    article = articles[0]
    prix = article.get("price") or {}
    montant = session.get("amount_total")
    if (prix.get("product") != produit or article.get("quantity") != 1
            or session.get("currency") != "eur" or type(montant) is not int
            or montant < PLANCHER_CENTIMES or article.get("amount_total") != montant):
        raise ValueError("Offre ou montant différent du pilote.")
    with db:
        db.execute("""CREATE TABLE IF NOT EXISTS achats_test (
            session TEXT PRIMARY KEY, compte TEXT NOT NULL, produit TEXT NOT NULL, centimes INTEGER NOT NULL)""")
        db.execute("INSERT INTO achats_test VALUES (?,?,?,?) ON CONFLICT(session) DO NOTHING",
                   (session_id, compte, produit, montant))
        facture = db.execute("SELECT compte, produit, centimes FROM achats_test WHERE session=?",
                             (session_id,)).fetchone()
        if facture != (compte, produit, montant):
            raise ValueError("Session déjà attribuée avec des informations différentes.")
    return "acces_de_test_attribue"


def stripe_test(methode, chemin, champs, cle_rejeu):
    secret = os.environ.get("STRIPE_TEST_SECRET_KEY", "")
    if not secret.startswith("sk_test_"):
        raise ValueError("Une clé Stripe de TEST est requise.")
    headers = {"Authorization": "Bearer " + secret}
    if cle_rejeu:
        headers["Idempotency-Key"] = cle_rejeu
    url = "https://api.stripe.com/v1" + chemin
    corps = urlencode(champs)
    if methode == "GET":
        url += "?" + corps
    requete = Request(url, data=corps.encode() if methode == "POST" else None,
                      headers=headers, method=methode)
    with urlopen(requete, timeout=15) as reponse:
        return json.load(reponse)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--produit", required=True, help="Identifiant du produit Phare dans Stripe test")
    p.add_argument("--compte", required=True, help="Compte fictif du pilote")
    sous = p.add_subparsers(dest="action", required=True)
    creer = sous.add_parser("commander")
    creer.add_argument("--commande", required=True, help="UUID stable, à réutiliser en cas de reprise")
    creer.add_argument("--retour", required=True, help="Page de retour du pilote HTTPS")
    creer.add_argument("--centimes", type=int, default=SUGGESTION_CENTIMES)
    verifier = sous.add_parser("verifier")
    verifier.add_argument("--session", required=True)
    verifier.add_argument("--base-test", required=True)
    a = p.parse_args()
    if a.action == "commander":
        session = creer_session(stripe_test, a.produit, a.compte, a.commande, a.centimes, a.retour)
        print(json.dumps({"session": session["id"], "url": session["url"]}))
    else:
        with sqlite3.connect(a.base_test) as db:
            print(verifier_acces(stripe_test, db, a.produit, a.compte, a.session))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, HTTPError, URLError, sqlite3.Error) as erreur:
        sys.exit(str(erreur))
