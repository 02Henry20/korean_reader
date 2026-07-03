function openStory(story, push = false) {
  const groupId = groupIdFor(story);
  const variants = getVariants(groupId);
  const hasVariants = variants.length > 1;
  selectVariantV6(groupId, story.id);

  state.activeStory = story;
  state.activeCollectionId = story.collectionId;
  clearWordSelection();
  clearGrammarSelection();
  hideWordPopover();
  hideVariantMenu();
  closeSettings();
  clearDetails();
  applyTheme(story.theme);
  applyReadingFont(story);

  readerTitle.textContent = story.title;
  readerLevel.textContent = story.level;
  readerLevel.classList.toggle("has-variants", hasVariants);
  readerLevel.classList.toggle("single-version", !hasVariants);
  readerLevel.disabled = !hasVariants;
  readerLevel.dataset.versionLabel = hasVariants ? `${variants.length}` : "";
  readerLevel.setAttribute("aria-label", hasVariants
    ? `Choose among ${variants.length} versions of ${story.title}`
    : `${story.level || "Story level"}; only one version available`);
  readerLevel.title = hasVariants ? `${variants.length} versions available` : "Only one version available";

  renderStory(story);
  setViewActive("reader");
  updateMainPageActions();
  window.scrollTo({top: 0, behavior: "auto"});
  if (push) {
    history.pushState(
      {view: "reader", storyId: story.id, collectionId: story.collectionId},
      "",
      `#story=${encodeURIComponent(story.id)}`
    );
  }
}

function renderStory(story) {
  storyContent.replaceChildren();
  applyReaderTypography();

  story.paragraphs.forEach((paragraph) => {
    const paragraphElement = document.createElement("p");
    paragraphElement.className = "story-paragraph";

    paragraph.sentences.forEach((sentence, sentenceIndex) => {
      const sentenceElement = document.createElement("span");
      sentenceElement.className = "sentence";
      sentenceElement.dataset.sentenceIndex = String(sentenceIndex);
      appendWordTokens(sentenceElement, sentence);
      paragraphElement.appendChild(sentenceElement);

      if (sentenceIndex < paragraph.sentences.length - 1) {
        paragraphElement.appendChild(document.createTextNode(" "));
      }
    });

    storyContent.appendChild(paragraphElement);
  });
}

function buildGrammarRanges(sentence) {
  const text = String(sentence.korean || "");
  const ranges = [];
  (sentence.grammar || []).forEach((item, grammarIndex) => {
    const fragment = grammarFragmentCandidate(item, text);
    if (!fragment) return;
    let from = 0;
    while (from < text.length) {
      const start = text.indexOf(fragment, from);
      if (start < 0) break;
      ranges.push({start, end: start + fragment.length, grammarIndex, fragment});
      from = start + Math.max(1, fragment.length);
    }
  });
  return ranges;
}

function appendWordTokens(container, sentence) {
  const lookup = buildWordLookup(sentence);
  const grammarRanges = buildGrammarRanges(sentence);
  const text = String(sentence.korean || "");
  const chunkPattern = /\s+|[^\s]+/gu;
  let match;

  while ((match = chunkPattern.exec(text))) {
    const chunk = match[0];
    const start = match.index;
    const end = start + chunk.length;

    if (/^\s+$/u.test(chunk)) {
      container.appendChild(document.createTextNode(chunk));
      continue;
    }

    const clean = cleanToken(chunk);
    const translation = lookup.get(clean) || {
      surface: clean || chunk,
      meaning: "No individual translation is stored for this word yet.",
      note: "Add it to the sentence’s words list in the JSON story file.",
      grammarIndexes: []
    };

    const overlappingGrammar = grammarRanges
      .filter((range) => start < range.end && end > range.start)
      .map((range) => range.grammarIndex);
    const grammarIndexes = [...new Set([
      ...(translation.grammarIndexes || []),
      ...overlappingGrammar
    ])];

    const word = document.createElement("span");
    word.className = "word-token";
    if (grammarIndexes.length) word.classList.add("grammar-token");
    word.textContent = chunk;
    word.tabIndex = 0;
    word.dataset.surface = clean || chunk;
    word.dataset.grammarIndexes = grammarIndexes.join(",");
    word.setAttribute("aria-label", `${clean || chunk}. Click or tap for translation${sentence.grammar?.length ? "; open grammar with double-click or long press" : ""}.`);

    attachWordInteractions(word, translation, container, sentence, grammarIndexes);
    container.appendChild(word);
  }
}

