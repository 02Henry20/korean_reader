# Korean Reader — Modular Firebase Edition

Korean Reader is a static GitHub Pages application for reading Korean stories with
word translations, sentence grammar explanations, themes, bookmarks, read-state
tracking, local imports, and optional Firebase synchronization.

The application remains usable without Firebase. Imported content is written to the
browser's IndexedDB first, while settings, bookmarks, and read state are stored
locally. After email/password sign-in, the app synchronizes collections, stories,
reader state, and deletion markers through Firestore.

Thumbnail files are never uploaded to Firebase. Built-in thumbnails load from paths
stored in the repository, while manually selected thumbnail files remain only in the
browser's IndexedDB on the device where they were imported. Synchronization shows
determinate progress for Firestore records.

See `FIREBASE_SETUP.md` before testing cloud synchronization.

## Current interactions

| Device | Interaction | Result |
|---|---|---|
| Desktop | Single-click a word | Open its translation beneath the word |
| Desktop | Double-click a sentence | Highlight the whole sentence and open grammar |
| Mobile | Short tap a word | Open its translation |
| Mobile | Double-tap a sentence | Highlight the whole sentence and open the grammar bottom sheet |
| Any | Bookmark button, then select a word | Save or move the story's single bookmark |

Opening a bookmarked story automatically scrolls to the marked word.

## Library management

The contextual **Add** button changes by location:

### Main library

- **Add directory** selects a complete local folder.
- **Delete directories** enters directory-delete mode.

### Inside a directory

- **Add story** selects one story JSON file and optionally accepts a local-only
  thumbnail. Repository thumbnail paths should be stored in the story JSON.
- **Delete stories** enters story-delete mode.

Delete mode is intentionally separate from ordinary navigation. Click **Done** to
leave it. Deletions are stored locally and synchronized as deletion markers, so
GitHub-provided stories can also remain hidden on other signed-in devices.

### Recommended imported directory

```text
my-directory/
├── info.json
├── 01_story.json
├── 02_story.json
└── thumbnails/
    ├── 01_story.jpg
    └── 02_story.jpg
```

A story thumbnail path is resolved relative to the story JSON file:

```json
{
  "thumbnail": "thumbnails/01_story.jpg"
}
```

## Read state

Every story card has a check button. Read stories:

- move below unread stories inside their directory;
- receive a desaturated grey mask;
- retain their state locally;
- synchronize through Firebase when signed in.


## Safe synchronization across multiple devices

Signing in no longer immediately uploads the current device. The app first downloads
Firestore metadata and compares dataset fingerprints for the local and cloud copies.
If both sides changed, it pauses before writing and offers four choices:

- **Merge both** keeps records found on either side. Matching records use their
  `updatedAt` values, while read state and bookmarks use per-field timestamps.
- **Use Firebase** replaces the current device's custom library and reading state.
- **Use this device** clears the Korean Reader collections in Firestore and uploads
  the current device after an additional confirmation.
- **Cancel and remain local** leaves both copies unchanged.

Each successful synchronization updates:

```text
Firestore
koreanReaderUsers/<uid>/syncMetadata/main
```

The metadata document contains a monotonically increasing revision and the device ID
that completed the operation. Each browser stores its last synchronized revision and
local/cloud fingerprints in local storage. A later synchronization can therefore
detect when both sides changed since their last common state.

Absence is not treated as deletion. Only an explicit deletion marker can delete an
item, and that marker wins only when its `deletedAt` timestamp is newer than the
corresponding story or directory. Re-importing a newer item clears a stale deletion.

## Firebase data layout

```text
Firestore
koreanReaderUsers/<uid>/libraryCollections/<collection-id>
koreanReaderUsers/<uid>/libraryStories/<story-id>
koreanReaderUsers/<uid>/readerState/<story-id>
koreanReaderUsers/<uid>/libraryDeletions/<kind:id>
koreanReaderUsers/<uid>/syncMetadata/main
```

The paths are intentionally isolated because the configured Firebase project also
appears to be used by a weight-tracking application. Merge the supplied Security
Rules snippets into that project's existing rules; do not blindly replace them.

## Directory structure

