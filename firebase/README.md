# Firebase Security Rules snippets

This Korean Reader uses the same Firebase project ID as the existing
`weight-track-app-e0e2c` project. Do **not** replace that project's complete rules
with these example files if the weight-tracking app already uses Firestore or
Storage.

Instead, copy only the Korean Reader `match` block from each example into the
corresponding existing rules file:

- `firestore.rules.example`: merge the `koreanReaderUsers` match block inside the
  existing Firestore `databases/.../documents` block.
- `storage.rules.example`: merge the `korean-reader` match block inside the
  existing Storage `b/{bucket}/o` block.

The Korean Reader paths are isolated from the weight tracker:

```text
Firestore: koreanReaderUsers/<uid>/...
Storage:   korean-reader/<uid>/...
```
