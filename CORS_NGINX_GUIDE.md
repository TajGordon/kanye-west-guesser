# CORS and Nginx Setup Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                          INTERNET                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                   https://yourdomain.com
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    NGINX (Port 80/443)                       │
│  - Handles SSL/HTTPS                                         │
│  - Serves static files (client build)                        │
│  - Reverse proxy to Node.js                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                  localhost:3000
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              NODE.JS SERVER (localhost:3000)                 │
│  - Game logic                                                │
│  - Socket.IO WebSockets                                      │
│  - API endpoints                                             │
│  - Only accessible via nginx (not exposed to internet)       │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Scenarios

### Scenario 1: Frontend and Backend on Same Domain (RECOMMENDED)

**Example:** https://kanyeguesser.com

**Setup:**
- nginx serves React build at `/`
- nginx proxies API/WebSocket to Node.js at `/api` and `/socket.io`

**Nginx config:**
```nginx
server {
    listen 443 ssl http2;
    server_name kanyeguesser.com;

    # Serve frontend (React build)
    root /var/www/kanye-guesser/client/dist;
    index index.html;

    # Frontend routes (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        # ... other proxy headers
    }

    # Backend WebSocket
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        # ... other proxy headers
    }
}
```

**Environment (.env):**
```env
NODE_ENV=production
PORT=3000
HOST=localhost
CORS_ORIGIN=https://kanyeguesser.com
```

**Why this works:**
- Same origin = No CORS issues!
- Frontend at `https://kanyeguesser.com`
- Backend at `https://kanyeguesser.com/api` and `https://kanyeguesser.com/socket.io`

---

### Scenario 2: Frontend and Backend on Different Subdomains

**Example:** 
- Frontend: https://app.kanyeguesser.com
- Backend: https://api.kanyeguesser.com

**Setup:**
- Two nginx server blocks (one for each subdomain)
- CORS properly configured

**Nginx config for backend:**
```nginx
server {
    listen 443 ssl http2;
    server_name api.kanyeguesser.com;

    location / {
        proxy_pass http://localhost:3000;
        # ... proxy headers
    }
}
```

**Nginx config for frontend:**
```nginx
server {
    listen 443 ssl http2;
    server_name app.kanyeguesser.com;

    root /var/www/kanye-guesser/client/dist;
    # ... serve React build
}
```

**Environment (.env):**
```env
NODE_ENV=production
PORT=3000
HOST=localhost
CORS_ORIGIN=https://app.kanyeguesser.com
```

**Why you need CORS:**
- Different origins (app.* vs api.*)
- Browser enforces CORS policy
- Must explicitly allow app.kanyeguesser.com

---

### Scenario 3: Separate Frontend Server (CDN)

**Example:**
- Frontend: https://kanyeguesser.netlify.app (hosted on Netlify/Vercel)
- Backend: https://api.yourvps.com (your VPS)

**Environment (.env):**
```env
NODE_ENV=production
PORT=3000
HOST=localhost
CORS_ORIGIN=https://kanyeguesser.netlify.app
```

---

## Common Configurations

### Development (Local)
```env
NODE_ENV=development
PORT=3000
HOST=localhost
CORS_ORIGIN=http://localhost:5173
```

Frontend runs on Vite dev server (port 5173), backend on port 3000.

### Production - Same Domain
```env
NODE_ENV=production
PORT=3000
HOST=localhost
CORS_ORIGIN=https://yourdomain.com
```

### Production - Multiple Origins
```env
NODE_ENV=production
PORT=3000
HOST=localhost
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

---

## Why HOST=localhost in Production?

**Security!** When using nginx:

```env
HOST=localhost    # ✅ GOOD - Only nginx can reach it
HOST=0.0.0.0      # ❌ BAD - Exposed to internet, bypasses nginx
```

With `HOST=localhost`:
- Node.js only listens on 127.0.0.1
- Only processes on the same machine can connect
- nginx proxies external traffic to localhost:3000
- Direct connections to :3000 from internet are blocked

---

## CORS vs nginx - What's the Difference?

### nginx Reverse Proxy
- **Purpose:** Route traffic from internet to Node.js
- **Function:** HTTP/HTTPS forwarding, SSL termination, load balancing
- **Level:** Network/transport layer

### CORS (Cross-Origin Resource Sharing)
- **Purpose:** Browser security to prevent unauthorized cross-origin requests
- **Function:** Tells browser which origins are allowed to make requests
- **Level:** Application layer (HTTP headers)

### Both Work Together

```
Browser → nginx → Node.js
         ↑        ↑
         |        |
    Handles SSL   Handles CORS
    Proxies req   Returns headers
```

**Example flow:**
1. Browser at `https://yourdomain.com` makes request
2. nginx receives on port 443, forwards to localhost:3000
3. Node.js checks CORS_ORIGIN, sees `https://yourdomain.com` is allowed
4. Node.js adds CORS headers to response
5. nginx forwards response back to browser
6. Browser sees CORS headers and allows the request

---

## Quick Setup Checklist

### On Your VPS:

1. **Install nginx:**
   ```bash
   sudo apt update
   sudo apt install nginx
   ```

2. **Configure nginx** (see DEPLOYMENT.md)

3. **Set up SSL:**
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

4. **Configure Node.js .env:**
   ```bash
   cd /path/to/kanye-guesser/server
   nano .env
   ```
   Set:
   ```env
   NODE_ENV=production
   HOST=localhost
   PORT=3000
   CORS_ORIGIN=https://yourdomain.com
   ```

5. **Start Node.js with PM2:**
   ```bash
   pm2 start src/server.js --name kanye-guesser
   ```

6. **Test:**
   ```bash
   # Should work (through nginx)
   curl https://yourdomain.com/api/health
   
   # Should fail (direct access blocked)
   curl http://yourserver:3000/api/health
   ```

---

## Troubleshooting

### "CORS error" in browser console

**Problem:** Node.js CORS_ORIGIN doesn't match frontend domain

**Solution:**
```bash
# Check what domain browser is on
# In browser console: console.log(window.location.origin)
# Example output: "https://yourdomain.com"

# Set that in .env
CORS_ORIGIN=https://yourdomain.com

# Restart server
pm2 restart kanye-guesser
```

### "Connection refused" error

**Problem:** nginx can't reach Node.js

**Check:**
```bash
# Is Node.js running?
pm2 status

# Is it listening on correct port?
curl http://localhost:3000/api/health

# Check nginx config
sudo nginx -t
```

### WebSocket connection fails

**Problem:** nginx WebSocket proxy not configured

**Solution:** Add to nginx config:
```nginx
location /socket.io {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

---

## Summary

**For production, use this setup:**

1. ✅ **nginx** as reverse proxy (handles SSL, serves static files)
2. ✅ **Node.js** on `localhost:3000` (not exposed to internet)
3. ✅ **CORS_ORIGIN** set to your frontend domain
4. ✅ **Firewall** blocks direct access to port 3000

**Don't:**
- ❌ Expose Node.js directly to internet (HOST=0.0.0.0)
- ❌ Use CORS_ORIGIN=* in production
- ❌ Run without nginx (no SSL, security issues)

**The setup in DEPLOYMENT.md is already correct!** Just follow it and set your CORS_ORIGIN to match your domain.
