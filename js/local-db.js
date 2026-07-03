const LOCAL_LIBRARY_DB = Object.freeze({
  name: "korean-reader-library-v1",
  version: 1,
  stores: {
    collections: "collections",
    stories: "stories",
    deletions: "deletions"
  }
});

let localLibraryDbPromise = null;
const localThumbnailUrls = new Map();

function openLocalLibraryDb() {
  if (localLibraryDbPromise) return localLibraryDbPromise;

  localLibraryDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_LIBRARY_DB.name, LOCAL_LIBRARY_DB.version);

    request.onupgradeneeded = () => {
      const db = request.result;
      Object.values(LOCAL_LIBRARY_DB.stores).forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, {keyPath: storeName === "deletions" ? "key" : "id"});
        }
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("The local library database could not be opened."));
  });

  return localLibraryDbPromise;
}

async function localDbRequest(storeName, mode, action) {
  const db = await openLocalLibraryDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let request;

    try {
      request = action(store);
    } catch (error) {
      reject(error);
      return;
    }

    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error || request?.error || new Error("Local storage operation failed."));
    transaction.onabort = () => reject(transaction.error || new Error("Local storage operation was aborted."));
  });
}

function localGetAll(storeName) {
  return localDbRequest(storeName, "readonly", (store) => store.getAll());
}

function localPut(storeName, value) {
  return localDbRequest(storeName, "readwrite", (store) => store.put(value));
}

function localDelete(storeName, key) {
  return localDbRequest(storeName, "readwrite", (store) => store.delete(key));
}

function localClear(storeName) {
  return localDbRequest(storeName, "readwrite", (store) => store.clear());
}

function revokeLocalThumbnailUrl(storyId) {
  const previous = localThumbnailUrls.get(storyId);
  if (previous) URL.revokeObjectURL(previous);
  localThumbnailUrls.delete(storyId);
}

function localThumbnailUrl(storyId, blob) {
  if (!(blob instanceof Blob)) return "";
  revokeLocalThumbnailUrl(storyId);
  const url = URL.createObjectURL(blob);
  localThumbnailUrls.set(storyId, url);
  return url;
}

async function loadLocalLibraryRecords() {
  const [collections, stories, deletions] = await Promise.all([
    localGetAll(LOCAL_LIBRARY_DB.stores.collections),
    localGetAll(LOCAL_LIBRARY_DB.stores.stories),
    localGetAll(LOCAL_LIBRARY_DB.stores.deletions)
  ]);
  return {collections, stories, deletions};
}

async function saveLocalCollectionRecord(record) {
  return localPut(LOCAL_LIBRARY_DB.stores.collections, record);
}

async function saveLocalStoryRecord(record) {
  return localPut(LOCAL_LIBRARY_DB.stores.stories, record);
}

async function saveLocalDeletionRecord(record) {
  return localPut(LOCAL_LIBRARY_DB.stores.deletions, record);
}

async function removeLocalCollectionRecord(id) {
  return localDelete(LOCAL_LIBRARY_DB.stores.collections, id);
}

async function removeLocalStoryRecord(id) {
  revokeLocalThumbnailUrl(id);
  return localDelete(LOCAL_LIBRARY_DB.stores.stories, id);
}

async function removeLocalDeletionRecord(key) {
  return localDelete(LOCAL_LIBRARY_DB.stores.deletions, key);
}
