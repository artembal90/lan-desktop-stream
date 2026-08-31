const { contextBridge, ipcRenderer } = require("electron");

// Serialize diagnostic payloads without ever falling back to String(object).
function normalizeLogData(data) {
  const seen = new WeakSet();
  let remaining = 2048, remainingChars = 64000;
  const normalize = (value, depth = 0) => {
    if (--remaining < 0 || depth > 12) return "[Size limit]";
    if (value === undefined || value === null) return value;
    if (typeof value === "string") { const text = value.slice(0, Math.min(32000, remainingChars)); remainingChars -= text.length; return text; }
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "bigint") return `${value}n`;
    if (typeof value === "object") {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
      if (value instanceof Error) return normalize({ name: value.name, message: value.message, stack: value.stack, code: value.code }, depth + 1);
      if (Array.isArray(value)) return value.slice(0, 256).map((x) => normalize(x, depth + 1));
      const out = {};
      for (const key of Object.keys(value).slice(0, 256)) {
        if (key === "__proto__") continue;
        try { out[key] = /pin|token|password|secret/i.test(key) ? "[Redacted]" : normalize(value[key], depth + 1); }
        catch (error) { out[key] = `[Unserializable: ${error?.message || "unknown"}]`; }
      }
      return out;
    }
    return String(value);
  };
  return normalize(data);
}
contextBridge.exposeInMainWorld("api", {
  getSources: () => ipcRenderer.invoke("sources"),
  getWindowSources: () => ipcRenderer.invoke("sources-windows"),
  loadConfig: () => ipcRenderer.invoke("config-load"),
  saveConfig: (c) => ipcRenderer.invoke("config-save", c),
  selectSource: (id) => ipcRenderer.invoke("select-source", id),
  start: (c) => ipcRenderer.invoke("start-server", c),
  stop: () => ipcRenderer.invoke("stop-server"),
  disconnectReceiver: (id) => ipcRenderer.invoke("disconnect-receiver", id),
  saveLogs: () => ipcRenderer.invoke("save-logs"),
  getLogPath: () => ipcRenderer.invoke("log-path"),
  log: (level, message, data) => ipcRenderer.invoke("client-log", { level, message: normalizeLogData(message), data: normalizeLogData(data) }),
  onEvent: (cb) => { const fn = (_e, m) => cb(m); ipcRenderer.on("server-event", fn); return () => ipcRenderer.removeListener("server-event", fn); },
});
