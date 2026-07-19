// ─── Environment Detection ──────────────────────────────────────────────────
const isElectron = typeof window.api !== 'undefined';

// Apply web-mode class for CSS adjustments
if (!isElectron) {
  document.body.classList.add('web-mode');
}

// ─── Unified API Abstraction ────────────────────────────────────────────────
const appApi = {
  /**
   * Open a file picker and return selected items.
   * Electron: returns array of file path strings.
   * Web: returns array of File objects.
   */
  selectVideos: async () => {
    if (isElectron) {
      return window.api.selectVideos();
    }
    // Web: create a hidden file input and trigger it
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'video/*';
      input.onchange = () => resolve(Array.from(input.files));
      input.click();
    });
  },

  /**
   * Extract first and last frames from a video.
   * Electron: sends file path via IPC.
   * Web: uploads File object to server API.
   */
  extractFrames: async (fileOrPath) => {
    if (isElectron) {
      return window.api.extractFrames(fileOrPath);
    }
    // Web: upload file to server
    const formData = new FormData();
    formData.append('video', fileOrPath);

    const response = await fetch('api/extract', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Server error' }));
      return { success: false, error: err.error || `HTTP ${response.status}` };
    }

    return response.json();
  },

  /**
   * Open a folder in the OS file explorer (Electron only).
   */
  openFolder: (dirPath) => {
    if (isElectron) {
      window.api.openFolder(dirPath);
    }
  }
};

// ─── DOM References ─────────────────────────────────────────────────────────
const dropzone = document.getElementById('dropzone');
const queueSection = document.getElementById('queueSection');
const queueList = document.getElementById('queueList');

// ─── Drag & Drop Events ────────────────────────────────────────────────────
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');

  const droppedFiles = Array.from(e.dataTransfer.files);
  if (droppedFiles.length === 0) return;

  if (isElectron) {
    // Electron: extract file paths
    const paths = droppedFiles.filter(f => f.path).map(f => f.path);
    if (paths.length > 0) processVideos(paths);
  } else {
    // Web: use File objects directly
    const videoFiles = droppedFiles.filter(f => f.type.startsWith('video/') || f.name.match(/\.(mp4|mkv|avi|mov|wmv|flv|webm|mpeg|3gp|m4v)$/i));
    if (videoFiles.length > 0) processVideos(videoFiles);
  }
});

// ─── Click to Browse ────────────────────────────────────────────────────────
dropzone.addEventListener('click', async () => {
  const items = await appApi.selectVideos();
  if (items && items.length > 0) {
    processVideos(items);
  }
});

// ─── Process Video Queue ────────────────────────────────────────────────────
async function processVideos(items) {
  queueSection.style.display = 'block';

  for (const item of items) {
    const cardId = 'card-' + Date.now() + Math.random().toString(36).substr(2, 5);
    const displayName = isElectron ? item.split(/[/\\]/).pop() : item.name;
    createVideoCard(cardId, displayName, isElectron ? item : null);

    try {
      updateCardState(cardId, 'processing', 'Extracting frames...');

      const result = await appApi.extractFrames(item);

      if (result.success) {
        if (isElectron) {
          // Electron: show "Open Folder" button
          updateCardState(cardId, 'success', 'Saved in original directory.', {
            mode: 'electron',
            directory: result.directory
          });
        } else {
          // Web: show download buttons
          updateCardState(cardId, 'success', 'Frames extracted — ready to download.', {
            mode: 'web',
            ffUrl: result.ffUrl,
            lfUrl: result.lfUrl,
            ffName: result.ffName,
            lfName: result.lfName
          });
        }
      } else {
        updateCardState(cardId, 'error', `Failed: ${result.error}`);
      }
    } catch (err) {
      updateCardState(cardId, 'error', `Error: ${err.message}`);
    }
  }
}

// ─── Create a Video Card ────────────────────────────────────────────────────
function createVideoCard(id, fileName, filePath) {
  const card = document.createElement('div');
  card.className = 'video-card';
  card.id = id;

  card.innerHTML = `
    <div class="card-header">
      <span class="video-title" title="${filePath || fileName}">${fileName}</span>
      <span class="video-status status-pending">Pending</span>
    </div>
    <div class="progress-bar-container">
      <div class="progress-bar"></div>
    </div>
    <div class="card-footer">
      <span class="output-info">Waiting in queue...</span>
      <div class="card-actions"></div>
    </div>
  `;

  queueList.insertBefore(card, queueList.firstChild);
}

// ─── Update Card State ──────────────────────────────────────────────────────
function updateCardState(id, state, message, actionData = null) {
  const card = document.getElementById(id);
  if (!card) return;

  const statusBadge = card.querySelector('.video-status');
  const progressBar = card.querySelector('.progress-bar');
  const infoText = card.querySelector('.output-info');
  const actionsDiv = card.querySelector('.card-actions');

  // Update status badge
  statusBadge.className = 'video-status';
  statusBadge.classList.add(`status-${state}`);
  statusBadge.innerText = state;

  // Update info text
  infoText.innerText = message;

  if (state === 'processing') {
    progressBar.style.width = '100%';
    progressBar.classList.add('animated');
  } else {
    progressBar.classList.remove('animated');

    if (state === 'success') {
      progressBar.style.width = '100%';
      progressBar.style.background = 'var(--success)';

      // Render action buttons based on mode
      if (actionData && actionData.mode === 'electron') {
        actionsDiv.innerHTML = `<button class="btn-open" id="${id}-open">Open Folder</button>`;
        document.getElementById(`${id}-open`).onclick = () => appApi.openFolder(actionData.directory);
      } else if (actionData && actionData.mode === 'web') {
        actionsDiv.innerHTML = `
          <a class="btn-download" href="${actionData.ffUrl}" download="${actionData.ffName}" title="Download first frame">
            ⬇ First Frame
          </a>
          <a class="btn-download btn-download-lf" href="${actionData.lfUrl}" download="${actionData.lfName}" title="Download last frame">
            ⬇ Last Frame
          </a>
        `;
      }
    } else if (state === 'error') {
      progressBar.style.width = '100%';
      progressBar.style.background = 'var(--error)';
    }
  }
}
