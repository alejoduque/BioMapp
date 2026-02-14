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

# BioMap Deployment Script for Ubuntu Server with Nginx
# Usage: ./deploy.sh [server_ip] [username]

set -e

if [ $# -lt 2 ]; then
    echo "Usage: $0 <server_ip> <username>"
    echo "Example: $0 192.168.1.100 ubuntu"
    exit 1
fi

SERVER_IP=$1
USERNAME=$2
APP_NAME="biomap"
APP_DIR="/var/www/$APP_NAME"

echo "🚀 Starting deployment of BioMap to $SERVER_IP..."

# Build the application locally
echo "📦 Building application..."
npm run build

# Create deployment package
echo "📋 Creating deployment package..."
tar -czf biomap-deploy.tar.gz dist/

# Copy files to server
echo "📤 Uploading files to server..."
scp biomap-deploy.tar.gz $USERNAME@$SERVER_IP:/tmp/
scp nginx-biomap.conf $USERNAME@$SERVER_IP:/tmp/

# Execute deployment commands on server
echo "🔧 Setting up server..."
ssh $USERNAME@$SERVER_IP << 'EOF'
    # Update system
    sudo apt update
    
    # Install Nginx if not already installed
    if ! command -v nginx &> /dev/null; then
        sudo apt install -y nginx
    fi
    
    # Create app directory
    sudo mkdir -p /var/www/biomap
    
    # Extract deployment package
    sudo tar -xzf /tmp/biomap-deploy.tar.gz -C /tmp/
    sudo cp -r /tmp/dist/* /var/www/biomap/
    
    # Set proper permissions
    sudo chown -R www-data:www-data /var/www/biomap
    sudo chmod -R 755 /var/www/biomap
    
    # Configure Nginx
    sudo cp /tmp/nginx-biomap.conf /etc/nginx/sites-available/biomap
    sudo ln -sf /etc/nginx/sites-available/biomap /etc/nginx/sites-enabled/
    
    # Remove default site if exists
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx configuration
    sudo nginx -t
    
    # Restart Nginx
    sudo systemctl restart nginx
    sudo systemctl enable nginx
    
    # Clean up
    rm /tmp/biomap-deploy.tar.gz
    rm /tmp/nginx-biomap.conf
    sudo rm -rf /tmp/dist
    
    echo "✅ Deployment completed!"
    echo "🌐 Your app should be available at: http://$SERVER_IP"
EOF

# Clean up local files
rm biomap-deploy.tar.gz

echo "🎉 Deployment completed successfully!"
echo "🌐 Your BioMap app is now running at: http://$SERVER_IP"
echo ""
echo "📝 Next steps:"
echo "1. Configure your domain DNS to point to $SERVER_IP"
echo "2. Set up SSL certificate with Let's Encrypt:"
echo "   sudo apt install certbot python3-certbot-nginx"
echo "   sudo certbot --nginx -d yourdomain.com"
echo "3. Configure firewall: sudo ufw allow 'Nginx Full'" 