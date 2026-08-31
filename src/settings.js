const fs = require("node:fs");
const path = require("node:path");
function createConfigStore(cfgPath, log) {
  const defaults = { port: 8080, resolution: "1280x720", fps: 30, bitrate: 6000000, totalBitrate: 10000000, quality: "balanced", audio: false, autoStart: false, detailedDiagnostics: false, pin: "" };
  function config(value) {
    const c = { ...defaults, ...value };
    if (!Number.isInteger(c.port) || c.port < 1 || c.port > 65535) throw new Error("Некорректный порт");
    if (!["1280x720", "1920x1080", "2560x1440", "3840x2160"].includes(c.resolution) || ![30, 60, 90, 120, 144].includes(c.fps) || !Number.isFinite(c.bitrate) || c.bitrate < 250000 || c.bitrate > 100000000 || !Number.isFinite(c.totalBitrate) || c.totalBitrate < 250000 || c.totalBitrate > 100000000 || typeof c.pin !== "string" || c.pin.length > 128) throw new Error("Некорректные настройки трансляции");
    return { ...c, audio: !!c.audio, detailedDiagnostics: c.detailedDiagnostics === true };
  }
  function load() { try { return config(JSON.parse(fs.readFileSync(cfgPath(), "utf8"))); } catch { return { ...defaults }; } }
  function save(value) { const c = config(value); fs.mkdirSync(path.dirname(cfgPath()), { recursive: true }); fs.writeFileSync(cfgPath(), JSON.stringify(c, null, 2)); log("INFO", "Configuration saved", { port: c.port, resolution: c.resolution, fps: c.fps, bitrate: c.bitrate }); return c; }
  return { load, save };
}
module.exports = { createConfigStore };
