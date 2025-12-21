# KanyeGuesser Server - Production Deployment Guide

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn
- Process manager (PM2 recommended)
- Reverse proxy (nginx recommended)
- SSL certificate (Let's Encrypt recommended)

## Installation

1. **Clone and install dependencies**
```bash
cd server
npm install --production
```

2. **Configure environment**
```bash
# Copy example env file
cp .env.example .env

# Edit .env with production values
nano .env
```

**Required Environment Variables:**
```bash
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

3. **Build client (if not done)**
```bash
cd ../client
npm install
npm run build
```

## Deployment Options

### Option 1: PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start server with PM2
pm2 start src/server.js --name kanye-guesser

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

**PM2 Commands:**
```bash
pm2 status                 # Check status
pm2 logs kanye-guesser    # View logs
pm2 restart kanye-guesser # Restart
pm2 stop kanye-guesser    # Stop
pm2 delete kanye-guesser  # Remove
```

### Option 2: systemd Service

Create `/etc/systemd/system/kanye-guesser.service`:

```ini
[Unit]
Description=KanyeGuesser Game Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/kanye-guesser/server
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable kanye-guesser
sudo systemctl start kanye-guesser
sudo systemctl status kanye-guesser
```

## Nginx Configuration

Create `/etc/nginx/sites-available/kanye-guesser`:

```nginx
# HTTP - Redirect to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Client body size
    client_max_body_size 10M;

    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO specific
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # WebSocket timeouts
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/kanye-guesser /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically
# Test renewal:
sudo certbot renew --dry-run
```

## Monitoring & Logs

### PM2 Monitoring
```bash
# Real-time monitoring
pm2 monit

# Web dashboard
pm2 plus
```

### Log Files
```bash
# PM2 logs
pm2 logs kanye-guesser

# System logs (if using systemd)
sudo journalctl -u kanye-guesser -f
```

## Performance Optimization

### 1. Enable Gzip (already included via compression middleware)

### 2. Node.js Clustering (for multi-core servers)

Create `ecosystem.config.js` for PM2:
```javascript
module.exports = {
  apps: [{
    name: 'kanye-guesser',
    script: 'src/server.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

Start with: `pm2 start ecosystem.config.js`

### 3. Database (Future)
- Consider Redis for session storage
- Use PostgreSQL for persistent data

## Security Checklist

- [x] Environment variables configured
- [x] CORS restricted to your domain
- [x] Helmet security headers enabled
- [x] Rate limiting enabled
- [x] HTTPS/SSL configured
- [x] Firewall configured (allow 80, 443, deny 3000 from external)
- [ ] Regular security updates
- [ ] Monitoring and alerting
- [ ] Backup strategy

## Firewall Configuration

```bash
# UFW example
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw deny 3000   # Block direct access to Node
sudo ufw enable
```

## Health Checks

Monitor server health:
```bash
curl https://yourdomain.com/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": 1703251200000,
  "env": "production",
  "lobbies": 5,
  "players": 12
}
```

## Troubleshooting

### Server won't start
```bash
# Check logs
pm2 logs kanye-guesser --lines 100

# Check port availability
sudo lsof -i :3000
```

### WebSocket connection fails
- Verify nginx WebSocket config
- Check CORS settings
- Verify SSL certificate

### Memory issues
```bash
# Monitor memory
pm2 monit

# Set memory limit
pm2 start src/server.js --name kanye-guesser --max-memory-restart 500M
```

## Updates & Maintenance

```bash
# Pull updates
git pull origin main

# Install dependencies
npm install --production

# Rebuild client
cd ../client && npm run build && cd ../server

# Restart server
pm2 restart kanye-guesser

# Or reload (zero-downtime)
pm2 reload kanye-guesser
```

## Backup

Important files to backup:
- `/server/data/flagged-questions.json` - Flagged questions
- `/server/.env` - Environment configuration
- Question data files (if modified)

## Support

For issues, check:
1. Server logs: `pm2 logs`
2. Nginx logs: `/var/log/nginx/error.log`
3. Health endpoint: `/api/health`
