# APK Build Guide - BioMap App

This document outlines the successful environment configuration for building APKs both locally and on GitHub Actions CI/CD.

## 🎯 Overview

The BioMap app requires specific environment configurations to build successfully. This guide documents the working setup that produces stable APK builds and includes fixes for common issues.

## 📋 Prerequisites

### Java Version
- **Required**: Java 17 (OpenJDK)
- **CI Environment**: Zulu JDK 17
- **Local Environment**: OpenJDK 17

### Node.js
- **Version**: 18.x (LTS recommended)
- **Package Manager**: npm (v10+ recommended)
- **Version Manager**: `nvm` is highly recommended to manage Node.js versions.

### Android SDK
- **Platform**: Android 34 (API Level 34)
- **Build Tools**: 34.0.0
- **Platform Tools**: Latest

## 🏗️ Local Development Setup

### 1. Install Java 17
```bash
# On Manjaro/Arch Linux
sudo pacman -S jdk17-openjdk
```

### 2. Install Node.js v18 (LTS) using nvm
```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Add nvm to your shell profile (e.g., ~/.zshrc or ~/.bashrc)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Reload shell or open a new terminal, then install and use Node 18
nvm install 18
nvm use 18
```

### 3. Install Node.js Dependencies & Resolve Conflicts
Run the following commands to align all Capacitor plugins to v5.x and install dependencies:
```bash
npm install @capacitor/core@5.7.8 @capacitor/android@5.7.8 @capacitor/cli@5.7.8 @capacitor/app@5.0.8 @capacitor/filesystem@5.0.0 @capacitor-community/media@5.0.0 @capacitor/geolocation@5.0.0 capacitor-voice-recorder@5.0.0 --save --legacy-peer-deps
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### 4. Setup Android SDK

```bash
# Create Android SDK directory
mkdir -p ~/android-sdk && cd ~/android-sdk

# Download command line tools
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-11076708_latest.zip

# Setup directory structure
mkdir -p cmdline-tools/latest
mv cmdline-tools/bin cmdline-tools/lib cmdline-tools/source.properties cmdline-tools/NOTICE.txt cmdline-tools/latest/

# Accept licenses

yes | sdkmanager --licenses

# Install required SDK components
sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools"
```

### 5. Create `local.properties`
Create a file at `android/local.properties` with the following content (replace `/home/a` with your actual home directory):
```
sdk.dir=/home/a/android-sdk
```

### 6. Build the APK
You can now use the automated build script:
```bash
./build-apk.sh
```

### 7. Locate the APK
The generated APK will have a timestamped name and will be located in the project root, e.g., `biomap-spanish-localization-20250721-123456.apk`.

## 🚀 GitHub Actions CI/CD Setup

### Workflow Configuration
The CI/CD pipeline is configured in `.github/workflows/build-apk.yml` with the following key settings:

```yaml
# Java Setup
- name: Set up JDK 17
  uses: actions/setup-java@v4
  with:
    distribution: 'zulu'
    java-version: '17'

# Android SDK Setup
- name: Set up Android SDK
  uses: android-actions/setup-android@v3
  with:
    sdk-platform: '34'
    sdk-build-tools: '34.0.0'

# Build Process
- name: Build APK
  run: |
    npm ci --legacy-peer-deps
    npm run build
    npx cap sync
    cd android
    # Create local.properties to avoid SDK path errors in CI
    echo "sdk.dir=$ANDROID_HOME" > local.properties
    ./gradlew assembleDebug --stacktrace --info
```

## 🔧 Critical Dependencies

### Capacitor Plugins
The following plugin versions are confirmed to work with Java 17 and Capacitor v5:

```json
{
  "@capacitor/core": "5.7.8",
  "@capacitor/android": "5.7.8",
  "@capacitor/cli": "5.7.8",
  "@capacitor/app": "5.0.8",
  "@capacitor/filesystem": "5.0.0",
  "@capacitor/geolocation": "5.0.0",
  "@capacitor-community/media": "5.0.0",
  "capacitor-voice-recorder": "5.0.0"
}
```

### Important Notes
- **Capacitor v6/v7 requires Java 21** - this will break the build.
- **Capacitor v5 uses Java 17** - this is the working version.

## 🐛 Troubleshooting

### Common Issues

#### 1. `npm: command not found`
**Issue**: `npm` is not available in the shell, especially in GUI tools like Cursor/VS Code.
**Solution**:
1.  Install `nvm` and Node.js v18 as shown in the setup steps.
2.  Add the nvm initialization script to your shell profile (`~/.zshrc` or `~/.bashrc`).
3.  **Relaunch your GUI tool** (Cursor/VS Code) to ensure it loads the new environment.

#### 2. `ERESOLVE` Dependency Conflicts
**Issue**: Mismatched Capacitor plugin versions (e.g., `@capacitor/core@6.x` with `@capacitor/geolocation@5.x`).
**Solution**: Run the dependency alignment commands from Step 3 of the setup guide to force all Capacitor plugins to v5.

#### 3. `SDK location not found. Define ANDROID_HOME`
**Issue**: Gradle cannot find the Android SDK.
**Solution**: Create the `android/local.properties` file as described in Step 5 of the setup guide.

#### 4. Build Tools Version Mismatch
**Error**: `Build tools version 34.0.0 not found`
**Solution**: Install build tools: `sdkmanager "build-tools;34.0.0"`

### Verification Commands
```bash
# Check Java version
java -version

# Check Node/npm version
node -v && npm -v

# Check Android SDK
sdkmanager --list_installed

# Check Capacitor plugins
npm list @capacitor/core @capacitor/android @capacitor/geolocation
```

## 📦 APK Artifacts

### Local Build
- **Location**: Project root (e.g., `biomap-feature-name-timestamp.apk`)
- **Type**: Release build (unsigned by default)

### CI/CD Build
- **Location**: GitHub Actions artifacts
- **Naming**: `app-debug-{git-revision}.apk`

## 🔄 Version Control

### Key Files to Monitor
- `package.json` - Capacitor plugin versions
- `android/local.properties` - **Add this file to `.gitignore`** to avoid committing local paths.
- `.github/workflows/build-apk.yml` - CI configuration

---

**Last Updated**: July 21, 2025  
**Working Environment**: Java 17 + Node 18 + Android SDK 34 + Capacitor v5 