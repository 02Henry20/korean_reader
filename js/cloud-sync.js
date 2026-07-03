const CLOUD_PATHS = Object.freeze({
  collections: "libraryCollections",
  stories: "libraryStories",
  readerState: "readerState",
  deletions: "libraryDeletions",
  metadata: "syncMetadata"
});

const SYNC_SCHEMA_VERSION = 2;
const FIRESTORE_SAFE_DOCUMENT_BYTES = 900 * 1024;
const FIREBASE_REQUEST_TIMEOUT_MS = 45_000;
const SYNC_DEVICE_ID_KEY = "korean-reader-sync-device-id-v1";
const SYNC_BASELINE_KEY_PREFIX = "korean-reader-sync-baseline-v2";

let firebaseAuthUnsubscribe = null;
let cloudSyncRunning = null;
let cloudSyncQueued = false;
let cloudAutoSyncTimer = null;
let syncDecisionResolver = null;
let syncDecisionPreviousFocus = null;

function createFirebaseSyncError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function withFirebaseTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(createFirebaseSyncError(
        "app/firebase-timeout",
        `${label} timed out. Check the network connection and Firestore rules.`
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
      `“${id}” is too large for one Firestore document. Shorten or split this story.`
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
    setFirebaseProgress(percent, label ? `${Math.round(percent)}% · ${label}` : `${Math.round(percent)}%`);
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
    complete(label = "100% · Synced") {
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
    firebaseStatusBadge.textContent = status === "synced"
      ? "✓"
      : status === "error" || status === "warning"
        ? "!"
        : status === "offline"
          ? "○"
          : "…";
  }
  if (firebaseSyncProgress) firebaseSyncProgress.dataset.status = status;
  if (firebaseStatusText) firebaseStatusText.textContent = message;
  if (firebaseAccountText) firebaseAccountText.textContent = detail || (state.firebaseUser?.email || "Not signed in");

  const busy = status === "syncing" || status === "loading";
  if (firebaseSyncButton) {
    firebaseSyncButton.disabled = busy;
    firebaseSyncButton.textContent = busy ? "Checking…" : "Sync now";
  }

  if (status === "loading") setFirebaseProgress(0, "Connecting…", {indeterminate: true});
  if (status === "offline") setFirebaseProgress(0, "Local only");
  if (status === "warning") setFirebaseProgress(0, "Action required");
  if (status === "synced") setFirebaseProgress(100, "100% · Synced");

  if (firebaseSignedOutControls) firebaseSignedOutControls.hidden = Boolean(state.firebaseUser);
  if (firebaseSignedInControls) firebaseSignedInControls.hidden = !state.firebaseUser;
}

function firebaseUserCollectionPath(name) {
  if (!state.firebaseUser) throw new Error("Sign in before using Firebase sync.");
  return ["koreanReaderUsers", state.firebaseUser.uid, name];
}

function firebaseUserDocumentRef(collectionName, id) {
  if (!state.firebaseUser) throw new Error("Sign in before using Firebase sync.");
  const services = state.firebaseServices || window.firebaseServices;
  return services.firestoreApi.doc(
    services.db,
    ...firebaseUserCollectionPath(collectionName),
    encodeURIComponent(String(id))
  );
}

function cleanForCloud(value) {
  if (Array.isArray(value)) {
    return value.map(cleanForCloud).filter((item) => item !== undefined);
  }
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
    id: String(record.id),
    collection: record.collection,
    updatedAt: Number(record.updatedAt) || 0,
    sourceType: "custom"
  });
}

function storyCloudPayload(record) {
  const story = {...(record.story || {})};
  const remoteThumbnail = String(record.thumbnailUrl || "").trim();
  if (remoteThumbnail && /^https?:/i.test(remoteThumbnail)) story.thumbnail = remoteThumbnail;
  if (/^(?:blob:|data:)/i.test(String(story.thumbnail || ""))) delete story.thumbnail;

  return cleanForCloud({
    id: String(record.id),
    story,
    collectionId: story.collectionId,
    updatedAt: Number(record.updatedAt) || 0,
    sourceType: "custom"
  });
}

function normalizeCollectionRecord(record) {
  if (!record) return null;
  return collectionCloudPayload({
    id: record.id || record.collection?.id,
    collection: record.collection || {},
    updatedAt: record.updatedAt
  });
}

function normalizeStoryRecord(record) {
  if (!record) return null;
  const story = {...(record.story || {})};
  if (!story.thumbnail && /^https?:/i.test(String(record.thumbnailUrl || ""))) {
    story.thumbnail = record.thumbnailUrl;
  }
  return storyCloudPayload({
    id: record.id || story.id,
    story,
    thumbnailUrl: record.thumbnailUrl,
    updatedAt: record.updatedAt
  });
}

function normalizeDeletionRecord(record) {
  if (!record) return null;
  const deletedAt = Number(record.deletedAt || record.updatedAt) || 0;
  return cleanForCloud({
    key: String(record.key || `${record.kind}:${record.id}`),
    kind: record.kind,
    id: String(record.id),
    deletedAt,
    updatedAt: deletedAt
  });
}

