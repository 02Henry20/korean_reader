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
  searchInput.placeholder = "Search story titles, descriptions, text, or translations";

  const groups = getVariantGroupsForCollection(collectionId)
    .filter((group) => !query || group.variants.some((story) => storyMatchesQuery(story, query)))
    .sort((a, b) => a.index - b.index);

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

  card.append(content, thumbnail);
  enableCardMotion(card);
  card.addEventListener("click", () => openStory(story, true));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openStory(story, true);
    }
  });
  return card;
}
