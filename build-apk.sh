#!/bin/bash

echo "🐳 Building Android APK using Docker..."

# Build the Docker image
docker build -f Dockerfile.android -t biomap-android-builder .

# Create a container and copy the APK
docker create --name biomap-apk-extractor biomap-android-builder
docker cp biomap-apk-extractor:/app/android/app/build/outputs/apk/debug/app-debug.apk ./biomap-debug.apk
docker rm biomap-apk-extractor

echo "✅ APK built successfully: biomap-debug.apk"
echo "📱 You can now install this APK on your Android device" 