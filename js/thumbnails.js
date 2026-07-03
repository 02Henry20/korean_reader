const CARD_SVG_CACHE = new Map();

function escapeXmlV8(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[char]);
}

function splitCoverTextV8(value, maxCharacters = 12, maxLines = 2) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const words = raw.split(/\s+/u);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    if (!current) current = word;
    else if ((current + " " + word).length <= maxCharacters) current += " " + word;
    else {
      lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);

  if (lines.length === 1 && lines[0].length > maxCharacters && !/\s/u.test(lines[0])) {
    const compact = lines[0];
    lines.length = 0;
    for (let index = 0; index < compact.length; index += maxCharacters) {
      lines.push(compact.slice(index, index + maxCharacters));
    }
  }

  const limited = lines.slice(0, maxLines);
  if (lines.length > maxLines && limited.length) {
    limited[limited.length - 1] = limited[limited.length - 1].replace(/[.…]*$/u, "") + "…";
  }
  return limited;
}

function shortEnglishTitleV8(story) {
  const full = String(story?.englishTitle || "").trim();
  if (!full) return "KOREAN READER";
  const pieces = full.split(/\s+[—–-]\s+/u);
  return (pieces[pieces.length - 1] || full).trim();
}

function generatedStoryThumbnailV8(story, accent) {
  const titleLines = splitCoverTextV8(story?.title || "이야기", 8, 2);
  const englishLines = splitCoverTextV8(shortEnglishTitleV8(story), 18, 2);
  const collection = getCollection(story?.collectionId);
  const monogram = escapeXmlV8(collection?.monogram || String(story?.title || "문").slice(0, 1));
  const storyTitle = titleLines.map((line, index) =>
    `<tspan x="22" dy="${index === 0 ? 0 : 29}">${escapeXmlV8(line)}</tspan>`
  ).join("");
  const englishTitle = englishLines.map((line, index) =>
    `<tspan x="22" dy="${index === 0 ? 0 : 15}">${escapeXmlV8(line)}</tspan>`
  ).join("");

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="240" height="320" viewBox="0 0 240 320">
    <defs>
      <linearGradient id="coverGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${accent.accentSoft}"/>
        <stop offset=".52" stop-color="${accent.accent}"/>
        <stop offset="1" stop-color="${accent.accentStrong}"/>
      </linearGradient>
      <linearGradient id="coverShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000000" stop-opacity=".46"/>
      </linearGradient>
    </defs>
    <rect width="240" height="320" rx="24" fill="url(#coverGradient)"/>
    <circle cx="199" cy="52" r="76" fill="#ffffff" fill-opacity=".13"/>
    <circle cx="28" cy="167" r="67" fill="#ffffff" fill-opacity=".08"/>
    <path d="M-10 205 C42 157 77 230 132 181 C167 150 195 155 255 112 L255 335 L-10 335Z"
          fill="#ffffff" fill-opacity=".11"/>
    <text x="120" y="145" text-anchor="middle" fill="#ffffff" fill-opacity=".23"
          font-size="96" font-weight="900"
          font-family="Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif">${monogram}</text>
    <rect x="0" y="170" width="240" height="150" fill="url(#coverShade)"/>
    <text x="22" y="218" fill="#ffffff" font-size="25" font-weight="850"
          font-family="Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif">${storyTitle}</text>
    <text x="22" y="278" fill="#ffffff" fill-opacity=".76" font-size="11" font-weight="720"
          letter-spacing=".45"
          font-family="Inter, Arial, sans-serif">${englishTitle}</text>
    <rect x="17" y="17" width="49" height="20" rx="10" fill="#ffffff" fill-opacity=".20"/>
    <text x="41.5" y="31" text-anchor="middle" fill="#ffffff" font-size="8.5" font-weight="850"
          letter-spacing=".9" font-family="Inter, Arial, sans-serif">STORY</text>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function genericCollectionArtwork(collection) {
  const symbol = escapeXmlV8(collection?.monogram || String(collection?.title || "문").slice(0, 1));
  return `
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <path class="art-soft" d="M18 31c0-8 6-14 14-14h31c9 0 17 4 22 11l17 23c5 7 4 17-3 23L71 99c-6 5-15 6-22 2L23 87c-7-4-11-11-10-19l5-37Z"/>
      <path class="art-line" d="M31 35c13-8 27-8 42 0v48c-15-8-29-8-42 0V35Z"/>
      <path class="art-line" d="M73 35c8-5 16-7 24-6v47c-8-1-16 1-24 7V35Z"/>
      <path class="art-detail" d="M39 47h24M39 57h20M39 67h24"/>
      <circle class="art-orbit" cx="91" cy="24" r="10"/>
      <path class="art-orbit" d="M14 91c8-2 14 0 19 6"/>
      <text x="53" y="91" text-anchor="middle" class="art-symbol">${symbol}</text>
    </svg>`;
}

function genericStoryArtwork(story) {
  const symbol = escapeXmlV8(String(story?.title || "문").slice(0, 1));
  return `
    <svg viewBox="0 0 120 160" aria-hidden="true">
      <path class="art-soft" d="M18 13h72c8 0 14 6 14 14v104c0 9-7 16-16 16H28c-9 0-16-7-16-16V19c0-3 3-6 6-6Z"/>
      <path class="art-line" d="M29 31h61v91H29z"/>
      <path class="art-detail" d="M39 45h41M39 56h31M39 113h41"/>
      <path class="art-wave" d="M22 95c21-28 43 20 76-17v44H22V95Z"/>
      <circle class="art-orbit" cx="86" cy="37" r="9"/>
      <text x="58" y="93" text-anchor="middle" class="art-symbol art-symbol-large">${symbol}</text>
    </svg>`;
}

function repositoryAssetUrls(path) {
  const clean = String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!clean) return [];
  try {
    return [new URL(clean, document.baseURI).href];
  } catch {
    return [];
  }
}

