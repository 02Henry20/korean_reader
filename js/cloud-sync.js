const CLOUD_PATHS = Object.freeze({
  collections: "libraryCollections",
  stories: "libraryStories",
  readerState: "readerState",
  deletions: "libraryDeletions"
});

let firebaseAuthUnsubscribe = null;
let cloudSyncRunning = null;

function setFirebaseStatus(status, message, detail = "") {
  state.firebaseStatus = status;
  state.firebaseStatusMessage = message;
  if (firebaseStatusBadge) {
    firebaseStatusBadge.dataset.status = status;
    firebaseStatusBadge.textContent = status === "synced" ? "✓" : status === "error" ? "!" : status === "offline" ? "○" : "…";
  }
  if (firebaseSyncProgress) {
    firebaseSyncProgress.dataset.status = status;
  }
  if (firebaseStatusText) firebaseStatusText.textContent = message;
  if (firebaseAccountText) firebaseAccountText.textContent = detail || (state.firebaseUser?.email || "Not signed in");

  if (firebaseSignedOutControls) firebaseSignedOutControls.hidden = Boolean(state.firebaseUser);
  if (firebaseSignedInControls) firebaseSignedInControls.hidden = !state.firebaseUser;
}

function firebaseUserCollectionPath(name) {
  if (!state.firebaseUser) throw new Error("Sign in before using Firebase sync.");
  return ["koreanReaderUsers", state.firebaseUser.uid, name];
}

function cleanForCloud(value) {
  if (Array.isArray(value)) return value.map(cleanForCloud);
  if (value && typeof value === "object") {
    if (value instanceof Blob || value instanceof File) return undefined;
    const result = {};
    Object.entries(value).forEach(([key, item]) => {
      if (item === undefined || typeof item === "function") return;
      const cleaned = cleanForCloud(item);
      if (cleaned !== undefined) result[key] = cleaned;
    });
    return result;
  }
  return value;
}

function collectionCloudPayload(record) {
  return cleanForCloud({
    id: record.id,
    collection: record.collection,
    updatedAt: record.updatedAt,
    sourceType: "custom"
  });
}

function storyCloudPayload(record) {
  const story = {...record.story};
  if (record.thumbnailUrl) story.thumbnail = record.thumbnailUrl;
  return cleanForCloud({
    id: record.id,
    story,
    collectionId: story.collectionId,
    thumbnailUrl: record.thumbnailUrl || "",
    thumbnailStoragePath: record.thumbnailStoragePath || "",
    updatedAt: record.updatedAt,
    sourceType: "custom"
  });
}

async function firebaseSetDocument(collectionName, id, payload) {
  const services = state.firebaseServices || await window.firebaseReadyPromise;
  const {doc, setDoc} = services.firestoreApi;
  const path = firebaseUserCollectionPath(collectionName);
  await setDoc(doc(services.db, ...path, encodeURIComponent(String(id))), cleanForCloud(payload), {merge: true});
}

async function firebaseDeleteDocument(collectionName, id) {
  if (!state.firebaseUser) return;
  const services = state.firebaseServices || await window.firebaseReadyPromise;
  const {doc, deleteDoc} = services.firestoreApi;
  const path = firebaseUserCollectionPath(collectionName);
  await deleteDoc(doc(services.db, ...path, encodeURIComponent(String(id))));
}

async function uploadThumbnailToFirebase(storyId, collectionId, file) {
  if (!state.firebaseUser || !(file instanceof Blob)) return {url: "", path: ""};
  const services = state.firebaseServices || await window.firebaseReadyPromise;
  const safeName = String(file.name || "thumbnail").replace(/[^a-zA-Z0-9._-]+/g, "-");
  const path = `korean-reader/${state.firebaseUser.uid}/thumbnails/${slugify(collectionId)}/${slugify(storyId)}/${Date.now()}-${safeName}`;
  const reference = services.storageApi.ref(services.storage, path);
  await services.storageApi.uploadBytes(reference, file, {contentType: file.type || "application/octet-stream"});
  const url = await services.storageApi.getDownloadURL(reference);
  return {url, path};
}

async function deleteThumbnailFromFirebase(path) {
  if (!state.firebaseUser || !path) return;
  const services = state.firebaseServices || await window.firebaseReadyPromise;
  try {
    await services.storageApi.deleteObject(services.storageApi.ref(services.storage, path));
  } catch (error) {
    if (error?.code !== "storage/object-not-found") throw error;
  }
}

