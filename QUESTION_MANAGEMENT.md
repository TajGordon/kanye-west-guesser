# Question Data Management Guide

## Overview

The game requires question data to be generated and maintained separately from the runtime server. This guide covers regenerating questions and applying aliases for production deployment.

## Directory Structure

```
song_data_generation/
├── lyrics/                      # Source lyrics files (*.json)
├── lyrics_generator/            # UI for editing lyrics
├── alias_controller/            # Alias management system
│   ├── aliases.json            # Central alias database
│   ├── apply-aliases.js        # Apply aliases to questions
│   └── ui-server.js            # Web UI for alias management
└── questions_generator/         # Question generation system
    ├── index.js                # Main generator script
    ├── config.json             # Generator configuration
    ├── generators/             # Individual question type generators
    └── utils/                  # Helper utilities
```

## Prerequisites

```bash
# Install dependencies for question generator
cd song_data_generation/questions_generator
npm install

# Install dependencies for alias controller
cd ../alias_controller
npm install
```

## Step 1: Generate Questions

### Full Regeneration

```bash
cd song_data_generation/questions_generator
node index.js
```

This will:
- Load all lyrics from `../lyrics/*.json`
- Run all enabled generators (configured in `config.json`)
- Output question files to `../../server/data/questions/`
- Validate all generated questions

### Generate Specific Question Types

```bash
# Generate only fill-in-the-blank questions
node index.js --type=fill-missing-word

# Generate multiple specific types
node index.js --type=fill-missing-word --type=artist-from-lyric

# Preview without writing (dry run)
node index.js --dry-run
```

### Available Question Types

- `fill-missing-word` - Fill in missing word from lyrics
- `song-from-lyric` - Identify song from lyric
- `album-from-song` - Identify album from song name
- `year-from-song` - Guess year from song
- `year-from-album` - Guess year from album
- `artist-from-lyric` - Identify artist/feature from lyric
- `artist-from-song` - Identify artist from song name
- `next-line` - What comes next in the lyrics
- `features-on-song` - Name all features on a song

### Configuration

Edit `questions_generator/config.json` to:
- Enable/disable specific generators
- Set output paths
- Configure question difficulty
- Adjust generation parameters

Example:
```json
{
  "generators": {
    "fill-missing-word": {
      "enabled": true,
      "difficulty": {
        "easy": 0.3,
        "medium": 0.4,
        "hard": 0.3
      }
    }
  }
}
```

## Step 2: Manage Aliases

Aliases allow multiple variations of artist names to be accepted as correct answers (e.g., "Kanye", "Ye", "Kanye West" all map to the same artist).

### View/Edit Aliases via Web UI

```bash
cd song_data_generation/alias_controller
node ui-server.js
```

Open http://localhost:3001 in your browser to:
- View all aliases
- Add new aliases
- Edit existing aliases
- Search aliases
- See usage statistics

### Apply Aliases to Questions

After editing aliases, apply them to all question files:

```bash
cd song_data_generation/alias_controller

# Preview changes
node apply-aliases.js --dry-run

# Apply to all questions
node apply-aliases.js

# Show statistics only
node apply-aliases.js --stats
```

This updates all questions in `server/data/questions/` with the latest alias information.

### Manual Alias Management

Edit `alias_controller/aliases.json` directly:

```json
{
  "artists": {
    "kanye-west": {
      "canonical": "Kanye West",
      "aliases": [
        "Kanye",
        "Ye",
        "Yeezy",
        "Mr. West",
        "Kanye Omari West"
      ]
    }
  }
}
```

Then run `node apply-aliases.js` to propagate changes.

## Step 3: Deploy Updated Questions

### Option A: Direct Copy (Simple)

