# Firebase setup for Korean Reader

The app uses the Firebase project configured in `js/firebase.js`.

## 1. Enable email/password sign-in

In the Firebase console:

1. Open **Authentication**.
2. Open **Sign-in method**.
3. Enable **Email/Password**.
4. Create the account you want to use, or add it from the **Users** tab.
5. Under Authentication settings, add the deployed domain as an authorized domain:
   `02henry20.github.io`.

The application does not offer public account registration. It only signs in an
account that already exists in Firebase Authentication.

## 2. Create Cloud Firestore

Create the default Cloud Firestore database if it does not exist.

The Firebase project name suggests it may also serve your weight tracker. Do not
replace its existing Firestore rules. Merge the `koreanReaderUsers` match block from
`firebase/firestore.rules.example` into the existing Firestore **Rules** tab. The
block only allows an authenticated user to access that user's Korean Reader documents under:

```text
koreanReaderUsers/<firebase-uid>/...
```

## 3. Enable Cloud Storage

Create the default Storage bucket. Merge the `korean-reader` match block from
`firebase/storage.rules.example` into the existing Storage **Rules** tab rather than
replacing rules used by the weight tracker.

Thumbnails are stored under:

```text
korean-reader/<firebase-uid>/thumbnails/<collection>/<story>/...
```

Only authenticated image uploads smaller than 5 MiB are accepted.

Firebase currently requires the Blaze plan for newly provisioned Cloud Storage
buckets. The rest of the reader still works locally when thumbnail upload is not
available.

## 4. Deploying merged rules

After merging the Korean Reader match blocks into your existing project rules, deploy
the combined rules using the same Firebase CLI configuration you already use for the
weight tracker. Do not deploy the example files unchanged unless this Firebase project
has no other Firestore or Storage data.

## 5. Verify the app

1. Open Korean Reader.
2. Open **Settings → Cloud sync**.
3. Sign in with the Firebase email and password.
4. The status should change from **Local only** to **Synced**.
5. Import a test story and confirm documents appear below
   `koreanReaderUsers/<uid>/libraryStories` in Firestore.

## Data layout

```text
koreanReaderUsers/<uid>/libraryCollections/<collection-id>
koreanReaderUsers/<uid>/libraryStories/<story-id>
koreanReaderUsers/<uid>/readerState/<story-id>
koreanReaderUsers/<uid>/libraryDeletions/<kind:id>
```

The Firebase web API configuration is intentionally present in client-side code.
Security comes from Authentication and the rule files, not from hiding the web API
key. Never put an Admin SDK private key or service-account JSON in this repository.
