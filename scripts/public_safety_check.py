#!/usr/bin/env python
"""Check public data files for obvious sensitive words and identifier patterns."""

from __future__ import annotations

import argparse
import re
from datetime import datetime
from pathlib import Path


SENSITIVE_WORDS = [
    "科研诚信",
    "自查",
    "身份证",
    "手机号",
    "邮箱",
    "内部备注",
    "是否存在科研诚信问题",
]

PATTERNS = {
    "手机号正则": re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)"),
    "邮箱正则": re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
    # Avoid false positives inside DOI/PII strings such as S092485792300345X.
    "身份证号正则": re.compile(r"(?<![A-Za-z0-9])(?:\d{17}[\dXx]|\d{15})(?![A-Za-z0-9])"),
}


def scan_file(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    hits = []
    for word in SENSITIVE_WORDS:
        if word in text:
            hits.append(f"{path.name}: 敏感词命中：{word}")
    for name, pattern in PATTERNS.items():
        matches = pattern.findall(text)
        if matches:
            preview = ", ".join(matches[:5])
            hits.append(f"{path.name}: {name} 命中 {len(matches)} 处：{preview}")
    return hits


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Check public data files before deployment.")
    parser.add_argument("--json", type=Path, default=project_root / "data" / "papers.json")
    parser.add_argument("--js", type=Path, default=project_root / "data" / "papers.js")
    parser.add_argument("--report", type=Path, default=project_root / "data" / "public_safety_check_report.txt")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    hits = []
    for path in (args.json, args.js):
        hits.extend(scan_file(path))

    lines = [
        "公开安全检查报告",
        f"生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"检查文件：{args.json.name}, {args.js.name}",
        "",
    ]
    if hits:
        lines.append("发现以下疑似不适合公开的信息：")
        lines.extend(f"- {hit}" for hit in hits)
    else:
        lines.append("未发现明显不适合公开的信息。")

    args.report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
