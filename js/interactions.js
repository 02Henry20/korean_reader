function showWordPopover(word, clientX, clientY, wordElement = null) {
  clearTimeout(state.longPressTimer);
  clearDetails();
  clearWordSelection();

  if (wordElement) {
    state.selectedWordElement = wordElement;
    wordElement.classList.add("word-selected");
  }

  wordPopover.replaceChildren();
  wordPopover.appendChild(createTextBlock("strong", "", word.surface || ""));
  wordPopover.appendChild(createTextBlock("p", "word-meaning", word.meaning || "—"));

  if (state.settings.translationDetails === "expanded") {
    if (word.base) {
      const base = createTextBlock("p", "word-base", "");
      base.append(createTextBlock("span", "word-popover-label", "Base form"));
      base.append(document.createTextNode(word.base));
      wordPopover.appendChild(base);
    }
    if (word.note) wordPopover.appendChild(createTextBlock("p", "word-note", word.note));
  }

  wordPopover.setAttribute("aria-hidden", "false");
  wordPopover.classList.add("word-popover-visible");

  if (!MOBILE_QUERY.matches) {
    requestAnimationFrame(() => positionWordPopover(clientX, clientY));
  }
}

function positionWordPopover(clientX, clientY) {
  const rect = wordPopover.getBoundingClientRect();
  const margin = 14;
  let left = clientX + 12;
  let top = clientY + 12;

  if (left + rect.width > window.innerWidth - margin) left = clientX - rect.width - 12;
  if (top + rect.height > window.innerHeight - margin) top = clientY - rect.height - 12;

  wordPopover.style.left = `${Math.max(margin, left)}px`;
  wordPopover.style.top = `${Math.max(margin, top)}px`;
}

function hideWordPopover() {
  clearWordSelection();
  wordPopover.classList.remove("word-popover-visible");
  wordPopover.setAttribute("aria-hidden", "true");
}

function positionFloatingMenu(menu, anchor) {
  requestAnimationFrame(() => {
    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const margin = 12;
    let left = anchorRect.right - menuRect.width;
    let top = anchorRect.bottom + 9;
    if (left < margin) left = margin;
    if (left + menuRect.width > innerWidth - margin) left = innerWidth - menuRect.width - margin;
    if (top + menuRect.height > innerHeight - margin) top = anchorRect.top - menuRect.height - 9;
    menu.style.left = `${Math.max(margin, left)}px`;
    menu.style.top = `${Math.max(margin, top)}px`;
  });
}

function openVariantMenu(anchor, groupId) {
  const variants = uniqueStoriesV7(getVariants(groupId));
  if (variants.length < 2) return;
  closeSettings();
  state.variantTargetGroupId = groupId;
  variantMenu.replaceChildren();
  const currentId = state.activeStory && groupIdFor(state.activeStory) === groupId
    ? state.activeStory.id
    : (state.variantSelections[groupId] || variants[0].id);

  variants.forEach((variant) => {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = `variant-choice${variant.id === currentId ? " selected" : ""}`;
    const shortLevel = String(variant.level || "").replace(/^TOPIK\s*/i, "") || "•";
    const mark = createTextBlock("span", "variant-choice-mark", shortLevel);
    const copy = document.createElement("span");
    copy.append(createTextBlock("strong", "", variant.variantLabel || variant.level || "Version"));
    copy.append(createTextBlock("small", "", variant.englishTitle || variant.title));
    const check = createTextBlock("span", "variant-choice-check", variant.id === currentId ? "✓" : "");
    choice.append(mark, copy, check);
    choice.addEventListener("click", (event) => {
      event.stopPropagation();
      selectVariantV6(groupId, variant.id);
      hideVariantMenu();
      if (state.activeStory && groupIdFor(state.activeStory) === groupId) {
        openStory(variant, false);
        history.replaceState(
          {view: "reader", storyId: variant.id, collectionId: variant.collectionId},
          "",
          `#story=${encodeURIComponent(variant.id)}`
        );
      } else {
        renderLibrary(searchInput.value);
      }
    });
    variantMenu.appendChild(choice);
  });

  variantMenu.setAttribute("aria-hidden", "false");
  variantMenu.classList.add("variant-menu-open");
  positionFloatingMenu(variantMenu, anchor);
}

function hideVariantMenu() {
  variantMenu.classList.remove("variant-menu-open");
  variantMenu.setAttribute("aria-hidden", "true");
  state.variantTargetGroupId = null;
}
