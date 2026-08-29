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
- Measure FPS from `outbound-rtp.framesPerSecond` when available.
- Fall back to `framesSent` divided by the elapsed statistics interval when `framesPerSecond` is unavailable or zero.
- Keep configured FPS and effective measured FPS as separate values.

### 1.8.2 — Statistics consistency and diagnostics hardening

#### 1.8.2a — Statistics consistency / aggregate TX
- Make `Total TX` equal to the sum of the current measured bitrates of all active receivers.
- Keep per-receiver measured TX and aggregate TX based on the same statistics sample/cycle.
- Detect and prevent divergence between the per-receiver values and `Total TX`.
- Add explicit diagnostic fields for:
  - per-receiver TX;
  - sum of receiver TX (`Receivers TX sum`);
  - aggregate TX (`Aggregate TX`);
  - number of active PeerConnections/receivers.
- Do not use the configured source bitrate as a substitute for measured aggregate TX.
- Preserve the existing lightweight polling model and avoid additional `getStats()` calls solely for aggregation.

#### 1.8.2b — Diagnostic logging normalization
- Eliminate `[object Object]` entries from application diagnostics/log files.
- Serialize structured diagnostic objects into readable, stable log records.
- Log periodic per-receiver statistics in a machine- and human-readable form:
  - receiver ID;
  - bitrate/TX;
  - effective FPS;
  - RTT;
  - jitter;
  - packet loss / loss rate;
  - adaptive state.
- Log aggregate statistics together with the receiver count and receiver TX sum.
- Log reconnect and adaptive transitions with their relevant receiver ID and state changes.
- Keep diagnostic logging lightweight and periodic rather than logging every statistics tick.
- Ensure errors in statistics collection are logged with useful context instead of stringified objects.

#### 1.8.2c — CPU impact verification
- Treat CPU load as a measured acceptance criterion, not as a symptom to optimize blindly.
- Separate measurement of statistics/diagnostics overhead from WebRTC capture/encoding overhead as far as practical.
- Verify that the statistics hardening does not introduce additional CPU load when a second receiver is connected.
- Record CPU observations for one receiver and two receivers under comparable conditions.
- Only after statistics correctness is established, decide whether a dedicated CPU optimization patch is required.

#### 1.8.2d — Validation scenario
Run the same controlled test after implementation:
1. Start the source and connect one receiver.
2. Record CPU, measured TX, effective FPS, RTT, jitter and loss.
3. Connect a second receiver without restarting the source.
4. Record the same metrics for both receivers.
5. Verify `Receivers TX sum == Aggregate TX == Total TX` within the expected rounding tolerance.
6. Verify logs contain readable structured statistics and no `[object Object]` records.
7. Restart the source and repeat the two-receiver test to detect state/initialization regressions.
8. Keep the test running long enough to observe periodic statistics logging and confirm that values continue updating.

#### 1.8.2e — Source selector regression hardening
- Keep the source selector usable immediately after application startup.
- Retry source enumeration when the first `desktopCapturer.getSources()` request returns no sources or transiently fails.
- Provide a manual `Обновить` action so the user can re-enumerate screens/windows without restarting the application.
- Preserve the currently selected source when the list is refreshed when possible.
- Provide deterministic fallback labels (`Экран N` / `Окно N`) if Windows/Electron returns a source without a usable display name.
- Do not silently leave an empty selector after a transient enumeration failure; show an explicit status and recovery action.
- Runtime acceptance: at least one real screen must be selectable after a cold start and after application restart.

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

## 1.8.2 implementation status — 2026-08-29

### 1.8.2a — Statistics consistency / aggregate TX
- [x] Aggregate TX is calculated from the active receivers' latest measured bitrate values.
- [x] `Receivers TX sum` and `Aggregate TX` are emitted from the same active receiver set.
- [x] `Total TX` UI uses the same aggregate calculation instead of a separately accumulated value.
- [x] Diagnostics snapshot exposes receiver count and PeerConnection count.
- [x] No additional `getStats()` call is introduced solely to calculate the aggregate.
- [ ] Runtime acceptance still requires a two-receiver test confirming the displayed values remain equal within rounding tolerance.

