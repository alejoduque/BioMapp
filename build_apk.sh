#!/bin/bash

set -e

# Support Homebrew Java installations on macOS so gradle doesn't fail
if [[ "$(uname)" == "Darwin" ]] && [ -d "/opt/homebrew/opt/openjdk@17" ]; then
    export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
fi

# Fallback for Android SDK installed via Homebrew command-line tools
if [ -z "$ANDROID_HOME" ] && [ -d "/opt/homebrew/share/android-commandlinetools" ]; then
    export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
fi

# Aggressive clean
rm -rf dist/
rm -rf android/app/src/main/assets/public/
rm -rf android/app/src/main/assets/
rm -rf android/app/build/
rm -rf android/build/

# Start timing
start_time=$(date +%s)

echo "🧹 Cleaning all build, npm, and Capacitor caches..."
rm -rf node_modules/.cache
npm cache clean --force

echo "� Building web app for production..."
npm run build

# Verify web build succeeded
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "❌ Web build failed - dist folder is missing or incomplete"
    exit 1
fi

echo "� Syncing with Android project..."
npx cap sync android

echo "🛠️ Building Android APK using local Gradle..."
cd android && ./gradlew clean && cd ..

# Choose build type based on argument, default to assembleRelease
if [ "$1" == "--debug" ]; then
    echo "Running assembleDebug..."
    ./android/gradlew -p android assembleDebug
    APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
else
    echo "Running assembleRelease..."
    ./android/gradlew -p android assembleRelease
    APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
fi

if [ ! -f "$APK_PATH" ]; then
    echo "❌ APK not found at $APK_PATH"
    exit 1
fi

# Check APK size (should be at least 1MB)
# Detect OS and use the correct stat command
if [[ "$(uname)" == "Darwin" ]]; then
  apk_size=$(stat -f%z "$APK_PATH")
else
  apk_size=$(stat -c%s "$APK_PATH")
fi

if [ "$apk_size" -lt 1000000 ]; then
    echo "❌ APK seems too small ($apk_size bytes) - build may have failed"
    exit 1
fi

# Generate timestamp and copy with timestamped filename
timestamp=$(date +"%Y%m%d-%H%M%S")

# Development feature keyword system
DEV_KEYWORD="latest-build"

# Extracting build type
if [ "$1" == "--debug" ]; then
    target_apk="biomap-$DEV_KEYWORD-debug-$timestamp.apk"
else
    target_apk="biomap-$DEV_KEYWORD-release-$timestamp.apk"
fi

cp "$APK_PATH" "$target_apk"

# Calculate build time
end_time=$(date +%s)
build_time=$((end_time - start_time))

echo "✅ Secure APK built successfully: $target_apk"
echo "📊 APK size: $(($apk_size / 1024 / 1024))MB"
echo "⏱️ Build time: ${build_time}s"
echo "📱 You can now install this APK on your Android device"
