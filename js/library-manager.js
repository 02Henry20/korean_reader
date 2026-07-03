const MAX_FIRESTORE_STORY_BYTES = 900_000;

function createDeleteCardButton(label) {
  const button = document.createElement("span");
  button.className = "delete-card-button";
  button.setAttribute("aria-hidden", "true");
  button.innerHTML = `<svg viewBox="0 0 24 24"><path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5M14 11v5"/></svg><span>${label}</span>`;
  return button;
}

function updateLibraryManageButton() {
  if (!libraryManageButton) return;
  const deleting = Boolean(state.libraryDeleteMode);
  const label = libraryManageButton.querySelector("span");
  if (label) label.textContent = deleting ? "Done" : "Manage";
  libraryManageButton.classList.toggle("manage-library-button-delete-active", deleting);
  libraryManageButton.setAttribute("aria-label", deleting ? "Leave delete mode" : "Manage library content");
}

function openLibraryManager() {
  if (state.libraryDeleteMode) {
    state.libraryDeleteMode = null;
    updateLibraryManageButton();
    renderLibrary(searchInput.value);
    return;
  }

  const inCollection = Boolean(state.activeCollectionId);
  libraryManageTitle.textContent = inCollection ? "Manage stories" : "Manage directories";
  libraryManageBody.replaceChildren();

  if (inCollection) {
    libraryManageBody.append(
      createManageAction(
        "Add story",
        "Import one Korean Reader JSON file into this directory.",
        "plus",
        () => {
          closeLibraryManager();
          state.storyImportMode = "add";
          storyImportInput.value = "";
          storyImportInput.click();
        }
      ),
      createManageAction(
        "Update story",
        "Choose a replacement JSON file and keep the story's current thumbnail.",
        "update",
        () => {
          closeLibraryManager();
          state.storyImportMode = "update";
          storyImportInput.value = "";
          storyImportInput.click();
        }
      ),
      createManageAction(
        "Delete stories",
        "Enter delete mode. Tap a story card to remove it.",
        "trash",
        () => {
          closeLibraryManager();
          state.libraryDeleteMode = "stories";
          updateLibraryManageButton();
          renderLibrary(searchInput.value);
        }
      )
    );
  } else {
    libraryManageBody.append(
      createManageAction(
        "Add directory",
        "Choose a folder containing collection metadata, story JSON files, and optional thumbnails.",
        "folder",
        () => {
          closeLibraryManager();
          directoryImportInput.value = "";
          directoryImportInput.click();
        }
      ),
      createManageAction(
        "Delete directories",
        "Enter delete mode. Tap a directory card to remove it.",
        "trash",
        () => {
          closeLibraryManager();
          state.libraryDeleteMode = "collections";
          updateLibraryManageButton();
          renderLibrary(searchInput.value);
        }
      )
    );
  }

  libraryManageBackdrop.hidden = false;
  libraryManagePanel.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    libraryManageBackdrop.classList.add("library-manage-backdrop-open");
    libraryManagePanel.classList.add("library-manage-panel-open");
  });
}

function closeLibraryManager(immediate = false) {
  if (!libraryManagePanel) return;
  const closeImmediately = immediate === true;
  libraryManagePanel.classList.remove("library-manage-panel-open");
  libraryManagePanel.setAttribute("aria-hidden", "true");
  libraryManageBackdrop.classList.remove("library-manage-backdrop-open");
  if (closeImmediately) {
    libraryManageBackdrop.hidden = true;
    return;
  }
  window.setTimeout(() => {
    if (!libraryManageBackdrop.classList.contains("library-manage-backdrop-open")) {
      libraryManageBackdrop.hidden = true;
    }
  }, 190);
}

function manageIcon(type) {
  if (type === "trash") return '<path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5M14 11v5"/>';
  if (type === "folder") return '<path d="M3.5 6.5h6l2 2h9v10h-17Z"/><path d="M3.5 9h17"/>';
  if (type === "update") return '<path d="M4 4v6h6"/><path d="M20 20v-6h-6"/><path d="M5.2 15.1A7.5 7.5 0 0 0 18.4 18"/><path d="M18.8 8.9A7.5 7.5 0 0 0 5.6 6"/>';
  return '<path d="M12 5v14M5 12h14"/>';
}

function createManageAction(title, description, icon, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "library-manage-action";
  button.innerHTML = `<span class="library-manage-action-icon"><svg viewBox="0 0 24 24">${manageIcon(icon)}</svg></span>`;
  const copy = document.createElement("span");
  copy.append(createTextBlock("strong", "", title), createTextBlock("small", "", description));
  button.appendChild(copy);
  button.addEventListener("click", handler);
  return button;
}

