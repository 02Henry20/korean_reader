function addSelectOptions(select, entries) {
  select.replaceChildren();
  Object.entries(entries).forEach(([value, config]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = config.name;
    select.appendChild(option);
  });
}

function createChoiceCheck() {
  const check = document.createElement("span");
  check.className = "settings-choice-check";
  check.textContent = "✓";
  check.setAttribute("aria-hidden", "true");
  return check;
}

function createAppearanceChoices() {
  const container = document.getElementById("appearanceChoices");
  if (!container) return;
  container.replaceChildren();

  Object.entries(APPEARANCES).forEach(([value, appearance]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "settings-choice settings-appearance-choice";
    button.dataset.settingKey = "appearance";
    button.dataset.settingValue = value;
    button.setAttribute("aria-pressed", "false");
    button.style.setProperty("--choice-bg", appearance.bg);
    button.style.setProperty("--choice-surface", appearance.surface);
    button.style.setProperty("--choice-muted", appearance.surfaceMuted);
    button.style.setProperty("--choice-ink", appearance.ink);

    const preview = document.createElement("span");
    preview.className = "settings-appearance-preview";
    preview.innerHTML = `
      <span class="settings-appearance-preview-header"></span>
      <span class="settings-appearance-preview-card"></span>
      <span class="settings-appearance-preview-line"></span>
    `;

    const label = document.createElement("span");
    label.className = "settings-choice-label";
    label.append(
      createTextBlock("strong", "", appearance.name),
      createTextBlock("small", "", value === "dark" ? "Dark surfaces" : "Bright surfaces")
    );

    button.append(preview, label, createChoiceCheck());
    container.appendChild(button);
  });
}

function createThemeChoices() {
  const container = document.getElementById("themeChoices");
  if (!container) return;
  container.replaceChildren();

  Object.entries(THEMES).forEach(([value, theme]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "settings-choice settings-theme-choice";
    button.dataset.settingKey = "theme";
    button.dataset.settingValue = value;
    button.setAttribute("aria-pressed", "false");
    button.style.setProperty("--choice-accent", theme.accent);
    button.style.setProperty("--choice-strong", theme.accentStrong);
    button.style.setProperty("--choice-soft", theme.accentSoft);
    button.style.setProperty("--choice-word", theme.word);
    button.style.setProperty("--choice-ambient-one", theme.ambientOne);
    button.style.setProperty("--choice-ambient-two", theme.ambientTwo);
    button.style.setProperty("--choice-surface", theme.darkSurface?.surface || APPEARANCES.light.surface);
    button.style.setProperty("--choice-ink", theme.darkSurface?.ink || APPEARANCES.light.ink);

    const palette = document.createElement("span");
    palette.className = "settings-theme-palette";
    palette.innerHTML = `
      <span class="settings-theme-palette-surface"></span>
      <span class="settings-theme-palette-accent"></span>
      <span class="settings-theme-palette-word"></span>
      <span class="settings-theme-palette-ambient"></span>
    `;

    const label = document.createElement("span");
    label.className = "settings-choice-label";
    label.append(
      createTextBlock("strong", "", theme.name),
      createTextBlock("small", "", value === "dracula" ? "Purple, pink, and dark ink" : `${theme.accent} · ${theme.word}`)
    );

    button.append(palette, label, createChoiceCheck());
    container.appendChild(button);
  });
}