```bash
# After generating questions locally:
# 1. Zip the questions directory
cd server/data
tar -czf questions-$(date +%Y%m%d).tar.gz questions/

# 2. Copy to server
scp questions-*.tar.gz user@yourserver:/path/to/server/data/

# 3. On server, backup old questions and extract
ssh user@yourserver
cd /path/to/server/data
mv questions questions-backup-$(date +%Y%m%d)
tar -xzf questions-*.tar.gz

# 4. Restart server
pm2 restart kanye-guesser
```

### Option B: Git-Based Deployment

```bash
# 1. Regenerate questions
cd song_data_generation/questions_generator
node index.js

# 2. Apply aliases
cd ../alias_controller
node apply-aliases.js

# 3. Commit and push
cd ../..
git add server/data/questions/
git commit -m "Update questions data - $(date +%Y-%m-%d)"
git push origin main

# 4. Pull on server and restart
ssh user@yourserver
cd /path/to/kanye-guesser
git pull origin main
pm2 restart kanye-guesser
```

### Option C: Automated Build Pipeline (Recommended)

Create a script `regenerate-questions.sh`:

```bash
#!/bin/bash
set -e

echo "🎵 Regenerating KanyeGuesser Questions..."

# Generate questions
cd song_data_generation/questions_generator
echo "📝 Generating questions..."
node index.js

# Apply aliases
cd ../alias_controller
echo "🏷️  Applying aliases..."
node apply-aliases.js

# Return to root
cd ../..

echo "✅ Questions regenerated successfully!"
echo "📊 Statistics:"
echo "  - Question files: $(ls server/data/questions/*.json 2>/dev/null | wc -l)"
echo "  - Total questions: $(cat server/data/questions/*.json | grep -c '"id"' || echo 0)"
```

Make executable: `chmod +x regenerate-questions.sh`

Run: `./regenerate-questions.sh`

## Validation

### Validate Generated Questions

The generator includes built-in validation:

```bash
cd song_data_generation/questions_generator
node index.js --validate --strict
```

This checks:
- Schema compliance
- Required fields
- Duplicate IDs
- Answer format
- Tag consistency

### Test Questions in Development

```bash
# Start server with generated questions
cd server
npm start

# In another terminal, test filtering
curl http://localhost:3000/api/tags
curl http://localhost:3000/api/filter/validate?expr=input:free-text
```

## Production Workflow

### Regular Updates (Monthly/Quarterly)

```bash
# 1. Update lyrics (if new songs added)
cd song_data_generation/lyrics_generator
# Use UI to add/edit lyrics

# 2. Review and update aliases
cd ../alias_controller
node ui-server.js
# Review alias suggestions, add missing aliases

# 3. Regenerate all questions
cd ../questions_generator
node index.js

# 4. Apply aliases
cd ../alias_controller
node apply-aliases.js

# 5. Validate output
cd ../questions_generator
node index.js --validate --strict

# 6. Test locally
cd ../../server
npm start
# Test in browser

# 7. Deploy (see deployment options above)
```

### Emergency Fixes (Typo, Wrong Answer)

```bash
# Quick fix in generated file
cd server/data/questions
# Edit the JSON file directly
nano artist-from-lyric.json

# Or regenerate just that type
cd ../../song_data_generation/questions_generator
node index.js --type=artist-from-lyric

# Deploy immediately
pm2 restart kanye-guesser
```

## Backup Strategy

### Before Regeneration

Always backup existing questions before regenerating:

```bash
cd server/data
cp -r questions questions-backup-$(date +%Y%m%d-%H%M%S)
```

### Automated Backups

Add to cron:

```bash
# Daily backup at 3 AM
0 3 * * * cd /path/to/kanye-guesser/server/data && \
  tar -czf ~/backups/questions-$(date +\%Y\%m\%d).tar.gz questions/ && \
  find ~/backups -name "questions-*.tar.gz" -mtime +30 -delete
```

## Troubleshooting

