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
Browser (LAN)  ──►  nginx (port 80/443)  ──►  Node.js Express (port 6969)
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

### Quick Start (Custom Port 6969)

Since you are running multiple Node.js applications on the same server, we run this app on custom port **6969** to avoid port conflicts (e.g. if another app is already using port 3000).

```bash
PORT=6969 npm run start:web
```

Output:
```
  ╔══════════════════════════════════════════════╗
  ║   FFLF Extractor — Web Server                ║
  ║   Running at http://0.0.0.0:6969              ║
  ╚══════════════════════════════════════════════╝
```

The server is now accessible locally at `http://YOUR_SERVER_IP:6969`.


---

## nginx Configuration

Rather than creating a new server configuration file, integrate the FFLF Extractor web application into your existing default configuration (`/etc/nginx/sites-available/default`), which already hosts other apps.

### 1. Edit the Default Nginx Configuration

Open the existing default Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/default
```

### 2. Add the FFLF Extractor Location Block

Inside the main `server { ... }` block (the one listening on port 80/443), locate the area where other applications are listed (like `/assetmanager_frontend`, `/moses-spritesheet-packer`, etc.) and append the following location blocks:

```nginx
    # ------------------------------------------------------------>
    # FFLF FRAME EXTRACTOR (Node.js App on Port 6969)
    # ------------------------------------------------------------>
    location = /fflf-extractor {
        return 301 /fflf-extractor/;
    }

    location /fflf-extractor/ {
        proxy_pass http://127.0.0.1:6969/; # Trailing slash is important to strip the subpath prefix
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Max upload size — match the server's multer limit (2GB)
        client_max_body_size 2G;

        # Increase timeouts for large file uploads and FFmpeg processing
        proxy_read_timeout    300s;
        proxy_connect_timeout 60s;
        proxy_send_timeout    300s;
    }
```

### 3. Verify and Reload Nginx

Test the Nginx configuration for syntax errors and reload the service:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Access the App

You can now access the application by navigating to:

```
http://YOUR_SERVER_IP/fflf-extractor
# or
https://YOUR_SERVER_IP/fflf-extractor
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
Environment=PORT=6969
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
| `PORT`   | `6969`   | HTTP port the server listens on |
| `HOST`   | `0.0.0.0`| Bind address                    |

---

## Security Considerations

Since this runs on a **local workplace network**:

- **File Size Limit**: The server accepts files up to 2GB by default. Adjust in `server.js` (`multer.limits.fileSize`) and `nginx.example.conf` (`client_max_body_size`).
- **Auto-Cleanup**: Uploaded videos are deleted immediately after extraction. Frame files are cleaned up every 30 minutes.
- **No Authentication**: This deployment assumes a trusted LAN. If exposed beyond the local network, add authentication (e.g., HTTP Basic Auth via nginx or a session-based middleware).
- **MIME Filtering**: Only `video/*` MIME types are accepted by the upload endpoint.
