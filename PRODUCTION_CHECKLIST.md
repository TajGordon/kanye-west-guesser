# Production Readiness Checklist

## ✅ Completed

### Configuration
- [x] Environment variables (.env) configured
- [x] Config module with validation
- [x] Production vs development mode differentiation
- [x] Port configuration via environment variable
- [x] CORS properly configured (not wildcard in production)

### Security
- [x] Helmet middleware for security headers
- [x] Rate limiting on API endpoints
- [x] CORS restricted to specific origins
- [x] Input sanitization for user guesses
- [x] Socket.IO authentication via player system

### Performance
- [x] Compression middleware
- [x] Static file serving optimized
- [x] Graceful shutdown handlers
- [x] Error handling middleware
- [x] Memory cleanup (lobby cleanup intervals)

### Monitoring
- [x] Health check endpoint (`/api/health`)
- [x] Structured logging ready
- [x] Process error handlers (uncaughtException, unhandledRejection)

### Code Quality
- [x] ES modules throughout
- [x] Consistent error handling
- [x] Question filtering system
- [x] Weighted question distribution

## ⚠️ Recommended Before Production

### Infrastructure
- [ ] Install dependencies: `npm install` in server directory
- [ ] Set up reverse proxy (nginx/Apache)
- [ ] Configure SSL certificate (Let's Encrypt)
- [ ] Set up process manager (PM2/systemd)
- [ ] Configure firewall rules

### Configuration
- [ ] Create `.env` file from `.env.example`
- [ ] Set `NODE_ENV=production`
- [ ] Set `CORS_ORIGIN` to your actual domain(s)
- [ ] Configure `PORT` if not using 3000
- [ ] Review rate limit settings

### Testing
- [ ] Test with production build of client
- [ ] Load test with expected concurrent users
- [ ] Test WebSocket connections through proxy
- [ ] Test CORS from production domain
- [ ] Verify health check endpoint works

### Question Data
- [ ] Generate/update questions (see [QUESTION_MANAGEMENT.md](QUESTION_MANAGEMENT.md))
- [ ] Apply latest aliases to questions
- [ ] Validate generated questions with `--strict` flag
- [ ] Backup existing question data before regenerating
- [ ] Verify question count matches expectations

### Monitoring & Logging
- [ ] Set up logging service (optional: winston, pino)
- [ ] Configure log rotation
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom)
- [ ] Configure alerts for downtime
- [ ] Set up error tracking (optional: Sentry)

### Database (Future)
- [ ] Consider Redis for session/lobby persistence
- [ ] Consider PostgreSQL for user data
- [ ] Set up database backups

### Documentation
- [ ] Document API endpoints
- [ ] Document deployment process
- [ ] Create runbook for common issues
- [ ] Document backup/restore procedures

## 🔧 Installation Commands

```bash
# 0. Generate questions (if needed)
cd song_data_generation/questions_generator
npm install
node index.js --validate --strict
cd ../alias_controller
npm install
node apply-aliases.js
cd ../..

# 1. Install production dependencies
cd server
npm install --production

# 2. Copy and configure environment
cp .env.example .env
nano .env  # Edit with your values

# 3. Build client
cd ../client
npm install
npm run build

# 4. Test locally with production settings
cd ../server
NODE_ENV=production npm start

# 5. Install PM2 (recommended)
npm install -g pm2

# 6. Start with PM2
pm2 start src/server.js --name kanye-guesser

# 7. Save PM2 config
pm2 save

# 8. Setup PM2 startup
pm2 startup
```

## 🚀 Quick Deploy Script

Save as `deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Deploying KanyeGuesser..."

# Pull latest code
git pull origin main

# Regenerate questions (optional - only if lyrics/aliases changed)
# Uncomment to enable:
# echo "📝 Regenerating questions..."
# cd song_data_generation/questions_generator
# node index.js --validate --strict
# cd ../alias_controller
# node apply-aliases.js
# cd ../..

# Install server dependencies
cd server
npm install --production

# Build client
cd ../client
npm install
npm run build

# Restart server
cd ../server
pm2 restart kanye-guesser

echo "✅ Deployment complete!"
```

Make executable: `chmod +x deploy.sh`

## 📊 Post-Deploy Verification

```bash
# 1. Check server is running
pm2 status

# 2. Check logs
pm2 logs kanye-guesser --lines 50

# 3. Test health endpoint
curl https://yourdomain.com/api/health

# 4. Verify questions loaded
curl https://yourdomain.com/api/tags | jq
curl https://yourdomain.com/api/filter/validate?expr=input:free-text

# 5. Test WebSocket (browser console)
const socket = io('wss://yourdomain.com');
socket.on('connect', () => console.log('Connected!'));

# 6. Monitor memory/CPU
pm2 monit
```

## 🔒 Security Hardening

### Additional Steps
1. **Rate Limiting**: Already implemented, adjust limits if needed
2. **DDoS Protection**: Use Cloudflare or similar
3. **Firewall**: Configure UFW/iptables
4. **Regular Updates**: `npm audit` and update dependencies
5. **Secrets Management**: Use proper secrets manager in production
6. **Backups**: Set up automated backups
7. **Monitoring**: Set up alerts for unusual activity

### Firewall Rules
```bash
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw deny 3000   # Block direct Node access
sudo ufw enable
```

## 📈 Scaling Considerations

When you need to scale:

1. **Horizontal Scaling**: Use PM2 cluster mode
   ```bash
   pm2 start src/server.js -i max
   ```

2. **Load Balancer**: Add nginx load balancing for multiple instances

3. **State Management**: Move to Redis for shared state across instances

4. **Database**: Add PostgreSQL for persistent data

5. **CDN**: Use CDN for static assets

## ⚡ Performance Targets

- Response time: < 100ms for API calls
- WebSocket latency: < 50ms
- Concurrent users: 1000+ (with clustering)
- Memory per instance: < 512MB
- CPU usage: < 70% under normal load

## 🐛 Common Issues

1. **Port already in use**: Change PORT in .env
2. **CORS errors**: Check CORS_ORIGIN in .env
3. **WebSocket fails**: Verify nginx WebSocket config
4. **Memory leaks**: Monitor with `pm2 monit`, check cleanup intervals
5. **Slow response**: Enable compression, add caching

## 📞 Support Contacts

- Server issues: Check logs at `pm2 logs kanye-guesser`
- Client issues: Check browser console
- Network issues: Check nginx logs
- Database issues: Check connection strings
