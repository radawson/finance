# WebSocket Quick Start Guide

**For the impatient developer who just wants to get WebSockets working! 🚀**

## ⚡ TL;DR

WebSockets are now enabled via a custom Node.js server. Just deploy and it works!

## 🏃 Quick Start - Local Development

```bash
# 1. Make sure you're on the dev branch
git checkout dev

# 2. Install dependencies (if needed)
npm install

# 3. Start dev server (now runs custom server with Socket.IO)
npm run dev

# 4. Open http://localhost:3003 and check browser console
# You should see: [Socket.IO] Connected successfully
```

That's it! WebSockets are working locally.

## 🚢 Quick Deploy - Production

```bash
# 1. SSH into your server
ssh user@your-server

# 2. Navigate to project
cd /home/torvaldsl/projects/finance

# 3. Pull latest dev branch
git pull origin dev

# 4. Run deployment script (handles everything)
cd scripts
./deploy.sh
```

The deploy script will:
- Install dependencies
- Build the application
- Run database migrations
- Stop old PM2 process
- Start new process with Socket.IO on port 3003

## 🌐 Update Nginx (One Time)

```bash
# Copy the updated nginx config
sudo cp /home/torvaldsl/projects/finance/documents/nginx.conf /etc/nginx/sites-available/finance.partridgecrossing.org

# Test it
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## ✅ Verify It's Working

### Method 1: Browser Console
1. Open your app in browser
2. Open Developer Tools (F12)
3. Check Console tab
4. Look for: `[Socket.IO] Connected successfully: {some-id}`

### Method 2: Real-Time Test
1. Open a bill in two browser tabs
2. Add a comment in tab 1
3. See it appear in tab 2 instantly (no refresh needed)

### Method 3: PM2 Logs
```bash
pm2 logs kontado --lines 50
```
Look for:
```
[Socket.IO] Client connected: AbC123
[Socket.IO] Socket AbC123 joined bill:xyz-123
```

## 🆘 Something Broken?

### WebSocket not connecting?

```bash
# Check if app is running
pm2 status

# View logs
pm2 logs kontado

# Restart if needed
pm2 restart kontado
```

### Still not working?

```bash
# Check if port 3003 is listening
sudo netstat -tlnp | grep 3003

# Check nginx logs
sudo tail -f /var/log/nginx/kontado_error.log
```

### Nuclear option (start fresh):

```bash
pm2 delete kontado
cd /home/torvaldsl/projects/finance
npm run build
pm2 start ecosystem.config.js
pm2 save
```

## 📊 What Changed?

- **Port**: Now using 3003 (was 3000)
- **Server**: Custom Node.js server (was `next start`)
- **PM2 Mode**: Fork mode (was cluster)
- **WebSocket**: Fully enabled and working

## 🎯 Test Checklist

- [ ] App starts without errors (`pm2 status` shows online)
- [ ] Browser console shows Socket.IO connected
- [ ] Adding a comment updates in real-time
- [ ] Multiple users can see updates simultaneously
- [ ] No 502 errors from nginx

## 📖 Need More Details?

See `WEBSOCKET_SETUP.md` for comprehensive documentation.

## 🎉 That's It!

You now have real-time WebSocket updates working in your Kontado bill tracking system!

---

**Questions?** Check the logs:
- PM2: `pm2 logs kontado`
- Nginx: `sudo tail -f /var/log/nginx/kontado_error.log`
- Browser: Developer Tools → Console

