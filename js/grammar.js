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

function openGrammarDetails(sentenceElement, sentence, grammarIndexes, fallbackWord = null) {
  hideWordPopover();
  clearWordSelection();
  clearGrammarSelection();

  state.selectedSentenceElement = sentenceElement;
  const indexSet = new Set(grammarIndexes.map(Number));
  const matchingWords = [...sentenceElement.querySelectorAll(".word-token")]
    .filter((element) => element.dataset.grammarIndexes
      .split(",")
      .filter(Boolean)
      .map(Number)
      .some((index) => indexSet.has(index)));

  const targets = matchingWords.length ? matchingWords : (fallbackWord ? [fallbackWord] : [sentenceElement]);
  targets.forEach((element) => element.classList.add("grammar-selected"));
  state.selectedGrammarElements = targets;

  state.activeGrammarContext = {sentence, grammarIndexes: [...grammarIndexes]};
  renderGrammarDetails(sentence, grammarIndexes);
  detailPanel.classList.remove("detail-panel-empty");
  detailPanel.setAttribute("aria-hidden", "false");

  if (MOBILE_QUERY.matches) {
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => detailPanel.classList.add("detail-panel-open"));
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
  clearGrammarSelection();
  state.activeGrammarContext = null;
  detailPanel.classList.remove("detail-panel-open");
  detailPanel.classList.add("detail-panel-empty");
  detailPanel.setAttribute("aria-hidden", "true");
  detailContent.replaceChildren();
  document.body.style.overflow = "";
}
function createLabel(text) {
  return createTextBlock("p", "detail-label", text);
}
