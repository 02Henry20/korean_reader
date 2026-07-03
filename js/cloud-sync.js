const CLOUD_PATHS = Object.freeze({
  collections: "libraryCollections",
  stories: "libraryStories",
  readerState: "readerState",
  deletions: "libraryDeletions"
});

let firebaseAuthUnsubscribe = null;
let cloudSyncRunning = null;
let cloudSyncQueued = false;

const FIRESTORE_SAFE_DOCUMENT_BYTES = 900 * 1024;
const FIREBASE_REQUEST_TIMEOUT_MS = 45_000;

function createFirebaseSyncError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function formatCloudBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function withFirebaseTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(createFirebaseSyncError(
        "app/firebase-timeout",
        `${label} timed out. Check the network connection and Firebase rules.`
      ));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function cloudPayloadByteSize(payload) {
  const json = JSON.stringify(cleanForCloud(payload));
  return new TextEncoder().encode(json).byteLength;
}

function assertFirestorePayloadSize(payload, id) {
  const bytes = cloudPayloadByteSize(payload);
  if (bytes > FIRESTORE_SAFE_DOCUMENT_BYTES) {
    throw createFirebaseSyncError(
      "app/firestore-document-too-large",
      `Story “${id}” is ${formatCloudBytes(bytes)} after serialization. Firestore documents must stay below 1 MiB; split or shorten this story.`
    );
  }
}

function setFirebaseProgress(percent, label = "", options = {}) {
  if (!firebaseSyncProgress) return;
  const fill = firebaseSyncProgress.querySelector(".firebase-sync-progress-fill") || firebaseSyncProgress.querySelector("span");
  const output = document.getElementById("firebaseSyncProgressLabel");
  const normalized = Math.max(0, Math.min(100, Number(percent) || 0));
  const indeterminate = Boolean(options.indeterminate);

  firebaseSyncProgress.dataset.indeterminate = String(indeterminate);
  firebaseSyncProgress.setAttribute("aria-valuenow", String(Math.round(normalized)));
  firebaseSyncProgress.setAttribute("aria-valuetext", label || `${Math.round(normalized)}%`);

  if (fill) {
    fill.style.width = indeterminate ? "34%" : `${normalized}%`;
    fill.style.animation = indeterminate ? "" : "none";
  }
  if (output) output.textContent = label || `${Math.round(normalized)}%`;
}

function createSyncProgress(initialTotal = 1) {
  let total = Math.max(1, Number(initialTotal) || 1);
  let completed = 0;
  let currentFraction = 0;

  const render = (label = "") => {
    const percent = ((completed + currentFraction) / total) * 100;
    const itemLabel = label ? `${Math.round(percent)}% · ${label}` : `${Math.round(percent)}%`;
    setFirebaseProgress(percent, itemLabel);
  };

  render("Preparing sync");

  return {
    setTotal(value) {
      total = Math.max(completed + 1, Number(value) || 1);
      render();
    },
    setCurrent(fraction, label = "") {
      currentFraction = Math.max(0, Math.min(0.99, Number(fraction) || 0));
      render(label);
    },
    step(label = "") {
      completed = Math.min(total, completed + 1);
      currentFraction = 0;
      render(label);
    },
    complete(label = "100%") {
      completed = total;
      currentFraction = 0;
      setFirebaseProgress(100, label);
    }
  };
}

