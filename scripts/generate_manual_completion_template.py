#!/usr/bin/env python
"""Generate manual completion files for papers with incomplete public metadata."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


CSV_HEADERS = [
    "id",
    "title",
    "authors",
    "year",
    "journal",
    "current_doi",
    "current_pubmed",
    "current_abstract",
    "current_fullTextUrl",
    "manual_doi",
    "manual_pubmed",
    "manual_abstract",
    "manual_fullTextUrl",
    "manual_keywords",
    "note",
]


def clean(value: Any) -> str:
    return "" if value is None else str(value).strip()


def is_incomplete(paper: dict[str, Any]) -> bool:
    return not all(
        [
            clean(paper.get("doi")),
            clean(paper.get("pubmed")),
            clean(paper.get("abstract")),
            clean(paper.get("fullTextUrl")),
        ]
    )


def truncate(text: str, limit: int = 300) -> str:
    text = clean(text)
    return text if len(text) <= limit else text[:limit].rstrip() + "..."


def missing_fields(paper: dict[str, Any]) -> list[str]:
    labels = []
    if not clean(paper.get("doi")):
        labels.append("DOI")
    if not clean(paper.get("pubmed")):
        labels.append("PubMed")
    if not clean(paper.get("abstract")):
        labels.append("摘要")
    if not clean(paper.get("fullTextUrl")):
        labels.append("全文链接")
    return labels


def year_key(paper: dict[str, Any]) -> int:
    try:
        return int(clean(paper.get("year")))
    except ValueError:
        return 0


def write_csv(path: Path, papers: list[dict[str, Any]]) -> None:
    rows = []
    for paper in papers:
        rows.append(
            {
                "id": clean(paper.get("id")),
                "title": clean(paper.get("title")),
                "authors": clean(paper.get("authors")),
                "year": clean(paper.get("year")),
                "journal": clean(paper.get("journal")),
                "current_doi": clean(paper.get("doi")),
                "current_pubmed": clean(paper.get("pubmed")),
                "current_abstract": truncate(paper.get("abstract", "")),
                "current_fullTextUrl": clean(paper.get("fullTextUrl")),
                "manual_doi": "",
                "manual_pubmed": "",
                "manual_abstract": "",
                "manual_fullTextUrl": "",
                "manual_keywords": "",
                "note": "",
            }
        )

    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_HEADERS)
        writer.writeheader()
        writer.writerows(rows)


def write_markdown(path: Path, papers: list[dict[str, Any]]) -> None:
    lines = [
        "# 信息不完整文献清单",
        "",
        "以下文献仍缺少 DOI、PubMed、摘要或全文链接中的至少一项，供部署前人工核对补充。",
        "",
    ]
    for paper in sorted(papers, key=lambda item: (year_key(item), clean(item.get("id"))), reverse=True):
        paper_id = clean(paper.get("id")) or "unknown"
        year = clean(paper.get("year")) or "年份未知"
        journal = clean(paper.get("journal")) or "期刊未知"
        title = clean(paper.get("title")) or "题名未知"
        lines.extend(
            [
                f"### {paper_id}｜{year}｜{journal}",
                title,
                "",
                "缺失字段：" + " / ".join(missing_fields(paper)),
                "",
            ]
        )
    path.write_text("\n".join(lines), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Generate manual completion CSV and unmatched Markdown list.")
    parser.add_argument("--input", type=Path, default=project_root / "data" / "papers.json")
    parser.add_argument("--csv-output", type=Path, default=project_root / "data" / "manual_completion_template.csv")
    parser.add_argument("--md-output", type=Path, default=project_root / "data" / "unmatched_papers.md")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    papers = [paper for paper in payload.get("papers", []) if is_incomplete(paper)]
    write_csv(args.csv_output, papers)
    write_markdown(args.md_output, papers)
    print(f"Incomplete papers: {len(papers)}")
    print(f"Wrote {args.csv_output}")
    print(f"Wrote {args.md_output}")


if __name__ == "__main__":
    main()
