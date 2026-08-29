# CPU optimization 0.3.0 — baseline

## Baseline status

The latest Windows build has been confirmed by runtime use as **working**. This build is frozen as the baseline before CPU optimization work.

Baseline commit: `de69343f064e0693141ebb7aedf04f3dc3d8a1f7`

The repository's current `package.json` still reports version `0.2.0`; **0.3.0 is reserved as the target version for the CPU-optimization work**. The working baseline must not be broken by changing unrelated behavior.

## What is considered working at the baseline

- Screen/window source selection works.
- Stream starts and operates normally.
- Preview works.
- Selected output resolution pipeline works.
- Default startup parameters are 1280×720 and 30 FPS.
- Receiver statistics are displayed.
- Two receivers can operate simultaneously.
- Network diagnostics and logs are available.
- The latest build is the reference point for CPU measurements.

## CPU optimization objective for 0.3.0

Reduce CPU load on the source PC while preserving the baseline behavior and stream quality.

### Measurement order

1. Measure idle application CPU usage.
2. Measure CPU with one receiver.
3. Measure CPU with two receivers.
4. Record GPU usage and network TX alongside CPU.
5. Identify the dominant CPU contributor before changing code.
6. Apply one optimization group at a time.
7. Rebuild and compare against this baseline.
8. Reject any optimization that regresses Start/Stop, source selection, resolution, FPS, receiver statistics, or reconnect behavior.

## Initial observations carried into 0.3.0

- CPU load decreased after the 1.8.2 statistics/startup work, but not enough to consider CPU optimization complete.
- The application must keep the current working capture/stream pipeline as the reference implementation.
- CPU optimization is a separate task from the completed network/statistics hardening work.

## Rule for 0.3.0

Do not make speculative performance changes. First measure, then optimize the confirmed bottleneck. Each CPU optimization patch must remain independently buildable and testable.
