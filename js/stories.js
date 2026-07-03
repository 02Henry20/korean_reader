function saveVariantsV6() {
  storageSet(VARIANT_KEY_V6, JSON.stringify(state.variantSelections));
}

function uniqueStoriesV7(stories) {
  const unique = new Map();
  (stories || []).forEach((story) => {
    if (story?.id && !unique.has(story.id)) unique.set(story.id, story);
  });
  return [...unique.values()];
}

function groupIdFor(story) {
  return story?.variantGroupId || story?.id || "";
}

function getVariantGroupsForStories(stories) {
  const groups = new Map();
  (stories || []).forEach((story, index) => {
    const groupId = groupIdFor(story);
    if (!groups.has(groupId)) groups.set(groupId, {groupId, variants: [], index});
    groups.get(groupId).variants.push(story);
  });
  return [...groups.values()].map((group) => {
    group.variants = uniqueStoriesV7(group.variants)
      .sort((a, b) => a.difficultyOrder - b.difficultyOrder || a.order - b.order || a.title.localeCompare(b.title));
    return group;
  });
}

function getVariantGroupsForCollection(collectionId) {
  return getVariantGroupsForStories(getStoriesForCollection(collectionId));
}

function getVariants(groupId) {
  return uniqueStoriesV7(state.stories.filter((story) => groupIdFor(story) === groupId))
    .sort((a, b) => a.difficultyOrder - b.difficultyOrder || a.order - b.order || a.title.localeCompare(b.title));
}

function selectedVariantForGroup(group) {
  const selectedId = state.variantSelections[group.groupId];
  return group.variants.find((story) => story.id === selectedId) || group.variants[0];
}

function selectVariantV6(groupId, storyId) {
  state.variantSelections[groupId] = storyId;
  saveVariantsV6();
}

function renderStoryCards(collectionId, query) {
  const collection = getCollection(collectionId);
  if (!collection) return showCollections(false);
  applyTheme(collection.theme);
  libraryBackButton.hidden = false;
  libraryEyebrow.textContent = collection.level || "STORY COLLECTION";
  libraryTitle.textContent = collection.title;
  librarySubtitle.textContent = [collection.koreanTitle, collection.description].filter(Boolean).join(" · ");
  searchInput.placeholder = "Search in directory";

  const groups = getVariantGroupsForCollection(collectionId)
    .filter((group) => !query || group.variants.some((story) => storyMatchesQuery(story, query)))
    .sort((a, b) => {
      const aRead = isStoryRead(selectedVariantForGroup(a).id);
      const bRead = isStoryRead(selectedVariantForGroup(b).id);
      return Number(aRead) - Number(bRead) || a.index - b.index;
    });

  if (!groups.length) return renderEmpty(`No matching stories in ${collection.title}.`);
  groups.forEach((group) => storyGrid.appendChild(createStoryCard(group)));
}

function createStoryCard(group, options = {}) {
  group.variants = uniqueStoriesV7(group.variants);
  const story = selectedVariantForGroup(group);
  const variants = getVariants(group.groupId);
  const hasVariants = variants.length > 1;
  const accent = THEMES[story.theme] || THEMES.sage;
  const card = document.createElement("article");
  card.className = "story-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open ${story.title}`);
  setCardTheme(card, accent);
  const read = isStoryRead(story.id);
  card.classList.toggle("story-card-read", read);

  card.classList.add("has-story-thumbnail");
  const thumbnail = createStoryThumbnailV8(story, accent);
  const content = document.createElement("div");
  content.className = "story-card-content";

  if (options.showCollection) {
    const collection = getCollection(story.collectionId);
    if (collection) content.appendChild(createTextBlock("p", "story-context", collection.title));
  }

  if (story.level) {
    if (hasVariants) {
      const level = createTextBlock("button", "story-level story-level-button has-variants", story.level);
      level.type = "button";
      level.dataset.versionLabel = `${variants.length}`;
      level.setAttribute("aria-label", `Choose among ${variants.length} versions of ${story.title}`);
      level.title = `${variants.length} versions available`;
      level.addEventListener("click", (event) => {
        event.stopPropagation();
        openVariantMenu(level, group.groupId);
      });
      content.appendChild(level);
    } else {
      const level = createTextBlock("span", "story-level story-level-static", story.level);
      level.title = "Only one version available";
      content.appendChild(level);
    }
  }

  content.appendChild(createTextBlock("h2", "", story.title));
  if (story.englishTitle) content.appendChild(createTextBlock("p", "english-title", story.englishTitle));
  if (story.description) content.appendChild(createTextBlock("p", "description", story.description));

  const readButton = document.createElement("button");
  readButton.type = "button";
  readButton.className = `story-read-button${read ? " story-read-button-active" : ""}`;
  readButton.setAttribute("aria-label", read ? `Mark ${story.title} as unread` : `Mark ${story.title} as read`);
  readButton.title = read ? "Mark as unread" : "Mark as read";
  readButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"/></svg>';
  readButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleStoryRead(story);
  });

  card.append(content, thumbnail, readButton);
  if (state.libraryDeleteMode === "stories") {
    card.classList.add("delete-mode-card");
    card.appendChild(createDeleteCardButton("Delete story"));
  }
  enableCardMotion(card);
  card.addEventListener("click", () => {
    if (state.libraryDeleteMode === "stories") {
      requestDeleteStory(story);
      return;
    }
    openStory(story, true);
  });
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (state.libraryDeleteMode === "stories") requestDeleteStory(story);
      else openStory(story, true);
    }
  });
  return card;
}