function normalizeReaderCloudRecord(record, id = record?.id) {
  const source = {...(record || {})};
  delete source.id;
  const normalized = typeof normalizeReaderStateRecord === "function"
    ? normalizeReaderStateRecord(source)
    : source;
  return cleanForCloud({id: String(id), ...normalized});
}

async function firebaseSetDocument(collectionName, id, payload) {
  const services = state.firebaseServices || await window.firebaseReadyPromise;
  const cleanedPayload = cleanForCloud(payload);
  assertFirestorePayloadSize(cleanedPayload, id);
  await withFirebaseTimeout(
    services.firestoreApi.setDoc(firebaseUserDocumentRef(collectionName, id), cleanedPayload),
    FIREBASE_REQUEST_TIMEOUT_MS,
    `Uploading ${id}`
  );
}

async function firebaseDeleteDocument(collectionName, id) {
  if (!state.firebaseUser) return;
  const services = state.firebaseServices || await window.firebaseReadyPromise;
  await withFirebaseTimeout(
    services.firestoreApi.deleteDoc(firebaseUserDocumentRef(collectionName, id)),
    FIREBASE_REQUEST_TIMEOUT_MS,
    `Deleting ${id}`
  );
}

async function getCloudDocuments(name) {
  const services = state.firebaseServices || await window.firebaseReadyPromise;
  const {collection, getDocs} = services.firestoreApi;
  const snapshot = await withFirebaseTimeout(
    getDocs(collection(services.db, ...firebaseUserCollectionPath(name))),
    FIREBASE_REQUEST_TIMEOUT_MS,
    `Downloading ${name}`
  );
  return snapshot.docs.map((documentSnapshot) => ({
    ...documentSnapshot.data(),
    id: documentSnapshot.data().id || decodeURIComponent(documentSnapshot.id)
  }));
}

async function getCloudMetadata() {
  const services = state.firebaseServices || await window.firebaseReadyPromise;
  const snapshot = await withFirebaseTimeout(
    services.firestoreApi.getDoc(firebaseUserDocumentRef(CLOUD_PATHS.metadata, "main")),
    FIREBASE_REQUEST_TIMEOUT_MS,
    "Downloading sync metadata"
  );
  return snapshot.exists()
    ? snapshot.data()
    : {revision: 0, schemaVersion: SYNC_SCHEMA_VERSION};
}

function syncDeviceId() {
  let id = storageGet(SYNC_DEVICE_ID_KEY);
  if (id) return id;
  id = typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  storageSet(SYNC_DEVICE_ID_KEY, id);
  return id;
}

function syncBaselineKey() {
  return `${SYNC_BASELINE_KEY_PREFIX}:${state.firebaseUser?.uid || "signed-out"}`;
}

function readSyncBaseline() {
  if (!state.firebaseUser) return null;
  const baseline = loadJSONV6(syncBaselineKey(), null);
  return baseline && typeof baseline === "object" ? baseline : null;
}

function writeSyncBaseline({revision, localFingerprint, cloudFingerprint}) {
  if (!state.firebaseUser) return;
  storageSet(syncBaselineKey(), JSON.stringify({
    schemaVersion: SYNC_SCHEMA_VERSION,
    revision: Number(revision) || 0,
    localFingerprint,
    cloudFingerprint,
    deviceId: syncDeviceId(),
    syncedAt: Date.now()
  }));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => key !== "thumbnailBlob" && key !== "thumbnailStoragePath")
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function recordId(record) {
  return String(record?.key || record?.id || "");
}

function sortedRecords(records) {
  return [...(records || [])]
    .filter(Boolean)
    .sort((left, right) => recordId(left).localeCompare(recordId(right)));
}

function snapshotFingerprint(snapshot) {
  const normalized = {
    collections: sortedRecords(snapshot.collections).map(normalizeCollectionRecord),
    stories: sortedRecords(snapshot.stories).map(normalizeStoryRecord),
    deletions: sortedRecords(snapshot.deletions).map(normalizeDeletionRecord),
    readerState: sortedRecords(snapshot.readerState).map((record) => normalizeReaderCloudRecord(record, record.id))
  };
  return `${hashString(stableStringify(normalized))}:${stableStringify(normalized).length}`;
}

function readerStateArrayFromLocal() {
  return Object.entries(exportLocalReaderState()).map(([id, value]) => normalizeReaderCloudRecord(value, id));
}

function getLocalSyncSnapshot() {
  return {
    collections: state.localCollections.map(normalizeCollectionRecord),
    stories: state.localStories.map(normalizeStoryRecord),
    deletions: [...state.libraryDeletions.values()].map(normalizeDeletionRecord),
    readerState: readerStateArrayFromLocal(),
    metadata: null
  };
}

