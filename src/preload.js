const { contextBridge, ipcRenderer } = require('electron');

// Keep diagnostic payloads as structured cloneable values. The main-process
// logger is responsible for JSON serialization so objects never become
// "[object Object]" on the way to the log file.
function normalizeLogData(data) {
  if (data === undefined || data === null) return data;
  if (data instanceof Error) return { name: data.name, message: data.message, stack: data.stack };
  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') return data;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (error) {
    return { value: String(data), serializationError: error?.message || String(error) };
  }
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