function explicitAssetUrls(item, value) {
  const path = String(value || "").trim().replace(/\\/g, "/");
  if (!path) return [];
  if (/^(?:data:|blob:|https?:|\/)/i.test(path)) return [path];

  const urls = [];
  if (item?.sourcePath) {
    try { urls.push(new URL(path, item.sourcePath).href); } catch {}
  }
  urls.push(...repositoryAssetUrls(path.replace(/^\.\//, "")));
  return [...new Set(urls)];
}

function collectionSvgUrls(collection) {
  if (collection?.cardSvg) return explicitAssetUrls(collection, collection.cardSvg);
  const paths = [];
  if (collection?.sourceDirectory) paths.push(`${collection.sourceDirectory}/directory.svg`);
  paths.push(
    `assets/directory-svg/${collection.id}/directory.svg`,
    `directory-svg/${collection.id}/directory.svg`
  );
  return paths.flatMap(repositoryAssetUrls);
}

function storySvgUrls(story) {
  if (story?.cardSvg) return explicitAssetUrls(story, story.cardSvg);
  const sourceStem = String(story?.sourceFileName || "").replace(/\.json$/i, "");
  const paths = [];
  if (story?.sourceDirectory && sourceStem) {
    paths.push(`${story.sourceDirectory}/${sourceStem}/story.svg`);
  }
  paths.push(
    `assets/directory-svg/${story.collectionId}/${story.id}/story.svg`,
    `directory-svg/${story.collectionId}/${story.id}/story.svg`
  );
  return paths.flatMap(repositoryAssetUrls);
}

function sanitizeAndRecolorSvg(svgText) {
  const documentSvg = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const root = documentSvg.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg" || documentSvg.querySelector("parsererror")) {
    throw new Error("Invalid SVG");
  }

  root.querySelectorAll("script, foreignObject, iframe, object, embed").forEach((node) => node.remove());
  root.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
      if ((attribute.name === "href" || attribute.name.endsWith(":href")) && /^https?:/i.test(attribute.value)) {
        node.removeAttribute(attribute.name);
      }
    });
  });

  root.removeAttribute("width");
  root.removeAttribute("height");
  root.setAttribute("aria-hidden", "true");
  root.classList.add("external-card-svg");

  root.querySelectorAll("stop").forEach((node) => node.setAttribute("stop-color", "currentColor"));
  root.querySelectorAll("path, rect, circle, ellipse, polygon, polyline, line, text").forEach((node) => {
    const fill = node.getAttribute("fill");
    const stroke = node.getAttribute("stroke");
    if (fill !== "none") node.setAttribute("fill", "currentColor");
    if (stroke && stroke !== "none") node.setAttribute("stroke", "currentColor");
  });

  return document.importNode(root, true);
}

