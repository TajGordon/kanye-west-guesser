#!/bin/bash
# ================================================================
#  RUN ON YOUR SERVER (Linux Production Server)
# ================================================================
#  This script deploys and runs the game server.
#  DO NOT run question generation on the server!
#  
#  Prerequisites:
#    - Questions already generated on your PC
#    - Code pushed to git
#    - Node.js 18+ installed
#    - PM2 installed (npm install -g pm2)
#  
#  What it does:
#    1. Pulls latest code from git
#    2. Installs production dependencies
#    3. Builds client
#    4. Starts/restarts server with PM2
# ================================================================

set -e  # Exit on error

echo ""
echo "================================================================"
echo " KANYE GUESSER - SERVER DEPLOYMENT SCRIPT"
echo "================================================================"
echo " This deploys the server (NOT for generating questions!)"
echo "================================================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ ERROR: Must run from KanyeGuesser root directory"
    echo "Current directory: $(pwd)"
    exit 1
fi

# Check if questions exist
if [ ! -d "server/data/questions" ] || [ -z "$(ls -A server/data/questions/*.json 2>/dev/null)" ]; then
    echo "❌ ERROR: No question files found!"
    echo ""
    echo "Questions must be generated on your PC first:"
    echo "  1. On your PC (Windows), run: run_on_pc.bat"
    echo "  2. Commit and push: git add server/data/questions/ && git push"
    echo "  3. Then run this script on the server"
    exit 1
fi

# Pull latest code
echo "[1/6] Pulling latest code from git..."
git pull origin main || {
    echo "⚠️  Warning: git pull failed. Continuing with existing code..."
}

# Decompress questions
echo ""
echo "[2/6] Decompressing question data..."
cd server/data

# Check for compressed archive
if [ -f "questions-data.tar.gz" ]; then
    echo "  Found: questions-data.tar.gz"
    
    # Backup existing questions if any
    if [ -d "questions" ]; then
        BACKUP_NAME="questions-backup-$(date +%Y%m%d-%H%M%S)"
        echo "  Backing up existing questions to $BACKUP_NAME"
        mv questions "$BACKUP_NAME"
    fi
    
    # Extract
    echo "  Extracting questions..."
    tar -xzf questions-data.tar.gz
    echo "  ✅ Questions extracted"
    
elif [ -f "questions-data.zip" ]; then
    echo "  Found: questions-data.zip"
    
    # Backup existing questions if any
    if [ -d "questions" ]; then
        BACKUP_NAME="questions-backup-$(date +%Y%m%d-%H%M%S)"
        echo "  Backing up existing questions to $BACKUP_NAME"
        mv questions "$BACKUP_NAME"
    fi
    
    # Extract
    echo "  Extracting questions..."
    unzip -q questions-data.zip
    echo "  ✅ Questions extracted"
    
else
    echo "  ⚠️  No compressed archive found (questions-data.tar.gz or questions-data.zip)"
    
    # Check if questions directory exists
    if [ ! -d "questions" ] || [ -z "$(ls -A questions/*.json 2>/dev/null)" ]; then
        echo "  ❌ ERROR: No question files found!"
        echo ""
        echo "  Questions must be generated on your PC first:"
        echo "    1. On your PC (Windows), run: run_on_pc.bat"
        echo "    2. Commit compressed file: git add server/data/questions-data.* && git push"
        echo "    3. Then run this script on the server"
        cd ../..
        exit 1
    else
        echo "  Using existing questions directory"
    fi
fi

cd ../..

# Install server dependencies (production only)
echo ""
echo "[3/6] Installing server dependencies..."
cd server
npm install --production
if [ $? -ne 0 ]; then
    echo "❌ ERROR: Failed to install server dependencies"
    exit 1
fi
cd ..

# Build client
echo ""
echo "[4/6] Building client..."
cd client
npm install
npm run build
if [ $? -ne 0 ]; then
    echo "❌ ERROR: Failed to build client"
    exit 1
fi
cd ..

# Check for .env file
echo ""
echo "[5/6] Checking configuration..."
if [ ! -f "server/.env" ]; then
    echo "⚠️  WARNING: No .env file found!"
    echo ""
    echo "Creating .env from template..."
    cp server/.env.example server/.env
    echo ""
    echo "⚠️  IMPORTANT: Edit server/.env and set:"
    echo "  - NODE_ENV=production"
    echo "  - CORS_ORIGIN=https://yourdomain.com"
    echo "  - PORT=3000 (or your preferred port)"
    echo ""
    read -p "Press Enter after editing .env file..."
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "⚠️  WARNING: PM2 not found. Installing PM2..."
    npm install -g pm2
fi

# Start/restart server with PM2
echo ""
echo "[6/6] Starting server with PM2..."
cd server

# Check if already running
if pm2 describe kanye-guesser > /dev/null 2>&1; then
    echo "Server is already running. Restarting..."
    pm2 restart kanye-guesser
else
    echo "Starting server for the first time..."
    pm2 start src/server.js --name kanye-guesser
    pm2 save
fi

cd ..

# Display status
echo ""
echo "================================================================"
echo " SUCCESS! Server deployed and running"
echo "================================================================"
echo ""
echo "Server status:"
pm2 status

echo ""
echo "View logs:"
echo "  pm2 logs kanye-guesser"
echo ""
echo "Stop server:"
echo "  pm2 stop kanye-guesser"
echo ""
echo "Restart server:"
echo "  pm2 restart kanye-guesser"
echo ""

# Count questions
QUESTION_COUNT=$(cat server/data/questions/*.json 2>/dev/null | grep -c '"id"' || echo "0")
echo "Questions loaded: $QUESTION_COUNT"
echo ""

# Test health endpoint
echo "Testing server health..."
sleep 2
PORT=$(grep "^PORT=" server/.env 2>/dev/null | cut -d'=' -f2)
PORT=${PORT:-3000}

if curl -s "http://localhost:$PORT/api/health" > /dev/null; then
    echo "✅ Server is healthy and responding!"
else
    echo "⚠️  Server may not be responding yet. Check logs:"
    echo "   pm2 logs kanye-guesser"
fi

echo ""
echo "================================================================"
echo " NEXT STEPS:"
echo "================================================================"
echo " 1. Set up nginx reverse proxy (see DEPLOYMENT.md)"
echo " 2. Configure SSL certificate"
echo " 3. Open firewall ports"
echo " 4. Test from browser: http://your-server-ip:$PORT"
echo "================================================================"
