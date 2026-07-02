const THEMES = {"sage":{"name":"Sage","bg":"#f4f5ef","surface":"#fffefa","surfaceMuted":"#edf3ee","ink":"#20342f","muted":"#71807b","accent":"#4d7f69","accentStrong":"#315f4e","accentSoft":"#dceadf","word":"#a65f3e","ambientOne":"#cfe3d3","ambientTwo":"#eadcc6"},"ocean":{"name":"Ocean","bg":"#f0f5f7","surface":"#fbfeff","surfaceMuted":"#e8f1f4","ink":"#1e3340","muted":"#687d87","accent":"#38758c","accentStrong":"#25566a","accentSoft":"#d8eaf0","word":"#b05f48","ambientOne":"#c6e1eb","ambientTwo":"#d9e4f1"},"plum":{"name":"Plum","bg":"#f7f2f7","surface":"#fffaff","surfaceMuted":"#f1e8f1","ink":"#3a2d3a","muted":"#806f80","accent":"#835b80","accentStrong":"#62445f","accentSoft":"#eadbea","word":"#ad6548","ambientOne":"#e7d0e5","ambientTwo":"#eadccf"},"sunset":{"name":"Sunset","bg":"#faf3ed","surface":"#fffdf9","surfaceMuted":"#f6e8dd","ink":"#422e29","muted":"#876f68","accent":"#bb684a","accentStrong":"#8d4732","accentSoft":"#f3ddcf","word":"#765a9b","ambientOne":"#f0cdbb","ambientTwo":"#ead8ba"},"hanok":{"name":"Hanok","bg":"#f5f0e6","surface":"#fffdf7","surfaceMuted":"#eee7d8","ink":"#342f28","muted":"#756e61","accent":"#78633e","accentStrong":"#59482d","accentSoft":"#e7ddc7","word":"#9d4e42","ambientOne":"#e2d5ba","ambientTwo":"#d9c6b5"},"midnight":{"name":"Midnight","bg":"#edf0f6","surface":"#fbfcff","surfaceMuted":"#e5e9f2","ink":"#252c42","muted":"#6d748a","accent":"#56698f","accentStrong":"#3b4b70","accentSoft":"#dce2ef","word":"#a6576c","ambientOne":"#cdd7ec","ambientTwo":"#e2d5e5"},"blossom":{"name":"Blossom","bg":"#faf2f4","surface":"#fffafb","surfaceMuted":"#f5e6e9","ink":"#402e34","muted":"#876f77","accent":"#a75f76","accentStrong":"#7f4559","accentSoft":"#f0d8df","word":"#8a6840","ambientOne":"#edcbd6","ambientTwo":"#f0ddc9"},"amber":{"name":"Amber","bg":"#f8f4e9","surface":"#fffef9","surfaceMuted":"#f3ead5","ink":"#3b3326","muted":"#7f7565","accent":"#a87932","accentStrong":"#7d5922","accentSoft":"#efdfbd","word":"#99614b","ambientOne":"#ecd9aa","ambientTwo":"#e6cfbf"}};

const LIBRARY_ROOT = "library";
const FONT_KEY = "korean-reader-font-size-v6";
const MOBILE_QUERY = window.matchMedia("(max-width: 900px)");

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

const state = {
  collections: [], stories: [], activeCollectionId: null, activeStory: null,
  selectedSentenceElement: null, readerSize: Number(storageGet(FONT_KEY)) || 1.36,
  themeTargetStoryId: null, longPressTimer: null, longPressTriggered: false,
};

const libraryView = document.getElementById("libraryView");
const readerView = document.getElementById("readerView");
const storyGrid = document.getElementById("storyGrid");
const searchInput = document.getElementById("searchInput");
const libraryBackButton = document.getElementById("libraryBackButton");
const libraryEyebrow = document.getElementById("libraryEyebrow");
const libraryTitle = document.getElementById("libraryTitle");
const librarySubtitle = document.getElementById("librarySubtitle");
const backButton = document.getElementById("backButton");
const readerTitle = document.getElementById("readerTitle");
const readerLevel = document.getElementById("readerLevel");
const storyContent = document.getElementById("storyContent");
const detailPanel = document.getElementById("detailPanel");
const detailContent = document.getElementById("detailContent");
const closeDetailButton = document.getElementById("closeDetailButton");
const themeButton = document.getElementById("themeButton");
const fontDownButton = document.getElementById("fontDownButton");
const fontUpButton = document.getElementById("fontUpButton");
const wordPopover = document.getElementById("wordPopover");
const themeMenu = document.getElementById("themeMenu");
const toast = document.getElementById("toast");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

function slugify(value) {
  return String(value || "collection").toLowerCase().normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "collection";
}

function basename(path) {
  const normalized = String(path || "").replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index < 0 ? normalized : normalized.slice(index + 1);
}

function numericOrder(path, fallback = 999) {
  const match = basename(path).match(/^(\d+)/);
  return match ? Number(match[1]) : fallback;
}

