# Korean Reader — Modular Codebase

This version divides the Korean Reader into small feature files so that future changes can be made without repeatedly sending the complete application to an AI.

The application remains a static website. It reads the public GitHub repository configured in `js/settings.js`, loads collection and story JSON files from `library/`, and stores only user preferences in `localStorage`.

## Current behavior

### Word interactions

| Device | Interaction | Result |
|---|---|---|
| Desktop | Single click a word | Compact word translation popup |
| Desktop | Double-click a word or marked grammar structure | Grammar explanation panel |
| Mobile | Short tap a word | Compact word translation popup |
| Mobile | Long press a word or marked grammar structure | Grammar bottom sheet |
| Keyboard | Enter or Space on a word | Word translation |
| Keyboard | Shift + Enter on a word | Grammar explanation |

The selected word is highlighted in the Korean text. Grammar structures are underlined subtly and highlighted when their explanation is open.

### Grammar panel

- Desktop: sticky side panel.
- Mobile: scrollable bottom sheet occupying approximately the lower half of the screen.
- Close methods on mobile:
  - close button;
  - tap the darkened area outside the sheet;
  - swipe the handle downward.
- The full Korean sentence is not repeated in the panel.
- Only the relevant grammar fragment is shown when the JSON supplies or allows the app to infer it.

### Search scopes

- Main library: searches the complete library.
- Collection page: searches only stories in that collection.
- Grammar library: searches only grammar entries.

Searchable story data includes:

- collection and story titles;
- descriptions;
- TOPIK levels;
- author and story metadata;
- English sentence translations;
- complete Korean story text;
- word translations;
- vocabulary entries;
- grammar patterns, explanations, examples, transformations, and nuances.

### Settings

The Settings button is displayed only on the main library page. Settings are stored in `localStorage` and include:

- light or dark appearance;
- global color theme, including Dracula;
- story-specific accent colors on/off;
- interface font;
- story font override;
- story text size;
- line spacing;
- compact or expanded word translations;
- key-vocabulary visibility;
- concise or detailed grammar explanations;
- animation intensity.

## Directory structure

```text
korean_reader_modular/
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
│   ├── grammar-library.css
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
│   ├── reader.js
│   ├── grammar.js
│   ├── interactions.js
│   ├── themes.js
│   ├── settings-panel.js
│   ├── grammar-library.js
│   ├── bookmarks.js
│   ├── search.js
│   └── pwa.js
├── icons/
├── thumbnails/
└── library/
```

The existing root paths `icons/`, `thumbnails/`, and `library/` are intentionally preserved so current manifest and story paths continue to work.

## Startup and data flow

1. `index.html` defines the library, reader, grammar-library, settings, popup, and bottom-sheet containers.
2. JavaScript files load in dependency order at the end of `index.html`.
3. `js/pwa.js` calls `initializeLibrary()`.
4. `js/library.js` reads the configured GitHub tree and downloads collection/story JSON files.
5. Normalized data is stored in the shared `state` object from `js/app.js`.
6. `js/router.js` selects the current view.
7. Feature renderers create the required DOM elements.
8. `js/search.js` connects global event listeners and search controls.

Do not reorder script imports unless the dependencies are also updated.

# JavaScript reference

## `js/storage.js`

Safe wrappers around `localStorage`.

Important functions:

- `storageGet(key)`
- `storageSet(key, value)`
- `loadJSONV6(key, fallback)`

Provide this file when changing persistence or storage error handling.

## `js/settings.js`

Static configuration and default preferences.

Contains:

- `THEMES`: global and story accent palettes;
- `APPEARANCES`: light and dark surface palettes;
- `UI_FONTS`: allowed interface fonts;
- `STORY_FONTS`: allowed reader fonts;
- `DEFAULT_SETTINGS`;
- local-storage keys;
- mobile breakpoint and long-press duration;
- `GITHUB_LIBRARY` repository configuration;
- `loadAppSettings()` and legacy-setting migration.

Provide this file when adding themes, fonts, preferences, or changing the GitHub repository.

## `js/app.js`

Shared runtime state and cached DOM references.

