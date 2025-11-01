#!/bin/bash

# Quick fix for mixed content HTTPS issue
# Run this on the server after updating the code

echo "🔧 Applying quick fixes for HTTPS mixed content issue..."

# SSH connection details (update these with your actual values)
SSH_USER="svr"
SSH_HOST="37.110.51.35"
SSH_PORT="1030"
SSH_PASS="640509040147"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo "📦 Step 1: Update nginx configuration..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook
# Update nginx config with correct port
sudo cp cook.windexs.ru.nginx.conf /etc/nginx/sites-available/cook.windexs.ru.conf
# Test and reload nginx
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Nginx configuration updated"
ENDSSH

echo "🔄 Step 2: Restart the application..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook
# Restart PM2 process
pm2 restart windex-cook
echo "✅ Application restarted"
ENDSSH

echo "✅ Fixes applied successfully!"
echo "🌐 Test the application at: https://cook.windexs.ru/my-chef"
echo ""
echo "The frontend should now make relative API calls that get properly proxied over HTTPS."
