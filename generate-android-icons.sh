#!/bin/bash
# Script to generate Android launcher icons and copy Leaflet marker icons
# Usage: ./generate-android-icons.sh

set -e

SRC=public/ultrared.png
LEAFLET_NODE_MODULES=node_modules/leaflet/dist/images
LEAFLET_PUBLIC=public/leaflet

if [ ! -f "$SRC" ]; then
  echo "Source image $SRC not found!"
  exit 1
fi

# Create mipmap directories if they don't exist
mkdir -p android/app/src/main/res/mipmap-mdpi
mkdir -p android/app/src/main/res/mipmap-hdpi
mkdir -p android/app/src/main/res/mipmap-xhdpi
mkdir -p android/app/src/main/res/mipmap-xxhdpi
mkdir -p android/app/src/main/res/mipmap-xxxhdpi

# Generate launcher icons
convert "$SRC" -resize 48x48 android/app/src/main/res/mipmap-mdpi/ic_launcher.png
convert "$SRC" -resize 72x72 android/app/src/main/res/mipmap-hdpi/ic_launcher.png
convert "$SRC" -resize 96x96 android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
convert "$SRC" -resize 144x144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
convert "$SRC" -resize 192x192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png

echo "Android launcher icons generated successfully!"

# Copy Leaflet marker images to public/leaflet/
mkdir -p "$LEAFLET_PUBLIC"
cp "$LEAFLET_NODE_MODULES/marker-icon.png" "$LEAFLET_PUBLIC/"
cp "$LEAFLET_NODE_MODULES/marker-shadow.png" "$LEAFLET_PUBLIC/"
if [ -f "$LEAFLET_NODE_MODULES/marker-icon-2x.png" ]; then
  cp "$LEAFLET_NODE_MODULES/marker-icon-2x.png" "$LEAFLET_PUBLIC/"
fi

echo "Leaflet marker images copied to $LEAFLET_PUBLIC/"

# Generate a custom marker icon from ultrared.png (optional, uncomment if desired)
convert "$SRC" -resize 25x41 "$LEAFLET_PUBLIC/marker-icon.png"
echo "Custom marker icon generated from $SRC as marker-icon.png in $LEAFLET_PUBLIC/"

echo "All icons and marker images are ready." 