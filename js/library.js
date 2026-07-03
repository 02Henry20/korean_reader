function slugify(value) {
  return String(value || "collection").toLowerCase().normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "collection";
}

function dirname(path) {
  const normalized = String(path || "").replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index < 0 ? "" : normalized.slice(0, index);
}

function basename(path) {
  const normalized = String(path || "").replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index < 0 ? normalized : normalized.slice(index + 1);
}

function pathDepth(path) {
  return path ? String(path).split("/").length : 0;
}

function numericOrder(path, fallback = 999) {
  const match = basename(path).match(/^(\d+)/);
  return match ? Number(match[1]) : fallback;
}

function encodeGitHubPath(path) {
  return String(path).split("/").map(encodeURIComponent).join("/");
}

function humanizeFolderName(value) {
  return String(value || "Collection")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function fetchGitHubJSON(url, label) {
  const response = await fetch(url, {
    headers: {Accept: "application/vnd.github+json"},
    cache: "no-cache"
  });
  if (!response.ok) {
    throw new Error(`${label}: GitHub returned ${response.status}.`);
  }
  return response.json();
}

async function loadLibrary() {
  const {owner, repo, branch, root} = GITHUB_LIBRARY;
  const treeUrl =
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}` +
    `/git/trees/${encodeURIComponent(branch)}?recursive=1`;

  const treeData = await fetchGitHubJSON(treeUrl, "Could not read the repository");
  if (treeData.truncated) {
    throw new Error("The GitHub file list was truncated because the repository is too large.");
  }

  const rootPrefix = `${String(root).replace(/^\/+|\/+$/g, "")}/`;
  const jsonEntries = (treeData.tree || [])
    .filter((entry) =>
      entry.type === "blob" &&
      entry.path.startsWith(rootPrefix) &&
      entry.path.toLowerCase().endsWith(".json")
    )
    .sort((a, b) => a.path.localeCompare(b.path, undefined, {numeric: true}));

  if (!jsonEntries.length) {
    throw new Error(`No JSON stories were found inside ${root}/.`);
  }

  const results = await Promise.allSettled(jsonEntries.map(async (entry) => {
    const rawUrl =
      `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/` +
      `${encodeURIComponent(branch)}/${encodeGitHubPath(entry.path)}`;
    const response = await fetch(rawUrl, {cache: "no-cache"});
    if (!response.ok) throw new Error(`${entry.path}: HTTP ${response.status}`);
    return {
      path: entry.path,
      dir: dirname(entry.path),
      name: basename(entry.path),
      rawUrl,
      data: await response.json()
    };
  }));

  const parsed = [];
  const warnings = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") parsed.push(result.value);
    else warnings.push(result.reason?.message || jsonEntries[index].path);
  });

  const collectionInfos = parsed
    .filter((item) => item.data?.type === "collection")
    .map((item) => ({
      ...item,
      collection: normalizeCollection(item.data, item.dir)
    }));

  state.collections = collectionInfos.map((item) => item.collection);
  state.stories = [];

  const collectionByDirectory = new Map(
    collectionInfos.map((item) => [item.dir, item.collection])
  );

  const topLevelDirectories = new Set();
  parsed.forEach((item) => {
    const relative = item.path.slice(rootPrefix.length);
    const firstDirectory = relative.includes("/") ? relative.split("/")[0] : "";
    if (firstDirectory) topLevelDirectories.add(`${rootPrefix}${firstDirectory}`);
  });

  topLevelDirectories.forEach((directory) => {
    const hasMetadata = collectionInfos.some(
      (item) => item.dir === directory || item.dir.startsWith(`${directory}/`)
    );
    if (hasMetadata) return;

    const folder = basename(directory);
    const collection = normalizeCollection({
      id: slugify(folder),
      title: humanizeFolderName(folder),
      koreanTitle: "",
      description: "",
      level: "",
      theme: "sage",
      order: numericOrder(folder),
      monogram: humanizeFolderName(folder).slice(0, 1),
      tags: []
    }, directory);
    state.collections.push(collection);
    collectionByDirectory.set(directory, collection);
  });

  for (const item of parsed.filter((entry) => Array.isArray(entry.data?.paragraphs))) {
    let collectionId = String(item.data.collectionId || "");

    if (!collectionId) {
      const matchingMetadata = collectionInfos
        .filter((info) => item.dir === info.dir || item.dir.startsWith(`${info.dir}/`))
        .sort((a, b) => pathDepth(b.dir) - pathDepth(a.dir));
      collectionId = matchingMetadata[0]?.collection.id || "";
    }

    if (!collectionId) {
      const relative = item.path.slice(rootPrefix.length);
      const firstDirectory = relative.includes("/") ? relative.split("/")[0] : "";
      collectionId =
        collectionByDirectory.get(`${rootPrefix}${firstDirectory}`)?.id ||
        "uncategorized";
    }

    try {
      const story = normalizeStory(
        {...item.data, sourcePath: item.rawUrl},
        item.name,
        collectionId,
        numericOrder(item.path)
      );
      story.collectionId = collectionId;
      state.stories.push(story);
    } catch (error) {
      warnings.push(`${item.path}: ${error.message}`);
    }
  }

  ensureCollectionsForStories();

  state.collections = state.collections
    .filter((collection, index, all) =>
      all.findIndex((item) => item.id === collection.id) === index
    )
    .map((collection) => ({
      ...collection,
      storyCount: state.stories.filter(
        (story) => story.collectionId === collection.id
      ).length
    }));

  if (!state.stories.length) {
    throw new Error(`JSON files were found, but none were valid Korean Reader stories.`);
  }

  if (warnings.length) {
    console.warn("Some library files could not be loaded:", warnings);
    showToast(`${warnings.length} library file${warnings.length === 1 ? "" : "s"} could not be loaded`);
  }
}

function saveLibrary() {
  /* Story files are read-only and always come from the GitHub library folder. */
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
    metadata: {
      author: String(info.author || "")
    },
    storyCount: Number(info.storyCount) || 0,
    sort: String(info.sort || "order")
  };
}

function normalizeStory(story, sourceName = "Imported story", fallbackCollectionId = "uncategorized", fallbackOrder = 999) {
  if (!story || typeof story !== "object" || !Array.isArray(story.paragraphs)) {
    throw new Error(`${sourceName} is not a Korean reader story.`);
  }

  story.paragraphs.forEach((paragraph, paragraphIndex) => {
    if (!paragraph || !Array.isArray(paragraph.sentences)) {
      throw new Error(`Paragraph ${paragraphIndex + 1} needs a sentences array.`);
    }

    paragraph.sentences.forEach((sentence, sentenceIndex) => {
      if (!sentence || typeof sentence.korean !== "string" || !sentence.korean.trim()) {
        throw new Error(`Paragraph ${paragraphIndex + 1}, sentence ${sentenceIndex + 1} needs Korean text.`);
      }
      sentence.translation = String(sentence.translation || "");
      sentence.grammar = Array.isArray(sentence.grammar) ? sentence.grammar : [];
      sentence.vocab = Array.isArray(sentence.vocab) ? sentence.vocab : [];
      sentence.words = Array.isArray(sentence.words) ? sentence.words : [];
    });
  });

  const normalized = {
    id: String(story.id || `${slugify(story.title || sourceName)}-${Date.now().toString(36)}`),
    title: String(story.title || sourceName.replace(/\.json$/i, "")),
    englishTitle: String(story.englishTitle || ""),
    level: String(story.level || ""),
    description: String(story.description || ""),
    theme: THEMES[story.theme] ? story.theme : "sage",
    collectionId: String(story.collectionId || fallbackCollectionId),
    order: Number.isFinite(Number(story.order)) ? Number(story.order) : fallbackOrder,
    sourcePath: String(story.sourcePath || ""),
    author: String(story.author || story.metadata?.author || ""),
    tags: Array.isArray(story.tags) ? story.tags.map(String) : [],
    preferredFont: String(story.preferredFont || story.readingFont || story.font || ""),
    paragraphs: story.paragraphs
  };

  normalized.variantGroupId = String(story.variantGroupId || story.groupId || normalized.id);
  normalized.difficultyOrder = Number.isFinite(Number(story.difficultyOrder))
    ? Number(story.difficultyOrder)
    : normalized.order;
  normalized.variantLabel = String(story.variantLabel || story.level || normalized.level || "Version");
  normalized.thumbnail = String(story.thumbnail || story.cover || story.coverImage || "");

  return normalized;
}

function ensureCollectionsForStories() {
  const existing = new Set(state.collections.map((c) => c.id));
  state.stories.forEach((story) => {
    if (!existing.has(story.collectionId)) {
      state.collections.push(normalizeCollection({
        id: story.collectionId, title: story.collectionId === "uncategorized" ? "Imported stories" : story.collectionId,
        koreanTitle: "가져온 이야기", description: "Stories imported without a collection info.json file.",
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
