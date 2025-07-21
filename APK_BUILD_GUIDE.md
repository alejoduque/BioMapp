# APK Build Guide - BioMap App

## 🚀 Quick Setup Checklist for Mac OS X

| Tool/Package         | Version/Command                        | Notes                        |
|----------------------|----------------------------------------|------------------------------|
| Homebrew             | latest                                 | macOS package manager        |
| Java (OpenJDK)       | 17                                     | `brew install openjdk@17`    |
| Node.js              | 18+                                    | `brew install node@18`       |
| npm                  | 9+ (comes with Node 18)                |                              |
| Android SDK          | 34, build-tools 34.0.0                 | via Homebrew                 |
| Capacitor CLI        | 6.1.2 (global)                         | `npm install -g @capacitor/cli@6.1.2` |
| Project npm deps     | see package.json, use `npm ci`         |                              |
| Build script         | `./build-apk.sh`                       | Set `DEV_KEYWORD`            |

**Setup Steps:**
1. Install Homebrew, Java 17, Node 18+, Android SDK 34 (see below for details)
2. Run `npm ci` in the project root
3. Install Capacitor CLI globally: `npm install -g @capacitor/cli@6.1.2`
4. Edit `DEV_KEYWORD` in `build-apk.sh` as needed
5. Run `./build-apk.sh` to build your APK

---

This document outlines the successful environment configuration for building APKs both locally and on GitHub Actions CI/CD.

## 🎯 Overview

The BioMap app requires specific environment configurations to build successfully. This guide documents the working setup that produces stable APK builds.

## 📋 Prerequisites

### Java Version
- **Required**: Java 17 (OpenJDK)
- **CI Environment**: Zulu JDK 17
- **Local Environment**: OpenJDK 17

### Node.js
- **Version**: 18+ (LTS recommended)
- **Package Manager**: npm

### Android SDK
- **Platform**: Android 34 (API Level 34)
- **Build Tools**: 34.0.0
- **Platform Tools**: Latest

## 🏗️ Local Development Setup

### 1. Install Java 17
```bash
# On Manjaro/Arch Linux
sudo pacman -S jdk17-openjdk

# Set JAVA_HOME
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
```

### 2. Install Node.js Dependencies
```bash
npm ci
npm install -g @capacitor/cli@latest
```

### 3. Setup Android SDK
```bash
# Create Android SDK directory
mkdir -p ~/android-sdk && cd ~/android-sdk

# Download command line tools
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-11076708_latest.zip

# Setup directory structure
mkdir -p cmdline-tools/latest
mv cmdline-tools/bin cmdline-tools/lib cmdline-tools/source.properties cmdline-tools/NOTICE.txt cmdline-tools/latest/

# Set environment variables
export ANDROID_HOME=~/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# Accept licenses
yes | sdkmanager --licenses

# Install required SDK components
sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools"
```

### 4. Build the APK
```bash
# Navigate to project
cd ~/Documents/mapz_unstable

# Set environment variables
export ANDROID_HOME=~/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk

# Build web assets
npm run build

# Sync Capacitor
npx cap sync

# Build APK
cd android
./gradlew assembleDebug --stacktrace --info -Dorg.gradle.java.home="$JAVA_HOME"
```

### 5. Locate the APK
The generated APK will be located at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

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
    npm ci
    npm run build
    npx cap sync
    cd android
    ./gradlew assembleDebug --stacktrace --info
```

## 🔧 Critical Dependencies

### Capacitor Plugins
The following plugin versions are confirmed to work with Java 17:

```json
{
  "@capacitor/core": "^7.1.3",
  "@capacitor/android": "^7.1.3",
  "@capacitor/geolocation": "^5.0.0"  // ⚠️ Must be v5.0.0 for Java 17 compatibility
}
```

### Important Notes
- **@capacitor/geolocation v7.x.x requires Java 21** - this will break the build
- **@capacitor/geolocation v5.0.0 uses Java 17** - this is the working version
- All other plugins should use their latest compatible versions

## 🍏 Mac OS X Local Build Environment

This guide assumes you are building on Mac OS X (tested on Ventura/Sonoma). All commands are for macOS Terminal (zsh or bash).

### 1. Install Java 17 (OpenJDK)
```bash
brew install openjdk@17
# Add to your shell profile (e.g., ~/.zshrc):
export JAVA_HOME="/usr/local/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"
```

### 2. Install Node.js and npm
```bash
brew install node@18
# Or use nvm to install Node 18 LTS
```

### 3. Install Android SDK (using Homebrew)
```bash
brew install --cask android-platform-tools
brew install --cask android-commandlinetools
# Accept licenses and install required components
sdkmanager --licenses
sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools"
```

### 4. Install Capacitor CLI and dependencies
```bash
npm ci
npm install -g @capacitor/cli@latest
```

### 5. Build the APK (Recommended: build-apk.sh)

**Use the provided script for a one-step build:**
```bash
# Set a keyword for your experiment/feature (optional but recommended)
# Edit the DEV_KEYWORD variable at the top of build-apk.sh
# Example:
# DEV_KEYWORD="ascii-compact-bgimg"

./build-apk.sh
```

- The script will:
  - Build web assets
  - Sync Capacitor
  - Build the APK using Gradle
  - Name the APK as: `biomap-<keyword>-<timestamp>.apk`

**Example output:**
```
✅ Secure APK built successfully: biomap-ascii-compact-bgimg-20250720-155500.apk
```

### 6. Locate the APK
- The APK will be in the project root (not in android/app/build/outputs/apk/)
- The filename will include your DEV_KEYWORD for easy tracking

## 🏷️ APK Keyword System

- The `DEV_KEYWORD` variable in `build-apk.sh` lets you tag each build with a feature, experiment, or bugfix name.
- This is critical for tracking which APK corresponds to which code or UI change.
- Always update the keyword before a new experiment or feature build.

**How to set:**
```bash
# In build-apk.sh:
DEV_KEYWORD="my-feature-keyword"
```

## 🐛 Troubleshooting
- If the APK filename does not include your keyword, check that you updated `DEV_KEYWORD` before building.
- If you see Java or Android SDK errors, verify your environment variables and versions as above.

## 📦 Notes
- This script and environment are tested on Mac OS X (Ventura/Sonoma) with Homebrew.
- For Linux, adapt the package manager commands as needed.
- For CI/CD, see the GitHub Actions section above.

## 📦 APK Artifacts

### Local Build
- **Location**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Size**: ~6.1 MB
- **Type**: Debug build

### CI/CD Build
- **Location**: GitHub Actions artifacts
- **Naming**: `app-debug-{git-revision}.apk`
- **Additional**: `build-info.txt` with commit details

## 🔄 Version Control

### Working Commit Reference
- **Commit Hash**: `0949d7b` (or latest working commit)
- **Branch**: `main`
- **Status**: ✅ Builds successfully both locally and in CI

### Key Files to Monitor
- `package.json` - Capacitor plugin versions
- `android/app/build.gradle` - Java version settings
- `android/capacitor-cordova-android-plugins/build.gradle` - Plugin Java versions
- `.github/workflows/build-apk.yml` - CI configuration

## 📝 Maintenance

### Regular Checks
1. **Monthly**: Update Capacitor plugins (test thoroughly)
2. **Before releases**: Verify APK builds locally
3. **After dependency updates**: Test CI/CD pipeline

### Environment Updates
When updating the build environment:
1. Test locally first
2. Update CI configuration
3. Verify both environments work
4. Update this document

---

**Last Updated**: July 13, 2025  
**Working Environment**: Java 17 + Android SDK 34 + Capacitor 7.1.3 + Geolocation 5.0.0 