async function fetchJSON(url) {
  const response = await fetch(url, {cache: "no-cache"});
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function collectionFallbackFromEntry(entry = {}) {
  const directory = String(entry.directory || entry.id || "collection").replace(/^\/+|\/+$/g, "");
  const folderName = directory.split("/").filter(Boolean).pop() || "collection";
  const title = folderName.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return {
    id: entry.id || slugify(folderName),
    title,
    koreanTitle: "",
    description: "",
    level: "",
    theme: "sage",
    order: Number(entry.order) || 999,
    monogram: title.slice(0, 1).toUpperCase(),
    tags: [],
    sort: "order"
  };
}

function storyObjectsFromJSON(data) {
  if (Array.isArray(data)) return data.filter((item) => item && Array.isArray(item.paragraphs));
  if (Array.isArray(data?.stories)) return data.stories.filter((item) => item && Array.isArray(item.paragraphs));
  return data && Array.isArray(data.paragraphs) ? [data] : [];
}

function getGitHubRepository() {
  const match = window.location.hostname.match(/^([^.]+)\.github\.io$/i);
  if (!match) {
    throw new Error("This automatic folder loader works on GitHub Pages.");
  }

  const owner = match[1];
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const firstPart = pathParts[0] || "";
  const isUserSite = !firstPart || /\.(?:html?|php)$/i.test(firstPart);
  const repository = isUserSite ? `${owner}.github.io` : firstPart;

  return {owner, repository};
}

async function fetchGitHubContents(apiUrl) {
  const response = await fetch(apiUrl, {
    cache: "no-cache",
    headers: {Accept: "application/vnd.github+json"}
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error("GitHub API limit reached. Try reloading later.");
    }
    if (response.status === 404) {
      throw new Error(`Could not find ${LIBRARY_ROOT}/ in the GitHub repository.`);
    }
    throw new Error(`GitHub returned ${response.status} ${response.statusText}.`);
  }

  return response.json();
}

async function listGitHubDirectory(apiUrl) {
  const entries = await fetchGitHubContents(apiUrl);
  if (!Array.isArray(entries)) return [];

  const files = [];
  for (const entry of entries) {
    if (entry.type === "file") {
      files.push(entry);
    } else if (entry.type === "dir" && entry.url) {
      files.push(...await listGitHubDirectory(entry.url));
    }
  }
  return files;
}

function collectionFallbackFromFolder(folderName, order) {
  const title = String(folderName || "collection")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return {
    id: slugify(folderName),
    title,
    koreanTitle: "",
    description: "",
    level: "",
    theme: "sage",
    order,
    monogram: title.slice(0, 1).toUpperCase(),
    tags: [],
    sort: "order"
  };
}

async function loadStoryFile(file, collectionId, fallbackOrder, warnings, output) {
  try {
    const data = await fetchJSON(file.download_url);
    const storyObjects = storyObjectsFromJSON(data);
    if (!storyObjects.length) {
      throw new Error("the JSON does not contain a story with paragraphs");
    }

    storyObjects.forEach((story, nestedIndex) => {
      output.push(normalizeStory(
        {...story, sourcePath: file.download_url},
        file.path,
        collectionId,
        numericOrder(file.path, fallbackOrder + nestedIndex)
      ));
    });
  } catch (error) {
    warnings.push(`Could not load ${file.path}: ${error.message}`);
  }
}

async function loadLibrary() {
  const {owner, repository} = getGitHubRepository();
  const rootApiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${LIBRARY_ROOT}`;
  const rootEntries = await fetchGitHubContents(rootApiUrl);

  if (!Array.isArray(rootEntries)) {
    throw new Error(`${LIBRARY_ROOT}/ is not a directory.`);
  }

  const loadedCollections = [];
  const loadedStories = [];
  const warnings = [];
  const collectionDirectories = rootEntries.filter((entry) => entry.type === "dir");
  const rootStoryFiles = rootEntries.filter((entry) => entry.type === "file" && /\.json$/i.test(entry.name));

  await Promise.all(collectionDirectories.map(async (directory, collectionIndex) => {
    const files = await listGitHubDirectory(directory.url);
    const jsonFiles = files.filter((file) => /\.json$/i.test(file.name));
    const infoFile = jsonFiles.find((file) => /^(?:info|collection)\.json$/i.test(file.name));
    const storyFiles = jsonFiles.filter((file) => file !== infoFile);

    let collectionInfo = null;
    if (infoFile) {
      try {
        collectionInfo = await fetchJSON(infoFile.download_url);
      } catch (error) {
        warnings.push(`Could not load ${infoFile.path}: ${error.message}`);
      }
    }

    const fallback = collectionFallbackFromFolder(directory.name, collectionIndex + 1);
    const collection = normalizeCollection({...fallback, ...(collectionInfo || {})}, directory.path);
    loadedCollections.push(collection);

    await Promise.all(storyFiles.map((file, storyIndex) =>
      loadStoryFile(file, collection.id, (storyIndex + 1) * 100, warnings, loadedStories)
    ));
  }));

  const rootInfoNames = /^(?:info|collection|index)\.json$/i;
  const actualRootStories = rootStoryFiles.filter((file) => !rootInfoNames.test(file.name));
  await Promise.all(actualRootStories.map((file, storyIndex) =>
    loadStoryFile(file, "uncategorized", (storyIndex + 1) * 100, warnings, loadedStories)
  ));

  state.collections = loadedCollections;
  state.stories = loadedStories;
  ensureCollectionsForStories();

  if (!state.stories.length && !warnings.length) {
    warnings.push(`No story JSON files were found inside ${LIBRARY_ROOT}/.`);
  }

  warnings.forEach((warning) => console.warn(`[Korean Reader] ${warning}`));
  if (warnings.length) {
    showToast(`${warnings.length} library file${warnings.length === 1 ? "" : "s"} could not be loaded`);
  }
}
function saveLibrary() {
  // Stories are read-only website files. User preferences are stored separately.
}

function normalizeCollection(info = {}, fallbackPath = "") {
  const id = String(info.id || slugify(info.title || fallbackPath));
  return {
    type: "collection", id,
    title: String(info.title || id), koreanTitle: String(info.koreanTitle || ""),
    description: String(info.description || ""), level: String(info.level || ""),
    theme: THEMES[info.theme] ? info.theme : "sage",
    order: Number.isFinite(Number(info.order)) ? Number(info.order) : 999,
    monogram: String(info.monogram || (info.title || id).slice(0, 1).toUpperCase()),
    tags: Array.isArray(info.tags) ? info.tags.map(String) : [],
    storyCount: Number(info.storyCount) || 0, sort: String(info.sort || "order")
  };
}

function normalizeStory(story, sourceName = "Story file", fallbackCollectionId = "uncategorized", fallbackOrder = 999) {
  if (!story || typeof story !== "object" || !Array.isArray(story.paragraphs)) {
    throw new Error(`${sourceName} is not a Korean reader story.`);
  }
  story.paragraphs.forEach((paragraph, paragraphIndex) => {
    if (!paragraph || !Array.isArray(paragraph.sentences)) throw new Error(`Paragraph ${paragraphIndex + 1} needs a sentences array.`);
    paragraph.sentences.forEach((sentence, sentenceIndex) => {
      if (!sentence || typeof sentence.korean !== "string" || !sentence.korean.trim()) throw new Error(`Paragraph ${paragraphIndex + 1}, sentence ${sentenceIndex + 1} needs Korean text.`);
      sentence.translation = String(sentence.translation || "");
      sentence.grammar = Array.isArray(sentence.grammar) ? sentence.grammar : [];
      sentence.vocab = Array.isArray(sentence.vocab) ? sentence.vocab : [];
      sentence.words = Array.isArray(sentence.words) ? sentence.words : [];
    });
  });
  return {
    id: String(story.id || `${slugify(story.title || sourceName)}-${Date.now().toString(36)}`),
    title: String(story.title || sourceName.replace(/\.json$/i, "")),
    englishTitle: String(story.englishTitle || ""), level: String(story.level || ""),
    description: String(story.description || ""), theme: THEMES[story.theme] ? story.theme : "sage",
    collectionId: String(story.collectionId || fallbackCollectionId),
    order: Number.isFinite(Number(story.order)) ? Number(story.order) : fallbackOrder,
    sourcePath: String(story.sourcePath || ""), paragraphs: story.paragraphs
  };
}

function ensureCollectionsForStories() {
  const existing = new Set(state.collections.map((c) => c.id));
  state.stories.forEach((story) => {
    if (!existing.has(story.collectionId)) {
      state.collections.push(normalizeCollection({
        id: story.collectionId, title: story.collectionId === "uncategorized" ? "Other stories" : story.collectionId,
        koreanTitle: "다른 이야기", description: "Stories without collection metadata.",
        theme: "sage", order: 950, monogram: "文"
      }));
      existing.add(story.collectionId);
    }
  });
}

function getCollection(id) { return state.collections.find((collection) => collection.id === id); }
function getStoriesForCollection(id) {
  return state.stories.filter((story) => story.collectionId === id)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

function showCollections(push = false) {
  state.activeCollectionId = null; state.activeStory = null; clearDetails(); hideWordPopover(); hideThemeMenu();
  readerView.classList.remove("view-active"); libraryView.classList.add("view-active");
  searchInput.value = ""; renderLibrary(); window.scrollTo({top: 0, behavior: "auto"});
  if (push) history.pushState({view: "collections"}, "", "#library");
}

function showCollection(collectionId, push = false) {
  const collection = getCollection(collectionId); if (!collection) return showCollections(push);
  state.activeCollectionId = collectionId; state.activeStory = null; clearDetails(); hideWordPopover(); hideThemeMenu();
  readerView.classList.remove("view-active"); libraryView.classList.add("view-active");
  searchInput.value = ""; renderLibrary(); window.scrollTo({top: 0, behavior: "auto"});
  if (push) history.pushState({view: "collection", collectionId}, "", `#collection=${encodeURIComponent(collectionId)}`);
}

function renderLibrary(filter = "") {
  const query = filter.trim().toLowerCase();
  storyGrid.replaceChildren();
  if (!state.activeCollectionId) renderCollectionCards(query); else renderStoryCards(state.activeCollectionId, query);
}

function renderCollectionCards(query) {
  applyTheme("sage"); libraryBackButton.hidden = true;
  libraryEyebrow.textContent = "한국어 리더"; libraryTitle.textContent = "Your Korean library";
  librarySubtitle.textContent = "Choose a collection, then choose a story.";
  searchInput.placeholder = "Search collections";

  const collections = [...state.collections].sort((a,b) => a.order - b.order || a.title.localeCompare(b.title)).filter((collection) => {
    const stories = getStoriesForCollection(collection.id);
    const haystack = [collection.title, collection.koreanTitle, collection.description, collection.level, ...collection.tags, ...stories.flatMap((s) => [s.title, s.englishTitle])].join(" ").toLowerCase();
    return haystack.includes(query);
  });

  if (!collections.length) return renderEmpty("No collections found.");
  collections.forEach((collection) => storyGrid.appendChild(createCollectionCard(collection)));
}

function createCollectionCard(collection) {
  const theme = THEMES[collection.theme] || THEMES.sage;
  const stories = getStoriesForCollection(collection.id);
  const card = document.createElement("article");
  card.className = "story-card collection-card"; card.tabIndex = 0; card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open ${collection.title}`); setCardTheme(card, theme);

  const content = document.createElement("div"); content.className = "story-card-content";
  const topline = document.createElement("div"); topline.className = "collection-topline";
  const mark = createTextBlock("span", "collection-monogram", collection.monogram);
  const count = createTextBlock("span", "collection-count", `${stories.length} stor${stories.length === 1 ? "y" : "ies"}`);
  topline.append(mark, count); content.appendChild(topline);
  content.appendChild(createTextBlock("h2", "", collection.title));
  if (collection.koreanTitle) content.appendChild(createTextBlock("p", "collection-korean-title", collection.koreanTitle));
  if (collection.description) content.appendChild(createTextBlock("p", "description", collection.description));
  if (collection.tags.length) {
    const tags = document.createElement("div"); tags.className = "collection-tags";
    collection.tags.slice(0, 4).forEach((tag) => tags.appendChild(createTextBlock("span", "collection-tag", tag)));
    content.appendChild(tags);
  }
  const arrow = document.createElement("span"); arrow.className = "card-arrow";
  arrow.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  card.append(content, arrow);
  card.addEventListener("click", () => showCollection(collection.id, true));
  card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); showCollection(collection.id, true); } });
  return card;
}

function renderStoryCards(collectionId, query) {
  const collection = getCollection(collectionId); if (!collection) return showCollections(false);
  applyTheme(collection.theme); libraryBackButton.hidden = false;
  libraryEyebrow.textContent = collection.level || "STORY COLLECTION"; libraryTitle.textContent = collection.title;
  librarySubtitle.textContent = [collection.koreanTitle, collection.description].filter(Boolean).join(" · ");
  searchInput.placeholder = "Search stories";
  const stories = getStoriesForCollection(collectionId).filter((story) => [story.title, story.englishTitle, story.level, story.description].join(" ").toLowerCase().includes(query));
  if (!stories.length) return renderEmpty("No stories found in this collection.");
  stories.forEach((story) => storyGrid.appendChild(createStoryCard(story)));
}

function createStoryCard(story) {
  const theme = THEMES[story.theme] || THEMES.sage;
  const card = document.createElement("article"); card.className = "story-card"; card.tabIndex = 0; card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open ${story.title}`); setCardTheme(card, theme);
  const content = document.createElement("div"); content.className = "story-card-content";
  if (story.level) content.appendChild(createTextBlock("span", "story-level", story.level));
  content.appendChild(createTextBlock("h2", "", story.title));
  if (story.englishTitle) content.appendChild(createTextBlock("p", "english-title", story.englishTitle));
  if (story.description) content.appendChild(createTextBlock("p", "description", story.description));
  const arrow = document.createElement("span"); arrow.className = "card-arrow";
  arrow.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  const paletteButton = document.createElement("button"); paletteButton.className = "card-theme-button"; paletteButton.type = "button";
  paletteButton.setAttribute("aria-label", `Change color scheme for ${story.title}`);
  paletteButton.append(createThemeDot(theme.accent), createThemeDot(theme.accentSoft), createThemeDot(theme.word));
  paletteButton.addEventListener("click", (event) => { event.stopPropagation(); openThemeMenu(paletteButton, story.id); });
  card.append(content, arrow, paletteButton);
  card.addEventListener("click", () => openStory(story, true));
  card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openStory(story, true); } });
  return card;
}