async function queueReaderStateCloudWrite(storyId, value) {
  if (!state.firebaseUser) {
    setFirebaseStatus("offline", "Saved locally", "Sign in to synchronize reader state.");
    return;
  }
  try {
    setFirebaseStatus("syncing", "Saving reader state…", state.firebaseUser.email);
    await firebaseSetDocument(CLOUD_PATHS.readerState, storyId, {id: storyId, ...value});
    setFirebaseStatus("synced", "Synced", state.firebaseUser.email);
  } catch (error) {
    console.error(error);
    setFirebaseStatus("error", "Reader state not synced", error.message);
  }
}

async function saveCustomCollection(record, options = {}) {
  await saveLocalCollectionRecord(record);
  if (state.firebaseUser && !options.localOnly) {
    try {
      await firebaseSetDocument(CLOUD_PATHS.collections, record.id, collectionCloudPayload(record));
    } catch (error) {
      setFirebaseStatus("error", "Saved locally; cloud sync failed", friendlyFirebaseError(error));
    }
  }
}

async function saveCustomStory(record, options = {}) {
  await saveLocalStoryRecord(record);
  if (state.firebaseUser && !options.localOnly) {
    try {
      await firebaseSetDocument(CLOUD_PATHS.stories, record.id, storyCloudPayload(record));
    } catch (error) {
      setFirebaseStatus("error", "Saved locally; cloud sync failed", friendlyFirebaseError(error));
    }
  }
}


async function saveCloudStoryLocally(record) {
  const existing = state.localStories.find((item) => item.id === record.id);
  const merged = {
    ...record,
    thumbnailBlob: record.thumbnailBlob || existing?.thumbnailBlob || null
  };
  await saveLocalStoryRecord(merged);
}

async function syncLocalStoryRecordToCloud(record) {
  let next = record;
  if (record.thumbnailBlob instanceof Blob && !record.thumbnailUrl) {
    try {
      const uploaded = await uploadThumbnailToFirebase(
        record.id,
        record.story?.collectionId || "uncategorized",
        record.thumbnailBlob
      );
      next = {
        ...record,
        thumbnailUrl: uploaded.url,
        thumbnailStoragePath: uploaded.path,
        story: {...record.story, thumbnail: uploaded.url}
      };
      await saveLocalStoryRecord(next);
    } catch (error) {
      console.warn("Thumbnail remains local because Firebase Storage upload failed:", error);
    }
  }
  await firebaseSetDocument(CLOUD_PATHS.stories, next.id, storyCloudPayload(next));
}

async function saveDeletion(kind, id, options = {}) {
  const record = {
    key: `${kind}:${id}`,
    kind,
    id,
    updatedAt: Date.now()
  };
  await saveLocalDeletionRecord(record);
  state.libraryDeletions.set(record.key, record);
  if (state.firebaseUser && !options.localOnly) {
    try {
      await firebaseSetDocument(CLOUD_PATHS.deletions, record.key, record);
    } catch (error) {
      setFirebaseStatus("error", "Deletion saved locally", friendlyFirebaseError(error));
    }
  }
  return record;
}

async function clearDeletion(kind, id) {
  const key = `${kind}:${id}`;
  state.libraryDeletions.delete(key);
  await removeLocalDeletionRecord(key);
  if (state.firebaseUser) {
    try {
      await firebaseDeleteDocument(CLOUD_PATHS.deletions, key);
    } catch (error) {
      console.warn("The cloud deletion marker could not be cleared:", error);
    }
  }
}

function collectionFromLocalRecord(record) {
  return normalizeCollection({
    ...record.collection,
    sourceType: "custom",
    updatedAt: record.updatedAt
  });
}

function storyFromLocalRecord(record) {
  const stored = {...record.story};
  if (record.thumbnailBlob instanceof Blob) {
    stored.thumbnail = localThumbnailUrl(record.id, record.thumbnailBlob);
  } else if (record.thumbnailUrl) {
    stored.thumbnail = record.thumbnailUrl;
  }
  const story = normalizeStory({
    ...stored,
    sourceType: "custom",
    updatedAt: record.updatedAt,
    thumbnailStoragePath: record.thumbnailStoragePath || ""
  }, stored.sourceFileName || `${record.id}.json`, stored.collectionId, stored.order);
  story.sourceType = "custom";
  story.updatedAt = record.updatedAt;
  story.thumbnailStoragePath = record.thumbnailStoragePath || "";
  return story;
}

