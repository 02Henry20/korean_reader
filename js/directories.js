function renderCollectionCards(query) {
  applyTheme(state.settings.theme);
  libraryBackButton.hidden = true;
  libraryEyebrow.textContent = "한국어 리더";
  libraryTitle.textContent = "Your Korean library";
  librarySubtitle.textContent = "Choose a collection, then choose a story.";
  searchInput.placeholder = "Search the complete library";
  setSearchScope("Complete library", query);

  if (query) {
    renderGlobalSearchResults(query);
    return;
  }

  const collections = [...state.collections]
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

  if (!collections.length) return renderEmpty("No collections found.");
  collections.forEach((collection) => storyGrid.appendChild(createCollectionCard(collection)));
}

function createCollectionCard(collection) {
  const accent = THEMES[collection.theme] || THEMES.sage;
  const groups = getVariantGroupsForCollection(collection.id);
  const card = document.createElement("article");
  card.className = "story-card collection-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open ${collection.title}`);
  setCardTheme(card, accent);

  const content = document.createElement("div");
  content.className = "story-card-content";
  const topline = document.createElement("div");
  topline.className = "collection-topline";
  const mark = createTextBlock("span", "collection-monogram", collection.monogram);
  const count = createTextBlock("span", "collection-count", `${groups.length} stor${groups.length === 1 ? "y" : "ies"}`);
  topline.append(mark, count);
  content.appendChild(topline);
  content.appendChild(createTextBlock("h2", "", collection.title));
  if (collection.koreanTitle) content.appendChild(createTextBlock("p", "collection-korean-title", collection.koreanTitle));
  if (collection.description) content.appendChild(createTextBlock("p", "description", collection.description));

  const arrow = document.createElement("span");
  arrow.className = "card-arrow";
  arrow.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  card.append(content, arrow);
  card.addEventListener("click", () => showCollection(collection.id, true));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showCollection(collection.id, true);
    }
  });
  return card;
}

function renderEmpty(message) {
  storyGrid.appendChild(createTextBlock("div", "empty-state", message));
}

function createSearchSectionTitle(text, count) {
  const title = document.createElement("div");
  title.className = "search-section-title";
  title.append(
    createTextBlock("h2", "", text),
    createTextBlock("span", "", String(count))
  );
  return title;
}