function renderEmpty(message) { const empty = createTextBlock("div", "empty-state", message); storyGrid.appendChild(empty); }
function setCardTheme(card, theme) {
  card.style.setProperty("--card-bg", theme.surface); card.style.setProperty("--card-soft", theme.accentSoft);
  card.style.setProperty("--card-accent", theme.accent); card.style.setProperty("--card-accent-strong", theme.accentStrong);
}
function createThemeDot(color) { const dot = document.createElement("span"); dot.className = "card-theme-dot"; dot.style.setProperty("--dot", color); return dot; }

function openStory(story, push = false) {
  state.activeStory = story; state.activeCollectionId = story.collectionId; state.selectedSentenceElement = null;
  hideWordPopover(); hideThemeMenu(); clearDetails(); applyTheme(story.theme);
  readerTitle.textContent = story.title; readerLevel.textContent = story.level; renderStory(story);
  libraryView.classList.remove("view-active"); readerView.classList.add("view-active"); window.scrollTo({top: 0, behavior: "auto"});
  if (push) history.pushState({view: "reader", storyId: story.id, collectionId: story.collectionId}, "", `#story=${encodeURIComponent(story.id)}`);
}

function renderStory(story) {
  storyContent.replaceChildren();
  document.documentElement.style.setProperty("--reader-size", `${state.readerSize}rem`);

  story.paragraphs.forEach((paragraph) => {
    const paragraphElement = document.createElement("p");
    paragraphElement.className = "story-paragraph";

    paragraph.sentences.forEach((sentence, sentenceIndex) => {
      const sentenceElement = document.createElement("span");
      sentenceElement.className = "sentence";
      sentenceElement.tabIndex = 0;

      appendWordTokens(sentenceElement, sentence);

      sentenceElement.addEventListener("click", (event) => {
        if (event.defaultPrevented || state.longPressTriggered) {
          state.longPressTriggered = false;
          return;
        }
        event.stopPropagation();
        selectSentence(sentenceElement, sentence);
      });

      sentenceElement.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectSentence(sentenceElement, sentence);
        }
      });

      paragraphElement.appendChild(sentenceElement);

      if (sentenceIndex < paragraph.sentences.length - 1) {
        paragraphElement.appendChild(document.createTextNode(" "));
      }
    });

    storyContent.appendChild(paragraphElement);
  });
}

function appendWordTokens(container, sentence) {
  const lookup = buildWordLookup(sentence);
  const chunks = sentence.korean.split(/(\s+)/u);

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
    word.dataset.surface = clean || chunk;

    word.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showWordPopover(translation, event.clientX, event.clientY);
    });

    let pressStarted = false;

    word.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      pressStarted = true;
      state.longPressTriggered = false;
      clearTimeout(state.longPressTimer);
      state.longPressTimer = window.setTimeout(() => {
        if (!pressStarted) return;
        state.longPressTriggered = true;
        showWordPopover(translation, event.clientX, event.clientY);
        if (navigator.vibrate) navigator.vibrate(20);
        window.setTimeout(() => {
          state.longPressTriggered = false;
        }, 900);
      }, 560);
    });

    const cancelLongPress = () => {
      pressStarted = false;
      clearTimeout(state.longPressTimer);
    };

    word.addEventListener("pointerup", cancelLongPress);
    word.addEventListener("pointercancel", cancelLongPress);
    word.addEventListener("pointerleave", cancelLongPress);

    word.addEventListener("click", (event) => {
      if (state.longPressTriggered) {
        event.preventDefault();
        event.stopPropagation();
        window.setTimeout(() => {
          state.longPressTriggered = false;
        }, 0);
      }
    });

    container.appendChild(word);
  });
}

function cleanToken(token) {
  return token
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
      base: String(entry.base || ""),
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
        base: "",
        note: String(entry.note || "")
      });
    }
  });

  return lookup;
}

function selectSentence(element, sentence) {
  hideWordPopover();
  clearSentenceSelection();

  state.selectedSentenceElement = element;
  element.classList.add("sentence-selected");
  renderSentenceDetails(sentence);

  detailPanel.classList.remove("detail-panel-empty");
  if (MOBILE_QUERY.matches) {
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => detailPanel.classList.add("detail-panel-open"));
  }
}

function clearSentenceSelection() {
  if (state.selectedSentenceElement) {
    state.selectedSentenceElement.classList.remove("sentence-selected");
  }
  state.selectedSentenceElement = null;
}

