# Korean Reader — Modular Codebase

This project is a static Korean reading application divided into small feature files. The separation is intended to make future AI-assisted edits possible without repeatedly providing the complete application.

The application reads collection and story JSON files from the public repository configured in `js/settings.js`. User preferences are stored locally in the browser with `localStorage`.

## Current behavior

### Word and grammar interactions

| Device | Interaction | Result |
|---|---|---|
| Desktop | Single click a word | Show its compact translation popup |
| Desktop | Double-click anywhere in a sentence | Highlight the complete sentence and open its grammar explanation |
| Mobile | Short tap a word | Show its compact translation popup |
| Mobile | Long press anywhere in a sentence | Move the sentence near the top, highlight it, and open its grammar explanation |
| Keyboard | Enter or Space | Show the selected word translation |
| Keyboard | Shift + Enter | Open grammar details |

A translation highlights only its word. A grammar explanation always highlights the complete sentence rather than an individual word.

### Grammar panel

- Desktop uses the original sticky panel beside the story.
- Mobile uses a scrollable bottom sheet occupying approximately the lower half of the display.
- The selected sentence is moved toward the top of the visible reader before the sheet opens.
- The mobile sheet closes through its close button, a tap outside it, or a downward swipe from its top area.
- Escape also closes the panel when a keyboard is present.
- Detailed grammar fields remain supported.
- `Key vocabulary` can be shown or hidden through Settings.

### Search

There is no search-scope annotation and no separate grammar library.

On the main page, search matches:

- collection title and Korean title;
- collection description;
- story title and English title;
- story description;
- Korean story text;
- sentence translations.

Inside a collection, only stories in that collection are searched. Vocabulary entries, grammar explanations, authors, tags, TOPIK metadata, and other hidden metadata are not included in search.

### Settings

The Settings button appears only on the main page. Current settings include:

- light or dark appearance;
- color theme, including Dracula;
- story-specific accent colors;
- interface font;
- story-font override;
- text size;
- line spacing;
- compact or expanded word translations;
- Key Vocabulary visibility;
- concise or detailed grammar explanations;
- animation intensity.

## Directory structure

```text
korean_reader_modular_v4/
├── index.html
├── site.webmanifest
├── README.md
├── docs/
│   └── STORY_JSON_SCHEMA.md
├── css/
│   ├── base.css
│   ├── layout.css
│   ├── cards.css
│   ├── reader.css
│   ├── grammar.css
│   ├── overlays.css
│   ├── settings.css
│   ├── mobile.css
│   ├── animations.css
│   ├── directories.css
│   ├── themes.css
│   └── thumbnails.css
├── js/
│   ├── storage.js
│   ├── settings.js
│   ├── app.js
│   ├── library.js
│   ├── router.js
│   ├── directories.js
│   ├── stories.js
│   ├── thumbnails.js
│   ├── grammar.js
│   ├── reader.js
│   ├── interactions.js
│   ├── themes.js
│   ├── settings-panel.js
│   ├── bookmarks.js
│   ├── search.js
│   └── pwa.js
├── assets/
│   └── directory-svg/
├── icons/
├── thumbnails/
└── library/
```

The root paths `icons/`, `thumbnails/`, and `library/` remain unchanged so existing JSON and manifest paths continue to work.

## Startup and data flow

1. `index.html` defines the library view, reader view, settings panel, grammar panel, word popup, variant menu, and toast.
2. Scripts are loaded in dependency order at the end of `index.html`.
3. `js/pwa.js` calls `initializeLibrary()`.
4. `js/library.js` discovers and loads JSON files.
5. Normalized collections and stories are stored in the shared `state` object from `js/app.js`.
6. `js/router.js` selects the active collection or reader view.
7. Rendering modules create cards, story text, popups, and grammar details.
8. `js/search.js` connects search, navigation, keyboard, resize, and history listeners.

Do not reorder script imports unless their dependencies are updated too.

## Reliable library loading

`js/library.js` no longer relies on only one GitHub API request. It uses this order:

