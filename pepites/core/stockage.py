#!/usr/bin/env python3
"""La mémoire du radar. SQLite, un fichier, aucune dépendance.

**Ce n'est pas un cache, c'est un capteur.** DexScreener ne donne que des
instantanés : à un instant donné, un pool a telle liquidité et tel volume.
L'information la plus utile de tout l'outil — *la liquidité monte-t-elle ou
descend-elle pendant que le volume accélère ?* — n'existe dans aucune API. Elle
naît de la comparaison de deux de nos propres relevés. D'où le stockage dès la
première tranche du projet, et pas en dernier.

Trois tables, trois usages :

- `releves` alimente la confirmation d'un signal et la tendance de liquidité ;
- `alertes` tient le silence par jeton, sans quoi le radar prévient trois fois
  par heure du même jeton et finit en sourdine — le jour où il a raison ;
- `apparitions` accumule les premiers acheteurs pour le traqueur de smart
  money, qui ne vaudra rien avant deux à trois semaines de relevés. La table
  existe dès maintenant parce qu'il faut commencer à collecter *avant* d'avoir
  besoin du résultat.

Les dates sont écrites en ISO 8601 UTC. SQLite n'a pas de type date, et un
horodatage local rend une base illisible dès le changement d'heure.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .modeles import Candidat, Metriques, Releve

RACINE = Path(__file__).resolve().parents[1]
BASE_PAR_DEFAUT = RACINE / "donnees" / "pepites.sqlite3"

SCHEMA = """
CREATE TABLE IF NOT EXISTS releves (
    chaine        TEXT NOT NULL,
    adresse       TEXT NOT NULL,
    vu_le         TEXT NOT NULL,
    liquidite_usd REAL NOT NULL,
    market_cap    REAL NOT NULL,
    volume_h1     REAL NOT NULL,
    volume_h24    REAL NOT NULL,
    prix_usd      REAL NOT NULL,
    note          REAL NOT NULL,
    acceleration  REAL NOT NULL,
    PRIMARY KEY (chaine, adresse, vu_le)
);
-- La recherche se fait toujours « le dernier relevé de ce jeton avant telle
-- heure » : sans cet index, elle balaie toute la table à chaque candidat, et la
-- table grossit d'une ligne par candidat et par scan.
CREATE INDEX IF NOT EXISTS idx_releves_jeton ON releves (chaine, adresse, vu_le DESC);

CREATE TABLE IF NOT EXISTS alertes (
    chaine      TEXT NOT NULL,
    adresse     TEXT NOT NULL,
    envoyee_le  TEXT NOT NULL,
    note        REAL NOT NULL,
    symbole     TEXT NOT NULL,
    PRIMARY KEY (chaine, adresse, envoyee_le)
);
CREATE INDEX IF NOT EXISTS idx_alertes_jeton ON alertes (chaine, adresse, envoyee_le DESC);

