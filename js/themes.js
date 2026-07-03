function effectiveThemeKeyV7(story) {
  return story && THEMES[story.theme] ? story.theme : state.settings.theme;
}

function mixHexV6(a, b, amount) {
  const parse = (hex) => {
    const h = String(hex || "#000000").replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const x = parse(a);
  const y = parse(b);
  return "#" + x.map((value, index) =>
    Math.round(value * (1 - amount) + y[index] * amount).toString(16).padStart(2, "0")
  ).join("");
}

function activeSurfacePalette() {
  const appearance = APPEARANCES[state.settings.appearance] || APPEARANCES.light;
  const globalTheme = THEMES[state.settings.theme] || THEMES.sage;
  if (state.settings.appearance === "dark" && globalTheme.darkSurface) {
    return {...appearance, ...globalTheme.darkSurface};
  }
  return appearance;
}

function activeAccentPalette(contextThemeKey) {
  const key = state.settings.storyAccents && THEMES[contextThemeKey]
    ? contextThemeKey
    : state.settings.theme;
  return THEMES[key] || THEMES.sage;
}

function setCardTheme(card, storyAccent) {
  const appearance = activeSurfacePalette();
  const accent = state.settings.storyAccents ? storyAccent : (THEMES[state.settings.theme] || THEMES.sage);
  const dark = state.settings.appearance === "dark";
  card.style.setProperty("--card-bg", appearance.surface);
  card.style.setProperty("--card-soft", mixHexV6(accent.accent, appearance.surfaceMuted, dark ? 0.72 : 0.82));
  card.style.setProperty("--card-accent", dark ? mixHexV6(accent.accent, "#ffffff", 0.28) : accent.accent);
  card.style.setProperty("--card-accent-strong", dark ? mixHexV6(accent.accent, "#ffffff", 0.46) : accent.accentStrong);
}

function applyTheme(contextThemeKey = state.settings.theme) {
  const accent = activeAccentPalette(contextThemeKey);
  const appearance = activeSurfacePalette();
  const dark = state.settings.appearance === "dark";
  const root = document.documentElement;

  root.dataset.appearance = state.settings.appearance;
  root.dataset.animation = state.settings.animationIntensity;
  root.style.setProperty("--bg", appearance.bg);
  root.style.setProperty("--surface", dark ? `${appearance.surface}ed` : `${appearance.surface}e6`);
  root.style.setProperty("--surface-solid", appearance.surface);
  root.style.setProperty("--surface-muted", appearance.surfaceMuted);
  root.style.setProperty("--ink", appearance.ink);
  root.style.setProperty("--muted", appearance.muted);
  root.style.setProperty("--line", dark ? "rgba(240,243,242,.16)" : "rgba(32,52,47,.14)");
  root.style.setProperty("--accent", dark ? mixHexV6(accent.accent, "#ffffff", 0.2) : accent.accent);
  root.style.setProperty("--accent-strong", dark ? mixHexV6(accent.accentStrong, "#ffffff", 0.34) : accent.accentStrong);
  root.style.setProperty("--accent-soft", dark ? mixHexV6(accent.accent, appearance.surfaceMuted, 0.7) : accent.accentSoft);
  root.style.setProperty("--word", dark ? mixHexV6(accent.word, "#ffffff", 0.2) : accent.word);
  root.style.setProperty("--ambient-one", dark ? mixHexV6(accent.ambientOne, appearance.bg, 0.45) : accent.ambientOne);
  root.style.setProperty("--ambient-two", dark ? mixHexV6(accent.ambientTwo, appearance.bg, 0.52) : accent.ambientTwo);

  root.style.setProperty("--search-bg", dark ? mixHexV6(appearance.surface, "#ffffff", 0.04) : "rgba(255,255,255,.88)");
  root.style.setProperty("--search-border", dark ? "rgba(255,255,255,.2)" : "rgba(32,52,47,.16)");
  root.style.setProperty("--search-text", appearance.ink);
  root.style.setProperty("--search-placeholder", dark ? "#b8c1bd" : mixHexV6(appearance.muted, appearance.ink, 0.15));
  root.style.setProperty("--search-caret", dark ? "#ffffff" : accent.accentStrong);

  if (dark) {
    root.style.setProperty("--word-popover-bg", "#f4f7f5");
    root.style.setProperty("--word-popover-text", "#18211d");
    root.style.setProperty("--word-popover-heading", mixHexV6(accent.accentStrong, "#18211d", 0.28));
    root.style.setProperty("--word-popover-muted", "#58645f");
  } else {
    root.style.setProperty("--word-popover-bg", "#17211e");
    root.style.setProperty("--word-popover-text", "#ffffff");
    root.style.setProperty("--word-popover-heading", mixHexV6(accent.accentSoft, "#ffffff", 0.38));
    root.style.setProperty("--word-popover-muted", "rgba(255,255,255,.74)");
  }

  root.style.setProperty("--font-ui", UI_FONTS[state.settings.uiFont]?.value || UI_FONTS.system.value);
  themeColorMeta.setAttribute("content", appearance.bg);
}

function safeStoryFontValue(value) {
  const key = String(value || "").trim();
  if (STORY_FONTS[key]?.value) return STORY_FONTS[key].value;
  if (!key || /[;{}<>]/u.test(key)) return STORY_FONTS.sans.value;
  return key;
}

function applyReadingFont(story = state.activeStory) {
  let value;
  if (state.settings.storyFont !== "story") {
    value = STORY_FONTS[state.settings.storyFont]?.value;
  } else if (story?.preferredFont) {
    value = safeStoryFontValue(story.preferredFont);
  }
  document.documentElement.style.setProperty("--font-reading", value || STORY_FONTS.sans.value);
}

function applyReaderTypography() {
  document.documentElement.style.setProperty("--reader-size", `${state.settings.readerSize}rem`);
  document.documentElement.style.setProperty("--reader-line-height", String(state.settings.lineSpacing));
  applyReadingFont(state.activeStory);
}

function changeReaderSize(delta) {
  state.settings.readerSize = Math.min(2.05, Math.max(1, state.settings.readerSize + delta));
  state.settings.readerSize = Math.round(state.settings.readerSize * 100) / 100;
  saveAppSettings();
  applyReaderTypography();
}

function saveAppSettings() {
  storageSet(APP_SETTINGS_KEY, JSON.stringify(state.settings));
}

function applyAllSettings() {
  const contextTheme = state.activeStory?.theme || getCollection(state.activeCollectionId)?.theme || state.settings.theme;
  applyTheme(contextTheme);
  applyReaderTypography();
  if (libraryView.classList.contains("view-active")) renderLibrary(searchInput.value);
}

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("toast-visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("toast-visible"), 3000);
}