1. A same-origin manifest, when present.
2. A jsDelivr repository file listing.
3. GitHub's recursive tree API as a final fallback.

For each JSON file, it then tries:

1. the deployed website's own `library/` path;
2. jsDelivr's GitHub CDN;
3. `raw.githubusercontent.com`.

This makes deployed static versions less dependent on GitHub API availability or rate limits.

### Optional manifest

For the most deterministic deployment, add `library/manifest.json`:

```json
{
  "files": [
    "collection_1/info.json",
    "collection_1/01_story.json",
    "collection_2/info.json",
    "collection_2/01_story.json"
  ]
}
```

Paths may be relative to `library/` or begin with `library/`.

# JavaScript reference

## `js/storage.js`

Safe wrappers around `localStorage`.

Use it for persistence changes or storage error handling.

## `js/settings.js`

Static configuration and default preferences.

Contains themes, appearances, fonts, setting defaults, storage keys, mobile breakpoint, long-press duration, and `GITHUB_LIBRARY` repository configuration.

Use it when changing themes, fonts, defaults, gestures, or the source repository.

## `js/app.js`

Shared runtime state and cached DOM references.

Use it when introducing a new root-level control, panel, or state field.

## `js/library.js`

Library discovery, network fallbacks, validation, and JSON normalization.

Important responsibilities:

- same-origin manifest loading;
- jsDelivr and GitHub fallbacks;
- collection discovery;
- story validation;
- fallback collection creation;
- variant, thumbnail, author, tag, and preferred-font normalization;
- `getCollection()` and `getStoriesForCollection()`.

Use it when changing the JSON schema or loading strategy.

## `js/router.js`

Collection and reader navigation.

Contains `showCollections()`, `showCollection()`, `renderLibrary()`, and browser-history restoration.

Use it for routes, hash URLs, back behavior, or root-view changes.

## `js/directories.js`

Main-page and directory-card rendering.

Contains the `Korean Reader` heading, collection cards, global search sections, and empty states. Directory tags and entry arrows are intentionally not rendered.

For visual changes, also provide `css/cards.css` and `css/directories.css`.

## `js/stories.js`

Story grouping, variant selection, and story-card rendering.

Contains variant grouping, selected-version persistence, collection filtering, version selectors on cards, and story thumbnails. Story-card entry arrows are intentionally not rendered.

## `js/thumbnails.js`

External story thumbnails, character-based fallbacks, collection monograms, and pointer-based card tilt.

Card SVG loading is intentionally not supported. Collection cards use the `monogram` from collection metadata, and stories without an external thumbnail reuse that collection character as their visual mark.

Use this file with `css/thumbnails.css`, `css/cards.css`, and `css/directories.css` for card-art changes.

## `js/reader.js`

Story rendering and word interaction handling.

Contains:

- `openStory()` and `renderStory()`;
- Korean word token creation;
- word-only translation clicks and taps;
- sentence-only desktop double-click grammar activation;
- sentence-only mobile long-press grammar activation;
- synthetic-click suppression on touch devices;
- word lookup construction.

This is the primary file for gesture or tokenization changes.

## `js/grammar.js`

Grammar normalization, rendering, highlighting, and panel state.

Contains:

- richer grammar-field compatibility;
- complete-sentence grammar highlighting;
- grammar-card rendering;
- optional Key Vocabulary rendering;
- desktop panel and mobile bottom-sheet behavior;
- selected-sentence scrolling, outside-tap closing, and swipe-down closing.

For panel styling, also provide `css/grammar.css` and `css/mobile.css`.

## `js/interactions.js`

Floating UI behavior.

Contains the word-translation popup, popup positioning, selected-word cleanup, and story-version menu.

Use it with `css/overlays.css` for popup changes.

## `js/themes.js`

Applies appearances, themes, accents, contrast variables, fonts, line spacing, animations, and toast behavior.

Use it together with `js/settings.js` for theme and contrast changes.

## `js/settings-panel.js`

Settings-panel form behavior.