CREATE TABLE IF NOT EXISTS apparitions (
    portefeuille TEXT NOT NULL,
    chaine       TEXT NOT NULL,
    jeton        TEXT NOT NULL,
    rang         INTEGER NOT NULL,   -- position dans les premiers acheteurs
    vu_le        TEXT NOT NULL,
    PRIMARY KEY (portefeuille, chaine, jeton)
);
CREATE INDEX IF NOT EXISTS idx_apparitions_jeton ON apparitions (chaine, jeton);
"""


def _iso(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).isoformat(timespec="seconds")


def _depuis_iso(texte: str) -> datetime:
    return datetime.fromisoformat(texte)


class Memoire:
    """Accès à la base. Ouvrir, utiliser, fermer — ou via `with`."""

    def __init__(self, chemin: Path | str = BASE_PAR_DEFAUT) -> None:
        self.chemin = Path(chemin)
        if self.chemin.parent != Path("."):
            self.chemin.parent.mkdir(parents=True, exist_ok=True)
        self.connexion = sqlite3.connect(self.chemin)
        self.connexion.row_factory = sqlite3.Row
        self.connexion.executescript(SCHEMA)
        self.connexion.commit()

    def __enter__(self) -> Memoire:
        return self

    def __exit__(self, *_) -> None:
        self.fermer()

    def fermer(self) -> None:
        self.connexion.close()

    # -- relevés ------------------------------------------------------------

    def enregistrer(self, candidat: Candidat, metriques: Metriques, note: float,
                    moment: datetime | None = None) -> None:
        moment = moment or datetime.now(timezone.utc)
        jeton = candidat.jeton
        chaine, adresse = jeton.identite
        self.connexion.execute(
            "INSERT OR REPLACE INTO releves VALUES (?,?,?,?,?,?,?,?,?,?)",
            (chaine, adresse, _iso(moment), candidat.liquidite_usd, candidat.market_cap,
             candidat.volume_h1, candidat.volume_h24, candidat.paire_principale.prix_usd,
             note, metriques.acceleration),
        )
        self.connexion.commit()

    def dernier_releve(self, identite: tuple[str, str], avant: datetime | None = None) -> Releve | None:
        """Le relevé le plus récent d'un jeton, antérieur à `avant`.

        `avant` sert à exclure le relevé qu'on vient d'écrire : sinon un
        candidat se confirmerait tout seul, contre lui-même, à chaque scan.
        """
        chaine, adresse = identite
        conditions = "chaine = ? AND adresse = ?"
        parametres: list = [chaine, adresse]
        if avant is not None:
            conditions += " AND vu_le < ?"
            parametres.append(_iso(avant))
        ligne = self.connexion.execute(
            f"SELECT * FROM releves WHERE {conditions} ORDER BY vu_le DESC LIMIT 1",
            parametres,
        ).fetchone()
        if ligne is None:
            return None
        return Releve(
            chaine=ligne["chaine"], adresse=ligne["adresse"], vu_le=_depuis_iso(ligne["vu_le"]),
            liquidite_usd=ligne["liquidite_usd"], market_cap=ligne["market_cap"],
            volume_h1=ligne["volume_h1"], volume_h24=ligne["volume_h24"],
            prix_usd=ligne["prix_usd"], note=ligne["note"], acceleration=ligne["acceleration"],
        )

    def jetons_suivis(self, depuis_heures: float = 48.0, minimum: float = 0.0) -> list[tuple[str, str]]:
        """Les jetons déjà relevés récemment, à re-relever quoi qu'il arrive.

        C'est ce qui rend la persistance possible : la découverte de
        DexScreener est irrégulière, et un jeton peut disparaître d'un tour de
        recherche sans que rien ne lui soit arrivé. S'il fallait qu'il soit
        redécouvert par hasard pour être confirmé, aucun signal ne le serait.
        """
        seuil = _iso(datetime.now(timezone.utc) - timedelta(hours=depuis_heures))
        lignes = self.connexion.execute(
            "SELECT DISTINCT chaine, adresse FROM releves WHERE vu_le >= ? AND note >= ?",
            (seuil, minimum),
        ).fetchall()
        return [(ligne["chaine"], ligne["adresse"]) for ligne in lignes]

    def purger(self, garder_jours: float = 30.0) -> int:
        """Efface les vieux relevés. Une ligne par candidat et par scan, c'est
        quelques mégaoctets par mois — inutile, mais inutile de les garder."""
        seuil = _iso(datetime.now(timezone.utc) - timedelta(days=garder_jours))
        curseur = self.connexion.execute("DELETE FROM releves WHERE vu_le < ?", (seuil,))
        self.connexion.commit()
        return curseur.rowcount

    # -- alertes ------------------------------------------------------------

    def derniere_alerte(self, identite: tuple[str, str]) -> tuple[datetime, float] | None:
        chaine, adresse = identite
        ligne = self.connexion.execute(
            "SELECT envoyee_le, note FROM alertes WHERE chaine = ? AND adresse = ? "
            "ORDER BY envoyee_le DESC LIMIT 1",
            (chaine, adresse),
        ).fetchone()
        if ligne is None:
            return None
        return _depuis_iso(ligne["envoyee_le"]), ligne["note"]

    def noter_alerte(self, identite: tuple[str, str], symbole: str, note: float,
                     moment: datetime | None = None) -> None:
        chaine, adresse = identite
        moment = moment or datetime.now(timezone.utc)
        self.connexion.execute(
            "INSERT OR REPLACE INTO alertes VALUES (?,?,?,?,?)",
            (chaine, adresse, _iso(moment), note, symbole),
        )
        self.connexion.commit()

    # -- portefeuilles ------------------------------------------------------

    def enregistrer_acheteurs(self, chaine: str, jeton: str,
                              portefeuilles: list[str], moment: datetime | None = None) -> None:
        """Range les premiers acheteurs d'un jeton, dans l'ordre d'arrivée."""
        moment = _iso(moment or datetime.now(timezone.utc))
        self.connexion.executemany(
            "INSERT OR IGNORE INTO apparitions VALUES (?,?,?,?,?)",
            [(p, chaine, jeton, rang, moment) for rang, p in enumerate(portefeuilles, start=1)],
        )
        self.connexion.commit()

    def apparitions(self, portefeuilles: list[str], minimum: int) -> dict[str, int]:
        """Combien de fois chacun de ces portefeuilles a déjà été précoce.

        Sous `minimum`, on ne rend rien : un portefeuille vu une seule fois est
        une coïncidence, et le suivre revient à suivre les robots d'arbitrage
        et les routeurs de DEX, qui sont précoces sur absolument tout.
        """
        if not portefeuilles:
            return {}
        marques = ",".join("?" * len(portefeuilles))
        lignes = self.connexion.execute(
            f"SELECT portefeuille, COUNT(*) AS total FROM apparitions "
            f"WHERE portefeuille IN ({marques}) GROUP BY portefeuille HAVING total >= ?",
            [*portefeuilles, minimum],
        ).fetchall()
        return {ligne["portefeuille"]: ligne["total"] for ligne in lignes}