function setLibraryManagerProgress(title, detail) {
  libraryManageTitle.textContent = title;
  libraryManageBody.replaceChildren();
  const progress = document.createElement("div");
  progress.className = "library-import-progress";
  progress.innerHTML = '<span class="library-import-spinner" aria-hidden="true"></span>';
  progress.appendChild(createTextBlock("p", "", detail));
  libraryManageBody.appendChild(progress);
  libraryManageBackdrop.hidden = false;
  libraryManagePanel.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    libraryManageBackdrop.classList.add("library-manage-backdrop-open");
    libraryManagePanel.classList.add("library-manage-panel-open");
  });
}

function showLibraryImportError(error) {
  console.error(error);
  if (libraryManageBackdrop.hidden) {
    showToast(`Import failed: ${error.message}`);
    return;
  }
  libraryManageBody.replaceChildren(createTextBlock("div", "library-import-error", error.message));
}

function jsonByteSize(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function validateImportedStory(raw, fileName, collectionId) {
  if (jsonByteSize(raw) > MAX_FIRESTORE_STORY_BYTES) {
    throw new Error(`${fileName} is too large for the configured Firestore story format.`);
  }
  const normalized = normalizeStory(
    {
      ...raw,
      collectionId,
      sourceType: "custom",
      sourceFileName: fileName,
      sourceDirectory: ""
    },
    fileName,
    collectionId,
    Number(raw.order) || 999
  );
  normalized.collectionId = collectionId;
  normalized.sourceType = "custom";
  return normalized;
}

function normalizedFilePath(file) {
  return String(file.webkitRelativePath || file.name || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function joinRelativePath(base, relative) {
  const parts = `${base}/${relative}`.replace(/\\/g, "/").split("/");
  const result = [];
  parts.forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") result.pop();
    else result.push(part);
  });
  return result.join("/");
}

function importedThumbnailFile(fileMap, storyFile, thumbnailValue) {
  const value = String(thumbnailValue || "").trim().replace(/\\/g, "/");
  if (!value || /^(?:https?:|data:|blob:|\/)/i.test(value)) return null;
  const storyPath = normalizedFilePath(storyFile);
  const candidate = joinRelativePath(dirname(storyPath), value);
  if (fileMap.has(candidate)) return fileMap.get(candidate);

  const withoutRoot = candidate.split("/").slice(1).join("/");
  for (const [path, file] of fileMap) {
    if (path === withoutRoot || path.endsWith(`/${withoutRoot}`)) return file;
  }
  return null;
}

async function parseJsonFile(file) {
  try {
    return JSON.parse(await file.text());
  } catch (error) {
    throw new Error(`${file.name} is not valid JSON: ${error.message}`);
  }
}

function importedCollectionEntries(parsed, rootFolder) {
  const entries = parsed
    .filter(({data}) => data?.type === "collection")
    .map(({file, data}) => {
      const directory = dirname(normalizedFilePath(file));
      const collection = normalizeCollection({...data, sourceType: "custom"}, directory || rootFolder);
      collection.sourceType = "custom";
      return {file, data, directory, collection};
    });

  if (entries.length) return entries;

  const collection = normalizeCollection({
    id: slugify(rootFolder),
    title: humanizeFolderName(rootFolder),
    monogram: humanizeFolderName(rootFolder).slice(0, 1),
    theme: "sage",
    sourceType: "custom"
  }, rootFolder);
  collection.sourceType = "custom";
  return [{file: null, data: null, directory: rootFolder, collection}];
}

function collectionForImportedStory(entry, collectionEntries) {
  const rawCollectionId = String(entry.data?.collectionId || "");
  if (rawCollectionId) {
    const matchingId = collectionEntries.find(({collection}) => collection.id === rawCollectionId);
    if (matchingId) return matchingId.collection;
  }

  const storyDirectory = dirname(normalizedFilePath(entry.file));
  const matchingDirectory = collectionEntries
    .filter(({directory}) =>
      directory &&
      (storyDirectory === directory || storyDirectory.startsWith(`${directory}/`))
    )
    .sort((a, b) => pathDepth(b.directory) - pathDepth(a.directory))[0];

  return matchingDirectory?.collection || collectionEntries[0]?.collection;
}

async function clearImportDeletionMarker(kind, id, pendingCloudDeletionClears = []) {
  const key = `${kind}:${id}`;
  if (!state.libraryDeletions.has(key)) return;
  state.libraryDeletions.delete(key);
  await removeLocalDeletionRecord(key);
  pendingCloudDeletionClears.push({key, kind, id});
}

function syncImportedContentInBackground(detail, pendingCloudDeletionClears = []) {
  if (!state.firebaseUser) {
    setFirebaseStatus("offline", "Saved locally", detail || "Sign in to synchronize imported content.");
    return;
  }

  const deletionClears = pendingCloudDeletionClears.map((record) => ({...record}));
  setFirebaseStatus("syncing", "Saved locally", "Uploading imported content in the background.");
  window.setTimeout(() => {
    (async () => {
      for (const deletion of deletionClears) {
        await firebaseDeleteDocument(CLOUD_PATHS.deletions, deletion.key);
      }
      await syncCloudData({force: true});
    })().catch((error) => {
      console.error("Background import sync failed:", error);
      setFirebaseStatus("error", "Import saved locally; sync failed", friendlyFirebaseError(error));
    });
  }, 0);
}

async function importDirectoryFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  setLibraryManagerProgress("Adding directory", "Checking the selected files…");

  try {
    const fileMap = new Map(files.map((file) => [normalizedFilePath(file), file]));
    const jsonFiles = files.filter((file) => /\.json$/i.test(file.name));
    if (!jsonFiles.length) throw new Error("The selected directory contains no JSON files.");

    const parsed = [];
    for (const file of jsonFiles) parsed.push({file, data: await parseJsonFile(file)});

    const rootFolder = normalizedFilePath(files[0]).split("/")[0] || "Imported collection";
    const collectionEntries = importedCollectionEntries(parsed, rootFolder);

    const storyEntries = parsed.filter(({data}) => Array.isArray(data?.paragraphs));
    if (!storyEntries.length) throw new Error("No valid story JSON files were found in this directory.");

    const stories = storyEntries.map((entry) => {
      const collection = collectionForImportedStory(entry, collectionEntries);
      if (!collection) throw new Error(`${entry.file.name} could not be matched to a collection.`);
      return {
        file: entry.file,
        raw: entry.data,
        collection,
        story: validateImportedStory(entry.data, entry.file.name, collection.id)
      };
    });
    const duplicateIds = stories.map(({story}) => story.id).filter((id, index, all) => all.indexOf(id) !== index);
    if (duplicateIds.length) throw new Error(`Duplicate story ID: ${duplicateIds[0]}`);

    const collections = [...new Map(stories.map(({collection}) => [collection.id, collection])).values()];
    const existingCollections = collections.filter((collection) => getCollection(collection.id));
    if (existingCollections.length && !window.confirm(
      `${existingCollections.length} imported director${existingCollections.length === 1 ? "y" : "ies"} already ` +
      "exist. Replace matching imported content?"
    )) {
      closeLibraryManager();
      return;
    }

    closeLibraryManager(true);
    showToast(`Importing ${stories.length} stories locally`);

    const now = Date.now();
    const pendingDeletionClears = [];
    for (const [index, collection] of collections.entries()) {
      await clearImportDeletionMarker("collection", collection.id, pendingDeletionClears);
      await saveCustomCollection({id: collection.id, collection, updatedAt: now + index}, {localOnly: true});
    }

    let importedCount = 0;
    for (const entry of stories) {
      await clearImportDeletionMarker("story", entry.story.id, pendingDeletionClears);
      const thumbnailFile = importedThumbnailFile(fileMap, entry.file, entry.raw.thumbnail || entry.raw.cover || entry.raw.coverImage);
      const record = await buildStoryRecord(entry.story, thumbnailFile, now + collections.length + importedCount + 1);
      await saveCustomStory(record, {localOnly: true});
      importedCount += 1;
    }

    await loadLocalLibraryIntoState();
    directoryImportInput.value = "";
    closeLibraryManager(true);
    renderLibrary(searchInput.value);
    syncImportedContentInBackground("Sign in to synchronize the imported directory.", pendingDeletionClears);
    showToast(`Added ${collections.length} director${collections.length === 1 ? "y" : "ies"} with ${importedCount} stories`);
  } catch (error) {
    showLibraryImportError(error);
  }
}