### 1.8.2b — Diagnostic logging normalization
- [x] Host-side log serialization now safely handles structured objects, `Error` values and `BigInt`.
- [x] Periodic statistics logs include receiver ID, TX, effective FPS, RTT, jitter, loss rate, receiver TX sum, aggregate TX and PeerConnection count.
- [x] Diagnostics snapshots are written as structured readable records.
- [x] Statistics-cycle duration is recorded to support later CPU/diagnostics overhead analysis.
- [ ] Runtime acceptance still requires checking exported logs for absence of `[object Object]`.

### 1.8.2c — CPU impact verification
- [x] Statistics-cycle duration is captured without adding another `getStats()` collection.
- [ ] Compare one- and two-receiver CPU load on the Windows build.

### 1.8.2e — Source selector regression hardening
- [x] Added retry-based source re-enumeration in the host UI.
- [x] Added manual `Обновить` action.
- [x] Added fallback source labels when Electron returns an empty name.
- [x] Added explicit source-list status/recovery feedback.
- [ ] Runtime acceptance still requires confirming that at least one real screen is selectable after cold start and restart.

## 1.8 implementation notes — 2026-08-29
- 1.8.1 receiver bitrate and multi-receiver statistics display were verified in the user's #76 build test.
- Prepared 1.8.2 by hardening the statistics pipeline before the effective-FPS implementation is considered complete.
- Effective receiver FPS is measured from `outbound-rtp.framesPerSecond` when available, with a `framesSent`/time-interval fallback.
- Packet-loss degradation is calculated from interval deltas of cumulative counters; an interval `lossRate` is also calculated when receiver packet counters are available.
- Adaptive control reuses the latest per-receiver statistics sample and skips a peer when no current sample exists, avoiding an extra `getStats()` call in the adaptive cycle.
- Host statistics collection is guarded against overlapping/duplicate calls with an in-flight lock.
- Periodic per-receiver bitrate/FPS/loss-rate and aggregate TX are logged at a lightweight 10-second interval rather than on every statistics tick.
- Test evidence from the #79 two-receiver run showed correct individual receiver statistics but a mismatch between the displayed receiver TX values and `Total TX`, while Windows Task Manager showed a separate process/network load value. This is the basis for 1.8.2a aggregate-statistics validation.
- Test logs from the same runs contained repeated `[object Object]` records instead of structured diagnostic data. This is the basis for 1.8.2b logging normalization.
- CPU load increased after restart in the observed two-receiver test; this is recorded as a verification target for 1.8.2c rather than an assumed `getStats()` cause.
- The #83 Windows build reproduced a source selector regression on the user's machine: the `Экран / окно` selector appeared empty after startup. The regression is now covered by 1.8.2e with retries, manual refresh and fallback labels.
- Unified 1.8.2 patch prepared from the clean repository: aggregate TX uses the same per-receiver statistics cycle, structured diagnostic logging includes receiver/aggregate metrics and statistics-cycle duration, and source discovery is split into fast screen enumeration plus background window enumeration.
- Source selection no longer monkey-patches IPC or `desktopCapturer`; selected sources are cached and reused by the display-media handler.
- New installations default to 1280×720 at 30 FPS; existing saved configuration remains unchanged.

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

## Acceptance criteria for Stage 1.8.2
- `Total TX`, `Aggregate TX` and `Receivers TX sum` are consistent within expected rounding tolerance.
- The aggregate value is derived from current measured per-receiver statistics.
- No `[object Object]` entries remain in the relevant diagnostic logs.
- Periodic logs contain readable per-receiver bitrate/FPS/RTT/jitter/loss/adaptive information.
- Reconnect and adaptive events identify the affected receiver and remain readable in logs.
- Statistics collection remains non-overlapping and does not add unnecessary `getStats()` calls.
- CPU impact is measured with one and two receivers; any further CPU optimization is based on those measurements.
- The source selector remains populated after cold start and application restart, with a manual recovery action if source enumeration is temporarily unavailable.
- Two receivers can stream simultaneously without restarts, repeated reconnect storms, or degradation of the healthy receiver.
- CI syntax/tests/build remain green.
