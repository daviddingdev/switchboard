const API_BASE = '/api';

function apiFetch(url, options = {}) {
  return fetch(url, { credentials: 'include', ...options });
}

export async function fetchSetupStatus() {
  const res = await apiFetch(`${API_BASE}/setup/status`);
  if (!res.ok) throw new Error('Failed to check setup status');
  return res.json();
}

export async function completeSetup(password, soul, infrastructure, contributor) {
  const res = await apiFetch(`${API_BASE}/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password: password || null,
      soul: soul || null,
      infrastructure: infrastructure || null,
      contributor: contributor || false,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Setup failed');
  }
  return res.json();
}

export async function applyGlobalConfig(soulPath, infrastructurePath) {
  const res = await apiFetch(`${API_BASE}/setup/apply-global`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      soul_path: soulPath || null,
      infrastructure_path: infrastructurePath || null,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to apply global config');
  }
  return res.json();
}

export async function fetchAuthStatus() {
  const res = await apiFetch(`${API_BASE}/auth/status`);
  if (!res.ok) throw new Error(`Failed to check auth: ${res.status}`);
  return res.json();
}

export async function login(password) {
  const res = await apiFetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Login failed');
  }
  return res.json();
}

export async function logout() {
  const res = await apiFetch(`${API_BASE}/logout`, { method: 'POST' });
  if (!res.ok) throw new Error('Logout failed');
  return res.json();
}

export async function fetchProcesses() {
  const res = await apiFetch(`${API_BASE}/processes`);
  if (!res.ok) throw new Error(`Failed to fetch processes: ${res.status}`);
  return res.json();
}

export async function fetchModels() {
  const res = await apiFetch(`${API_BASE}/models`);
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  return res.json();
}

export async function spawnProcess(name, directory, model) {
  const body = { name, directory };
  if (model) body.model = model;
  const res = await apiFetch(`${API_BASE}/processes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to spawn process: ${res.status}`);
  }
  return res.json();
}

export async function killProcess(name) {
  const res = await apiFetch(`${API_BASE}/processes/${encodeURIComponent(name)}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to kill process: ${res.status}`);
  }
  return res.json();
}

export async function sendToProcess(name, text, raw = false) {
  const res = await apiFetch(`${API_BASE}/processes/${encodeURIComponent(name)}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, raw })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to send to process: ${res.status}`);
  }
  return res.json();
}

export async function getOutput(name, lines = 50) {
  const res = await apiFetch(
    `${API_BASE}/processes/${encodeURIComponent(name)}/output?lines=${lines}`
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to get output: ${res.status}`);
  }
  return res.json();
}

export async function fetchProjects() {
  const res = await apiFetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  return res.json();
}

// Projects, Files, Changes, Activity

export async function initProject(directory) {
  const res = await apiFetch(`${API_BASE}/projects/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directory }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to initialize project');
  }
  return res.json();
}

export async function fetchPrerequisites() {
  const res = await apiFetch(`${API_BASE}/prerequisites`);
  if (!res.ok) throw new Error(`Failed to check prerequisites: ${res.status}`);
  return res.json();
}

export async function fetchHealth() {
  const res = await apiFetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Failed to fetch health: ${res.status}`);
  return res.json();
}

export async function fetchHome() {
  const res = await apiFetch(`${API_BASE}/home`);
  if (!res.ok) throw new Error(`Failed to fetch home: ${res.status}`);
  return res.json();
}

export async function fetchFileContent(filepath) {
  const res = await apiFetch(`${API_BASE}/file?path=${encodeURIComponent(filepath)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch file: ${res.status}`);
  }
  return res.json();
}

export async function fetchActivity() {
  const res = await apiFetch(`${API_BASE}/activity`);
  if (!res.ok) throw new Error(`Failed to fetch activity: ${res.status}`);
  return res.json();
}

export async function fetchDiff(project, path) {
  const res = await apiFetch(
    `${API_BASE}/diff?project=${encodeURIComponent(project)}&path=${encodeURIComponent(path)}`
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch diff: ${res.status}`);
  }
  return res.json();
}

export async function pushProject(project) {
  const res = await apiFetch(`${API_BASE}/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to push: ${res.status}`);
  }
  return res.json();
}

export async function updateProposal(id, status) {
  const res = await apiFetch(`${API_BASE}/proposals/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to update proposal: ${res.status}`);
  }
  return res.json();
}

export async function saveFile(filepath, content) {
  const res = await apiFetch(`${API_BASE}/file`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filepath, content }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to save file: ${res.status}`);
  }
  return res.json();
}

export async function fetchWorkerLogs(name) {
  const res = await apiFetch(`${API_BASE}/logs/${encodeURIComponent(name)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch logs: ${res.status}`);
  }
  return res.json();
}

export async function fetchLogFile(name, filename, tail = 500) {
  const res = await apiFetch(
    `${API_BASE}/logs/${encodeURIComponent(name)}/${encodeURIComponent(filename)}?tail=${tail}`
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch log file: ${res.status}`);
  }
  return res.json();
}

// Workers usage

export async function fetchWorkersUsage() {
  const res = await apiFetch(`${API_BASE}/workers/usage`);
  if (!res.ok) throw new Error(`Failed to fetch workers usage: ${res.status}`);
  return res.json();
}

// System metrics

export async function fetchMetrics() {
  const res = await apiFetch(`${API_BASE}/metrics`);
  if (!res.ok) throw new Error(`Failed to fetch metrics: ${res.status}`);
  return res.json();
}

// System updates

export async function fetchSystemUpdates() {
  const res = await apiFetch(`${API_BASE}/system/updates`);
  if (!res.ok) throw new Error(`Failed to fetch system updates: ${res.status}`);
  return res.json();
}

export async function triggerSystemUpdate(categories) {
  const res = await apiFetch(`${API_BASE}/system/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to trigger update: ${res.status}`);
  }
  return res.json();
}

// Usage analytics

export async function fetchUsage() {
  const res = await apiFetch(`${API_BASE}/usage`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch usage: ${res.status}`);
  }
  return res.json();
}

export async function refreshUsage() {
  const res = await apiFetch(`${API_BASE}/usage/refresh`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to refresh usage: ${res.status}`);
  }
  return res.json();
}