async function buildStoryRecord(story, thumbnailFile = null, updatedAt = Date.now(), options = {}) {
  let thumbnailUrl = "";
  let thumbnailStoragePath = "";

  if (thumbnailFile && state.firebaseUser && options.uploadThumbnail === true) {
    try {
      setFirebaseStatus("syncing", "Uploading thumbnail…", thumbnailFile.name);
      const uploaded = await uploadThumbnailToFirebase(story.id, story.collectionId, thumbnailFile);
      thumbnailUrl = uploaded.url;
      thumbnailStoragePath = uploaded.path;
    } catch (error) {
      console.warn("Thumbnail saved locally but not uploaded:", error);
      setFirebaseStatus("error", "Thumbnail saved locally", friendlyFirebaseError(error));
    }
  }

  const storedStory = cleanForCloud({...story});
  storedStory.sourceType = "custom";

  /*
   * A separately selected local thumbnail takes precedence. When no file was
   * selected, preserve an already complete remote/data URL from the JSON.
   * Relative paths are not persisted because they are only meaningful while
   * the original local directory is mounted in the file picker.
   */
  const existingThumbnail = String(story.thumbnail || "").trim();
  const reusableThumbnail = /^(?:https?:|data:)/i.test(existingThumbnail)
    ? existingThumbnail
    : "";
  storedStory.thumbnail = thumbnailUrl || reusableThumbnail;
  if (!thumbnailUrl && reusableThumbnail) thumbnailUrl = reusableThumbnail;
  return {
    id: story.id,
    story: storedStory,
    thumbnailBlob: thumbnailFile || null,
    thumbnailUrl,
    thumbnailStoragePath,
    updatedAt
  };
}

