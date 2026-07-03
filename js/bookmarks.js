const READER_STATE_KEY = "korean-reader-reader-state-v1";

function normalizeReaderStateRecord(value) {
  const source = value && typeof value === "object" ? value : {};
  const updatedAt = Number(source.updatedAt) || 0;
  const fieldUpdatedAt = source.fieldUpdatedAt && typeof source.fieldUpdatedAt === "object"
    ? {...source.fieldUpdatedAt}
    : {};
  const result = {};

  Object.entries(source).forEach(([key, item]) => {
    if (key === "id" || key === "updatedAt" || key === "fieldUpdatedAt") return;
    result[key] = item;
    fieldUpdatedAt[key] = Number(fieldUpdatedAt[key]) || updatedAt;
  });

  result.fieldUpdatedAt = fieldUpdatedAt;
  result.updatedAt = Math.max(updatedAt, ...Object.values(fieldUpdatedAt).map(Number), 0);
  return result;
}

function loadReaderState() {
  const saved = loadJSONV6(READER_STATE_KEY, {});
  if (!saved || typeof saved !== "object") return {};
  return Object.fromEntries(
    Object.entries(saved).map(([storyId, value]) => [storyId, normalizeReaderStateRecord(value)])
  );
}

state.readerState = loadReaderState();

function saveReaderState() {
  storageSet(READER_STATE_KEY, JSON.stringify(state.readerState));
}

function storyReaderState(storyId) {
  return state.readerState[String(storyId)] || {};
}

function isStoryRead(storyId) {
  return Boolean(storyReaderState(storyId).read);
}

function storyBookmark(storyId) {
  return storyReaderState(storyId).bookmark || null;
}

function writeReaderState(storyId, patch, options = {}) {
  const id = String(storyId || "");
  if (!id) return;

  const previous = normalizeReaderStateRecord(storyReaderState(id));
  const changedAt = Number(options.updatedAt) || Date.now();
  const fieldUpdatedAt = {...previous.fieldUpdatedAt};
  const next = {...previous, ...patch};

  Object.keys(patch).forEach((key) => {
    fieldUpdatedAt[key] = changedAt;
  });

  next.fieldUpdatedAt = fieldUpdatedAt;
  next.updatedAt = Math.max(changedAt, Number(previous.updatedAt || 0));
  state.readerState[id] = next;
  saveReaderState();

  if (!options.skipCloud) queueReaderStateCloudWrite(id, next);
  updateBookmarkButton();
}

function toggleStoryRead(story) {
  if (!story?.id) return;
  const read = !isStoryRead(story.id);
  writeReaderState(story.id, {read});
  renderLibrary(searchInput.value);
  showToast(read ? "Marked as read" : "Marked as unread");
}

function enterBookmarkMode() {
  if (!state.activeStory) return;
  state.bookmarkMode = !state.bookmarkMode;
  document.body.classList.toggle("bookmark-placement-mode", state.bookmarkMode);
  updateBookmarkButton();
  showToast(state.bookmarkMode ? "Tap a word to place the bookmark" : "Bookmark placement cancelled");
}

function setBookmarkFromWord(wordElement) {
  if (!state.activeStory || !wordElement) return false;
  const sentenceElement = wordElement.closest(".sentence");
  if (!sentenceElement) return false;

  const bookmark = {
    paragraphIndex: Number(sentenceElement.dataset.paragraphIndex),
    sentenceIndex: Number(sentenceElement.dataset.sentenceIndex),
    wordIndex: Number(wordElement.dataset.wordIndex),
    surface: wordElement.dataset.surface || wordElement.textContent || ""
  };
  const current = storyBookmark(state.activeStory.id);
  const sameBookmark = current &&
    Number(current.paragraphIndex) === bookmark.paragraphIndex &&
    Number(current.sentenceIndex) === bookmark.sentenceIndex &&
    Number(current.wordIndex) === bookmark.wordIndex;

  if (sameBookmark) {
    writeReaderState(state.activeStory.id, {bookmark: null});
    state.bookmarkMode = false;
    document.body.classList.remove("bookmark-placement-mode");
    markRenderedBookmark(null);
    updateBookmarkButton();
    showToast("Bookmark removed");
    return true;
  }

  writeReaderState(state.activeStory.id, {bookmark});
  state.bookmarkMode = false;
  document.body.classList.remove("bookmark-placement-mode");
  markRenderedBookmark(bookmark);
  updateBookmarkButton();
  showToast("Bookmark saved");
  return true;
}

