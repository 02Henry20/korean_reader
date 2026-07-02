# Korean Reader

Korean Reader is a static web application for reading Korean stories with built-in learning support. Stories are organized into collections and loaded from JSON files stored in the repository's `library/` directory.

The project is designed for Korean learners who want readable stories together with sentence translations, grammar explanations, vocabulary notes, and quick word lookups.

## Features

- Story collections loaded from `library/`
- Korean stories with sentence-by-sentence English translations
- Grammar explanations and vocabulary notes
- Double-click or double-tap word translations
- Multiple TOPIK-level versions of the same story
- Story thumbnails stored as external image files
- JSON-defined story and collection accent colors
- Light, Warm, Forest, and Dark appearance themes
- Responsive layout for desktop and mobile
- Home-screen icon and standalone app-style display
- No database, framework, package manager, or build process

## Project structure

```text
korean_reader/
├── index.html
├── site.webmanifest
├── README.md
├── icons/
│   ├── apple-touch-icon.png
│   ├── favicon.ico
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-1024.png
├── library/
│   ├── avatar/
│   │   ├── info.json
│   │   ├── 01_the_promise.json
│   │   └── ...
│   ├── korra/
│   │   ├── info.json
│   │   └── ...
│   └── ...
└── thumbnails/
    ├── 01_the_promise.jpg
    └── ...
```

## How the library is loaded

`index.html` reads the repository's public `library/` directory through the GitHub API. The repository configuration is defined inside the JavaScript:

```javascript
const GITHUB_LIBRARY = Object.freeze({
  owner: "02Henry20",
  repo: "korean_reader",
  branch: "main",
  root: "library"
});
```

Change these values when the repository owner, repository name, branch, or library folder changes.

Because the GitHub API is used, the repository must be public and an internet connection is required when the library is loaded.

## Collection folders

Each first-level folder inside `library/` represents a collection.

A collection can contain an `info.json` file with metadata such as:

```json
{
  "type": "collection",
  "id": "avatar-last-airbender",
  "title": "Avatar: The Last Airbender",
  "koreanTitle": "아바타: 아앙의 전설",
  "description": "Korean learning summaries of the Avatar graphic novels.",
  "level": "TOPIK 2–3",
  "theme": "sunset",
  "order": 10,
  "monogram": "四",
  "tags": ["fantasy", "adventure"]
}
```

## Story files

Stories are stored as JSON files inside their collection folder. A story normally contains:

```json
{
  "id": "avatar-the-promise",
  "collectionId": "avatar-last-airbender",
  "title": "약속",
  "englishTitle": "Avatar — The Promise",
  "level": "TOPIK 2–3",
  "description": "A Korean summary of The Promise.",
  "theme": "sunset",
  "thumbnail": "thumbnails/01_the_promise.jpg",
  "order": 1,
  "paragraphs": []
}
```

The `theme` field controls the story's accent color. The appearance selector in the website controls the overall Light, Warm, Forest, or Dark interface.

## TOPIK variants

Multiple difficulty versions can be grouped by giving them the same `variantGroupId`:

```json
{
  "id": "story-easy",
  "variantGroupId": "story-main",
  "variantLabel": "TOPIK 2",
  "difficultyOrder": 1
}
```

```json
{
  "id": "story-standard",
  "variantGroupId": "story-main",
  "variantLabel": "TOPIK 3",
  "difficultyOrder": 2
}
```

The reader then displays a version selector for that story.

## Thumbnails

Thumbnail files stay external and are not embedded into `index.html`.

For a thumbnail stored in the repository root's `thumbnails/` directory:

```json
"thumbnail": "thumbnails/01_the_promise.jpg"
```

Paths beginning with `./` or `../` are resolved relative to the story JSON file.

## GitHub Pages deployment

1. Push `index.html`, `site.webmanifest`, `icons/`, `library/`, and `thumbnails/` to the repository.
2. Open the repository on GitHub.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Select the `main` branch and the `/ (root)` folder.
6. Save the setting and wait for GitHub Pages to publish the site.

## Add to the home screen

### iPhone or iPad

1. Open the published website in Safari.
2. Tap **Share**.
3. Tap **Add to Home Screen**.
4. Remove an older home-screen shortcut first if iOS continues to display the previous icon.

The Apple icon is provided by:

```html
<link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png" />
```

### Android

1. Open the published website in Chrome.
2. Open the browser menu.
3. Choose **Add to Home screen** or **Install app**.

Android uses `site.webmanifest` together with `icon-192.png` and `icon-512.png`.

## Updating content

The website itself does not edit or delete stories. To make a permanent change:

1. Edit the appropriate JSON file.
2. Add, replace, or remove files in `library/` or `thumbnails/`.
3. Commit and push the changes to GitHub.
4. Reload the published website.

## License

No license has been selected yet. Add a `LICENSE` file before allowing redistribution or reuse by others.
