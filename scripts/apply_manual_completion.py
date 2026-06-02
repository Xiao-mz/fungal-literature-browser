#!/usr/bin/env python
"""Apply manually completed metadata back into papers.json and papers.js."""

from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import date
from pathlib import Path
from typing import Any


PAPER_FIELDS = [
    "id",
    "title",
    "authors",
    "year",
    "journal",
    "keywords",
    "abstract",
    "doi",
    "doiUrl",
    "pubmed",
    "pubmedUrl",
    "fullTextUrl",
    "role",
    "note",
]

LOG_HEADERS = ["id", "title", "updated_fields", "note"]


def clean(value: Any) -> str:
    return "" if value is None else str(value).strip()


def normalize_doi(value: str) -> str:
    doi = clean(value)
    doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", doi, flags=re.I)
    doi = re.sub(r"^doi:\s*", "", doi, flags=re.I)
    return doi.rstrip(".")


def doi_url(doi: str) -> str:
    doi = normalize_doi(doi)
    return f"https://doi.org/{doi}" if doi else ""


def normalize_pubmed(value: str) -> str:
    text = clean(value)
    match = re.search(r"(?:pubmed\.ncbi\.nlm\.nih\.gov/)?(\d{6,10})", text, flags=re.I)
    return match.group(1) if match else text


def pubmed_url(pubmed: str) -> str:
    pmid = normalize_pubmed(pubmed)
    return f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if re.fullmatch(r"\d{6,10}", pmid) else ""


def normalize_url(value: str) -> str:
    text = clean(value)
    if not text:
        return ""
    if re.match(r"^https?://", text, flags=re.I):
        return text
    if re.match(r"^10\.\S+", text, flags=re.I):
        return doi_url(text)
    return text


def split_keywords(value: str) -> list[str]:
    pieces = re.split(r"[;；,，、\n|]+", clean(value))
    return [piece.strip() for piece in pieces if piece.strip()]


def ordered_paper(paper: dict[str, Any]) -> dict[str, Any]:
    return {field: paper.get(field, [] if field == "keywords" else "") for field in PAPER_FIELDS}


def write_outputs(payload: dict[str, Any], json_path: Path, js_path: Path) -> None:
    payload["manualCompletedAt"] = date.today().isoformat()
    payload["papers"] = [ordered_paper(paper) for paper in payload.get("papers", [])]
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    json_path.write_text(text + "\n", encoding="utf-8")
    js_path.write_text("window.PAPERS_DATA = " + text + ";\n", encoding="utf-8")


def apply_row(paper: dict[str, Any], row: dict[str, str]) -> list[str]:
    updated = []

    manual_doi = normalize_doi(row.get("manual_doi", ""))
    if manual_doi:
        paper["doi"] = manual_doi
        paper["doiUrl"] = doi_url(manual_doi)
        if not clean(paper.get("fullTextUrl")):
            paper["fullTextUrl"] = paper["doiUrl"]
        updated.extend(["doi", "doiUrl"])

    manual_pubmed = normalize_pubmed(row.get("manual_pubmed", ""))
    if manual_pubmed:
        paper["pubmed"] = manual_pubmed
        paper["pubmedUrl"] = pubmed_url(manual_pubmed)
        updated.extend(["pubmed", "pubmedUrl"])

    manual_abstract = clean(row.get("manual_abstract", ""))
    if manual_abstract:
        paper["abstract"] = manual_abstract
        updated.append("abstract")

    manual_full_text = normalize_url(row.get("manual_fullTextUrl", ""))
    if manual_full_text:
        paper["fullTextUrl"] = manual_full_text
        updated.append("fullTextUrl")

    manual_keywords = split_keywords(row.get("manual_keywords", ""))
    if manual_keywords:
        existing = paper.get("keywords") if isinstance(paper.get("keywords"), list) else []
        merged = list(existing)
        for keyword in manual_keywords:
            if keyword not in merged:
                merged.append(keyword)
        paper["keywords"] = merged
        updated.append("keywords")

    return updated


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Apply manual metadata completion rows to papers data.")
    parser.add_argument("--input", type=Path, default=project_root / "data" / "manual_completion_template.csv")
    parser.add_argument("--papers", type=Path, default=project_root / "data" / "papers.json")
    parser.add_argument("--js-output", type=Path, default=project_root / "data" / "papers.js")
    parser.add_argument("--log", type=Path, default=project_root / "data" / "manual_completion_log.csv")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = json.loads(args.papers.read_text(encoding="utf-8"))
    papers_by_id = {paper.get("id"): paper for paper in payload.get("papers", [])}
    log_rows = []

    with args.input.open("r", newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            paper_id = clean(row.get("id"))
            paper = papers_by_id.get(paper_id)
            if not paper:
                log_rows.append({"id": paper_id, "title": clean(row.get("title")), "updated_fields": "", "note": "未找到对应文献"})
                continue
            updated = apply_row(paper, row)
            if updated:
                log_rows.append(
                    {
                        "id": paper_id,
                        "title": paper.get("title", ""),
                        "updated_fields": ";".join(dict.fromkeys(updated)),
                        "note": clean(row.get("note", "")),
                    }
                )

    write_outputs(payload, args.papers, args.js_output)
    with args.log.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=LOG_HEADERS)
        writer.writeheader()
        writer.writerows(log_rows)

    print(f"Updated papers: {len(log_rows)}")
    print(f"Wrote {args.papers}")
    print(f"Wrote {args.js_output}")
    print(f"Wrote {args.log}")


if __name__ == "__main__":
    main()
