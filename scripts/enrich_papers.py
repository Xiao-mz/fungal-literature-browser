#!/usr/bin/env python
"""Enrich static paper records with DOI, PubMed IDs, abstracts, and links.

Public sources:
- PubMed E-utilities
- Crossref Works API

Matches are accepted only when title similarity is at or above the configured
threshold, which defaults to 0.85. Lower-confidence candidates are written to a
review CSV for manual checking.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any


PUBMED_ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
CROSSREF_WORKS = "https://api.crossref.org/works"

LOG_HEADERS = [
    "文献ID",
    "标题",
    "DOI是否补全",
    "PubMed是否补全",
    "摘要是否补全",
    "匹配来源和分数",
    "是否需要人工核对",
]

REVIEW_HEADERS = [
    "文献ID",
    "标题",
    "来源",
    "候选标题",
    "匹配分数",
    "候选DOI",
    "候选PubMed",
    "候选链接",
    "原因",
]

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


@dataclass
class Candidate:
    source: str
    title: str
    score: float
    year: str = ""
    journal: str = ""
    doi: str = ""
    pubmed: str = ""
    pubmed_url: str = ""
    abstract: str = ""
    full_text_url: str = ""
    url: str = ""


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = html.unescape(str(value))
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("\u3000", " ").strip()
    if text.lower() in {"nan", "none", "nat"}:
        return ""
    return re.sub(r"\s+", " ", text)


def normalize_title(value: str) -> str:
    text = clean_text(value).casefold()
    text = re.sub(r"[^\w\u4e00-\u9fff]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def title_similarity(left: str, right: str) -> float:
    normalized_left = normalize_title(left)
    normalized_right = normalize_title(right)
    if not normalized_left or not normalized_right:
        return 0.0
    return SequenceMatcher(None, normalized_left, normalized_right).ratio()


def normalize_doi(value: str) -> str:
    doi = clean_text(value)
    doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", doi, flags=re.I)
    doi = re.sub(r"^doi:\s*", "", doi, flags=re.I)
    return doi.strip().rstrip(".")


def doi_url(doi: str) -> str:
    doi = normalize_doi(doi)
    return f"https://doi.org/{doi}" if doi else ""


def normalize_pubmed(value: str) -> str:
    pubmed = clean_text(value)
    match = re.search(r"(?:pubmed\.ncbi\.nlm\.nih\.gov/)?(\d{6,10})", pubmed, flags=re.I)
    return match.group(1) if match else pubmed


def pubmed_url(pubmed: str) -> str:
    pmid = normalize_pubmed(pubmed)
    return f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if re.fullmatch(r"\d{6,10}", pmid or "") else ""


def normalize_url(value: str) -> str:
    url = clean_text(value)
    if not url:
        return ""
    if re.match(r"^https?://", url, flags=re.I):
        return url
    if re.match(r"^10\.\S+", url, flags=re.I):
        return doi_url(url)
    return ""


def request_text(url: str, args: argparse.Namespace) -> str:
    headers = {"User-Agent": args.user_agent}
    last_error: Exception | None = None
    for attempt in range(args.retries + 1):
        try:
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=args.timeout) as response:
                return response.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code in {429, 500, 502, 503, 504} and attempt < args.retries:
                time.sleep(args.retry_delay * (attempt + 1))
                continue
            raise
        except urllib.error.URLError as error:
            last_error = error
            if attempt < args.retries:
                time.sleep(args.retry_delay * (attempt + 1))
                continue
            raise
    raise RuntimeError(f"Request failed: {last_error}")


def request_json(url: str, args: argparse.Namespace) -> dict[str, Any]:
    return json.loads(request_text(url, args))


def pubmed_search(title: str, args: argparse.Namespace) -> list[Candidate]:
    ids: list[str] = []
    search_terms = [f'"{title}"[Title]', f"{title}[Title]", title]
    for term in search_terms:
        params = {
            "db": "pubmed",
            "term": term,
            "retmode": "json",
            "retmax": str(args.rows),
            "tool": "literature_browser",
        }
        if args.email:
            params["email"] = args.email
        search_url = f"{PUBMED_ESEARCH}?{urllib.parse.urlencode(params)}"
        search_data = request_json(search_url, args)
        ids = search_data.get("esearchresult", {}).get("idlist", [])
        if ids:
            break
    if not ids:
        return []

    fetch_params = {
        "db": "pubmed",
        "id": ",".join(ids),
        "retmode": "xml",
        "tool": "literature_browser",
    }
    if args.email:
        fetch_params["email"] = args.email
    fetch_url = f"{PUBMED_EFETCH}?{urllib.parse.urlencode(fetch_params)}"
    root = ET.fromstring(request_text(fetch_url, args))

    candidates: list[Candidate] = []
    for article in root.findall(".//PubmedArticle"):
        article_title = element_text(article.find(".//ArticleTitle"))
        journal = element_text(article.find(".//Journal/Title")) or element_text(article.find(".//Journal/ISOAbbreviation"))
        year = extract_pubmed_year(article)
        pmid = clean_text(article.findtext(".//PMID"))
        doi = ""
        pmcid = ""
        for article_id in article.findall(".//ArticleId"):
            id_type = (article_id.attrib.get("IdType") or "").lower()
            value = clean_text(article_id.text)
            if id_type == "doi":
                doi = normalize_doi(value)
            elif id_type == "pmc":
                pmcid = value

        abstract_parts = []
        for item in article.findall(".//Abstract/AbstractText"):
            label = clean_text(item.attrib.get("Label"))
            text = element_text(item)
            if label and text:
                abstract_parts.append(f"{label}: {text}")
            elif text:
                abstract_parts.append(text)
        abstract = "\n".join(abstract_parts)

        full_text_url = f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/" if pmcid else ""
        candidates.append(
            Candidate(
                source="PubMed",
                title=article_title,
                score=title_similarity(title, article_title),
                year=year,
                journal=journal,
                doi=doi,
                pubmed=pmid,
                pubmed_url=pubmed_url(pmid),
                abstract=abstract,
                full_text_url=full_text_url,
                url=pubmed_url(pmid),
            )
        )
    return candidates


def crossref_search(title: str, args: argparse.Namespace) -> list[Candidate]:
    params = {
        "query.title": title,
        "rows": str(args.rows),
        "select": "title,DOI,URL,link,issued,published-print,published-online,container-title",
    }
    if args.email:
        params["mailto"] = args.email
    url = f"{CROSSREF_WORKS}?{urllib.parse.urlencode(params)}"
    data = request_json(url, args)
    items = data.get("message", {}).get("items", [])

    candidates: list[Candidate] = []
    for item in items:
        item_title = clean_text((item.get("title") or [""])[0])
        journal = clean_text((item.get("container-title") or [""])[0])
        year = extract_crossref_year(item)
        doi = normalize_doi(item.get("DOI", ""))
        crossref_url = normalize_url(item.get("URL", ""))
        full_text_url = ""
        for link in item.get("link") or []:
            candidate_url = normalize_url(link.get("URL", ""))
            if candidate_url:
                full_text_url = candidate_url
                break

        candidates.append(
            Candidate(
                source="Crossref",
                title=item_title,
                score=title_similarity(title, item_title),
                year=year,
                journal=journal,
                doi=doi,
                full_text_url=full_text_url or doi_url(doi) or crossref_url,
                url=crossref_url or doi_url(doi),
            )
        )
    return candidates


def element_text(element: ET.Element | None) -> str:
    if element is None:
        return ""
    return clean_text("".join(element.itertext()))


def extract_pubmed_year(article: ET.Element) -> str:
    year = clean_text(article.findtext(".//JournalIssue/PubDate/Year"))
    if year:
        return year
    medline_date = clean_text(article.findtext(".//JournalIssue/PubDate/MedlineDate"))
    match = re.search(r"(19|20)\d{2}", medline_date)
    return match.group(0) if match else ""


def extract_crossref_year(item: dict[str, Any]) -> str:
    for key in ("published-print", "published-online", "issued"):
        date_parts = item.get(key, {}).get("date-parts") or []
        if date_parts and date_parts[0]:
            year = str(date_parts[0][0])
            if re.fullmatch(r"(19|20)\d{2}", year):
                return year
    return ""


def year_distance(candidate_year: str, paper_year: str) -> int:
    try:
        return abs(int(candidate_year) - int(paper_year))
    except (TypeError, ValueError):
        return 999


def best_candidate(candidates: list[Candidate], threshold: float, paper_year: str = "") -> Candidate | None:
    accepted = [candidate for candidate in candidates if candidate.score >= threshold]
    if not accepted:
        return None
    return sorted(
        accepted,
        key=lambda candidate: (candidate.score, -year_distance(candidate.year, paper_year)),
        reverse=True,
    )[0]


def review_candidates(
    paper: dict[str, Any],
    candidates: list[Candidate],
    threshold: float,
    review_floor: float,
) -> list[dict[str, str]]:
    rows = []
    for candidate in sorted(candidates, key=lambda item: item.score, reverse=True):
        if review_floor <= candidate.score < threshold:
            rows.append(
                {
                    "文献ID": paper.get("id", ""),
                    "标题": paper.get("title", ""),
                    "来源": candidate.source,
                    "候选标题": candidate.title,
                    "匹配分数": f"{candidate.score:.3f}",
                    "候选DOI": candidate.doi,
                    "候选PubMed": candidate.pubmed,
                    "候选链接": candidate.url or candidate.full_text_url,
                    "原因": f"标题匹配分数低于 {threshold:.2f}，需人工核对；候选年份：{candidate.year or '未知'}",
                }
            )
    return rows


def ensure_schema(paper: dict[str, Any]) -> None:
    paper.setdefault("id", "")
    paper.setdefault("title", "")
    paper.setdefault("authors", "")
    paper.setdefault("year", "")
    paper.setdefault("journal", "")
    paper.setdefault("keywords", [])
    paper.setdefault("abstract", "")
    paper["doi"] = normalize_doi(paper.get("doi", ""))
    paper["doiUrl"] = normalize_url(paper.get("doiUrl", "")) or doi_url(paper["doi"])
    paper["pubmed"] = normalize_pubmed(paper.get("pubmed", ""))
    paper["pubmedUrl"] = normalize_url(paper.get("pubmedUrl", "")) or pubmed_url(paper["pubmed"])
    paper["fullTextUrl"] = normalize_url(paper.get("fullTextUrl", "")) or paper["doiUrl"]
    paper.setdefault("role", "")
    paper.setdefault("note", "")


def enrich_paper(
    paper: dict[str, Any],
    args: argparse.Namespace,
) -> tuple[dict[str, str], list[dict[str, str]]]:
    ensure_schema(paper)
    title = paper.get("title", "")
    paper_year = clean_text(paper.get("year", ""))

    source_scores: list[str] = []
    review_rows: list[dict[str, str]] = []
    candidates: list[Candidate] = []

    if args.skip_network:
        source_scores.append("network:skipped")
    else:
        for source_name, searcher in (("PubMed", pubmed_search), ("Crossref", crossref_search)):
            try:
                source_candidates = searcher(title, args)
                candidates.extend(source_candidates)
                if source_candidates:
                    top = max(source_candidates, key=lambda item: item.score)
                    source_scores.append(f"{source_name}:{top.score:.3f}")
                else:
                    source_scores.append(f"{source_name}:none")
            except Exception as error:  # Keep processing other papers if one API call fails.
                source_scores.append(f"{source_name}:error:{type(error).__name__}")
            time.sleep(args.delay)

    pubmed_match = best_candidate([item for item in candidates if item.source == "PubMed"], args.threshold, paper_year)
    crossref_match = best_candidate([item for item in candidates if item.source == "Crossref"], args.threshold, paper_year)

    if pubmed_match:
        if not paper.get("pubmed") and pubmed_match.pubmed:
            paper["pubmed"] = pubmed_match.pubmed
            paper["pubmedUrl"] = pubmed_match.pubmed_url
        if not paper.get("doi") and pubmed_match.doi:
            paper["doi"] = pubmed_match.doi
            paper["doiUrl"] = doi_url(pubmed_match.doi)
        if not paper.get("abstract") and pubmed_match.abstract:
            paper["abstract"] = pubmed_match.abstract
        if not paper.get("fullTextUrl") and pubmed_match.full_text_url:
            paper["fullTextUrl"] = pubmed_match.full_text_url
        if not paper.get("journal") and pubmed_match.journal:
            paper["journal"] = pubmed_match.journal
        if not paper.get("year") and pubmed_match.year:
            paper["year"] = pubmed_match.year

    if crossref_match:
        if not paper.get("doi") and crossref_match.doi:
            paper["doi"] = crossref_match.doi
            paper["doiUrl"] = doi_url(crossref_match.doi)
        if not paper.get("fullTextUrl") and crossref_match.full_text_url:
            paper["fullTextUrl"] = crossref_match.full_text_url
        if not paper.get("journal") and crossref_match.journal:
            paper["journal"] = crossref_match.journal
        if not paper.get("year") and crossref_match.year:
            paper["year"] = crossref_match.year

    ensure_schema(paper)
    if not paper.get("fullTextUrl") and paper.get("doiUrl"):
        paper["fullTextUrl"] = paper["doiUrl"]

    has_accepted_match = any(candidate.score >= args.threshold for candidate in candidates)
    if not has_accepted_match:
        review_rows.extend(review_candidates(paper, candidates, args.threshold, args.review_floor))
    needs_review = "是" if review_rows else "否"

    log_row = {
        "文献ID": paper.get("id", ""),
        "标题": paper.get("title", ""),
        "DOI是否补全": "是" if bool(paper.get("doi")) else "否",
        "PubMed是否补全": "是" if bool(paper.get("pubmed")) else "否",
        "摘要是否补全": "是" if bool(paper.get("abstract")) else "否",
        "匹配来源和分数": "; ".join(source_scores) if source_scores else "none",
        "是否需要人工核对": needs_review,
    }
    return log_row, review_rows


def write_json_and_js(payload: dict[str, Any], json_path: Path, js_path: Path) -> None:
    payload["generatedAt"] = date.today().isoformat()
    payload["enrichedAt"] = date.today().isoformat()
    payload["papers"] = [ordered_paper(paper) for paper in payload.get("papers", [])]
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    json_path.write_text(text + "\n", encoding="utf-8")
    js_path.write_text("window.PAPERS_DATA = " + text + ";\n", encoding="utf-8")


def ordered_paper(paper: dict[str, Any]) -> dict[str, Any]:
    return {field: paper.get(field, [] if field == "keywords" else "") for field in PAPER_FIELDS}


def write_csv(path: Path, headers: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Enrich papers.json with public bibliographic metadata.")
    parser.add_argument("--input", type=Path, default=project_root / "data" / "papers.json", help="Input papers JSON.")
    parser.add_argument("--output", type=Path, default=project_root / "data" / "papers.json", help="Output papers JSON.")
    parser.add_argument("--js-output", type=Path, default=project_root / "data" / "papers.js", help="Output JS fallback.")
    parser.add_argument("--log", type=Path, default=project_root / "data" / "enrichment_log.csv", help="Enrichment log CSV.")
    parser.add_argument("--review", type=Path, default=project_root / "data" / "enrichment_review_needed.csv", help="Manual review CSV.")
    parser.add_argument("--threshold", type=float, default=0.85, help="Minimum title similarity to accept a match.")
    parser.add_argument("--review-floor", type=float, default=0.65, help="Minimum title similarity to include in review CSV.")
    parser.add_argument("--rows", type=int, default=5, help="API candidates to inspect per source.")
    parser.add_argument("--limit", type=int, default=0, help="Limit network enrichment to the first N papers; 0 means all.")
    parser.add_argument("--skip-network", action="store_true", help="Only normalize schema and links; do not call public APIs.")
    parser.add_argument("--dry-run", action="store_true", help="Run enrichment without writing output files.")
    parser.add_argument("--email", default="", help="Optional email for API etiquette.")
    parser.add_argument("--timeout", type=int, default=20, help="HTTP timeout in seconds.")
    parser.add_argument("--retries", type=int, default=1, help="Retries for transient HTTP errors.")
    parser.add_argument("--retry-delay", type=float, default=2.0, help="Retry delay multiplier in seconds.")
    parser.add_argument("--delay", type=float, default=0.34, help="Delay between API calls in seconds.")
    parser.add_argument(
        "--user-agent",
        default="literature-browser-enricher/1.0 (https://github.com/static-literature-browser)",
        help="HTTP User-Agent header.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    papers = payload.get("papers", [])

    log_rows: list[dict[str, str]] = []
    review_rows: list[dict[str, str]] = []

    for index, paper in enumerate(papers, start=1):
        if args.limit and index > args.limit:
            ensure_schema(paper)
            log_rows.append(
                {
                    "文献ID": paper.get("id", ""),
                    "标题": paper.get("title", ""),
                    "DOI是否补全": "否",
                    "PubMed是否补全": "否",
                    "摘要是否补全": "否",
                    "匹配来源和分数": "not processed due to --limit",
                    "是否需要人工核对": "否",
                }
            )
            continue

        log_row, paper_review_rows = enrich_paper(paper, args)
        log_rows.append(log_row)
        review_rows.extend(paper_review_rows)
        print(f"[{index}/{len(papers)}] {paper.get('id', '')} {log_row['匹配来源和分数']} review={log_row['是否需要人工核对']}")

    payload["papers"] = papers

    if args.dry_run:
        print("Dry run complete; no files were written.")
    else:
        write_json_and_js(payload, args.output, args.js_output)
        write_csv(args.log, LOG_HEADERS, log_rows)
        write_csv(args.review, REVIEW_HEADERS, review_rows)
        print(f"Wrote {args.output}")
        print(f"Wrote {args.js_output}")
        print(f"Wrote {args.log}")
        print(f"Wrote {args.review}")

    print(f"Papers: {len(papers)}")
    print(f"Review rows: {len(review_rows)}")


if __name__ == "__main__":
    main()
