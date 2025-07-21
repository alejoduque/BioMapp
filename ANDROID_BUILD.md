# Android APK Build Options

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

## 🚀 Quick Start Options

### Option 1: GitHub Actions (Recommended - No Local Setup)
1. Push your code to GitHub
2. The workflow will automatically build an APK
3. Download the APK from the Actions tab
4. Install on your Android device

### Option 2: Local Mac OS X Build (Recommended for Developers)
1. Make sure you have Java 17, Node 18+, and Android SDK 34 installed (see APK_BUILD_GUIDE.md for details)
2. Edit the `DEV_KEYWORD` variable at the top of `build-apk.sh` to describe your feature/experiment (e.g., `ascii-compact-bgimg`)
3. Run:
   ```bash
   ./build-apk.sh
   ```
4. The APK will be created in the project root as: `biomap-<keyword>-<timestamp>.apk`
5. Transfer and install on your Android device

### Option 3: Docker Build (Local - No Java Installation)
```bash
# Make sure Docker is installed
./build-apk.sh
# APK will be created as: biomap-debug.apk
```

### Option 4: PWA Installation (Easiest)
1. Deploy your app to a web server (Vercel, Netlify, etc.)
2. Open the website on Android Chrome
3. Tap "Add to Home Screen" when prompted
4. App will install like a native app

## 🏷️ APK Keyword System
- The `DEV_KEYWORD` variable in `build-apk.sh` lets you tag each build with a feature, experiment, or bugfix name.
- This is critical for tracking which APK corresponds to which code or UI change.
- Always update the keyword before a new experiment or feature build.

**How to set:**
```bash
# In build-apk.sh:
DEV_KEYWORD="my-feature-keyword"
```

**Example output:**
```
✅ Secure APK built successfully: biomap-ascii-compact-bgimg-20250720-155500.apk
```

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