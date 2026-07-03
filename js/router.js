function hideAllTransientUI() {
  clearDetails();
  hideWordPopover();
  hideVariantMenu();
  closeSettings();
}

function updateMainPageActions() {
  const show = state.currentView === "collections" && !state.activeCollectionId;
  libraryActions.hidden = !show;
}

function showCollections(push = false) {
  state.activeCollectionId = null;
  state.activeStory = null;
  hideAllTransientUI();
  setViewActive("collections");
  searchInput.value = "";
  renderLibrary();
  updateMainPageActions();
  window.scrollTo({top: 0, behavior: "auto"});
  if (push) history.pushState({view: "collections"}, "", "#library");
}

function showCollection(collectionId, push = false) {
  const collection = getCollection(collectionId);
  if (!collection) return showCollections(push);
  state.activeCollectionId = collectionId;
  state.activeStory = null;
  hideAllTransientUI();
  setViewActive("collection");
  searchInput.value = "";
  renderLibrary();
  updateMainPageActions();
  window.scrollTo({top: 0, behavior: "auto"});
  if (push) history.pushState({view: "collection", collectionId}, "", `#collection=${encodeURIComponent(collectionId)}`);
}

function renderLibrary(filter = "") {
  const query = normalizeSearchQuery(filter);
  storyGrid.replaceChildren();
  if (!state.activeCollectionId) {
    renderCollectionCards(query);
  } else {
    renderStoryCards(state.activeCollectionId, query);
  }
}

function renderNavigation(nav) {
  if (nav?.view === "reader") {
    const story = state.stories.find((item) => item.id === nav.storyId);
    if (story) return openStory(story, false);
  }
  if (nav?.view === "collection" && getCollection(nav.collectionId)) {
    return showCollection(nav.collectionId, false);
  }
  showCollections(false);
}
