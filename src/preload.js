const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  getSources:()=>ipcRenderer.invoke('sources'),
  loadConfig:()=>ipcRenderer.invoke('config-load'),
  saveConfig:c=>ipcRenderer.invoke('config-save',c),
  selectSource:id=>ipcRenderer.invoke('select-source',id),
  start:c=>ipcRenderer.invoke('start-server',c),
  stop:()=>ipcRenderer.invoke('stop-server'),
  disconnectReceiver:id=>ipcRenderer.invoke('disconnect-receiver',id),
  onEvent:cb=>{const fn=(_e,m)=>cb(m);ipcRenderer.on('server-event',fn);return()=>ipcRenderer.removeListener('server-event',fn)}
});
