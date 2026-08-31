const fs = require("node:fs");
const path = require("node:path");

function normalizeLogData(data) {
  const seen = new WeakSet();
  let remaining = 2048,
    remainingChars = 64000;
  function normalize(value, depth = 0) {
    if (--remaining < 0) return "[Size limit]";
    if (value == null || typeof value === "boolean" || typeof value === "number") return value;
    if (typeof value === "string") {
      const text = value.slice(0, Math.min(32000, remainingChars));
      remainingChars -= text.length;
      return text;
    }
    if (typeof value === "bigint") return `${value}n`;
    if (typeof value !== "object") return String(value);
    if (seen.has(value)) return "[Circular]";
    if (depth > 12) return "[Max depth]";
    seen.add(value);
    if (value instanceof Error)
      return normalize({ name: value.name, message: value.message, stack: value.stack, code: value.code }, depth + 1);
    if (Array.isArray(value)) return value.slice(0, 256).map((x) => normalize(x, depth + 1));
    const out = {};
    for (const key of Object.keys(value).slice(0, 256)) {
      if (key === "__proto__") continue;
      try {
        out[key] = /pin|token|password|secret/i.test(key) ? "[Redacted]" : normalize(value[key], depth + 1);
      } catch { out[key] = "[Unserializable]"; }
    }
    return out;
  }
  return normalize(data);
}
function formatRecord(level, message, data, category = "MAIN") {
  level = ["INFO", "WARN", "ERROR", "STAT", "DEBUG"].includes(level) ? level : "INFO";
  const d = new Date(), pad = (n, w = 2) => String(n).padStart(w, "0");
  const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  const text = typeof message === "string" ? message : JSON.stringify(normalizeLogData(message));
  return `[${ts}] [${level}] [${category}] ${String(text || "").slice(0, 32000).replace(/[\r\n]/g, " ")}${data === undefined ? "" : " " + JSON.stringify(normalizeLogData(data))}\n`;
}
function createLogger(getPath, { maxFileBytes = 5 * 1024 * 1024, maxQueueBytes = 1024 * 1024, io = fs.promises } = {}) {
  const queue = [];
  let queuedBytes = 0, draining = null, closed = false, size = null;
  let dropped = 0, pendingDropped = 0, failures = 0, lastError = null;
  const recordLimit = Math.min(64 * 1024, maxFileBytes, maxQueueBytes);
  async function append(line) {
    const file = getPath();
    if (size === null) {
      await io.mkdir(path.dirname(file), { recursive: true });
      try { size = (await io.stat(file)).size; }
      catch (error) { if (error.code !== "ENOENT") throw error; size = 0; }
    }
    const bytes = Buffer.byteLength(line);
    if (size && size + bytes > maxFileBytes) {
      await io.rm(file + ".1", { force: true });
      await io.rename(file, file + ".1");
      size = 0;
    }
    await io.appendFile(file, line, "utf8");
    size += bytes;
  }
  function failed(error) { failures++; size = null; lastError = error; if (failures === 1) console.error("Log write failed:", error.message); }
  function pump() {
    if (draining) return;
    draining = Promise.resolve().then(async () => {
      while (queue.length || pendingDropped) {
        if (pendingDropped) {
          const count = pendingDropped; pendingDropped = 0;
          try { await append(formatRecord("WARN", "Log queue overflow", { dropped: count })); }
          catch (error) { failed(error); }
        }
        const item = queue.shift();
        if (!item) continue;
        if (item.exportTo) {
          try { if (lastError) throw lastError; await io.copyFile(getPath(), item.exportTo); item.resolve(); }
          catch (error) { item.reject(error); }
          continue;
        }
        queuedBytes -= item.bytes;
        let batch = item.line, batchBytes = item.bytes;
        while (queue[0]?.line && batchBytes + queue[0].bytes <= 64 * 1024 && (size || 0) + batchBytes + queue[0].bytes <= maxFileBytes) {
          const next = queue.shift(); queuedBytes -= next.bytes; batch += next.line; batchBytes += next.bytes;
        }
        try { await append(batch); } catch (error) { failed(error); }
      }
    }).finally(() => { draining = null; if (queue.length || pendingDropped) pump(); });
  }
  function log(level, message, data, category) {
    if (closed) return false;
    let line = formatRecord(level, message, data, category);
    if (Buffer.byteLength(line) > recordLimit) line = formatRecord(level, "Oversized log record omitted", { truncated: true }, category);
    const bytes = Buffer.byteLength(line), urgent = level === "ERROR" || level === "WARN";
    while (queuedBytes + bytes > maxQueueBytes && urgent) {
      const index = queue.findIndex((item) => item.line && !item.urgent);
      if (index < 0) break;
      queuedBytes -= queue.splice(index, 1)[0].bytes; dropped++; pendingDropped++;
    }
    if (queuedBytes + bytes > maxQueueBytes) { dropped++; pendingDropped++; pump(); return false; }
    queue.push({ line, bytes, urgent }); queuedBytes += bytes; pump(); return true;
  }
  log.flush = async () => { while (draining) await draining; if (lastError) throw lastError; };
  log.close = () => { closed = true; return log.flush(); };
  log.exportTo = (destination) => {
    if (closed) return Promise.reject(new Error("Logger is closed"));
    return new Promise((resolve, reject) => { queue.push({ exportTo: destination, resolve, reject }); pump(); });
  };
  log.status = () => ({ queuedBytes, dropped, failures, closed });
  return log;
}
module.exports = { createLogger, normalizeLogData, formatRecord };
