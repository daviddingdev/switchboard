import React, { useState } from 'react';

const OrchestratorPartner = () => {
  const [input, setInput] = useState('');
  const [selectedProcess, setSelectedProcess] = useState('family-vault');
  
  const [conversation, setConversation] = useState([
    { role: 'user', content: 'Start up family-vault and research workers' },
    { role: 'partner', content: 'Spawning workers...\n\n✓ family-vault worker started (tmux:1)\n✓ research worker started (tmux:2)\n\nBoth are loading their project context.' },
    { role: 'system', content: 'family-vault is ready', type: 'status' },
    { role: 'system', content: 'research is ready', type: 'status' },
    { role: 'user', content: 'Tell family-vault to prepare a deploy plan for mom' },
    { role: 'partner', content: 'Sent to family-vault. Waiting for plan...' },
    { role: 'plan', project: 'family-vault', content: {
        title: 'Deploy to Mom',
        steps: ['Run final UI tests', 'Build production bundle', 'Deploy to Spark (port 5000)', 'Send mom the link'],
        estimate: '25 min', risk: 'low', notes: 'Deploying at 10am EST so mom is awake'
    }},
    { role: 'partner', content: 'Family-vault has a deploy plan ready. Looks solid — straightforward deploy, low risk.\n\nApprove to execute?' }
  ]);

  const [processes] = useState([
    { id: 'family-vault', name: 'family-vault', status: 'running', children: [
      { id: 'fv-tests', name: 'pytest', status: 'complete', progress: '12/12' },
      { id: 'fv-build', name: 'npm build', status: 'running', progress: '67%' }
    ], output: ['> claude: Ready.', '> Received: prepare deploy plan', '> pytest: 12/12 passed ✓', '> npm: building... 67%'] },
    { id: 'research', name: 'research', status: 'idle', children: [], output: ['> claude: Ready. Awaiting instructions.'] },
    { id: 'system', name: 'system', status: 'stopped', children: [], output: [] }
  ]);

  const statusColors = { running: '#22c55e', idle: '#f59e0b', stopped: '#52525b', complete: '#22c55e' };

  return (
    <div style={{ height: '100vh', backgroundColor: '#09090b', color: '#e4e4e7', fontFamily: 'monospace', display: 'grid', gridTemplateColumns: '1fr 320px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #27272a' }}>
        <header style={{ padding: '12px 20px', borderBottom: '1px solid #27272a', background: '#0c0c0f' }}>
          <span style={{ fontSize: '13px', color: '#a1a1aa' }}>ORCHESTRATOR</span>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {conversation.map((msg, i) => (
            msg.role === 'plan' ? (
              <div key={i} style={{ background: '#0f0f12', border: '1px solid #3f3f46', borderLeft: '3px solid #f59e0b', padding: '16px', margin: '16px 0 16px 40px' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>{msg.content.title}</div>
                <div style={{ background: '#18181b', padding: '12px', marginBottom: '12px' }}>
                  {msg.content.steps.map((step, j) => <div key={j} style={{ fontSize: '12px', color: '#a1a1aa', padding: '4px 0' }}>{j+1}. {step}</div>)}
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 14px', fontSize: '11px' }}>Reject</button>
                  <button style={{ background: '#22c55e', border: 'none', color: '#09090b', padding: '6px 14px', fontSize: '11px', fontWeight: '600' }}>Approve</button>
                </div>
              </div>
            ) : msg.type === 'status' ? (
              <div key={i} style={{ fontSize: '11px', color: '#52525b', textAlign: 'center', padding: '4px 0' }}>{msg.content}</div>
            ) : (
              <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: msg.role === 'user' ? '#3b82f6' : '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#fff' }}>
                  {msg.role === 'user' ? 'Y' : 'P'}
                </div>
                <div style={{ flex: 1, background: '#0f0f12', padding: '12px 16px', border: '1px solid #27272a' }}>
                  <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '6px' }}>{msg.role === 'user' ? 'You' : 'Partner'}</div>
                  <div style={{ fontSize: '13px', color: '#d4d4d8', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                </div>
              </div>
            )
          ))}
        </div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid #27272a', background: '#0c0c0f', display: 'flex', gap: '8px' }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Talk to partner..." style={{ flex: 1, background: '#18181b', border: '1px solid #27272a', color: '#e4e4e7', padding: '12px 16px', fontSize: '13px' }} />
          <button style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '12px 20px', fontSize: '12px' }}>Send</button>
        </div>
      </div>
      <aside style={{ display: 'flex', flexDirection: 'column', background: '#0c0c0f' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #27272a' }}>
          <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '12px' }}>PROCESSES</div>
          {processes.map(proc => (
            <div key={proc.id}>
              <div onClick={() => setSelectedProcess(proc.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: selectedProcess === proc.id ? '#27272a' : 'transparent', cursor: 'pointer' }}>
                <span style={{ color: statusColors[proc.status], fontSize: '10px' }}>{proc.children.length > 0 ? '▼' : '▶'}</span>
                <span style={{ fontSize: '12px', color: '#a1a1aa', flex: 1 }}>{proc.name}</span>
                <span style={{ fontSize: '8px', color: statusColors[proc.status] }}>●</span>
              </div>
              {proc.children.map(child => (
                <div key={child.id} style={{ padding: '6px 10px 6px 32px', fontSize: '11px', color: '#71717a', display: 'flex' }}>
                  <span style={{ flex: 1 }}>{child.name}</span>
                  <span style={{ color: statusColors[child.status] }}>{child.progress || '✓'}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: '16px' }}>
          <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '8px' }}>TERMINAL: {selectedProcess}</div>
          <div style={{ background: '#09090b', border: '1px solid #27272a', padding: '12px', fontSize: '11px', color: '#a1a1aa', height: '200px', overflow: 'auto' }}>
            {processes.find(p => p.id === selectedProcess)?.output.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
      </aside>
    </div>
  );
};

export default OrchestratorPartner;