function setFirebaseStatus(status, message, detail = "") {
  state.firebaseStatus = status;
  state.firebaseStatusMessage = message;
  if (firebaseStatusBadge) {
    firebaseStatusBadge.dataset.status = status;
    firebaseStatusBadge.textContent = status === "synced" ? "✓" : status === "error" || status === "warning" ? "!" : status === "offline" ? "○" : "…";
  }
  if (firebaseSyncProgress) {
    firebaseSyncProgress.dataset.status = status;
  }
  if (firebaseStatusText) firebaseStatusText.textContent = message;
  if (firebaseAccountText) firebaseAccountText.textContent = detail || (state.firebaseUser?.email || "Not signed in");

  const busy = status === "syncing" || status === "loading";
  if (firebaseSyncButton) {
    firebaseSyncButton.disabled = busy;
    firebaseSyncButton.textContent = busy ? "Syncing…" : "Sync now";
  }

  if (status === "loading") setFirebaseProgress(0, "Connecting…", {indeterminate: true});
  if (status === "offline") setFirebaseProgress(0, "Local only");
  if (status === "synced") setFirebaseProgress(100, "100% · Synced");

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

function cloudThumbnailReference(value) {
  const reference = String(value || "").trim();
  if (!reference || /^(?:blob:|data:|file:)/i.test(reference)) return "";
  return reference;
}

function storyCloudPayload(record) {
  const story = {...record.story};
  const thumbnail = cloudThumbnailReference(story.thumbnail || record.thumbnailUrl);
  if (thumbnail) story.thumbnail = thumbnail;
  else delete story.thumbnail;

  return cleanForCloud({
    id: record.id,
    story,
    collectionId: story.collectionId,
    thumbnailUrl: thumbnail,
    thumbnailStoragePath: "",
    updatedAt: record.updatedAt,
    sourceType: "custom"
  });
}

async function firebaseSetDocument(collectionName, id, payload) {
  const services = state.firebaseServices || await window.firebaseReadyPromise;
  const {doc, setDoc} = services.firestoreApi;
  const path = firebaseUserCollectionPath(collectionName);
  const cleanedPayload = cleanForCloud(payload);
  assertFirestorePayloadSize(cleanedPayload, id);
  await withFirebaseTimeout(
    setDoc(doc(services.db, ...path, encodeURIComponent(String(id))), cleanedPayload, {merge: true}),
    FIREBASE_REQUEST_TIMEOUT_MS,
    `Uploading ${id}`
  );
}

async function firebaseDeleteDocument(collectionName, id) {
  if (!state.firebaseUser) return;
  const services = state.firebaseServices || await window.firebaseReadyPromise;
  const {doc, deleteDoc} = services.firestoreApi;
  const path = firebaseUserCollectionPath(collectionName);
  await withFirebaseTimeout(
    deleteDoc(doc(services.db, ...path, encodeURIComponent(String(id)))),
    FIREBASE_REQUEST_TIMEOUT_MS,
    `Deleting ${id}`
  );
}

async function queueReaderStateCloudWrite(storyId, value) {
  if (!state.firebaseUser) {
    setFirebaseStatus("offline", "Saved locally", "Sign in to synchronize reader state.");
    return;
  }
  if (cloudSyncRunning) {
    cloudSyncQueued = true;
    return;
  }
  const ownsStatus = true;
  try {
    setFirebaseStatus("syncing", "Saving reader state…", state.firebaseUser.email);
    await firebaseSetDocument(CLOUD_PATHS.readerState, storyId, {id: storyId, ...value});
    if (ownsStatus && !cloudSyncRunning) setFirebaseStatus("synced", "Synced", state.firebaseUser.email);
  } catch (error) {
    console.error(error);
    if (ownsStatus && !cloudSyncRunning) setFirebaseStatus("error", "Reader state not synced", friendlyFirebaseError(error));
  }
}

async function saveCustomCollection(record, options = {}) {
  await saveLocalCollectionRecord(record);
  if (state.firebaseUser && !options.localOnly) {
    if (cloudSyncRunning) {
      cloudSyncQueued = true;
      return;
    }
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
    if (cloudSyncRunning) {
      cloudSyncQueued = true;
      return;
    }
    const progress = createSyncProgress(1);
    try {
      setFirebaseStatus("syncing", "Uploading story…", record.id);
      await syncLocalStoryRecordToCloud(record, {
        onProgress: (fraction) => progress.setCurrent(fraction, `Uploading ${record.id}`)
      });
      progress.complete("100% · Uploaded");
      setFirebaseStatus("synced", "Synced", state.firebaseUser.email);
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

async function syncLocalStoryRecordToCloud(record, options = {}) {
  const onProgress = options.onProgress || (() => {});
  onProgress(0.2);
  await firebaseSetDocument(CLOUD_PATHS.stories, record.id, storyCloudPayload(record));
  onProgress(1);
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
    if (cloudSyncRunning) {
      cloudSyncQueued = true;
      return record;
    }
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
  const snapshot = await withFirebaseTimeout(
    getDocs(collection(services.db, ...firebaseUserCollectionPath(name))),
    FIREBASE_REQUEST_TIMEOUT_MS,
    `Downloading ${name}`
  );
  return snapshot.docs.map((documentSnapshot) => documentSnapshot.data());
}

function reconciliationItemCount(localRecords, cloudRecords) {
  return new Set([
    ...localRecords.map((record) => record.id || record.key),
    ...cloudRecords.map((record) => record.id || record.key)
  ]).size;
}

async function reconcileRecords(localRecords, cloudRecords, saveLocal, saveCloud, options = {}) {
  const localMap = new Map(localRecords.map((record) => [record.id || record.key, record]));
  const cloudMap = new Map(cloudRecords.map((record) => [record.id || record.key, record]));
  const ids = new Set([...localMap.keys(), ...cloudMap.keys()]);
  const progress = options.progress;
  const label = options.label || "Synchronizing";

  for (const id of ids) {
    const local = localMap.get(id);
    const cloud = cloudMap.get(id);
    const localUpdatedAt = Number(local?.updatedAt || 0);
    const cloudUpdatedAt = Number(cloud?.updatedAt || 0);
    const preferLocal = Boolean(options.preferLocal?.(local, cloud));

    progress?.setCurrent(0.03, `${label}: ${id}`);
    if (!cloud || (local && (localUpdatedAt > cloudUpdatedAt || preferLocal))) {
      if (local) {
        await saveCloud(local, (fraction) => progress?.setCurrent(fraction, `${label}: ${id}`));
      }
    } else if (!local || cloudUpdatedAt >= localUpdatedAt) {
      progress?.setCurrent(0.5, `${label}: ${id}`);
      await saveLocal(cloud);
    }
    progress?.step(`${label}: ${id}`);
  }
}


async function applyDeletionRecordsToCustomLibrary(progress) {
  const deletionRecords = await localGetAll(LOCAL_LIBRARY_DB.stores.deletions);
  const localStoryRecords = await localGetAll(LOCAL_LIBRARY_DB.stores.stories);

  if (!deletionRecords.length) {
    progress?.step("No deletions to apply");
    return;
  }

  for (let index = 0; index < deletionRecords.length; index += 1) {
    const deletion = deletionRecords[index];
    progress?.setCurrent(index / deletionRecords.length, `Applying deletions: ${index + 1}/${deletionRecords.length}`);
    if (deletion.kind === "story") {
      await removeLocalStoryRecord(deletion.id);
      await firebaseDeleteDocument(CLOUD_PATHS.stories, deletion.id);
    }
    if (deletion.kind === "collection") {
      await removeLocalCollectionRecord(deletion.id);
      const matchingStories = localStoryRecords.filter((record) => record.story?.collectionId === deletion.id);
      for (const record of matchingStories) {
        await removeLocalStoryRecord(record.id);
        await firebaseDeleteDocument(CLOUD_PATHS.stories, record.id);
      }
      await firebaseDeleteDocument(CLOUD_PATHS.collections, deletion.id);
    }
  }
  progress?.step("Applied deletions");
}

async function syncReaderStatesWithCloud(cloudRecords, progress, localState = exportLocalReaderState()) {
  const cloudMap = Object.fromEntries(cloudRecords.map((record) => [record.id, record]));
  mergeCloudReaderState(cloudMap);
  progress?.step("Merged reader state");

  for (const [storyId, localStateValue] of Object.entries(localState)) {
    const cloudState = cloudMap[storyId];
    progress?.setCurrent(0.1, `Reader state: ${storyId}`);
    if (!cloudState || Number(localStateValue.updatedAt) > Number(cloudState.updatedAt || 0)) {
      await firebaseSetDocument(CLOUD_PATHS.readerState, storyId, {id: storyId, ...localStateValue});
    }
    progress?.step(`Reader state: ${storyId}`);
  }
}

async function syncCloudData(options = {}) {
  if (!state.firebaseUser) {
    setFirebaseStatus("offline", "Local only", "Sign in to synchronize with Firebase.");
    return;
  }
  if (cloudSyncRunning) {
    if (options.force) cloudSyncQueued = true;
    return cloudSyncRunning;
  }

  const localReaderState = exportLocalReaderState();
  const initialTotal = 8
    + state.localCollections.length
    + state.localStories.length
    + (state.libraryDeletions?.size || 0)
    + Object.keys(localReaderState).length;
  const progress = createSyncProgress(initialTotal);
  cloudSyncRunning = (async () => {
    setFirebaseStatus("syncing", "Synchronizing…", state.firebaseUser.email);

    const readCloudGroup = async (name, label) => {
      progress.setCurrent(0.1, label);
      const records = await getCloudDocuments(name);
      progress.step(label);
      return records;
    };

    const [cloudCollections, cloudStories, cloudDeletions, cloudReaderState] = await Promise.all([
      readCloudGroup(CLOUD_PATHS.collections, "Downloaded collections"),
      readCloudGroup(CLOUD_PATHS.stories, "Downloaded stories"),
      readCloudGroup(CLOUD_PATHS.deletions, "Downloaded deletions"),
      readCloudGroup(CLOUD_PATHS.readerState, "Downloaded reader state")
    ]);

    const exactTotal = 4
      + reconciliationItemCount(state.localCollections, cloudCollections)
      + reconciliationItemCount(state.localStories, cloudStories)
      + reconciliationItemCount([...state.libraryDeletions.values()], cloudDeletions)
      + 1
      + 1
      + Object.keys(localReaderState).length
      + 1;
    progress.setTotal(exactTotal);

    await reconcileRecords(
      state.localCollections,
      cloudCollections,
      saveLocalCollectionRecord,
      (record) => firebaseSetDocument(CLOUD_PATHS.collections, record.id, collectionCloudPayload(record)),
      {progress, label: "Collections"}
    );
    await reconcileRecords(
      state.localStories,
      cloudStories,
      saveCloudStoryLocally,
      (record, onProgress) => syncLocalStoryRecordToCloud(record, {onProgress}),
      {progress, label: "Stories"}
    );
    await reconcileRecords(
      [...state.libraryDeletions.values()],
      cloudDeletions,
      saveLocalDeletionRecord,
      (record) => firebaseSetDocument(CLOUD_PATHS.deletions, record.key, record),
      {progress, label: "Deletion markers"}
    );
    await applyDeletionRecordsToCustomLibrary(progress);
    await syncReaderStatesWithCloud(cloudReaderState, progress, localReaderState);

    progress.setCurrent(0.3, "Refreshing local library");
    await loadLocalLibraryIntoState();
    if (libraryView.classList.contains("view-active")) renderLibrary(searchInput.value);
    if (state.activeStory) {
      updateBookmarkButton();
      markRenderedBookmark();
    }
    progress.step("Refreshed library");
    progress.complete("100% · Synced");
    setFirebaseStatus("synced", "Synced", state.firebaseUser.email);
  })().catch((error) => {
    console.error("Firebase synchronization failed:", error);
    setFirebaseStatus("error", "Sync failed", friendlyFirebaseError(error));
    throw error;
  }).finally(() => {
    cloudSyncRunning = null;
    if (cloudSyncQueued && state.firebaseUser && navigator.onLine) {
      cloudSyncQueued = false;
      window.setTimeout(() => syncCloudData().catch(() => {}), 0);
    }
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
  const message = String(error?.message || "");

  if (code.includes("invalid-credential")) return "Email or password is incorrect.";
  if (code.includes("too-many-requests")) return "Too many attempts. Try again later.";
  if (code.includes("operation-not-allowed")) return "Enable Email/Password authentication in Firebase.";
  if (code.includes("permission-denied")) return "Firestore security rules denied this operation.";
  if (code.includes("resource-exhausted")) return "Firebase quota has been exceeded.";
  if (code.includes("firestore-document-too-large")) return error.message;
  if (code.includes("firebase-timeout")) return error.message;
  return message || "Firebase operation failed.";
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
firebaseSyncButton?.addEventListener("click", () => syncCloudData({force: true}).catch(() => {}));
window.addEventListener("online", () => {
  if (state.firebaseUser) syncCloudData({force: true}).catch(() => {});
});
window.addEventListener("offline", () => setFirebaseStatus("offline", "Offline", "Changes remain saved locally."));