function renderSentenceDetails(sentence) {
  detailContent.replaceChildren();

  detailContent.append(
    createLabel("Sentence"),
    createTextBlock("p", "detail-korean", sentence.korean),
    createLabel("Translation"),
    createTextBlock("p", "detail-translation", sentence.translation || "—")
  );

  if (sentence.grammar?.length) {
    detailContent.appendChild(createLabel("Grammar & usage"));

    const list = document.createElement("div");
    list.className = "grammar-list";

    sentence.grammar.forEach((item) => {
      const card = document.createElement("section");
      card.className = "grammar-card";

      if (typeof item === "string") {
        card.appendChild(createTextBlock("p", "grammar-explanation", item));
      } else {
        if (item.pattern) {
          card.appendChild(createTextBlock("p", "grammar-pattern", item.pattern));
        }
        if (item.explanation) {
          card.appendChild(createTextBlock("p", "grammar-explanation", item.explanation));
        }
        if (item.example) {
          card.appendChild(createTextBlock("p", "grammar-example", item.example));
        }
      }

      list.appendChild(card);
    });

    detailContent.appendChild(list);
  }

  if (sentence.vocab?.length) {
    detailContent.appendChild(createLabel("Key vocabulary"));

    const list = document.createElement("div");
    list.className = "vocab-list";

    sentence.vocab.forEach((item) => {
      const row = document.createElement("section");
      row.className = "vocab-row";
      row.appendChild(createTextBlock("p", "vocab-term", item.word || ""));
      if (item.meaning) row.appendChild(createTextBlock("p", "vocab-meaning", item.meaning));
      if (item.note) row.appendChild(createTextBlock("p", "vocab-note", item.note));
      list.appendChild(row);
    });

    detailContent.appendChild(list);
  }
}

function clearDetails() {
  clearSentenceSelection();
  detailPanel.classList.remove("detail-panel-open");
  detailPanel.classList.add("detail-panel-empty");
  detailContent.replaceChildren();
  document.body.style.overflow = "";
}

function createLabel(text) {
  return createTextBlock("p", "detail-label", text);
}

function createTextBlock(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function showWordPopover(word, clientX, clientY) {
  clearTimeout(state.longPressTimer);
  wordPopover.replaceChildren();

  wordPopover.appendChild(createTextBlock("strong", "", word.surface || ""));
  wordPopover.appendChild(createTextBlock("p", "", word.meaning || "—"));
  if (word.base) wordPopover.appendChild(createTextBlock("p", "word-base", word.base));
  if (word.note) wordPopover.appendChild(createTextBlock("p", "word-note", word.note));

  wordPopover.setAttribute("aria-hidden", "false");
  wordPopover.classList.add("word-popover-visible");

  if (!MOBILE_QUERY.matches) {
    requestAnimationFrame(() => positionWordPopover(clientX, clientY));
  }
}

function positionWordPopover(clientX, clientY) {
  const rect = wordPopover.getBoundingClientRect();
  const margin = 14;

  let left = clientX + 12;
  let top = clientY + 12;

  if (left + rect.width > window.innerWidth - margin) {
    left = clientX - rect.width - 12;
  }
  if (top + rect.height > window.innerHeight - margin) {
    top = clientY - rect.height - 12;
  }

  wordPopover.style.left = `${Math.max(margin, left)}px`;
  wordPopover.style.top = `${Math.max(margin, top)}px`;
}

function hideWordPopover() {
  wordPopover.classList.remove("word-popover-visible");
  wordPopover.setAttribute("aria-hidden", "true");
}



function openThemeMenu(anchor, storyId) {
  state.themeTargetStoryId = storyId;
  renderThemeChoices();
  themeMenu.setAttribute("aria-hidden", "false");
  themeMenu.classList.add("theme-menu-open");
  requestAnimationFrame(() => {
    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = themeMenu.getBoundingClientRect();
    const margin = 12;
    let left = anchorRect.right - menuRect.width;
    let top = anchorRect.bottom + 9;
    if (left < margin) left = margin;
    if (left + menuRect.width > window.innerWidth - margin) left = window.innerWidth - menuRect.width - margin;
    if (top + menuRect.height > window.innerHeight - margin) top = anchorRect.top - menuRect.height - 9;
    themeMenu.style.left = `${left}px`;
    themeMenu.style.top = `${Math.max(margin, top)}px`;
  });
}

function renderThemeChoices() {
  themeMenu.replaceChildren();
  const story = state.stories.find((item) => item.id === state.themeTargetStoryId);
  const currentTheme = effectiveThemeKeyV7(story);
  Object.entries(THEMES).forEach(([key, theme]) => {
    const choice = document.createElement("button");
    choice.type = "button"; choice.className = "theme-choice"; choice.setAttribute("role", "menuitem");
    choice.setAttribute("aria-label", theme.name); choice.title = theme.name;
    choice.style.setProperty("--choice-bg", theme.surfaceMuted);
    choice.style.setProperty("--choice-accent", theme.accent);
    choice.style.setProperty("--choice-soft", theme.accentSoft);
    if (key === currentTheme) choice.classList.add("theme-choice-selected");
    choice.addEventListener("click", (event) => {
      event.stopPropagation();
      const targetStoryId = state.themeTargetStoryId;
      setStoryTheme(targetStoryId, key);
      hideThemeMenu();
    });
    themeMenu.appendChild(choice);
  });
}

function setStoryTheme(storyId, themeKey) {
  const story = state.stories.find((item) => item.id === storyId);
  if (!story || !THEMES[themeKey]) return;
  const groupId = groupIdFor(story);
  state.accentSelections[groupId] = themeKey;
  saveAccentSelectionsV7();

  /* Keep every variant synchronized, including every loaded story version. */
  getVariants(groupId).forEach((variant) => { variant.theme = themeKey; });
  saveLibrary();

  if (state.activeStory && groupIdFor(state.activeStory) === groupId) {
    state.activeStory.theme = themeKey;
    applyTheme(themeKey);
    themeButton.setAttribute("aria-label", `Story accent: ${THEMES[themeKey].name}`);
    themeButton.title = `Story accent: ${THEMES[themeKey].name}`;
  } else {
    renderLibrary(searchInput.value);
  }
}

function applyTheme(themeKey) {
  const theme = THEMES[themeKey] || THEMES.sage;
  const root = document.documentElement;
  root.style.setProperty("--bg", theme.bg); root.style.setProperty("--surface", `${theme.surface}d9`);
  root.style.setProperty("--surface-solid", theme.surface); root.style.setProperty("--surface-muted", theme.surfaceMuted);
  root.style.setProperty("--ink", theme.ink); root.style.setProperty("--muted", theme.muted);
  root.style.setProperty("--accent", theme.accent); root.style.setProperty("--accent-strong", theme.accentStrong);
  root.style.setProperty("--accent-soft", theme.accentSoft); root.style.setProperty("--word", theme.word);
  root.style.setProperty("--ambient-one", theme.ambientOne); root.style.setProperty("--ambient-two", theme.ambientTwo);
  themeColorMeta.setAttribute("content", theme.bg);
}

function hideThemeMenu() {
  themeMenu.classList.remove("theme-menu-open"); themeMenu.setAttribute("aria-hidden", "true"); state.themeTargetStoryId = null;
}

function changeReaderSize(delta) {
  state.readerSize = Math.min(2.05, Math.max(1.0, state.readerSize + delta));
  state.readerSize = Math.round(state.readerSize * 100) / 100;
  document.documentElement.style.setProperty("--reader-size", `${state.readerSize}rem`);
  storageSet(FONT_KEY, String(state.readerSize));
}

let toastTimer;
function showToast(message) {
  toast.textContent = message; toast.classList.add("toast-visible"); clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("toast-visible"), 3000);
}

function renderNavigation(nav) {
  if (nav?.view === "reader") {
    const story = state.stories.find((item) => item.id === nav.storyId);
    if (story) return openStory(story, false);
  }
  if (nav?.view === "collection" && getCollection(nav.collectionId)) return showCollection(nav.collectionId, false);
  showCollections(false);
}

searchInput.addEventListener("input", () => renderLibrary(searchInput.value));
libraryBackButton.addEventListener("click", () => history.back());
backButton.addEventListener("click", () => history.back());
closeDetailButton.addEventListener("click", clearDetails);
fontDownButton.addEventListener("click", () => changeReaderSize(-0.1));
fontUpButton.addEventListener("click", () => changeReaderSize(0.1));
themeButton.addEventListener("click", (event) => { event.stopPropagation(); if (state.activeStory) openThemeMenu(themeButton, state.activeStory.id); });
storyContent.addEventListener("click", (event) => { if (!event.target.closest(".sentence")) clearDetails(); });