function preservedStoryThumbnail(existingStory, existingRecord) {
  const recordThumbnail = String(existingRecord?.story?.thumbnail || "").trim();
  const storyThumbnail = String(existingStory?.thumbnail || "").trim();
  const reusableUrl =
    existingRecord?.thumbnailUrl ||
    (/^(?:https?:|data:)/i.test(recordThumbnail) ? recordThumbnail : "") ||
    (/^(?:https?:|data:)/i.test(storyThumbnail) ? storyThumbnail : "");

  return {
    thumbnailBlob: existingRecord?.thumbnailBlob || null,
    thumbnailUrl: reusableUrl,
    thumbnailStoragePath: existingRecord?.thumbnailStoragePath || existingStory?.thumbnailStoragePath || ""
  };
}

async function updateExistingStoryFromFile(file) {
  if (!file) return;
  const collection = getCollection(state.activeCollectionId);
  if (!collection) return;
  setLibraryManagerProgress("Updating story", "Checking the selected JSON file…");

  try {
    const raw = await parseJsonFile(file);
    const story = validateImportedStory(raw, file.name, collection.id);
    const existingStory = state.stories.find((item) =>
      item.id === story.id && item.collectionId === collection.id
    );

    if (!existingStory) {
      throw new Error(`No existing story with ID "${story.id}" was found in this directory.`);
    }

    closeLibraryManager(true);
    const existingRecord = state.localStories.find((record) => record.id === story.id);
    const preserved = preservedStoryThumbnail(existingStory, existingRecord);
    const storedStory = cleanForCloud({...story});
    storedStory.sourceType = "custom";
    storedStory.thumbnail = preserved.thumbnailUrl || "";

    const pendingDeletionClears = [];
    await clearImportDeletionMarker("story", story.id, pendingDeletionClears);
    await saveCustomStory({
      id: story.id,
      story: storedStory,
      thumbnailBlob: preserved.thumbnailBlob,
      thumbnailUrl: preserved.thumbnailUrl,
      thumbnailStoragePath: preserved.thumbnailStoragePath,
      updatedAt: Date.now()
    }, {localOnly: true});

    state.storyImportMode = "add";
    storyImportInput.value = "";
    await loadLocalLibraryIntoState();
    closeLibraryManager(true);
    renderLibrary(searchInput.value);
    syncImportedContentInBackground("Sign in to synchronize the updated story.", pendingDeletionClears);
    showToast(`Updated ${story.title}`);
  } catch (error) {
    showLibraryImportError(error);
  }
}

async function beginSingleStoryImport(file) {
  if (!file) return;
  const collection = getCollection(state.activeCollectionId);
  if (!collection) return;

  try {
    const raw = await parseJsonFile(file);
    const story = validateImportedStory(raw, file.name, collection.id);
    const existing = state.stories.find((item) => item.id === story.id);
    if (existing && !window.confirm(`A story named “${existing.title}” already exists. Replace it?`)) return;

    state.storyImportMode = "add";
    state.pendingStoryImport = {file, raw, story};
    libraryManageTitle.textContent = "Story thumbnail";
    libraryManageBody.replaceChildren(
      createTextBlock("p", "library-manage-prompt", `Does “${story.title}” have a thumbnail?`),
      createManageAction("Choose thumbnail", "Select an image file stored beside this story.", "plus", () => {
        storyThumbnailInput.value = "";
        storyThumbnailInput.click();
      }),
      createManageAction("Continue without thumbnail", "Use the directory character as the fallback image.", "folder", () => finishSingleStoryImport(null))
    );
    libraryManageBackdrop.hidden = false;
    libraryManagePanel.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      libraryManageBackdrop.classList.add("library-manage-backdrop-open");
      libraryManagePanel.classList.add("library-manage-panel-open");
    });
  } catch (error) {
    showToast(error.message);
  }
}

