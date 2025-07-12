# BioMap Deployment Guide - Ubuntu Server with Nginx

This guide will help you deploy your BioMap application on an Ubuntu server using Nginx.

## Prerequisites

- Ubuntu 20.04+ server
- SSH access to the server
- Domain name (optional, but recommended for production)
- SSH key authentication set up

## Quick Deployment

### 1. Automated Deployment (Recommended)

Use the provided deployment script:

```bash
# Make sure you're in the project directory
cd /path/to/mapz_unstable

# Run the deployment script
./deploy.sh <SERVER_IP> <USERNAME>

# Example:
./deploy.sh 192.168.1.100 ubuntu
```

### 2. Manual Deployment

If you prefer to deploy manually, follow these steps:

#### Step 1: Build the Application
```bash
npm run build
```

#### Step 2: Prepare Server
SSH into your Ubuntu server and run:

```bash
# Update system
sudo apt update

# Install Nginx
sudo apt install -y nginx

# Create app directory
sudo mkdir -p /var/www/biomap

# Set proper permissions
sudo chown -R $USER:$USER /var/www/biomap
```

#### Step 3: Upload Files
From your local machine:

```bash
# Upload the built files
scp -r dist/* <username>@<server_ip>:/var/www/biomap/

# Upload Nginx configuration
scp nginx-biomap.conf <username>@<server_ip>:/tmp/
```

#### Step 4: Configure Nginx
On the server:

```bash
# Copy Nginx configuration
sudo cp /tmp/nginx-biomap.conf /etc/nginx/sites-available/biomap

# Enable the site
sudo ln -sf /etc/nginx/sites-available/biomap /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Post-Deployment Configuration

### 1. Firewall Setup
```bash
# Allow SSH
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable
```

### 2. SSL Certificate (Let's Encrypt) - **REQUIRED**

**⚠️ IMPORTANT**: Modern browsers require HTTPS for media files (MP3, WebM, etc.). SSL is mandatory for your audio recording feature to work properly.

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add this line: 0 12 * * * /usr/bin/certbot renew --quiet
```

**Note**: If you don't have a domain name yet, you can use a self-signed certificate for testing:
```bash
# Generate self-signed certificate (for testing only)
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/nginx-selfsigned.key \
    -out /etc/ssl/certs/nginx-selfsigned.crt

# Update nginx config to use self-signed cert
sudo sed -i 's|ssl_certificate.*|ssl_certificate /etc/ssl/certs/nginx-selfsigned.crt;|' /etc/nginx/sites-available/biomap
sudo sed -i 's|ssl_certificate_key.*|ssl_certificate_key /etc/ssl/private/nginx-selfsigned.key;|' /etc/nginx/sites-available/biomap
```

### 3. Domain Configuration
Update your domain's DNS settings to point to your server's IP address:
- Add an A record: `yourdomain.com` → `YOUR_SERVER_IP`
- Add a CNAME record: `www.yourdomain.com` → `yourdomain.com`

### 4. Update Nginx Configuration for Domain
Edit `/etc/nginx/sites-available/biomap`:
```nginx
server_name yourdomain.com www.yourdomain.com;
```

## Monitoring and Maintenance

### 1. Check Application Status
```bash
# Check Nginx status
sudo systemctl status nginx

# Check logs
sudo tail -f /var/log/nginx/biomap_error.log
sudo tail -f /var/log/nginx/biomap_access.log
```

### 2. Update Application
To update your application:

```bash
# On your local machine
npm run build
./deploy.sh <SERVER_IP> <USERNAME>
```

### 3. Backup
```bash
# Backup your application
sudo tar -czf /backup/biomap-$(date +%Y%m%d).tar.gz /var/www/biomap

# Backup Nginx configuration
sudo cp /etc/nginx/sites-available/biomap /backup/
```

## Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   sudo chown -R www-data:www-data /var/www/biomap
   sudo chmod -R 755 /var/www/biomap
   ```

2. **Nginx Configuration Error**
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

3. **Port Already in Use**
   ```bash
   sudo netstat -tulpn | grep :80
   sudo systemctl stop apache2  # if Apache is running
   ```

4. **SSL Certificate Issues**
   ```bash
   sudo certbot --nginx -d yourdomain.com --force-renewal
   ```

### Performance Optimization

1. **Enable Nginx Caching**
   The configuration already includes caching for static assets.

2. **Monitor Resource Usage**
   ```bash
   # Install monitoring tools
   sudo apt install htop iotop

   # Check disk usage
   df -h

   # Check memory usage
   free -h
   ```

## Browser Compatibility & Media Files

### HTTPS Requirement for Media Files
Modern browsers enforce strict security policies that require HTTPS for:
- Audio files (MP3, WebM, WAV, OGG)
- Video files
- Media Source Extensions (MSE)
- Web Audio API

**This means your audio recording feature will NOT work over HTTP.** You must use HTTPS.

### Browser Support
- **Chrome/Edge**: Requires HTTPS for all media files
- **Firefox**: Requires HTTPS for media files
- **Safari**: Requires HTTPS for media files
- **Mobile browsers**: All require HTTPS for media files

### Testing Without Domain
If you're testing without a domain name:
1. Use a self-signed certificate (see SSL setup above)
2. Accept the security warning in your browser
3. Your audio features will work locally

## Security Considerations

1. **Keep System Updated**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Regular Security Audits**
   ```bash
   sudo apt install unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```

3. **Monitor Logs**
   ```bash
   # Set up log rotation
   sudo logrotate -f /etc/logrotate.d/nginx
   ```

## Support

If you encounter issues:
1. Check the Nginx error logs: `/var/log/nginx/biomap_error.log`
2. Verify your server's firewall settings
3. Ensure your domain DNS is properly configured
4. Check that all required ports are open

Your BioMap application should now be successfully deployed and accessible via your server's IP address or domain name! 