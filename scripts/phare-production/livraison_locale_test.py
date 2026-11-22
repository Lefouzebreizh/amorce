"""Remise unique d'une édition pilote au navigateur sur la boucle locale."""
import base64
import hmac
import json
import secrets
import shutil
import sqlite3
import tempfile
import time
from contextlib import closing
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import quote


def servir_edition(livrer, base, produit, compte, session, manifeste):
    if ":" in compte or not compte.isascii():
        raise ValueError("Choisir un identifiant de compte d'essai ASCII sans deux-points.")
    secret = secrets.token_urlsafe(24)
    attendu = b"Basic " + base64.b64encode(f"{compte}:{secret}".encode("ascii"))

    class Remise(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def setup(self):
            super().setup()
            self.connection.settimeout(8)

        def do_GET(self):
            if self.path != "/edition":
                self.send_error(404)
                return
            fourni = self.headers.get("Authorization", "").encode("latin-1")
            if not hmac.compare_digest(fourni, attendu):
                self.send_response(401)
                self.send_header("WWW-Authenticate", 'Basic realm="Le Phare - recette locale"')
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                return
            with tempfile.TemporaryDirectory() as dossier:
                copie = Path(dossier) / "livraison"
                try:
                    with closing(sqlite3.connect(base.resolve().as_uri() + "?mode=rw", uri=True)) as db:
                        empreinte = livrer(db, produit, compte, session, manifeste, copie)
                    nom = Path(json.loads(manifeste.read_text(encoding="utf-8"))["fichier"]).name
                    with copie.open("rb") as contenu:
                        self.send_response(200)
                        self.send_header("Content-Type", "application/octet-stream")
                        self.send_header("Content-Disposition", "attachment; filename*=UTF-8''" + quote(nom, safe=""))
                        self.send_header("Content-Length", str(copie.stat().st_size))
                        self.send_header("Cache-Control", "no-store")
                        self.send_header("X-Content-Type-Options", "nosniff")
                        self.end_headers()
                        shutil.copyfileobj(contenu, self.wfile)
                        self.wfile.flush()
                except (ValueError, KeyError):
                    self.send_error(403, "Edition indisponible pour cet achat")
                    return
                except (sqlite3.Error, FileNotFoundError):
                    self.send_error(503, "Registre ou edition indisponible")
                    return
                self.server.empreinte_livree = empreinte

    with HTTPServer(("127.0.0.1", 0), Remise) as serveur:
        serveur.timeout = 1
        serveur.empreinte_livree = None
        print(json.dumps({"url": f"http://127.0.0.1:{serveur.server_port}/edition",
                          "compte": compte, "mot_de_passe_temporaire": secret}), flush=True)
        expiration = time.monotonic() + 300
        while serveur.empreinte_livree is None and time.monotonic() < expiration:
            serveur.handle_request()
        if serveur.empreinte_livree is None:
            raise ValueError("La remise locale a expiré. Relancer pour obtenir un nouvel accès.")
        return serveur.empreinte_livree
