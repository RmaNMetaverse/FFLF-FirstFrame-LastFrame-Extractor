const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Resolve unpacked paths for ASAR packaging compatibility
let ffmpegPath = require('ffmpeg-static');
let ffprobePath = require('ffprobe-static').path;

if (ffmpegPath.includes('app.asar')) {
  ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
}
if (ffprobePath.includes('app.asar')) {
  ffprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked');
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#f8fafc',
      height: 35
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Helper: Run a process and return output/error
function runProcess(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    proc.on('error', reject);
    proc.stdout.on('data', data => stdout += data);
    proc.stderr.on('data', data => stderr += data);
    proc.on('close', code => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Process exited with code ${code}`));
    });
  });
}

// IPC: Open File Dialog
ipcMain.handle('select-videos', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mpeg', '3gp', 'm4v'] }
    ]
  });
  return result.filePaths;
});

// IPC: Open Folder in OS Explorer
ipcMain.on('open-folder', (event, folderPath) => {
  shell.openPath(folderPath);
});

// IPC: Extract Frames Handler
ipcMain.handle('extract-frames', async (event, videoPath) => {
  try {
    const videoDir = path.dirname(videoPath);
    const videoExt = path.extname(videoPath);
    const videoName = path.basename(videoPath, videoExt);
    
    const ffName = `[FF-${videoName}].png`;
    const lfName = `LF-${videoName}.png`;
    
    const ffPath = path.join(videoDir, ffName);
    const lfPath = path.join(videoDir, lfName);

    // 1. Get video duration using ffprobe
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

    // 2. Extract First Frame (seek to 0)
    await runProcess(ffmpegPath, [
      '-y',
      '-ss', '0',
      '-i', videoPath,
      '-frames:v', '1',
      ffPath
    ]);

    // 3. Extract Last Frame (seek to slightly before end to avoid black frame/EOF)
    const seekTime = Math.max(0, duration - 0.05).toString();
    await runProcess(ffmpegPath, [
      '-y',
      '-ss', seekTime,
      '-i', videoPath,
      '-frames:v', '1',
      lfPath
    ]);

    return {
      success: true,
      directory: videoDir,
      ffName,
      lfName,
      ffPath,
      lfPath
    };
  } catch (error) {
    console.error(`Failed extraction for: ${videoPath}`, error);
    return {
      success: false,
      error: error.message
    };
  }
});
