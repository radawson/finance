# WebSocket Implementation Guide

This guide covers the WebSocket (Socket.IO) implementation for real-time updates in Kontado.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [What Changed](#what-changed)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Testing WebSockets](#testing-websockets)
- [Troubleshooting](#troubleshooting)
- [HAProxy Configuration](#haproxy-configuration)

## Architecture Overview

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
│          (finance.partridgecrossing.org)            │
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

## What Changed

### New Files Created

1. **`server.js`** - Custom server that integrates Next.js and Socket.IO
2. **`src/lib/socketio-server.ts`** - Helper utilities for emitting Socket.IO events from API routes

### Modified Files

1. **`package.json`** - Updated scripts to use custom server
2. **`ecosystem.config.js`** - Changed to run `server.js` on port 3003
3. **`src/components/SocketProvider.tsx`** - Enabled WebSocket connection
4. **API Routes** - Updated to use Socket.IO helper:
   - `src/app/api/bills/route.ts`
   - `src/app/api/bills/[id]/route.ts`
   - `src/app/api/bills/[id]/comments/route.ts`
   - `src/app/api/bills/[id]/attachments/route.ts`
   - `src/app/api/vendors/[id]/accounts/route.ts`
   - `src/app/api/vendors/[id]/accounts/[accountId]/route.ts`
5. **`documents/nginx.conf`** - Enhanced with dedicated `/socket.io/` location block

## Local Development

### Prerequisites

```bash
# Ensure you have Node.js 20.19+ or 22.12+ installed
node --version
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

## Production Deployment

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
pm2 delete kontado

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
sudo cp documents/nginx.conf /etc/nginx/sites-available/finance.partridgecrossing.org

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
pm2 logs kontado

# Monitor in real-time
pm2 monit
```

## Testing WebSockets

### Browser Console Test

1. Open `https://finance.partridgecrossing.org`
2. Open Developer Tools -> Console
3. Look for Socket.IO connection messages:
   ```
   [Socket.IO] Connecting to: https://finance.partridgecrossing.org
   [Socket.IO] Connected successfully: AbC123XyZ
   ```

### Real-Time Update Test

1. Open a bill in **two different browser windows** (or devices)
2. In Window 1: Add a comment to the bill
3. In Window 2: Comment should appear automatically without refresh
4. Try updating bill status - both windows should update

### Network Tab Test

1. Open Developer Tools -> Network tab
2. Filter by "WS" (WebSocket)
3. You should see a connection to `/socket.io/?EIO=4&transport=websocket`
4. Click on it to see WebSocket frames being sent/received

## Troubleshooting

### Issue: Socket.IO Not Connecting

**Symptoms:**
- Console shows: `[Socket.IO] Connection error`
- No real-time updates

**Solutions:**

1. **Check server is running:**
   ```bash
   pm2 status
   pm2 logs kontado --lines 50
   ```

2. **Verify port 3003 is listening:**
   ```bash
   sudo netstat -tlnp | grep 3003
   ```

3. **Check nginx configuration:**
   ```bash
   sudo nginx -t
   sudo tail -f /var/log/nginx/kontado_error.log
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
   # In /etc/nginx/sites-available/finance.partridgecrossing.org
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
- Comments appear without refresh on bill detail page
- But bill list page doesn't update

**Expected Behavior:**
- This is normal! Currently, only the bill detail pages join Socket.IO rooms
- The bill list doesn't auto-update (requires refresh)
- To add list auto-update, see "Future Enhancements" section

### Issue: 502 Bad Gateway

**Symptoms:**
- Nginx returns 502 error
- Can't access application

**Solutions:**

1. **Check if app is running:**
   ```bash
   pm2 status
   pm2 restart kontado
   ```

2. **Check if port is correct:**
   ```bash
   # Should show process on port 3003
   sudo lsof -i :3003
   ```

3. **Verify upstream in nginx:**
   ```nginx
   upstream kontado_backend {
       server 127.0.0.1:3003;
       keepalive 64;
   }
   ```

## HAProxy Configuration

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
    default_backend kontado_backend
```

### Backend Configuration

```haproxy
backend kontado_backend
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
    
    default_backend kontado_backend
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

## Real-Time Events

The following events are emitted via Socket.IO:

| Event | When | Sent To | Data |
|-------|------|---------|------|
| `bill:created` | New bill created | All clients | Full bill object |
| `bill:updated` | Bill updated (status, amount, etc.) | Bill room | Updated bill object |
| `bill:deleted` | Bill deleted | Bill room | `{ id }` |
| `bill:status-changed` | Bill status changed | Bill room | Updated bill object |
| `comment:added` | New comment added | Bill room only | Comment object |
| `attachment:added` | File uploaded to bill | Bill room only | Attachment object |
| `vendor:account:created` | Vendor account created | Vendor room | Account object |
| `vendor:account:updated` | Vendor account updated | Vendor room | Updated account object |
| `vendor:account:deleted` | Vendor account deleted | Vendor room | `{ id, vendorId }` |
| `notification:new` | New notification | User room | Notification object |

### Room Structure

- **`bill:{billId}`** - Room for specific bill updates
  - Clients join when viewing a bill detail page
  - Clients leave when navigating away or disconnecting
- **`vendor:{vendorId}`** - Room for vendor account updates
  - Clients join when viewing a vendor detail page
- **`user:{userId}`** - Room for user-specific notifications
  - Clients auto-join when authenticated via SocketProvider

## Security Considerations

1. **Authentication**: Socket.IO connections don't verify authentication by default
   - Current implementation: Public connection, events are broadcast
   - Future: Add Socket.IO middleware to verify NextAuth session

2. **Rate Limiting**: Consider adding rate limiting for Socket.IO connections

3. **CORS**: Currently allows connections from `NEXT_PUBLIC_APP_URL`
   - Update `server.js` CORS settings if needed

## Monitoring

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Memory/CPU usage
pm2 status

# Restart if high memory
pm2 restart kontado
```

### Socket.IO Monitoring

Check server logs for Socket.IO activity:

```bash
pm2 logs kontado | grep "Socket.IO"
```

Common log messages:
- `[Socket.IO] Client connected: {id}` - New connection
- `[Socket.IO] Socket {id} joined bill:{billId}` - User viewing bill
- `[Socket.IO] Emitted 'comment:added' to bill:{billId}` - Event sent
- `[Socket.IO] Socket {id} joined vendor:{vendorId}` - User viewing vendor
- `[Socket.IO] Socket {id} joined user:{userId}` - User joined notification room
- `[Socket.IO] Client disconnected: {id}` - Connection closed

## Future Enhancements

Potential improvements for the WebSocket implementation:

1. **Authentication Middleware**: Verify user sessions on Socket.IO connections
2. **Admin Room**: Create an `admins` room for admin-only notifications
3. **Typing Indicators**: Show when someone is typing a comment
4. **Online Status**: Display which users/admins are currently online
5. **Bill List Updates**: Auto-update bill lists when changes occur
6. **Connection Status Indicator**: UI element showing Socket.IO connection status
7. **Reconnection Logic**: Better handling of connection drops with exponential backoff

## Support

If you encounter issues:

1. Check PM2 logs: `pm2 logs kontado`
2. Check nginx logs: `sudo tail -f /var/log/nginx/kontado_error.log`
3. Check browser console for Socket.IO errors
4. Verify HAProxy is forwarding WebSocket headers correctly

## Notes

- **Port**: Application runs on port 3003 (changed from 3000)
- **PM2 Mode**: Using `fork` mode (not cluster) for Socket.IO compatibility
- **WebSocket Path**: `/socket.io/` (default Socket.IO path)
- **Transports**: WebSocket (primary), Polling (fallback)
- **Reconnection**: Enabled with 5 attempts, 1 second delay

---

**Last Updated:** February 2026  
**Version:** 0.2.6  
**Author:** Kontado Development Team
