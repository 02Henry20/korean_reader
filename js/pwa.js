async function initializeLibrary() {
  history.replaceState({view: "collections"}, "", "#library");
  applyTheme(state.settings.theme);
  applyReaderTypography();
  libraryBackButton.hidden = true;
  libraryTitle.textContent = "Loading your library…";
  librarySubtitle.textContent = "Loading built-in and locally saved stories.";
  searchInput.placeholder = "Loading stories";
  storyGrid.replaceChildren(createTextBlock("div", "empty-state", "Loading collections and stories…"));

  let githubError = null;
  try {
    await loadLibrary();
  } catch (error) {
    githubError = error;
    console.warn("The GitHub library could not be loaded:", error);
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
    if (githubError) showToast("Built-in GitHub stories are unavailable; showing locally saved content");
  } else {
    state.currentView = "collections";
    updateMainPageActions();
    libraryTitle.textContent = "Library could not be loaded";
    librarySubtitle.textContent = "No built-in or locally saved stories are available.";
    searchInput.placeholder = "Library unavailable";
    storyGrid.replaceChildren(
      createTextBlock(
        "div",
        "empty-state",
        `${githubError?.message || "No stories were found."} You can still sign in and synchronize Firebase from Settings.`
      )
    );
  }

  initializeCloudSync();
}

initializeLibrary();
