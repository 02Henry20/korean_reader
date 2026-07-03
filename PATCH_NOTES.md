# Korean Reader Firebase patch

This patch is intended for the current v9-based modular project. Replace the
matching files and add the new files in their shown directories.

## Added functionality

### Local-first storage

- Imported collections, stories, and thumbnail blobs are stored in IndexedDB.
- Read state and bookmarks are stored in localStorage.
- The app remains usable while signed out or offline.

### Firebase

- Email/password sign-in is available under **Settings → Cloud sync**.
- Imported collections and stories synchronize with Cloud Firestore.
- Read status and the single-word bookmark synchronize per story.
- Imported thumbnail files synchronize with Firebase Storage.
- A status badge reports connecting, local-only, syncing, synced, or error states.
- All data is scoped under the authenticated Firebase UID.

### Contextual library management

Main library:

- Add directory
- Delete directories

Inside a directory:

- Add story
- Delete stories

Single-story import asks whether a separate thumbnail should be selected.
Directory import automatically resolves thumbnail paths relative to each story JSON.

### Reading state

- Every story card has a read/unread check button.
- Read stories move below unread stories and receive a grey overlay.
- The reader header has a bookmark button.
- Enable bookmark placement, then select one word.
- Reopening the story restores and scrolls to that word.

### Navigation

- A floating **Top** button appears after scrolling down in a library or directory.

## Required Firebase setup

Read `FIREBASE_SETUP.md`.

The supplied Firebase project appears to be shared with another application. Merge
the `koreanReaderUsers` Firestore match block and the `korean-reader` Storage match
block into the existing rules. Do not replace the project's complete rules with the
example files.

## Validation performed

- JavaScript syntax checked for every module.
- CSS brace structure checked.
- HTML IDs checked against JavaScript DOM references.
- Duplicate HTML IDs checked.
- ZIP integrity checked.
- Core library, import, read-state, bookmark, and mocked Firebase-sync behavior were
  exercised using a browser mock during development.

Actual Firebase access still depends on enabling Authentication, Firestore, Storage,
authorized domains, and the supplied security-rule paths in your Firebase console.
