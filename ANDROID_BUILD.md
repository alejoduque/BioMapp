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

## 🐛 Troubleshooting

### Build fails
- **If you have a complex local environment, see the detailed `APK_BUILD_GUIDE.md` for fixes.**
- **SDK Location Error**: If the build fails with an SDK error, create a file at `android/local.properties` with the path to your Android SDK, e.g., `sdk.dir=/home/user/android-sdk`.
- Check GitHub Actions logs for CI/CD issues.
- Ensure all dependencies are committed.
- Try the Docker build option for a simpler setup.

### APK won't install
- Check "Unknown Sources" is enabled
- Try downloading the APK again
- Clear browser cache if downloading from web

### Audio issues
- Grant microphone permissions
- Check location permissions
- Restart the app if needed

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