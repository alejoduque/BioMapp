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

# BioMap SSL Setup Script
# This script helps set up SSL certificates for your BioMap application

set -e

echo "🔒 BioMap SSL Setup Script"
echo "=========================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

# Function to setup Let's Encrypt SSL
setup_letsencrypt() {
    local domain=$1
    
    echo "📋 Setting up Let's Encrypt SSL for domain: $domain"
    
    # Install Certbot if not already installed
    if ! command -v certbot &> /dev/null; then
        echo "📦 Installing Certbot..."
        apt update
        apt install -y certbot python3-certbot-nginx
    fi
    
    # Get SSL certificate
    echo "🔐 Obtaining SSL certificate..."
    certbot --nginx -d "$domain" --non-interactive --agree-tos --email admin@"$domain"
    
    # Set up auto-renewal
    echo "⏰ Setting up auto-renewal..."
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    
    echo "✅ Let's Encrypt SSL setup completed!"
    echo "🌐 Your site is now available at: https://$domain"
}

# Function to setup self-signed SSL
setup_selfsigned() {
    echo "🔐 Setting up self-signed SSL certificate..."
    
    # Create SSL directory if it doesn't exist
    mkdir -p /etc/ssl/private
    mkdir -p /etc/ssl/certs
    
    # Generate self-signed certificate
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/ssl/private/nginx-selfsigned.key \
        -out /etc/ssl/certs/nginx-selfsigned.crt \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    
    # Update nginx configuration
    if [ -f /etc/nginx/sites-available/biomap ]; then
        sed -i 's|ssl_certificate.*|ssl_certificate /etc/ssl/certs/nginx-selfsigned.crt;|' /etc/nginx/sites-available/biomap
        sed -i 's|ssl_certificate_key.*|ssl_certificate_key /etc/ssl/private/nginx-selfsigned.key;|' /etc/nginx/sites-available/biomap
        
        # Test and restart nginx
        nginx -t
        systemctl restart nginx
        
        echo "✅ Self-signed SSL setup completed!"
        echo "⚠️  Note: You'll see a security warning in your browser. This is normal for self-signed certificates."
        echo "🌐 Your site is now available at: https://$(hostname -I | awk '{print $1}')"
    else
        echo "❌ Nginx configuration not found. Please run the deployment script first."
        exit 1
    fi
}

# Main script logic
echo "Choose SSL setup option:"
echo "1) Let's Encrypt (recommended for production)"
echo "2) Self-signed certificate (for testing)"
echo "3) Exit"
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        read -p "Enter your domain name (e.g., example.com): " domain
        if [ -z "$domain" ]; then
            echo "❌ Domain name is required for Let's Encrypt"
            exit 1
        fi
        setup_letsencrypt "$domain"
        ;;
    2)
        setup_selfsigned
        ;;
    3)
        echo "👋 Exiting..."
        exit 0
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🎉 SSL setup completed!"
echo ""
echo "📝 Next steps:"
echo "1. Test your site at https://your-domain-or-ip"
echo "2. Verify that audio recording works in your browser"
echo "3. Check that all media files load properly"
echo ""
echo "🔧 Troubleshooting:"
echo "- If you see a security warning, click 'Advanced' and 'Proceed'"
echo "- Make sure your firewall allows HTTPS (port 443)"
echo "- Check nginx logs: sudo tail -f /var/log/nginx/biomap_error.log" 