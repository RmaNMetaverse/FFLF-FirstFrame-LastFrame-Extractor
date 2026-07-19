# FFLF Extractor

**FirstFrame LastFrame Extractor** — A sleek desktop application that extracts the first and last frames from any video file, saving them alongside the original.

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![Electron](https://img.shields.io/badge/Electron-31-47848f)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- **Universal Format Support** — Works with any video codec and container (MP4, MKV, AVI, MOV, WMV, FLV, WebM, MPEG, 3GP, M4V, and more).
- **Drag & Drop** — Simply drag video files into the app window.
- **Batch Processing** — Drop multiple files at once; they are processed sequentially with live status updates.
- **Original Folder Output** — Extracted frames are saved right next to the source video.
- **Smart Naming** — First frame: `[FF-VideoName].png`, Last frame: `LF-VideoName.png`.
- **Zero External Dependencies** — FFmpeg and FFprobe are bundled; no system-wide installs required.
- **Cross-Platform** — Builds for Windows, macOS, and Linux via GitHub Actions.
- **Premium Dark UI** — Glassmorphic design with smooth animations and gradient accents.

---

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/FFLF-Extractor.git
cd FFLF-Extractor

# Install dependencies
npm install

# Launch the app
npm start
```

---

## 📦 Download Pre-built Binaries

Head to the **[Releases](../../releases/latest)** page and download the installer for your platform:

| Platform | Format | File |
|----------|--------|------|
| Windows  | Portable `.exe` | `FFLF Extractor *.exe` |
| Linux    | `.AppImage` | `FFLF-Extractor-*.AppImage` |
| macOS    | `.dmg` | `FFLF Extractor-*.dmg` |

> No build tools or GitHub account required — just download and run.

---

## 🛠️ Build from Source

See [BUILD.md](BUILD.md) for detailed instructions on:
- Running in development mode
- Building standalone executables for all platforms
- Using the `npm run commit-build` shortcut
- Previewing the UI in a browser
- GitHub Actions CI/CD setup

### Quick Manual Build (Windows)

```bash
npm run build
# Output: dist/FFLF Extractor 1.0.0.exe
```

### Commit + Build Shortcut

```bash
npm run commit-build "Your commit message"
```

---

## 📁 Output Naming Convention

For a video file named `myvideo.mp4`:

| Output File | Description |
|-------------|-------------|
| `[FF-myvideo].png` | First frame of the video |
| `LF-myvideo.png` | Last frame of the video |

Both files are saved in the **same directory** as the original video.

---

## 🏗️ Project Structure

```
FFLF-Extractor/
├── .github/
│   └── workflows/
│       └── build.yml          # GitHub Actions CI/CD
├── scripts/
│   └── commit-build.js        # Commit & build automation
├── main.js                    # Electron main process
├── preload.js                 # IPC security bridge
├── renderer.js                # UI logic & event handling
├── index.html                 # Application layout
├── index.css                  # Premium dark theme styles
├── package.json               # Dependencies & build config
├── README.md                  # This file
├── BUILD.md                   # Detailed build instructions
└── .gitignore                 # Git ignore rules
```

---

## 📜 License

This project is provided as-is under the [MIT License](LICENSE).
