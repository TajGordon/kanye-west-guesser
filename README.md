# KanyeGuesser

A real-time multiplayer trivia game about Kanye West's discography. Test your knowledge of Ye's music through various question types including lyrics, albums, features, and more.

## Features

- 🎮 **Multiplayer Gameplay**: Real-time WebSocket-based game sessions with lobby support
- 🎵 **9 Question Types**: Free-text, multiple-choice, ordered lists, true/false, numeric, and multi-entry questions
- ⚖️ **Weighted Question Selection**: Configurable distribution (default: 50% typing, 20% MC, 20% ordered-list, 5% T/F, 5% numeric)
- 🔍 **Advanced Filtering**: Set notation expressions for custom question pools (`input:free-text & difficulty:hard`)
- 📊 **Smart Scoring**: Multi-entry partial credit (base_points × % correct, rounded up)
- 🏷️ **Alias System**: Accept multiple variations of artist names ("Kanye" = "Ye" = "Kanye West")
- 🔒 **Production-Ready**: Security middleware, rate limiting, CORS, compression, graceful shutdown

## Quick Start

### Development

```bash
# Install all dependencies
npm run setup:all

# Terminal 1: Start backend server
npm run dev:server

# Terminal 2: Start frontend dev server
npm run dev:client
```

Visit http://localhost:5173

### Production Deployment

See detailed guides:
- [DEPLOYMENT.md](DEPLOYMENT.md) - Complete deployment instructions with nginx, PM2, SSL
- [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) - Step-by-step checklist
- [QUESTION_MANAGEMENT.md](QUESTION_MANAGEMENT.md) - Question generation and alias management

Quick production setup:

```bash
# 1. Generate questions
npm run data:regenerate

# 2. Build client
npm run build:client

# 3. Configure environment
cd server
cp .env.example .env
nano .env  # Set NODE_ENV=production, CORS_ORIGIN, PORT

# 4. Start with PM2
npm install -g pm2
pm2 start src/server.js --name kanye-guesser
pm2 save
pm2 startup
```

## Project Structure

```
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx           # Main game UI
│   │   ├── questionTypes.js  # Question rendering logic
│   │   └── components/       # UI components
│   └── package.json
│
├── server/                    # Node.js + Express + Socket.IO backend
│   ├── src/
│   │   ├── server.js         # Main entry point
│   │   ├── gameManager.js    # Round lifecycle management
│   │   ├── lobbyManager.js   # Lobby creation and settings
│   │   ├── questionStore.js  # Weighted question selection
│   │   ├── questionFilter.js # Set notation expression parser
│   │   ├── config.js         # Environment configuration
│   │   └── validation.js     # Input sanitization
│   ├── data/
│   │   └── questions/        # Generated question JSON files
│   └── package.json
│
└── song_data_generation/      # Question generation tools
    ├── lyrics/                # Source lyrics data
    ├── questions_generator/   # Generate questions from lyrics
    │   ├── index.js          # Main generator orchestrator
    │   ├── generators/       # 9 question type generators
    │   └── config.json       # Generator configuration
    └── alias_controller/      # Alias management
        ├── aliases.json      # Central alias database
        ├── apply-aliases.js  # Apply aliases to questions
        └── ui-server.js      # Web UI for alias editing
```

## Question Management

### Regenerate All Questions

```bash
# Linux/Mac
./regenerate-questions.sh

# Windows
regenerate-questions.bat

# Or using npm
npm run data:regenerate
```

This will:
1. Backup existing questions
2. Generate new questions from lyrics data
3. Apply alias database to all questions
4. Validate output

### Generate Specific Question Types

```bash
cd song_data_generation/questions_generator

# Generate only fill-in-the-blank
node index.js --type=fill-missing-word

# Generate multiple types
node index.js --type=artist-from-lyric --type=song-from-lyric

# Preview without writing
node index.js --dry-run

# Validate existing questions
node index.js --validate --strict
```

### Manage Aliases

```bash
# Launch alias management UI
npm run aliases:ui
# Open http://localhost:3001

# Apply aliases to questions
npm run aliases:apply
```

See [QUESTION_MANAGEMENT.md](QUESTION_MANAGEMENT.md) for detailed documentation.

## Configuration

### Environment Variables

Create `server/.env` from `server/.env.example`:

```env
# Server Configuration
NODE_ENV=production          # development | production
PORT=3000                    # Server port

# Security
CORS_ORIGIN=https://yourdomain.com  # Frontend origin (comma-separated for multiple)

# Rate Limiting (optional)
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX=100           # Max requests per window
```

### Question Distribution

Edit [server/src/questionStore.js](server/src/questionStore.js#L8-L16):

```javascript
const QUESTION_TYPE_WEIGHTS = {
  'free-text': 25,    // 25% free-text
  'multi-entry': 25,  // 25% multi-entry
  'multiple-choice': 20,
  'ordered-list': 20,
  'true-false': 5,
  'numeric': 5
};
```

### Lobby Filters

```javascript
// Example: Only hard typing questions
lobbySettings.questionFilter = 'input:free-text & difficulty:hard';

// Only multiple-choice about albums
lobbySettings.questionFilter = 'input:multiple-choice & category:albums';

// Exclude features questions
lobbySettings.questionFilter = '!category:features';
```

See [server/src/questionFilter.js](server/src/questionFilter.js) for full syntax.

## API Endpoints

### REST API

- `GET /api/health` - Health check
- `GET /api/tags` - List all available question tags
- `GET /api/filter/validate?expr=<expression>` - Validate filter expression
- `GET /api/filter/stats?expr=<expression>` - Get question count for filter

### WebSocket Events

**Client → Server:**
- `createLobby` - Create new game lobby
- `joinLobby` - Join existing lobby
- `startGame` - Start game (host only)
- `submitGuess` - Submit answer for current round

**Server → Client:**
- `lobbyCreated` - Lobby created successfully
- `lobbyJoined` - Joined lobby
- `gameState` - Current game state update
- `roundStart` - New round started
- `roundEnd` - Round ended with results
- `gameOver` - Game finished

## Technology Stack

**Backend:**
- Node.js 18+ with ES Modules
- Express 5.1.0 - HTTP server
- Socket.IO 4.8.1 - Real-time WebSocket communication
- helmet 8.1.0 - Security headers
- express-rate-limit 7.5.1 - Rate limiting
- compression 1.8.1 - Response compression
- dotenv 16.6.1 - Environment configuration

**Frontend:**
- React 18.3.1
- Vite 6.0.5 - Build tool
- Socket.IO Client 4.8.1
- Tailwind CSS

## Security Features

- ✅ Helmet security headers
- ✅ CORS restrictions (configurable origins)
- ✅ Rate limiting on API endpoints
- ✅ Input sanitization for user guesses
- ✅ Graceful shutdown handling
- ✅ Error handling middleware
- ✅ No hardcoded credentials
- ✅ Environment-based configuration

## Development

### Running Tests

```bash
# Test question distribution
node test_reprocess.js

# Test filtering
cd server
node -e "
import('./src/questionFilter.js').then(m => {
  const result = m.evaluateExpression('input:free-text & difficulty:hard');
  console.log('Matching questions:', result.size);
});
"
```

### Adding New Question Types

1. Create generator in `song_data_generation/questions_generator/generators/`
2. Add to `GENERATORS` object in `questions_generator/index.js`
3. Add weight to `QUESTION_TYPE_WEIGHTS` in `server/src/questionStore.js`
4. Add rendering logic to `client/src/questionTypes.js`

### Debugging

```bash
# Server logs
pm2 logs kanye-guesser

# Live monitoring
pm2 monit

# Check errors
pm2 logs kanye-guesser --err
```

## Performance

- **Question Loading**: ~100-200ms for 98,209 questions at startup
- **Memory Usage**: ~150-250MB per process
- **Filtering**: O(n) set operations, <10ms for most queries
- **Concurrent Users**: Tested with 50+ simultaneous players
- **WebSocket Latency**: <50ms on local network

## Roadmap

- [ ] User accounts and persistent stats
- [ ] Leaderboards
- [ ] Custom game modes (speed rounds, elimination)
- [ ] Question difficulty adjustment based on player performance
- [ ] Mobile app (React Native)
- [ ] Spotify integration for audio clips
- [ ] Tournament mode
- [ ] Question reporting system
- [ ] Redis for multi-instance state sharing

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test locally (`npm run dev:server` + `npm run dev:client`)
5. Commit with clear message (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open Pull Request

## License

MIT License - See [LICENSE](LICENSE) file

## Credits

Inspired by [Popsauce](https://popsauce.com) - the greatest music trivia game ever made

Question data sourced from Kanye West's official discography.

---

**Made with 🌊 for Ye fans**