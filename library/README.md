# Library folder

Place collection metadata and story JSON files in this directory.

The app first tries to load these files from the deployed website itself. If they are unavailable there, it falls back to the public GitHub repository configured in `js/settings.js` through jsDelivr and GitHub raw URLs.

For deterministic static deployment, optionally add `manifest.json`:

```json
{
  "files": [
    "collection_name/info.json",
    "collection_name/01_story.json"
  ]
}
```

For story, word, grammar, variant, thumbnail, and preferred-font fields, see `../docs/STORY_JSON_SCHEMA.md`.
