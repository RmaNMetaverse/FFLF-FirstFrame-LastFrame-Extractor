const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectVideos: () => ipcRenderer.invoke('select-videos'),
  extractFrames: (videoPath) => ipcRenderer.invoke('extract-frames', videoPath),
  openFolder: (dirPath) => ipcRenderer.send('open-folder', dirPath)
});
