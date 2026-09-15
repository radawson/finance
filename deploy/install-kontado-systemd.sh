#!/bin/bash
# Install Kontado as a systemd service (run with sudo on ptx-web02).
#   sudo bash /home/torvaldsl/finance/deploy/install-kontado-systemd.sh
set -euo pipefail

UNIT_SRC="/home/torvaldsl/finance/deploy/kontado.service"
UNIT_DST="/etc/systemd/system/kontado.service"
PM2_USER="torvaldsl"
PM2_HOME="/home/torvaldsl/.pm2"
NODE_BIN="/home/torvaldsl/.nvm/versions/node/v24.12.0/bin"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this with sudo:"
  echo "  sudo bash $0"
  exit 1
fi

if [ ! -f "$UNIT_SRC" ]; then
  echo "Missing unit file: $UNIT_SRC"
  exit 1
fi

cp "$UNIT_SRC" "$UNIT_DST"
systemctl daemon-reload
systemctl enable kontado.service

if [ -x "$NODE_BIN/pm2" ]; then
  echo "Removing leftover PM2 app 'kontado'..."
  sudo -u "$PM2_USER" env PATH="$NODE_BIN:$PATH" HOME="/home/$PM2_USER" PM2_HOME="$PM2_HOME" \
    pm2 delete kontado >/dev/null 2>&1 || true
  sudo -u "$PM2_USER" env PATH="$NODE_BIN:$PATH" HOME="/home/$PM2_USER" PM2_HOME="$PM2_HOME" \
    pm2 save --force >/dev/null 2>&1 || true
fi

systemctl restart kontado.service
sleep 2
systemctl --no-pager --full status kontado.service