Contains option generation, synchronization, opening and closing, live updates, Key Vocabulary re-rendering, and reset behavior.

Adding a setting usually requires changes in:

1. `js/settings.js`;
2. `index.html`;
3. `js/settings-panel.js`;
4. the feature module that consumes the value.

## `js/bookmarks.js`

Reserved extension point. Bookmarks, reading-position restoration, and read-state behavior are not active yet.

## `js/search.js`

Restricted search indexing and global event wiring.

Search indexing includes only titles, descriptions, Korean text, and sentence translations. This file also connects back buttons, panel closing, Escape, resize, scroll, and browser-history events.

## `js/pwa.js`

Application bootstrap plus loading and error states.

It does not register a service worker. Installed-app metadata comes from `site.webmanifest` and the icon/meta tags in `index.html`.

# CSS reference

| File | Responsibility |
|---|---|
| `base.css` | Variables, resets, background, and shared font stacks |
| `layout.css` | App shell, headers, buttons, search box, and result headings |
| `cards.css` | Collection/story grids, organic card surfaces, tilt, press, and hover behavior |
| `reader.css` | Reader header, accent-tinted reading surface, word selection, and full-sentence grammar highlighting |
| `grammar.css` | Desktop grammar panel and grammar/vocabulary cards |
| `overlays.css` | Word popup and toast |
| `settings.css` | Settings backdrop, panel, and controls |
| `mobile.css` | Responsive cards and lower-half mobile grammar bottom sheet |
| `animations.css` | Staggered card entrances, reader entrance, ambient motion, plus reduced/disabled modes |
| `directories.css` | Collection headings, prominent character monograms, and counts |
| `themes.css` | Settings button, variant menu, and story-version labels on cards |
| `thumbnails.css` | External story covers, character fallbacks, and responsive sizes |

# Story and grammar JSON

The app remains compatible with short grammar entries such as:

```json
{
  "pattern": "-고 싶다",
  "explanation": "Expresses a desire to do something.",
  "example": "한국에 가고 싶다."
}
```

The richer format is documented in [`docs/STORY_JSON_SCHEMA.md`](docs/STORY_JSON_SCHEMA.md).

The `fragment` field should contain only the relevant Korean portion, for example:

```json
"fragment": "먹고 싶다"
```

This lets the reader highlight the relevant grammar structure in the original text.

# Recommended file bundles for future AI prompts

| Requested change | Files to provide |
|---|---|
| Word click, tap, or long-press behavior | `README.md`, `js/reader.js`, `js/interactions.js`, `css/reader.css`, `css/overlays.css` |
| Grammar panel or content rendering | `README.md`, `js/grammar.js`, `js/reader.js`, `css/grammar.css`, `css/mobile.css` |
| Search behavior | `README.md`, `js/search.js`, `js/router.js`, `js/directories.js`, `js/stories.js` |
| Library loading or hosted deployment | `README.md`, `js/library.js`, `js/settings.js`, `js/pwa.js` |
| Settings option | `README.md`, `js/settings.js`, `js/settings-panel.js`, `index.html`, relevant feature file |
| Theme or contrast | `README.md`, `js/settings.js`, `js/themes.js`, `css/base.css`, relevant component CSS |
| Collection cards | `README.md`, `js/directories.js`, `css/cards.css`, `css/directories.css` |
| Story cards or variants | `README.md`, `js/stories.js`, `js/interactions.js`, `css/cards.css`, `css/themes.css` |
| Story JSON schema | `README.md`, `docs/STORY_JSON_SCHEMA.md`, `js/library.js` |

# Local testing

A local HTTP server is recommended because browsers restrict some `fetch` behavior under `file://`:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Opening `index.html` directly may still work through the external fallbacks, but an HTTP server gives behavior closer to the deployed website.

# Deployment

Deploy these items together:

- `index.html`;
- `css/`;
- `js/`;
- `docs/`;
- `site.webmanifest`;
- existing `icons/`;
- existing `thumbnails/`;
- existing `library/`.

No build step or package manager is required.
