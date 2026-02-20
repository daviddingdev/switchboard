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

export async function sendToProcess(name, text) {
  const res = await fetch(`${API_BASE}/processes/${encodeURIComponent(name)}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
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

export async function fetchPlans() {
  const res = await fetch(`${API_BASE}/plans`);
  if (!res.ok) throw new Error(`Failed to fetch plans: ${res.status}`);
  return res.json();
}

export async function updatePlan(id, status) {
  const res = await fetch(`${API_BASE}/plans/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to update plan: ${res.status}`);
  }
  return res.json();
}