function markRenderedBookmark(bookmark = storyBookmark(state.activeStory?.id)) {
  storyContent.querySelectorAll(".word-bookmarked").forEach((element) => {
    element.classList.remove("word-bookmarked");
  });
  if (!bookmark) return null;
  const selector = `.sentence[data-paragraph-index="${bookmark.paragraphIndex}"]` +
    `[data-sentence-index="${bookmark.sentenceIndex}"] ` +
    `.word-token[data-word-index="${bookmark.wordIndex}"]`;
  const element = storyContent.querySelector(selector);
  if (element) element.classList.add("word-bookmarked");
  return element;
}

function restoreStoryBookmark() {
  const bookmark = storyBookmark(state.activeStory?.id);
  updateBookmarkButton();
  if (!bookmark) return;
  requestAnimationFrame(() => {
    const element = markRenderedBookmark(bookmark);
    if (!element) return;
    const header = document.querySelector(".reader-header");
    const offset = (header?.getBoundingClientRect().height || 72) + 24;
    const target = Math.max(0, window.scrollY + element.getBoundingClientRect().top - offset);
    window.scrollTo({
      top: target,
      behavior: state.settings.animationIntensity === "none" ? "auto" : "smooth"
    });
  });
}

function updateBookmarkButton() {
  if (!bookmarkButton) return;
  const hasBookmark = Boolean(storyBookmark(state.activeStory?.id));
  bookmarkButton.classList.toggle("bookmark-button-active", hasBookmark);
  bookmarkButton.classList.toggle("bookmark-button-placing", state.bookmarkMode);
  bookmarkButton.setAttribute("aria-pressed", String(state.bookmarkMode));
  bookmarkButton.title = state.bookmarkMode
    ? "Cancel bookmark placement"
    : hasBookmark
      ? "Move bookmark"
      : "Set bookmark";
}

function mergeReaderStateRecords(leftValue, rightValue) {
  const left = normalizeReaderStateRecord(leftValue);
  const right = normalizeReaderStateRecord(rightValue);
  const result = {};
  const fieldUpdatedAt = {};
  const fields = new Set([
    ...Object.keys(left).filter((key) => !["updatedAt", "fieldUpdatedAt", "id"].includes(key)),
    ...Object.keys(right).filter((key) => !["updatedAt", "fieldUpdatedAt", "id"].includes(key))
  ]);

  fields.forEach((field) => {
    const leftHasField = Object.prototype.hasOwnProperty.call(left, field);
    const rightHasField = Object.prototype.hasOwnProperty.call(right, field);
    const leftTime = Number(left.fieldUpdatedAt?.[field] || left.updatedAt || 0);
    const rightTime = Number(right.fieldUpdatedAt?.[field] || right.updatedAt || 0);

    if (!leftHasField && rightHasField) {
      result[field] = right[field];
      fieldUpdatedAt[field] = rightTime;
    } else if (leftHasField && !rightHasField) {
      result[field] = left[field];
      fieldUpdatedAt[field] = leftTime;
    } else if (rightTime > leftTime) {
      result[field] = right[field];
      fieldUpdatedAt[field] = rightTime;
    } else {
      result[field] = left[field];
      fieldUpdatedAt[field] = leftTime;
    }
  });

  result.fieldUpdatedAt = fieldUpdatedAt;
  result.updatedAt = Math.max(...Object.values(fieldUpdatedAt).map(Number), 0);
  return result;
}

function mergeCloudReaderState(cloudStates) {
  let changed = false;
  Object.entries(cloudStates || {}).forEach(([storyId, cloudState]) => {
    const localState = storyReaderState(storyId);
    const merged = mergeReaderStateRecords(localState, cloudState);
    if (JSON.stringify(merged) !== JSON.stringify(normalizeReaderStateRecord(localState))) {
      state.readerState[storyId] = merged;
      changed = true;
    }
  });
  if (changed) saveReaderState();
}

function replaceLocalReaderState(nextStates) {
  state.readerState = Object.fromEntries(
    Object.entries(nextStates || {}).map(([storyId, value]) => [storyId, normalizeReaderStateRecord(value)])
  );
  saveReaderState();
  updateBookmarkButton();
}

function exportLocalReaderState() {
  return JSON.parse(JSON.stringify(state.readerState));
}

bookmarkButton?.addEventListener("click", enterBookmarkMode);
