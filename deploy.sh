#!/bin/bash

# Deploy script for Windex Cook
# Server: svr@37.110.51.35:1030
# Domain: cook.windexs.ru:1031

echo "🚀 Deploying Windex Cook to production server..."

# SSH connection details
SSH_USER="svr"
SSH_HOST="37.110.51.35"
SSH_PORT="1030"
APP_DIR="~/cook"
DOMAIN="cook.windexs.ru"
APP_PORT="1031"

echo "📦 Step 1: Clone repository on server..."
ssh -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~
if [ -d "cook" ]; then
  echo "Directory exists, updating..."
  cd cook
  git pull origin main
else
  echo "Cloning repository..."
  git clone https://github.com/RockInMyHead/windexscook.git cook
  cd cook
fi
ENDSSH

echo "🔧 Step 2: Install dependencies..."
ssh -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook
npm install --production
ENDSSH

echo "⚙️ Step 3: Setup environment..."
ssh -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Please configure .env file with your API keys!"
fi
ENDSSH

echo "🏗️ Step 4: Build production version..."
ssh -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook
npm run build
ENDSSH

echo "🔄 Step 5: Setup PM2..."
ssh -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook

# Install PM2 if not exists
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi

# Stop existing process
pm2 stop windex-cook 2>/dev/null || true
pm2 delete windex-cook 2>/dev/null || true

# Start new process
PORT=1031 pm2 start server.js --name windex-cook
pm2 save
pm2 startup
ENDSSH

echo "🌐 Step 6: Configure Nginx..."
ssh -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
# Create Nginx config
sudo tee /etc/nginx/sites-available/cook.windexs.ru > /dev/null << 'EOF'
server {
    listen 1031;
    server_name cook.windexs.ru;

    location / {
        proxy_pass http://localhost:1031;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Увеличенный размер для загрузки изображений
        client_max_body_size 50M;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/cook.windexs.ru /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
ENDSSH

echo "✅ Deployment completed!"
echo "🌐 Application available at: http://cook.windexs.ru:1031"
echo ""
echo "📝 Next steps:"
echo "1. Configure .env file on server with API keys"
echo "2. Restart application: pm2 restart windex-cook"
echo "3. Check logs: pm2 logs windex-cook"

