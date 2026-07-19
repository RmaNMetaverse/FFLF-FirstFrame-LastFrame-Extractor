const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Resolve ffmpeg/ffprobe paths
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

// Startup diagnostics — log binary paths so deployment issues are obvious
console.log(`[FFLF] ffmpeg  path: ${ffmpegPath}`);
console.log(`[FFLF] ffprobe path: ${ffprobePath}`);
if (!fs.existsSync(ffmpegPath)) {
  console.error(`[FFLF] WARNING: ffmpeg binary not found at ${ffmpegPath}`);
}
if (!fs.existsSync(ffprobePath)) {
  console.error(`[FFLF] WARNING: ffprobe binary not found at ${ffprobePath}`);
}

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Temp upload directory
const UPLOAD_DIR = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage — each upload gets a unique job directory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const jobId = crypto.randomBytes(12).toString('hex');
    const jobDir = path.join(UPLOAD_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });
    req.jobId = jobId;
    req.jobDir = jobDir;
    cb(null, jobDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename — keep original name for proper frame naming
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._\-() ]/g, '_');
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB max
  },
  fileFilter: (req, file, cb) => {
    // Accept common video MIME types
    if (file.mimetype.startsWith('video/') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only video files are accepted.'), false);
    }
  }
});

// ─── Helper: run a subprocess ───────────────────────────────────────────────
function runProcess(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    proc.on('error', reject);
    proc.stdout.on('data', d => (stdout += d));
    proc.stderr.on('data', d => (stderr += d));
    proc.on('close', code => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Process exited with code ${code}`));
    });
  });
}

// ─── Serve static frontend ─────────────────────────────────────────────────
app.use(express.static(__dirname, {
  // Don't serve server.js, main.js, preload.js etc. as-is is fine
  // since the browser won't load them unless referenced in HTML
}));

// ─── API: Extract frames ───────────────────────────────────────────────────
app.post('/api/extract', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No video file uploaded.' });
  }

  const jobId = req.jobId;
  const jobDir = req.jobDir;
  const videoPath = req.file.path;
  const originalName = req.file.originalname;
  const videoExt = path.extname(originalName);
  const videoName = path.basename(originalName, videoExt);

  const ffName = `[FF-${videoName}].png`;
  const lfName = `LF-${videoName}.png`;
  const ffPath = path.join(jobDir, ffName);
  const lfPath = path.join(jobDir, lfName);

  try {
    // 1. Get video duration
    const durationOutput = await runProcess(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ]);
    const duration = parseFloat(durationOutput.trim());
    if (isNaN(duration) || duration <= 0) {
      throw new Error('Could not retrieve valid video duration.');
    }

    // 2. Extract first frame
    await runProcess(ffmpegPath, [
      '-y', '-ss', '0', '-i', videoPath,
      '-frames:v', '1', ffPath
    ]);

    // 3. Extract last frame
    const seekTime = Math.max(0, duration - 0.05).toString();
    await runProcess(ffmpegPath, [
      '-y', '-ss', seekTime, '-i', videoPath,
      '-frames:v', '1', lfPath
    ]);

    // 4. Delete the uploaded video to save space (keep only frames)
    fs.unlink(videoPath, () => {});

    res.json({
      success: true,
      jobId,
      ffName,
      lfName,
      ffUrl: `api/download/${jobId}/ff`,
      lfUrl: `api/download/${jobId}/lf`
    });
  } catch (error) {
    // Clean up on error
    fs.rm(jobDir, { recursive: true, force: true }, () => {});
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── API: Download extracted frame ──────────────────────────────────────────
app.get('/api/download/:jobId/:type', (req, res) => {
  const { jobId, type } = req.params;

  // Validate jobId to prevent directory traversal
  if (!/^[a-f0-9]{24}$/.test(jobId)) {
    return res.status(400).json({ error: 'Invalid job ID.' });
  }

  const jobDir = path.join(UPLOAD_DIR, jobId);
  if (!fs.existsSync(jobDir)) {
    return res.status(404).json({ error: 'Job not found or files expired.' });
  }

  // Find the matching frame file
  const files = fs.readdirSync(jobDir);
  let targetFile;

  if (type === 'ff') {
    targetFile = files.find(f => f.startsWith('[FF-'));
  } else if (type === 'lf') {
    targetFile = files.find(f => f.startsWith('LF-'));
  }

  if (!targetFile) {
    return res.status(404).json({ error: 'Frame file not found.' });
  }

  const filePath = path.join(jobDir, targetFile);
  res.download(filePath, targetFile);
});

// ─── Express Error Handler ──────────────────────────────────────────────────
// Catches Multer errors (file too large, wrong MIME) and any other middleware errors.
// Without this, unhandled errors crash the process.
app.use((err, req, res, next) => {
  console.error(`[FFLF] Express error: ${err.message}`);

  // Multer-specific errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'File is too large. Maximum size is 2GB.' });
  }

  res.status(500).json({ success: false, error: err.message || 'Internal server error.' });
});

// ─── Cleanup: remove temp files older than 30 minutes ───────────────────────
setInterval(() => {
  if (!fs.existsSync(UPLOAD_DIR)) return;

  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes

  try {
    const dirs = fs.readdirSync(UPLOAD_DIR);
    for (const dir of dirs) {
      const dirPath = path.join(UPLOAD_DIR, dir);
      const stat = fs.statSync(dirPath);
      if (stat.isDirectory() && (now - stat.mtimeMs) > maxAge) {
        fs.rm(dirPath, { recursive: true, force: true }, () => {});
        console.log(`Cleaned up expired job: ${dir}`);
      }
    }
  } catch (err) {
    // Silently ignore cleanup errors
  }
}, 10 * 60 * 1000); // Run every 10 minutes

// ─── Process-level crash guards ─────────────────────────────────────────────
// Prevent the server from crashing on unhandled errors.
process.on('uncaughtException', (err) => {
  console.error('[FFLF] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FFLF] Unhandled rejection:', reason);
});

// ─── Start server ───────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log(`\n  ╔══════════════════════════════════════════════╗`);
  console.log(`  ║   FFLF Extractor — Web Server                ║`);
  console.log(`  ║   Running at http://${HOST}:${PORT}              ║`);
  console.log(`  ╚══════════════════════════════════════════════╝\n`);
});
