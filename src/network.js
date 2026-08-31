const os = require("node:os");
const { execFile } = require("node:child_process");
function isPrivate(ip) {
  const p = String(ip || "").split(".").map(Number);
  return p.length === 4 && (p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168));
}
function interfaces() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces()))
    for (const n of list || [])
      if (n.family === "IPv4" && !n.internal && isPrivate(n.address)) out.push({ name, address: n.address, netmask: n.netmask });
  return out;
}
async function preferredLanIp() {
  const candidates = interfaces();
  const fallback = () => (candidates.find((x) => /ethernet|wi-fi|wifi|wireless/i.test(x.name)) || candidates[0])?.address || "127.0.0.1";
  if (process.platform !== "win32") return fallback();
  const ps = "Get-NetIPConfiguration | Where-Object {$_.IPv4DefaultGateway -and $_.IPv4Address} | ForEach-Object { $_.IPv4Address.IPAddress } | ConvertTo-Json -Compress";
  return new Promise((resolve) => execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { windowsHide: true, timeout: 5000 }, (error, out) => {
    try {
      const addresses = error ? [] : [].concat(JSON.parse(out));
      const preferred = fallback();
      resolve(addresses.includes(preferred) ? preferred : candidates.find((x) => addresses.includes(x.address))?.address || preferred);
    } catch { resolve(fallback()); }
  }));
}
async function addFirewallRule(port, policy, log) {
  if (process.platform !== "win32" || policy.address === "127.0.0.1") return false;
  const run = (args) => new Promise((resolve) => execFile("netsh", args, { windowsHide: true, timeout: 5000 }, (error) => resolve(!error)));
  await run(["advfirewall", "firewall", "delete", "rule", "name=LAN Desktop Stream"]);
  await run(["advfirewall", "firewall", "delete", "rule", "name=LAN Desktop Stream Private LAN"]);
  const ok = await run(["advfirewall", "firewall", "add", "rule", "name=LAN Desktop Stream Private LAN", "dir=in", "action=allow", "protocol=TCP", `localport=${port}`, "profile=private", `localip=${policy.address}`, `remoteip=${policy.address}/${policy.netmask}`, `program=${process.execPath}`]);
  log(ok ? "INFO" : "WARN", "Firewall rule result", { port, ok, profile: "private", address: policy.address });
  return ok;
}
module.exports = { interfaces, preferredLanIp, addFirewallRule };