async function fetchFirstSvg(urls) {
  for (const url of urls) {
    if (CARD_SVG_CACHE.has(url)) {
      const cached = CARD_SVG_CACHE.get(url);
      if (cached) return cached.cloneNode(true);
      continue;
    }

    try {
      const response = await fetch(url, {cache: "force-cache"});
      if (!response.ok) throw new Error(String(response.status));
      const text = await response.text();
      const svg = sanitizeAndRecolorSvg(text);
      CARD_SVG_CACHE.set(url, svg);
      return svg.cloneNode(true);
    } catch {
      CARD_SVG_CACHE.set(url, null);
    }
  }
  return null;
}

function loadCardSvg(wrapper, urls) {
  if (!urls.length) return;
  fetchFirstSvg(urls).then((svg) => {
    if (!svg || !wrapper.isConnected) return;
    wrapper.replaceChildren(svg);
    wrapper.classList.add("has-custom-svg");
  });
}

function createCollectionArtwork(collection, accent) {
  const wrapper = document.createElement("div");
  wrapper.className = "collection-artwork card-svg-art";
  wrapper.style.setProperty("--art-accent", accent.accent);
  wrapper.style.setProperty("--art-accent-strong", accent.accentStrong);
  wrapper.innerHTML = genericCollectionArtwork(collection);
  loadCardSvg(wrapper, collectionSvgUrls(collection));
  return wrapper;
}

function resolveThumbnailPathV9(story, value) {
  const path = String(value || "").trim().replace(/\\/g, "/");
  if (!path) return "";
  if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(path)) return path;

  if (/^\.\.?\//.test(path) && story?.sourcePath) {
    try {
      const sourceUrl = new URL(String(story.sourcePath).replace(/\\/g, "/"), document.baseURI);
      return new URL(path, sourceUrl).href;
    } catch {}
  }
  return path;
}

function storyThumbnailSourceV8(story, accent) {
  const groupThumbnail = story?.thumbnail || getVariants(groupIdFor(story)).find((variant) => variant.thumbnail)?.thumbnail || "";
  const resolved = resolveThumbnailPathV9(story, groupThumbnail);
  return resolved || generatedStoryThumbnailV8(story, accent);
}

function createStoryThumbnailV8(story, accent) {
  const wrapper = document.createElement("div");
  wrapper.className = "story-thumbnail";
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.style.setProperty("--art-accent", accent.accent);
  wrapper.style.setProperty("--art-accent-strong", accent.accentStrong);

  if (story?.cardSvg) {
    wrapper.classList.add("card-svg-art");
    wrapper.innerHTML = genericStoryArtwork(story);
    loadCardSvg(wrapper, storySvgUrls(story));
    return wrapper;
  }

  const groupThumbnail = story?.thumbnail || getVariants(groupIdFor(story)).find((variant) => variant.thumbnail)?.thumbnail || "";
  if (groupThumbnail) {
    const image = document.createElement("img");
    const fallback = generatedStoryThumbnailV8(story, accent);
    image.src = storyThumbnailSourceV8(story, accent);
    image.alt = "";
    image.decoding = "async";
    image.loading = "eager";
    image.addEventListener("error", () => {
      if (image.src !== fallback) image.src = fallback;
    }, {once: true});
    wrapper.appendChild(image);
    return wrapper;
  }

  wrapper.classList.add("card-svg-art");
  wrapper.innerHTML = genericStoryArtwork(story);
  loadCardSvg(wrapper, storySvgUrls(story));
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
