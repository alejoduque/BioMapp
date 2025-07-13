# APK Build Guide - BioMap App

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

## 🐛 Troubleshooting

### Common Issues

#### 1. Java Version Conflicts
**Error**: `Cannot find a Java installation matching languageVersion=21`
**Solution**: Ensure `@capacitor/geolocation` is version 5.0.0, not 7.x.x

#### 2. Android SDK Not Found
**Error**: `SDK location not found. Define ANDROID_HOME`
**Solution**: Set `ANDROID_HOME` environment variable and install required SDK components

#### 3. Build Tools Version Mismatch
**Error**: `Build tools version 34.0.0 not found`
**Solution**: Install build tools: `sdkmanager "build-tools;34.0.0"`

### Verification Commands
```bash
# Check Java version
java -version

# Check Android SDK
echo $ANDROID_HOME
sdkmanager --list_installed

# Check Capacitor plugins
npm list @capacitor/geolocation
```

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