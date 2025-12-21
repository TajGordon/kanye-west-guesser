# Which Script Do I Run?

## 🖥️ On Your PC (Windows Development Machine)

### `run_on_pc.bat` ⬅️ **RUN THIS ON YOUR PC**

**What it does:**
- Generates question JSON files from lyrics
- Applies aliases to questions
- Creates backup of old questions
- Requires ~768MB RAM

**When to run:**
- Before first deployment
- After adding new songs/lyrics
- After updating aliases
- Monthly/quarterly content updates

**Output:**
- Files in `server/data/questions/*.json` (NOT committed to git - too large)
- Compressed archive `server/data/questions-data.tar.gz` (THIS gets committed)

**Command:**
```cmd
run_on_pc.bat
```

---

## 🔧 If You Accidentally Committed Large Files

### `fix_git.bat` ⬅️ **FIX GIT MISTAKES**

**What it does:**
- Removes large `.json` files from git history
- Keeps files locally (doesn't delete them)
- Updates .gitignore
- Prepares for committing compressed archive instead

**When to run:**
- Git rejects your push (files >100MB)
- You committed `server/data/questions/*.json` by mistake

**Command:**
```cmd
fix_git.bat
```

Then run `run_on_pc.bat` to create the compressed archive.

---

## 🖥️ On Your Server (Linux Production Server)

### `run_on_server.sh` ⬅️ **RUN THIS ON YOUR SERVER**

**What it does:**
- Pulls latest code from git (including pre-generated questions)
- Installs production dependencies
- Builds client
- Starts server with PM2
- Only needs ~100-200MB RAM

**When to run:**
- First time setup
- Every deployment
- After code changes
- After question updates

**Prerequisites:**
- Questions already generated on PC
- Code pushed to git
- Node.js 18+ installed
- PM2 installed

**Command:**
```bash
bash run_on_server.sh
```

---

## 📋 Complete Workflow

### Initial Setup (First Time Ever)

**On your PC:**
```cmd
# 1. Generate and compress questions
run_on_pc.bat

# 2. Commit compressed archive to git
git add server/data/questions-data.*
git commit -m "Initial questions"
git push
```

**On your server:**
```bash
# 3. Clone repository
git clone https://github.com/yourusername/kanye-guesser.git
cd kanye-guesser

# 4. Make script executable
chmod +x run_on_server.sh

# 5. Deploy and run
bash run_on_server.sh
```

---

### Regular Code Updates (No Question Changes)

**On your PC:**
```cmd
# Make code changes, then:
git add .
git commit -m "Fix bug in game logic"
git push
```

**On your server:**
```bash
# Just redeploy:
bash run_on_server.sh
```

---

### Content Updates (New Songs/Questions)

**On your PC:**
```cmd
# 1. Add lyrics to song_data_generation/lyrics/
# 2. Regenerate and compress questions
run_on_pc.bat

# 3. Commit and push compressed archive
git add server/data/questions-data.*
git add song_data_generation/lyrics/
git commit -m "Add Donda 2 questions"
git push
```

**On your server:**
```bash
# Redeploy with new questions:
bash run_on_server.sh
```

---

## ❌ Common Mistakes

### ❌ DON'T run question generation on the server
```bash
# ❌ WRONG - Don't do this on server!
cd song_data_generation/questions_generator
node index.js
# This requires 768MB+ RAM and takes 1-2 minutes
```

### ❌ DON'T deploy without generating questions first
```bash
# ❌ WRONG - Server won't have question files!
git push  # (without running run_on_pc.bat first)
bash run_on_server.sh  # Will fail - no questions!
```

### ❌ DON'T commit node_modules
```bash
# ❌ WRONG - These are auto-installed
git add song_data_generation/questions_generator/node_modules/
# .gitignore should already exclude these
```

---

## ✅ Quick Reference

| Task | Where | Script |
|------|-------|--------|
| Generate questions | Your PC | `run_on_pc.bat` |
| Fix git (remove large files) | Your PC | `fix_git.bat` |
| Deploy server | Your Server | `run_on_server.sh` |
| Update questions | Your PC | `run_on_pc.bat` → git push |
| Update code | Your PC | git push (no script needed) |
| Restart server | Your Server | `pm2 restart kanye-guesser` |
| View logs | Your Server | `pm2 logs kanye-guesser` |

---

## 🆘 Troubleshooting

### "Out of memory" when running `run_on_pc.bat`
**Solution:** Generate one type at a time:
```cmd
cd song_data_generation\questions_generator
node --max-old-space-size=512 index.js --type=fill-missing-word
node --max-old-space-size=512 index.js --type=song-from-lyric
node --max-old-space-size=512 index.js --type=album-from-song
REM etc...
```

### "No question files found" when running `run_on_server.sh`
**Solution:** You forgot to generate and commit compressed archive on your PC first!
```cmd
# On your PC:
run_on_pc.bat
git add server/data/questions-data.*
git commit -m "Add question data"
git push

# Then on server:
bash run_on_server.sh
```

### Git rejects push - "file size exceeds 100MB"
**Solution:** You committed raw JSON files instead of compressed archive!
```cmd
# On your PC:
fix_git.bat                    # Remove large files from git
run_on_pc.bat                  # Generate compressed archive
git add server/data/questions-data.*
git commit -m "Add compressed question data"
git push --force origin main   # Force push (only if repo is yours alone!)
```

### Server won't start
**Solution:** Check the logs:
```bash
pm2 logs kanye-guesser --lines 50
```

Common issues:
- Missing `.env` file → Edit `server/.env`
- Port already in use → Change PORT in `.env`
- Questions not loaded → Run `run_on_pc.bat` on your PC first

---

## 💡 Remember

**Your PC = Question Factory 🏭**
- Generates questions
- Commits them to git

**Your Server = Game Host 🎮**
- Loads pre-made questions
- Serves the game to players

Think of it like:
- PC = Compiler
- Server = Runtime

You compile code on your PC, then run the compiled program on the server!
