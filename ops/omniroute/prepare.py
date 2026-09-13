#!/usr/bin/env python3
"""Create local pilot secrets once; never print or replace an existing secret."""
import os
from pathlib import Path
import secrets
import stat

KEYS = ("JWT_SECRET", "API_KEY_SECRET", "INITIAL_PASSWORD", "STORAGE_ENCRYPTION_KEY")


def prepare(directory: Path) -> bool:
    if directory.is_symlink():
        raise ValueError("Runtime directory must not be a symlink")
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    if stat.S_IMODE(directory.stat().st_mode) & 0o077:
        raise ValueError("Runtime directory must be private (mode 700)")
    target = directory / ".env"
    if target.is_symlink():
        raise ValueError("Secret file must not be a symlink")
    if target.exists():
        if not target.is_file() or stat.S_IMODE(target.stat().st_mode) & 0o077:
            raise ValueError("Existing secret file must be regular and private (mode 600)")
        fields = dict(line.split("=", 1) for line in target.read_text().splitlines() if "=" in line)
        if set(fields) != set(KEYS) or any(len(fields[key]) < 43 for key in KEYS):
            raise ValueError("Existing secrets are incomplete; preserved without modification")
        return False
    content = "".join(f"{key}={secrets.token_hex(32)}\n" for key in KEYS)
    # O_EXCL also protects against a concurrent prepare and a newly inserted symlink.
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as output:
        output.write(content)
        output.flush()
        os.fsync(output.fileno())
    return True


if __name__ == "__main__":
    created = prepare(Path(__file__).resolve().parent / ".runtime")
    print("Pilot secrets created locally." if created else "Existing pilot secrets preserved.")