document.addEventListener("click", (event) => {
  if (!event.target.closest(".word-popover") && !event.target.closest(".word-token")) hideWordPopover();
  if (!event.target.closest(".theme-menu") && !event.target.closest(".card-theme-button") && event.target !== themeButton) hideThemeMenu();
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { hideWordPopover(); hideThemeMenu(); clearDetails(); } });
window.addEventListener("resize", () => { hideWordPopover(); hideThemeMenu(); if (!MOBILE_QUERY.matches) { detailPanel.classList.remove("detail-panel-open"); document.body.style.overflow = ""; } });
window.addEventListener("scroll", () => { hideWordPopover(); hideThemeMenu(); }, {passive: true});
window.addEventListener("popstate", (event) => renderNavigation(event.state || {view: "collections"}));


/* =========================================================
   V8 behavior patch
   ========================================================= */
const READ_KEY_V6 = "korean-reader-read-v6";
const VARIANT_KEY_V6 = "korean-reader-variants-v6";
const APPEARANCE_KEY_V6 = "korean-reader-appearance-v6";
const ACCENT_KEY_V7 = "korean-reader-story-accents-v7";

const APPEARANCES = {
  light: {
    name: "Light", symbol: "☀", bg: "#f4f5ef", surface: "#fffefa", surfaceMuted: "#edf3ee",
    ink: "#20342f", muted: "#71807b", ambientOne: "#d9e7dc", ambientTwo: "#eee1cf"
  },
  warm: {
    name: "Warm", symbol: "◒", bg: "#f6f0e7", surface: "#fffaf2", surfaceMuted: "#eee4d6",
    ink: "#342d27", muted: "#7e7269", ambientOne: "#ead7bf", ambientTwo: "#e8cfc4"
  },
  forest: {
    name: "Forest", symbol: "♧", bg: "#eaf0e9", surface: "#fbfdf9", surfaceMuted: "#dfe9de",
    ink: "#243328", muted: "#68766b", ambientOne: "#c7dccb", ambientTwo: "#d9dfc5"
  },
  dark: {
    name: "Dark", symbol: "☾", bg: "#15191d", surface: "#22272c", surfaceMuted: "#2c3339",
    ink: "#f0f3f2", muted: "#aeb8b4", ambientOne: "#253c34", ambientTwo: "#3b302a"
  }
};

function loadJSONV6(key, fallback) {
  try { return JSON.parse(storageGet(key) || "null") ?? fallback; } catch { return fallback; }
}

state.readGroups = loadJSONV6(READ_KEY_V6, {});
state.variantSelections = loadJSONV6(VARIANT_KEY_V6, {});
state.appearance = APPEARANCES[storageGet(APPEARANCE_KEY_V6)] ? storageGet(APPEARANCE_KEY_V6) : "light";
state.accentSelections = loadJSONV6(ACCENT_KEY_V7, {});
state.variantTargetGroupId = null;
state.lastWordTap = {element: null, time: 0};
state.suppressSentenceClickUntil = 0;

const libraryAppearanceButton = document.getElementById("libraryAppearanceButton");
const readerAppearanceButton = document.getElementById("readerAppearanceButton");
const readerReadButton = document.getElementById("readerReadButton");
const variantMenu = document.getElementById("variantMenu");
const appearanceMenu = document.getElementById("appearanceMenu");

const normalizeStoryV3Base = normalizeStory;
normalizeStory = function(story, sourceName = "Story file", fallbackCollectionId = "uncategorized", fallbackOrder = 999) {
  const normalized = normalizeStoryV3Base(story, sourceName, fallbackCollectionId, fallbackOrder);
  normalized.variantGroupId = String(story.variantGroupId || story.groupId || normalized.id);
  normalized.difficultyOrder = Number.isFinite(Number(story.difficultyOrder)) ? Number(story.difficultyOrder) : normalized.order;
  normalized.variantLabel = String(story.variantLabel || story.level || normalized.level || "Version");
  normalized.thumbnail = String(story.thumbnail || story.cover || story.coverImage || "");
  return normalized;
};

function saveReadV6() { storageSet(READ_KEY_V6, JSON.stringify(state.readGroups)); }
function saveVariantsV6() { storageSet(VARIANT_KEY_V6, JSON.stringify(state.variantSelections)); }
function saveAccentSelectionsV7() { storageSet(ACCENT_KEY_V7, JSON.stringify(state.accentSelections)); }
function uniqueStoriesV7(stories) {
  const unique = new Map();
  (stories || []).forEach((story) => {
    if (story?.id && !unique.has(story.id)) unique.set(story.id, story);
  });
  return [...unique.values()];
}
function effectiveThemeKeyV7(story) {
  if (!story) return "sage";
  const groupId = groupIdFor(story);
  const selected = state.accentSelections[groupId];
  return THEMES[selected] ? selected : (THEMES[story.theme] ? story.theme : "sage");
}

function escapeXmlV8(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[char]);
}

function splitCoverTextV8(value, maxCharacters = 12, maxLines = 2) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const words = raw.split(/\s+/u);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    if (!current) {
      current = word;
    } else if ((current + " " + word).length <= maxCharacters) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);

  if (lines.length === 1 && lines[0].length > maxCharacters && !/\s/u.test(lines[0])) {
    const compact = lines[0];
    lines.length = 0;
    for (let index = 0; index < compact.length; index += maxCharacters) {
      lines.push(compact.slice(index, index + maxCharacters));
    }
  }

  const limited = lines.slice(0, maxLines);
  if (lines.length > maxLines && limited.length) {
    limited[limited.length - 1] = limited[limited.length - 1].replace(/[.…]*$/u, "") + "…";
  }
  return limited;
}

function shortEnglishTitleV8(story) {
  const full = String(story?.englishTitle || "").trim();
  if (!full) return "KOREAN READER";
  const pieces = full.split(/\s+[—–-]\s+/u);
  return (pieces[pieces.length - 1] || full).trim();
}

