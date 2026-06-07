(function () {
  const PUBMED_KEYWORD_MAP = {
    真菌感染: "fungal infection",
    病原真菌: "pathogenic fungi",
    病原微生物: "pathogenic microorganism",
    感染性疾病: "infectious disease",
    感染性发热: "febrile illness",
    抗真菌耐药: "antifungal resistance",
    耐药性: "drug resistance",
    念珠菌: "Candida",
    耳念珠菌: "Candida auris",
    曲霉: "Aspergillus",
    烟曲霉: "Aspergillus fumigatus",
    侵袭性真菌病: "invasive fungal disease",
    血流感染: "bloodstream infection",
    分子诊断: "molecular diagnosis",
    临床检验: "clinical laboratory testing",
    临床微生物: "clinical microbiology",
    基因测序: "gene sequencing",
    宏基因组测序: "metagenomic sequencing",
    病原宏基因组测序: "metagenomic next-generation sequencing",
    药敏试验: "antifungal susceptibility testing",
    流行病学: "epidemiology",
    肺炎克雷伯菌: "Klebsiella pneumoniae",
    碳青霉烯耐药: "carbapenem resistance",
    新型冠状病毒: "SARS-CoV-2",
    新冠肺炎: "COVID-19",
    微生物组: "microbiome",
    肿瘤微环境: "tumor microenvironment",
    多组学: "multi-omics",
    脓毒症: "sepsis",
    数字PCR: "digital PCR",
    结核分枝杆菌: "Mycobacterium tuberculosis",
    病例报道: "case report",
  };

  const BROAD_PUBMED_KEYWORDS = new Set([
    "研究",
    "分析",
    "检测",
    "临床",
    "文章",
    "文献",
    "综述",
    "进展",
    "其他",
    "study",
    "analysis",
    "detection",
    "clinical",
    "article",
    "literature",
    "review",
    "progress",
    "other",
  ]);

  const DEBUG_SIMILAR_PUBMED = false;

  const TITLE_STOP_WORDS = new Set([
    "a",
    "an",
    "the",
    "of",
    "in",
    "on",
    "at",
    "to",
    "for",
    "from",
    "with",
    "without",
    "by",
    "and",
    "or",
    "but",
    "as",
    "among",
    "between",
    "during",
    "through",
    "using",
    "based",
    "via",
    "into",
    "after",
    "before",
    "two",
    "three",
    "multiple",
    "novel",
    "new",
    "high",
    "low",
    "high-quality",
    "quality",
    "clinical",
    "different",
    "comparative",
    "potential",
    "possible",
    "important",
    "significant",
    "major",
    "rapid",
    "recent",
    "current",
    "first",
    "preliminary",
    "retrospective",
    "prospective",
    "multicenter",
    "systematic",
    "comprehensive",
  ]);

  const TITLE_GENERIC_TERMS = new Set([
    "study",
    "analysis",
    "evaluation",
    "assessment",
    "investigation",
    "characterization",
    "comparison",
    "report",
    "review",
    "progress",
    "overview",
    "research",
    "result",
    "results",
    "case",
    "cases",
    "article",
    "paper",
    "approach",
    "method",
    "methods",
    "role",
    "effect",
    "effects",
    "relationship",
    "association",
    "status",
    "current status",
    "机制",
    "研究",
    "进展",
    "分析",
    "检测",
    "临床",
    "分离",
  ]);

  const TITLE_CONCEPT_MAP = {
    烟曲霉: "Aspergillus fumigatus",
    曲霉: "Aspergillus",
    念珠菌: "Candida",
    白念珠菌: "Candida albicans",
    耳念珠菌: "Candida auris",
    热带念珠菌: "Candida tropicalis",
    肺炎克雷伯菌: "Klebsiella pneumoniae",
    结核分枝杆菌: "Mycobacterium tuberculosis",
    金黄色葡萄球菌: "Staphylococcus aureus",
    无乳链球菌: "Streptococcus agalactiae",
    新型冠状病毒: "SARS-CoV-2",
    新冠肺炎: "COVID-19",
    人乳头瘤病毒: "human papillomavirus",
    真菌感染: "fungal infection",
    侵袭性真菌病: "invasive fungal disease",
    侵袭性曲霉病: "invasive aspergillosis",
    侵袭性念珠菌病: "invasive candidiasis",
    血流感染: "bloodstream infection",
    尿路感染: "urinary tract infection",
    心内膜炎: "infective endocarditis",
    感染性疾病: "infectious disease",
    感染性发热: "febrile illness",
    耐药性: "drug resistance",
    耐药: "drug resistance",
    抗真菌耐药: "antifungal resistance",
    唑类耐药: "azole resistance",
    碳青霉烯耐药: "carbapenem resistance",
    药敏试验: "antifungal susceptibility testing",
    全基因组测序: "whole-genome sequencing",
    高通量测序: "high-throughput sequencing",
    宏基因组测序: "metagenomic sequencing",
    宏基因组下一代测序: "metagenomic next-generation sequencing",
    病原宏基因组测序: "metagenomic next-generation sequencing",
    微生物游离DNA: "microbial cell-free DNA",
    微生物组: "microbiome",
    肠道微生物群: "gut microbiota",
    多组学: "multi-omics",
    转录组: "transcriptome",
    蛋白质组: "proteomics",
    代谢组: "metabolomics",
    分子诊断: "molecular diagnosis",
    流行病学: "epidemiology",
    毒力基因: "virulence gene",
    毒力: "virulence",
    生物膜: "biofilm",
    突变: "mutation",
    基因组: "genome",
    质谱: "mass spectrometry",
    基质辅助激光解吸电离飞行时间质谱: "MALDI-TOF MS",
    数字PCR: "digital PCR",
    脓毒症: "sepsis",
    抗生素: "antibiotic",
    监测: "surveillance",
  };

  const TITLE_PHRASE_TERMS = [
    ["metagenomic next-generation sequencing", "metagenomic next-generation sequencing", 75, "technique"],
    ["metagenomics next-generation sequencing", "metagenomic next-generation sequencing", 75, "technique"],
    ["metagenomic sequencing", "metagenomic sequencing", 75, "technique"],
    ["whole-genome sequencing", "whole-genome sequencing", 75, "technique"],
    ["whole genome sequencing", "whole-genome sequencing", 75, "technique"],
    ["microbial cell-free dna sequencing", "microbial cell-free DNA sequencing", 75, "technique"],
    ["cell-free dna sequencing", "cell-free DNA sequencing", 75, "technique"],
    ["maldi-tof ms", "MALDI-TOF MS", 75, "technique"],
    ["mass spectrometry", "mass spectrometry", 75, "technique"],
    ["digital pcr", "digital PCR", 75, "technique"],
    ["droplet digital pcr", "droplet digital PCR", 75, "technique"],
    ["rt-pcr", "RT-PCR", 75, "technique"],
    ["antifungal susceptibility testing", "antifungal susceptibility testing", 75, "technique"],
    ["lateral flow assay", "lateral flow assay", 75, "technique"],
    ["molecular diagnosis", "molecular diagnosis", 75, "technique"],
    ["genome sequences", "genome", 75, "technique"],
    ["genome sequence", "genome", 75, "technique"],
    ["whole genomes", "whole genome", 75, "technique"],
    ["genomes", "genome", 75, "technique"],
    ["genome", "genome", 75, "technique"],
    ["bloodstream infection", "bloodstream infection", 85, "disease"],
    ["invasive aspergillosis", "invasive aspergillosis", 85, "disease"],
    ["invasive candidiasis", "invasive candidiasis", 85, "disease"],
    ["fungal infection", "fungal infection", 85, "disease"],
    ["urinary tract infection", "urinary tract infection", 85, "disease"],
    ["infective endocarditis", "infective endocarditis", 85, "disease"],
    ["human papillomavirus infection", "human papillomavirus infection", 85, "disease"],
    ["cervical lesion", "cervical lesion", 85, "disease"],
    ["cervical disease", "cervical disease", 85, "disease"],
    ["drug resistance", "drug resistance", 85, "disease"],
    ["antifungal resistance", "antifungal resistance", 85, "disease"],
    ["antifungal-resistant", "antifungal resistance", 85, "disease"],
    ["azole resistance", "azole resistance", 85, "disease"],
    ["carbapenem resistance", "carbapenem resistance", 85, "disease"],
    ["candida auris", "Candida auris", 100, "species"],
    ["candida albicans", "Candida albicans", 100, "species"],
    ["candida tropicalis", "Candida tropicalis", 100, "species"],
    ["candida parapsilosis", "Candida parapsilosis", 100, "species"],
    ["aspergillus fumigatus", "Aspergillus fumigatus", 100, "species"],
    ["klebsiella pneumoniae", "Klebsiella pneumoniae", 100, "species"],
    ["mycobacterium tuberculosis", "Mycobacterium tuberculosis", 100, "species"],
    ["staphylococcus aureus", "Staphylococcus aureus", 100, "species"],
    ["streptococcus agalactiae", "Streptococcus agalactiae", 100, "species"],
    ["sars-cov-2", "SARS-CoV-2", 95, "pathogen"],
    ["covid-19", "COVID-19", 95, "pathogen"],
    ["microbiome", "microbiome", 65, "topic"],
    ["microbiota", "microbiota", 65, "topic"],
    ["multi-omics", "multi-omics", 65, "topic"],
    ["transcriptomics", "transcriptomics", 65, "topic"],
    ["proteomics", "proteomics", 65, "topic"],
    ["metabolomics", "metabolomics", 65, "topic"],
    ["epidemiology", "epidemiology", 65, "topic"],
    ["surveillance", "surveillance", 65, "topic"],
    ["virulence gene", "virulence gene", 65, "topic"],
    ["virulence", "virulence", 65, "topic"],
    ["biofilm", "biofilm", 65, "topic"],
    ["diagnosis", "diagnosis", 65, "topic"],
    ["sepsis", "sepsis", 85, "disease"],
    ["resistance", "resistance", 65, "topic"],
    ["mutation", "mutation", 65, "topic"],
    ["mutations", "mutation", 65, "topic"],
    ["susceptibility", "susceptibility", 65, "topic"],
    ["prevalence", "prevalence", 65, "topic"],
    ["expression", "expression", 65, "topic"],
    ["distribution", "distribution", 65, "topic"],
  ];

  const TITLE_DRUG_TERMS = [
    "voriconazole",
    "itraconazole",
    "posaconazole",
    "isavuconazole",
    "fluconazole",
    "amphotericin B",
    "echinocandin",
    "anidulafungin",
    "caspofungin",
    "rezafungin",
    "azole",
    "carbapenem",
    "antibiotic",
  ];

  const TITLE_PATHOGEN_GENERA = new Set([
    "Aspergillus",
    "Candida",
    "Cryptococcus",
    "Klebsiella",
    "Mycobacterium",
    "Prototheca",
    "Staphylococcus",
    "Streptococcus",
  ]);

  const INVALID_LATIN_SPECIES_WORDS = new Set([
    "assay",
    "complex",
    "detection",
    "galactomannan",
    "genome",
    "genomes",
    "group",
    "infection",
    "infections",
    "isolate",
    "isolates",
    "resistance",
    "species",
    "susceptibility",
  ]);

  const state = {
    papers: [],
    generatedAt: "",
    activeKeyword: "",
    query: "",
    year: "all",
    status: "all",
    sort: "year-desc",
    expanded: new Set(),
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    bindEvents();

    try {
      const payload = await loadPaperData();
      const basePapers = Array.isArray(payload) ? payload : payload.papers || [];
      state.papers = normalizePapers(basePapers);
      state.generatedAt = payload.generatedAt || "";
      setupYearFilter();
      render();
    } catch (error) {
      showLoadError(error);
    }
  }

  function cacheElements() {
    els.statTotal = document.getElementById("statTotal");
    els.statReview = document.getElementById("statReview");
    els.statResearch = document.getElementById("statResearch");
    els.searchInput = document.getElementById("searchInput");
    els.yearFilter = document.getElementById("yearFilter");
    els.statusFilter = document.getElementById("statusFilter");
    els.sortSelect = document.getElementById("sortSelect");
    els.keywordList = document.getElementById("keywordList");
    els.clearKeyword = document.getElementById("clearKeyword");
    els.resultTitle = document.getElementById("resultTitle");
    els.resultMeta = document.getElementById("resultMeta");
    els.paperList = document.getElementById("paperList");
    els.emptyState = document.getElementById("emptyState");
    els.lastUpdated = document.getElementById("lastUpdated");
    els.submissionFormLink = document.getElementById("submissionFormLink");
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
      renderResults();
    });

    els.yearFilter.addEventListener("change", (event) => {
      state.year = event.target.value;
      renderResults();
    });

    els.statusFilter.addEventListener("change", (event) => {
      state.status = event.target.value;
      renderResults();
    });

    els.sortSelect.addEventListener("change", (event) => {
      state.sort = event.target.value;
      renderResults();
    });

    els.clearKeyword.addEventListener("click", () => {
      state.activeKeyword = "";
      renderKeywords();
      renderResults();
    });

    setupSubmissionLink();
  }

  function setupSubmissionLink() {
    if (!els.submissionFormLink) return;
    const config = window.LITERATURE_BROWSER_CONFIG || {};
    const url = String(config.submissionFormUrl || "").trim();
    const isConfigured = url && url !== "REPLACE_WITH_GOOGLE_FORM_URL" && /^https?:\/\//i.test(url);

    if (isConfigured) {
      els.submissionFormLink.href = url;
      els.submissionFormLink.setAttribute("aria-disabled", "false");
      return;
    }

    els.submissionFormLink.href = "#";
    els.submissionFormLink.setAttribute("aria-disabled", "true");
    els.submissionFormLink.addEventListener("click", (event) => {
      event.preventDefault();
      window.alert("投稿表单尚未配置，请联系平台管理员。");
    });
  }

  async function loadPaperData() {
    try {
      const response = await fetch("data/papers.json", { cache: "no-store" });
      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      // Local file access often blocks fetch; papers.js provides a static fallback.
    }

    if (window.PAPERS_DATA) {
      return window.PAPERS_DATA;
    }
    throw new Error("无法读取 data/papers.json。");
  }

  function normalizePapers(papers) {
    return papers.map((paper) => ({
      id: paper.id || "",
      title: paper.title || "",
      authors: paper.authors || "",
      year: paper.year || "",
      journal: paper.journal || "",
      keywords: Array.isArray(paper.keywords) ? paper.keywords : splitKeywords(paper.keywords || ""),
      abstract: paper.abstract || "",
      doi: cleanDoi(paper.doi || ""),
      doiUrl: normalizeUrl(paper.doiUrl) || makeDoiUrl(paper.doi),
      pubmed: cleanPubMed(paper.pubmed || ""),
      pubmedUrl: normalizeUrl(paper.pubmedUrl) || makePubMedUrl(paper.pubmed),
      fullTextUrl: normalizeUrl(paper.fullTextUrl) || normalizeUrl(paper.doiUrl) || makeDoiUrl(paper.doi),
      role: paper.role || "",
      note: paper.note || "",
      articleType: paper.articleType || "",
      type: paper.type || "",
      category: paper.category || "",
      paperType: paper.paperType || "",
      publicationType: paper.publicationType || "",
    }));
  }

  function setupYearFilter() {
    const years = getYears(state.papers).sort((a, b) => b.localeCompare(a));
    const selectedYear = state.year;
    els.yearFilter.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "全部年份";
    els.yearFilter.appendChild(allOption);

    years.forEach((year) => {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      els.yearFilter.appendChild(option);
    });

    state.year = selectedYear === "all" || years.includes(selectedYear) ? selectedYear : "all";
    els.yearFilter.value = state.year;
  }

  function render() {
    renderStats();
    renderKeywords();
    renderResults();
    els.lastUpdated.textContent = new Date().toISOString().slice(0, 10);
  }

  function renderStats() {
    const typeCounts = state.papers.reduce(
      (counts, paper) => {
        const type = inferPaperType(paper);
        if (type === "review") counts.review += 1;
        if (type === "research") counts.research += 1;
        return counts;
      },
      { review: 0, research: 0 }
    );

    els.statTotal.textContent = state.papers.length;
    els.statReview.textContent = typeCounts.review;
    els.statResearch.textContent = typeCounts.research;
  }

  function renderKeywords() {
    els.keywordList.replaceChildren();
    const counts = Array.from(getKeywordCounts(state.papers).entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], "zh-CN");
    });

    counts.forEach(([keyword, count]) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "keyword-chip";
      if (state.activeKeyword === keyword) {
        chip.classList.add("is-active");
      }
      chip.setAttribute("aria-pressed", String(state.activeKeyword === keyword));

      const label = document.createElement("span");
      label.textContent = keyword;
      const number = document.createElement("strong");
      number.textContent = count;
      chip.append(label, number);

      chip.addEventListener("click", () => {
        state.activeKeyword = state.activeKeyword === keyword ? "" : keyword;
        renderKeywords();
        renderResults();
      });

      els.keywordList.appendChild(chip);
    });
  }

  function renderResults() {
    const papers = getFilteredPapers();
    els.paperList.replaceChildren();
    els.emptyState.hidden = papers.length !== 0;

    const keywordText = state.activeKeyword ? `“${state.activeKeyword}”` : "全部文献";
    els.resultTitle.textContent = keywordText;
    els.resultMeta.textContent = `共 ${papers.length} 篇，${getStatusLabel(state.status)}，按${state.sort === "year-desc" ? "年份从新到旧" : "年份从旧到新"}排列`;

    papers.forEach((paper) => {
      els.paperList.appendChild(createPaperCard(paper));
    });
  }

  function createPaperCard(paper) {
    const card = document.createElement("article");
    card.className = "paper-card";
    card.dataset.paperId = paper.id;

    const titleButton = document.createElement("button");
    titleButton.type = "button";
    titleButton.className = "paper-title";
    titleButton.textContent = paper.title || "未命名论文";
    titleButton.setAttribute("aria-expanded", String(state.expanded.has(paper.id)));
    titleButton.addEventListener("click", (event) => toggleAbstract(paper.id, event));

    const meta = document.createElement("div");
    meta.className = "paper-meta";
    appendMeta(meta, "年份", paper.year);
    appendMeta(meta, "期刊", paper.journal);
    if (paper.role) {
      const role = document.createElement("span");
      role.className = "role-badge";
      role.textContent = paper.role;
      meta.appendChild(role);
    }

    const authors = document.createElement("p");
    authors.className = "authors";
    authors.textContent = paper.authors || "作者信息暂无";

    const keywordRow = document.createElement("div");
    keywordRow.className = "keyword-row";
    paper.keywords.forEach((keyword) => {
      const tag = document.createElement("span");
      tag.className = "paper-keyword";
      tag.textContent = keyword;
      keywordRow.appendChild(tag);
    });

    const preview = document.createElement("p");
    preview.className = "abstract-preview";
    preview.textContent = paper.abstract ? truncate(paper.abstract, 180) : "暂无摘要";

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "action-button";
    toggleButton.textContent = state.expanded.has(paper.id) ? "收起摘要" : "查看摘要";
    toggleButton.addEventListener("click", (event) => toggleAbstract(paper.id, event));
    actions.appendChild(toggleButton);

    addLinkButton(actions, "DOI", paper.doiUrl);
    addLinkButton(actions, "PubMed", paper.pubmedUrl);
    addLinkButton(actions, "Full Text", paper.fullTextUrl);
    addLinkButton(actions, "查看相似SCI文献", buildSimilarPubmedUrl(paper), {
      className: "similar-papers-button",
      title: "根据该文献关键词组合检索 PubMed 相似主题文献",
    });

    card.append(titleButton, meta, authors, keywordRow, preview, actions);

    if (state.expanded.has(paper.id) && paper.abstract) {
      const full = document.createElement("p");
      full.className = "abstract-full";
      full.textContent = paper.abstract;
      card.appendChild(full);
    }

    return card;
  }

  function appendMeta(container, label, value) {
    if (!value) return;
    const item = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    item.append(strong, document.createTextNode(value));
    container.appendChild(item);
  }

  function addLinkButton(container, label, href, options = {}) {
    if (!href) return;
    const link = document.createElement("a");
    link.className = options.className ? `link-button ${options.className}` : "link-button";
    link.href = href;
    link.textContent = label;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    if (options.title) {
      link.title = options.title;
    }
    container.appendChild(link);
  }

  function toggleAbstract(id, event) {
    event?.preventDefault();
    const currentCard = event?.currentTarget?.closest(".paper-card");
    const beforeTop = currentCard ? currentCard.getBoundingClientRect().top : null;
    const previousScrollY = window.scrollY;

    if (state.expanded.has(id)) {
      state.expanded.delete(id);
    } else {
      state.expanded.add(id);
    }
    renderResults();

    window.requestAnimationFrame(() => {
      const nextCard = els.paperList.querySelector(`[data-paper-id="${id}"]`);
      if (!nextCard || beforeTop === null) {
        window.scrollTo({ top: previousScrollY, behavior: "auto" });
        return;
      }

      const afterTop = nextCard.getBoundingClientRect().top;
      window.scrollBy({ top: afterTop - beforeTop, left: 0, behavior: "auto" });
    });
  }

  function getFilteredPapers() {
    const query = state.query;
    return state.papers
      .filter((paper) => {
        const keywordMatch = !state.activeKeyword || paper.keywords.includes(state.activeKeyword);
        const yearMatch = state.year === "all" || paper.year === state.year;
        const statusMatch = matchesStatus(paper, state.status);
        const queryMatch = !query || getSearchText(paper).includes(query);
        return keywordMatch && yearMatch && statusMatch && queryMatch;
      })
      .sort((a, b) => {
        const yearA = Number.parseInt(a.year, 10) || 0;
        const yearB = Number.parseInt(b.year, 10) || 0;
        if (yearA !== yearB) {
          return state.sort === "year-desc" ? yearB - yearA : yearA - yearB;
        }
        return (a.title || "").localeCompare(b.title || "", "zh-CN");
      });
  }

  function matchesStatus(paper, status) {
    if (status === "has-abstract") return Boolean(paper.abstract);
    if (status === "has-doi") return Boolean(paper.doiUrl || paper.doi);
    if (status === "has-pubmed") return Boolean(paper.pubmedUrl || paper.pubmed);
    if (status === "no-external") return !hasExternalLink(paper);
    return true;
  }

  function isIncompletePaper(paper) {
    return !paper.doi || !paper.pubmed || !paper.abstract || !paper.fullTextUrl;
  }

  function hasExternalLink(paper) {
    return Boolean(paper.doiUrl || paper.pubmedUrl || paper.fullTextUrl);
  }

  function getStatusLabel(status) {
    const labels = {
      all: "全部",
      "has-abstract": "有摘要",
      "has-doi": "有 DOI",
      "has-pubmed": "有 PubMed",
      "no-external": "无外部链接",
    };
    return labels[status] || "全部";
  }

  function inferPaperType(paper) {
    if (["review", "research", "case", "other"].includes(paper.paperType)) {
      return paper.paperType;
    }

    const explicitType = [
      paper.articleType,
      paper.type,
      paper.category,
      paper.paperType,
      paper.publicationType,
      paper.note,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (/review|guideline|consensus|overview|perspective|综述|指南|共识|专家共识/.test(explicitType)) {
      return "review";
    }
    if (/case|病例|个案/.test(explicitType)) {
      return "case";
    }
    if (/research|article|study|研究|论著/.test(explicitType)) {
      return "research";
    }

    const text = [
      paper.title,
      paper.journal,
      paper.keywords.join(" "),
      paper.abstract,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    // 当前数据没有明确文章类型字段，因此优先用题名、关键词和摘要中的类型词做轻量推断。
    if (/综述|进展|现状|研究进展|专家共识|共识|指南|规范|路径|未来|探索|review|progress|advances|guideline|consensus|perspective|overview/.test(text)) {
      return "review";
    }
    if (/病例|个案|case report|case/.test(text)) {
      return "case";
    }
    if (/分析|研究|监测|评价|建立|应用|检测|比较|分布|相关性|耐药性|表达|功能|analysis|study|surveillance|evaluation|detection|comparison|distribution|association|resistance|expression|function/.test(text)) {
      return "research";
    }

    // 为了顶部统计简洁可用，暂时把无法明确分类的非综述/非病例文献归入研究文章。
    return "research";
  }

  function getSearchText(paper) {
    return [
      paper.title,
      paper.authors,
      paper.year,
      paper.journal,
      paper.keywords.join(" "),
      paper.abstract,
      paper.doi,
      paper.pubmed,
      paper.role,
      paper.note,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function getKeywordCounts(papers) {
    const counts = new Map();
    papers.forEach((paper) => {
      paper.keywords.forEach((keyword) => {
        counts.set(keyword, (counts.get(keyword) || 0) + 1);
      });
    });
    return counts;
  }

  function getYears(papers) {
    return Array.from(new Set(papers.map((paper) => paper.year).filter(Boolean)));
  }

  function buildSimilarPubmedUrl(paper) {
    const search = buildSimilarPubmedSearch(paper);
    return search.url;
  }

  function buildSimilarPubmedSearch(paper) {
    const candidates = getPubmedTermCandidates(paper);
    const terms = extractPubmedTermsFromTitle(paper, candidates);
    const query = terms.length ? terms.map(formatPubmedTerm).join(" AND ") : "";
    const url = query ? `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}` : "";
    debugSimilarPubmed(paper, candidates, terms, query, url);
    return { candidates, terms, query, url };
  }

  function buildPubmedQueryFromTitle(paper) {
    const terms = extractPubmedTermsFromTitle(paper);
    return terms.length ? terms.map(formatPubmedTerm).join(" AND ") : "";
  }

  function extractPubmedTermsFromTitle(paper, precomputedCandidates) {
    const candidates = precomputedCandidates || getPubmedTermCandidates(paper);
    return selectPubmedTerms(candidates).map((candidate) => candidate.term);
  }

  function getPubmedTermCandidates(paper) {
    const title = normalizeComparableText(paper?.title || "");
    const candidates = [];
    addChineseTitleCandidates(candidates, title);
    addEnglishPhraseCandidates(candidates, title);
    addLatinBinomialCandidates(candidates, title);
    addPathogenGenusCandidates(candidates, title);
    addGeneMutationCandidates(candidates, title);
    addDrugCandidates(candidates, title);

    const titleCandidates = sortCandidates(candidates);
    if (titleCandidates.length < 2) {
      addKeywordSupplementCandidates(candidates, paper?.keywords || [], title);
    }

    return sortCandidates(candidates);
  }

  function addChineseTitleCandidates(candidates, title) {
    const keys = Object.keys(TITLE_CONCEPT_MAP).sort((a, b) => b.length - a.length);
    keys.forEach((key) => {
      const index = title.indexOf(key);
      if (index === -1) return;
      const term = TITLE_CONCEPT_MAP[key];
      const classification = classifyPubmedTerm(term);
      addPubmedCandidate(candidates, {
        term,
        score: classification.score,
        category: classification.category,
        index,
        source: "title-map",
        matched: key,
      });
    });
  }

  function addEnglishPhraseCandidates(candidates, title) {
    const lowerTitle = title.toLowerCase();
    TITLE_PHRASE_TERMS.forEach(([phrase, term, score, category]) => {
      const index = lowerTitle.indexOf(phrase);
      if (index === -1) return;
      addPubmedCandidate(candidates, {
        term,
        score,
        category,
        index,
        source: "title-phrase",
        matched: phrase,
      });
    });
  }

  function addLatinBinomialCandidates(candidates, title) {
    const pattern = /\b([A-Z][a-z]{2,})\s+([A-Za-z][a-z-]{2,})\b/g;
    let match;
    while ((match = pattern.exec(title)) !== null) {
      const genus = match[1];
      const species = match[2].toLowerCase();
      if (!TITLE_PATHOGEN_GENERA.has(genus)) continue;
      if (INVALID_LATIN_SPECIES_WORDS.has(species)) continue;
      addPubmedCandidate(candidates, {
        term: `${genus} ${species}`,
        score: 100,
        category: "species",
        index: match.index,
        source: "latin-binomial",
        matched: match[0],
      });
    }
  }

  function addPathogenGenusCandidates(candidates, title) {
    TITLE_PATHOGEN_GENERA.forEach((genus) => {
      const match = title.match(new RegExp(`\\b${escapeRegExp(genus)}\\b`, "i"));
      if (!match || match.index === undefined) return;
      addPubmedCandidate(candidates, {
        term: genus,
        score: 95,
        category: "pathogen",
        index: match.index,
        source: "pathogen-genus",
        matched: match[0],
      });
    });
  }

  function addGeneMutationCandidates(candidates, title) {
    const knownGenePattern = /\b(CYP51A|ERG11|FKS1|HMG1|hmg1|SRB1|KPC|NDM-1|mecA|blaKPC|blaNDM)\b/g;
    const mutationPattern = /\b(TR\d{2,3}\/[A-Z]\d{2,4}[A-Z]|[A-Z]\d{2,4}[A-Z]|[A-Z]{2,5}\d{1,3}[A-Z]?\/[A-Z]?\d{2,4}[A-Z]?)\b/g;
    const blaPattern = /\bbla[A-Z0-9-]+\b/g;
    [knownGenePattern, mutationPattern, blaPattern].forEach((pattern) => {
      let match;
      while ((match = pattern.exec(title)) !== null) {
        addPubmedCandidate(candidates, {
          term: match[0],
          score: 90,
          category: "gene",
          index: match.index,
          source: "gene-mutation",
          matched: match[0],
        });
      }
    });
  }

  function addDrugCandidates(candidates, title) {
    TITLE_DRUG_TERMS.forEach((drug) => {
      const match = title.match(new RegExp(`\\b${escapeRegExp(drug)}\\b`, "i"));
      if (!match || match.index === undefined) return;
      addPubmedCandidate(candidates, {
        term: normalizeDrugTerm(drug),
        score: 80,
        category: "drug",
        index: match.index,
        source: "drug",
        matched: match[0],
      });
    });
  }

  function addKeywordSupplementCandidates(candidates, keywords, title) {
    splitKeywords(keywords).forEach((keyword, offset) => {
      const mapped = PUBMED_KEYWORD_MAP[keyword] || TITLE_CONCEPT_MAP[keyword] || keyword;
      const classification = classifyPubmedTerm(mapped);
      if (classification.score < 65) return;
      addPubmedCandidate(candidates, {
        term: mapped,
        score: Math.max(40, classification.score - 8),
        category: classification.category,
        index: title.length + offset,
        source: "keyword-supplement",
        matched: keyword,
      });
    });
  }

  function addPubmedCandidate(candidates, candidate) {
    const term = normalizePubmedTerm(candidate.term);
    if (!isUsefulPubmedTerm(term, candidate.category)) return;

    const key = normalizeTermKey(term);
    const existingIndex = candidates.findIndex((item) => normalizeTermKey(item.term) === key);
    const normalizedCandidate = {
      ...candidate,
      term,
      score: candidate.score || classifyPubmedTerm(term).score,
      category: candidate.category || classifyPubmedTerm(term).category,
    };

    if (existingIndex === -1) {
      candidates.push(normalizedCandidate);
      return;
    }

    const existing = candidates[existingIndex];
    if (
      normalizedCandidate.score > existing.score ||
      (normalizedCandidate.score === existing.score && normalizedCandidate.index < existing.index)
    ) {
      candidates[existingIndex] = normalizedCandidate;
    }
  }

  function selectPubmedTerms(candidates) {
    const selected = [];
    sortCandidates(candidates).forEach((candidate) => {
      if (!isCandidateIndependent(candidate, selected)) return;
      if (selected.length < 2) {
        selected.push(candidate);
        return;
      }
      if (shouldUseThirdPubmedTerm(candidate, selected)) {
        selected.push(candidate);
      }
    });
    return selected.slice(0, 3);
  }

  function shouldUseThirdPubmedTerm(candidate, selected) {
    if (selected.length !== 2) return false;
    const hasSpecificObject = selected.some((item) => item.category === "species" || item.category === "pathogen");
    if (hasSpecificObject) return false;
    if (selected[0].score >= 85) return false;
    return candidate.score >= 65 && !selected.some((item) => item.category === candidate.category);
  }

  function isCandidateIndependent(candidate, selected) {
    if (!selected.length) return true;
    if (candidate.category === "species" && selected.some((item) => item.category === "species")) return false;
    if (candidate.category === "pathogen" && selected.some((item) => item.category === "species")) return false;
    if (candidate.category === "species" && selected.some((item) => item.category === "pathogen")) return true;

    return !selected.some((item) => arePubmedTermsRedundant(candidate.term, item.term));
  }

  function arePubmedTermsRedundant(a, b) {
    const first = normalizeTermKey(a);
    const second = normalizeTermKey(b);
    if (first === second) return true;
    if (first.includes(second) || second.includes(first)) return true;
    if ((first.includes("sequencing") && second === "sequencing") || (second.includes("sequencing") && first === "sequencing")) return true;
    if ((first.includes("resistance") && second === "resistance") || (second.includes("resistance") && first === "resistance")) return true;
    if ((first.includes("infection") && second === "infection") || (second.includes("infection") && first === "infection")) return true;
    return false;
  }

  function sortCandidates(candidates) {
    return [...candidates].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.index !== b.index) return a.index - b.index;
      return b.term.length - a.term.length;
    });
  }

  function classifyPubmedTerm(term) {
    const normalized = normalizePubmedTerm(term);
    const lower = normalized.toLowerCase();
    if (/^[A-Z][a-z]+ [a-z][a-z-]+$/.test(normalized)) return { score: 100, category: "species" };
    if (/^(candida|aspergillus|prototheca|klebsiella|mycobacterium|staphylococcus|streptococcus|cryptococcus)$/i.test(normalized)) {
      return { score: 95, category: "pathogen" };
    }
    if (/^(sars-cov-2|covid-19|human papillomavirus|hpv)$/i.test(normalized)) return { score: 95, category: "pathogen" };
    if (/cyp51a|erg11|fks1|hmg1|srb1|meca|blakpc|blandm|virulence gene|^[A-Z]\d{2,4}[A-Z]$|^TR\d{2,3}\/[A-Z]\d{2,4}[A-Z]$/i.test(normalized)) {
      return { score: 90, category: "gene" };
    }
    if (/infection|aspergillosis|candidiasis|endocarditis|sepsis|resistance|lesion|disease|febrile illness/i.test(normalized)) {
      return { score: 85, category: "disease" };
    }
    if (TITLE_DRUG_TERMS.some((drug) => lower === drug.toLowerCase())) return { score: 80, category: "drug" };
    if (/sequencing|genome|pcr|maldi-tof|mass spectrometry|susceptibility testing|molecular diagnosis|lateral flow assay|cell-free dna/i.test(normalized)) {
      return { score: 75, category: "technique" };
    }
    if (/epidemiology|surveillance|virulence|biofilm|diagnosis|microbiome|microbiota|multi-omics|transcriptomics|proteomics|metabolomics|mutation|susceptibility|prevalence|expression|distribution/i.test(normalized)) {
      return { score: 65, category: "topic" };
    }
    return { score: 40, category: "general" };
  }

  function isUsefulPubmedTerm(term, category) {
    const normalized = normalizePubmedTerm(term);
    const lower = normalized.toLowerCase();
    if (!normalized || /^\d{4}$/.test(normalized)) return false;
    if (TITLE_STOP_WORDS.has(lower) || TITLE_GENERIC_TERMS.has(lower) || BROAD_PUBMED_KEYWORDS.has(lower)) return false;
    if (category !== "gene" && isStrainIdentifier(normalized)) return false;
    return true;
  }

  function isStrainIdentifier(term) {
    return /^(?:strain|isolate)?\s*[A-Z]{1,4}\d{1,5}$/i.test(term) || /^ATCC\s*\d+$/i.test(term);
  }

  function normalizeComparableText(value) {
    return String(value || "").normalize("NFKC").replace(/[‐‑‒–—]/g, "-").trim();
  }

  function normalizePubmedTerm(value) {
    return normalizeComparableText(value)
      .replace(/[“”]/g, "\"")
      .replace(/^["'\s]+|["'\s.,;:，。；：]+$/g, "")
      .replace(/\bgenomes\b/i, "genome")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeTermKey(term) {
    return normalizePubmedTerm(term).toLowerCase().replace(/["']/g, "");
  }

  function normalizeDrugTerm(drug) {
    return drug === "amphotericin B" ? "amphotericin B" : drug;
  }

  function formatPubmedTerm(term) {
    const normalized = normalizePubmedTerm(term);
    if (!normalized) return "";
    return /\s/.test(normalized) ? `"${normalized.replace(/"/g, "")}"` : normalized;
  }

  function debugSimilarPubmed(paper, candidates, terms, query, url) {
    if (!DEBUG_SIMILAR_PUBMED) return;
    console.info("Similar PubMed query", {
      title: paper?.title || "",
      candidates: candidates.map((candidate) => ({
        term: candidate.term,
        score: candidate.score,
        category: candidate.category,
        source: candidate.source,
        matched: candidate.matched,
      })),
      selectedTerms: terms,
      query,
      url,
    });
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function splitKeywords(value) {
    if (Array.isArray(value)) {
      return Array.from(new Set(value.map((item) => String(item || "").trim()).filter(Boolean)));
    }
    return Array.from(
      new Set(
        String(value || "")
          .split(/[，,;；\n\r]+/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }

  function truncate(text, maxLength) {
    if (!text || text.length <= maxLength) return text || "";
    return `${text.slice(0, maxLength).trim()}...`;
  }

  function cleanDoi(value) {
    return String(value || "")
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
      .replace(/^doi:\s*/i, "")
      .trim();
  }

  function cleanPubMed(value) {
    const text = String(value || "").trim();
    const match = text.match(/(?:pubmed\.ncbi\.nlm\.nih\.gov\/)?(\d{6,10})/i);
    return match ? match[1] : text;
  }

  function makeDoiUrl(doi) {
    const cleaned = cleanDoi(doi);
    return cleaned ? `https://doi.org/${cleaned}` : "";
  }

  function makePubMedUrl(pubmed) {
    const cleaned = cleanPubMed(pubmed);
    return /^\d{6,10}$/.test(cleaned) ? `https://pubmed.ncbi.nlm.nih.gov/${cleaned}/` : normalizeUrl(cleaned);
  }

  function normalizeUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/^https?:\/\//i.test(text)) return text;
    if (/^10\.\S+/i.test(text)) return makeDoiUrl(text);
    return "";
  }

  function showLoadError(error) {
    els.resultTitle.textContent = "数据加载失败";
    els.resultMeta.textContent = error.message;
    els.paperList.replaceChildren();
    els.emptyState.hidden = false;
    els.emptyState.querySelector("h3").textContent = "无法读取文献数据";
    els.emptyState.querySelector("p").textContent = "请使用 python -m http.server 8000 启动本地静态服务后访问页面。";
  }
})();
