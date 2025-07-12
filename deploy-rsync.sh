#!/bin/bash

# BioMap Deployment Script for Ubuntu 18 Server with existing Nginx
# Uses rsync for efficient file transfers and existing certbot setup

set -e

if [ $# -lt 2 ]; then
    echo "Usage: $0 <server_ip> <username> [remote_path]"
    echo "Example: $0 192.168.1.100 ubuntu /var/www/biomap"
    exit 1
fi

SERVER_IP=$1
USERNAME=$2
REMOTE_PATH=${3:-"/var/www/biomap"}
APP_NAME="biomap"

echo "🚀 Starting BioMap deployment to $SERVER_IP..."
echo "📁 Remote path: $REMOTE_PATH"

# Build the application locally
echo "📦 Building application..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

echo "📤 Syncing files to server using rsync..."

# Sync files to server using rsync
# -a: archive mode (preserves permissions, timestamps, etc.)
# -v: verbose
# -z: compress during transfer
# --delete: remove files on server that don't exist locally
# --exclude: exclude unnecessary files
rsync -avz --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='*.log' \
    --exclude='.env*' \
    dist/ $USERNAME@$SERVER_IP:$REMOTE_PATH/

# Set proper permissions on server
echo "🔧 Setting permissions on server..."
ssh $USERNAME@$SERVER_IP << EOF
    # Set proper ownership and permissions
    sudo chown -R www-data:www-data $REMOTE_PATH
    sudo chmod -R 755 $REMOTE_PATH
    
    # Test Nginx configuration
    sudo nginx -t
    
    # Reload Nginx (graceful reload, no downtime)
    sudo systemctl reload nginx
    
    echo "✅ Files synced and permissions set"
    echo "🌐 Application should be available at: http://$SERVER_IP"
EOF

echo "🎉 Deployment completed successfully!"
echo "🌐 Your BioMap app is now running at: http://$SERVER_IP"
echo ""
echo "📝 Notes:"
echo "- SSL certificate renewal is handled by existing certbot cron job"
echo "- Nginx configuration should already be set up"
echo "- Use this script for future updates: ./deploy-rsync.sh $SERVER_IP $USERNAME $REMOTE_PATH" 