function generatedStoryThumbnailV8(story, accent) {
  const titleLines = splitCoverTextV8(story?.title || "이야기", 8, 2);
  const englishLines = splitCoverTextV8(shortEnglishTitleV8(story), 18, 2);
  const collection = getCollection(story?.collectionId);
  const monogram = escapeXmlV8(collection?.monogram || String(story?.title || "문").slice(0, 1));
  const storyTitle = titleLines.map((line, index) =>
    `<tspan x="22" dy="${index === 0 ? 0 : 29}">${escapeXmlV8(line)}</tspan>`
  ).join("");
  const englishTitle = englishLines.map((line, index) =>
    `<tspan x="22" dy="${index === 0 ? 0 : 15}">${escapeXmlV8(line)}</tspan>`
  ).join("");

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="240" height="320" viewBox="0 0 240 320">
    <defs>
      <linearGradient id="coverGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${accent.accentSoft}"/>
        <stop offset=".52" stop-color="${accent.accent}"/>
        <stop offset="1" stop-color="${accent.accentStrong}"/>
      </linearGradient>
      <linearGradient id="coverShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000000" stop-opacity=".46"/>
      </linearGradient>
    </defs>
    <rect width="240" height="320" rx="24" fill="url(#coverGradient)"/>
    <circle cx="199" cy="52" r="76" fill="#ffffff" fill-opacity=".13"/>
    <circle cx="28" cy="167" r="67" fill="#ffffff" fill-opacity=".08"/>
    <path d="M-10 205 C42 157 77 230 132 181 C167 150 195 155 255 112 L255 335 L-10 335Z"
          fill="#ffffff" fill-opacity=".11"/>
    <text x="120" y="145" text-anchor="middle" fill="#ffffff" fill-opacity=".23"
          font-size="96" font-weight="900"
          font-family="Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif">${monogram}</text>
    <rect x="0" y="170" width="240" height="150" fill="url(#coverShade)"/>
    <text x="22" y="218" fill="#ffffff" font-size="25" font-weight="850"
          font-family="Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif">${storyTitle}</text>
    <text x="22" y="278" fill="#ffffff" fill-opacity=".76" font-size="11" font-weight="720"
          letter-spacing=".45"
          font-family="Inter, Arial, sans-serif">${englishTitle}</text>
    <rect x="17" y="17" width="49" height="20" rx="10" fill="#ffffff" fill-opacity=".20"/>
    <text x="41.5" y="31" text-anchor="middle" fill="#ffffff" font-size="8.5" font-weight="850"
          letter-spacing=".9" font-family="Inter, Arial, sans-serif">STORY</text>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function storyThumbnailSourceV8(story, accent) {
  return story?.thumbnail || generatedStoryThumbnailV8(story, accent);
}

function createStoryThumbnailV8(story, accent) {
  const wrapper = document.createElement("div");
  wrapper.className = "story-thumbnail";
  wrapper.setAttribute("aria-hidden", "true");

  const image = document.createElement("img");
  const fallback = generatedStoryThumbnailV8(story, accent);
  image.src = storyThumbnailSourceV8(story, accent);
  image.alt = "";
  image.decoding = "async";
  image.loading = "eager";
  image.addEventListener("error", () => {
    if (image.src !== fallback) image.src = fallback;
  }, {once: true});

  wrapper.appendChild(image);
  return wrapper;
}
function groupIdFor(story) { return story?.variantGroupId || story?.id || ""; }
function isGroupRead(groupId) { return Boolean(state.readGroups[groupId]); }
function setGroupRead(groupId, value) { state.readGroups[groupId] = Boolean(value); saveReadV6(); }

function getVariantGroupsForCollection(collectionId) {
  const groups = new Map();
  getStoriesForCollection(collectionId).forEach((story, index) => {
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

function collectionGroupIds(collectionId) {
  return getVariantGroupsForCollection(collectionId).map((group) => group.groupId);
}

function isCollectionRead(collectionId) {
  const ids = collectionGroupIds(collectionId);
  return ids.length > 0 && ids.every(isGroupRead);
}

function setCollectionRead(collectionId, value) {
  collectionGroupIds(collectionId).forEach((id) => { state.readGroups[id] = Boolean(value); });
  saveReadV6();
}

function sortedByRead(items, readFn, orderFn) {
  return [...items].sort((a, b) => Number(readFn(a)) - Number(readFn(b)) || orderFn(a, b));
}

function makeReadToggle(active, label, onToggle) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `read-toggle${active ? " active" : ""}`;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.addEventListener("click", (event) => {
    event.preventDefault(); event.stopPropagation(); onToggle();
  });
  return button;
}

renderCollectionCards = function(query) {
  applyTheme("sage"); libraryBackButton.hidden = true;
  libraryEyebrow.textContent = "한국어 리더"; libraryTitle.textContent = "Your Korean library";
  librarySubtitle.textContent = "Choose a collection, then choose a story.";
  searchInput.placeholder = "Search collections";

  let collections = state.collections.filter((collection) => {
    const stories = getStoriesForCollection(collection.id);
    const haystack = [collection.title, collection.koreanTitle, collection.description, collection.level, ...collection.tags, ...stories.flatMap((s) => [s.title, s.englishTitle, s.level])].join(" ").toLowerCase();
    return haystack.includes(query);
  });
  collections = sortedByRead(collections, (c) => isCollectionRead(c.id), (a,b) => a.order - b.order || a.title.localeCompare(b.title));
  if (!collections.length) return renderEmpty("No collections found.");
  collections.forEach((collection) => storyGrid.appendChild(createCollectionCard(collection)));
};

createCollectionCard = function(collection) {
  const accent = THEMES[collection.theme] || THEMES.sage;
  const groups = getVariantGroupsForCollection(collection.id);
  const readCount = groups.filter((group) => isGroupRead(group.groupId)).length;
  const complete = groups.length > 0 && readCount === groups.length;
  const card = document.createElement("article");
  card.className = `story-card collection-card${complete ? " is-read" : ""}`;
  card.tabIndex = 0; card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open ${collection.title}`); setCardTheme(card, accent);

  const content = document.createElement("div"); content.className = "story-card-content";
  const topline = document.createElement("div"); topline.className = "collection-topline";
  const mark = createTextBlock("span", "collection-monogram", collection.monogram);
  const countText = readCount ? `${readCount}/${groups.length} read` : `${groups.length} stor${groups.length === 1 ? "y" : "ies"}`;
  const count = createTextBlock("span", "collection-count", countText);
  topline.append(mark, count); content.appendChild(topline);
  content.appendChild(createTextBlock("h2", "", collection.title));
  if (collection.koreanTitle) content.appendChild(createTextBlock("p", "collection-korean-title", collection.koreanTitle));
  if (collection.description) content.appendChild(createTextBlock("p", "description", collection.description));
  if (collection.tags.length) {
    const tags = document.createElement("div"); tags.className = "collection-tags";
    collection.tags.slice(0, 4).forEach((tag) => tags.appendChild(createTextBlock("span", "collection-tag", tag)));
    content.appendChild(tags);
  }
  const arrow = document.createElement("span"); arrow.className = "card-arrow";
  arrow.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  const readButton = makeReadToggle(complete, complete ? `Mark ${collection.title} unread` : `Mark all stories in ${collection.title} read`, () => {
    setCollectionRead(collection.id, !isCollectionRead(collection.id)); renderLibrary(searchInput.value);
  });
  card.append(content, arrow, readButton);
  card.addEventListener("click", () => showCollection(collection.id, true));
  card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); showCollection(collection.id, true); } });
  return card;
};

renderStoryCards = function(collectionId, query) {
  const collection = getCollection(collectionId); if (!collection) return showCollections(false);
  applyTheme(collection.theme); libraryBackButton.hidden = false;
  libraryEyebrow.textContent = collection.level || "STORY COLLECTION"; libraryTitle.textContent = collection.title;
  librarySubtitle.textContent = [collection.koreanTitle, collection.description].filter(Boolean).join(" · ");
  searchInput.placeholder = "Search stories";

  let groups = getVariantGroupsForCollection(collectionId).filter((group) => group.variants.some((story) =>
    [story.title, story.englishTitle, story.level, story.description].join(" ").toLowerCase().includes(query)
  ));
  groups = sortedByRead(groups, (group) => isGroupRead(group.groupId), (a,b) => a.index - b.index);
  if (!groups.length) return renderEmpty("No stories found in this collection.");
  groups.forEach((group) => storyGrid.appendChild(createStoryCard(group)));
};

createStoryCard = function(group) {
  group.variants = uniqueStoriesV7(group.variants);
  const story = selectedVariantForGroup(group);
  const variants = getVariants(group.groupId);
  const hasVariants = variants.length > 1;
  const themeKey = effectiveThemeKeyV7(story);
  const accent = THEMES[themeKey] || THEMES.sage;
  const read = isGroupRead(group.groupId);
  const card = document.createElement("article");
  card.className = `story-card${read ? " is-read" : ""}`;
  card.tabIndex = 0; card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open ${story.title}`); setCardTheme(card, accent);

  card.classList.add("has-story-thumbnail");
  const thumbnail = createStoryThumbnailV8(story, accent);
  const content = document.createElement("div"); content.className = "story-card-content";
  if (story.level) {
    if (hasVariants) {
      const level = createTextBlock("button", "story-level story-level-button has-variants", story.level);
      level.type = "button";
      level.dataset.versionLabel = `${variants.length}`;
      level.setAttribute("aria-label", `Choose among ${variants.length} versions of ${story.title}`);
      level.title = `${variants.length} versions available`;
      level.addEventListener("click", (event) => { event.stopPropagation(); openVariantMenu(level, group.groupId); });
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

  const arrow = document.createElement("span"); arrow.className = "card-arrow";
  arrow.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  const paletteButton = document.createElement("button"); paletteButton.className = "card-theme-button"; paletteButton.type = "button";
  paletteButton.setAttribute("aria-label", `Change story accent for ${story.title}`);
  paletteButton.append(createThemeDot(accent.accent), createThemeDot(accent.accentSoft), createThemeDot(accent.word));
  paletteButton.addEventListener("click", (event) => { event.stopPropagation(); openThemeMenu(paletteButton, story.id); });
  const readButton = makeReadToggle(read, read ? `Mark ${story.title} unread` : `Mark ${story.title} read`, () => {
    setGroupRead(group.groupId, !isGroupRead(group.groupId)); renderLibrary(searchInput.value);
  });
  card.append(content, thumbnail, arrow, paletteButton, readButton);
  card.addEventListener("click", () => openStory(story, true));
  card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openStory(story, true); } });
  return card;
};

openStory = function(story, push = false) {
  const groupId = groupIdFor(story);
  const variants = getVariants(groupId);
  const hasVariants = variants.length > 1;
  selectVariantV6(groupId, story.id);
  state.activeStory = story; state.activeCollectionId = story.collectionId; state.selectedSentenceElement = null;
  hideWordPopover(); hideThemeMenu(); hideVariantMenu(); hideAppearanceMenu(); clearDetails();
  applyTheme(effectiveThemeKeyV7(story));
  readerTitle.textContent = story.title;
  readerLevel.textContent = story.level;
  readerLevel.classList.toggle("has-variants", hasVariants);
  readerLevel.classList.toggle("single-version", !hasVariants);
  readerLevel.disabled = !hasVariants;
  readerLevel.dataset.versionLabel = hasVariants ? `${variants.length}` : "";
  readerLevel.setAttribute("aria-label", hasVariants
    ? `Choose among ${variants.length} versions of ${story.title}`
    : `${story.level || "Story level"}; only one version available`);
  readerLevel.title = hasVariants ? `${variants.length} versions available` : "Only one version available";
  readerReadButton.classList.toggle("active", isGroupRead(groupId));
  readerReadButton.setAttribute("aria-label", isGroupRead(groupId) ? "Mark story unread" : "Mark story as read");
  readerReadButton.title = isGroupRead(groupId) ? "Mark unread" : "Mark as read";
  renderStory(story);
  libraryView.classList.remove("view-active"); readerView.classList.add("view-active"); window.scrollTo({top: 0, behavior: "auto"});
  if (push) history.pushState({view: "reader", storyId: story.id, collectionId: story.collectionId}, "", `#story=${encodeURIComponent(story.id)}`);
};

appendWordTokens = function(container, sentence) {
  const lookup = buildWordLookup(sentence);
  const chunks = sentence.korean.split(/(\s+)/u);
  chunks.forEach((chunk) => {
    if (!chunk) return;
    if (/^\s+$/u.test(chunk)) { container.appendChild(document.createTextNode(chunk)); return; }
    const clean = cleanToken(chunk);
    const translation = lookup.get(clean) || {
      surface: clean || chunk,
      meaning: "No individual translation is stored for this word yet.",
      note: "Add it to the sentence’s words list in the JSON story file."
    };
    const word = document.createElement("span");
    word.className = "word-token"; word.textContent = chunk; word.dataset.surface = clean || chunk;

    word.addEventListener("dblclick", (event) => {
      event.preventDefault(); event.stopPropagation();
      state.suppressSentenceClickUntil = Date.now() + 450;
      showWordPopover(translation, event.clientX, event.clientY);
    });

    word.addEventListener("pointerup", (event) => {
      if (event.pointerType === "mouse") return;
      event.preventDefault(); event.stopPropagation();
      const now = Date.now();
      const sameWord = state.lastWordTap.element === word;
      if (sameWord && now - state.lastWordTap.time < 370) {
        clearTimeout(state.wordTapTimer);
        state.suppressSentenceClickUntil = now + 500;
        showWordPopover(translation, event.clientX, event.clientY);
        state.lastWordTap = {element: null, time: 0};
      } else {
        clearTimeout(state.wordTapTimer);
        state.lastWordTap = {element: word, time: now};
        state.wordTapTimer = window.setTimeout(() => {
          if (state.lastWordTap.element === word && state.lastWordTap.time === now) {
            state.lastWordTap = {element: null, time: 0};
            selectSentence(container, sentence);
          }
        }, 390);
      }
    }, {passive: false});

    word.addEventListener("click", (event) => {
      if (event.detail === 0 || Date.now() < state.suppressSentenceClickUntil || state.lastWordTap.element === word) {
        event.preventDefault(); event.stopPropagation();
      }
    });

    word.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); showWordPopover(translation, innerWidth / 2, innerHeight / 2); }
    });
    container.appendChild(word);
  });
};