```text
├── index.html
├── site.webmanifest
├── README.md
├── FIREBASE_SETUP.md
├── firebase/
│   ├── README.md
│   └── firestore.rules.example
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
│   ├── thumbnails.css
│   └── cloud.css
├── js/
│   ├── storage.js
│   ├── firebase.js
│   ├── local-db.js
│   ├── settings.js
│   ├── app.js
│   ├── library.js
│   ├── cloud-sync.js
│   ├── bookmarks.js
│   ├── router.js
│   ├── directories.js
│   ├── stories.js
│   ├── thumbnails.js
│   ├── grammar.js
│   ├── reader.js
│   ├── interactions.js
│   ├── themes.js
│   ├── settings-panel.js
│   ├── library-manager.js
│   ├── search.js
│   └── pwa.js
├── icons/
├── thumbnails/
└── library/
```

# JavaScript file reference

## `js/firebase.js`

Loads Firebase App, Authentication, and Firestore from the official CDN and
initializes the supplied web configuration. Firebase Storage is not imported.
Change this file when moving to a separate Firebase project or updating the SDK version.

## `js/local-db.js`

IndexedDB wrapper for imported collections, imported stories, thumbnail blobs, and
deletion markers. This is the local/offline content store.

## `js/cloud-sync.js`

Firebase authentication and synchronization layer. It contains:

- email/password sign-in and sign-out;
- sync status rendering;
- user-scoped Firestore paths;
- Firestore-only story metadata synchronization;
- first-sync direction choice and conflict detection;
- local/cloud dataset fingerprints and revision tracking;
- timestamp-aware merge and deletion reconciliation;
- reader-state synchronization;
- merged GitHub, local, and cloud library rebuilding.

Provide this file together with `js/firebase.js` when changing cloud behavior.

## `js/library-manager.js`

All add/delete workflows:

- contextual management panel;
- directory and story file pickers;
- JSON format validation;
- story-size validation;
- repository thumbnail references and local-only thumbnail selection;
- delete mode;
- directory/story deletion;
- scroll-to-top button.

For UI changes, also provide `css/cloud.css` and `index.html`.

## `js/bookmarks.js`

Active reader-state module. It contains:

- local read-state storage;
- story-card read toggling;
- bookmark placement mode;
- bookmark highlighting;
- automatic bookmark scrolling;
- local/cloud reader-state merge helpers.

## `js/library.js`

Loads the built-in GitHub library, validates stories, normalizes JSON, and retains a
separate GitHub source snapshot before local/cloud content is merged.

Built-in loading order:

1. same-origin `library/manifest.json`;
2. jsDelivr file listing;
3. GitHub recursive tree API.

## `js/stories.js`

Story grouping, variants, story cards, read buttons, read sorting, and story-delete
mode integration.

## `js/directories.js`

Collection card rendering and directory-delete mode integration.

## `js/reader.js`

Story text rendering, word tokenization, translation taps/clicks, sentence grammar
gestures, bookmark dataset coordinates, and bookmark placement interception.

## `js/thumbnails.js`

Collection characters, story thumbnail rendering, relative thumbnail resolution,
and card motion. Relative story thumbnails now resolve against the story JSON file's
folder.

## `js/router.js`

Collection/reader navigation and contextual visibility of Settings and Add controls.

## `js/pwa.js`

Startup sequence:

1. load built-in GitHub stories;
2. load local IndexedDB stories and deletions;
3. show the merged local library;
4. initialize Firebase Authentication;
5. merge cloud content after sign-in.

## Existing modules

- `storage.js`: safe localStorage wrappers.
- `settings.js`: themes, appearances, fonts, defaults, and GitHub source settings.
- `app.js`: shared state and DOM references.
- `grammar.js`: grammar rendering and mobile bottom sheet.
- `interactions.js`: word popup and variant menu.
- `themes.js`: theme, font, contrast, and animation application.
- `settings-panel.js`: live settings preview and controls.
- `search.js`: restricted title/description/text/translation search and global events.

# CSS reference

`css/cloud.css` contains all Firebase, add/delete, read-state, bookmark, management
panel, and scroll-to-top styling. Existing reader, grammar, theme, and settings styles
remain in their original modules.

# Deployment notes

The app must be served through HTTPS for Firebase Authentication. GitHub Pages
satisfies this requirement. Add the GitHub Pages hostname to Firebase
Authentication's authorized domains.

No Firebase Storage bucket or Storage security rules are required. Thumbnail paths in
story JSON should point to files available from the deployed repository, for example
`thumbnails/01_story.webp` or a path relative to the story JSON file.

The Firebase web configuration is client-side by design. Never add a service-account
JSON file, Admin SDK private key, or other server credential to this repository.
