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

function storySearchText(story) {
  if (state.storySearchCache.has(story)) return state.storySearchCache.get(story);

  const storyText = story.paragraphs.flatMap((paragraph) =>
    paragraph.sentences.flatMap((sentence) => [
      sentence.korean,
      sentence.translation
    ])
  );

  const value = normalizeSearchText([
    story.title,
    story.englishTitle,
    story.description,
    ...storyText
  ].filter(Boolean).join(" "));

  state.storySearchCache.set(story, value);
  return value;
}

function storyMatchesQuery(story, query) {
  return !query || storySearchText(story).includes(query);
}

function collectionOwnSearchText(collection) {
  if (state.collectionSearchCache.has(collection)) {
    return state.collectionSearchCache.get(collection);
  }

  const value = normalizeSearchText([
    collection.title,
    collection.koreanTitle,
    collection.description
  ].filter(Boolean).join(" "));

  state.collectionSearchCache.set(collection, value);
  return value;
}

function renderGlobalSearchResults(query) {
  const matchingCollections = state.collections
    .filter((collection) => collectionOwnSearchText(collection).includes(query))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

  const matchingStories = state.stories.filter((story) => storyMatchesQuery(story, query));
  const matchingGroups = getVariantGroupsForStories(matchingStories)
    .sort((a, b) =>
      a.variants[0].order - b.variants[0].order ||
      a.variants[0].title.localeCompare(b.variants[0].title)
    );

  if (!matchingCollections.length && !matchingGroups.length) {
    renderEmpty("No matching titles, descriptions, Korean text, or translations were found.");
    return;
  }

  if (matchingCollections.length) {
    storyGrid.appendChild(createSearchSectionTitle("Collections", matchingCollections.length));
    matchingCollections.forEach((collection) => storyGrid.appendChild(createCollectionCard(collection)));
  }

  if (matchingGroups.length) {
    storyGrid.appendChild(createSearchSectionTitle("Stories", matchingGroups.length));
    matchingGroups.forEach((group) => storyGrid.appendChild(createStoryCard(group, {showCollection: true})));
  }
}

searchInput.addEventListener("input", () => renderLibrary(searchInput.value));
libraryBackButton.addEventListener("click", () => history.back());
backButton.addEventListener("click", () => history.back());
closeDetailButton.addEventListener("click", clearDetails);

storyContent.addEventListener("click", (event) => {
  if (!event.target.closest(".word-token")) hideWordPopover();
});

readerLevel.addEventListener("click", (event) => {
  event.stopPropagation();
  if (!state.activeStory || readerLevel.disabled) return;
  openVariantMenu(readerLevel, groupIdFor(state.activeStory));
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".word-popover") && !event.target.closest(".word-token")) {
    hideWordPopover();
  }
  if (!event.target.closest(".variant-menu") &&
      !event.target.closest(".story-level-button") &&
      event.target !== readerLevel) {
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
    detailPanel.classList.remove("detail-panel-open");
    detailBackdrop.classList.remove("detail-backdrop-open");
    detailBackdrop.hidden = true;
    document.body.style.overflow = "";
  } else if (state.activeGrammarContext && state.selectedSentenceElement) {
    openMobileGrammarSheet(state.selectedSentenceElement);
  }
});

window.addEventListener("scroll", () => {
  hideWordPopover();
  hideVariantMenu();
}, {passive: true});

window.addEventListener("popstate", (event) => {
  renderNavigation(event.state || {view: "collections"});
});
