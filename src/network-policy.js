const net = require("node:net");
const normalizeIp = (ip) => String(ip || "").replace(/^::ffff:/, "");
const isLoopback = (ip) => ["127.0.0.1", "::1"].includes(normalizeIp(ip));
function ipv4(ip) { if (net.isIP(ip) !== 4) return null; return ip.split(".").reduce((n, part) => ((n << 8) | Number(part)) >>> 0, 0); }
function createNetworkPolicy(address, netmask = "255.255.255.255") {
  const local = ipv4(address), mask = ipv4(netmask);
  if (local === null || mask === null || mask === 0) throw new Error("Invalid LAN interface");
  return { address, netmask,
    allows(remote, destination) { remote = normalizeIp(remote); destination = normalizeIp(destination); if (isLoopback(remote)) return isLoopback(destination); const value = ipv4(remote); return destination === address && value !== null && (value & mask) === (local & mask); },
    validHost(host, port) { return [address, "127.0.0.1", "localhost"].some((name) => host === `${name}:${port}`); },
    validReceiverOrigin(origin, host) { return origin === `http://${host}`; },
  };
}
module.exports = { createNetworkPolicy, normalizeIp, isLoopback };
