#!/bin/bash

echo "🚀 Deploying Windexs Cook as root user on cook.windexs.ru"

# SSH details
SSH_USER="root"
SSH_HOST="37.110.51.35"
SSH_PORT="1320"
SSH_PASS="640509040147"
APP_DIR="~/cook"

# Ensure sshpass is installed locally
if ! command -v sshpass &> /dev/null; then
  echo "🔧 sshpass not found. Please install sshpass locally to proceed."
  exit 1
fi

set -e
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

# Clone or update repository on server
echo "📦 Step 1: Clone or update repo on server"
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
  if [ -d "cook" ]; then
    cd cook && git pull origin main
  else
    git clone https://github.com/RockInMyHead/windexscook.git cook
    cd cook
  fi
ENDSSH

# Install dependencies
echo "🔧 Step 2: Install dependencies"
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
  cd cook && npm install
ENDSSH

# Build production version
echo "🏗️ Step 3: Build production version"
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
  cd cook && npm run build:prod
ENDSSH

# Restart PM2 process
echo "🔄 Step 4: Restart application via PM2"
sshpass -p "$SSH_PASS" ssh $SSH_OPTS -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
  cd cook && pm2 restart windex-cook || pm2 start server.js --name windex-cook --update-env
ENDSSH

echo "✅ Deployment completed!"
echo "🌐 Application available at http://cook.windexs.ru:1031"