function syncVisualChoices() {
  document.querySelectorAll(".settings-choice[data-setting-key]").forEach((button) => {
    const selected = String(state.settings[button.dataset.settingKey]) === button.dataset.settingValue;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function previewStoryFontValue() {
  if (state.settings.storyFont !== "story") {
    return STORY_FONTS[state.settings.storyFont]?.value || STORY_FONTS.sans.value;
  }
  if (state.activeStory?.preferredFont) return safeStoryFontValue(state.activeStory.preferredFont);
  return STORY_FONTS.sans.value;
}

function previewStoryFontName() {
  if (state.settings.storyFont === "story") {
    return state.activeStory?.preferredFont ? "Story preference" : "Story preference · sans fallback";
  }
  return STORY_FONTS[state.settings.storyFont]?.name || STORY_FONTS.sans.name;
}

function choosePreviewStoryAccent(globalTheme) {
  if (!state.settings.storyAccents) return globalTheme;
  const alternativeKey = state.settings.theme === "sunset" ? "ocean" : "sunset";
  return THEMES[alternativeKey] || globalTheme;
}

function renderGrammarPreview() {
  const grammar = document.getElementById("settingsPreviewGrammar");
  if (!grammar) return;

  if (state.settings.grammarDetail === "concise") {
    grammar.innerHTML = `
      <strong>-아/어 보다</strong>
      <p>Used to express trying an action: “try reading.”</p>
    `;
    return;
  }

  grammar.innerHTML = `
    <strong>-아/어 보다</strong>
    <dl>
      <div><dt>Base form</dt><dd>읽다</dd></div>
      <div><dt>Transformation</dt><dd>읽다 → 읽어</dd></div>
      <div><dt>Result</dt><dd>읽어 보다</dd></div>
      <div><dt>Why here</dt><dd>It invites someone to try reading.</dd></div>
    </dl>
  `;
}

function updateSettingsPreview() {
  const stage = document.getElementById("settingsPreviewStage");
  if (!stage) return;

  const theme = THEMES[state.settings.theme] || THEMES.sage;
  const appearanceBase = APPEARANCES[state.settings.appearance] || APPEARANCES.light;
  const appearance = state.settings.appearance === "dark" && theme.darkSurface
    ? {...appearanceBase, ...theme.darkSurface}
    : appearanceBase;
  const storyAccent = choosePreviewStoryAccent(theme);
  const dark = state.settings.appearance === "dark";

  stage.style.setProperty("--preview-bg", appearance.bg);
  stage.style.setProperty("--preview-surface", appearance.surface);
  stage.style.setProperty("--preview-muted-surface", appearance.surfaceMuted);
  stage.style.setProperty("--preview-ink", appearance.ink);
  stage.style.setProperty("--preview-muted", appearance.muted);
  stage.style.setProperty("--preview-accent", dark ? mixHexV6(theme.accent, "#ffffff", 0.2) : theme.accent);
  stage.style.setProperty("--preview-accent-strong", dark ? mixHexV6(theme.accentStrong, "#ffffff", 0.34) : theme.accentStrong);
  stage.style.setProperty("--preview-accent-soft", dark ? mixHexV6(theme.accent, appearance.surfaceMuted, 0.7) : theme.accentSoft);
  stage.style.setProperty("--preview-word", dark ? mixHexV6(theme.word, "#ffffff", 0.2) : theme.word);
  stage.style.setProperty("--preview-story-accent", dark ? mixHexV6(storyAccent.accent, "#ffffff", 0.18) : storyAccent.accent);
  stage.style.setProperty("--preview-ui-font", UI_FONTS[state.settings.uiFont]?.value || UI_FONTS.system.value);
  stage.style.setProperty("--preview-story-font", previewStoryFontValue());
  stage.style.setProperty("--preview-story-size", `${Number(state.settings.readerSize).toFixed(2)}rem`);
  stage.style.setProperty("--preview-line-height", String(state.settings.lineSpacing));
  stage.dataset.previewAnimation = state.settings.animationIntensity;

  const themeName = document.getElementById("settingsPreviewThemeName");
  if (themeName) themeName.textContent = `${theme.name} · ${appearanceBase.name}`;

  const fontName = document.getElementById("settingsPreviewFontName");
  if (fontName) fontName.textContent = previewStoryFontName();

  const accentState = document.getElementById("settingsPreviewAccentState");
  if (accentState) accentState.textContent = state.settings.storyAccents ? "Story accents on" : "Global accent only";

  const translationExtra = document.getElementById("settingsPreviewTranslationExtra");
  if (translationExtra) translationExtra.hidden = state.settings.translationDetails === "compact";

  const vocabulary = document.getElementById("settingsPreviewVocabulary");
  if (vocabulary) vocabulary.hidden = !state.settings.showKeyVocabulary;

  renderGrammarPreview();
}

function initializeSettingsForm() {
  addSelectOptions(settingsForm.elements.uiFont, UI_FONTS);
  addSelectOptions(settingsForm.elements.storyFont, STORY_FONTS);
  createAppearanceChoices();
  createThemeChoices();
  syncSettingsForm();
}

function syncSettingsForm() {
  Object.entries(state.settings).forEach(([key, value]) => {
    const control = settingsForm.elements[key];
    if (!control) return;
    if (control.type === "checkbox") control.checked = Boolean(value);
    else control.value = String(value);
  });
  readerSizeOutput.textContent = `${Number(state.settings.readerSize).toFixed(2)} rem`;
  lineSpacingOutput.textContent = Number(state.settings.lineSpacing).toFixed(2);
  syncVisualChoices();
  updateSettingsPreview();
}

function openSettings() {
  if (state.currentView !== "collections" || state.activeCollectionId) return;
  hideVariantMenu();
  hideWordPopover();
  syncSettingsForm();
  settingsBackdrop.hidden = false;
  settingsPanel.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    settingsBackdrop.classList.add("settings-backdrop-open");
    settingsPanel.classList.add("settings-panel-open");
  });
}

function closeSettings() {
  if (!settingsPanel) return;
  settingsPanel.classList.remove("settings-panel-open");
  settingsPanel.setAttribute("aria-hidden", "true");
  settingsBackdrop.classList.remove("settings-backdrop-open");
  window.setTimeout(() => {
    if (!settingsBackdrop.classList.contains("settings-backdrop-open")) settingsBackdrop.hidden = true;
  }, 180);
}

function updateSettingFromControl(control) {
  const key = control.name;
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) return;
  let value;
  if (control.type === "checkbox") value = control.checked;
  else if (control.type === "range") value = Number(control.value);
  else value = control.value;
  state.settings[key] = value;
  saveAppSettings();
  syncSettingsForm();
  applyAllSettings();

  if (state.activeGrammarContext &&
      (key === "showKeyVocabulary" || key === "grammarDetail")) {
    renderGrammarDetails(
      state.activeGrammarContext.sentence,
      state.activeGrammarContext.grammarIndexes
    );
  }
}

function selectVisualSetting(button) {
  const key = button.dataset.settingKey;
  const value = button.dataset.settingValue;
  const control = settingsForm.elements[key];
  if (!control || !Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) return;
  control.value = value;
  updateSettingFromControl(control);
}

function resetSettings() {
  state.settings = {...DEFAULT_SETTINGS};
  saveAppSettings();
  syncSettingsForm();
  applyAllSettings();
  showToast("Settings reset");
}

settingsForm.addEventListener("input", (event) => {
  if (event.target.matches('input[type="range"]')) updateSettingFromControl(event.target);
});
settingsForm.addEventListener("change", (event) => updateSettingFromControl(event.target));
settingsForm.addEventListener("click", (event) => {
  const choice = event.target.closest(".settings-choice[data-setting-key]");
  if (!choice) return;
  selectVisualSetting(choice);
});
settingsButton.addEventListener("click", openSettings);
closeSettingsButton.addEventListener("click", closeSettings);
settingsBackdrop.addEventListener("click", closeSettings);
resetSettingsButton.addEventListener("click", resetSettings);

initializeSettingsForm();
