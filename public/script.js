document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const proxyStatusDot = document.getElementById('proxyStatusDot');
  const proxyStatusText = document.getElementById('proxyStatusText');
  const toggleProxyBtn = document.getElementById('toggleProxyBtn');
  const exitBtn = document.getElementById('exitBtn');
  const tokenPreview = document.getElementById('tokenPreview');
  const refreshBtn = document.getElementById('refreshBtn');
  const refreshIcon = refreshBtn.querySelector('.icon');
  const autoRefreshSelect = document.getElementById('autoRefreshSelect');
  const customIntervalInput = document.getElementById('customIntervalInput');
  const applyAutoRefreshBtn = document.getElementById('applyAutoRefreshBtn');
  const terminal = document.getElementById('terminal');
  const clearLogsBtn = document.getElementById('clearLogsBtn');

  let proxyEnabled = true;

  // Initialize
  fetchStatus();
  setupSSE();

  // Event Listeners
  toggleProxyBtn.addEventListener('click', toggleProxy);
  exitBtn.addEventListener('click', exitServer);
  refreshBtn.addEventListener('click', refreshState);
  autoRefreshSelect.addEventListener('change', handleAutoRefreshSelect);
  applyAutoRefreshBtn.addEventListener('click', applyAutoRefresh);
  clearLogsBtn.addEventListener('click', () => {
    terminal.innerHTML = '';
  });

  // Functions
  async function fetchStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.ok) {
        updateProxyStatus(data.proxyEnabled);
        tokenPreview.textContent = data.tokenPreview;
        
        // Match auto refresh select
        const interval = data.autoRefreshInterval;
        const options = Array.from(autoRefreshSelect.options).map(o => o.value);
        if (interval === 0) {
          autoRefreshSelect.value = "0";
        } else if (options.includes(interval.toString())) {
          autoRefreshSelect.value = interval.toString();
        } else {
          autoRefreshSelect.value = "custom";
          customIntervalInput.value = interval;
          customIntervalInput.classList.remove('hidden');
        }
      }
    } catch (err) {
      appendLog('error', `Failed to fetch status: ${err.message}`);
    }
  }

  function updateProxyStatus(enabled) {
    proxyEnabled = enabled;
    if (enabled) {
      proxyStatusDot.className = 'dot active';
      proxyStatusText.textContent = 'Proxy Active';
      toggleProxyBtn.textContent = 'Disable Proxy';
      toggleProxyBtn.className = 'btn btn-outline';
    } else {
      proxyStatusDot.className = 'dot inactive';
      proxyStatusText.textContent = 'Proxy Disabled';
      toggleProxyBtn.textContent = 'Enable Proxy';
      toggleProxyBtn.className = 'btn btn-primary';
    }
  }

  async function toggleProxy() {
    try {
      const res = await fetch('/api/proxy/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !proxyEnabled })
      });
      const data = await res.json();
      if (data.ok) {
        updateProxyStatus(data.proxyEnabled);
      }
    } catch (err) {
      appendLog('error', `Failed to toggle proxy: ${err.message}`);
    }
  }

  async function exitServer() {
    if (!confirm('Are you sure you want to shut down the proxy server? This dashboard will go offline.')) return;
    try {
      await fetch('/api/server/exit', { method: 'POST' });
      document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;font-size:1.5rem;color:white;">Server offline. You can close this tab.</div>';
    } catch (err) {
      // Ignored, server might have closed connection immediately
    }
  }

  async function refreshState() {
    refreshBtn.disabled = true;
    refreshIcon.classList.add('spin');
    appendLog('info', 'Triggering manual state refresh...');
    try {
      const res = await fetch('/api/state/refresh', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        appendLog('info', 'State refreshed successfully.');
        await fetchStatus();
      } else {
        appendLog('error', `State refresh failed: ${data.error}`);
      }
    } catch (err) {
      appendLog('error', `State refresh request failed: ${err.message}`);
    } finally {
      refreshBtn.disabled = false;
      refreshIcon.classList.remove('spin');
    }
  }

  function handleAutoRefreshSelect() {
    if (autoRefreshSelect.value === 'custom') {
      customIntervalInput.classList.remove('hidden');
    } else {
      customIntervalInput.classList.add('hidden');
    }
  }

  async function applyAutoRefresh() {
    let intervalMs = autoRefreshSelect.value === 'custom' 
      ? parseInt(customIntervalInput.value, 10)
      : parseInt(autoRefreshSelect.value, 10);
      
    if (isNaN(intervalMs) || intervalMs < 0) intervalMs = 0;

    applyAutoRefreshBtn.disabled = true;
    try {
      const res = await fetch('/api/state/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMs })
      });
      const data = await res.json();
      if (data.ok) {
        appendLog('info', `Auto-refresh ${intervalMs > 0 ? 'enabled (' + intervalMs + 'ms)' : 'disabled'}`);
      }
    } catch (err) {
      appendLog('error', `Failed to set auto-refresh: ${err.message}`);
    } finally {
      applyAutoRefreshBtn.disabled = false;
    }
  }

  function setupSSE() {
    const eventSource = new EventSource('/api/logs/stream');
    
    eventSource.onmessage = (event) => {
      try {
        const logData = JSON.parse(event.data);
        appendLog(logData.level, logData.message, logData.timestamp);
      } catch (e) {
        // ignore malformed
      }
    };

    eventSource.onerror = () => {
      appendLog('error', 'Lost connection to log stream. Reconnecting...');
    };
  }

  function appendLog(level, message, timestamp = null) {
    const isScrolledToBottom = terminal.scrollHeight - terminal.clientHeight <= terminal.scrollTop + 10;
    
    // Remove the "Waiting for logs..." message
    if (terminal.children.length === 1 && terminal.children[0].textContent === 'Waiting for logs...') {
      terminal.innerHTML = '';
    }

    const line = document.createElement('div');
    line.className = `log-line ${level}`;
    
    const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    
    line.innerHTML = `<span class="log-time">[${timeStr}]</span>${escapeHtml(message)}`;
    terminal.appendChild(line);

    // Only keep last 200 lines to prevent DOM bloat
    if (terminal.children.length > 200) {
      terminal.removeChild(terminal.firstChild);
    }

    if (isScrolledToBottom) {
      terminal.scrollTop = terminal.scrollHeight;
    }
  }

  function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }
});
