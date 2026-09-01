// Electron metrics include renderer/GPU processes; main-process cpuUsage alone does not.
function startRuntimeMonitor(app, log) {
  if (!app.getAppMetrics) return () => {};
  app.getAppMetrics();
  let sampledAt = performance.now();
  const timer = setInterval(() => {
    try {
      const now = performance.now();
      const processes = app.getAppMetrics().map((item) => ({
        pid: item.pid,
        type: item.type,
        cpuPercent: item.cpu.percentCPUUsage,
        workingSetKiB: item.memory.workingSetSize,
      }));
      log(
        "STAT",
        "Electron process metrics",
        {
          sampleSeconds: (now - sampledAt) / 1000,
          cpuPercentSum: processes.reduce((sum, p) => sum + p.cpuPercent, 0),
          workingSetKiBSum: processes.reduce(
            (sum, p) => sum + p.workingSetKiB,
            0,
          ),
          processes,
          logger: log.status(),
        },
        "RUNTIME",
      );
      sampledAt = now;
    } catch (error) {
      log("WARN", "Runtime metrics failed", error);
    }
  }, 10000);
  timer.unref?.();
  return () => clearInterval(timer);
}
module.exports = { startRuntimeMonitor };
