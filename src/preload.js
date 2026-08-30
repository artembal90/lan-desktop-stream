const { contextBridge, ipcRenderer } = require('electron');

// Serialize diagnostic payloads without ever falling back to String(object).
// Circular references, BigInt and Error values are converted explicitly.
function normalizeLogData(data) {
  const seen = new WeakSet();
  const normalize = (value) => {
    if (value === undefined || value === null) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return `${value}n`;
    if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack, code: value.code };
    if (typeof value === 'object') {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
      if (Array.isArray(value)) return value.map(normalize);
      const out = {};
      for (const [key, item] of Object.entries(value)) {
        try { out[key] = normalize(item); } catch (error) { out[key] = `[Unserializable: ${error?.message || 'unknown'}]`; }
      }
      return out;
    }
    return String(value);
  };
  return normalize(data);
}

contextBridge.exposeInMainWorld('api', {
  getSources:()=>ipcRenderer.invoke('sources'),
  getWindowSources:()=>ipcRenderer.invoke('sources-windows'),
  loadConfig:()=>ipcRenderer.invoke('config-load'),
  saveConfig:c=>ipcRenderer.invoke('config-save',c),
  selectSource:id=>ipcRenderer.invoke('select-source',id),
  start:c=>ipcRenderer.invoke('start-server',c),
  stop:()=>ipcRenderer.invoke('stop-server'),
  disconnectReceiver:id=>ipcRenderer.invoke('disconnect-receiver',id),
  saveLogs:()=>ipcRenderer.invoke('save-logs'),
  getLogPath:()=>ipcRenderer.invoke('log-path'),
  log:(level,message,data)=>ipcRenderer.invoke('client-log',{level,message,data:normalizeLogData(data)}),
  onEvent:cb=>{const fn=(_e,m)=>cb(m);ipcRenderer.on('server-event',fn);return()=>ipcRenderer.removeListener('server-event',fn)}
});