async function getCloudSyncSnapshot(progress) {
  const read = async (path, label) => {
    progress?.setCurrent(0.15, label);
    const records = await getCloudDocuments(path);
    progress?.step(label);
    return records;
  };

  const [collections, stories, deletions, readerState, metadata] = await Promise.all([
    read(CLOUD_PATHS.collections, "Downloaded collections"),
    read(CLOUD_PATHS.stories, "Downloaded stories"),
    read(CLOUD_PATHS.deletions, "Downloaded deletions"),
    read(CLOUD_PATHS.readerState, "Downloaded reader state"),
    getCloudMetadata()
  ]);

  return {
    collections: collections.map(normalizeCollectionRecord),
    stories: stories.map(normalizeStoryRecord),
    deletions: deletions.map(normalizeDeletionRecord),
    readerState: readerState.map((record) => normalizeReaderCloudRecord(record, record.id)),
    metadata
  };
}

function snapshotHasData(snapshot) {
  return Boolean(
    snapshot.collections.length ||
    snapshot.stories.length ||
    snapshot.deletions.length ||
    snapshot.readerState.length
  );
}

function snapshotSummary(snapshot) {
  return {
    collections: snapshot.collections.length,
    stories: snapshot.stories.length,
    readerState: snapshot.readerState.length,
    deletions: snapshot.deletions.length
  };
}

function summaryText(summary) {
  return `${summary.collections} directories · ${summary.stories} stories · ${summary.readerState} reading states · ${summary.deletions} deletions`;
}

function syncDecisionElements() {
  return {
    backdrop: document.getElementById("syncDecisionBackdrop"),
    dialog: document.getElementById("syncDecisionDialog"),
    reason: document.getElementById("syncDecisionReason"),
    local: document.getElementById("syncDecisionLocalSummary"),
    cloud: document.getElementById("syncDecisionCloudSummary")
  };
}

function closeSyncDecision(choice = "cancel") {
  const {backdrop, dialog} = syncDecisionElements();
  dialog?.classList.remove("sync-decision-dialog-open");
  dialog?.setAttribute("aria-hidden", "true");
  backdrop?.classList.remove("sync-decision-backdrop-open");
  document.body.classList.remove("sync-decision-open");
  window.setTimeout(() => {
    if (backdrop && !backdrop.classList.contains("sync-decision-backdrop-open")) backdrop.hidden = true;
  }, 180);
  if (syncDecisionPreviousFocus instanceof HTMLElement) syncDecisionPreviousFocus.focus({preventScroll: true});
  syncDecisionPreviousFocus = null;
  const resolver = syncDecisionResolver;
  syncDecisionResolver = null;
  resolver?.(choice);
}

function requestSyncDecision(localSnapshot, cloudSnapshot, reason) {
  const {backdrop, dialog, reason: reasonElement, local, cloud} = syncDecisionElements();
  if (!backdrop || !dialog) return Promise.resolve("merge");

  if (syncDecisionResolver) closeSyncDecision("cancel");

  if (reasonElement) reasonElement.textContent = reason;
  if (local) local.textContent = summaryText(snapshotSummary(localSnapshot));
  if (cloud) cloud.textContent = summaryText(snapshotSummary(cloudSnapshot));

  syncDecisionPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  backdrop.hidden = false;
  dialog.setAttribute("aria-hidden", "false");
  document.body.classList.add("sync-decision-open");
  requestAnimationFrame(() => {
    backdrop.classList.add("sync-decision-backdrop-open");
    dialog.classList.add("sync-decision-dialog-open");
    document.getElementById("syncDecisionMergeButton")?.focus({preventScroll: true});
  });

  setFirebaseStatus("warning", "Choose a sync direction", "Nothing has been uploaded or deleted yet.");
  return new Promise((resolve) => {
    syncDecisionResolver = resolve;
  });
}

async function commitCloudRevision(reason) {
  const services = state.firebaseServices || await window.firebaseReadyPromise;
  const reference = firebaseUserDocumentRef(CLOUD_PATHS.metadata, "main");
  const {runTransaction} = services.firestoreApi;

  return withFirebaseTimeout(
    runTransaction(services.db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      const previous = snapshot.exists() ? snapshot.data() : {};
      const next = {
        revision: Number(previous.revision || 0) + 1,
        schemaVersion: SYNC_SCHEMA_VERSION,
        updatedAt: Date.now(),
        updatedByDevice: syncDeviceId(),
        reason: String(reason || "sync")
      };
      transaction.set(reference, next, {merge: true});
      return next;
    }),
    FIREBASE_REQUEST_TIMEOUT_MS,
    "Updating sync revision"
  );
}

function recordsMap(records) {
  return new Map((records || []).filter(Boolean).map((record) => [recordId(record), record]));
}

