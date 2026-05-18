#!/usr/bin/env python3
"""
Télécharge tous les fichiers Google Drive référencés dans content.json,
les enregistre dans media/{articles,audio,video}/ et remplace
le champ `driveUrl` par `file` (chemin local relatif).

Usage:
    python3 scripts/download_drive_assets.py [--dry-run] [--force]

Idempotent : si `file` est déjà renseigné et que le fichier existe,
l'entrée est sautée (sauf avec --force).
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import re
import sys
import unicodedata
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content.json"
MEDIA = ROOT / "media"

# Au-delà de cette taille on garde l'iframe Drive plutôt que de stocker le fichier
# dans le repo. La limite par fichier de GitHub est 100 Mo (refus dur), 50 Mo (warn).
MAX_DOWNLOAD_MB = 75

KIND_DIRS = {
    "articles": "articles",
    "audio": "audio",
    "video": "video",
}

EXT_BY_MIME = {
    "application/pdf": ".pdf",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/x-m4a": ".m4a",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/ogg": ".ogg",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "video/x-matroska": ".mkv",
}

DEFAULT_EXT = {
    "articles": ".pdf",
    "audio": ".mp3",
    "video": ".mp4",
}


def sniff_extension(head: bytes) -> str | None:
    """Devine l'extension à partir des premiers octets (magic bytes)."""
    if head.startswith(b"%PDF"):
        return ".pdf"
    if head.startswith(b"ID3") or head[:2] == b"\xff\xfb" or head[:2] == b"\xff\xf3":
        return ".mp3"
    if head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand in (b"M4A ", b"M4B "):
            return ".m4a"
        if brand in (b"qt  ",):
            return ".mov"
        return ".mp4"
    if head.startswith(b"RIFF") and head[8:12] == b"WAVE":
        return ".wav"
    if head.startswith(b"OggS"):
        return ".ogg"
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return ".webm"
    return None


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text[:80] or "item"


def drive_file_id(url: str) -> str | None:
    if not url:
        return None
    m = re.search(r"/file/d/([^/]+)", url) or re.search(r"[?&]id=([^&]+)", url)
    return m.group(1) if m else None


def filename_from_disposition(header: str) -> str | None:
    if not header:
        return None
    m = re.search(r"filename\*=UTF-8''([^;]+)", header)
    if m:
        from urllib.parse import unquote
        return unquote(m.group(1).strip('"'))
    m = re.search(r'filename="([^"]+)"', header) or re.search(r"filename=([^;]+)", header)
    return m.group(1).strip().strip('"') if m else None


class TooLarge(Exception):
    def __init__(self, size_bytes: int):
        super().__init__(f"fichier trop gros : {size_bytes // (1024 * 1024)} Mo")
        self.size_bytes = size_bytes


