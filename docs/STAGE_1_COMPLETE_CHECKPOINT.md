# Stage 1 complete — checkpoint

Date: 2026-08-29

## Status

Stage 1 — network optimization — is accepted as completed based on the latest working Windows build and the controlled runtime verification performed during the project work.

The checkpoint is preserved separately in branch `checkpoint/stage-1-complete-2026-08-29`, rooted at commit `de69343f064e0693141ebb7aedf04f3dc3d8a1f7`.

## Verified baseline behavior

- Screen/window source selection works.
- Stream starts and operates normally.
- Preview works.
- Fixed output resolution pipeline works.
- Default startup parameters are 1280×720 and 30 FPS.
- Receiver statistics are displayed.
- Two receivers can operate simultaneously.
- Network diagnostics and readable logs are available.
- Network TX budgeting/adaptive behavior is the reference behavior for the next stage.

## CPU optimization baseline

The next work is CPU optimization under version 0.3.0. The current working build is not to be treated as disposable: every CPU patch must be compared against this checkpoint and must preserve network/WebRTC behavior.

Observed runtime reference values:

- One receiver: LAN Desktop Stream process group ≈ 7.5% CPU.
- Two receivers: LAN Desktop Stream process group ≈ 13.4% CPU.

The CPU optimization plan is documented in `docs/CPU_OPTIMIZATION_0_3_0_PLAN.md`.
