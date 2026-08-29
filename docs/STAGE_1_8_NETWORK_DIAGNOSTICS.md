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

## Acceptance criteria
- Diagnostics show live bitrate for each connected receiver.
- Diagnostics show effective FPS for each connected receiver.
- Total actual outbound bitrate is visible.
- Values change under real network conditions rather than remaining equal to configured settings.
- Adaptive state and available quality metrics are visible/logged.
- Diagnostics do not materially increase CPU/network load.
