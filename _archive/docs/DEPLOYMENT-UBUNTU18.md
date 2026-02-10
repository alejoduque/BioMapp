# BioMap Deployment Guide - Ubuntu 18 Server (Existing Nginx)

This guide is optimized for Ubuntu 18 servers that already have Nginx, certbot, and cron configured.

## Prerequisites

✅ Ubuntu 18.04+ server  
✅ Nginx already installed and running  
✅ Certbot already configured with auto-renewal  
✅ SSH access with key authentication  
✅ Domain name with SSL certificate  

## Quick Deployment

### 1. Initial Setup (One-time)

#### Step 1: Prepare Nginx Configuration
```bash
# Copy the Nginx configuration to your server
scp nginx-biomap-ubuntu18.conf <username>@<server_ip>:/tmp/

# SSH into your server and configure Nginx
ssh <username>@<server_ip>

# On the server:
sudo cp /tmp/nginx-biomap-ubuntu18.conf /etc/nginx/sites-available/biomap

# Edit the configuration to match your domain
sudo nano /etc/nginx/sites-available/biomap
# Replace 'yourdomain.com' with your actual domain name

# Enable the site
sudo ln -sf /etc/nginx/sites-available/biomap /etc/nginx/sites-enabled/

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

#### Step 2: Create Application Directory
```bash
# On the server:
sudo mkdir -p /var/www/biomap
sudo chown <your_username>:<your_username> /var/www/biomap
```

### 2. Deploy Application

#### Option A: Using the rsync script (Recommended)
```bash
# Make the script executable
chmod +x deploy-rsync.sh

# Deploy to your server
./deploy-rsync.sh <SERVER_IP> <USERNAME> /var/www/biomap

# Example:
./deploy-rsync.sh 192.168.1.100 ubuntu /var/www/biomap
```

#### Option B: Manual deployment
```bash
# Build locally
npm run build

# Sync files using rsync
rsync -avz --delete dist/ <username>@<server_ip>:/var/www/biomap/

# Set permissions on server
ssh <username>@<server_ip> << 'EOF'
    sudo chown -R www-data:www-data /var/www/biomap
    sudo chmod -R 755 /var/www/biomap
    sudo systemctl reload nginx
EOF
```

## SSL Certificate Management

Since you already have certbot configured:

### Check Certificate Status
```bash
# On the server:
sudo certbot certificates
```

### Renew Certificates Manually (if needed)
```bash
# On the server:
sudo certbot renew --dry-run  # Test renewal
sudo certbot renew            # Actual renewal
```

### Add New Domain to Existing Certificate
```bash
# On the server:
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## Updating Your Application

### Quick Update Process
```bash
# Just run the deployment script again
./deploy-rsync.sh <SERVER_IP> <USERNAME> /var/www/biomap
```

### What the script does:
1. Builds your app locally
2. Syncs only changed files using rsync
3. Sets proper permissions
4. Reloads Nginx gracefully (no downtime)

## Monitoring and Maintenance

### Check Application Status
```bash
# On the server:
sudo systemctl status nginx
sudo tail -f /var/log/nginx/biomap_error.log
sudo tail -f /var/log/nginx/biomap_access.log
```

### Check SSL Certificate Expiry
```bash
# On the server:
sudo certbot certificates
```

### Monitor Disk Space
```bash
# On the server:
df -h /var/www/biomap
du -sh /var/www/biomap/*
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
   sudo systemctl reload nginx
   ```

3. **SSL Certificate Issues**
   ```bash
   sudo certbot --nginx -d yourdomain.com --force-renewal
   ```

4. **Audio Files Not Working**
   - Ensure you're accessing via HTTPS
   - Check browser console for mixed content errors
   - Verify SSL certificate is valid

### Performance Optimization

1. **Enable Nginx Caching** (already configured)
2. **Monitor Resource Usage**
   ```bash
   # Install monitoring tools
   sudo apt install htop iotop
   
   # Check resource usage
   htop
   free -h
   df -h
   ```

## Security Considerations

1. **Keep System Updated**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Regular Security Audits**
   ```bash
   # Check for security updates
   sudo unattended-upgrade --dry-run
   ```

3. **Monitor Logs**
   ```bash
   # Set up log rotation (if not already configured)
   sudo logrotate -f /etc/logrotate.d/nginx
   ```

## Backup Strategy

### Application Backup
```bash
# On the server:
sudo tar -czf /backup/biomap-$(date +%Y%m%d).tar.gz /var/www/biomap
```

### Nginx Configuration Backup
```bash
# On the server:
sudo cp /etc/nginx/sites-available/biomap /backup/nginx-biomap-$(date +%Y%m%d).conf
```

## Support

If you encounter issues:
1. Check Nginx error logs: `/var/log/nginx/biomap_error.log`
2. Verify SSL certificate status: `sudo certbot certificates`
3. Test Nginx configuration: `sudo nginx -t`
4. Check file permissions: `ls -la /var/www/biomap`

Your BioMap application should now be successfully deployed and accessible via HTTPS! 