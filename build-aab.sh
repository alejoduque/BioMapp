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

set -e

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

echo "🔨 Building web app for production..."
npm run build

# Verify web build succeeded
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "❌ Web build failed - dist folder is missing or incomplete"
    exit 1
fi

echo "📱 Syncing with Android project..."
npx cap sync android

echo "🛠️ Building Android App Bundle (AAB) for Play Store..."
cd android && ./gradlew clean && cd ..
./android/gradlew -p android bundleRelease

AAB_PATH="android/app/build/outputs/bundle/release/app-release.aab"

if [ ! -f "$AAB_PATH" ]; then
    echo "❌ AAB not found at $AAB_PATH"
    exit 1
fi

# Check AAB size (should be at least 1MB)
# Detect OS and use the correct stat command
if [[ "$(uname)" == "Darwin" ]]; then
  aab_size=$(stat -f%z "$AAB_PATH")
else
  aab_size=$(stat -c%s "$AAB_PATH")
fi
if [ "$aab_size" -lt 1000000 ]; then
    echo "❌ AAB seems too small ($aab_size bytes) - build may have failed"
    exit 1
fi

# Generate timestamp and copy with timestamped filename
timestamp=$(date +"%Y%m%d-%H%M%S")

# Development feature keyword system - Recording Error Fixes
DEV_KEYWORD="recording-error-fixes"

target_aab="biomap-$DEV_KEYWORD-$timestamp.aab"
cp "$AAB_PATH" "$target_aab"

# Calculate build time
end_time=$(date +%s)
build_time=$((end_time - start_time))

echo "✅ Play Store AAB built successfully: $target_aab"
echo "📊 AAB size: $(($aab_size / 1024 / 1024))MB"
echo "⏱️ Build time: ${build_time}s"
echo "🏪 Ready for Google Play Store upload!"