function recordsEqual(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function chooseNewestRecord(local, cloud) {
  if (!local) return cloud;
  if (!cloud) return local;
  const localUpdatedAt = Number(local.updatedAt || 0);
  const cloudUpdatedAt = Number(cloud.updatedAt || 0);
  if (localUpdatedAt > cloudUpdatedAt) return local;
  if (cloudUpdatedAt > localUpdatedAt) return cloud;
  if (recordsEqual(local, cloud)) return local;
  return cloud;
}

function mergeRecordMaps(localRecords, cloudRecords) {
  const localMap = recordsMap(localRecords);
  const cloudMap = recordsMap(cloudRecords);
  const desired = new Map();
  new Set([...localMap.keys(), ...cloudMap.keys()]).forEach((id) => {
    desired.set(id, chooseNewestRecord(localMap.get(id), cloudMap.get(id)));
  });
  return desired;
}

function resolveDeletionConflicts(collectionMap, storyMap, deletionMap) {
  const desiredDeletions = new Map(deletionMap);

  [...desiredDeletions.values()]
    .sort((left, right) => Number(left.deletedAt || 0) - Number(right.deletedAt || 0))
    .forEach((deletion) => {
      const deletedAt = Number(deletion.deletedAt || deletion.updatedAt || 0);

      if (deletion.kind === "story") {
        const story = storyMap.get(String(deletion.id));
        if (story && Number(story.updatedAt || 0) >= deletedAt) {
          desiredDeletions.delete(deletion.key);
        } else {
          storyMap.delete(String(deletion.id));
        }
        return;
      }

      if (deletion.kind === "collection") {
        const id = String(deletion.id);
        const collection = collectionMap.get(id);
        const matchingStories = [...storyMap.values()].filter((story) => story.story?.collectionId === id);
        const newestContentTime = Math.max(
          Number(collection?.updatedAt || 0),
          ...matchingStories.map((story) => Number(story.updatedAt || 0)),
          0
        );

        if (newestContentTime >= deletedAt) {
          desiredDeletions.delete(deletion.key);
        } else {
          collectionMap.delete(id);
          matchingStories.forEach((story) => storyMap.delete(String(story.id)));
        }
      }
    });

  return desiredDeletions;
}

async function syncDesiredRecordSet({
  desired,
  localRecords,
  cloudRecords,
  saveLocal,
  deleteLocal,
  cloudPath,
  progress,
  label
}) {
  const localMap = recordsMap(localRecords);
  const cloudMap = recordsMap(cloudRecords);
  const ids = new Set([...desired.keys(), ...localMap.keys(), ...cloudMap.keys()]);

  for (const id of ids) {
    const target = desired.get(id);
    const local = localMap.get(id);
    const cloud = cloudMap.get(id);
    progress?.setCurrent(0.1, `${label}: ${id}`);

    if (target) {
      if (!local || !recordsEqual(local, target)) await saveLocal(target);
      progress?.setCurrent(0.55, `${label}: ${id}`);
      if (!cloud || !recordsEqual(cloud, target)) await firebaseSetDocument(cloudPath, id, target);
    } else {
      if (local) await deleteLocal(id);
      progress?.setCurrent(0.55, `${label}: ${id}`);
      if (cloud) await firebaseDeleteDocument(cloudPath, id);
    }
    progress?.step(`${label}: ${id}`);
  }
}

function mergeReaderStateMaps(localRecords, cloudRecords) {
  const localMap = recordsMap(localRecords);
  const cloudMap = recordsMap(cloudRecords);
  const desired = new Map();

  new Set([...localMap.keys(), ...cloudMap.keys()]).forEach((id) => {
    const local = localMap.get(id);
    const cloud = cloudMap.get(id);
    let merged;
    if (typeof mergeReaderStateRecords === "function") {
      merged = mergeReaderStateRecords(local || {}, cloud || {});
    } else {
      merged = chooseNewestRecord(local, cloud) || {};
    }
    desired.set(id, normalizeReaderCloudRecord(merged, id));
  });

  return desired;
}

async function syncDesiredReaderStates(desired, localRecords, cloudRecords, progress) {
  const cloudMap = recordsMap(cloudRecords);
  const localObject = Object.fromEntries(
    [...desired.entries()].map(([id, record]) => {
      const value = {...record};
      delete value.id;
      return [id, value];
    })
  );

  if (typeof replaceLocalReaderState === "function") replaceLocalReaderState(localObject);
  else mergeCloudReaderState(localObject);

  for (const [id, target] of desired) {
    progress?.setCurrent(0.1, `Reading state: ${id}`);
    if (!cloudMap.has(id) || !recordsEqual(cloudMap.get(id), target)) {
      await firebaseSetDocument(CLOUD_PATHS.readerState, id, target);
    }
    progress?.step(`Reading state: ${id}`);
  }
}

async function refreshLibraryAfterSync() {
  await loadLocalLibraryIntoState();
  if (libraryView.classList.contains("view-active")) renderLibrary(searchInput.value);
  if (state.activeStory) {
    updateBookmarkButton();
    markRenderedBookmark();
  }
}

async function mergeLocalAndCloud(localSnapshot, cloudSnapshot, progress) {
  const collections = mergeRecordMaps(localSnapshot.collections, cloudSnapshot.collections);
  const stories = mergeRecordMaps(localSnapshot.stories, cloudSnapshot.stories);
  const deletions = mergeRecordMaps(localSnapshot.deletions, cloudSnapshot.deletions);
  const resolvedDeletions = resolveDeletionConflicts(collections, stories, deletions);
  const readerStates = mergeReaderStateMaps(localSnapshot.readerState, cloudSnapshot.readerState);

  const total =
    new Set([...collections.keys(), ...recordsMap(localSnapshot.collections).keys(), ...recordsMap(cloudSnapshot.collections).keys()]).size +
    new Set([...stories.keys(), ...recordsMap(localSnapshot.stories).keys(), ...recordsMap(cloudSnapshot.stories).keys()]).size +
    new Set([...resolvedDeletions.keys(), ...recordsMap(localSnapshot.deletions).keys(), ...recordsMap(cloudSnapshot.deletions).keys()]).size +
    readerStates.size + 3;
  progress.setTotal(total);

  await syncDesiredRecordSet({
    desired: collections,
    localRecords: localSnapshot.collections,
    cloudRecords: cloudSnapshot.collections,
    saveLocal: saveLocalCollectionRecord,
    deleteLocal: removeLocalCollectionRecord,
    cloudPath: CLOUD_PATHS.collections,
    progress,
    label: "Directories"
  });

  await syncDesiredRecordSet({
    desired: stories,
    localRecords: localSnapshot.stories,
    cloudRecords: cloudSnapshot.stories,
    saveLocal: saveCloudStoryLocally,
    deleteLocal: removeLocalStoryRecord,
    cloudPath: CLOUD_PATHS.stories,
    progress,
    label: "Stories"
  });

  await syncDesiredRecordSet({
    desired: resolvedDeletions,
    localRecords: localSnapshot.deletions,
    cloudRecords: cloudSnapshot.deletions,
    saveLocal: saveLocalDeletionRecord,
    deleteLocal: removeLocalDeletionRecord,
    cloudPath: CLOUD_PATHS.deletions,
    progress,
    label: "Deletions"
  });

  await syncDesiredReaderStates(readerStates, localSnapshot.readerState, cloudSnapshot.readerState, progress);

  progress.setCurrent(0.2, "Updating cloud revision");
  const metadata = await commitCloudRevision("merge");
  progress.step("Updated cloud revision");

  progress.setCurrent(0.3, "Refreshing library");
  await refreshLibraryAfterSync();
  progress.step("Refreshed library");

  const finalLocal = getLocalSyncSnapshot();
  const fingerprint = snapshotFingerprint(finalLocal);
  writeSyncBaseline({
    revision: metadata.revision,
    localFingerprint: fingerprint,
    cloudFingerprint: fingerprint
  });
  progress.step("Saved device baseline");
}

async function replaceLocalWithCloud(localSnapshot, cloudSnapshot, progress) {
  if (!window.confirm(
    "Replace this device with the Firebase data? Local custom content that is not in Firebase will be removed."
  )) return false;

  const collectionMap = recordsMap(cloudSnapshot.collections);
  const storyMap = recordsMap(cloudSnapshot.stories);
  const deletionMap = recordsMap(cloudSnapshot.deletions);
  const resolvedDeletions = resolveDeletionConflicts(collectionMap, storyMap, deletionMap);
  const localThumbnailBlobs = new Map(
    state.localStories
      .filter((record) => record.thumbnailBlob instanceof Blob)
      .map((record) => [String(record.id), record.thumbnailBlob])
  );

  progress.setTotal(collectionMap.size + storyMap.size + resolvedDeletions.size + 6);
  progress.setCurrent(0.2, "Clearing local custom library");
  await Promise.all([
    localClear(LOCAL_LIBRARY_DB.stores.collections),
    localClear(LOCAL_LIBRARY_DB.stores.stories),
    localClear(LOCAL_LIBRARY_DB.stores.deletions)
  ]);
  progress.step("Cleared local custom library");

  for (const record of collectionMap.values()) {
    await saveLocalCollectionRecord(record);
    progress.step(`Downloaded directory: ${record.id}`);
  }
  for (const record of storyMap.values()) {
    const thumbnailBlob = localThumbnailBlobs.get(String(record.id)) || null;
    await saveLocalStoryRecord({...record, thumbnailBlob});
    progress.step(`Downloaded story: ${record.id}`);
  }
  for (const record of resolvedDeletions.values()) {
    await saveLocalDeletionRecord(record);
    progress.step(`Downloaded deletion: ${record.id}`);
  }

  const cloudReaderObject = Object.fromEntries(cloudSnapshot.readerState.map((record) => {
    const value = {...record};
    delete value.id;
    return [String(record.id), value];
  }));
  if (typeof replaceLocalReaderState === "function") replaceLocalReaderState(cloudReaderObject);
  else mergeCloudReaderState(cloudReaderObject);
  progress.step("Replaced reading state");

  await refreshLibraryAfterSync();
  progress.step("Refreshed library");

  const finalLocal = getLocalSyncSnapshot();
  writeSyncBaseline({
    revision: Number(cloudSnapshot.metadata?.revision || 0),
    localFingerprint: snapshotFingerprint(finalLocal),
    cloudFingerprint: snapshotFingerprint(cloudSnapshot)
  });
  progress.step("Saved device baseline");
  return true;
}


async function applyDesiredSetsLocally(collectionMap, storyMap, deletionMap) {
  const currentCollections = recordsMap(state.localCollections.map(normalizeCollectionRecord));
  const currentStories = recordsMap(state.localStories.map(normalizeStoryRecord));
  const currentDeletions = recordsMap([...state.libraryDeletions.values()].map(normalizeDeletionRecord));

  for (const [id, record] of collectionMap) {
    if (!currentCollections.has(id) || !recordsEqual(currentCollections.get(id), record)) {
      await saveLocalCollectionRecord(record);
    }
  }
  for (const id of currentCollections.keys()) {
    if (!collectionMap.has(id)) await removeLocalCollectionRecord(id);
  }

  for (const [id, record] of storyMap) {
    if (!currentStories.has(id) || !recordsEqual(currentStories.get(id), record)) {
      await saveCloudStoryLocally(record);
    }
  }
  for (const id of currentStories.keys()) {
    if (!storyMap.has(id)) await removeLocalStoryRecord(id);
  }

  for (const [id, record] of deletionMap) {
    if (!currentDeletions.has(id) || !recordsEqual(currentDeletions.get(id), record)) {
      await saveLocalDeletionRecord(record);
    }
  }
  for (const id of currentDeletions.keys()) {
    if (!deletionMap.has(id)) await removeLocalDeletionRecord(id);
  }
}

async function clearCloudDataset(cloudSnapshot, progress) {
  const groups = [
    [CLOUD_PATHS.collections, cloudSnapshot.collections],
    [CLOUD_PATHS.stories, cloudSnapshot.stories],
    [CLOUD_PATHS.deletions, cloudSnapshot.deletions],
    [CLOUD_PATHS.readerState, cloudSnapshot.readerState]
  ];
  for (const [path, records] of groups) {
    for (const record of records) {
      await firebaseDeleteDocument(path, recordId(record));
      progress?.step(`Removed cloud record: ${recordId(record)}`);
    }
  }
}

async function replaceCloudWithLocal(localSnapshot, cloudSnapshot, progress) {
  if (!window.confirm(
    "Replace all Korean Reader data in Firebase with this device? Other devices will receive this device’s state on their next sync."
  )) return false;

  const collectionMap = recordsMap(localSnapshot.collections);
  const storyMap = recordsMap(localSnapshot.stories);
  const deletionMap = recordsMap(localSnapshot.deletions);
  const resolvedDeletions = resolveDeletionConflicts(collectionMap, storyMap, deletionMap);
  const readerMap = recordsMap(localSnapshot.readerState);

  await applyDesiredSetsLocally(collectionMap, storyMap, resolvedDeletions);

  const cloudRecordCount = cloudSnapshot.collections.length + cloudSnapshot.stories.length + cloudSnapshot.deletions.length + cloudSnapshot.readerState.length;
  progress.setTotal(cloudRecordCount + collectionMap.size + storyMap.size + resolvedDeletions.size + readerMap.size + 4);

  await clearCloudDataset(cloudSnapshot, progress);

  for (const record of collectionMap.values()) {
    await firebaseSetDocument(CLOUD_PATHS.collections, record.id, record);
    progress.step(`Uploaded directory: ${record.id}`);
  }
  for (const record of storyMap.values()) {
    await firebaseSetDocument(CLOUD_PATHS.stories, record.id, record);
    progress.step(`Uploaded story: ${record.id}`);
  }
  for (const record of resolvedDeletions.values()) {
    await firebaseSetDocument(CLOUD_PATHS.deletions, record.key, record);
    progress.step(`Uploaded deletion: ${record.id}`);
  }
  for (const record of readerMap.values()) {
    await firebaseSetDocument(CLOUD_PATHS.readerState, record.id, record);
    progress.step(`Uploaded reading state: ${record.id}`);
  }

  const metadata = await commitCloudRevision("replace-cloud");
  progress.step("Updated cloud revision");

  await refreshLibraryAfterSync();
  progress.step("Refreshed library");

  const finalLocal = getLocalSyncSnapshot();
  const fingerprint = snapshotFingerprint(finalLocal);
  writeSyncBaseline({
    revision: metadata.revision,
    localFingerprint: fingerprint,
    cloudFingerprint: fingerprint
  });
  progress.step("Saved device baseline");
  return true;
}

function determineSyncAction(localSnapshot, cloudSnapshot, baseline) {
  const localFingerprint = snapshotFingerprint(localSnapshot);
  const cloudFingerprint = snapshotFingerprint(cloudSnapshot);
  const localHasData = snapshotHasData(localSnapshot);
  const cloudHasData = snapshotHasData(cloudSnapshot);
  const cloudRevision = Number(cloudSnapshot.metadata?.revision || 0);

  if (!baseline || Number(baseline.schemaVersion || 0) !== SYNC_SCHEMA_VERSION) {
    if (!localHasData && !cloudHasData) return {action: "baseline", localFingerprint, cloudFingerprint};
    if (!localHasData && cloudHasData) return {action: "download", localFingerprint, cloudFingerprint};
    if (localHasData && !cloudHasData) {
      return {
        action: "choose",
        reason: "Firebase is empty, but this device contains local data. Choose whether to upload it or keep working locally.",
        localFingerprint,
        cloudFingerprint
      };
    }
    if (localFingerprint === cloudFingerprint) return {action: "baseline", localFingerprint, cloudFingerprint};
    return {
      action: "choose",
      reason: "This device and Firebase already contain different data. Nothing will change until you choose a direction.",
      localFingerprint,
      cloudFingerprint
    };
  }

  const localChanged = localFingerprint !== baseline.localFingerprint;
  const cloudChanged = cloudFingerprint !== baseline.cloudFingerprint || cloudRevision !== Number(baseline.revision || 0);

  if (localChanged && cloudChanged) {
    return {
      action: "choose",
      reason: "Both this device and Firebase changed since their last common synchronization.",
      localFingerprint,
      cloudFingerprint
    };
  }
  if (cloudChanged) return {action: "merge", localFingerprint, cloudFingerprint};
  if (localChanged) return {action: "merge", localFingerprint, cloudFingerprint};
  return {action: "none", localFingerprint, cloudFingerprint};
}

async function saveCloudStoryLocally(record) {
  const existing = state.localStories.find((item) => String(item.id) === String(record.id));
  await saveLocalStoryRecord({
    ...normalizeStoryRecord(record),
    thumbnailBlob: existing?.thumbnailBlob || null
  });
}

async function queueReaderStateCloudWrite() {
  requestSafeCloudSync("Reading progress saved locally");
}

async function saveCustomCollection(record, options = {}) {
  await saveLocalCollectionRecord(record);
  if (!options.localOnly) requestSafeCloudSync("Directory saved locally");
}

async function saveCustomStory(record, options = {}) {
  await saveLocalStoryRecord(record);
  if (!options.localOnly) requestSafeCloudSync("Story saved locally");
}

async function saveDeletion(kind, id, options = {}) {
  const deletedAt = Date.now();
  const record = {
    key: `${kind}:${id}`,
    kind,
    id: String(id),
    deletedAt,
    updatedAt: deletedAt
  };
  await saveLocalDeletionRecord(record);
  state.libraryDeletions.set(record.key, record);
  if (!options.localOnly) requestSafeCloudSync("Deletion saved locally");
  return record;
}

async function clearDeletion(kind, id, options = {}) {
  const key = `${kind}:${id}`;
  state.libraryDeletions.delete(key);
  await removeLocalDeletionRecord(key);
  if (!options.localOnly) requestSafeCloudSync("Restored item saved locally");
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
  } else if (record.thumbnailUrl && /^https?:/i.test(String(record.thumbnailUrl))) {
    stored.thumbnail = record.thumbnailUrl;
  }
  const story = normalizeStory({
    ...stored,
    sourceType: "custom",
    updatedAt: record.updatedAt
  }, stored.sourceFileName || `${record.id}.json`, stored.collectionId, stored.order);
  story.sourceType = "custom";
  story.updatedAt = record.updatedAt;
  return story;
}

