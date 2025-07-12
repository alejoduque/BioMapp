# Android APK Build Options

## 🚀 Quick Start Options

### Option 1: GitHub Actions (Recommended - No Local Setup)
1. Push your code to GitHub
2. The workflow will automatically build an APK
3. Download the APK from the Actions tab
4. Install on your Android device

### Option 2: Docker Build (Local - No Java Installation)
```bash
# Make sure Docker is installed
./build-apk.sh
# APK will be created as: biomap-debug.apk
```

### Option 3: PWA Installation (Easiest)
1. Deploy your app to a web server (Vercel, Netlify, etc.)
2. Open the website on Android Chrome
3. Tap "Add to Home Screen" when prompted
4. App will install like a native app

## 📱 Installing the APK

1. Enable "Unknown Sources" in Android Settings
2. Transfer the APK to your Android device
3. Tap the APK file to install
4. Grant necessary permissions (location, microphone, storage)

## 🔧 Features in Android Version

- **Unified Modal Design**: Single interface for all playback modes
- **Android-Optimized Audio**: Fixed playback loop issues
- **Mode Selection**: Nearby, Concatenated, Jamm playback
- **Enhanced Error Handling**: Better stability on Android
- **Loading States**: Visual feedback during audio operations

## 🐛 Troubleshooting

### APK won't install
- Check "Unknown Sources" is enabled
- Try downloading the APK again
- Clear browser cache if downloading from web

### Audio issues
- Grant microphone permissions
- Check location permissions
- Restart the app if needed

### Build fails
- Check GitHub Actions logs
- Ensure all dependencies are committed
- Try the Docker build option

## 📋 Requirements

- Android 6.0 (API 23) or higher
- GPS enabled for location features
- Microphone access for recording
- Storage permission for saving files

## 🔄 Updates

To update the APK:
1. Make your code changes
2. Push to GitHub (Option 1)
3. Or run `./build-apk.sh` again (Option 2)
4. Install the new APK over the old one 