def download_drive_file(file_id: str, dest_dir: Path, slug: str, kind: str, max_bytes: int) -> Path:
    """Télécharge un fichier depuis Google Drive en gérant l'avertissement « virus scan ».

    Lève TooLarge si le fichier dépasse max_bytes (vérifié via Content-Length, et au
    fil du flux comme garde-fou si l'en-tête est absent).
    """
    session = requests.Session()
    url = "https://drive.google.com/uc?export=download"
    params = {"id": file_id}

    response = session.get(url, params=params, stream=True, allow_redirects=True)

    # Si Drive retourne une page de confirmation (gros fichier), on extrait le token.
    confirm_token = None
    for k, v in response.cookies.items():
        if k.startswith("download_warning"):
            confirm_token = v
            break

    if confirm_token is None and "text/html" in response.headers.get("content-type", ""):
        # Drive moderne renvoie un formulaire HTML — on parse les champs cachés.
        body = response.text
        form_action = re.search(r'action="([^"]+)"', body)
        fields = dict(re.findall(r'name="([^"]+)"\s+value="([^"]*)"', body))
        if form_action and fields:
            response = session.get(form_action.group(1), params=fields, stream=True, allow_redirects=True)

    if confirm_token:
        params["confirm"] = confirm_token
        response = session.get(url, params=params, stream=True, allow_redirects=True)

    response.raise_for_status()

    # Garde-fou via Content-Length quand Drive le fournit (PDF, petits fichiers).
    cl = response.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > max_bytes:
        response.close()
        raise TooLarge(int(cl))

    # Déterminer une extension initiale d'après les headers
    mime = response.headers.get("content-type", "").split(";")[0].strip().lower()
    ext = EXT_BY_MIME.get(mime)
    if not ext:
        name = filename_from_disposition(response.headers.get("content-disposition", ""))
        if name:
            ext = Path(name).suffix.lower() or None
    if not ext and mime and mime != "application/octet-stream":
        ext = mimetypes.guess_extension(mime)

    # Écriture du flux dans un fichier temporaire — on renomme après avoir sniffé les magic bytes
    tmp = dest_dir / f".{slug}.part"
    total = 0
    head = b""
    try:
        with open(tmp, "wb") as fh:
            for chunk in response.iter_content(chunk_size=1 << 15):
                if not chunk:
                    continue
                fh.write(chunk)
                total += len(chunk)
                if len(head) < 16:
                    head += chunk[: 16 - len(head)]
                # Si Drive n'a pas annoncé la taille (gros fichiers passés par la page de confirmation),
                # on coupe dès qu'on dépasse la limite.
                if total > max_bytes:
                    raise TooLarge(total)
    except TooLarge:
        tmp.unlink(missing_ok=True)
        raise

    sniffed = sniff_extension(head)
    if sniffed:
        ext = sniffed
    if not ext:
        ext = DEFAULT_EXT.get(kind, ".bin")

    dest = dest_dir / f"{slug}{ext}"
    counter = 2
    while dest.exists():
        dest = dest_dir / f"{slug}-{counter}{ext}"
        counter += 1
    tmp.rename(dest)

    # Sanity check : Drive renvoie parfois une page d'erreur HTML
    if total < 4096 and head.lower().lstrip().startswith((b"<html", b"<!doctype html")):
        dest.unlink()
        raise RuntimeError(
            f"Google Drive a renvoyé une page HTML au lieu du fichier (id={file_id}). "
            "Vérifie que le fichier est partagé en accès public."
        )

    return dest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Affiche ce qui serait fait sans rien télécharger")
    parser.add_argument("--force", action="store_true", help="Re-télécharge même si le fichier local existe déjà")
    args = parser.parse_args()

    data = json.loads(CONTENT.read_text(encoding="utf-8"))

    errors: list[str] = []
    changes = 0

    for kind, subdir in KIND_DIRS.items():
        items = data.get(kind, [])
        if not items:
            continue
        out_dir = MEDIA / subdir
        if not args.dry_run:
            out_dir.mkdir(parents=True, exist_ok=True)

        for i, item in enumerate(items):
            title = item.get("title", f"{kind}-{i}")
            url = item.get("driveUrl", "")

            if item.get("skipDownload") and not args.force:
                print(f"[skip] {kind}/{title} (skipDownload)")
                continue

            existing = item.get("file")
            if existing and (ROOT / existing).exists() and not args.force:
                print(f"[skip] {kind}/{title} -> {existing}")
                continue

            file_id = drive_file_id(url)
            if not file_id:
                print(f"[warn] pas d'URL Drive pour: {kind}/{title}")
                continue

            slug = slugify(title)
            print(f"[get ] {kind}/{title}  (id={file_id})")

            if args.dry_run:
                continue

            try:
                dest = download_drive_file(file_id, out_dir, slug, kind, MAX_DOWNLOAD_MB * 1024 * 1024)
            except TooLarge as e:
                size_mb = e.size_bytes // (1024 * 1024) if e.size_bytes else "?"
                print(f"[big ] {kind}/{title}: {size_mb} Mo > {MAX_DOWNLOAD_MB} Mo — garde l'iframe Drive")
                item["skipDownload"] = True
                changes += 1
                continue
            except Exception as e:
                msg = f"{kind}/{title}: {e}"
                print(f"[FAIL] {msg}", file=sys.stderr)
                errors.append(msg)
                continue

            rel = dest.relative_to(ROOT).as_posix()
            item["file"] = rel
            item.pop("driveUrl", None)
            item.pop("skipDownload", None)
            changes += 1
            print(f"       -> {rel}  ({dest.stat().st_size // 1024} KiB)")

    if not args.dry_run and changes:
        CONTENT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"\n{changes} entrée(s) mise(s) à jour dans content.json")

    if errors:
        print(f"\n{len(errors)} échec(s) :", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
