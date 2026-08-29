const { contextBridge, ipcRenderer } = require('electron');
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
  log:(level,message,data)=>ipcRenderer.invoke('client-log',{level,message,data}),
  onEvent:cb=>{const fn=(_e,m)=>cb(m);ipcRenderer.on('server-event',fn);return()=>ipcRenderer.removeListener('server-event',fn)}
});