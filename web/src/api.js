const API_BASE = '/api';

export async function fetchProcesses() {
  const res = await fetch(`${API_BASE}/processes`);
  if (!res.ok) throw new Error(`Failed to fetch processes: ${res.status}`);
  return res.json();
}

export async function fetchModels() {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  return res.json();
}

export async function spawnProcess(name, directory, model) {
  const body = { name, directory };
  if (model) body.model = model;
  const res = await fetch(`${API_BASE}/processes`, {
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
  const res = await fetch(`${API_BASE}/processes/${encodeURIComponent(name)}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to kill process: ${res.status}`);
  }
  return res.json();
}

export async function sendToProcess(name, text, raw = false) {
  const res = await fetch(`${API_BASE}/processes/${encodeURIComponent(name)}/send`, {
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
  const res = await fetch(
    `${API_BASE}/processes/${encodeURIComponent(name)}/output?lines=${lines}`
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to get output: ${res.status}`);
  }
  return res.json();
}

export async function fetchProjects() {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  return res.json();
}

// Projects, Files, Changes, Activity

export async function fetchHome() {
  const res = await fetch(`${API_BASE}/home`);
  if (!res.ok) throw new Error(`Failed to fetch home: ${res.status}`);
  return res.json();
}

export async function fetchFileContent(filepath) {
  const res = await fetch(`${API_BASE}/file?path=${encodeURIComponent(filepath)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch file: ${res.status}`);
  }
  return res.json();
}

export async function fetchActivity() {
  const res = await fetch(`${API_BASE}/activity`);
  if (!res.ok) throw new Error(`Failed to fetch activity: ${res.status}`);
  return res.json();
}

export async function fetchDiff(project, path) {
  const res = await fetch(
    `${API_BASE}/diff?project=${encodeURIComponent(project)}&path=${encodeURIComponent(path)}`
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch diff: ${res.status}`);
  }
  return res.json();
}

// Workers usage

export async function fetchWorkersUsage() {
  const res = await fetch(`${API_BASE}/workers/usage`);
  if (!res.ok) throw new Error(`Failed to fetch workers usage: ${res.status}`);
  return res.json();
}

// System metrics

export async function fetchMetrics() {
  const res = await fetch(`${API_BASE}/metrics`);
  if (!res.ok) throw new Error(`Failed to fetch metrics: ${res.status}`);
  return res.json();
}

// System updates

export async function fetchSystemUpdates() {
  const res = await fetch(`${API_BASE}/system/updates`);
  if (!res.ok) throw new Error(`Failed to fetch system updates: ${res.status}`);
  return res.json();
}

export async function triggerSystemUpdate(categories) {
  const res = await fetch(`${API_BASE}/system/update`, {
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
  const res = await fetch(`${API_BASE}/usage`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch usage: ${res.status}`);
  }
  return res.json();
}

export async function refreshUsage() {
  const res = await fetch(`${API_BASE}/usage/refresh`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to refresh usage: ${res.status}`);
  }
  return res.json();
}
