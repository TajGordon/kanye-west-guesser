#!/bin/bash
# regenerate-questions.sh
# Complete question data regeneration workflow

set -e  # Exit on error

echo "🎵 KanyeGuesser Question Regeneration"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "song_data_generation" ]; then
    echo "❌ Error: Must run from KanyeGuesser root directory"
    exit 1
fi

# Check dependencies are installed
echo "📦 Checking dependencies..."
if [ ! -d "song_data_generation/questions_generator/node_modules" ]; then
    echo "  Installing question generator dependencies..."
    cd song_data_generation/questions_generator
    npm install
    cd ../..
fi

if [ ! -d "song_data_generation/alias_controller/node_modules" ]; then
    echo "  Installing alias controller dependencies..."
    cd song_data_generation/alias_controller
    npm install
    cd ../..
fi

# Backup existing questions
echo ""
echo "💾 Backing up existing questions..."
BACKUP_DIR="server/data/questions-backup-$(date +%Y%m%d-%H%M%S)"
if [ -d "server/data/questions" ]; then
    cp -r server/data/questions "$BACKUP_DIR"
    echo "  ✅ Backup created: $BACKUP_DIR"
else
    echo "  ⚠️  No existing questions to backup"
fi

# Generate questions
echo ""
echo "📝 Generating questions..."
cd song_data_generation/questions_generator
node index.js --validate --strict
QUESTIONS_EXIT_CODE=$?
cd ../..

if [ $QUESTIONS_EXIT_CODE -ne 0 ]; then
    echo "❌ Question generation failed!"
    exit 1
fi

# Apply aliases
echo ""
echo "🏷️  Applying aliases..."
cd song_data_generation/alias_controller
node apply-aliases.js
ALIASES_EXIT_CODE=$?
cd ../..

if [ $ALIASES_EXIT_CODE -ne 0 ]; then
    echo "❌ Alias application failed!"
    exit 1
fi

# Statistics
echo ""
echo "📊 Statistics:"
QUESTION_FILES=$(find server/data/questions -name "*.json" 2>/dev/null | wc -l)
echo "  - Question files: $QUESTION_FILES"

if command -v jq &> /dev/null; then
    TOTAL_QUESTIONS=$(cat server/data/questions/*.json 2>/dev/null | jq -s '[.[] | length] | add' 2>/dev/null || echo "unknown")
    echo "  - Total questions: $TOTAL_QUESTIONS"
fi

echo ""
echo "✅ Question regeneration complete!"
echo ""
echo "Next steps:"
echo "  1. Test locally: cd server && npm start"
echo "  2. Review changes: git diff server/data/questions/"
echo "  3. Deploy: git commit -am 'Update questions' && git push"
echo ""
echo "Backup location: $BACKUP_DIR"
