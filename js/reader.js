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
  readerLevel.classList.remove("single-version");
  readerLevel.disabled = !hasVariants;
  readerLevel.removeAttribute("data-version-label");
  readerLevel.setAttribute("aria-label", hasVariants
    ? `Choose another version of ${story.title}`
    : (story.level || "Story level"));
  readerLevel.title = hasVariants ? "Choose story version" : "";

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

  story.paragraphs.forEach((paragraph, paragraphIndex) => {
    const paragraphElement = document.createElement("p");
    paragraphElement.className = "story-paragraph";
    paragraphElement.style.setProperty("--paragraph-index", String(paragraphIndex));

    paragraph.sentences.forEach((sentence, sentenceIndex) => {
      const sentenceElement = document.createElement("span");
      sentenceElement.className = "sentence";
      sentenceElement.dataset.sentenceIndex = String(sentenceIndex);
      sentenceElement.tabIndex = 0;
      sentenceElement.setAttribute(
        "aria-label",
        "Sentence. Double-click on desktop or long press on mobile for its grammar explanation."
      );

      appendWordTokens(sentenceElement, sentence);
      attachSentenceInteractions(sentenceElement, sentence);
      paragraphElement.appendChild(sentenceElement);

      if (sentenceIndex < paragraph.sentences.length - 1) {
        paragraphElement.appendChild(document.createTextNode(" "));
      }
    });

    storyContent.appendChild(paragraphElement);
  });
}

function sentenceGrammarIndexes(sentence) {
  return (sentence.grammar || []).map((_, index) => index);
}

function attachSentenceInteractions(sentenceElement, sentence) {
  const openSentenceGrammar = () => {
    const indexes = sentenceGrammarIndexes(sentence);
    if (!indexes.length) {
      showToast("No grammar explanation is stored for this sentence yet.");
      return;
    }
    openGrammarDetails(sentenceElement, sentence, indexes);
  };

  sentenceElement.addEventListener("dblclick", (event) => {
    if (MOBILE_QUERY.matches) return;
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(state.clickTimer);
    hideWordPopover();
    openSentenceGrammar();
  });

  sentenceElement.addEventListener("contextmenu", (event) => {
    if (event.pointerType !== "mouse" || MOBILE_QUERY.matches) event.preventDefault();
  });

  sentenceElement.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;

    state.sentencePress = {
      element: sentenceElement,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      longPressed: false
    };

    clearTimeout(state.longPressTimer);
    state.longPressTimer = window.setTimeout(() => {
      const press = state.sentencePress;
      if (!press || press.element !== sentenceElement || press.moved) return;

      press.longPressed = true;
      state.longPressTriggered = true;
      state.suppressWordClickUntil = Date.now() + 900;
      hideWordPopover();
      openSentenceGrammar();
      if (navigator.vibrate) navigator.vibrate(18);

      window.setTimeout(() => {
        state.longPressTriggered = false;
      }, 950);
    }, LONG_PRESS_MS);
  }, {capture: true});

  sentenceElement.addEventListener("pointermove", (event) => {
    const press = state.sentencePress;
    if (!press || press.element !== sentenceElement || press.pointerId !== event.pointerId) return;

    if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) > 12) {
      press.moved = true;
      clearTimeout(state.longPressTimer);
    }
  }, {capture: true});

  const finishSentencePress = (event) => {
    const press = state.sentencePress;
    if (!press || press.element !== sentenceElement || press.pointerId !== event.pointerId) return;
    clearTimeout(state.longPressTimer);
    state.sentencePress = null;
  };

  sentenceElement.addEventListener("pointerup", finishSentencePress, {capture: true});
  sentenceElement.addEventListener("pointercancel", finishSentencePress, {capture: true});

  sentenceElement.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      openSentenceGrammar();
    }
  });
}

function appendWordTokens(container, sentence) {
  const lookup = buildWordLookup(sentence);
  const chunks = String(sentence.korean || "").split(/(\s+)/u);

  chunks.forEach((chunk) => {
    if (!chunk) return;
    if (/^\s+$/u.test(chunk)) {
      container.appendChild(document.createTextNode(chunk));
      return;
    }

    const clean = cleanToken(chunk);
    const translation = lookup.get(clean) || {
      surface: clean || chunk,
      meaning: "No individual translation is stored for this word yet.",
      note: "Add it to the sentence’s words list in the JSON story file."
    };

    const word = document.createElement("span");
    word.className = "word-token";
    word.textContent = chunk;
    word.tabIndex = 0;
    word.dataset.surface = clean || chunk;
    word.setAttribute(
      "aria-label",
      `${clean || chunk}. Click or tap for its translation.`
    );

    attachWordInteractions(word, translation, container, sentence);
    container.appendChild(word);
  });
}

function attachWordInteractions(word, translation, sentenceElement, sentence) {
  let touchTap = null;

  word.addEventListener("contextmenu", (event) => event.preventDefault());

  word.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (Date.now() < state.suppressWordClickUntil || event.detail !== 1) return;

    clearTimeout(state.clickTimer);
    state.clickTimer = window.setTimeout(() => {
      showWordPopover(translation, event.clientX, event.clientY, word);
    }, 235);
  });

  word.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    touchTap = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
  });

  word.addEventListener("pointermove", (event) => {
    if (!touchTap || touchTap.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - touchTap.startX, event.clientY - touchTap.startY) > 12) {
      touchTap.moved = true;
    }
  });

  word.addEventListener("pointerup", (event) => {
    if (event.pointerType === "mouse" || !touchTap || touchTap.pointerId !== event.pointerId) return;

    const completedTap = touchTap;
    touchTap = null;

    if (completedTap.moved || state.longPressTriggered || Date.now() < state.suppressWordClickUntil) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    state.suppressWordClickUntil = Date.now() + 650;
    showWordPopover(translation, event.clientX, event.clientY, word);
  }, {passive: false});

  const cancelTouchTap = () => {
    touchTap = null;
  };

  word.addEventListener("pointercancel", cancelTouchTap);
  word.addEventListener("lostpointercapture", cancelTouchTap);

  word.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      selectSentence(sentenceElement, sentence);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showWordPopover(translation, innerWidth / 2, innerHeight / 2, word);
    }
  });
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
    lookup.set(cleanToken(String(entry.surface)), {
      surface: String(entry.surface),
      meaning: String(entry.meaning || "—"),
      base: String(entry.base || entry.baseForm || ""),
      note: String(entry.note || "")
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
        note: String(entry.note || "")
      });
    }
  });

  return lookup;
}
