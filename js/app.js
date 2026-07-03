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
  mobileGrammarHistoryActive: false,
  mobileGrammarHistoryClosing: false,
  storySearchCache: new WeakMap(),
  collectionSearchCache: new WeakMap(),
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

const backButton = document.getElementById("backButton");
const readerTitle = document.getElementById("readerTitle");
const readerLevel = document.getElementById("readerLevel");
const storyContent = document.getElementById("storyContent");
const detailPanel = document.getElementById("detailPanel");
const detailBackdrop = document.getElementById("detailBackdrop");
const detailContent = document.getElementById("detailContent");


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
