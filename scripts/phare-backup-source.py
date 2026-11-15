#!/usr/bin/env python3
"""Versioned source snapshots; never exports browser storage or system credentials.

Snapshots are created locally without network access. A separate, authorized process
must copy the verified archive to another device or cloud destination.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import fnmatch
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import sys
import tempfile
import unicodedata
import uuid
import zipfile

MANIFEST = "PHARE-MANIFEST.json"
MAX_TOTAL = 2 * 1024**3
MAX_FILE = 256 * 1024**2
MAX_FILES = 100_000
MAX_MANIFEST = 8 * 1024**2
CHUNK = 128 * 1024
DIR_EXCLUDES = {".git", "node_modules", "__pycache__", ".ssh", ".aws", ".azure",
                ".gnupg", ".config", ".cache", ".venv", "venv", "coverage"}
NAME_EXCLUDES = {".env", "id_rsa", "id_ed25519", "id_ecdsa", "id_dsa",
                 "credentials.json", "credentials", "secrets.json", "tokens.json",
                 "token.json", "auth.json", "login data", "cookies", "web data"}
WINDOWS_RESERVED = {"CON", "PRN", "AUX", "NUL", *[f"COM{i}" for i in range(1, 10)],
                    *[f"LPT{i}" for i in range(1, 10)]}


class BackupError(ValueError):
    pass


def _json(data):
    return json.dumps(data, ensure_ascii=False, sort_keys=True, indent=2).encode("utf-8")


def _no_duplicate_keys(pairs):
    obj = {}
    for key, value in pairs:
        if key in obj:
            raise BackupError("Duplicate JSON field")
        obj[key] = value
    return obj


def _link(st):
    return stat.S_ISLNK(st.st_mode) or bool(getattr(st, "st_file_attributes", 0) & 0x400)


def _excluded(name, directory=False):
    n = name.casefold()
    if n in DIR_EXCLUDES or n.startswith(".next"):
        return "generated-or-private-directory"
    if n in NAME_EXCLUDES or n.startswith(".env."):
        return "credential-name"
    if any(term in n for term in ("api_key", "api-key", "access_token", "private_key",
                                  "credentials", "mot-de-passe", "password")):
        return "credential-name"
    if any(fnmatch.fnmatch(n, pattern) for pattern in
           ("*.pem", "*.key", "*.p12", "*.pfx", "*.sqlite", "*.sqlite3", "*.db",
            "*.db-wal", "*.db-shm", "*.sqlite-wal", "*.sqlite-shm", "*.pyc",
            "*service-account*.json", "*credentials*.json", "*secrets*.json")):
        return "credential-or-database-or-generated-name"
    return None


def _safe_name(name):
    if not isinstance(name, str) or not name or "\\" in name or "\x00" in name:
        raise BackupError("Invalid archive path")
    if name.startswith("/") or len(name) > 2000:
        raise BackupError("Invalid archive path")
    parts = name.split("/")
    for part in parts:
        if part in ("", ".", "..") or any(ord(c) < 32 for c in part):
            raise BackupError("Invalid archive path")
        if any(c in part for c in ':<>"|?*') or part.endswith((" ", ".")):
            raise BackupError("Nonportable archive path")
        if part.split(".")[0].upper() in WINDOWS_RESERVED:
            raise BackupError("Reserved archive path")
    return "/".join(parts)


def _collision_key(name):
    return unicodedata.normalize("NFC", name).casefold()


def _stat_signature(st):
    # Windows st_ctime is deprecated and its stat()/fstat() interpretations can
    # differ across Python/filesystem versions. Birth time has the explicit
    # creation-time meaning there; identity, size and mtime detect ordinary data
    # replacement/changes. On Unix ctime retains its metadata-change meaning.
    change = getattr(st, "st_birthtime_ns", None) if os.name == "nt" else st.st_ctime_ns
    return st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns, change


def _source_files(sources, output):
    """Yield files without following symlinks or Windows reparse points."""
    omitted = []
    files = []
    seen_names = set()
    seen_roots = []
    for alias, source in sources:
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", alias):
            raise BackupError("Source alias must contain 1–64 ASCII letters, digits, _ or -")
        p = Path(source).absolute()
        if not p.exists() or _link(p.lstat()) or not p.is_dir():
            raise BackupError("Source must be an existing real directory")
        p = p.resolve(strict=True)
        if any(p == root or p in root.parents or root in p.parents for root in seen_roots):
            raise BackupError("Source roots overlap")
        seen_roots.append(p)
        def visit(directory):
            for entry in sorted(os.scandir(directory), key=lambda x: x.name):
                ep = Path(entry.path)
                relative = ep.relative_to(p).as_posix()
                name = alias + "/" + relative
                # On Windows DirEntry.stat() may report zero st_dev/st_ino;
                # os.stat() obtains identity fields comparable to os.fstat().
                # It also avoids relying on DirEntry's cached metadata.
                st = os.stat(ep, follow_symlinks=False)
                # Exclude the entire destination before a snapshot is opened there.
                if ep == output or output in ep.parents:
                    omitted.append({"path": name, "reason": "snapshot-destination"})
                    continue
                if _link(st):
                    omitted.append({"path": name, "reason": "link-or-reparse-point"})
                    continue
                reason = _excluded(entry.name, stat.S_ISDIR(st.st_mode))
                if reason:
                    omitted.append({"path": name, "reason": reason})
                    continue
                if stat.S_ISDIR(st.st_mode):
                    visit(ep)
                elif stat.S_ISREG(st.st_mode):
                    _safe_name(name)
                    key = _collision_key(name)
                    if key in seen_names:
                        raise BackupError("Case or Unicode collision in source files")
                    seen_names.add(key)
                    files.append((name, ep, st))
                    if len(files) > MAX_FILES:
                        raise BackupError("Too many files")
                else:
                    omitted.append({"path": name, "reason": "not-regular-file"})
        visit(p)
    return files, omitted


def snapshot(sources, output, *, max_total=MAX_TOTAL, max_file=MAX_FILE):
    if not sources:
        raise BackupError("At least one source is required")
    if type(max_total) is not int or type(max_file) is not int or min(max_total, max_file) <= 0:
        raise BackupError("Size limits must be positive integers")
    aliases = [a.casefold() for a, _ in sources]
    if len(set(aliases)) != len(aliases):
        raise BackupError("Duplicate source alias")
    out = Path(output).absolute()
    if out.exists() and _link(out.lstat()):
        raise BackupError("Output cannot be a link or reparse point")
    out.mkdir(parents=True, exist_ok=True)
    out = out.resolve(strict=True)
    files, omitted = _source_files(sources, out)
    if len(files) > MAX_FILES:
        raise BackupError("Too many files")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    name = f"Le_Phare_sources_{stamp}_{uuid.uuid4().hex[:8]}.zip"
    final = out / name
    partial = out / (name + ".partial")
    entries = []
    total = 0
    try:
        with zipfile.ZipFile(partial, "x", compression=zipfile.ZIP_DEFLATED,
                             compresslevel=6, allowZip64=True) as z:
            for archive_name, path, original_stat in files:
                if original_stat.st_size > max_file:
                    raise BackupError("Source file exceeds size limit")
                digest = hashlib.sha256()
                copied = 0
                flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
                fd = os.open(path, flags)
                with os.fdopen(fd, "rb") as src, z.open(archive_name, "w", force_zip64=True) as dest:
                    before = os.fstat(src.fileno())
                    if not stat.S_ISREG(before.st_mode) or _stat_signature(before) != _stat_signature(original_stat):
                        raise BackupError(f"Source changed before reading: {archive_name}; retry later")
                    while chunk := src.read(CHUNK):
                        copied += len(chunk)
                        total += len(chunk)
                        if copied > max_file or total > max_total:
                            raise BackupError("Snapshot exceeds size limit")
                        digest.update(chunk)
                        dest.write(chunk)
                    after = os.fstat(src.fileno())
                    current = path.lstat()
                    if (_link(current) or _stat_signature(before) != _stat_signature(after)
                            or _stat_signature(before) != _stat_signature(current) or copied != before.st_size):
                        raise BackupError(f"Source changed while reading: {archive_name}; retry later")
                entries.append({"path": archive_name, "size": copied, "sha256": digest.hexdigest()})
            manifest = {"schemaVersion": 1, "createdAt": datetime.now(timezone.utc).isoformat(),
                        "scope": "source-files-only", "sources": [a for a, _ in sources],
                        "limitations": ["No browser projects, conversations or database exports",
                                        "No system image; excluded credentials need a separate secure backup",
                                        "Per-file stable copy, not a filesystem-wide transactional snapshot"],
                        "files": entries, "excluded": omitted}
            encoded = _json(manifest)
            if len(encoded) > MAX_MANIFEST:
                raise BackupError("Manifest exceeds size limit")
            z.writestr(MANIFEST, encoded)
        verified = verify(partial, max_total=max_total, max_file=max_file)
        # Random timestamp name and x-mode partial make collisions exceptionally unlikely;
        # refuse any existing final rather than overwriting a previous snapshot.
        if final.exists():
            raise BackupError("Snapshot destination already exists")
        partial.rename(final)
        return {"archive": str(final), "sha256": _file_hash(final), **verified}
    except BaseException:
        partial.unlink(missing_ok=True)
        raise


def _file_hash(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as f:
        while chunk := f.read(CHUNK):
            digest.update(chunk)
    return digest.hexdigest()


def _inspect(z, max_total, max_file):
    infos = z.infolist()
    if len(infos) > MAX_FILES + 1:
        raise BackupError("Too many archive entries")
    seen = set()
    total = 0
    by_name = {}
    for info in infos:
        name = _safe_name(info.filename)
        key = _collision_key(name)
        if key in seen:
            raise BackupError("Duplicate or case-colliding archive path")
        seen.add(key)
        if info.is_dir() or stat.S_ISLNK(info.external_attr >> 16):
            raise BackupError("Directories and symlinks are not permitted as archive entries")
        if info.flag_bits & 1:
            raise BackupError("Encrypted ZIP entries are unsupported")
        limit = MAX_MANIFEST if name == MANIFEST else max_file
        if info.file_size > limit or info.file_size < 0:
            raise BackupError("Archive file exceeds size limit")
        if name != MANIFEST:
            total += info.file_size
        if total > max_total:
            raise BackupError("Archive exceeds total size limit")
        by_name[name] = info
    if MANIFEST not in by_name:
        raise BackupError("Missing manifest")
    manifest = json.loads(z.read(MANIFEST), object_pairs_hook=_no_duplicate_keys)
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != 1 or manifest.get("scope") != "source-files-only":
        raise BackupError("Unsupported manifest")
    records = manifest.get("files")
    if not isinstance(records, list) or len(records) > MAX_FILES:
        raise BackupError("Invalid manifest files")
    expected = {}
    for record in records:
        if not isinstance(record, dict) or set(record) != {"path", "size", "sha256"}:
            raise BackupError("Invalid manifest record")
        name = _safe_name(record["path"])
        if name == MANIFEST or name in expected:
            raise BackupError("Duplicate manifest record")
        if type(record["size"]) is not int or record["size"] < 0 or record["size"] > max_file:
            raise BackupError("Invalid manifest size")
        if not isinstance(record["sha256"], str) or not re.fullmatch(r"[a-f0-9]{64}", record["sha256"]):
            raise BackupError("Invalid manifest digest")
        expected[name] = record
    if set(by_name) != set(expected) | {MANIFEST}:
        raise BackupError("Manifest and archive file lists differ")
    for name, record in expected.items():
        if by_name[name].file_size != record["size"]:
            raise BackupError("Manifest size mismatch")
    return expected, total


def _read_and_check(z, name, record, destination=None):
    digest = hashlib.sha256()
    count = 0
    with z.open(name) as src:
        while chunk := src.read(CHUNK):
            count += len(chunk)
            if count > record["size"]:
                raise BackupError("Decompressed data exceeds declared size")
            digest.update(chunk)
            if destination is not None:
                destination.write(chunk)
    if count != record["size"] or digest.hexdigest() != record["sha256"]:
        raise BackupError("Archive checksum mismatch")


def verify(archive, *, max_total=MAX_TOTAL, max_file=MAX_FILE):
    with zipfile.ZipFile(archive) as z:
        expected, total = _inspect(z, max_total, max_file)
        for name, record in expected.items():
            _read_and_check(z, name, record)
    return {"verified": True, "fileCount": len(expected), "sourceBytes": total}


def restore(archive, destination, *, max_total=MAX_TOTAL, max_file=MAX_FILE):
    dest = Path(destination).absolute()
    if dest.exists() or dest.is_symlink():
        raise BackupError("Restore destination must not exist")
    if not dest.parent.is_dir() or _link(dest.parent.lstat()):
        raise BackupError("Restore parent must be an existing real directory")
    parent = dest.parent.resolve(strict=True)
    dest = parent / dest.name
    staging = Path(tempfile.mkdtemp(prefix=".phare-restore-", dir=parent))
    try:
        with zipfile.ZipFile(archive) as z:
            expected, total = _inspect(z, max_total, max_file)
            # Validate every checksum before creating the final user-visible directory.
            for name, record in expected.items():
                path = staging.joinpath(*PurePosixPath(name).parts)
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open("xb") as output:
                    _read_and_check(z, name, record, output)
            (staging / MANIFEST).write_bytes(z.read(MANIFEST))
        if dest.exists():
            raise BackupError("Restore destination appeared during restore")
        staging.rename(dest)
        return {"restored": True, "destination": str(dest), "fileCount": len(expected), "sourceBytes": total}
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", action="append", default=[], metavar="ALIAS=PATH")
    parser.add_argument("--output")
    parser.add_argument("--verify", metavar="ZIP")
    parser.add_argument("--restore", metavar="ZIP")
    parser.add_argument("--destination")
    args = parser.parse_args(argv)
    try:
        if args.verify:
            if args.source or args.output or args.restore or args.destination:
                raise BackupError("Choose only one operation")
            result = verify(args.verify)
        elif args.restore:
            if args.source or args.output or not args.destination:
                raise BackupError("Restore requires only archive and destination")
            result = restore(args.restore, args.destination)
        else:
            if not args.output or not args.source or args.destination:
                raise BackupError("Snapshot requires sources and output")
            sources = []
            for arg in args.source:
                if "=" not in arg:
                    raise BackupError("Each source must use ALIAS=PATH")
                sources.append(arg.split("=", 1))
            result = snapshot(sources, args.output)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (BackupError, OSError, ValueError, zipfile.BadZipFile, RuntimeError) as error:
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