function rebuildMergedLibrary() {
  const collectionMap = new Map();
  const storyMap = new Map();

  state.githubCollections.forEach((collection) => collectionMap.set(collection.id, collection));
  state.localCollections.forEach((record) => collectionMap.set(record.id, collectionFromLocalRecord(record)));

  state.githubStories.forEach((story) => storyMap.set(story.id, story));
  state.localStories.forEach((record) => storyMap.set(record.id, storyFromLocalRecord(record)));

  state.libraryDeletions.forEach((deletion) => {
    if (deletion.kind === "collection") {
      collectionMap.delete(deletion.id);
      [...storyMap.values()].forEach((story) => {
        if (story.collectionId === deletion.id) storyMap.delete(story.id);
      });
    }
    if (deletion.kind === "story") storyMap.delete(deletion.id);
  });

  state.collections = [...collectionMap.values()];
  state.stories = [...storyMap.values()];
  ensureCollectionsForStories();
  state.collections = state.collections.map((collection) => ({
    ...collection,
    storyCount: state.stories.filter((story) => story.collectionId === collection.id).length
  }));
  state.storySearchCache = new WeakMap();
  state.collectionSearchCache = new WeakMap();
}

async function loadLocalLibraryIntoState() {
  const records = await loadLocalLibraryRecords();
  state.localCollections = records.collections || [];
  state.localStories = records.stories || [];
  state.libraryDeletions = new Map((records.deletions || []).map((record) => [record.key, record]));
  rebuildMergedLibrary();
}

async function getCloudDocuments(name) {
  const services = state.firebaseServices || await window.firebaseReadyPromise;
  const {collection, getDocs} = services.firestoreApi;
  const snapshot = await getDocs(collection(services.db, ...firebaseUserCollectionPath(name)));
  return snapshot.docs.map((documentSnapshot) => documentSnapshot.data());
}

async function reconcileRecords(localRecords, cloudRecords, saveLocal, saveCloud) {
  const localMap = new Map(localRecords.map((record) => [record.id || record.key, record]));
  const cloudMap = new Map(cloudRecords.map((record) => [record.id || record.key, record]));
  const ids = new Set([...localMap.keys(), ...cloudMap.keys()]);

  for (const id of ids) {
    const local = localMap.get(id);
    const cloud = cloudMap.get(id);
    if (!cloud || (local && Number(local.updatedAt) > Number(cloud.updatedAt || 0))) {
      if (local) await saveCloud(local);
      continue;
    }
    if (!local || Number(cloud.updatedAt) >= Number(local.updatedAt || 0)) {
      await saveLocal(cloud);
    }
  }
}


async function applyDeletionRecordsToCustomLibrary() {
  const deletionRecords = await localGetAll(LOCAL_LIBRARY_DB.stores.deletions);
  const localStoryRecords = await localGetAll(LOCAL_LIBRARY_DB.stores.stories);

  for (const deletion of deletionRecords) {
    if (deletion.kind === "story") {
      await removeLocalStoryRecord(deletion.id);
      try { await firebaseDeleteDocument(CLOUD_PATHS.stories, deletion.id); } catch {}
    }
    if (deletion.kind === "collection") {
      await removeLocalCollectionRecord(deletion.id);
      const matchingStories = localStoryRecords.filter((record) => record.story?.collectionId === deletion.id);
      for (const record of matchingStories) {
        await removeLocalStoryRecord(record.id);
        try { await deleteThumbnailFromFirebase(record.thumbnailStoragePath); } catch {}
        try { await firebaseDeleteDocument(CLOUD_PATHS.stories, record.id); } catch {}
      }
      try { await firebaseDeleteDocument(CLOUD_PATHS.collections, deletion.id); } catch {}
    }
  }
}

async function syncReaderStatesWithCloud(cloudRecords) {
  const cloudMap = Object.fromEntries(cloudRecords.map((record) => [record.id, record]));
  const local = exportLocalReaderState();
  mergeCloudReaderState(cloudMap);

  for (const [storyId, localState] of Object.entries(local)) {
    const cloudState = cloudMap[storyId];
    if (!cloudState || Number(localState.updatedAt) > Number(cloudState.updatedAt || 0)) {
      await firebaseSetDocument(CLOUD_PATHS.readerState, storyId, {id: storyId, ...localState});
    }
  }
}

