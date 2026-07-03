const state = {
  collections: [],
  stories: [],
  activeCollectionId: null,
  activeStory: null,
  currentView: "collections",
  settings: loadAppSettings(),
  variantSelections: loadJSONV6(VARIANT_KEY_V6, {}),
  variantTargetGroupId: null,
  selectedWordElement: null,
  selectedGrammarElements: [],
  selectedSentenceElement: null,
  activeGrammarContext: null,
  clickTimer: null,
  longPressTimer: null,
  longPressTriggered: false,
  pointerStart: null,
  suppressWordClickUntil: 0,
  sentencePress: null,
  mobileSentenceTap: null,
  mobileWordTapTimer: null,
  detailCloseTimer: null,
  detailDrag: null,
  storySearchCache: new WeakMap(),
  collectionSearchCache: new WeakMap(),
  githubCollections: [],
  githubStories: [],
  localCollections: [],
  localStories: [],
  libraryDeletions: new Map(),
  readerState: {},
  firebaseUser: null,
  firebaseServices: null,
  firebaseStatus: "loading",
  firebaseStatusMessage: "Connecting…",
  libraryDeleteMode: null,
  bookmarkMode: false,
  pendingStoryImport: null,
  storyImportMode: "add",
};

const libraryView = document.getElementById("libraryView");
const readerView = document.getElementById("readerView");
const storyGrid = document.getElementById("storyGrid");
const searchInput = document.getElementById("searchInput");
const libraryBackButton = document.getElementById("libraryBackButton");
const libraryEyebrow = document.getElementById("libraryEyebrow");
const libraryTitle = document.getElementById("libraryTitle");
const librarySubtitle = document.getElementById("librarySubtitle");
const libraryActions = document.getElementById("libraryActions");
const settingsButton = document.getElementById("settingsButton");
const libraryManageButton = document.getElementById("libraryManageButton");

const backButton = document.getElementById("backButton");
const readerTitle = document.getElementById("readerTitle");
const readerLevel = document.getElementById("readerLevel");
const bookmarkButton = document.getElementById("bookmarkButton");
const storyContent = document.getElementById("storyContent");
const detailPanel = document.getElementById("detailPanel");
const detailBackdrop = document.getElementById("detailBackdrop");
const detailContent = document.getElementById("detailContent");
const closeDetailButton = document.getElementById("closeDetailButton");


const wordPopover = document.getElementById("wordPopover");
const variantMenu = document.getElementById("variantMenu");
const toast = document.getElementById("toast");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

const settingsBackdrop = document.getElementById("settingsBackdrop");
const settingsPanel = document.getElementById("settingsPanel");
const settingsForm = document.getElementById("settingsForm");
const closeSettingsButton = document.getElementById("closeSettingsButton");
const resetSettingsButton = document.getElementById("resetSettingsButton");
const readerSizeOutput = document.getElementById("readerSizeOutput");
const lineSpacingOutput = document.getElementById("lineSpacingOutput");

const firebaseStatusBadge = document.getElementById("firebaseStatusBadge");
const firebaseSyncProgress = document.getElementById("firebaseSyncProgress");
const firebaseStatusText = document.getElementById("firebaseStatusText");
const firebaseAccountText = document.getElementById("firebaseAccountText");
const firebaseEmailInput = document.getElementById("firebaseEmailInput");
const firebasePasswordInput = document.getElementById("firebasePasswordInput");
const firebaseLoginButton = document.getElementById("firebaseLoginButton");
const firebaseSignOutButton = document.getElementById("firebaseSignOutButton");
const firebaseSyncButton = document.getElementById("firebaseSyncButton");
const firebaseSignedOutControls = document.getElementById("firebaseSignedOutControls");
const firebaseSignedInControls = document.getElementById("firebaseSignedInControls");

const libraryManageBackdrop = document.getElementById("libraryManageBackdrop");
const libraryManagePanel = document.getElementById("libraryManagePanel");
const libraryManageTitle = document.getElementById("libraryManageTitle");
const libraryManageBody = document.getElementById("libraryManageBody");
const closeLibraryManageButton = document.getElementById("closeLibraryManageButton");
const directoryImportInput = document.getElementById("directoryImportInput");
const storyImportInput = document.getElementById("storyImportInput");
const storyThumbnailInput = document.getElementById("storyThumbnailInput");
const scrollTopButton = document.getElementById("scrollTopButton");

function createTextBlock(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function setViewActive(view) {
  state.currentView = view;
  libraryView.classList.toggle("view-active", view === "collections" || view === "collection");
  readerView.classList.toggle("view-active", view === "reader");
}
