# Installation

Replace these files in the repository:

- `index.html`
- `js/cloud-sync.js`
- `js/bookmarks.js`
- `js/library-manager.js`
- `js/firebase.js`
- `css/cloud.css`

The Firestore rules are functionally the same owner-only rules already in use. The
included `firebase/firestore.rules` explicitly notes that `syncMetadata/main` is
covered by the recursive Korean Reader rule.

After deployment, hard-refresh the website. For an installed PWA, close all app
windows and reopen it; uninstall/reinstall only if an old cached JavaScript bundle
continues to load.

On the first sign-in from an existing device, review the local and Firebase counts
and choose **Merge both**, **Use Firebase**, **Use this device**, or **Cancel and
remain local**. No cloud writes occur before this choice.
