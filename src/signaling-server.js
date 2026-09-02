const http = require("node:http");
const crypto = require("node:crypto");
const express = require("express");
const WebSocket = require("ws");
const { normalizeIp, isLoopback } = require("./network-policy");
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const string = (value, max) => typeof value === "string" && value.length <= max;
const sameSecret = (a, b) => typeof a === "string" && Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
function validSignal(message, role) {
  if (!object(message)) return false;
  if (message.type === "ice") {
    const c = message.candidate;
    return object(c) && string(c.candidate, 4096) && (c.sdpMid == null || string(c.sdpMid, 128)) && (c.sdpMLineIndex == null || (Number.isInteger(c.sdpMLineIndex) && c.sdpMLineIndex >= 0 && c.sdpMLineIndex < 32));
  }
  const type = role === "host" ? "offer" : "answer";
  return message.type === type && object(message.sdp) && message.sdp.type === type && string(message.sdp.sdp, 100000);
}
function createSignalingServer({ policy, pin = "", receiverPath, onEvent = () => {}, log = () => {}, graceMs = 10000, bindAddress = "0.0.0.0" }) {
  const hostToken = crypto.randomBytes(32).toString("hex");
  const receivers = new Map(), byClient = new Map(), blocked = new Set(), grace = new Map(), rates = new Map();
  let host = null, stopping = false, listenPort;
  const list = () => [...receivers.values()].map((r) => r.info);
  const send = (socket, message) => { if (socket?.readyState === WebSocket.OPEN && socket.bufferedAmount < 1024 * 1024) socket.send(JSON.stringify(message)); };
  const changed = () => onEvent({ type: "receivers", receivers: list() });
  function bucket(ip) { const now = Date.now(); let value = rates.get(ip); if (!value || now - value.since >= 60000) { value = { since: now, upgrades: 0, failures: 0, messages: 0 }; if (rates.size >= 1024 && !rates.has(ip)) rates.delete(rates.keys().next().value); rates.set(ip, value); } return value; }
  function remove(id) { const receiver = receivers.get(id); if (!receiver) return; clearTimeout(grace.get(id)); grace.delete(id); receivers.delete(id); byClient.delete(receiver.info.clientId); changed(); send(host, { type: "receiver-left", receiverId: id }); }
  const ex = express();
  ex.disable("x-powered-by");
  ex.use((req, res, next) => { if (!policy.allows(req.socket.remoteAddress, req.socket.localAddress) || !policy.validHost(req.headers.host, listenPort)) return res.sendStatus(403); res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; media-src 'self' blob:; frame-ancestors *"); next(); });
  ex.use(express.static(receiverPath));
  const server = http.createServer(ex); server.requestTimeout = 10000; server.headersTimeout = 10000; server.maxConnections = 128;
  const wss = new WebSocket.Server({ noServer: true, maxPayload: 128 * 1024, perMessageDeflate: false });
  server.on("upgrade", (req, socket, head) => { const ip = normalizeIp(req.socket.remoteAddress), rate = bucket(ip); const allowedOrigin = policy.validReceiverOrigin(req.headers.origin, req.headers.host) || (isLoopback(ip) && ["null", "file://"].includes(req.headers.origin)); if (stopping || req.url !== "/signal" || !policy.allows(ip, req.socket.localAddress) || !policy.validHost(req.headers.host, listenPort) || !allowedOrigin || ++rate.upgrades > 30 || rate.failures >= 5 || wss.clients.size >= 64) { socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); return; } wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req)); });
  wss.on("connection", (ws, req) => {
    const ip = normalizeIp(req.socket.remoteAddress); let role = "", id = null, dead = false, count = 0, since = Date.now();
    const joinTimer = setTimeout(() => reject(4003, "Join timeout"), 5000);
    const reject = (code, reason, message) => { if (dead) return; dead = true; clearTimeout(joinTimer); if (message) send(ws, message); ws.close(code, reason); const timer = setTimeout(() => ws.terminate(), 1000); timer.unref(); ws.once("close", () => clearTimeout(timer)); };
    ws.on("error", (error) => log("WARN", "Signaling socket error", { message: error.message }));
    ws.on("message", (raw, binary) => {
      if (dead || stopping) return; if (Date.now() - since >= 10000) { count = 0; since = Date.now(); } if (binary || ++count > 300 || ++bucket(ip).messages > 1800) return reject(4008, "Rate limit");
      let m; try { m = JSON.parse(raw.toString()); } catch { return reject(4003, "Invalid JSON"); } if (!object(m)) return reject(4003, "Invalid message");
      if (m.type === "join") {
        if (role) return reject(4003, "Already joined");
        if (m.role === "host") {
          const localHostOrigin = isLoopback(ip) && ["null", "file://"].includes(req.headers.origin);
          const tokenValid = sameSecret(m.token, hostToken);
          if (!localHostOrigin || (m.token != null && !tokenValid) || host) { bucket(ip).failures++; return reject(4003, "Host authentication rejected"); }
          if (m.token == null) log("WARN", "Host connected without token; local Electron origin accepted", { ip });
          role = "host"; host = ws; clearTimeout(joinTimer); send(ws, { type: "host-ready" }); for (const r of receivers.values()) send(ws, { type: "receiver-joined", receiver: r.info }); return;
        }
        if (m.role !== "receiver" || !policy.validReceiverOrigin(req.headers.origin, req.headers.host) || !string(m.clientId, 128) || !/^[a-zA-Z0-9_-]{8,128}$/.test(m.clientId) || !string(m.name, 40) || !string(m.pin, 128)) return reject(4003, "Invalid join");
        if (bucket(ip).failures >= 5 || (pin && !sameSecret(m.pin, pin))) { bucket(ip).failures++; return reject(4003, "Authentication failed", { type: "auth-error", message: "Неверный PIN или слишком много попыток. Повторите через минуту." }); }
        if (blocked.has(m.clientId)) return reject(4000, "Blocked", { type: "kicked", message: "Этот приёмник отключён источником" });
        const oldId = byClient.get(m.clientId), old = receivers.get(oldId); if (old && !sameSecret(m.resumeToken, old.resumeToken)) return reject(4002, "Session already active");
        role = "receiver"; clearTimeout(joinTimer); id = oldId || crypto.randomUUID(); const info = { id, clientId: m.clientId, name: m.name || "Browser", ip }; const resumeToken = old?.resumeToken || crypto.randomBytes(32).toString("hex"); clearTimeout(grace.get(id)); grace.delete(id); receivers.set(id, { ws, info, resumeToken }); byClient.set(m.clientId, id); if (old) old.ws.close(4002, "Replaced by reconnect"); send(ws, { type: "joined", id, resumeToken, reconnected: !!old }); changed(); send(host, { type: "receiver-joined", receiver: info, reconnected: !!old }); return;
      }
      if (role === "host" && host === ws) { if (!string(m.receiverId, 128) || !validSignal(m.payload, "host")) return reject(4003, "Invalid host signal"); send(receivers.get(m.receiverId)?.ws, m.payload); }
      else if (role === "receiver" && receivers.get(id)?.ws === ws) { if (!validSignal(m, "receiver")) return reject(4003, "Invalid receiver signal"); send(host, { type: "receiver-signal", receiverId: id, payload: m }); }
      else reject(4003, "Join required");
    });
    ws.on("close", () => { dead = true; clearTimeout(joinTimer); if (host === ws) host = null; if (!stopping && id && receivers.get(id)?.ws === ws) grace.set(id, setTimeout(() => { if (receivers.get(id)?.ws === ws) remove(id); }, graceMs)); });
  });
  server.on("error", (error) => log("ERROR", "HTTP server error", { message: error.message }));
  return { hostToken, server, list,
    async start(port) { await new Promise((resolve, reject) => { const fail = (error) => { server.off("listening", ready); reject(error); }; const ready = () => { server.off("error", fail); listenPort = server.address().port; resolve(); }; server.once("error", fail); server.once("listening", ready); server.listen(port, bindAddress); }); return listenPort; },
    disconnect(id) { const r = receivers.get(id); if (!r) return false; blocked.add(r.info.clientId); remove(id); send(r.ws, { type: "kicked", message: "Источник отключил этот приёмник" }); r.ws.close(4000, "Disconnected by host"); return true; },
    async stop() { stopping = true; for (const timer of grace.values()) clearTimeout(timer); grace.clear(); receivers.clear(); byClient.clear(); blocked.clear(); host = null; for (const client of wss.clients) { client.close(1001, "Server stopping"); client.terminate(); } await new Promise((resolve) => wss.close(resolve)); await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }); changed(); },
  };
}
module.exports = { createSignalingServer, validSignal };
