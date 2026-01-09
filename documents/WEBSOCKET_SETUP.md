# WebSocket Implementation Guide

This guide covers the WebSocket (Socket.IO) implementation for real-time updates in Informejo.

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [What Changed](#what-changed)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Testing WebSockets](#testing-websockets)
- [Troubleshooting](#troubleshooting)
- [HAProxy Configuration](#haproxy-configuration)

## 🏗️ Architecture Overview

The application now uses a **custom Node.js server** that wraps Next.js and runs Socket.IO alongside it:

```
┌─────────────────────────────────────────────────────┐
│                    HAProxy                          │
│              (10.10.13.1 - pfSense)                 │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP/WebSocket
                   ▼
┌─────────────────────────────────────────────────────┐
│                     Nginx                           │
│          (ticket.partridgecrossing.org)             │
│    ┌────────────────────────────────────┐          │
│    │  /socket.io/ → WebSocket Handler   │          │
│    │  / → Next.js Pages                 │          │
│    └────────────────────────────────────┘          │
└──────────────────┬──────────────────────────────────┘
                   │ Port 3003
                   ▼
┌─────────────────────────────────────────────────────┐
│            Custom Node.js Server (PM2)              │
│  ┌──────────────────┐  ┌──────────────────────┐   │
│  │   Next.js App    │  │   Socket.IO Server   │   │
│  │   (HTTP/SSR)     │  │   (WebSocket)        │   │
│  └──────────────────┘  └──────────────────────┘   │
│         Single Port 3003 - Both Services            │
└─────────────────────────────────────────────────────┘
```

## 🔄 What Changed

### New Files Created

1. **`server.js`** - Custom server that integrates Next.js and Socket.IO
2. **`src/lib/socketio-server.ts`** - Helper utilities for emitting Socket.IO events from API routes

### Modified Files

1. **`package.json`** - Updated scripts to use custom server
2. **`ecosystem.config.js`** - Changed to run `server.js` on port 3003
3. **`src/components/SocketProvider.tsx`** - Enabled WebSocket connection
4. **API Routes** - Updated to use Socket.IO helper:
   - `src/app/api/tickets/route.ts`
   - `src/app/api/tickets/[id]/route.ts`
   - `src/app/api/tickets/[id]/comments/route.ts`
   - `src/app/api/tickets/[id]/attachments/route.ts`
5. **`documents/nginx.conf`** - Enhanced with dedicated `/socket.io/` location block

### Deleted Files

- `src/app/api/socket/route.ts` - No longer needed (replaced by custom server)

## 💻 Local Development

### Prerequisites

```bash
# Ensure you have Node.js 18+ installed
node --version  # Should be >= 18.18.0
```

### Setup

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Environment variables** (`.env` file):
   ```env
   # Optional: Specify Socket.IO connection URL
   NEXT_PUBLIC_SOCKET_URL=http://localhost:3003
   
   # Or use the general app URL
   NEXT_PUBLIC_APP_URL=http://localhost:3003
   
   # Database and other configs...
   DATABASE_URL=your_database_url
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```
   
   This now runs `node server.js` which starts:
   - Next.js on port 3003
   - Socket.IO on the same port 3003

4. **Verify Socket.IO is working**:
   - Open browser console at `http://localhost:3003`
   - Look for: `[Socket.IO] Connected successfully: {socket-id}`

## 🚀 Production Deployment

### Step 1: Build the Application

```bash
npm run build
```

### Step 2: Deploy with PM2

The deployment script (`scripts/deploy.sh`) will handle this automatically:

```bash
cd scripts
./deploy.sh
```

Or manually:

```bash
# Stop existing process
pm2 delete informejo

# Start with ecosystem config
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup startup script
pm2 startup
```

### Step 3: Update Nginx

Copy the updated nginx configuration:

```bash
sudo cp documents/nginx.conf /etc/nginx/sites-available/ticket.partridgecrossing.org

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Step 4: Verify Deployment

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs informejo

# Monitor in real-time
pm2 monit
```

## 🧪 Testing WebSockets

### Browser Console Test

1. Open `https://ticket.partridgecrossing.org`
2. Open Developer Tools → Console
3. Look for Socket.IO connection messages:
   ```
   [Socket.IO] Connecting to: https://ticket.partridgecrossing.org
   [Socket.IO] Connected successfully: AbC123XyZ
   ```

### Real-Time Update Test

1. Open a ticket in **two different browser windows** (or devices)
2. In Window 1: Add a comment to the ticket
3. In Window 2: Comment should appear automatically without refresh
4. Try updating ticket status - both windows should update

### Network Tab Test

1. Open Developer Tools → Network tab
2. Filter by "WS" (WebSocket)
3. You should see a connection to `/socket.io/?EIO=4&transport=websocket`
4. Click on it to see WebSocket frames being sent/received

## 🔧 Troubleshooting

### Issue: Socket.IO Not Connecting

**Symptoms:**
- Console shows: `[Socket.IO] Connection error`
- No real-time updates

**Solutions:**

1. **Check server is running:**
   ```bash
   pm2 status
   pm2 logs informejo --lines 50
   ```

2. **Verify port 3003 is listening:**
   ```bash
   sudo netstat -tlnp | grep 3003
   ```

3. **Check nginx configuration:**
   ```bash
   sudo nginx -t
   sudo tail -f /var/log/nginx/informejo_error.log
   ```

4. **Verify HAProxy is forwarding WebSocket headers:**
   - See [HAProxy Configuration](#haproxy-configuration) below

### Issue: Connection Drops Frequently

**Symptoms:**
- Frequent disconnect/reconnect messages
- Unstable WebSocket connection

**Solutions:**

1. **Check nginx timeout settings:**
   ```nginx
   # In /etc/nginx/sites-available/ticket.partridgecrossing.org
   location /socket.io/ {
       proxy_read_timeout 86400s;  # 24 hours
       proxy_send_timeout 86400s;  # 24 hours
   }
   ```

2. **Verify HAProxy timeout settings:**
   ```haproxy
   timeout client 24h
   timeout server 24h
   ```

### Issue: Updates Only Work on Same Page

**Symptoms:**
- Comments appear without refresh on ticket detail page
- But ticket list page doesn't update

**Expected Behavior:**
- This is normal! Currently, only the ticket detail pages join Socket.IO rooms
- The ticket list doesn't auto-update (requires refresh)
- To add list auto-update, see "Future Enhancements" section

### Issue: 502 Bad Gateway

**Symptoms:**
- Nginx returns 502 error
- Can't access application

**Solutions:**

1. **Check if app is running:**
   ```bash
   pm2 status
   pm2 restart informejo
   ```

2. **Check if port is correct:**
   ```bash
   # Should show process on port 3003
   sudo lsof -i :3003
   ```

3. **Verify upstream in nginx:**
   ```nginx
   upstream informejo_backend {
       server 127.0.0.1:3003;
       keepalive 64;
   }
   ```

## 🌐 HAProxy Configuration

Your pfSense HAProxy needs to properly forward WebSocket headers. Here's the configuration:

### Frontend Configuration

```haproxy
frontend http-in
    bind *:80
    mode http
    
    # WebSocket support
    option http-server-close
    option forwardfor
    
    # Route to backend
    default_backend informejo_backend
```

### Backend Configuration

```haproxy
backend informejo_backend
    mode http
    
    # Preserve client info
    option forwardfor
    
    # WebSocket support
    http-request set-header X-Forwarded-Proto https if { ssl_fc }
    http-request set-header Connection "upgrade"
    http-request set-header Upgrade "websocket" if { hdr(Upgrade) -i websocket }
    
    # Long timeouts for WebSocket
    timeout connect 5s
    timeout client 24h
    timeout server 24h
    
    # Your nginx server
    server nginx YOUR_SERVER_IP:80 check
```

### HTTPS Frontend Configuration

If using HTTPS (recommended):

```haproxy
frontend https-in
    bind *:443 ssl crt /path/to/cert.pem
    mode http
    
    # WebSocket support
    option http-server-close
    option forwardfor
    
    # Set headers
    http-request set-header X-Forwarded-Proto https
    http-request set-header X-Forwarded-Port 443
    
    default_backend informejo_backend
```

### Testing HAProxy

```bash
# Check HAProxy status
sudo service haproxy status

# Test configuration
haproxy -c -f /etc/haproxy/haproxy.cfg

# View HAProxy logs
sudo tail -f /var/log/haproxy.log
```

## 📊 Real-Time Events

The following events are emitted via Socket.IO:

| Event | When | Sent To | Data |
|-------|------|---------|------|
| `ticket:created` | New ticket created | All clients | Full ticket object |
| `ticket:updated` | Ticket updated (status, priority, assignment) | All clients + ticket room | Updated ticket object |
| `comment:added` | New comment added | Ticket room only | Comment object |
| `attachment:added` | File uploaded to ticket | Ticket room only | Attachment object |

### Room Structure

- **`ticket:{ticketId}`** - Room for specific ticket updates
  - Clients join when viewing a ticket detail page
  - Clients leave when navigating away or disconnecting

## 🔒 Security Considerations

1. **Authentication**: Socket.IO connections don't verify authentication by default
   - Current implementation: Public connection, events are broadcast
   - Future: Add Socket.IO middleware to verify NextAuth session

2. **Rate Limiting**: Consider adding rate limiting for Socket.IO connections

3. **CORS**: Currently allows connections from `NEXT_PUBLIC_APP_URL`
   - Update `server.js` CORS settings if needed

## 📈 Monitoring

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Memory/CPU usage
pm2 status

# Restart if high memory
pm2 restart informejo
```

### Socket.IO Monitoring

Check server logs for Socket.IO activity:

```bash
pm2 logs informejo | grep "Socket.IO"
```

Common log messages:
- `[Socket.IO] Client connected: {id}` - New connection
- `[Socket.IO] Socket {id} joined ticket:{ticketId}` - User viewing ticket
- `[Socket.IO] Emitted 'comment:added' to ticket:{ticketId}` - Event sent
- `[Socket.IO] Client disconnected: {id}` - Connection closed

## 🚀 Future Enhancements

Potential improvements for the WebSocket implementation:

1. **Authentication Middleware**: Verify user sessions on Socket.IO connections
2. **Admin Room**: Create an `admins` room for admin-only notifications
3. **Typing Indicators**: Show when someone is typing a comment
4. **Online Status**: Display which users/admins are currently online
5. **Ticket List Updates**: Auto-update ticket lists when changes occur
6. **Notification Toasts**: Show toast notifications for real-time events
7. **Connection Status Indicator**: UI element showing Socket.IO connection status
8. **Reconnection Logic**: Better handling of connection drops with exponential backoff

## 📞 Support

If you encounter issues:

1. Check PM2 logs: `pm2 logs informejo`
2. Check nginx logs: `sudo tail -f /var/log/nginx/informejo_error.log`
3. Check browser console for Socket.IO errors
4. Verify HAProxy is forwarding WebSocket headers correctly

## 📝 Notes

- **Port**: Application runs on port 3003 (changed from 3000)
- **PM2 Mode**: Using `fork` mode (not cluster) for Socket.IO compatibility
- **WebSocket Path**: `/socket.io/` (default Socket.IO path)
- **Transports**: WebSocket (primary), Polling (fallback)
- **Reconnection**: Enabled with 5 attempts, 1 second delay

---

**Last Updated:** November 12, 2024  
**Version:** 1.0.0 (WebSocket Implementation)  
**Author:** Informejo Development Team

