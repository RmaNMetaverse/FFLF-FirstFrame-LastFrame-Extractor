# FFLF Extractor — Web Server Deployment Guide

This guide covers deploying the **FFLF Extractor** web application on a Linux server with nginx, making it accessible to your local workplace network.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Server](#running-the-server)
- [nginx Configuration](#nginx-configuration)
- [Running as a System Service (systemd)](#running-as-a-system-service-systemd)
- [Environment Variables](#environment-variables)
- [Security Considerations](#security-considerations)

---

## Architecture Overview

```
Browser (LAN)  ──►  nginx (port 80)  ──►  Node.js Express (port 3000)
                                                   │
                                              FFmpeg/FFprobe
                                                   │
                                            Extracted frames
                                                   │
                                           Download response
```

- **nginx** acts as a reverse proxy, forwarding HTTP requests to the Node.js server.
- **Node.js/Express** (`server.js`) serves the frontend and handles video uploads, extraction, and downloads.
- **FFmpeg** (bundled via `ffmpeg-static`) processes video files server-side.
- Extracted frames are stored temporarily and auto-cleaned after 30 minutes.

---

## Prerequisites

| Tool      | Minimum Version | Install Command (Ubuntu/Debian)                  |
|-----------|-----------------|---------------------------------------------------|
| **Node.js** | v18+            | `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo -E bash - && sudo apt install -y nodejs` |
| **nginx**   | Any             | `sudo apt install -y nginx`                       |
| **Git**     | v2.30+          | `sudo apt install -y git`                         |

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/RmaNMetaverse/FFLF-FirstFrame-LastFrame-Extractor.git
cd FFLF-FirstFrame-LastFrame-Extractor

# 2. Install production dependencies only (skip Electron dev deps)
npm install --omit=dev
```

> **Note:** `--omit=dev` skips Electron and electron-builder since they aren't needed for the web server. This significantly reduces install size.

---

## Running the Server

### Quick Start

```bash
npm run start:web
```

Output:
```
  ╔══════════════════════════════════════════════╗
  ║   FFLF Extractor — Web Server                ║
  ║   Running at http://0.0.0.0:3000              ║
  ╚══════════════════════════════════════════════╝
```

The server is now accessible at `http://YOUR_SERVER_IP:3000` from any device on the network.

### Custom Port

```bash
PORT=8080 npm run start:web
```

---

## nginx Configuration

### 1. Copy the example config

```bash
sudo cp nginx.example.conf /etc/nginx/sites-available/fflf-extractor
```

### 2. Edit the server name

```bash
sudo nano /etc/nginx/sites-available/fflf-extractor
```

Change `server_name fflf.local;` to your server's hostname or IP address:

```nginx
server_name 192.168.1.100;    # Use your server's LAN IP
# or
server_name fflf.yourcompany.local;
```

### 3. Enable the site

```bash
sudo ln -s /etc/nginx/sites-available/fflf-extractor /etc/nginx/sites-enabled/
sudo nginx -t          # Test configuration
sudo systemctl reload nginx
```

### 4. Access the app

Open a browser on any machine in your network and navigate to:
```
http://192.168.1.100   (or your configured hostname)
```

---

## Running as a System Service (systemd)

To keep the server running after logout and auto-start on boot:

### 1. Create the service file

```bash
sudo nano /etc/systemd/system/fflf-extractor.service
```

Paste the following (adjust paths as needed):

```ini
[Unit]
Description=FFLF Extractor Web Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/fflf-extractor
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=PORT=3000
Environment=NODE_ENV=production

# Logging
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 2. Enable and start

```bash
# If you cloned to a different directory, move it first:
sudo cp -r . /opt/fflf-extractor
sudo chown -R www-data:www-data /opt/fflf-extractor

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable fflf-extractor
sudo systemctl start fflf-extractor

# Check status
sudo systemctl status fflf-extractor
```

### 3. View logs

```bash
sudo journalctl -u fflf-extractor -f
```

---

## Environment Variables

| Variable | Default  | Description                     |
|----------|----------|---------------------------------|
| `PORT`   | `3000`   | HTTP port the server listens on |
| `HOST`   | `0.0.0.0`| Bind address                    |

---

## Security Considerations

Since this runs on a **local workplace network**:

- **File Size Limit**: The server accepts files up to 2GB by default. Adjust in `server.js` (`multer.limits.fileSize`) and `nginx.example.conf` (`client_max_body_size`).
- **Auto-Cleanup**: Uploaded videos are deleted immediately after extraction. Frame files are cleaned up every 30 minutes.
- **No Authentication**: This deployment assumes a trusted LAN. If exposed beyond the local network, add authentication (e.g., HTTP Basic Auth via nginx or a session-based middleware).
- **MIME Filtering**: Only `video/*` MIME types are accepted by the upload endpoint.