### "Process killed" or "Out of memory" during generation
- **Cause**: Large question datasets (80k+ questions) exceed available memory
- **Solution 1**: Scripts use `--max-old-space-size=768` (768MB limit)
- **Solution 2**: If still failing, generate one type at a time:
  ```bash
  # Generate types individually (uses less memory)
  node --max-old-space-size=512 index.js --type=fill-missing-word
  node --max-old-space-size=512 index.js --type=song-from-lyric
  node --max-old-space-size=512 index.js --type=album-from-song
  node --max-old-space-size=512 index.js --type=year-from-song
  node --max-old-space-size=512 index.js --type=year-from-album
  node --max-old-space-size=512 index.js --type=artist-from-lyric
  node --max-old-space-size=512 index.js --type=artist-from-song
  node --max-old-space-size=512 index.js --type=next-line
  node --max-old-space-size=512 index.js --type=features-on-song
  ```
- **Remember**: This is a dev/build step - production server doesn't run this!

### "No lyrics found"
- Check `song_data_generation/lyrics/*.json` exists
- Verify lyrics format matches expected schema

### "Duplicate question IDs"
- Run with `--validate` flag to see duplicates
- Each generator creates unique IDs, check for conflicts

### "Aliases not applied"
- Ensure `apply-aliases.js` ran successfully
- Check `aliases.json` is valid JSON
- Verify question files have write permissions

### "Questions not loading in game"
- Check server logs for parse errors
- Verify JSON files are valid
- Check file permissions on server
- Run `curl http://localhost:3000/api/health` to verify server

## Performance Considerations

### Generation Time

- Full regeneration: ~10-60 seconds (depends on lyrics count)
- Single type: ~2-10 seconds
- Alias application: ~1-5 seconds

### Memory Requirements

**⚠️ IMPORTANT: Question generation is a BUILD step for your DEVELOPMENT machine, NOT production server.**

- **Generator memory usage**: ~500-800MB during generation
  - Uses `--max-old-space-size=768` flag (768MB limit)
  - Does NOT chunk - loads all questions into memory at once
  - If you have <1GB RAM available, generate one type at a time:
    ```bash
    node --max-old-space-size=512 index.js --type=fill-missing-word
    node --max-old-space-size=512 index.js --type=song-from-lyric
    # etc.
    ```

- **Production server memory usage**: ~100-200MB
  - Server only LOADS pre-generated JSON files
  - Much lower memory requirement than generation
  - 1GB server is sufficient for runtime

**Workflow:**
1. Generate questions on dev machine (requires 768MB+)
2. Commit generated JSON files to git
3. Deploy to production (1GB server is fine)
4. Server loads pre-generated files (uses ~150MB)

### Output Size

- Typical question set: 50,000-100,000 questions
- File sizes: 5-50 MB per question type
- Total: ~200-500 MB for all questions

### Server Load

- Questions are loaded once at server startup
- Minimal runtime memory impact (~100-200 MB)
- No database queries during gameplay
- All filtering done in-memory with Sets

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Regenerate Questions

on:
  workflow_dispatch:
  schedule:
    - cron: '0 3 * * 0'  # Weekly on Sunday at 3 AM

jobs:
  regenerate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd song_data_generation/questions_generator
          npm ci
          cd ../alias_controller
          npm ci
      
      - name: Generate questions
        run: |
          cd song_data_generation/questions_generator
          node index.js --validate --strict
      
      - name: Apply aliases
        run: |
          cd song_data_generation/alias_controller
          node apply-aliases.js
      
      - name: Commit changes
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add server/data/questions/
          git commit -m "Auto-regenerate questions $(date +%Y-%m-%d)" || echo "No changes"
          git push
```

## Best Practices

1. **Always backup** before regenerating questions
2. **Test locally** before deploying to production
3. **Use dry-run** when applying aliases to preview changes
4. **Validate** generated questions with `--strict` flag
5. **Version control** question changes with meaningful commit messages
6. **Monitor** question quality and player feedback
7. **Review aliases** regularly for common misspellings
8. **Document** any manual changes to generated files
9. **Schedule** regular regeneration (weekly/monthly)
10. **Keep lyrics updated** as new songs are released
