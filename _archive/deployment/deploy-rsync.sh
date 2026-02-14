#!/bin/bash
#
# @fileoverview This script is part of the BioMapp project, developed for Reserva MANAKAI.
#
# Copyright (c) 2026 Alejandro Duque Jaramillo. All rights reserved.
#
# This code is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) License.
# For the full license text, please visit: https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode
#
# You are free to:
# - Share — copy and redistribute the material in any medium or format.
# - Adapt — remix, transform, and build upon the material.
#
# Under the following terms:
# - Attribution — You must give appropriate credit, provide a link to the license, and indicate if changes were made. You may do so in any reasonable manner, but not in any way that suggests the licensor endorses you or your use.
# - NonCommercial — You may not use the material for commercial purposes. This includes, but is not limited to, any use of the code (including for training artificial intelligence models) that is primarily intended for or directed towards commercial advantage or monetary compensation.
# - ShareAlike — If you remix, transform, and build upon the material, you must distribute your contributions under the same license as the original.
#
# This license applies to all forms of use, including by automated systems or artificial intelligence models,
# to prevent unauthorized commercial exploitation and ensure proper attribution.
#
# ----------------------------------------------------------------------------------------------------

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