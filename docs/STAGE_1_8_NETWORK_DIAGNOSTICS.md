# Stage 1.8 — Real per-receiver network diagnostics

## Goal
Make network load measurable per receiver so future optimization is based on actual traffic rather than configured target values.

### 1.8.1 — Actual receiver bitrate
- Display the measured bitrate for every connected receiver.
- Do not show only the configured/target bitrate.
- Update periodically while streaming.

### 1.8.2 — Actual receiver FPS
- Display effective measured FPS for every receiver.
- Distinguish configured FPS from effective FPS.

### 1.8.3 — Connection quality metrics
For each receiver, expose where available:
- RTT/latency;
- packet loss;
- connection state;
- adaptive state (`normal`, `congested`, `congested2`).

### 1.8.4 — Aggregate network load
- Calculate total actual outbound bitrate as the sum of active receivers' measured bitrates.
- Display aggregate load separately from configured source bitrate.
- Use aggregate load as a diagnostic indicator for network overload.

### 1.8.5 — Diagnostic history/logging
- Log periodic per-receiver bitrate/FPS measurements.
- Log aggregate bitrate.
- Log quality changes and adaptive transitions.
- Keep logging lightweight to avoid adding significant CPU/network load.

### 1.8.6 — Future optimization support
Diagnostics must allow us to determine whether overload is caused by:
- excessive source bitrate;
- multiple receivers;
- reconnect storms;
- network quality degradation;
- incorrect adaptive behavior.

### 1.8.7 — PC-local log time synchronization
- All user-facing log timestamps must use the local Windows system time of the PC running the application.
- Use a single unambiguous format: `YYYY-MM-DD HH:mm:ss.SSS`.
- Preserve milliseconds for correlating connection, adaptive, WebRTC and error events.
- Apply the same local-time convention to server logs, receiver events, diagnostics, WebRTC statistics, adaptive transitions, connections, reconnects and errors.
- Do not silently mix UTC timestamps into the user-facing log.
- Where cross-PC correlation is needed, expose the local UTC offset separately rather than replacing the local timestamp.

## Stage 1.8.1 — Multi-receiver stability and diagnostics correction

### 1.8.1.1 — Isolated receiver sessions
- Each receiver must have its own WebRTC PeerConnection and independent session state.
- Connecting a second receiver must never restart, renegotiate destructively, or interrupt the first receiver's stream.
- A failure/reconnect of one receiver must not tear down other receivers.

### 1.8.1.2 — Per-receiver adaptive control
- Adaptive bitrate/FPS state must be maintained independently for each receiver.
- If one receiver degrades, only that receiver is reduced.
- Degradation sequence follows the selected user bitrate: `selected value → 50% → 25% of the previous value` (75% reduction from selected after the second step).
- When the affected receiver recovers, restore its effective bitrate/FPS to the user's selected values.
- Add hysteresis/cooldown to prevent rapid oscillation between adaptive levels.

### 1.8.1.3 — Reliable statistics pipeline
- Ensure WebRTC `getStats()` results are actually propagated to the host diagnostics UI.
- Show per-receiver actual bitrate, FPS, RTT, jitter, packet loss, connection state and adaptive state.
- Distinguish configured values from measured/effective values.
- Display `Total TX` as the sum of actual active receiver bitrates.
- Refresh values periodically without creating excessive CPU/network load.

### 1.8.1.4 — Reconnect safety with multiple receivers
- Preserve logical receiver identity during temporary disconnects.
- Prevent a reconnect of one receiver from affecting another receiver.
- Old-session cleanup must never remove the replacement or another active receiver.

## Acceptance criteria for Stage 1.8
- Diagnostics show live bitrate for each connected receiver.
- Diagnostics show effective FPS for each connected receiver.
- Total actual outbound bitrate is visible.
- Values change under real network conditions rather than remaining equal to configured settings.
- Adaptive state and available quality metrics are visible/logged.
- Diagnostics do not materially increase CPU/network load.

## Acceptance criteria for Stage 1.8.1
- Two or more receivers can stream simultaneously without one receiver causing another to restart.
- Each receiver has independent adaptive state.
- Degradation of one receiver does not change the effective bitrate of another healthy receiver.
- Per-receiver statistics are visible in the host diagnostics UI.
- `Total TX` reflects the sum of measured receiver traffic.
- Log timestamps match the local Windows PC clock and include milliseconds.
- CI syntax/tests/build remain green.
