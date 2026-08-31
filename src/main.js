const {
  app,
  BrowserWindow,
  desktopCapturer,
  session,
  ipcMain,
  Tray,
  Menu,
  dialog,
} = require("electron");
const path = require("node:path"),
  os = require("node:os");
const { pathToFileURL } = require("node:url");
const { interfaces, preferredLanIp, addFirewallRule } = require("./network");
const QRCode = require("qrcode");
const { createSignalingServer } = require("./signaling-server");
const { createNetworkPolicy } = require("./network-policy");
const { createLogger } = require("./logger");
const { startRuntimeMonitor } = require("./runtime-monitor");
let win, tray, activeServer = null, startOperation = null, stopOperation = null, serverInfo = null;
let selectedSourceId = "", forceQuit = false, quitReady = false, quitting = false;
let stopRuntimeMonitor = () => {};
const sourceCache = new Map();
const resource = (p) => app.isPackaged ? path.join(process.resourcesPath, p) : path.join(__dirname, "..", p);
const hostFile = path.join(__dirname, "..", "web", "host", "index.html");
const cfgPath = () => path.join(app.getPath("userData"), "config.json");
const logPath = () => path.join(app.getPath("userData"), "lan-desktop-stream.log");
const log = createLogger(logPath);
const { load, save } = require("./settings").createConfigStore(cfgPath, log);
function event(message) { if (win && !win.isDestroyed()) win.webContents.send("server-event", message); }
function start(value) {
  if (stopOperation) return Promise.reject(new Error("Сервер ещё останавливается"));
  if (startOperation) return startOperation;
  if (activeServer) return Promise.resolve(serverInfo);
  startOperation = (async () => {
    const c = save(value), ip = await preferredLanIp();
    const adapter = interfaces().find((x) => x.address === ip);
    const policy = createNetworkPolicy(ip, adapter?.netmask);
    const next = createSignalingServer({ policy, pin: c.pin, receiverPath: path.join(__dirname, "..", "web", "receiver"), onEvent: event, log });
    try {
      await next.start(c.port);
      const url = `http://${ip}:${c.port}/`, qr = await QRCode.toDataURL(url);
      const firewallAdded = await addFirewallRule(c.port, policy, log);
      activeServer = next;
      serverInfo = { url, ip, hostname: os.hostname(), port: c.port, qr, firewallAdded, hostToken: next.hostToken };
      log("INFO", "Server started", { url, netmask: policy.netmask });
      return serverInfo;
    } catch (error) { await next.stop(); throw error; }
  })().finally(() => { startOperation = null; });
  return startOperation;
}
function stop() {
  if (stopOperation) return stopOperation;
  stopOperation = (async () => {
    if (startOperation) await startOperation.catch(() => {});
    const old = activeServer; activeServer = null; serverInfo = null;
    if (old) await old.stop();
    log("INFO", "Server stopped");
  })().finally(() => { stopOperation = null; });
  return stopOperation;
}
async function saveLogs() {
  try {
    const result = await dialog.showSaveDialog(win, { title: "Сохранить логи LAN Desktop Stream", defaultPath: path.join(app.getPath("documents"), "LAN-Desktop-Stream.log"), filters: [{ name: "Log files", extensions: ["log"] }] });
    if (result.canceled || !result.filePath) return false;
    await log.exportTo(result.filePath); return true;
  } catch (error) { log("ERROR", "Log export failed", error); return false; }
}
function trusted(e) { return e.sender === win?.webContents && e.senderFrame === win.webContents.mainFrame && e.senderFrame.url === pathToFileURL(hostFile).href; }
function handle(channel, fn) { ipcMain.handle(channel, (e, ...args) => { if (!trusted(e)) throw new Error("Untrusted IPC sender"); return fn(...args); }); }
async function enumerateSources(types) {
  const list = await desktopCapturer.getSources({ types, fetchWindowIcons: false });
  for (const [id] of sourceCache) if (types.includes(id.startsWith("screen:") ? "screen" : "window")) sourceCache.delete(id);
  for (const item of list) sourceCache.set(item.id, item);
  return list;
}
const sourceMeta = (x) => ({ id: x.id, name: x.name, display_id: x.display_id, thumbnail: x.thumbnail?.toDataURL?.() || "" });
function captureResponse(request, source, platform = process.platform) { return { video: source, ...(request.audioRequested && platform === "win32" ? { audio: "loopback" } : {}) }; }
app.whenReady().then(() => {
  stopRuntimeMonitor = startRuntimeMonitor(app, log);
  log("INFO", "Application started", { version: app.getVersion(), platform: process.platform, arch: process.arch });
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      if (request.frame !== win?.webContents.mainFrame || request.frame.url !== pathToFileURL(hostFile).href) return callback({});
      const id = selectedSourceId;
      const sources = await enumerateSources([id.startsWith("screen:") ? "screen" : "window"]);
      const source = sources.find((x) => x.id === id);
      if (!source) throw new Error("Выбранный источник больше недоступен. Обновите список.");
      callback(captureResponse(request, source));
    } catch (error) { log("ERROR", "Display source resolution failed", error); callback({}); }
  });
  handle("sources", async () => (await enumerateSources(["screen"])).map(sourceMeta));
  handle("sources-windows", async () => (await enumerateSources(["window"])).map(sourceMeta));
  handle("config-load", load);
  handle("config-save", (c) => { save(c); return true; });
  handle("select-source", (id) => { if (typeof id !== "string" || !sourceCache.has(id)) throw new Error("Источник не найден"); selectedSourceId = id; return true; });
  handle("start-server", start);
  handle("stop-server", stop);
  handle("disconnect-receiver", (id) => activeServer?.disconnect(String(id)) || false);
  handle("client-log", (payload) => { if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false; log(payload.level, payload.message, payload.data, "HOST"); return true; });
  handle("save-logs", saveLogs);
  handle("log-path", logPath);
  handle("network-info", async () => ({ ip: await preferredLanIp(), hostname: os.hostname(), interfaces: interfaces() }));
  win = new BrowserWindow({ width: 1120, height: 820, backgroundColor: "#0d1015", webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.on("render-process-gone", () => { stop().catch((error) => log("ERROR", "Renderer crash cleanup failed", error)); });
  win.loadFile(hostFile);
  win.on("close", (e) => { if (!forceQuit) { e.preventDefault(); win.hide(); } });
  win.on("closed", () => { win = null; });
  try {
    tray = new Tray(resource("app_icon_monitor.ico")); tray.setToolTip("LAN Desktop Stream");
    const show = () => { win?.show(); win?.restore(); win?.focus(); };
    tray.setContextMenu(Menu.buildFromTemplate([{ label: "Показать LAN Desktop Stream", click: show }, { label: "Сохранить логи", click: saveLogs }, { type: "separator" }, { label: "Выход", click: () => app.quit() }]));
    tray.on("double-click", show);
  } catch (error) { log("ERROR", "Tray initialization failed", error); }
}).catch((error) => { log("ERROR", "Application initialization failed", error); app.quit(); });
app.on("window-all-closed", () => {});
app.on("before-quit", (e) => {
  forceQuit = true;
  if (quitReady) return;
  e.preventDefault();
  if (quitting) return;
  quitting = true; stopRuntimeMonitor(); event({ type: "shutdown" });
  stop().catch((error) => log("ERROR", "Shutdown cleanup failed", error)).then(async () => {
    if (win && !win.isDestroyed()) win.destroy();
    log("INFO", "Application stopped");
    try { await log.close(); } catch (error) { console.error("Log shutdown failed:", error.message); }
    quitReady = true; tray?.destroy(); app.quit();
  });
});
process.on("uncaughtException", (error) => { log("ERROR", "uncaughtException", error); app.quit(); });
process.on("unhandledRejection", (error) => log("ERROR", "unhandledRejection", error));
module.exports = { captureResponse, log };
