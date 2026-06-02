#!/usr/bin/env python
"""Convert a local literature self-check Excel workbook into static JSON data.

The script is intentionally conservative: it extracts public bibliographic
fields and skips internal self-check/privacy columns.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd


FIELD_SYNONYMS = {
    "title": ["论文标题", "论文题目", "题名", "文章标题", "title", "article title"],
    "authors": ["所有作者", "作者", "authors", "author"],
    "year": ["发表年份", "发表时间", "年份", "年", "publication year", "year", "date"],
    "journal": ["发表杂志", "发表期刊", "期刊名称", "期刊", "杂志", "journal", "source", "刊名"],
    "abstract": ["摘要", "abstract"],
    "keywords": ["关键词", "关键字", "keywords", "keyword"],
    "doi": ["doi"],
    "pubmed": ["pubmed", "pmid"],
    "fullTextUrl": ["全文链接", "全文地址", "全文", "full text", "fulltext", "url", "link", "链接"],
    "role": ["本人角色", "作者身份", "角色", "通讯作者", "第一作者", "corresponding author", "first author"],
    "note": ["备注", "note", "remarks"],
}

EXCLUDED_HEADER_PATTERNS = [
    "诚信",
    "手机号",
    "手机",
    "电话",
    "身份证",
    "邮箱",
    "电子邮件",
    "email",
    "e-mail",
    "单位内部",
    "内部",
    "住址",
    "地址",
    "账号",
    "密码",
    "学号",
    "工号",
]

FALLBACK_KEYWORDS = ["临床检验", "感染性疾病", "病原微生物"]

KEYWORD_RULES = [
    (["candida auris"], ["耳念珠菌", "真菌感染", "流行病学"]),
    (["candida", "念珠菌", "albicans", "tropicalis"], ["念珠菌", "真菌感染"]),
    (["fungal", "fungi", "mycoses", "aspergillus", "cryptococcus", "prototheca", "真菌", "曲霉", "隐球菌", "木霉"], ["真菌感染", "病原真菌"]),
    (["resistance", "drug resistance", "susceptibility", "antifungal", "antimicrobial", "药敏", "耐药"], ["耐药性", "药敏试验"]),
    (["microbiome", "microbiota", "gut", "呼吸道微生物组", "微生物组"], ["微生物组"]),
    (["infection", "infectious", "pathogen", "microbial", "bacteria", "escherichia", "streptococcus", "感染"], ["病原微生物", "感染性疾病"]),
    (["感染性发热", "febrile", "fever"], ["感染性发热", "临床检验"]),
    (["sepsis", "脓毒症"], ["脓毒症", "临床检验"]),
    (["diagnosis", "diagnostic", "detect", "detection", "assay", "检验", "检测", "诊断"], ["临床检验", "分子诊断"]),
    (["pcr", "droplet digital pcr", "ddpcr"], ["分子诊断", "数字PCR"]),
    (["sequencing", "genome", "genomic", "cell-free dna", "cfDNA", "测序", "基因"], ["基因测序", "分子诊断"]),
    (["maldi-tof", "mass spectrometry", "质谱"], ["MALDI-TOF MS", "临床检验"]),
    (["machine learning", "artificial intelligence", "ai ", "人工智能", "机器学习"], ["人工智能", "预测模型"]),
    (["epidemiology", "surveillance", "cohort", "prospective", "流行病学"], ["流行病学"]),
    (["hpv", "papillomavirus", "cervical", "宫颈"], ["HPV感染", "妇科感染"]),
    (["tuberculosis", "mycobacterium", "结核"], ["结核分枝杆菌", "病原微生物"]),
    (["colorectal", "carcinoma", "cancer", "tumor", "ovarian", "肿瘤"], ["肿瘤微环境", "多组学"]),
    (["multi-omics", "omics", "多组学"], ["多组学"]),
    (["consensus", "guideline", "共识", "专家"], ["专家共识", "临床路径"]),
    (["nanoparticle", "bio-microcircuit", "bio-assay", "生物芯片"], ["生物传感", "纳米材料"]),
]


def normalize_header(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "").strip().lower())


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).replace("\u3000", " ").strip()
    if text.lower() in {"nan", "none", "nat"}:
        return ""
    return re.sub(r"[ \t]+", " ", text)


def is_excluded_header(header: str) -> bool:
    normalized = normalize_header(header)
    return any(pattern.lower() in normalized for pattern in EXCLUDED_HEADER_PATTERNS)


def find_excel_file(project_root: Path) -> Path:
    workspace_root = project_root.parent
    candidates = [
        path
        for path in workspace_root.glob("*.xlsx")
        if not path.name.startswith("~$") and path.is_file()
    ]
    if not candidates:
        raise FileNotFoundError(f"No .xlsx file found in {workspace_root}")
    candidates.sort(key=lambda item: item.stat().st_mtime, reverse=True)
    return candidates[0]


def header_score(row_values: list[str]) -> int:
    score = 0
    joined = " ".join(normalize_header(value) for value in row_values)
    for synonyms in FIELD_SYNONYMS.values():
        if any(normalize_header(term) in joined for term in synonyms):
            score += 1
    return score


def detect_header_row(raw_df: pd.DataFrame) -> int:
    best_index = 0
    best_score = -1
    for idx in range(min(30, len(raw_df))):
        row = [clean_text(value) for value in raw_df.iloc[idx].tolist()]
        score = header_score(row)
        if score > best_score:
            best_index = idx
            best_score = score
    return best_index


def map_columns(headers: list[str]) -> dict[str, int]:
    mapping: dict[str, int] = {}
    for index, header in enumerate(headers):
        if is_excluded_header(header):
            continue
        normalized = normalize_header(header)
        for field, synonyms in FIELD_SYNONYMS.items():
            if field in mapping:
                continue
            if any(normalize_header(term) in normalized for term in synonyms):
                mapping[field] = index
    return mapping


def get_cell(row: pd.Series, mapping: dict[str, int], field: str) -> str:
    index = mapping.get(field)
    if index is None:
        return ""
    return clean_text(row.iloc[index])


def normalize_year(value: str) -> str:
    match = re.search(r"(19|20)\d{2}", value)
    return match.group(0) if match else clean_text(value)


def normalize_doi(value: str) -> str:
    doi = clean_text(value)
    doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", doi, flags=re.I)
    doi = re.sub(r"^doi:\s*", "", doi, flags=re.I)
    return doi.strip()


def split_keywords(value: str) -> list[str]:
    if not value:
        return []
    pieces = re.split(r"[;；,，、\n|]+", value)
    keywords = []
    for piece in pieces:
        keyword = clean_text(piece)
        if keyword and keyword not in keywords:
            keywords.append(keyword)
    return keywords[:8]


def infer_keywords(title: str, journal: str, abstract: str) -> list[str]:
    text = f"{title} {journal} {abstract}".lower()
    keywords: list[str] = []
    for triggers, terms in KEYWORD_RULES:
        if any(trigger.lower() in text for trigger in triggers):
            for term in terms:
                if term not in keywords:
                    keywords.append(term)
                if len(keywords) >= 5:
                    return keywords

    for keyword in FALLBACK_KEYWORDS:
        if keyword not in keywords:
            keywords.append(keyword)
        if len(keywords) >= 3:
            break
    return keywords[:5]


def parse_role(role_text: str) -> str:
    role = clean_text(role_text)
    if not role:
        return ""

    first_checked = bool(re.search(r"[√✓☑]\s*第一作者", role))
    corresponding_checked = bool(re.search(r"[√✓☑]\s*通讯作者", role))
    roles = []
    if first_checked:
        roles.append("第一作者")
    if corresponding_checked:
        roles.append("通讯作者")

    if roles:
        return "；".join(roles)

    role = re.sub(r"[□√✓☑]", "", role)
    role = re.sub(r"\s+", " ", role).strip()
    return role


def normalize_pubmed(value: str) -> str:
    pubmed = clean_text(value)
    if not pubmed:
        return ""
    match = re.search(r"(?:pubmed\.ncbi\.nlm\.nih\.gov/)?(\d{6,10})", pubmed, flags=re.I)
    return match.group(1) if match else pubmed


def make_papers(input_path: Path) -> tuple[list[dict[str, Any]], dict[str, str]]:
    workbook = pd.ExcelFile(input_path)
    selected_sheet = workbook.sheet_names[0]
    raw_df = pd.read_excel(input_path, sheet_name=selected_sheet, header=None, dtype=str).fillna("")

    header_index = detect_header_row(raw_df)
    headers = [clean_text(value) for value in raw_df.iloc[header_index].tolist()]
    mapping = map_columns(headers)

    if "title" not in mapping:
        raise ValueError("Could not identify the title column in the Excel workbook.")

    rows = raw_df.iloc[header_index + 1 :].reset_index(drop=True)
    papers: list[dict[str, Any]] = []

    for _, row in rows.iterrows():
        title = get_cell(row, mapping, "title")
        if not title:
            continue

        journal = get_cell(row, mapping, "journal")
        abstract = get_cell(row, mapping, "abstract")
        doi = normalize_doi(get_cell(row, mapping, "doi"))
        full_text_url = get_cell(row, mapping, "fullTextUrl")
        if doi and not full_text_url:
            full_text_url = f"https://doi.org/{doi}"

        keywords = split_keywords(get_cell(row, mapping, "keywords"))
        if not keywords:
            keywords = infer_keywords(title, journal, abstract)

        pubmed = normalize_pubmed(get_cell(row, mapping, "pubmed"))
        paper = {
            "id": f"paper_{len(papers) + 1:03d}",
            "title": title,
            "authors": get_cell(row, mapping, "authors"),
            "year": normalize_year(get_cell(row, mapping, "year")),
            "journal": journal,
            "keywords": keywords,
            "abstract": abstract,
            "doi": doi,
            "doiUrl": f"https://doi.org/{doi}" if doi else "",
            "pubmed": pubmed,
            "pubmedUrl": f"https://pubmed.ncbi.nlm.nih.gov/{pubmed}/" if re.fullmatch(r"\d{6,10}", pubmed or "") else "",
            "fullTextUrl": full_text_url,
            "role": parse_role(get_cell(row, mapping, "role")),
            "note": get_cell(row, mapping, "note"),
        }
        papers.append(paper)

    field_mapping = {
        field: headers[index]
        for field, index in mapping.items()
        if field in {"title", "authors", "year", "journal", "abstract", "keywords", "doi", "pubmed", "fullTextUrl", "role", "note"}
    }
    return papers, field_mapping


def write_outputs(papers: list[dict[str, Any]], json_path: Path, js_path: Path) -> None:
    payload = {
        "generatedAt": date.today().isoformat(),
        "papers": papers,
    }
    json_path.parent.mkdir(parents=True, exist_ok=True)
    js_path.parent.mkdir(parents=True, exist_ok=True)

    json_text = json.dumps(payload, ensure_ascii=False, indent=2)
    json_path.write_text(json_text + "\n", encoding="utf-8")
    js_path.write_text("window.PAPERS_DATA = " + json_text + ";\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert literature Excel data to static JSON.")
    project_root = Path(__file__).resolve().parents[1]
    default_input = find_excel_file(project_root)
    parser.add_argument("--input", type=Path, default=default_input, help="Path to the Excel workbook.")
    parser.add_argument("--output", type=Path, default=project_root / "data" / "papers.json", help="Output JSON path.")
    parser.add_argument("--js-output", type=Path, default=project_root / "data" / "papers.js", help="Output JS fallback path.")
    args = parser.parse_args()

    papers, field_mapping = make_papers(args.input)
    write_outputs(papers, args.output, args.js_output)

    print(f"Input: {args.input}")
    print(f"Records: {len(papers)}")
    print("Field mapping:")
    for field, header in field_mapping.items():
        print(f"  {field}: {header}")
    print(f"Wrote: {args.output}")
    print(f"Wrote: {args.js_output}")


if __name__ == "__main__":
    main()
