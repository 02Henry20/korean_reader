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
    if (!current) {
      current = word;
    } else if ((current + " " + word).length <= maxCharacters) {
      current += " " + word;
    } else {
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

function createStoryThumbnailV8(story, accent) {
  const wrapper = document.createElement("div");
  wrapper.className = "story-thumbnail";
  wrapper.setAttribute("aria-hidden", "true");

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

function resolveThumbnailPathV9(story, value) {
  const path = String(value || "").trim().replace(/\\/g, "/");
  if (!path) return "";

  /* Full URLs, data/blob URLs, root paths, and anchors are already complete. */
  if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(path)) return path;

  /* ./cover.jpg and ../cover.jpg follow the imported JSON folder. */
  if (/^\.\.?\//.test(path) && story?.sourcePath) {
    try {
      const sourceUrl = new URL(String(story.sourcePath).replace(/\\/g, "/"), document.baseURI);
      return new URL(path, sourceUrl).href;
    } catch {}
  }

  /* Other relative paths are intentionally relative to the HTML file. */
  return path;
}

function storyThumbnailSourceV8(story, accent) {
  const groupThumbnail = story?.thumbnail || getVariants(groupIdFor(story)).find((variant) => variant.thumbnail)?.thumbnail || "";
  const resolved = resolveThumbnailPathV9(story, groupThumbnail);
  return resolved || generatedStoryThumbnailV8(story, accent);
}
