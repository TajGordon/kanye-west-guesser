# Lyrics Editor

A React + Node tool for building structured song data in JSON format for the Kanye Guesser question generator.

## Setup

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..
```

## Running

**Terminal 1: Backend**
```bash
npm run dev
```

**Terminal 2: Frontend**
```bash
cd client && npm run dev
```

Then open `http://localhost:3000` in your browser.

Or run both simultaneously (requires `concurrently`):
```bash
npm run dev:all
```

## Features

- **Create/Load Songs** – dropdown to select existing songs or create new
- **Import Lyrics** – paste raw lyrics with section headers (`[Verse 1]`, `[Chorus]`, etc.)
- **Edit Lines** – per-line content, voice, section type/number
- **Bulk Operations** – select multiple lines with shift+click, bulk-assign voice/section
- **Save to JSON** – export to `../lyrics/*.json`

## Song JSON Format

```json
{
  "title": "Song Name",
  "artist": "Kanye West",
  "release": {
    "formats": ["album"],
    "status": "official",
    "project": "Album Name",
    "year": 2023
  },
  "lyrics": [
    {
      "line_number": 1,
      "content": "Lyric text here",
      "section": {
        "type": "verse",
        "number": 1,
        "label": "[Verse 1]"
      },
      "voice": {
        "id": "kanye-west",
        "display": "Kanye West"
      },
      "meta": {}
    }
  ]
}
```

## Keyboard Shortcuts (Future)

- `Ctrl/Cmd + A` – select all lines
- `1` – set section type to verse
- `2` – set section type to chorus
- `3` – set section type to bridge