async function finishSingleStoryImport(thumbnailFile) {
  const pending = state.pendingStoryImport;
  if (!pending) return;
  setLibraryManagerProgress("Adding story", `Saving ${pending.story.title}…`);

  try {
    closeLibraryManager(true);
    const pendingDeletionClears = [];
    await clearImportDeletionMarker("story", pending.story.id, pendingDeletionClears);
    const record = await buildStoryRecord(pending.story, thumbnailFile, Date.now());
    await saveCustomStory(record, {localOnly: true});
    state.pendingStoryImport = null;
    storyThumbnailInput.value = "";
    await loadLocalLibraryIntoState();
    closeLibraryManager(true);
    renderLibrary(searchInput.value);
    syncImportedContentInBackground("Sign in to synchronize the imported story.", pendingDeletionClears);
    showToast(`Added ${pending.story.title}`);
  } catch (error) {
    showLibraryImportError(error);
  }
}

async function requestDeleteStory(story) {
  if (!window.confirm(`Delete “${story.title}”? This hides the story on every synchronized device.`)) return;
  try {
    const localRecord = state.localStories.find((record) => record.id === story.id);
    try {
      await deleteThumbnailFromFirebase(localRecord?.thumbnailStoragePath || story.thumbnailStoragePath);
      await firebaseDeleteDocument(CLOUD_PATHS.stories, story.id);
    } catch (error) {
      console.warn("Cloud story cleanup will be retried later:", error);
    }
    await removeLocalStoryRecord(story.id);
    await saveDeletion("story", story.id);
    await loadLocalLibraryIntoState();
    renderLibrary(searchInput.value);
    showToast(`Deleted ${story.title}`);
  } catch (error) {
    console.error(error);
    showToast(`Could not delete story: ${error.message}`);
  }
}

async function requestDeleteCollection(collection) {
  if (!window.confirm(`Delete the directory “${collection.title}” and all stories inside it?`)) return;
  try {
    const localStories = state.localStories.filter((record) => record.story?.collectionId === collection.id);
    for (const record of localStories) {
      try {
        await deleteThumbnailFromFirebase(record.thumbnailStoragePath);
        await firebaseDeleteDocument(CLOUD_PATHS.stories, record.id);
      } catch (error) {
        console.warn("Cloud story cleanup will be retried later:", error);
      }
      await removeLocalStoryRecord(record.id);
    }
    await removeLocalCollectionRecord(collection.id);
    try {
      await firebaseDeleteDocument(CLOUD_PATHS.collections, collection.id);
    } catch (error) {
      console.warn("Cloud directory cleanup will be retried later:", error);
    }
    await saveDeletion("collection", collection.id);
    await loadLocalLibraryIntoState();
    renderLibrary(searchInput.value);
    showToast(`Deleted ${collection.title}`);
  } catch (error) {
    console.error(error);
    showToast(`Could not delete directory: ${error.message}`);
  }
}

function updateScrollTopButton() {
  const visible = libraryView.classList.contains("view-active") && window.scrollY > 120;
  scrollTopButton.classList.toggle("scroll-top-button-visible", visible);
  scrollTopButton.setAttribute("aria-hidden", String(!visible));
}

libraryManageButton?.addEventListener("click", openLibraryManager);
closeLibraryManageButton?.addEventListener("click", closeLibraryManager);
libraryManageBackdrop?.addEventListener("click", closeLibraryManager);
directoryImportInput?.addEventListener("change", () => importDirectoryFiles(directoryImportInput.files));
storyImportInput?.addEventListener("change", () => {
  const file = storyImportInput.files?.[0];
  if (state.storyImportMode === "update") updateExistingStoryFromFile(file);
  else beginSingleStoryImport(file);
});
storyThumbnailInput?.addEventListener("change", () => finishSingleStoryImport(storyThumbnailInput.files?.[0] || null));
scrollTopButton?.addEventListener("click", () => window.scrollTo({top: 0, behavior: state.settings.animationIntensity === "none" ? "auto" : "smooth"}));
window.addEventListener("scroll", updateScrollTopButton, {passive: true});
