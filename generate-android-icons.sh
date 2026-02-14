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
# Script to generate Android launcher icons and copy Leaflet marker icons
# Usage: ./generate-android-icons.sh

set -e

SRC=public/BioMapp_logo.png
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