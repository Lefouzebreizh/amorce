# Radar Reprise IA

MVP local et prudent pour transformer des signaux publics en une petite file de
prospects qualifiés. Il automatise la découverte, la déduplication, la lecture
d'une page publique, le score et le brouillon. **Il n'envoie aucun e-mail.**
L'approbation humaine reste obligatoire.

## Frontière de sécurité

- API de recherche autorisée et une page HTML publique seulement.
- `robots.txt` est consulté avant la page; une interdiction ou un refus explicite
  arrête la collecte.
- Aucun contournement de connexion, scan de ports, injection ou brute force.
- Les adresses locales, privées et réservées sont refusées pour éviter le SSRF.
- Les redirections sont contrôlées avant la requête suivante. Sur un VPS, une
  politique réseau sortante doit aussi bloquer les réseaux internes afin de
  couvrir les changements DNS entre contrôle et connexion.
- Aucun mot comme « faille » n'est généré à partir d'un simple marqueur.
- Le tableau écoute `127.0.0.1` par défaut.
- Une opposition se conserve dans la table `suppressions`.

## Démarrage en cinq minutes

```bash
cd audit-radar
cp config.example.json config.json
export BRAVE_SEARCH_API_KEY="votre-cle"
python3 radar.py init
python3 radar.py run
python3 radar.py serve
```

Ouvrir `http://127.0.0.1:8787`. Le tableau montre au maximum cinq dossiers à
la fois. Vérifier l'URL et le fait public, puis approuver ou rejeter.

Sans clé Brave, le parcours peut être essayé manuellement :

```bash
python3 radar.py add "https://exemple.fr" \
  --source "Bubble Forum" \
  --snippet "Le fondateur demande de l'aide sur un paiement Stripe en production"
python3 radar.py run --skip-discovery
```

Les messages approuvés restent des brouillons. Exporter ceux qui peuvent être
envoyés depuis la boîte professionnelle :

```bash
python3 radar.py export
```

Le fichier produit est `data/messages-approuves.csv`. Aucun pixel de suivi ni
envoi massif n'est ajouté.

En cas d'opposition :

```bash
python3 radar.py suppress "personne@entreprise.fr"
```

## Score explicable sur 10

| Signal public | Points |
| --- | ---: |
| Prix, abonnement ou paiement | +2 |
| Activité ou traction | +2 |
| Douleur précise dans la source | +2 |
| Produit public accessible | +1 |
| Signal France | +1 |
| Contact professionnel renseigné | +1 |
| Pile technique compatible | +1 |

Seuls les dossiers à 7/10 ou plus arrivent dans la file de validation. Le
score ne prétend pas prouver un défaut : il estime uniquement la pertinence
commerciale d'une vérification humaine.

## Automatisation sur le VPS

Les trois unités `deploy/` donnent un exemple systemd : tableau permanent en
local et collecte du lundi au vendredi à 7 h 15, avec un délai aléatoire. Les
chemins supposent le dépôt installé dans `/opt/amorce`.

Avant activation :

1. copier `config.example.json` en `config.json` et renseigner l'identité ;
2. créer `/opt/amorce/audit-radar/.env` avec `BRAVE_SEARCH_API_KEY=...` ;
3. créer le dossier `data/` avec les droits du compte de service ;
4. placer le tableau derrière un tunnel SSH, jamais directement sur Internet ;
5. copier les unités dans `/etc/systemd/system/`, puis activer le service et le timer.

Le passage à n8n n'est utile qu'après validation du canal. Le script peut alors
être appelé par un nœud `Execute Command`, et le CSV remplacé par un brouillon
Gmail/IMAP. L'envoi doit toujours rester derrière l'approbation humaine.

Le scanner de surface existant n'est volontairement pas lancé par ce MVP : il
suit les actifs cités par une page et nécessite donc un worker isolé avec filtrage
réseau sortant. Cette intégration vient après le premier signal commercial validé,
pas avant.

## Tests

```bash
python3 -m unittest discover -s tests -v
```

Les tests couvrent notamment le score, la déduplication, la limite des statuts,
la formulation prudente et la présence du mécanisme d'opposition.
