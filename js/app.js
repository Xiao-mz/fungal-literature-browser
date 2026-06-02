(function () {
  const LOCAL_PAPERS_KEY = "literatureBrowser.localPapers.v1";

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
      state.papers = normalizePapers([...basePapers, ...loadStoredPapers(LOCAL_PAPERS_KEY)]);
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
    els.openAddPaper = document.getElementById("openAddPaper");
    els.addPaperModal = document.getElementById("addPaperModal");
    els.closeAddPaper = document.getElementById("closeAddPaper");
    els.cancelAddPaper = document.getElementById("cancelAddPaper");
    els.addPaperForm = document.getElementById("addPaperForm");
    els.addPaperMessage = document.getElementById("addPaperMessage");
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

    els.openAddPaper?.addEventListener("click", openAddPaperModal);
    els.closeAddPaper?.addEventListener("click", closeAddPaperModal);
    els.cancelAddPaper?.addEventListener("click", closeAddPaperModal);
    els.addPaperForm?.addEventListener("submit", handleAddPaperSubmit);
    els.addPaperModal?.addEventListener("click", (event) => {
      if (event.target === els.addPaperModal) {
        closeAddPaperModal();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !els.addPaperModal?.hidden) {
        closeAddPaperModal();
      }
    });
  }

  function openAddPaperModal() {
    if (!els.addPaperModal || !els.addPaperForm) return;
    resetFormMessage();
    els.addPaperModal.hidden = false;
    document.body.classList.add("modal-open");
    els.addPaperForm.elements.title?.focus();
  }

  function closeAddPaperModal() {
    if (!els.addPaperModal || !els.addPaperForm) return;
    els.addPaperModal.hidden = true;
    document.body.classList.remove("modal-open");
    els.addPaperForm.reset();
    resetFormMessage();
  }

  function handleAddPaperSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = getFormValue(formData, "title");

    if (!title) {
      showFormMessage("请填写论文标题。", "error");
      form.elements.title?.focus();
      return;
    }

    const doi = cleanDoi(getFormValue(formData, "doi"));
    const pubmed = cleanPubMed(getFormValue(formData, "pubmed"));
    const duplicateMessage = getDuplicateMessage(doi, pubmed);
    if (duplicateMessage) {
      showFormMessage(duplicateMessage, "error");
      window.alert(duplicateMessage);
      return;
    }

    const paper = normalizePapers([
      {
        id: generatePaperId(),
        title,
        authors: getFormValue(formData, "authors"),
        year: getFormValue(formData, "year"),
        journal: "",
        keywords: splitKeywords(getFormValue(formData, "keywords")),
        abstract: getFormValue(formData, "abstract"),
        doi,
        doiUrl: makeDoiUrl(doi),
        pubmed,
        pubmedUrl: makePubMedUrl(pubmed),
        fullTextUrl: normalizeUrl(getFormValue(formData, "fullTextUrl")) || makeDoiUrl(doi),
        role: getFormValue(formData, "role"),
        note: "",
      },
    ])[0];

    const storedPapers = normalizePapers(loadStoredPapers(LOCAL_PAPERS_KEY));
    storedPapers.push(paper);
    try {
      saveStoredPapers(LOCAL_PAPERS_KEY, storedPapers);
    } catch (error) {
      return;
    }

    state.papers.push(paper);
    resetFiltersAfterAdd();
    setupYearFilter();
    render();
    closeAddPaperModal();
  }

  function getFormValue(formData, name) {
    return String(formData.get(name) || "").trim();
  }

  function getDuplicateMessage(doi, pubmed) {
    const normalizedDoi = cleanDoi(doi).toLowerCase();
    const normalizedPubMed = cleanPubMed(pubmed);

    if (
      normalizedDoi &&
      state.papers.some((paper) => cleanDoi(paper.doi).toLowerCase() === normalizedDoi)
    ) {
      return "已存在相同 DOI 的文献，请勿重复添加。";
    }

    if (
      normalizedPubMed &&
      state.papers.some((paper) => cleanPubMed(paper.pubmed) === normalizedPubMed)
    ) {
      return "已存在相同 PubMed ID 的文献，请勿重复添加。";
    }

    return "";
  }

  function generatePaperId() {
    const maxNumber = state.papers.reduce((max, paper) => {
      const match = String(paper.id || "").match(/^paper_(\d+)$/);
      return match ? Math.max(max, Number.parseInt(match[1], 10) || 0) : max;
    }, 0);
    return `paper_${String(maxNumber + 1).padStart(3, "0")}`;
  }

  function resetFiltersAfterAdd() {
    state.activeKeyword = "";
    state.query = "";
    state.year = "all";
    state.status = "all";
    state.sort = "year-desc";
    if (els.searchInput) els.searchInput.value = "";
    if (els.statusFilter) els.statusFilter.value = "all";
    if (els.sortSelect) els.sortSelect.value = "year-desc";
  }

  function showFormMessage(message, type) {
    if (!els.addPaperMessage) return;
    els.addPaperMessage.textContent = message;
    els.addPaperMessage.className = `form-message ${type || ""}`.trim();
  }

  function resetFormMessage() {
    showFormMessage("", "");
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

  function loadStoredPapers(key) {
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveStoredPapers(key, papers) {
    try {
      window.localStorage.setItem(key, JSON.stringify(papers));
    } catch (error) {
      showFormMessage("浏览器本地存储不可用，暂时无法保存新增文献。", "error");
      throw error;
    }
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

  function addLinkButton(container, label, href) {
    if (!href) return;
    const link = document.createElement("a");
    link.className = "link-button";
    link.href = href;
    link.textContent = label;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
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
