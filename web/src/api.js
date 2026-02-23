const API_BASE = '/api';

export async function fetchProcesses() {
  const res = await fetch(`${API_BASE}/processes`);
  if (!res.ok) throw new Error(`Failed to fetch processes: ${res.status}`);
  return res.json();
}

export async function spawnProcess(name, directory) {
  const res = await fetch(`${API_BASE}/processes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, directory })
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

export async function fetchProposals() {
  const res = await fetch(`${API_BASE}/proposals`);
  if (!res.ok) throw new Error(`Failed to fetch proposals: ${res.status}`);
  return res.json();
}

export async function updateProposal(id, status) {
  const res = await fetch(`${API_BASE}/proposals/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to update proposal: ${res.status}`);
  }
  return res.json();
}

export async function deleteProposal(id) {
  const res = await fetch(`${API_BASE}/proposals/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to delete proposal: ${res.status}`);
  }
  return res.json();
}

// Projects, Files, Changes, Activity

export async function fetchProjects() {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  return res.json();
}

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

export async function fetchFiles(project) {
  const res = await fetch(`${API_BASE}/files/${encodeURIComponent(project)}`);
  if (!res.ok) throw new Error(`Failed to fetch files: ${res.status}`);
  return res.json();
}

export async function fetchChanges() {
  const res = await fetch(`${API_BASE}/changes`);
  if (!res.ok) throw new Error(`Failed to fetch changes: ${res.status}`);
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

// Push workflow

export async function fetchDocContext() {
  const res = await fetch(`${API_BASE}/doc-context`);
  if (!res.ok) throw new Error(`Failed to fetch doc context: ${res.status}`);
  return res.json();
}

export async function updateDocs(project) {
  const res = await fetch(`${API_BASE}/update-docs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to update docs: ${res.status}`);
  }
  return res.json();
}

export async function pushProject(project) {
  const res = await fetch(`${API_BASE}/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to push: ${res.status}`);
  }
  return res.json();
}