function rebuildMergedLibrary() {
  const collectionMap = new Map();
  const storyMap = new Map();

  state.githubCollections.forEach((collection) => collectionMap.set(collection.id, collection));
  state.localCollections.forEach((record) => collectionMap.set(record.id, collectionFromLocalRecord(record)));

  state.githubStories.forEach((story) => storyMap.set(story.id, story));
  state.localStories.forEach((record) => storyMap.set(record.id, storyFromLocalRecord(record)));

  state.libraryDeletions.forEach((rawDeletion) => {
    const deletion = normalizeDeletionRecord(rawDeletion);
    if (deletion.kind === "collection") {
      const collection = collectionMap.get(deletion.id);
      const newestStoryTime = Math.max(
        ...[...storyMap.values()]
          .filter((story) => story.collectionId === deletion.id)
          .map((story) => Number(story.updatedAt || 0)),
        0
      );
      if (Number(deletion.deletedAt) > Math.max(Number(collection?.updatedAt || 0), newestStoryTime)) {
        collectionMap.delete(deletion.id);
        [...storyMap.values()].forEach((story) => {
          if (story.collectionId === deletion.id) storyMap.delete(story.id);
        });
      }
    }
    if (deletion.kind === "story") {
      const story = storyMap.get(deletion.id);
      if (!story || Number(deletion.deletedAt) > Number(story.updatedAt || 0)) storyMap.delete(deletion.id);
    }
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
  state.libraryDeletions = new Map(
    (records.deletions || []).map((record) => {
      const normalized = normalizeDeletionRecord(record);
      return [normalized.key, normalized];
    })
  );
  rebuildMergedLibrary();
}

function requestSafeCloudSync(detail = "Changes are waiting to synchronize") {
  if (!state.firebaseUser) {
    setFirebaseStatus("offline", "Saved locally", "Sign in to synchronize these changes.");
    return;
  }
  window.clearTimeout(cloudAutoSyncTimer);
  setFirebaseStatus("syncing", "Checking before upload…", detail);
  cloudAutoSyncTimer = window.setTimeout(() => {
    syncCloudData({reason: "local-change"}).catch(() => {});
  }, 650);
}

async function syncCloudData(options = {}) {
  if (!state.firebaseUser) {
    setFirebaseStatus("offline", "Local only", "Sign in to synchronize with Firebase.");
    return;
  }
  if (!navigator.onLine) {
    setFirebaseStatus("offline", "Offline", "Changes remain saved locally.");
    return;
  }
  if (cloudSyncRunning) {
    cloudSyncQueued = true;
    return cloudSyncRunning;
  }

  const progress = createSyncProgress(6);
  cloudSyncRunning = (async () => {
    setFirebaseStatus("syncing", "Checking both copies…", state.firebaseUser.email || "Firebase account");
    const cloudSnapshot = await getCloudSyncSnapshot(progress);
    const localSnapshot = getLocalSyncSnapshot();
    const baseline = readSyncBaseline();
    const decision = determineSyncAction(localSnapshot, cloudSnapshot, baseline);
    let action = decision.action;

    if (action === "choose") {
      action = await requestSyncDecision(localSnapshot, cloudSnapshot, decision.reason);
    }

    if (action === "cancel") {
      setFirebaseStatus("warning", "Synchronization paused", "Local and cloud data were left unchanged.");
      return;
    }

    if (action === "none") {
      setFirebaseStatus("synced", "Already synchronized", state.firebaseUser.email);
      progress.complete("100% · Already synchronized");
      return;
    }

    if (action === "baseline") {
      writeSyncBaseline({
        revision: Number(cloudSnapshot.metadata?.revision || 0),
        localFingerprint: decision.localFingerprint,
        cloudFingerprint: decision.cloudFingerprint
      });
      setFirebaseStatus("synced", "Synchronized", state.firebaseUser.email);
      progress.complete("100% · Baseline saved");
      return;
    }

    if (action === "download") {
      const completed = await replaceLocalWithCloud(localSnapshot, cloudSnapshot, progress);
      if (!completed) {
        setFirebaseStatus("warning", "Synchronization cancelled", "No data was changed.");
        return;
      }
    } else if (action === "upload") {
      const completed = await replaceCloudWithLocal(localSnapshot, cloudSnapshot, progress);
      if (!completed) {
        setFirebaseStatus("warning", "Synchronization cancelled", "No data was changed.");
        return;
      }
    } else {
      await mergeLocalAndCloud(localSnapshot, cloudSnapshot, progress);
    }

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
      window.setTimeout(() => syncCloudData({reason: "queued-change"}).catch(() => {}), 0);
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
    closeSyncDecision("cancel");
    window.clearTimeout(cloudAutoSyncTimer);
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
  if (code.includes("permission-denied")) return "Firestore security rules denied this operation.";
  if (code.includes("resource-exhausted")) return "Firebase quota has been exceeded.";
  if (code.includes("firestore-document-too-large")) return error.message;
  if (code.includes("firebase-timeout")) return error.message;
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
        closeSyncDecision("cancel");
        setFirebaseStatus("offline", "Local only", "Sign in to synchronize with Firebase.");
        return;
      }
      setFirebaseStatus("syncing", "Inspecting local and cloud data…", user.email || "Firebase account");
      try {
        await syncCloudData({reason: "sign-in"});
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
firebaseSyncButton?.addEventListener("click", () => syncCloudData({reason: "manual"}).catch(() => {}));

document.getElementById("syncDecisionMergeButton")?.addEventListener("click", () => closeSyncDecision("merge"));
document.getElementById("syncDecisionDownloadButton")?.addEventListener("click", () => closeSyncDecision("download"));
document.getElementById("syncDecisionUploadButton")?.addEventListener("click", () => closeSyncDecision("upload"));
document.getElementById("syncDecisionCancelButton")?.addEventListener("click", () => closeSyncDecision("cancel"));
document.getElementById("syncDecisionCloseButton")?.addEventListener("click", () => closeSyncDecision("cancel"));
document.getElementById("syncDecisionBackdrop")?.addEventListener("click", () => closeSyncDecision("cancel"));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.getElementById("syncDecisionDialog")?.classList.contains("sync-decision-dialog-open")) {
    closeSyncDecision("cancel");
  }
});

window.addEventListener("online", () => {
  if (state.firebaseUser) syncCloudData({reason: "reconnected"}).catch(() => {});
});
window.addEventListener("offline", () => setFirebaseStatus("offline", "Offline", "Changes remain saved locally."));
