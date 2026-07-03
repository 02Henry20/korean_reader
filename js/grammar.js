function grammarFragmentCandidate(item, sentenceText) {
  if (!item || typeof item === "string") return "";
  const candidates = [
    item.fragment,
    item.surface,
    item.result,
    item.form,
    item.sentenceFragment,
    item.structure
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value && sentenceText.includes(value)) return value;
  }

  const pattern = String(item.pattern || item.suffix || "")
    .replace(/^[\s~～\-–—]+/u, "")
    .replace(/\([^)]*\)/gu, "")
    .trim();
  return pattern && sentenceText.includes(pattern) ? pattern : "";
}


function normalizeGrammarItem(item, sentence = null) {
  if (typeof item === "string") {
    return {
      pattern: "",
      fragment: "",
      baseForm: "",
      transformation: "",
      suffix: "",
      result: "",
      meaning: "",
      explanation: item,
      why: "",
      examples: [],
      limitations: "",
      nuance: ""
    };
  }

  const source = item && typeof item === "object" ? item : {};
  const examples = Array.isArray(source.examples)
    ? source.examples.map(String).filter(Boolean)
    : [source.example].filter(Boolean).map(String);
  const sentenceText = String(sentence?.korean || "");
  const fragment = String(
    source.fragment || source.surface || source.result || source.form ||
    source.sentenceFragment || grammarFragmentCandidate(source, sentenceText) || ""
  );

  return {
    pattern: String(source.pattern || source.grammar || ""),
    fragment,
    baseForm: String(source.baseForm || source.base || source.dictionaryForm || ""),
    transformation: String(source.transformation || source.change || ""),
    suffix: String(source.suffix || source.ending || ""),
    result: String(source.result || source.form || fragment || ""),
    meaning: String(source.meaning || source.translation || ""),
    explanation: String(source.explanation || source.description || ""),
    why: String(source.why || source.usage || source.reason || ""),
    examples,
    limitations: String(source.limitations || source.restrictions || ""),
    nuance: String(source.nuance || source.note || "")
  };
}

function scrollSelectedSentenceToMobileTop(sentenceElement) {
  const header = document.querySelector(".reader-header");
  const headerOffset = (header?.getBoundingClientRect().height || 70) + 24;
  const target = Math.max(0, window.scrollY + sentenceElement.getBoundingClientRect().top - headerOffset);
  const smooth = state.settings.animationIntensity === "full" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({top: target, behavior: smooth ? "smooth" : "auto"});
  return smooth ? 150 : 0;
}

function openMobileGrammarSheet(sentenceElement) {
  clearTimeout(state.detailCloseTimer);
  document.body.classList.add("mobile-grammar-open");
  const revealDelay = scrollSelectedSentenceToMobileTop(sentenceElement);
  detailBackdrop.hidden = false;
  detailBackdrop.setAttribute("aria-hidden", "false");

  window.setTimeout(() => {
    if (!state.activeGrammarContext) return;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      detailBackdrop.classList.add("detail-backdrop-open");
      detailPanel.classList.add("detail-panel-open");
    });
  }, revealDelay);
}

function openGrammarDetails(sentenceElement, sentence, grammarIndexes) {
  hideWordPopover();
  clearWordSelection();
  clearGrammarSelection();

  state.selectedSentenceElement = sentenceElement;
  sentenceElement.classList.add("grammar-selected");
  state.selectedGrammarElements = [sentenceElement];

  state.activeGrammarContext = {sentence, grammarIndexes: [...grammarIndexes]};
  renderGrammarDetails(sentence, grammarIndexes);
  detailPanel.classList.remove("detail-panel-empty");
  detailPanel.setAttribute("aria-hidden", "false");

  if (MOBILE_QUERY.matches) {
    openMobileGrammarSheet(sentenceElement);
  }
}

