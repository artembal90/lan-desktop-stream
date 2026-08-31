# LAN Desktop Stream — Optimization audit (2026-08-31)

## Scope
Reviewed the uploaded `LAN Desktop Stream v2` source snapshot and the current `main` branch.

## Findings

### 1. Logging / disk I/O — high priority
The current project architecture already contains an asynchronous, bounded logger in `src/logger.js`. This is preferable to synchronous `appendFileSync` logging because the streaming path should not block on disk I/O.

The uploaded snapshot also removes the temporary `main.js` writer tracing used during the `[object Object]` investigation. This tracing should remain out of production builds because it multiplies console/log serialization work.

**Action:** keep the asynchronous logger as the only file writer; do not reintroduce per-event debug tracing into the production writer.

### 2. Fixed-resolution capture — high priority
The expensive path is the canvas normalization fallback. The optimized design should use the native capture track whenever the actual captured dimensions exactly match the requested output. Encoder-side WebRTC scaling should be preferred for same-aspect downscaling. Canvas should remain only for exact-size correction when native capture cannot provide the requested dimensions, including aspect-ratio mismatch and upscaling.

**Action:** preserve the current capture architecture and validate exact output dimensions at 1280×720, 1920×1080, 2560×1440 and 3840×2160.

### 3. WebRTC statistics — medium priority
`getStats()` is already protected against overlapping collection and the latest snapshot is reused for diagnostics/adaptation. This is important because repeated stats collection per receiver can become noticeable with multiple receivers.

**Action:** keep one shared stats cycle; do not add independent polling for diagnostics.

### 4. Adaptive network control — medium priority
The current controller uses per-receiver measured RTT/jitter/loss and applies the requested degradation sequence: 50% bitrate, then 25% of the selected bitrate if degradation persists, followed by restoration to the selected value after recovery.

**Action:** preserve this behavior and validate it with two receivers under controlled LAN saturation.

### 5. Signaling server protection — good
The snapshot includes bounded WebSocket payloads, disabled compression, rate limits, origin/LAN checks, bounded receiver count and reconnect tokens. These controls reduce unnecessary work from malformed or excessive signaling traffic.

### 6. Remaining optimization target
The next measurable target is **CPU/RAM scaling with 1 → 2 → 3 → 4 receivers**, especially at 1920×1080 and 2560×1440. The objective is to distinguish encoder cost, stats/diagnostics cost, capture cost and signaling/UI overhead before changing the streaming pipeline.

## Recommended order
1. Validate exact output dimensions.
2. Measure CPU/GPU/RAM at 1/2/3/4 receivers.
3. Compare native capture vs canvas fallback.
4. Measure stats-cycle duration separately from capture/encoder cost.
5. Only then change another hot path.

## Safety rule
No optimization should change the selected resolution, FPS, adaptive bitrate behavior, receiver reconnect semantics or Start/Stop lifecycle unless a regression test is added at the same time.
