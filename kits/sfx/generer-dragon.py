"""
Fabrique un rugissement de dragon, par l'API si une clé existe, sinon en local.

Le repli local n'est pas un pis-aller décoratif : il est mesuré comme le
reste et il ne sera retenu que s'il bat la prise existante **sur la bande
qu'un haut-parleur de téléphone restitue**. Un rugissement somptueux au
casque et absent sur l'appareil où la vidéo sera vue ne sert à rien.

Une synthèse ne remplacera jamais une vraie prise. Elle peut en revanche
combler un trou en attendant, à condition de savoir de combien elle est en
dessous — d'où la comparaison chiffrée en fin de script.
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
DOSSIER = RACINE / "kits" / "sfx" / "dragons"
SORTIE = DOSSIER / "rugissement-v2-4s.wav"
FFMPEG = shutil.which("ffmpeg") or "ffmpeg"

INVITE = ("Colossal dragon roar, deep chest growl tearing into a metallic "
          "shriek, wet snarling detail, air ripping apart, long cavernous decay. "
          "Loud, dominant, no music.")


def par_api(cle):
    import requests
    r = requests.post("https://api.elevenlabs.io/v1/sound-generation",
                      headers={"xi-api-key": cle, "Content-Type": "application/json"},
                      json={"text": INVITE, "duration_seconds": 4,
                            "prompt_influence": 0.9},
                      timeout=45)
    r.raise_for_status()
    SORTIE.write_bytes(r.content)
    return "API ElevenLabs"


def en_local():
    """
    Trois couches, comme un vrai rugissement : une gorge, une déchirure, un
    souffle. Le passe-haut à 300 Hz sur la couche saturée est ce qui la rend
    audible sur un téléphone — sans lui, tout vit sous 200 Hz et disparaît.
    """
    grave = ("aevalsrc='sin(2*PI*(85+35*sin(2*PI*4.5*t))*t)*"
             "min(t*6,1)*exp(-0.45*t)':d=4:s=48000")
    dechirure = "anoisesrc=d=4:c=brown:r=48000:a=0.85"
    souffle = "anoisesrc=d=4:c=white:r=48000:a=0.35"
    chaine = (
        "[0:a]volume=3dB[g];"
        # La couche qui porte : bruit saturé, filtré haut, façonné par des
        # résonances de gorge. C'est elle que le téléphone restituera.
        "[1:a]highpass=f=300,lowpass=f=5000,"
        "equalizer=f=620:t=q:w=1.4:g=9,equalizer=f=1250:t=q:w=1.6:g=7,"
        "equalizer=f=2600:t=q:w=1.8:g=5,"
        "tremolo=f=5.5:d=0.35,volume=5dB[d];"
        "[2:a]highpass=f=2200,volume=-6dB[s];"
        "[g][d][s]amix=inputs=3:duration=first:weights=0.9 1.4 0.5:normalize=0,"
        "aecho=0.8:0.85:120:0.35,"
        "acompressor=threshold=-22dB:ratio=3:attack=15:release=200,"
        "loudnorm=I=-10:TP=-1:LRA=6[out]"
    )
    subprocess.run([FFMPEG, "-y", "-v", "error",
                    "-f", "lavfi", "-i", grave,
                    "-f", "lavfi", "-i", dechirure,
                    "-f", "lavfi", "-i", souffle,
                    "-filter_complex", chaine, "-map", "[out]",
                    "-c:a", "pcm_s16le", str(SORTIE)],
                   check=True, timeout=120)
    return "synthèse locale"


def telephone(f):
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", str(f),
                        "-af", "highpass=f=400,volumedetect", "-f", "null", "/dev/null"],
                       capture_output=True, text=True)
    m = [l for l in r.stderr.splitlines() if "mean_volume" in l]
    return float(m[0].split(":")[1].split("dB")[0]) if m else -99.0


def main():
    DOSSIER.mkdir(parents=True, exist_ok=True)
    cle = os.getenv("ELEVENLABS_API_KEY")
    if cle:
        try:
            origine = par_api(cle)
        except Exception as e:
            print(f"[REPLI] API en échec ({e}) — synthèse locale.", file=sys.stderr)
            origine = en_local()
    else:
        print("[REPLI] aucune clé ELEVENLABS_API_KEY — synthèse locale.", file=sys.stderr)
        origine = en_local()

    neuf = telephone(SORTIE)
    ancien_f = DOSSIER / "rugissement-dragon.wav"
    ancien = telephone(ancien_f) if ancien_f.exists() else -99.0
    print(f"  origine        : {origine}")
    print(f"  nouveau        : {neuf:+.1f} dB sur téléphone")
    print(f"  prise actuelle : {ancien:+.1f} dB")
    print(f"  → {'le nouveau gagne' if neuf > ancien else 'la prise actuelle reste la meilleure'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
