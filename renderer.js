const dropzone = document.getElementById('dropzone');
const queueSection = document.getElementById('queueSection');
const queueList = document.getElementById('queueList');

// Drag and drop events
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
  
  const files = Array.from(e.dataTransfer.files)
    .filter(f => f.path) // Ensure standard file paths
    .map(f => f.path);
    
  if (files.length > 0) {
    processVideos(files);
  }
});

// Click to select files
dropzone.addEventListener('click', async () => {
  const filePaths = await window.api.selectVideos();
  if (filePaths && filePaths.length > 0) {
    processVideos(filePaths);
  }
});

// Main process queue coordinator
async function processVideos(filePaths) {
  queueSection.style.display = 'block';

  for (const filePath of filePaths) {
    const cardId = 'card-' + Date.now() + Math.random().toString(36).substr(2, 5);
    createVideoCard(cardId, filePath);

    try {
      // 1. Set to processing state
      updateCardState(cardId, 'processing', 'Extracting frames...');
      
      // 2. Call main process extraction
      const result = await window.api.extractFrames(filePath);
      
      if (result.success) {
        updateCardState(cardId, 'success', `Saved in original directory: [FF-${result.ffName.replace('[FF-', '').replace('].png', '')}] & LF-...`, result.directory);
      } else {
        updateCardState(cardId, 'error', `Failed: ${result.error}`);
      }
    } catch (err) {
      updateCardState(cardId, 'error', `Error: ${err.message}`);
    }
  }
}

function createVideoCard(id, filePath) {
  const fileName = filePath.split(/[/\\]/).pop();
  
  const card = document.createElement('div');
  card.className = 'video-card';
  card.id = id;
  
  card.innerHTML = `
    <div class="card-header">
      <span class="video-title" title="${filePath}">${fileName}</span>
      <span class="video-status status-pending">Pending</span>
    </div>
    <div class="progress-bar-container">
      <div class="progress-bar"></div>
    </div>
    <div class="card-footer">
      <span class="output-info">Waiting in queue...</span>
      <button class="btn-open" style="display:none;">Open Folder</button>
    </div>
  `;
  
  queueList.insertBefore(card, queueList.firstChild);
}

function updateCardState(id, state, message, directory = null) {
  const card = document.getElementById(id);
  if (!card) return;

  const statusBadge = card.querySelector('.video-status');
  const progressBar = card.querySelector('.progress-bar');
  const infoText = card.querySelector('.output-info');
  const openBtn = card.querySelector('.btn-open');

  // Clear previous status classes
  statusBadge.className = 'video-status';
  statusBadge.classList.add(`status-${state}`);
  statusBadge.innerText = state;

  infoText.innerText = message;

  if (state === 'processing') {
    progressBar.style.width = '100%';
    progressBar.classList.add('animated');
  } else {
    progressBar.classList.remove('animated');
    if (state === 'success') {
      progressBar.style.width = '100%';
      progressBar.style.background = 'var(--success)';
      if (directory) {
        openBtn.style.display = 'block';
        openBtn.onclick = () => window.api.openFolder(directory);
      }
    } else if (state === 'error') {
      progressBar.style.width = '100%';
      progressBar.style.background = 'var(--error)';
    }
  }
}
