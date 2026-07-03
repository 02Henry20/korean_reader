function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeSearchQuery(value) {
  return normalizeSearchText(value);
}

function grammarItemSearchText(item) {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return "";
  return [
    item.pattern, item.grammar, item.fragment, item.surface, item.baseForm, item.base,
    item.transformation, item.change, item.suffix, item.ending, item.result, item.form,
    item.meaning, item.translation, item.explanation, item.description, item.why,
    item.usage, item.reason, item.nuance, item.note, item.limitations, item.restrictions,
    ...(Array.isArray(item.examples) ? item.examples : []), item.example
  ].filter(Boolean).join(" ");
}

function storySearchText(story) {
  if (state.storySearchCache.has(story)) return state.storySearchCache.get(story);
  const collection = getCollection(story.collectionId);
  const sentenceText = story.paragraphs.flatMap((paragraph) =>
    paragraph.sentences.flatMap((sentence) => [
      sentence.korean,
      sentence.translation,
      ...(sentence.words || []).flatMap((word) => [word.surface, word.meaning, word.base, word.note]),
      ...(sentence.vocab || []).flatMap((vocab) => [vocab.word, vocab.meaning, vocab.base, vocab.note]),
      ...(sentence.grammar || []).map(grammarItemSearchText)
    ])
  );

  const value = normalizeSearchText([
    story.title,
    story.englishTitle,
    story.description,
    story.level,
    story.author,
    ...(story.tags || []),
    collection?.title,
    collection?.koreanTitle,
    collection?.description,
    collection?.level,
    collection?.metadata?.author,
    ...sentenceText
  ].filter(Boolean).join(" "));
  state.storySearchCache.set(story, value);
  return value;
}

function storyMatchesQuery(story, query) {
  return !query || storySearchText(story).includes(query);
}

function collectionOwnSearchText(collection) {
  if (state.collectionSearchCache.has(collection)) return state.collectionSearchCache.get(collection);
  const value = normalizeSearchText([
    collection.title,
    collection.koreanTitle,
    collection.description,
    collection.level,
    collection.metadata?.author
  ].filter(Boolean).join(" "));
  state.collectionSearchCache.set(collection, value);
  return value;
}

function setSearchScope(scope, query = "") {
  searchScopeLabel.textContent = query
    ? `Scope: ${scope} · Searching all text and learning metadata`
    : `Scope: ${scope}`;
}

function renderGlobalSearchResults(query) {
  const matchingCollections = state.collections
    .filter((collection) => collectionOwnSearchText(collection).includes(query))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const matchingStories = state.stories.filter((story) => storyMatchesQuery(story, query));
  const matchingGroups = getVariantGroupsForStories(matchingStories)
    .sort((a, b) => a.variants[0].order - b.variants[0].order || a.variants[0].title.localeCompare(b.variants[0].title));

  if (!matchingCollections.length && !matchingGroups.length) {
    renderEmpty("No matching collections, stories, translations, Korean text, vocabulary, or grammar entries were found.");
    return;
  }

  if (matchingCollections.length) {
    storyGrid.appendChild(createSearchSectionTitle("Matching collections", matchingCollections.length));
    matchingCollections.forEach((collection) => storyGrid.appendChild(createCollectionCard(collection)));
  }

  if (matchingGroups.length) {
    storyGrid.appendChild(createSearchSectionTitle("Matching stories", matchingGroups.length));
    matchingGroups.forEach((group) => storyGrid.appendChild(createStoryCard(group, {showCollection: true})));
  }
}

searchInput.addEventListener("input", () => renderLibrary(searchInput.value));
grammarSearchInput.addEventListener("input", () => renderGrammarLibrary(grammarSearchInput.value));
libraryBackButton.addEventListener("click", () => history.back());
backButton.addEventListener("click", () => history.back());
grammarBackButton.addEventListener("click", () => history.back());
grammarLibraryButton.addEventListener("click", () => showGrammarLibrary(true));
closeDetailButton.addEventListener("click", clearDetails);
detailBackdrop.addEventListener("click", clearDetails);

storyContent.addEventListener("click", (event) => {
  if (!event.target.closest(".word-token")) hideWordPopover();
});

readerLevel.addEventListener("click", (event) => {
  event.stopPropagation();
  if (!state.activeStory || readerLevel.disabled) return;
  openVariantMenu(readerLevel, groupIdFor(state.activeStory));
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".word-popover") && !event.target.closest(".word-token")) hideWordPopover();
  if (!event.target.closest(".variant-menu") && !event.target.closest(".story-level-button") && event.target !== readerLevel) {
    hideVariantMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  hideWordPopover();
  hideVariantMenu();
  clearDetails();
  closeSettings();
});

window.addEventListener("resize", () => {
  hideWordPopover();
  hideVariantMenu();
  if (!MOBILE_QUERY.matches) {
    detailBackdrop.classList.remove("detail-backdrop-open");
    detailBackdrop.hidden = true;
    detailPanel.classList.remove("detail-panel-open");
    detailPanel.style.transform = "";
  }
});

window.addEventListener("scroll", () => {
  hideWordPopover();
  hideVariantMenu();
}, {passive: true});

window.addEventListener("popstate", (event) => renderNavigation(event.state || {view: "collections"}));