function selectSentence(element, sentence) {
  const indexes = (sentence.grammar || []).map((_, index) => index);
  if (!indexes.length) {
    showToast("No grammar explanation is stored for this sentence yet.");
    return;
  }
  openGrammarDetails(element, sentence, indexes);
}

function renderGrammarDetails(sentence, grammarIndexes) {
  detailContent.replaceChildren();
  const items = grammarIndexes
    .map((index) => ({index, item: sentence.grammar?.[index]}))
    .filter(({item}) => item !== undefined)
    .map(({index, item}) => ({index, grammar: normalizeGrammarItem(item, sentence)}));

  detailContent.appendChild(createLabel(items.length > 1 ? "Grammar explanations" : "Grammar explanation"));

  const list = document.createElement("div");
  list.className = "grammar-list";
  items.forEach(({grammar}) => list.appendChild(createGrammarCard(grammar)));
  detailContent.appendChild(list);

  if (state.settings.showKeyVocabulary && sentence.vocab?.length) {
    detailContent.appendChild(createLabel("Key vocabulary"));
    const vocabList = document.createElement("div");
    vocabList.className = "vocab-list";
    sentence.vocab.forEach((item) => {
      const row = document.createElement("section");
      row.className = "vocab-row";
      row.appendChild(createTextBlock("p", "vocab-term", item.word || ""));
      if (item.meaning) row.appendChild(createTextBlock("p", "vocab-meaning", item.meaning));
      if (item.note) row.appendChild(createTextBlock("p", "vocab-note", item.note));
      vocabList.appendChild(row);
    });
    detailContent.appendChild(vocabList);
  }
}

function createGrammarCard(grammar) {
  const card = document.createElement("section");
  card.className = "grammar-card";

  if (grammar.pattern) card.appendChild(createTextBlock("p", "grammar-pattern", grammar.pattern));
  if (grammar.fragment) {
    const fragment = document.createElement("p");
    fragment.className = "grammar-fragment";
    fragment.append(createTextBlock("span", "grammar-field-label", "In this sentence"));
    fragment.append(document.createTextNode(grammar.fragment));
    card.appendChild(fragment);
  }

  if (grammar.meaning) appendGrammarField(card, "Meaning", grammar.meaning);
  if (grammar.explanation) appendGrammarField(card, "Explanation", grammar.explanation);

  if (state.settings.grammarDetail === "detailed") {
    if (grammar.baseForm) appendGrammarField(card, "Base form", grammar.baseForm);
    if (grammar.transformation) appendGrammarField(card, "Transformation", grammar.transformation);
    if (grammar.suffix) appendGrammarField(card, "Grammar suffix / ending", grammar.suffix);
    if (grammar.result && grammar.result !== grammar.fragment) appendGrammarField(card, "Result", grammar.result);
    if (grammar.why) appendGrammarField(card, "Why it is used here", grammar.why);
    if (grammar.nuance) appendGrammarField(card, "Nuance", grammar.nuance);
    if (grammar.limitations) appendGrammarField(card, "Usage limitations", grammar.limitations);

    if (grammar.examples.length) {
      const examples = document.createElement("div");
      examples.className = "grammar-examples";
      examples.appendChild(createTextBlock("p", "grammar-field-label", "Additional examples"));
      const list = document.createElement("ul");
      grammar.examples.forEach((example) => list.appendChild(createTextBlock("li", "", example)));
      examples.appendChild(list);
      card.appendChild(examples);
    }
  }

  if (!card.children.length) {
    card.appendChild(createTextBlock("p", "grammar-explanation", "No detailed explanation is stored for this grammar entry yet."));
  }
  return card;
}

function appendGrammarField(card, label, value) {
  const field = document.createElement("div");
  field.className = "grammar-field";
  field.append(
    createTextBlock("p", "grammar-field-label", label),
    createTextBlock("p", "grammar-field-value", value)
  );
  card.appendChild(field);
}

