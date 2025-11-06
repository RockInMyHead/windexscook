#!/bin/bash

# Deploy script for Windexs Cook
# Server: svr@37.110.51.35:1030
# Domain: cook.windexs.ru:1031

echo "🚀 Deploying Windexs Cook to production server..."

# SSH connection details
SSH_USER="svr"
SSH_HOST="37.110.51.35"
SSH_PORT="1030"
SSH_PASS="640509040147"
APP_DIR="~/cook"
DOMAIN="cook.windexs.ru"
APP_PORT="1031"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

# Environment variables (add your actual API keys here)
ELEVENLABS_API_KEY="${ELEVENLABS_API_KEY:-}"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"

echo "📦 Step 1: Clone repository on server..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
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
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook

# Install Node.js 18 if not exists
if ! command -v node &> /dev/null; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm install 18
  nvm use 18
fi

npm install
ENDSSH

echo "⚙️ Step 3: Setup environment..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << ENDSSH
cd ~/cook

# Create .env file with required variables
cat > .env << EOF
# ElevenLabs API для голосового синтеза
ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}

# OpenAI API для генерации рецептов и изображений
VITE_OPENAI_API_KEY=${OPENAI_API_KEY}

# Порт сервера
PORT=1031

# Режим работы
NODE_ENV=production

# JWT секрет для авторизации
JWT_SECRET=your_jwt_secret_here_change_this

# YooKassa настройки (если используются платежи)
YOOKASSA_SHOP_ID=your_yookassa_shop_id
YOOKASSA_SECRET_KEY=your_yookassa_secret_key

# Email настройки
EMAIL_FROM=noreply@cook.windexs.ru
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password

# Прокси настройки (если нужны)
PROXY_HOST=
PROXY_PORT=
PROXY_USERNAME=
PROXY_PASSWORD=
EOF

echo "✅ .env file created with environment variables"
echo "⚠️  Please update .env file with your actual API keys if not set!"
ENDSSH

echo "🏗️ Step 4: Build production version..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook

# Use Node.js 18
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 18

npm run build
ENDSSH

echo "🔄 Step 5: Setup PM2..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook

# Use Node.js 18
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 18

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
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
  # Отключаем Apache, чтобы Nginx мог слушать порт 443
  sudo systemctl stop apache2
  sudo systemctl disable apache2
  cd ~/cook
# Копируем готовый конфиг nginx из репозитория
sudo cp cook.windexs.ru.nginx.conf /etc/nginx/sites-available/cook.windexs.ru.conf
# Включаем сайт
sudo ln -sf /etc/nginx/sites-available/cook.windexs.ru.conf /etc/nginx/sites-enabled/
# Удаляем default сайт если существует
sudo rm -f /etc/nginx/sites-enabled/default
# Проверяем и перезагружаем nginx
sudo nginx -t && sudo systemctl reload nginx
ENDSSH

echo "🔍 Step 7: Check deployment status..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd ~/cook

# Check PM2 status
echo "📊 PM2 Status:"
pm2 status

# Check if application is responding
echo ""
echo "🔍 Health check:"
curl -f http://localhost:1031/health 2>/dev/null || echo "❌ Health check failed"

# Show recent logs
echo ""
echo "📋 Recent logs:"
pm2 logs windex-cook --lines 20 --nostream
ENDSSH

echo "✅ Deployment completed!"
echo "🌐 Application should be available at: https://cook.windexs.ru"
echo ""
echo "📝 Next steps:"
echo "1. Update .env file on server with your actual API keys"
echo "2. Test API endpoints: https://cook.windexs.ru/api/health"
echo "3. Check logs: pm2 logs windex-cook"
echo "4. Monitor: pm2 monit"
echo ""
echo "🔧 Useful commands:"
echo "  Restart: pm2 restart windex-cook"
echo "  Stop: pm2 stop windex-cook"
echo "  Logs: pm2 logs windex-cook"
echo "  Monitor: pm2 monit"

