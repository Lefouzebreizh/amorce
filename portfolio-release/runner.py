#!/usr/bin/env python3
"""Orchestre les audits du portefeuille sans publier ni déployer."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import subprocess
import sys
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
DEFAULT_MANIFEST = ROOT / "projects.json"
ALLOWED_STATUSES = {"En cours", "Prêt à tester", "Prêt à publier", "Bloqué"}


def load_manifest(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    validate_manifest(data)
    return data


def validate_manifest(data: dict) -> None:
    projects = data.get("projects")
    if not isinstance(projects, list) or not projects:
        raise ValueError("Le manifeste doit contenir une liste de projets.")

    ids, orders, aliases = set(), set(), set()
    for project in projects:
        required = {"order", "id", "name", "replaces", "lane", "status", "offer", "routes"}
        missing = required - project.keys()
        if missing:
            raise ValueError(f"{project.get('id', '?')} : champs manquants {sorted(missing)}")
        if project["id"] in ids or project["order"] in orders:
            raise ValueError("Identifiant ou ordre dupliqué.")
        if project["status"] not in ALLOWED_STATUSES:
            raise ValueError(f"Statut interdit pour {project['id']} : {project['status']}")
        if not project["offer"].strip():
            raise ValueError(f"Offre vide pour {project['id']}.")
        ids.add(project["id"])
        orders.add(project["order"])
        for alias in project["replaces"]:
            key = alias.casefold()
            if key in aliases:
                raise ValueError(f"Ancien nom dupliqué : {alias}")
            aliases.add(key)
    ordered = sorted(projects, key=lambda item: item["order"])
    if ordered[-1]["id"] != "lefouzebreizh-studio":
        raise ValueError("Lefouzèbreizh Studio doit rester le dernier projet.")
    policy = data.get("policy", {})
    if policy.get("deploy") or policy.get("publish") or policy.get("paidApi"):
        raise ValueError("La politique par défaut doit interdire déploiement, publication et API payante.")


def select_projects(data: dict, ids: list[str], lanes: list[str]) -> list[dict]:
    projects = sorted(data["projects"], key=lambda item: item["order"])
    known = {item["id"] for item in projects}
    unknown = set(ids) - known
    if unknown:
        raise ValueError("Projet(s) inconnu(s) : " + ", ".join(sorted(unknown)))
    return [
        item for item in projects
        if (not ids or item["id"] in ids) and (not lanes or item["lane"] in lanes)
    ]


def command_result(command: list[str], cwd: Path) -> dict:
    completed = subprocess.run(command, cwd=cwd, text=True, capture_output=True, check=False)
    return {
        "command": command,
        "exitCode": completed.returncode,
        "stdout": completed.stdout[-8000:],
        "stderr": completed.stderr[-8000:],
    }


def qa_command(project: dict) -> list[str]:
    npm = shutil.which("npm") or shutil.which("npm.cmd") or "npm"
    command = [npm, "run", "qa", "--", "--name", project["id"], "--url", project["url"]]
    command += ["--routes", ",".join(project["routes"]), "--cache-bust"]
    return command


def capture_folder(url: str, root: Path) -> Path:
    parsed = urlparse(url if "://" in url else "https://" + url)
    raw = (parsed.netloc + parsed.path).strip("/")
    slug = "".join(char.lower() if char.isalnum() else "-" for char in raw)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return root / slug.strip("-")


def gemini_commands(project: dict, output: Path, env_file: Path | None) -> list[list[str]]:
    capture = REPO / "audit-landing" / "capturer_page.py"
    adapter = REPO / "audit-landing" / "analyser_captures_gemini.py"
    if not adapter.exists():
        raise FileNotFoundError(
            "Adaptateur Gemini absent de cette branche ; intégrer d’abord la PR dédiée sans le recopier."
        )
    capture_root = output / "captures" / project["id"]
    folder = capture_folder(project["url"], capture_root)
    first = [sys.executable, str(capture), project["url"], "--sortie", str(capture_root)]
    second = [sys.executable, str(adapter), str(folder)]
    if env_file:
        second += ["--env-file", str(env_file)]
    return [first, second]


def planned_action(project: dict, args: argparse.Namespace) -> str:
    if not project.get("url"):
        return "bloqué-url"
    if args.execute_gemini:
        return "qa+gemini"
    if args.execute_qa:
        return "qa"
    return "plan-only"


def markdown_report(report: dict) -> str:
    lines = [
        "# Contrôle du portefeuille",
        "",
        f"- Généré : {report['generatedAt']}",
        f"- Mode : {report['mode']}",
        "- Aucun déploiement, aucune publication.",
        "",
        "| Ordre | Projet | Voie | Statut initial | Action | Résultat | Preuve |",
        "| ---: | --- | --- | --- | --- | --- | --- |",
    ]
    for item in report["projects"]:
        proof = item.get("proof") or "À produire"
        lines.append(
            f"| {item['order']} | {item['name']} | {item['lane']} | "
            f"{item['initialStatus']} | {item['action']} | {item['result']} | {proof} |"
        )
    lines += [
        "",
        "Un contrôle automatisé vert ne vaut pas « Prêt à publier » : "
        "le parcours critique et la revue humaine restent obligatoires.",
        "",
    ]
    return "\n".join(lines)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--project", action="append", default=[])
    parser.add_argument("--lane", action="append", default=[])
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--validate", action="store_true")
    parser.add_argument("--execute-qa", action="store_true")
    parser.add_argument("--execute-gemini", action="store_true")
    parser.add_argument(
        "--accept-gemini-usage",
        action="store_true",
        help="Consentement explicite à une génération Gemini susceptible de consommer un quota.",
    )
    parser.add_argument("--gemini-env-file", type=Path)
    parser.add_argument("--output", type=Path)
    return parser.parse_args(argv)


def run(argv: list[str]) -> int:
    args = parse_args(argv)
    data = load_manifest(args.manifest)
    projects = select_projects(data, args.project, args.lane)
    if args.list:
        for project in projects:
            print(f"{project['order']:02d}\t{project['id']}\t{project['lane']}\t{project['status']}")
        return 0
    if args.validate:
        print(f"Manifeste valide : {len(data['projects'])} projets.")
        return 0
    if args.execute_gemini and not args.accept_gemini_usage:
        raise ValueError("--execute-gemini exige --accept-gemini-usage.")
    if args.execute_gemini:
        args.execute_qa = True

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = (args.output or ROOT / "artifacts" / stamp).resolve()
    output.mkdir(parents=True, exist_ok=False)
    mode = "qa+gemini" if args.execute_gemini else "qa" if args.execute_qa else "plan-only"
    report = {"generatedAt": datetime.now(timezone.utc).isoformat(), "mode": mode, "projects": []}
    failures = 0

    for project in projects:
        entry = {
            "order": project["order"], "id": project["id"], "name": project["name"],
            "lane": project["lane"], "initialStatus": project["status"],
            "action": planned_action(project, args), "result": "planifié", "proof": None,
        }
        if not project.get("url"):
            entry["result"] = "Bloqué : URL exacte à confirmer"
            failures += 1 if args.execute_qa else 0
            report["projects"].append(entry)
            continue
        if args.execute_qa:
            qa = command_result(qa_command(project), REPO / "qa-release")
            entry["qa"] = qa
            entry["result"] = "QA réussi" if qa["exitCode"] == 0 else "QA en échec"
            entry["proof"] = "Sortie qa-release conservée dans report.json"
            failures += int(qa["exitCode"] != 0)
        if args.execute_gemini and entry["result"] == "QA réussi":
            try:
                commands = gemini_commands(project, output, args.gemini_env_file)
                capture = command_result(commands[0], REPO)
                entry["capture"] = capture
                if capture["exitCode"] != 0:
                    entry["result"] = "Capture Gemini en échec"
                    failures += 1
                else:
                    gemini = command_result(commands[1], REPO)
                    entry["gemini"] = gemini
                    entry["result"] = (
                        "QA et audit Gemini réussis"
                        if gemini["exitCode"] == 0 else "Audit Gemini en échec"
                    )
                    failures += int(gemini["exitCode"] != 0)
            except (FileNotFoundError, OSError, ValueError) as error:
                entry["result"] = f"Bloqué : {error}"
                failures += 1
        report["projects"].append(entry)

    (output / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (output / "report.md").write_text(markdown_report(report), encoding="utf-8")
    print(f"Rapport : {output}")
    print(f"{len(projects)} projet(s), {failures} échec(s) d’exécution.")
    return 1 if failures else 0


def main() -> None:
    try:
        raise SystemExit(run(sys.argv[1:]))
    except (ValueError, json.JSONDecodeError) as error:
        print(f"ERREUR : {error}", file=sys.stderr)
        raise SystemExit(2)


if __name__ == "__main__":
    main()