function clearWordSelection() {
  if (state.selectedWordElement) state.selectedWordElement.classList.remove("word-selected");
  state.selectedWordElement = null;
}

function clearGrammarSelection() {
  state.selectedGrammarElements.forEach((element) => element.classList.remove("grammar-selected"));
  state.selectedGrammarElements = [];
  state.selectedSentenceElement = null;
}

function clearSentenceSelection() {
  clearGrammarSelection();
}

function clearDetails() {
  const closingMobileSheet = MOBILE_QUERY.matches && detailPanel.classList.contains("detail-panel-open");
  clearGrammarSelection();
  state.activeGrammarContext = null;
  clearTimeout(state.detailCloseTimer);
  detailPanel.classList.remove("detail-panel-open");
  detailBackdrop.classList.remove("detail-backdrop-open");
  detailPanel.style.removeProperty("transform");
  detailPanel.style.removeProperty("transition");
  detailBackdrop.style.removeProperty("opacity");
  detailPanel.setAttribute("aria-hidden", "true");
  detailBackdrop.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  document.body.classList.remove("mobile-grammar-open");

  const finishClose = () => {
    if (detailPanel.classList.contains("detail-panel-open")) return;
    detailPanel.classList.add("detail-panel-empty");
    detailContent.replaceChildren();
    detailBackdrop.hidden = true;
  };

  if (closingMobileSheet) {
    state.detailCloseTimer = window.setTimeout(finishClose, 280);
  } else {
    finishClose();
  }
}

function initializeGrammarSheetGestures() {
  detailBackdrop.addEventListener("click", clearDetails);

  detailPanel.addEventListener("pointerdown", (event) => {
    if (!MOBILE_QUERY.matches || !detailPanel.classList.contains("detail-panel-open")) return;

    const rect = detailPanel.getBoundingClientRect();
    const distanceFromPanelTop = event.clientY - rect.top;
    const startedInExpandedHandleZone = distanceFromPanelTop <= 150;
    const panelIsAtTop = detailPanel.scrollTop <= 2;

    /*
     * The upper 150 px act as an enlarged drag area at any scroll position.
     * When the grammar panel is already scrolled to the top, a downward swipe
     * may begin anywhere inside the panel.
     */
    if (!startedInExpandedHandleZone && !panelIsAtTop) return;

    state.detailDrag = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      startedAt: performance.now(),
      dragging: false
    };

    try {
      detailPanel.setPointerCapture(event.pointerId);
    } catch {}
  });

  detailPanel.addEventListener("pointermove", (event) => {
    const drag = state.detailDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.max(0, event.clientY - drag.startY);
    drag.lastY = event.clientY;
    if (distance < 7 && !drag.dragging) return;

    drag.dragging = true;
    event.preventDefault();
    detailPanel.style.transition = "none";
    detailPanel.style.transform = `translateY(${distance}px)`;
    detailBackdrop.style.opacity = String(Math.max(0, 1 - distance / 360));
  }, {passive: false});

  const finishDrag = (event) => {
    const drag = state.detailDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    state.detailDrag = null;

    try {
      if (detailPanel.hasPointerCapture(event.pointerId)) {
        detailPanel.releasePointerCapture(event.pointerId);
      }
    } catch {}

    const distance = Math.max(0, drag.lastY - drag.startY);
    const elapsed = Math.max(1, performance.now() - drag.startedAt);
    const velocity = distance / elapsed;

    detailPanel.style.removeProperty("transition");
    detailBackdrop.style.removeProperty("opacity");

    if (drag.dragging && (distance > 68 || velocity > 0.48)) {
      clearDetails();
      return;
    }

    detailPanel.style.removeProperty("transform");
  };

  detailPanel.addEventListener("pointerup", finishDrag);
  detailPanel.addEventListener("pointercancel", finishDrag);
}

initializeGrammarSheetGestures();
function createLabel(text) {
  return createTextBlock("p", "detail-label", text);
}
