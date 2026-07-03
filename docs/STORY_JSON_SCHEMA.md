# Story JSON Schema Guide

This file documents the fields used by the modular Korean Reader. Existing shorter JSON files remain valid; the richer fields are optional.

## Story-level fields

```json
{
  "id": "example-story-topik-2",
  "variantGroupId": "example-story",
  "variantLabel": "TOPIK 2",
  "difficultyOrder": 1,
  "collectionId": "examples",
  "title": "먹고 싶은 날",
  "englishTitle": "A Day I Want to Eat",
  "description": "A short Korean learning story.",
  "level": "TOPIK 2",
  "author": "Author name",
  "theme": "sage",
  "preferredFont": "serif",
  "thumbnail": "thumbnails/example.jpg",
  "order": 1,
  "paragraphs": []
}
```

### `preferredFont`

Recommended values:

- `sans`
- `serif`
- `rounded`
- `mono`

A user can override the story preference globally in Settings.

## Sentence structure

```json
{
  "korean": "나는 김밥을 먹고 싶다.",
  "translation": "I want to eat gimbap.",
  "words": [],
  "vocab": [],
  "grammar": []
}
```

## Word entries

```json
{
  "surface": "먹고",
  "meaning": "eat and / part of ‘want to eat’",
  "base": "먹다",
  "note": "먹다 is the dictionary form.",
  "grammarIndex": 0
}
```

`grammarIndex` links the word to one entry in the sentence's `grammar` array. For more than one grammar entry, use:

```json
"grammarIndexes": [0, 1]
```

The app can also detect grammar words automatically when a grammar entry contains an exact `fragment`.

## Detailed grammar entry

```json
{
  "pattern": "-고 싶다",
  "fragment": "먹고 싶다",
  "baseForm": "먹다",
  "transformation": "먹다 → 먹",
  "suffix": "-고 싶다",
  "result": "먹고 싶다",
  "meaning": "to want to eat",
  "explanation": "-고 싶다 is attached to a verb stem to express the speaker's desire to perform that action.",
  "why": "The speaker is directly describing what they want to do.",
  "examples": [
    "한국에 가고 싶다. — I want to go to Korea.",
    "오늘은 쉬고 싶다. — I want to rest today."
  ],
  "limitations": "In ordinary statements it is normally used for the speaker's own desire. For another person's observed desire, -고 싶어 하다 is often used.",
  "nuance": "This is a direct and neutral expression of desire."
}
```

## Field meanings

| Field | Purpose |
|---|---|
| `pattern` | Abstract grammar pattern, such as `-고 싶다` |
| `fragment` | Exact relevant Korean fragment in the current sentence |
| `baseForm` | Dictionary form, such as `먹다` |
| `transformation` | Stem or irregular transformation |
| `suffix` | Attached grammar suffix or ending |
| `result` | Final combined form |
| `meaning` | Concise English meaning |
| `explanation` | General grammar explanation |
| `why` | Why this form is used in this specific sentence |
| `examples` | Additional Korean examples, preferably with translations |
| `limitations` | Restrictions and common errors |
| `nuance` | Register, implication, or subtle usage information |

## Fragment guidance

Use the smallest fragment that still makes the grammar understandable.

Good:

```json
"fragment": "먹고 싶다"
```

Usually too broad:

```json
"fragment": "나는 김밥을 먹고 싶다."
```

Use the full sentence only when the grammar relationship genuinely depends on the entire sentence.

## Backward-compatible aliases

The normalizer accepts several older or alternative field names:

- `base` or `dictionaryForm` → `baseForm`
- `change` → `transformation`
- `ending` → `suffix`
- `form` → `result`
- `translation` → `meaning`
- `description` → `explanation`
- `usage` or `reason` → `why`
- `note` → `nuance`
- `restrictions` → `limitations`
- `example` → one-item `examples` list
