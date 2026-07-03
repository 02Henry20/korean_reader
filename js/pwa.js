async function initializeLibrary() {
  history.replaceState({view: "collections"}, "", "#library");
  applyTheme(state.settings.theme);
  applyReaderTypography();
  libraryBackButton.hidden = true;
  libraryTitle.textContent = "Loading your library…";
  librarySubtitle.textContent = `Reading ${GITHUB_LIBRARY.root}/ from ${GITHUB_LIBRARY.owner}/${GITHUB_LIBRARY.repo}.`;
  searchInput.placeholder = "Loading stories";
  storyGrid.replaceChildren(createTextBlock("div", "empty-state", "Loading collections and stories…"));

  try {
    await loadLibrary();
    showCollections(false);
  } catch (error) {
    console.error(error);
    state.currentView = "collections";
    updateMainPageActions();
    libraryTitle.textContent = "Library could not be loaded";
    librarySubtitle.textContent = `${GITHUB_LIBRARY.owner}/${GITHUB_LIBRARY.repo}/${GITHUB_LIBRARY.root}`;
    searchInput.placeholder = "Library unavailable";
    storyGrid.replaceChildren(
      createTextBlock(
        "div",
        "empty-state",
        `${error.message} Make sure the repository is public and the library folder exists on the main branch.`
      )
    );
  }
}

initializeLibrary();
