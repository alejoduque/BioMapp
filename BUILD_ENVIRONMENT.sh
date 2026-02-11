#!/bin/bash

# Install Java 17 (OpenJDK)
sudo pacman -S jdk17-openjdk

# Install Node.js 18.x (LTS recommended)
sudo pacman -S nodejs

# Install the Android SDK 34 (API Level 34)
sudo pacman -S android-sdk

# Install the Build Tools 34.0.0
sudo pacman -S android-sdk-build-tools

# Install the Platform Tools (latest)
sudo pacman -S android-sdk-platform-tools

# Set up the `local.properties` file
echo "sdk.dir=/opt/android-sdk" > ~/.android/local.properties

# Install Gradle
sudo pacman -S gradle

# Install Android Studio (optional)
# sudo pacman -S android-studio

echo "Installation complete!"
