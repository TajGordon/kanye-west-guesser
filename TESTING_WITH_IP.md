# Testing with Public IP (Before Domain Setup)

If you haven't set up your domain yet, you can test with just your server's public IP address.

## Quick Test Setup (No SSL)

### 1. Simple nginx config for IP testing

Create `/etc/nginx/sites-available/kanye-guesser-test`:

```nginx
# Simple HTTP config for testing with IP
server {
    listen 80;
    server_name _;  # Accept any hostname/IP

    # Serve frontend (React build)
    root /home/youruser/kanye-guesser/client/dist;
    index index.html;

    # Frontend routes (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend WebSocket
    location /socket.io {
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
}
```

Enable it:
```bash
sudo ln -s /etc/nginx/sites-available/kanye-guesser-test /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. Configure server .env

```bash
cd /path/to/kanye-guesser/server
nano .env
```

Set:
```env
NODE_ENV=production
PORT=3000
HOST=localhost
CORS_ORIGIN=http://YOUR_PUBLIC_IP
```

Replace `YOUR_PUBLIC_IP` with your actual IP (e.g., `http://123.45.67.89`)

### 3. Start the server

```bash
pm2 start src/server.js --name kanye-guesser
pm2 save
```

### 4. Test it

From your PC, visit:
```
http://YOUR_PUBLIC_IP
```

Example: `http://123.45.67.89`

---

## Even Simpler: No nginx (Quick Test Only)

If you just want to test quickly without nginx:

### 1. Configure .env

```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0    # ⚠️ Exposes server to internet - testing only!
CORS_ORIGIN=*    # ⚠️ Allows all origins - testing only!
```

### 2. Open firewall

```bash
sudo ufw allow 3000
```

### 3. Start server

```bash
cd server
npm start
```

### 4. Test

Visit: `http://YOUR_PUBLIC_IP:3000/api/health`

**⚠️ WARNING: This is insecure! Only for quick testing. Use nginx for actual deployment.**

---

## When You Get a Domain

Once you have a domain pointing to your server:

### 1. Update nginx config

```bash
sudo nano /etc/nginx/sites-available/kanye-guesser-test
```

Change:
```nginx
server_name _;
```

To:
```nginx
server_name yourdomain.com www.yourdomain.com;
```

### 2. Add SSL

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

This will automatically update your nginx config for HTTPS.

### 3. Update .env

```env
CORS_ORIGIN=https://yourdomain.com
```

### 4. Restart

```bash
pm2 restart kanye-guesser
sudo systemctl reload nginx
```

---

## Firewall Setup

### For IP testing (HTTP only):
```bash
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 22/tcp    # SSH (don't lock yourself out!)
sudo ufw enable
```

### After domain + SSL setup:
```bash
sudo ufw allow 80/tcp     # HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 22/tcp     # SSH
sudo ufw deny 3000/tcp    # Block direct Node.js access
sudo ufw enable
```

---

## Complete IP Testing Steps

### On your VPS:

```bash
# 1. Clone and setup
git clone https://github.com/yourusername/kanye-guesser.git
cd kanye-guesser
bash run_on_server.sh

# 2. Configure for IP testing
cd server
nano .env
# Set: CORS_ORIGIN=http://YOUR_PUBLIC_IP

# 3. Setup nginx
sudo apt install nginx
sudo nano /etc/nginx/sites-available/kanye-guesser-test
# Paste the nginx config above

sudo ln -s /etc/nginx/sites-available/kanye-guesser-test /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 4. Open firewall
sudo ufw allow 80
sudo ufw allow 22
sudo ufw enable

# 5. Start server
pm2 start src/server.js --name kanye-guesser
pm2 save
pm2 startup
```

### On your PC:

Visit `http://YOUR_SERVER_IP` in browser

---

## Troubleshooting

### Can't connect to http://YOUR_IP

**Check nginx:**
```bash
sudo systemctl status nginx
sudo nginx -t
curl http://localhost
```

**Check firewall:**
```bash
sudo ufw status
```

**Check if port 80 is listening:**
```bash
sudo netstat -tlnp | grep :80
```

### Can connect but CORS error

**Check .env CORS_ORIGIN matches:**
```bash
# On VPS
cat server/.env | grep CORS_ORIGIN

# In browser console
console.log(window.location.origin)
```

They must match exactly!

### WebSocket fails

**Check nginx WebSocket config:**
```bash
sudo nano /etc/nginx/sites-enabled/kanye-guesser-test
```

Make sure `/socket.io` location block has:
```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

---

## Summary

**For testing with public IP:**

1. ✅ Use HTTP (port 80) - no SSL needed for testing
2. ✅ Set `CORS_ORIGIN=http://YOUR_IP` in .env
3. ✅ nginx config with `server_name _;`
4. ✅ Open firewall port 80

**Once you have a domain:**

1. Update `server_name` in nginx
2. Run certbot for SSL
3. Update `CORS_ORIGIN=https://yourdomain.com`
4. Switch from HTTP to HTTPS

You can test with IP first, then upgrade to domain + SSL later!