const renderStoryV3Base = renderStory;
renderStory = function(story) {
  renderStoryV3Base(story);
  storyContent.querySelectorAll(".sentence").forEach((sentenceElement) => {
    sentenceElement.addEventListener("click", (event) => {
      if (Date.now() < state.suppressSentenceClickUntil) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
  });
};

function mixHexV6(a, b, amount) {
  const parse = (hex) => {
    const h = String(hex).replace("#", "");
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  };
  const x = parse(a), y = parse(b);
  return "#" + x.map((v,i) => Math.round(v * (1-amount) + y[i] * amount).toString(16).padStart(2,"0")).join("");
}

setCardTheme = function(card, accent) {
  const appearance = APPEARANCES[state.appearance] || APPEARANCES.light;
  const dark = state.appearance === "dark";
  card.style.setProperty("--card-bg", appearance.surface);
  card.style.setProperty("--card-soft", mixHexV6(accent.accent, appearance.surfaceMuted, dark ? .72 : .82));
  card.style.setProperty("--card-accent", dark ? mixHexV6(accent.accent, "#ffffff", .28) : accent.accent);
  card.style.setProperty("--card-accent-strong", dark ? mixHexV6(accent.accent, "#ffffff", .46) : accent.accentStrong);
};

applyTheme = function(themeKey) {
  const accent = THEMES[themeKey] || THEMES.sage;
  const appearance = APPEARANCES[state.appearance] || APPEARANCES.light;
  const dark = state.appearance === "dark";
  const root = document.documentElement;
  root.style.setProperty("--bg", appearance.bg);
  root.style.setProperty("--surface", dark ? `${appearance.surface}e8` : `${appearance.surface}d9`);
  root.style.setProperty("--surface-solid", appearance.surface);
  root.style.setProperty("--surface-muted", appearance.surfaceMuted);
  root.style.setProperty("--ink", appearance.ink);
  root.style.setProperty("--muted", appearance.muted);
  root.style.setProperty("--accent", dark ? mixHexV6(accent.accent, "#ffffff", .25) : accent.accent);
  root.style.setProperty("--accent-strong", dark ? mixHexV6(accent.accent, "#ffffff", .43) : accent.accentStrong);
  root.style.setProperty("--accent-soft", dark ? mixHexV6(accent.accent, appearance.surfaceMuted, .72) : accent.accentSoft);
  root.style.setProperty("--word", dark ? mixHexV6(accent.word, "#ffffff", .28) : accent.word);
  root.style.setProperty("--ambient-one", dark ? mixHexV6(accent.accent, appearance.bg, .55) : accent.ambientOne);
  root.style.setProperty("--ambient-two", dark ? mixHexV6(accent.word, appearance.bg, .62) : accent.ambientTwo);
  if (dark) {
    root.style.setProperty("--word-popover-bg", "#f4f7f5");
    root.style.setProperty("--word-popover-text", "#18211d");
    root.style.setProperty("--word-popover-heading", mixHexV6(accent.accentStrong, "#18211d", .28));
    root.style.setProperty("--word-popover-muted", "#58645f");
  } else {
    root.style.setProperty("--word-popover-bg", "#17211e");
    root.style.setProperty("--word-popover-text", "#ffffff");
    root.style.setProperty("--word-popover-heading", mixHexV6(accent.accentSoft, "#ffffff", .38));
    root.style.setProperty("--word-popover-muted", "rgba(255,255,255,.72)");
  }
  themeColorMeta.setAttribute("content", appearance.bg);
};

function positionFloatingMenu(menu, anchor) {
  requestAnimationFrame(() => {
    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const margin = 12;
    let left = anchorRect.right - menuRect.width;
    let top = anchorRect.bottom + 9;
    if (left < margin) left = margin;
    if (left + menuRect.width > innerWidth - margin) left = innerWidth - menuRect.width - margin;
    if (top + menuRect.height > innerHeight - margin) top = anchorRect.top - menuRect.height - 9;
    menu.style.left = `${Math.max(margin, left)}px`;
    menu.style.top = `${Math.max(margin, top)}px`;
  });
}

function openVariantMenu(anchor, groupId) {
  const variants = uniqueStoriesV7(getVariants(groupId));
  if (variants.length < 2) return;
  hideAppearanceMenu(); hideThemeMenu();
  state.variantTargetGroupId = groupId;
  variantMenu.replaceChildren();
  const currentId = state.activeStory && groupIdFor(state.activeStory) === groupId ? state.activeStory.id : (state.variantSelections[groupId] || variants[0].id);
  variants.forEach((variant) => {
    const choice = document.createElement("button");
    choice.type = "button"; choice.className = `variant-choice${variant.id === currentId ? " selected" : ""}`;
    const shortLevel = String(variant.level || "").replace(/^TOPIK\s*/i, "") || "•";
    const mark = createTextBlock("span", "variant-choice-mark", shortLevel);
    const copy = document.createElement("span");
    copy.append(createTextBlock("strong", "", variant.variantLabel || variant.level || "Version"));
    copy.append(createTextBlock("small", "", variant.englishTitle || variant.title));
    const check = createTextBlock("span", "variant-choice-check", variant.id === currentId ? "✓" : "");
    choice.append(mark, copy, check);
    choice.addEventListener("click", (event) => {
      event.stopPropagation(); selectVariantV6(groupId, variant.id); hideVariantMenu();
      if (state.activeStory && groupIdFor(state.activeStory) === groupId) {
        openStory(variant, false);
        history.replaceState({view: "reader", storyId: variant.id, collectionId: variant.collectionId}, "", `#story=${encodeURIComponent(variant.id)}`);
      } else renderLibrary(searchInput.value);
    });
    variantMenu.appendChild(choice);
  });
  variantMenu.setAttribute("aria-hidden", "false"); variantMenu.classList.add("variant-menu-open");
  positionFloatingMenu(variantMenu, anchor);
}

function hideVariantMenu() {
  variantMenu.classList.remove("variant-menu-open"); variantMenu.setAttribute("aria-hidden", "true"); state.variantTargetGroupId = null;
}

function openAppearanceMenu(anchor) {
  hideVariantMenu(); hideThemeMenu();
  appearanceMenu.replaceChildren();
  Object.entries(APPEARANCES).forEach(([key, appearance]) => {
    const choice = document.createElement("button");
    choice.type = "button"; choice.className = `appearance-choice${state.appearance === key ? " selected" : ""}`;
    const mark = createTextBlock("span", "appearance-choice-mark", appearance.symbol);
    mark.style.setProperty("--choice-bg", appearance.surfaceMuted);
    const copy = document.createElement("span");
    copy.append(createTextBlock("strong", "", appearance.name));
    copy.append(createTextBlock("small", "", key === "dark" ? "Dark surfaces; story accents stay active" : "Story accents stay active"));
    const check = createTextBlock("span", "variant-choice-check", state.appearance === key ? "✓" : "");
    choice.append(mark, copy, check);
    choice.addEventListener("click", (event) => {
      event.stopPropagation(); state.appearance = key; storageSet(APPEARANCE_KEY_V6, key); hideAppearanceMenu();
      const activeTheme = state.activeStory ? effectiveThemeKeyV7(state.activeStory) : (getCollection(state.activeCollectionId)?.theme || "sage");
      applyTheme(activeTheme);
      if (libraryView.classList.contains("view-active")) renderLibrary(searchInput.value);
    });
    appearanceMenu.appendChild(choice);
  });
  appearanceMenu.setAttribute("aria-hidden", "false"); appearanceMenu.classList.add("appearance-menu-open");
  positionFloatingMenu(appearanceMenu, anchor);
}

function hideAppearanceMenu() {
  appearanceMenu.classList.remove("appearance-menu-open"); appearanceMenu.setAttribute("aria-hidden", "true");
}

readerReadButton.addEventListener("click", () => {
  if (!state.activeStory) return;
  const groupId = groupIdFor(state.activeStory);
  setGroupRead(groupId, !isGroupRead(groupId));
  readerReadButton.classList.toggle("active", isGroupRead(groupId));
  readerReadButton.setAttribute("aria-label", isGroupRead(groupId) ? "Mark story unread" : "Mark story as read");
  readerReadButton.title = isGroupRead(groupId) ? "Mark unread" : "Mark as read";
  showToast(isGroupRead(groupId) ? "Marked as read" : "Marked as unread");
});
readerLevel.addEventListener("click", (event) => {
  event.stopPropagation();
  if (!state.activeStory || readerLevel.disabled) return;
  openVariantMenu(readerLevel, groupIdFor(state.activeStory));
});
libraryAppearanceButton.addEventListener("click", (event) => { event.stopPropagation(); openAppearanceMenu(libraryAppearanceButton); });
readerAppearanceButton.addEventListener("click", (event) => { event.stopPropagation(); openAppearanceMenu(readerAppearanceButton); });

document.addEventListener("click", (event) => {
  if (!event.target.closest(".variant-menu") && !event.target.closest(".story-level-button") && event.target !== readerLevel) hideVariantMenu();
  if (!event.target.closest(".appearance-menu") && event.target !== libraryAppearanceButton && event.target !== readerAppearanceButton) hideAppearanceMenu();
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { hideVariantMenu(); hideAppearanceMenu(); } });
window.addEventListener("resize", () => { hideVariantMenu(); hideAppearanceMenu(); });
window.addEventListener("scroll", () => { hideAppearanceMenu(); }, {passive: true});


function migrateAccentSelectionsV7() {
  let changed = false;
  getVariantGroupsForCollection("avatar-last-airbender"); /* ensure helpers are initialized */
  state.stories.forEach((story) => {
    const groupId = groupIdFor(story);
    if (!state.accentSelections[groupId] && THEMES[story.theme]) {
      state.accentSelections[groupId] = story.theme;
      changed = true;
    }
  });
  if (changed) saveAccentSelectionsV7();
}


/* =========================================================
   External thumbnail paths
   ========================================================= */

function resolveThumbnailPathV9(story, value) {
  const path = String(value || "").trim().replace(/\\/g, "/");
  if (!path) return "";

  /* Full URLs, data/blob URLs, root paths, and anchors are already complete. */
  if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(path)) return path;

  /* ./cover.jpg and ../cover.jpg follow the story JSON folder. */
  if (/^\.\.?\//.test(path) && story?.sourcePath) {
    try {
      const sourceUrl = new URL(String(story.sourcePath).replace(/\\/g, "/"), document.baseURI);
      return new URL(path, sourceUrl).href;
    } catch {}
  }

  /* Other relative paths are intentionally relative to the HTML file. */
  return path;
}

storyThumbnailSourceV8 = function(story, accent) {
  const groupThumbnail = story?.thumbnail || getVariants(groupIdFor(story)).find((variant) => variant.thumbnail)?.thumbnail || "";
  const resolved = resolveThumbnailPathV9(story, groupThumbnail);
  return resolved || generatedStoryThumbnailV8(story, accent);
};

async function bootstrap() {
  history.replaceState({view: "collections"}, "", "#library");
  applyTheme("sage");
  storyGrid.replaceChildren(createTextBlock("div", "empty-state", "Loading library…"));
  try {
    await loadLibrary();
    migrateAccentSelectionsV7();
    showCollections(false);
  } catch (error) {
    console.error(error);
    libraryBackButton.hidden = true;
    libraryEyebrow.textContent = "LIBRARY ERROR";
    libraryTitle.textContent = "The library could not be loaded";
    librarySubtitle.textContent = "Make sure this page is hosted on GitHub Pages and that the library folder exists in the repository.";
    storyGrid.replaceChildren(createTextBlock("div", "empty-state", `${error.message}`));
  }
}

bootstrap();
