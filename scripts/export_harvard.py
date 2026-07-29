#!/usr/bin/env python3
"""Export Institutional Books metadata into static prefix shards for GitHub Pages.

Requires access to the gated Hugging Face metadata dataset and HF_TOKEN.
The exporter streams rows, writes compact title/author prefix shards, and never
copies the 947 GB OCR corpus into the repository or Pages artifact.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

from datasets import load_dataset

DATASET = "institutional/institutional-books-1.0-metadata"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "harvard"


def first(row: dict, *names: str, default=None):
    for name in names:
        value = row.get(name)
        if value not in (None, "", [], {}):
            return value
    return default


def text(value) -> str:
    if isinstance(value, list):
        return "; ".join(str(item) for item in value if item not in (None, ""))
    if isinstance(value, dict):
        return "; ".join(str(item) for item in value.values() if item not in (None, ""))
    return "" if value is None else str(value)


def prefix(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    value = re.sub(r"[^a-z0-9]", "", value)
    return (value[:2] or "__").ljust(2, "_")


def compact(row: dict, index: int) -> dict:
    title = text(first(row, "title_src", "title", "title_generated", default="Untitled"))
    author = text(first(row, "author_src", "authors", "creator", "author", default="Unknown author"))
    language = text(first(row, "language", "language_src", "language_detected", "lang", default="und"))
    date = text(first(row, "date", "date_src", "publication_date", "published", default=""))
    volume_id = text(first(row, "volume_id", "google_id", "id", "identifier", default=index))
    return {"i": volume_id, "t": title, "a": author, "l": language, "d": date}


def main() -> None:
    token = os.environ.get("HF_TOKEN")
    if not token:
        raise SystemExit("HF_TOKEN is required; accept the dataset terms and add it as a GitHub Actions secret")

    OUT.mkdir(parents=True, exist_ok=True)
    temp = Path(tempfile.mkdtemp(prefix="open-shelves-harvard-"))
    title_files: dict[str, object] = {}
    author_files: dict[str, object] = {}
    languages: Counter[str] = Counter()
    years: Counter[str] = Counter()
    count = 0

    try:
        dataset = load_dataset(DATASET, split="train", streaming=True, token=token)
        for count, row in enumerate(dataset, start=1):
            item = compact(row, count)
            languages[item["l"] or "und"] += 1
            year_match = re.search(r"(?:1[0-9]{3}|20[0-2][0-9])", item["d"])
            years[year_match.group(0) if year_match else "unknown"] += 1

            for key, value, handles, folder in (
                (prefix(item["t"]), item["t"], title_files, "title"),
                (prefix(item["a"]), item["a"], author_files, "author"),
            ):
                handle = handles.get(key)
                if handle is None:
                    path = temp / folder / f"{key}.jsonl"
                    path.parent.mkdir(parents=True, exist_ok=True)
                    handle = path.open("a", encoding="utf-8")
                    handles[key] = handle
                handle.write(json.dumps(item, ensure_ascii=False, separators=(",", ":")) + "\n")

            if count % 50000 == 0:
                print(f"Processed {count:,} volumes")

        for handle in [*title_files.values(), *author_files.values()]:
            handle.close()

        for folder in ("title", "author"):
            target_dir = OUT / folder
            shutil.rmtree(target_dir, ignore_errors=True)
            target_dir.mkdir(parents=True)
            for source in sorted((temp / folder).glob("*.jsonl")):
                rows = [json.loads(line) for line in source.read_text(encoding="utf-8").splitlines()]
                sort_key = "t" if folder == "title" else "a"
                rows.sort(key=lambda item: item[sort_key].casefold())
                (target_dir / f"{source.stem}.json").write_text(
                    json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
                )

        manifest = {
            "dataset": DATASET,
            "volumes": count,
            "generated": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
            "languages": languages.most_common(),
            "years": sorted(years.items()),
            "titlePrefixes": sorted(title_files),
            "authorPrefixes": sorted(author_files),
            "source": "https://huggingface.co/datasets/institutional/institutional-books-1.0-metadata",
            "ocrSource": "https://huggingface.co/datasets/institutional/institutional-books-1.0",
        }
        (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
        print(f"Exported {count:,} metadata records to {OUT}")
    finally:
        for handle in [*title_files.values(), *author_files.values()]:
            if not handle.closed:
                handle.close()
        shutil.rmtree(temp, ignore_errors=True)


if __name__ == "__main__":
    main()
