# FFLF Extractor – Build Guide

This document covers how to build the **FirstFrame LastFrame Extractor** application for all platforms, both manually on your local machine and automatically via GitHub Actions.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (Development)](#quick-start-development)
- [Running as a Desktop Application](#running-as-a-desktop-application)
- [Running as a Web Application (Browser Preview)](#running-as-a-web-application-browser-preview)
- [Building Standalone Executables](#building-standalone-executables)
  - [Windows (Portable .exe)](#windows-portable-exe)
  - [Linux (AppImage)](#linux-appimage)
  - [macOS (DMG)](#macos-dmg)
- [Commit & Build Shortcut](#commit--build-shortcut)
- [GitHub Actions (Automatic CI/CD Builds)](#github-actions-automatic-cicd-builds)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before building or running, ensure you have the following installed:

| Tool      | Minimum Version | Download                                     |
|-----------|-----------------|----------------------------------------------|
| **Node.js** | v18+            | [nodejs.org](https://nodejs.org/)           |
| **npm**     | v9+             | Bundled with Node.js                         |
| **Git**     | v2.30+          | [git-scm.com](https://git-scm.com/)        |

> **Note:** `ffmpeg` and `ffprobe` are **bundled automatically** as static binaries via the `ffmpeg-static` and `ffprobe-static` npm packages. You do **not** need to install them separately.

---

## Quick Start (Development)

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/FFLF-Extractor.git
cd FFLF-Extractor

# 2. Install dependencies
npm install

# 3. Start the Electron app in development mode
npm start
```

The application window will open. You can drag and drop video files or click the drop zone to browse for videos. Extracted frames will be saved in the same directory as the source video.

---

## Running as a Desktop Application

This is the primary mode. After installing dependencies:

```bash
npm start
```

This launches the full Electron desktop app with:
- Native window controls
- File system access for drag-and-drop
- FFmpeg-powered video frame extraction

---

## Running as a Web Application (Browser Preview)

While this is an Electron app, you can preview the UI in a browser for design/development purposes. The extraction features **will not work** in a browser (they require Electron's Node.js backend), but the layout and interactions can be tested.

### Option 1: Simple HTTP Server

```bash
# Install a lightweight server (if not already installed)
npx -y serve .

# Open in browser
# Navigate to http://localhost:3000
```

### Option 2: VS Code Live Server

1. Install the **Live Server** extension in VS Code.
2. Right-click `index.html` → **Open with Live Server**.
3. The UI will open at `http://127.0.0.1:5500`.

> **⚠️ Important:** Video extraction features require the Electron runtime. Browser preview is for UI development only. The `window.api` bridge will be undefined in a standard browser.

---

## Building Standalone Executables

### Windows (Portable .exe)

Builds a single portable `.exe` that can be run without installation.

```bash
npm run build
```

The output will be in the `dist/` folder:
```
dist/
└── FFLF Extractor 1.0.0.exe
```

### Linux (AppImage)

```bash
npx electron-builder --linux AppImage
```

The output will be in the `dist/` folder:
```
dist/
└── FFLF Extractor-1.0.0.AppImage
```

Make it executable:
```bash
chmod +x "dist/FFLF Extractor-1.0.0.AppImage"
./dist/FFLF\ Extractor-1.0.0.AppImage
```

### macOS (DMG)

```bash
npx electron-builder --mac dmg
```

The output will be in the `dist/` folder:
```
dist/
└── FFLF Extractor-1.0.0.dmg
```

Open the `.dmg` and drag the app to your Applications folder.

---

## Commit & Build Shortcut

A convenience script is provided to **commit all changes and build the Windows portable exe** in one step:

```bash
# With a custom commit message:
npm run commit-build "Your commit message here"

# With an auto-generated timestamp message:
npm run commit-build
```

This will:
1. Initialize a git repo (if not already initialized).
2. Stage all changed files (`git add .`).
3. Commit with the provided message (or an auto-generated one).
4. Build the Windows portable executable in `dist/`.

---

## GitHub Actions (Automatic CI/CD Builds)

Every push or pull request to the `main` (or `master`) branch automatically triggers builds for **all three platforms** via GitHub Actions.

### How It Works

The workflow file is located at `.github/workflows/build.yml`. It runs a build matrix across:

| Platform | Build Target | Output Format |
|----------|-------------|---------------|
| Windows  | `--win portable` | `.exe` (portable) |
| Linux    | `--linux AppImage` | `.AppImage` |
| macOS    | `--mac dmg` | `.dmg` |

### Downloading Build Artifacts

1. Go to the **Actions** tab of your GitHub repository.
2. Click on the latest successful workflow run.
3. Scroll down to the **Artifacts** section.
4. Download the artifact for your platform:
   - `FFLF-Extractor-Windows`
   - `FFLF-Extractor-Linux`
   - `FFLF-Extractor-macOS`

### Setting Up (First Time)

No additional secrets are required. The workflow uses the built-in `GITHUB_TOKEN` for artifact uploads.

Simply push your code to GitHub:

```bash
git remote add origin https://github.com/YOUR_USERNAME/FFLF-Extractor.git
git push -u origin main
```

The build will trigger automatically.

---

## Troubleshooting

### `ffmpeg` / `ffprobe` not found after building

The static binaries must be unpacked from the ASAR archive. Ensure your `package.json` has:

```json
"build": {
  "asarUnpack": [
    "**/node_modules/ffmpeg-static/**/*",
    "**/node_modules/ffprobe-static/**/*"
  ]
}
```

### Build fails on macOS with code signing errors

For unsigned development builds, set the following environment variable:

```bash
export CSC_IDENTITY_AUTO_DISCOVERY=false
npx electron-builder --mac dmg
```

### Linux build requires additional packages

On some Linux distributions, you may need:

```bash
sudo apt-get install -y libgtk-3-0 libnotify4 libnss3 libxss1 libasound2
```

### Large download during `npm install`

The `electron` and `ffmpeg-static` packages are large (~150MB+ combined). This is normal for first-time installs. Subsequent installs will use the npm cache.
