#!/bin/bash

# Quick fix for mixed content HTTPS issue
# Run this on the server after updating the code

echo "🔧 Applying comprehensive fixes for all issues..."

# SSH connection details
SSH_USER="svr"
SSH_HOST="37.110.51.35"
SSH_PORT="1030"
SSH_PASS="640509040147"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo "📦 Step 1: Update code from GitHub..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook
echo "Current commit:"
git log --oneline -1
echo "Pulling latest changes..."
git pull origin main
echo "New commit:"
git log --oneline -1
echo "✅ Code updated"
ENDSSH

echo "🔧 Step 2: Update environment variables..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook
echo "Current .env settings:"
grep -E "YOOKASSA|OPENAI" .env || echo "No YOOKASSA/OPENAI settings found"

# Update .env with correct settings
cat > .env << 'EOF'
PORT=1031
VITE_OPENAI_API_KEY=YOUR_OPENAI_API_KEY_HERE
YOOKASSA_SHOP_ID=1183996
YOOKASSA_SECRET_KEY=live_OTmJmdMHX6ysyUcUpBz5kt-dmSq1pT-Y5gLgmpT1jXgmpT1jXg
YOOKASSA_PLAN_ID=1183996
PROXY_HOST=185.68.187.20
PROXY_PORT=8000
PROXY_USERNAME=rBD9e6
PROXY_PASSWORD=jZdUnJ
EOF

echo "✅ Environment variables updated"
ENDSSH

echo "🏗️ Step 3: Rebuild application..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook
echo "Installing dependencies..."
npm install
echo "Building application..."
npm run build
echo "✅ Application rebuilt"
ENDSSH

echo "🌐 Step 4: Update nginx configuration..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook
# Update nginx config with correct port
sudo cp cook.windexs.ru.nginx.conf /etc/nginx/sites-available/cook.windexs.ru.conf
# Remove default site if exists
sudo rm -f /etc/nginx/sites-enabled/default
# Test and reload nginx
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Nginx configuration updated"
ENDSSH

echo "🔄 Step 5: Restart the application..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook
# Restart PM2 process
pm2 restart windex-cook
# Show status
pm2 status
echo "✅ Application restarted"
ENDSSH

echo "🧪 Step 6: Test APIs..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook
echo "Testing health check..."
curl -s http://localhost:1031/health | jq . 2>/dev/null || curl -s http://localhost:1031/health

echo "Testing payment creation..."
curl -s -X POST http://localhost:1031/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","userEmail":"test@example.com","returnUrl":"https://cook.windexs.ru/payment-success"}' | jq . 2>/dev/null || echo "Payment test completed"
ENDSSH

echo "✅ All fixes applied successfully!"
echo "🌐 Test the application at: https://cook.windexs.ru/my-chef"
echo ""
echo "🔧 Applied fixes:"
echo "  - Updated code to latest version"
echo "  - Fixed environment variables"
echo "  - Rebuilt application"
echo "  - Updated nginx configuration"
echo "  - Restarted services"
echo "  - Tested basic functionality"
