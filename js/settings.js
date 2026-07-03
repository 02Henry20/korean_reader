const DEFAULT_COLLECTIONS = [];
const DEFAULT_STORIES = [];

/*
 * Accent palettes. Story JSON files may choose one with "theme".
 * The user's global theme is also selected from this list.
 */
const THEMES = {
  sage: {name:"Sage", accent:"#4d7f69", accentStrong:"#315f4e", accentSoft:"#dceadf", word:"#a65f3e", ambientOne:"#cfe3d3", ambientTwo:"#eadcc6"},
  ocean: {name:"Ocean", accent:"#38758c", accentStrong:"#25566a", accentSoft:"#d8eaf0", word:"#b05f48", ambientOne:"#c6e1eb", ambientTwo:"#d9e4f1"},
  plum: {name:"Plum", accent:"#835b80", accentStrong:"#62445f", accentSoft:"#eadbea", word:"#ad6548", ambientOne:"#e7d0e5", ambientTwo:"#eadccf"},
  sunset: {name:"Sunset", accent:"#bb684a", accentStrong:"#8d4732", accentSoft:"#f3ddcf", word:"#765a9b", ambientOne:"#f0cdbb", ambientTwo:"#ead8ba"},
  hanok: {name:"Hanok", accent:"#78633e", accentStrong:"#59482d", accentSoft:"#e7ddc7", word:"#9d4e42", ambientOne:"#e2d5ba", ambientTwo:"#d9c6b5"},
  midnight: {name:"Midnight", accent:"#56698f", accentStrong:"#3b4b70", accentSoft:"#dce2ef", word:"#a6576c", ambientOne:"#cdd7ec", ambientTwo:"#e2d5e5"},
  blossom: {name:"Blossom", accent:"#a75f76", accentStrong:"#7f4559", accentSoft:"#f0d8df", word:"#8a6840", ambientOne:"#edcbd6", ambientTwo:"#f0ddc9"},
  amber: {name:"Amber", accent:"#a87932", accentStrong:"#7d5922", accentSoft:"#efdfbd", word:"#99614b", ambientOne:"#ecd9aa", ambientTwo:"#e6cfbf"},
  warm: {name:"Warm", accent:"#a76643", accentStrong:"#79462e", accentSoft:"#f0ddcf", word:"#7b5a92", ambientOne:"#ead7bf", ambientTwo:"#e8cfc4"},
  forest: {name:"Forest", accent:"#3f7453", accentStrong:"#285139", accentSoft:"#d5e7d8", word:"#9b5d43", ambientOne:"#c7dccb", ambientTwo:"#d9dfc5"},
  dracula: {
    name:"Dracula",
    accent:"#7447b8", accentStrong:"#4d287f", accentSoft:"#e8def7", word:"#ad1f6f",
    ambientOne:"#d7c8ef", ambientTwo:"#edc7dc",
    lightSurface:{bg:"#f5f1fa", surface:"#fffaff", surfaceMuted:"#ebe4f3", ink:"#261b35", muted:"#62556f"},
    darkAccent:{accent:"#bd93f9", accentStrong:"#a98ae9", accentSoft:"#4a405f", word:"#ff79c6", ambientOne:"#6f52a8", ambientTwo:"#a64e84"},
    darkSurface:{bg:"#191a21", surface:"#282a36", surfaceMuted:"#343746", ink:"#f8f8f2", muted:"#b8b8c7"}
  }
};

const APPEARANCES = {
  light: {
    name:"Light", bg:"#f4f5ef", surface:"#fffefa", surfaceMuted:"#edf3ee",
    ink:"#20342f", muted:"#71807b"
  },
  dark: {
    name:"Dark", bg:"#15191d", surface:"#22272c", surfaceMuted:"#2c3339",
    ink:"#f0f3f2", muted:"#aeb8b4"
  }
};

const UI_FONTS = {
  system: {name:"System sans", value:'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'},
  rounded: {name:"Rounded sans", value:'ui-rounded, "Arial Rounded MT Bold", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif'},
  serif: {name:"Serif", value:'Georgia, "Noto Serif KR", "Batang", serif'},
  mono: {name:"Monospace", value:'ui-monospace, "Cascadia Code", "D2Coding", monospace'}
};

const STORY_FONTS = {
  story: {name:"Use story preference", value:null},
  sans: {name:"Korean sans", value:'"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "NanumGothic", sans-serif'},
  serif: {name:"Korean serif", value:'"Noto Serif KR", "Batang", "NanumMyeongjo", serif'},
  rounded: {name:"Rounded Korean", value:'ui-rounded, "Arial Rounded MT Bold", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif'},
  mono: {name:"Korean monospace", value:'"D2Coding", "Nanum Gothic Coding", ui-monospace, monospace'}
};

const DEFAULT_SETTINGS = Object.freeze({
  appearance: "light",
  theme: "sage",
  storyAccents: true,
  uiFont: "system",
  storyFont: "story",
  readerSize: 1.36,
  lineSpacing: 2.02,
  translationDetails: "expanded",
  showKeyVocabulary: true,
  animationIntensity: "full",
  grammarDetail: "detailed"
});

const APP_SETTINGS_KEY = "korean-reader-settings-v10";
const VARIANT_KEY_V6 = "korean-reader-variants-v6";
const FONT_KEY = "korean-reader-font-size-v6";
const APPEARANCE_KEY_V6 = "korean-reader-appearance-v6";
const MOBILE_QUERY = window.matchMedia("(max-width: 900px)");
const LONG_PRESS_MS = 560;

const GITHUB_LIBRARY = Object.freeze({
  owner: "02Henry20",
  repo: "korean_reader",
  branch: "main",
  root: "library"
});

function loadAppSettings() {
  const saved = loadJSONV6(APP_SETTINGS_KEY, {});
  const legacyAppearance = storageGet(APPEARANCE_KEY_V6);
  const legacySize = Number(storageGet(FONT_KEY));
  const merged = {...DEFAULT_SETTINGS, ...saved};

  if (!saved.appearance && APPEARANCES[legacyAppearance]) merged.appearance = legacyAppearance;
  if (!saved.readerSize && Number.isFinite(legacySize)) merged.readerSize = legacySize;
  if (!APPEARANCES[merged.appearance]) merged.appearance = DEFAULT_SETTINGS.appearance;
  if (!THEMES[merged.theme]) merged.theme = DEFAULT_SETTINGS.theme;
  if (!UI_FONTS[merged.uiFont]) merged.uiFont = DEFAULT_SETTINGS.uiFont;
  if (!STORY_FONTS[merged.storyFont]) merged.storyFont = DEFAULT_SETTINGS.storyFont;

  merged.readerSize = Math.min(2.05, Math.max(1, Number(merged.readerSize) || DEFAULT_SETTINGS.readerSize));
  merged.lineSpacing = Math.min(2.4, Math.max(1.5, Number(merged.lineSpacing) || DEFAULT_SETTINGS.lineSpacing));
  merged.storyAccents = Boolean(merged.storyAccents);
  merged.showKeyVocabulary = Boolean(merged.showKeyVocabulary);
  return merged;
}
