#!/bin/bash

# Test script for deployed Windexs Cook application

echo "🧪 Testing Windexs Cook deployment..."

# Server details
DOMAIN="cook.windexs.ru"
SSH_USER="svr"
SSH_HOST="37.110.51.35"
SSH_PORT="1030"
SSH_PASS="640509040147"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo "🔍 Testing health endpoint..."
curl -k -s "https://$DOMAIN/health" | head -c 200
echo ""

echo "🔍 Testing API endpoints..."
echo "Health: $(curl -k -s "https://$DOMAIN/api/health" | jq -r '.status' 2>/dev/null || echo 'failed')"
echo ""

echo "🔍 Server PM2 status:"
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST "pm2 status windex-cook" 2>/dev/null || echo "SSH connection failed"

echo ""
echo "🔍 Server logs (last 10 lines):"
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST "pm2 logs windex-cook --lines 10 --nostream" 2>/dev/null || echo "SSH connection failed"

echo ""
echo "✅ Test completed!"
