# CPU optimization 0.3.0 — execution plan

## Checkpoint

The network-optimization stage is considered complete based on the latest working Windows build and controlled one-/two-receiver runtime checks. The exact pre-CPU reference is preserved in branch `checkpoint/stage-1-complete-2026-08-29`, rooted at commit `de69343f064e0693141ebb7aedf04f3dc3d8a1f7`.

The application version for this work remains **0.3.0**. No network/WebRTC behavior is to be changed unless a CPU optimization explicitly requires it.

## CPU baseline

Observed on the latest working build:

- 1 receiver: LAN Desktop Stream process group ≈ **7.5% CPU**.
- 2 receivers: process group ≈ **13.4% CPU**.
- The stream, source selection, preview, fixed output resolution, 30 FPS default, receiver statistics and diagnostics are working and are the reference behavior.

These values are measurements from the user's Windows runtime and are used as directional baseline values; the same test scenario must be repeated after each optimization group.

## Order of work

### 0. Baseline measurement — no code changes
- [x] Freeze the working network stage checkpoint.
- [x] Record one-receiver CPU result.
- [x] Record two-receiver CPU result.
- [ ] Repeat measurements after a clean application restart under the same scenario.
- [ ] Record CPU, GPU, TX and FPS together.

### 1. Find the dominant CPU contributor
- [ ] Measure the periodic statistics pipeline cost.
- [ ] Measure capture/preview cost separately from WebRTC sender cost.
- [ ] Measure per-receiver `RTCPeerConnection`/sender overhead.
- [ ] Identify whether UI rendering/diagnostics contributes materially.
- [ ] Do not optimize until the dominant contributor is confirmed.

### 2. Optimization group A — statistics path
- [ ] Reduce unnecessary statistics-cycle work without losing displayed metrics.
- [ ] Avoid duplicate UI updates from the same statistics cycle.
- [ ] Keep a single in-flight stats collection.
- [ ] Preserve aggregate TX, per-receiver TX/FPS, RTT, jitter, loss and adaptive state.
- [ ] Rebuild and compare one/two receiver CPU against baseline.

### 3. Optimization group B — capture/preview path
- [ ] Check whether preview causes avoidable frame processing.
- [ ] Avoid duplicate capture/processing paths where possible.
- [ ] Preserve exact selected output resolution and aspect-ratio behavior.
- [ ] Rebuild and compare CPU against baseline.

### 4. Optimization group C — receiver/WebRTC path
- [ ] Check per-receiver sender configuration updates for unnecessary repetition.
- [ ] Avoid repeated `setParameters()` when values did not change.
- [ ] Preserve bitrate/FPS adaptation and reconnect behavior.
- [ ] Rebuild and compare one/two receiver CPU against baseline.

### 5. Validation
- [ ] Start/Stop repeated at least 3 times.
- [ ] One receiver stable for measurement interval.
- [ ] Two receivers stable for measurement interval.
- [ ] Application restart followed by the same tests.
- [ ] Source selection remains functional.
- [ ] 1280×720 / 30 FPS defaults remain unchanged.
- [ ] Receiver statistics remain readable and correct.
- [ ] Network diagnostics/logging remain functional.

## Acceptance criterion

CPU optimization is accepted only when CPU load is measurably lower than the frozen baseline without regression in stream start/stop, source selection, resolution/FPS, receiver statistics, reconnect behavior or network stability.

## Rule

One optimization group per patch. Every patch must build independently and be compared with the frozen baseline before the next optimization group is started.
