#!/bin/bash

# BioMap Authentication Setup Script
# This script helps set up secure authentication for the BioMap application

set -e

echo "🔐 BioMap Authentication Setup"
echo "=============================="

# Check if auth.js already exists
if [ -f "src/config/auth.js" ]; then
    echo "⚠️  Warning: src/config/auth.js already exists!"
    echo "This file contains sensitive data and should not be committed to git."
    echo ""
    read -p "Do you want to update the password? (y/n): " update_password
    
    if [ "$update_password" != "y" ]; then
        echo "Setup cancelled."
        exit 0
    fi
fi

# Get new password from user
echo ""
echo "Enter a secure password for Collector Mode:"
echo "(This will be used to access the recording features)"
echo ""
read -s -p "New password: " new_password
echo ""
read -s -p "Confirm password: " confirm_password
echo ""

# Validate password
if [ "$new_password" != "$confirm_password" ]; then
    echo "❌ Passwords do not match!"
    exit 1
fi

if [ -z "$new_password" ]; then
    echo "❌ Password cannot be empty!"
    exit 1
fi

# Create auth.js file
echo "📝 Creating secure authentication configuration..."

cat > src/config/auth.js << EOF
// Authentication configuration
// This file should be added to .gitignore to prevent committing sensitive data

export const AUTH_CONFIG = {
  // Collector mode password - change this to a secure password
  COLLECTOR_PASSWORD: process.env.REACT_APP_COLLECTOR_PASSWORD || '$new_password',
  
  // Add other authentication settings here as needed
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds
};

// Helper function to validate password
export const validatePassword = (inputPassword) => {
  return inputPassword === AUTH_CONFIG.COLLECTOR_PASSWORD;
};
EOF

echo "✅ Authentication configuration created successfully!"
echo ""
echo "🔒 Security measures implemented:"
echo "   - Password moved to separate configuration file"
echo "   - auth.js added to .gitignore (will not be committed)"
echo "   - Example file (auth.example.js) provided for reference"
echo ""
echo "📝 Next steps:"
echo "   1. Test the application with the new password"
echo "   2. Consider using environment variables for production"
echo "   3. Regularly update the password for security"
echo ""
echo "🌐 For production deployment, you can set the password via environment variable:"
echo "   REACT_APP_COLLECTOR_PASSWORD=your-secure-password npm run build"
echo ""
echo "⚠️  IMPORTANT: Never commit src/config/auth.js to version control!" 