Contains:

- `state`;
- references to all major views, panels, buttons, and inputs;
- `createTextBlock()`;
- `setViewActive()`.

Provide this file when a new root-level control or state field is introduced.

## `js/library.js`

GitHub loading, validation, and JSON normalization.

Contains:

- file/path helpers;
- GitHub API requests;
- collection discovery;
- fallback collection creation;
- collection/story normalization;
- story variant, thumbnail, author, tags, and preferred-font metadata;
- `getCollection()`;
- `getStoriesForCollection()`.

Provide this file when changing the story or collection JSON schema.

## `js/router.js`

Navigation and view switching.

Contains:

- `showCollections()`;
- `showCollection()`;
- `showGrammarLibrary()`;
- `renderLibrary()`;
- `renderNavigation()`;
- main-page Settings/Grammar button visibility.

Provide this file when changing routes, hash URLs, browser history, or page-level navigation.

## `js/directories.js`

Collection-page rendering.

Contains:

- main library heading and scope setup;
- collection-card creation;
- global search section headings;
- empty-state rendering.

Directory tags are intentionally not rendered.

For collection-card design changes, also provide:

- `css/cards.css`;
- `css/directories.css`.

## `js/stories.js`

Story grouping, version selection, and story-card rendering.

Contains:

- grouping by `variantGroupId`;
- selected-variant persistence;
- collection-scoped filtering;
- version buttons;
- optional collection context on global search cards.

For TOPIK/version behavior, also provide `js/interactions.js` and `js/reader.js`.

## `js/thumbnails.js`

External cover handling and generated fallback covers.

Contains:

- generated SVG covers;
- thumbnail-path resolution;
- `<img>` creation;
- load-error fallback.

Provide this file with `css/thumbnails.css` for thumbnail changes.

## `js/reader.js`

Korean text rendering and word/grammar gesture detection.

Contains:

- `openStory()`;
- `renderStory()`;
- grammar-fragment range detection;
- word token creation;
- desktop single-click/double-click behavior;
- mobile tap/long-press behavior;
- word lookup construction;
- optional word-to-grammar index mapping.

This is the primary file for changing interaction gestures or Korean text tokenization.

## `js/grammar.js`

Grammar normalization, rendering, highlighting, and mobile sheet behavior.

Contains:

- `normalizeGrammarItem()`;
- `openGrammarDetails()`;
- relevant-fragment highlighting;
- detailed grammar-card rendering;
- optional key-vocabulary rendering;
- panel clearing;
- swipe-down gesture handling.

For visual panel changes, also provide:

- `css/grammar.css`;
- `css/mobile.css`.

## `js/interactions.js`

Small floating overlays.

Contains:

- compact word translation popup;
- popup positioning;
- selected-word cleanup;
- story-version menu.

For word-popup design changes, also provide `css/overlays.css`.

## `js/themes.js`

Applies appearance, theme, accent, font, line spacing, and animation settings.

Contains:

- color mixing;
- global surface selection;
- story-accent resolution;
- card colors;
- search contrast variables;
- word-popup contrast variables;
- story-font resolution;
- reader typography;
- settings persistence helpers;
- toast messages.

Provide this file together with `js/settings.js` for most theme changes.

## `js/settings-panel.js`

Settings panel behavior.

Contains:

- select-option generation;
- form synchronization;
- open/close behavior;
- live preference application;
- reset-to-default behavior.

For adding a setting, normally edit all of:

1. `js/settings.js` — default and allowed values;
2. `index.html` — form control;
3. `js/settings-panel.js` — only when custom handling is required;
4. the feature file that consumes the setting.

## `js/grammar-library.js`

Builds a grammar index from all loaded stories.

Contains:

- flattened grammar-entry generation;
- grammar-only filtering;
- grammar-library cards;
- source-story links.

No separate `grammar.json` is required. The library is generated from story JSON.

## `js/bookmarks.js`

Reserved extension point. It remains inactive because this version does not yet restore bookmarks, reading positions, or read-story state.

## `js/search.js`

Search indexing and global event wiring.

Contains:

