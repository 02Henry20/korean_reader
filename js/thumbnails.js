function collectionMonogram(collection) {
  return String(
    collection?.monogram ||
    collection?.koreanTitle?.trim()?.slice(0, 1) ||
    collection?.title?.trim()?.slice(0, 1) ||
    "文"
  );
}

function storyMonogram(story) {
  const collection = getCollection(story?.collectionId);
  return collectionMonogram(collection || story);
}

function createCollectionArtwork(collection, accent) {
  const wrapper = document.createElement("div");
  wrapper.className = "collection-artwork collection-monogram-art";
  wrapper.style.setProperty("--art-accent", accent.accent);
  wrapper.style.setProperty("--art-accent-strong", accent.accentStrong);
  wrapper.setAttribute("aria-hidden", "true");

  const symbol = createTextBlock(
    "span",
    "collection-monogram-symbol",
    collectionMonogram(collection)
  );
  wrapper.appendChild(symbol);
  return wrapper;
}

function resolveThumbnailPathV9(story, value) {
  const path = String(value || "").trim().replace(/\\/g, "/");
  if (!path) return "";
  if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(path)) return path;

  if (/^\.\.?\//.test(path) && story?.sourcePath) {
    try {
      const sourceUrl = new URL(
        String(story.sourcePath).replace(/\\/g, "/"),
        document.baseURI
      );
      return new URL(path, sourceUrl).href;
    } catch {}
  }

  return path;
}

function storyThumbnailSourceV8(story) {
  const groupThumbnail =
    story?.thumbnail ||
    getVariants(groupIdFor(story)).find((variant) => variant.thumbnail)?.thumbnail ||
    "";
  return resolveThumbnailPathV9(story, groupThumbnail);
}

function showStoryMonogram(wrapper, story) {
  wrapper.replaceChildren(
    createTextBlock("span", "story-monogram-symbol", storyMonogram(story))
  );
  wrapper.classList.add("story-monogram-thumbnail");
}

function createStoryThumbnailV8(story, accent) {
  const wrapper = document.createElement("div");
  wrapper.className = "story-thumbnail";
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.style.setProperty("--art-accent", accent.accent);
  wrapper.style.setProperty("--art-accent-strong", accent.accentStrong);

  const source = storyThumbnailSourceV8(story);
  if (!source) {
    showStoryMonogram(wrapper, story);
    return wrapper;
  }

  const image = document.createElement("img");
  image.src = source;
  image.alt = "";
  image.decoding = "async";
  image.loading = "eager";
  image.addEventListener("error", () => showStoryMonogram(wrapper, story), {once: true});
  wrapper.appendChild(image);
  return wrapper;
}

function enableCardMotion(card) {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  card.addEventListener("pointermove", (event) => {
    if (state.settings.animationIntensity !== "full") return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty("--tilt-x", `${(-y * 3.2).toFixed(2)}deg`);
    card.style.setProperty("--tilt-y", `${(x * 4.2).toFixed(2)}deg`);
    card.style.setProperty("--shine-x", `${((x + 0.5) * 100).toFixed(1)}%`);
    card.style.setProperty("--shine-y", `${((y + 0.5) * 100).toFixed(1)}%`);
  });

  card.addEventListener("pointerleave", () => {
    card.style.removeProperty("--tilt-x");
    card.style.removeProperty("--tilt-y");
    card.style.removeProperty("--shine-x");
    card.style.removeProperty("--shine-y");
  });
}
