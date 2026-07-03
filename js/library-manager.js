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
  if (label) label.textContent = deleting ? "Done" : "Add";
  libraryManageButton.classList.toggle("manage-library-button-delete-active", deleting);
  libraryManageButton.setAttribute("aria-label", deleting ? "Leave delete mode" : "Add or delete library content");
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

function closeLibraryManager() {
  if (!libraryManagePanel) return;
  libraryManagePanel.classList.remove("library-manage-panel-open");
  libraryManagePanel.setAttribute("aria-hidden", "true");
  libraryManageBackdrop.classList.remove("library-manage-backdrop-open");
  window.setTimeout(() => {
    if (!libraryManageBackdrop.classList.contains("library-manage-backdrop-open")) {
      libraryManageBackdrop.hidden = true;
    }
  }, 190);
}

function manageIcon(type) {
  if (type === "trash") return '<path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5M14 11v5"/>';
  if (type === "folder") return '<path d="M3.5 6.5h6l2 2h9v10h-17Z"/><path d="M3.5 9h17"/>';
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

    const collectionEntry = parsed.find(({data}) => data?.type === "collection");
    const rootFolder = normalizedFilePath(files[0]).split("/")[0] || "Imported collection";
    const rawCollection = collectionEntry?.data || {
      id: slugify(rootFolder),
      title: humanizeFolderName(rootFolder),
      monogram: humanizeFolderName(rootFolder).slice(0, 1),
      theme: "sage"
    };
    const collection = normalizeCollection({...rawCollection, sourceType: "custom"}, rootFolder);
    collection.sourceType = "custom";

    const storyEntries = parsed.filter(({data}) => Array.isArray(data?.paragraphs));
    if (!storyEntries.length) throw new Error("No valid story JSON files were found in this directory.");

    const stories = storyEntries.map(({file, data}) => ({
      file,
      raw: data,
      story: validateImportedStory(data, file.name, collection.id)
    }));
    const duplicateIds = stories.map(({story}) => story.id).filter((id, index, all) => all.indexOf(id) !== index);
    if (duplicateIds.length) throw new Error(`Duplicate story ID: ${duplicateIds[0]}`);

    const existingCollection = getCollection(collection.id);
    if (existingCollection && !window.confirm(`A directory named “${existingCollection.title}” already exists. Replace matching imported content?`)) {
      closeLibraryManager();
      return;
    }

    const now = Date.now();
    await clearDeletion("collection", collection.id);
    await saveCustomCollection({id: collection.id, collection, updatedAt: now});

    let importedCount = 0;
    for (const entry of stories) {
      setLibraryManagerProgress("Adding directory", `Saving ${entry.story.title}…`);
      await clearDeletion("story", entry.story.id);
      const thumbnailFile = importedThumbnailFile(fileMap, entry.file, entry.raw.thumbnail || entry.raw.cover || entry.raw.coverImage);
      const record = await buildStoryRecord(entry.story, thumbnailFile, now + importedCount + 1);
      await saveCustomStory(record);
      importedCount += 1;
    }

    await loadLocalLibraryIntoState();
    closeLibraryManager();
    renderLibrary(searchInput.value);
    setFirebaseStatus(
      state.firebaseUser ? "synced" : "offline",
      state.firebaseUser ? "Synced" : "Saved locally",
      state.firebaseUser?.email || "Sign in to synchronize the imported directory."
    );
    showToast(`Added ${collection.title} with ${importedCount} stories`);
  } catch (error) {
    console.error(error);
    libraryManageBody.replaceChildren(createTextBlock("div", "library-import-error", error.message));
  }
}

async function buildStoryRecord(story, thumbnailFile = null, updatedAt = Date.now()) {
  let thumbnailUrl = "";
  let thumbnailStoragePath = "";

  if (thumbnailFile && state.firebaseUser) {
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

async function beginSingleStoryImport(file) {
  if (!file) return;
  const collection = getCollection(state.activeCollectionId);
  if (!collection) return;

  try {
    const raw = await parseJsonFile(file);
    const story = validateImportedStory(raw, file.name, collection.id);
    const existing = state.stories.find((item) => item.id === story.id);
    if (existing && !window.confirm(`A story named “${existing.title}” already exists. Replace it?`)) return;

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
    await clearDeletion("story", pending.story.id);
    const record = await buildStoryRecord(pending.story, thumbnailFile, Date.now());
    await saveCustomStory(record);
    state.pendingStoryImport = null;
    await loadLocalLibraryIntoState();
    closeLibraryManager();
    renderLibrary(searchInput.value);
    showToast(`Added ${pending.story.title}`);
  } catch (error) {
    console.error(error);
    libraryManageBody.replaceChildren(createTextBlock("div", "library-import-error", error.message));
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
storyImportInput?.addEventListener("change", () => beginSingleStoryImport(storyImportInput.files?.[0]));
storyThumbnailInput?.addEventListener("change", () => finishSingleStoryImport(storyThumbnailInput.files?.[0] || null));
scrollTopButton?.addEventListener("click", () => window.scrollTo({top: 0, behavior: state.settings.animationIntensity === "none" ? "auto" : "smooth"}));
window.addEventListener("scroll", updateScrollTopButton, {passive: true});
