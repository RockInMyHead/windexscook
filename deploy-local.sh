#!/bin/bash

# Deploy script for Windexs Cook - Local Changes
# Server: svr@37.110.51.35:1030
# Domain: cook.windexs.ru:1031

echo "🚀 Deploying local changes to Windexs Cook production server..."

# SSH connection details
SSH_USER="svr"
SSH_HOST="37.110.51.35"
SSH_PORT="1030"
SSH_PASS="640509040147"
APP_DIR="~/cook"
DOMAIN="cook.windexs.ru"
APP_PORT="1031"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo "📦 Step 1: Upload local changes to server..."
sshpass -p "$SSH_PASS" scp $SSH_OPTS -P $SSH_PORT windexscook-update.tar.gz $SSH_USER@$SSH_HOST:~/

echo "🔧 Step 2: Extract and update files on server..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook

# Backup current dist folder
if [ -d "dist" ]; then
  echo "Backing up current dist folder..."
  mv dist dist.backup.$(date +%Y%m%d_%H%M%S)
fi

# Extract new files
echo "Extracting new files..."
tar -xzf ~/windexscook-update.tar.gz

# Clean up
rm ~/windexscook-update.tar.gz

echo "Files updated successfully!"
ENDSSH

echo "🔄 Step 3: Restart PM2 process..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook

# Use Node.js 18
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 18

# Restart PM2 process
pm2 restart windex-cook
pm2 save

echo "PM2 process restarted!"
ENDSSH

echo "✅ Deployment completed!"
echo "🌐 Application available at: http://cook.windexs.ru:1031"
echo ""
echo "📝 Check status with:"
echo "   ssh svr@37.110.51.35 -p 1030"
echo "   pm2 status"
echo "   pm2 logs windex-cook"