- text normalization;
- complete story search-index generation;
- collection search text;
- global result rendering;
- search-scope labels;
- search, back, grammar-library, panel, Escape, resize, scroll, and history listeners.

Provide this file for search fields, search scopes, or global listener changes.

## `js/pwa.js`

Application bootstrap and loading/error states.

It does not register a service worker. Installed-app behavior still comes from `site.webmanifest` and icon/meta tags.

# CSS reference

| File | Responsibility |
|---|---|
| `base.css` | Variables, resets, page background, shared font stacks |
| `layout.css` | App shell, headers, buttons, search box, search scope/results headings |
| `cards.css` | Collection/story grid and base cards |
| `reader.css` | Reader header, Korean typography, selected-word and grammar highlights |
| `grammar.css` | Desktop grammar panel and detailed grammar fields |
| `overlays.css` | Word popup and toast |
| `settings.css` | Settings backdrop, panel, controls, mobile settings sheet |
| `grammar-library.css` | Grammar index cards and responsive grid |
| `mobile.css` | Mobile reader and half-height grammar bottom sheet |
| `animations.css` | Full/reduced/none animation modes and OS reduced-motion support |
| `directories.css` | Collection-specific headings, monograms, and counts |
| `themes.css` | Main-page utility buttons, variant menu, TOPIK availability labels |
| `thumbnails.css` | Story thumbnail placement and responsive sizes |

# Story and grammar JSON

The app remains backward-compatible with existing grammar entries such as:

```json
{
  "pattern": "-고 싶다",
  "explanation": "Expresses a desire to do something.",
  "example": "한국에 가고 싶다."
}
```

For the new detailed layout, use the richer format documented in:

[`docs/STORY_JSON_SCHEMA.md`](docs/STORY_JSON_SCHEMA.md)

The most important new grammar field is `fragment`. It should contain only the relevant Korean portion of the sentence, for example:

```json
"fragment": "먹고 싶다"
```

That allows the reader to identify and highlight the exact grammar structure.

# Recommended file bundles for future AI prompts

| Requested change | Files to provide |
|---|---|
| Word click/tap/long-press behavior | `README.md`, `js/reader.js`, `js/interactions.js`, `css/reader.css`, `css/overlays.css` |
| Grammar content or panel behavior | `README.md`, `js/grammar.js`, `js/reader.js`, `css/grammar.css`, `css/mobile.css` |
| Search fields or scopes | `README.md`, `js/search.js`, `js/router.js`, plus the affected renderer |
| Settings option | `README.md`, `js/settings.js`, `js/settings-panel.js`, `index.html`, relevant feature file |
| Theme or contrast | `README.md`, `js/settings.js`, `js/themes.js`, `css/base.css`, relevant component CSS |
| Collection cards | `README.md`, `js/directories.js`, `css/cards.css`, `css/directories.css` |
| Story cards or versions | `README.md`, `js/stories.js`, `js/interactions.js`, `css/cards.css`, `css/themes.css` |
| Story JSON schema | `README.md`, `docs/STORY_JSON_SCHEMA.md`, `js/library.js` |
| Add a new root-level view | `README.md`, `index.html`, `js/app.js`, `js/router.js`, `js/search.js` |

# Important limitation of this package

The actual story JSON files from the live GitHub repository were not included in the supplied modular project. Therefore:

- the code and schema now support detailed grammar explanations;
- the UI renders all detailed fields when present;
- existing short grammar entries continue to work;
- the text of every existing story has **not** been rewritten or expanded inside this archive.

To expand all existing grammar explanations, provide the actual `library/` story JSON files. Each grammar entry can then be updated using the schema in `docs/STORY_JSON_SCHEMA.md`.

# Local testing

Because the application uses `fetch`, do not open `index.html` directly with `file://` for normal testing. Run a local server from the project directory:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

The repository configured in `js/settings.js` must be public and reachable.

# Deployment

Push the following to the repository root:

- `index.html`;
- `css/`;
- `js/`;
- `docs/`;
- `site.webmanifest`;
- existing `icons/`;
- existing `thumbnails/`;
- existing `library/`.

No build step or package manager is required.