function attachWordInteractions(word, translation, sentenceElement, sentence, grammarIndexes) {
  word.addEventListener("contextmenu", (event) => event.preventDefault());

  word.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail === 0 || state.longPressTriggered) return;
    clearTimeout(state.clickTimer);
    state.clickTimer = window.setTimeout(() => {
      showWordPopover(translation, event.clientX, event.clientY, word);
    }, 230);
  });

  word.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(state.clickTimer);
    openGrammarForWord(word, sentenceElement, sentence, grammarIndexes);
  });

  word.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    state.longPressTriggered = false;
    state.pointerStart = {x: event.clientX, y: event.clientY, pointerId: event.pointerId};
    clearTimeout(state.longPressTimer);
    state.longPressTimer = window.setTimeout(() => {
      state.longPressTriggered = true;
      openGrammarForWord(word, sentenceElement, sentence, grammarIndexes);
      if (navigator.vibrate) navigator.vibrate(18);
    }, LONG_PRESS_MS);
  });

  word.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse" || !state.pointerStart) return;
    const distance = Math.hypot(event.clientX - state.pointerStart.x, event.clientY - state.pointerStart.y);
    if (distance > 12) clearTimeout(state.longPressTimer);
  });

  word.addEventListener("pointerup", (event) => {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(state.longPressTimer);
    state.pointerStart = null;
    if (state.longPressTriggered) {
      window.setTimeout(() => { state.longPressTriggered = false; }, 80);
      return;
    }
    showWordPopover(translation, event.clientX, event.clientY, word);
  }, {passive: false});

  word.addEventListener("pointercancel", () => {
    clearTimeout(state.longPressTimer);
    state.pointerStart = null;
    state.longPressTriggered = false;
  });

  word.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      openGrammarForWord(word, sentenceElement, sentence, grammarIndexes);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showWordPopover(translation, innerWidth / 2, innerHeight / 2, word);
    }
  });
}

function openGrammarForWord(word, sentenceElement, sentence, grammarIndexes) {
  const indexes = grammarIndexes.length
    ? grammarIndexes
    : (sentence.grammar || []).map((_, index) => index);

  if (!indexes.length) {
    showToast("No grammar explanation is stored for this sentence yet.");
    return;
  }

  openGrammarDetails(sentenceElement, sentence, indexes, word);
}

function cleanToken(token) {
  return String(token || "")
    .replace(/^[^\p{L}\p{N}]+/gu, "")
    .replace(/[^\p{L}\p{N}]+$/gu, "");
}

function buildWordLookup(sentence) {
  const lookup = new Map();

  (sentence.words || []).forEach((entry) => {
    if (!entry || !entry.surface) return;
    const grammarIndexes = [];
    if (Number.isInteger(entry.grammarIndex)) grammarIndexes.push(entry.grammarIndex);
    if (Array.isArray(entry.grammarIndexes)) {
      entry.grammarIndexes.forEach((value) => {
        const number = Number(value);
        if (Number.isInteger(number)) grammarIndexes.push(number);
      });
    }
    lookup.set(cleanToken(String(entry.surface)), {
      surface: String(entry.surface),
      meaning: String(entry.meaning || "—"),
      base: String(entry.base || entry.baseForm || ""),
      note: String(entry.note || ""),
      grammarIndexes: [...new Set(grammarIndexes)]
    });
  });

  (sentence.vocab || []).forEach((entry) => {
    if (!entry || !entry.word) return;
    const key = cleanToken(String(entry.word));
    if (!lookup.has(key) && !String(entry.word).includes(" ")) {
      lookup.set(key, {
        surface: String(entry.word),
        meaning: String(entry.meaning || "—"),
        base: String(entry.base || entry.baseForm || ""),
        note: String(entry.note || ""),
        grammarIndexes: []
      });
    }
  });

  return lookup;
}
