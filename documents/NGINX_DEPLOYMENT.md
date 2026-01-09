# Nginx Deployment Guide for Quicket

This guide will help you deploy the nginx configuration for your Quicket ticketing application.

## Prerequisites

- Nginx installed on your server
- PM2 running your Next.js app on port 3003
- HAProxy configured at 10.10.13.1 to forward traffic to this server

## Installation Steps

### 1. Install Nginx (if not already installed)

```bash
sudo apt update
sudo apt install nginx -y
```

### 2. Deploy the Configuration

Copy the nginx configuration to the sites-available directory:

```bash
sudo cp /home/torvaldsl/quicket/nginx.conf /etc/nginx/sites-available/ticket.partridgecrossing.org
```

### 3. Enable the Site

Create a symbolic link to enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/ticket.partridgecrossing.org /etc/nginx/sites-enabled/
```

### 4. Test the Configuration

Before restarting nginx, test the configuration for syntax errors:

```bash
sudo nginx -t
```

### 5. Remove Default Site (Optional)

If you want to remove the default nginx site:

```bash
sudo rm /etc/nginx/sites-enabled/default
```

### 6. Restart Nginx

Apply the configuration by restarting nginx:

```bash
sudo systemctl restart nginx
```

### 7. Enable Nginx on Boot

Ensure nginx starts automatically on system boot:

```bash
sudo systemctl enable nginx
```

## Verification

### Check Nginx Status

```bash
sudo systemctl status nginx
```

### Check Logs

Monitor access logs:
```bash
sudo tail -f /var/log/nginx/quicket_access.log
```

Monitor error logs:
```bash
sudo tail -f /var/log/nginx/quicket_error.log
```

### Test the Application

From your local machine or another server:
```bash
curl -H "Host: ticket.partridgecrossing.org" http://YOUR_SERVER_IP/
```

## HAProxy Configuration

Your HAProxy server at 10.10.13.1 should have a configuration similar to:

```haproxy
frontend http_front
    bind *:80
    default_backend quicket_backend

backend quicket_backend
    mode http
    option forwardfor
    http-request set-header X-Forwarded-Port %[dst_port]
    http-request add-header X-Forwarded-Proto https if { ssl_fc }
    server quicket YOUR_NGINX_SERVER_IP:80 check
```

## SSL/HTTPS Setup (Optional but Recommended)

### Option 1: Let's Encrypt with Certbot

1. Install Certbot:
```bash
sudo apt install certbot python3-certbot-nginx -y
```

2. Obtain a certificate:
```bash
sudo certbot --nginx -d ticket.partridgecrossing.org
```

3. Certbot will automatically configure SSL in your nginx config.

### Option 2: Manual SSL Configuration

1. Uncomment the SSL server block in `/etc/nginx/sites-available/ticket.partridgecrossing.org`
2. Update the SSL certificate paths
3. Test and restart nginx

## PM2 Configuration

Ensure your PM2 app is running on port 3003. Check with:

```bash
pm2 list
pm2 logs
```

If you need to configure PM2, check your `ecosystem.config.js`:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Firewall Configuration

Make sure your firewall allows HTTP/HTTPS traffic:

```bash
sudo ufw allow 'Nginx Full'
# or
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

If you only want to accept traffic from HAProxy:

```bash
sudo ufw allow from 10.10.13.1 to any port 80 proto tcp
sudo ufw allow from 10.10.13.1 to any port 443 proto tcp
```

## Troubleshooting

### Nginx won't start

1. Check configuration syntax:
   ```bash
   sudo nginx -t
   ```

2. Check for port conflicts:
   ```bash
   sudo netstat -tlnp | grep :80
   ```

3. Check error logs:
   ```bash
   sudo tail -50 /var/log/nginx/error.log
   ```

### Application not responding

1. Verify PM2 is running:
   ```bash
   pm2 status
   pm2 logs --lines 100
   ```

2. Test direct connection to app:
   ```bash
   curl http://localhost:3003
   ```

3. Check nginx proxy settings:
   ```bash
   sudo tail -50 /var/log/nginx/quicket_error.log
   ```

### WebSocket issues (Socket.IO)

The configuration includes WebSocket support. If you experience issues:

1. Verify the Upgrade headers are being passed
2. Check HAProxy is configured for WebSocket support
3. Monitor browser console for WebSocket connection errors

## Performance Tuning

For high-traffic scenarios, consider adjusting these nginx settings:

```nginx
# In /etc/nginx/nginx.conf
worker_processes auto;
worker_connections 2048;

# Enable gzip compression
gzip on;
gzip_vary on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
```

## Security Recommendations

1. **Keep nginx updated**: `sudo apt update && sudo apt upgrade nginx`
2. **Use HTTPS**: Enable SSL/TLS as shown above
3. **Rate limiting**: Consider adding rate limiting for API endpoints
4. **Fail2ban**: Install fail2ban to protect against brute force attacks
5. **Regular backups**: Backup your nginx configuration regularly

## Support

For issues specific to:
- **Nginx**: Check `/var/log/nginx/quicket_error.log`
- **PM2**: Run `pm2 logs`
- **Application**: Check application logs

## Configuration Features

The provided nginx configuration includes:

- ✅ HAProxy proxy header handling
- ✅ WebSocket support for Socket.IO
- ✅ Next.js static file caching
- ✅ Security headers
- ✅ Real IP detection from HAProxy
- ✅ Connection keepalive
- ✅ 10MB file upload limit (configurable)
- ✅ Health check endpoint support
- ✅ SSL/HTTPS ready (commented out)