async function syncCloudData(options = {}) {
  if (!state.firebaseUser) {
    setFirebaseStatus("offline", "Local only", "Sign in to synchronize with Firebase.");
    return;
  }
  if (cloudSyncRunning && !options.force) return cloudSyncRunning;

  cloudSyncRunning = (async () => {
    setFirebaseStatus("syncing", "Synchronizing…", state.firebaseUser.email);
    const [cloudCollections, cloudStories, cloudDeletions, cloudReaderState] = await Promise.all([
      getCloudDocuments(CLOUD_PATHS.collections),
      getCloudDocuments(CLOUD_PATHS.stories),
      getCloudDocuments(CLOUD_PATHS.deletions),
      getCloudDocuments(CLOUD_PATHS.readerState)
    ]);

    await reconcileRecords(
      state.localCollections,
      cloudCollections,
      saveLocalCollectionRecord,
      (record) => firebaseSetDocument(CLOUD_PATHS.collections, record.id, collectionCloudPayload(record))
    );
    await reconcileRecords(
      state.localStories,
      cloudStories,
      saveCloudStoryLocally,
      syncLocalStoryRecordToCloud
    );
    await reconcileRecords(
      [...state.libraryDeletions.values()],
      cloudDeletions,
      saveLocalDeletionRecord,
      (record) => firebaseSetDocument(CLOUD_PATHS.deletions, record.key, record)
    );
    await applyDeletionRecordsToCustomLibrary();
    await syncReaderStatesWithCloud(cloudReaderState);
    await loadLocalLibraryIntoState();

    if (libraryView.classList.contains("view-active")) renderLibrary(searchInput.value);
    if (state.activeStory) {
      updateBookmarkButton();
      markRenderedBookmark();
    }
    setFirebaseStatus("synced", "Synced", state.firebaseUser.email);
  })().catch((error) => {
    console.error("Firebase synchronization failed:", error);
    setFirebaseStatus("error", "Sync failed", error.message || "Check Firebase rules and network access.");
    throw error;
  }).finally(() => {
    cloudSyncRunning = null;
  });

  return cloudSyncRunning;
}

async function signInToFirebase() {
  const email = firebaseEmailInput?.value.trim();
  const password = firebasePasswordInput?.value || "";
  if (!email || !password) {
    showToast("Enter your Firebase email and password");
    return;
  }

  try {
    setFirebaseStatus("syncing", "Signing in…", email);
    const services = state.firebaseServices || await window.firebaseReadyPromise;
    await services.authApi.signInWithEmailAndPassword(services.auth, email, password);
    firebasePasswordInput.value = "";
  } catch (error) {
    console.error(error);
    setFirebaseStatus("error", "Sign-in failed", friendlyFirebaseError(error));
  }
}

async function signOutOfFirebase() {
  try {
    const services = state.firebaseServices || await window.firebaseReadyPromise;
    await services.authApi.signOut(services.auth);
  } catch (error) {
    setFirebaseStatus("error", "Sign-out failed", error.message);
  }
}

function friendlyFirebaseError(error) {
  const code = String(error?.code || "");
  if (code.includes("invalid-credential")) return "Email or password is incorrect.";
  if (code.includes("too-many-requests")) return "Too many attempts. Try again later.";
  if (code.includes("operation-not-allowed")) return "Enable Email/Password authentication in Firebase.";
  if (code.includes("permission-denied")) return "Firebase security rules denied access.";
  return error?.message || "Firebase operation failed.";
}

async function initializeCloudSync() {
  setFirebaseStatus("loading", "Connecting…", "Preparing Firebase.");
  try {
    const services = await window.firebaseReadyPromise;
    state.firebaseServices = services;

    firebaseAuthUnsubscribe?.();
    firebaseAuthUnsubscribe = services.authApi.onAuthStateChanged(services.auth, async (user) => {
      state.firebaseUser = user || null;
      if (!user) {
        setFirebaseStatus(navigator.onLine ? "offline" : "offline", "Local only", "Sign in to synchronize with Firebase.");
        return;
      }
      setFirebaseStatus("syncing", "Signed in", user.email || "Firebase account");
      try {
        await syncCloudData({force: true});
      } catch {}
    });
  } catch (error) {
    setFirebaseStatus("error", "Firebase unavailable", friendlyFirebaseError(error));
  }
}

firebaseLoginButton?.addEventListener("click", signInToFirebase);
firebasePasswordInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") signInToFirebase();
});
firebaseSignOutButton?.addEventListener("click", signOutOfFirebase);
firebaseSyncButton?.addEventListener("click", () => syncCloudData({force: true}));
window.addEventListener("online", () => {
  if (state.firebaseUser) syncCloudData({force: true});
});
window.addEventListener("offline", () => setFirebaseStatus("offline", "Offline", "Changes remain saved locally."));
