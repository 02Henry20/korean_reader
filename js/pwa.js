async function initializeLibrary() {
  history.replaceState({view: "collections"}, "", "#library");
  applyTheme(state.settings.theme);
  applyReaderTypography();
  libraryBackButton.hidden = true;
  libraryTitle.textContent = "Loading your library…";
  librarySubtitle.textContent = "Loading saved stories.";
  searchInput.placeholder = "Loading stories";
  storyGrid.replaceChildren(createTextBlock("div", "empty-state", "Loading collections and stories…"));

  let githubError = null;
  if (GITHUB_LIBRARY.enabled !== false) {
    try {
      await loadLibrary();
    } catch (error) {
      githubError = error;
      console.warn("The GitHub library could not be loaded:", error);
      state.githubCollections = [];
      state.githubStories = [];
    }
  } else {
    state.githubCollections = [];
    state.githubStories = [];
  }

  try {
    await loadLocalLibraryIntoState();
  } catch (error) {
    console.error("The local library could not be loaded:", error);
  }

  if (state.stories.length || state.collections.length) {
    showCollections(false);
    if (githubError) showToast("Optional built-in stories are unavailable; showing saved content");
  } else {
    state.currentView = "collections";
    updateMainPageActions();
    libraryTitle.textContent = "No saved stories";
    librarySubtitle.textContent = "Import a directory or sign in from Settings to synchronize your library.";
    searchInput.placeholder = "No stories available";
    storyGrid.replaceChildren(
      createTextBlock(
        "div",
        "empty-state",
        `${githubError?.message || "No stories are saved on this device yet."} You can still sign in and synchronize Firebase from Settings.`
      )
    );
  }

  initializeCloudSync();
}

initializeLibrary();
