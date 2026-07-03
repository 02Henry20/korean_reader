function addSelectOptions(select, entries) {
  select.replaceChildren();
  Object.entries(entries).forEach(([value, config]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = config.name;
    select.appendChild(option);
  });
}

function initializeSettingsForm() {
  addSelectOptions(settingsForm.elements.appearance, APPEARANCES);
  addSelectOptions(settingsForm.elements.theme, THEMES);
  addSelectOptions(settingsForm.elements.uiFont, UI_FONTS);
  addSelectOptions(settingsForm.elements.storyFont, STORY_FONTS);
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

  if (detailPanel && !detailPanel.classList.contains("detail-panel-empty") && state.activeStory) {
    /* Re-rendering the current grammar panel is intentionally deferred until it is reopened. */
  }
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
settingsButton.addEventListener("click", openSettings);
closeSettingsButton.addEventListener("click", closeSettings);
settingsBackdrop.addEventListener("click", closeSettings);
resetSettingsButton.addEventListener("click", resetSettings);

initializeSettingsForm();
