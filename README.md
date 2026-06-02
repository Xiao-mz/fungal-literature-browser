# 团队已发表文献快速查阅网页

这是一个纯静态文献检索页面，用于把 Excel 论文自查表转换为可公开浏览的团队文献索引。项目不依赖后端、数据库、账号密码或付费服务，可以直接部署到 GitHub Pages、Gitee Pages、Netlify 或 Vercel。

## 项目结构

```text
literature-browser/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
├── data/
│   ├── papers.json
│   ├── papers.js
│   ├── enrichment_log.csv
│   ├── enrichment_review_needed.csv
│   ├── manual_completion_template.csv
│   ├── manual_completion_log.csv
│   ├── unmatched_papers.md
│   └── public_safety_check_report.txt
├── scripts/
│   ├── excel_to_json.py
│   ├── enrich_papers.py
│   ├── generate_manual_completion_template.py
│   ├── apply_manual_completion.py
│   └── public_safety_check.py
└── README.md
```

## 已识别的 Excel 字段

当前 Excel 表格识别到以下公开字段：

- 论文标题 -> `title`
- 发表杂志 -> `journal`
- 发表时间 -> `year`
- 所有作者 -> `authors`
- 本人角色 -> `role`

表格中的“是否存在科研诚信问题”等内部自查字段没有写入公开数据文件。

## 数据结构

`data/papers.json` 中每篇文献使用以下字段：

```json
{
  "id": "paper_001",
  "title": "",
  "authors": "",
  "year": "",
  "journal": "",
  "keywords": [],
  "abstract": "",
  "doi": "",
  "doiUrl": "",
  "pubmed": "",
  "pubmedUrl": "",
  "fullTextUrl": "",
  "role": "",
  "note": ""
}
```

`data/papers.js` 与 `papers.json` 内容一致，用于在浏览器限制本地 JSON 读取时作为备用数据源。

## 从 Excel 重新生成文献数据

在当前工作目录中保留 Excel 文件，例如：

```text
个人论文自查表-wwj-2.xlsx
```

运行：

```bash
cd literature-browser
python scripts/excel_to_json.py
```

脚本会自动查找上一级目录中的 `.xlsx` 文件，并重新生成：

- `data/papers.json`
- `data/papers.js`

如果要指定 Excel 文件：

```bash
python scripts/excel_to_json.py --input "../个人论文自查表-wwj-2.xlsx"
```

如果本机 Python 提示缺少依赖，请先安装：

```bash
pip install pandas openpyxl
```

## 自动补全 DOI、PubMed 和摘要

运行：

```bash
cd literature-browser
python scripts/enrich_papers.py
```

脚本会根据论文标题调用公开 API：

- PubMed E-utilities
- Crossref Works API

匹配规则：

- 仅根据论文标题计算相似度
- 默认相似度 `>= 0.85` 才自动写入 DOI、PubMed、摘要和链接
- 相似度在 `0.65-0.85` 之间的候选项会写入 `data/enrichment_review_needed.csv` 供人工核对
- 每次运行会写入 `data/enrichment_log.csv`，记录 DOI、PubMed、摘要是否补全、匹配来源和分数

常用参数：

```bash
# 只测试前 5 篇
python scripts/enrich_papers.py --limit 5

# 调整严格匹配阈值
python scripts/enrich_papers.py --threshold 0.9

# 只规范化字段结构，不联网请求 API
python scripts/enrich_papers.py --skip-network

# 建议提供邮箱，便于公开 API 识别用途
python scripts/enrich_papers.py --email your-email@example.com
```

## 人工补充信息

生成待人工补充表和 Markdown 清单：

```bash
cd literature-browser
python scripts/generate_manual_completion_template.py
```

输出文件：

- `data/manual_completion_template.csv`
- `data/unmatched_papers.md`

`manual_completion_template.csv` 可直接用 Excel 打开。请只填写以下人工字段：

- `manual_doi`
- `manual_pubmed`
- `manual_abstract`
- `manual_fullTextUrl`
- `manual_keywords`
- `note`

其中 `manual_keywords` 可用中文逗号、英文逗号、分号或顿号分隔。`current_*` 字段仅用于参考，不建议修改。

将人工填写内容写回正式数据：

```bash
python scripts/apply_manual_completion.py
```

脚本会更新：

- `data/papers.json`
- `data/papers.js`
- `data/manual_completion_log.csv`

填写 DOI 后会自动生成 `doiUrl`；填写 PubMed ID 后会自动生成 `pubmedUrl`；填写关键词后会与原关键词合并并去重。

## 公开安全检查

部署前运行：

```bash
cd literature-browser
python scripts/public_safety_check.py
```

脚本会检查 `data/papers.json` 和 `data/papers.js` 是否包含明显不适合公开展示的信息，包括科研诚信、自查、身份证、手机号、邮箱、内部备注，以及手机号、邮箱、身份证号正则模式。结果写入：

```text
data/public_safety_check_report.txt
```

## 本地使用

可以直接双击打开：

```text
index.html
```

页面会优先读取 `data/papers.json`。如果浏览器因本地文件安全限制无法读取 JSON，会自动使用 `data/papers.js` 作为备用数据源。

也可以用静态服务打开：

```bash
cd literature-browser
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000
```

## 页面功能

- 关键词标签分类，并显示每个关键词对应文献数量
- 按标题、作者、年份、期刊、关键词、摘要模糊搜索
- 按年份筛选
- 按补全状态筛选：全部、有摘要、有 DOI、有 PubMed、无外部链接
- 按年份从新到旧或从旧到新排序
- 文献卡片展示标题、年份、期刊、作者、本人角色、关键词和摘要
- 没有摘要的文献会根据是否存在外部链接显示对应提示
- DOI、PubMed 和 Full Text 外部链接仅在有链接时显示，并在新窗口打开
- 顶部显示总文献数、有摘要、有 DOI、有 PubMed、有全文链接、待人工补充的完整度统计
- 页面底部显示 `Last updated: 当前日期`

## 部署到 GitHub Pages

部署前建议检查：

1. 运行 `python scripts/enrich_papers.py`，尽可能补全公开元数据。
2. 运行 `python scripts/generate_manual_completion_template.py`，确认是否还有需要人工补充的文献。
3. 如已人工填写 `manual_completion_template.csv`，运行 `python scripts/apply_manual_completion.py`。
4. 运行 `python scripts/public_safety_check.py`，确认报告显示未发现明显不适合公开的信息。
5. 本地启动 `python -m http.server 8000`，检查搜索、关键词、年份、补全状态筛选和摘要展开。
6. 确认 `data/papers.json` 与 `data/papers.js` 同步。

推荐做法：

1. 新建一个 GitHub 仓库。
2. 将 `literature-browser/` 目录中的所有文件放到仓库根目录。
3. 提交并推送到 `main` 分支。
4. 在仓库设置中进入 `Pages`。
5. Source 选择 `Deploy from a branch`。
6. Branch 选择 `main` 和 `/ (root)`。
7. 保存后等待 GitHub Pages 生成访问链接。

也可以把 `literature-browser/` 文件夹直接部署到 Gitee Pages、Netlify 或 Vercel。
