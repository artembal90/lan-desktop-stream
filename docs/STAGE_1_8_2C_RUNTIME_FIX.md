# Stage 1.8.2c — Runtime lifecycle and capture-resolution fix

Date: 2026-08-29

## Source of the regression
User test log `LAN-Desktop-Stream-29.08.26-20-59.log` shows the application successfully starts the server and accepts two receivers, but after stopping the server the next Start action can become inert. The host UI code had a module-level `stopping` flag which was set to `true` by `stop()` and never reset. The first line of `start()` is `if(stopping)return`, so the second start is intentionally skipped after the first stop.

The same test log also records a saved configuration of `1280x720` and `30 FPS`, while the preview reported the captured source dimensions rather than the requested output dimensions. The existing capture path only supplied ideal/max constraints to `getDisplayMedia()` and did not re-apply the selected resolution to the returned track.

## Patch scope

### 1. Restart-safe lifecycle
- Reset the runtime `stopping` state before starting a new stream.
- Reset it after the previous stop cleanup completes.
- Rebind Start/Stop buttons to the hardened lifecycle wrappers.
- Preserve the existing receiver cleanup and WebSocket shutdown logic.

### 2. Resolution/FPS application
- Apply the selected resolution and FPS to the active display track with `MediaStreamTrack.applyConstraints()`.
- Request `crop-and-scale` so the browser can downscale/crop a captured source when needed.
- Re-apply the selected constraints immediately when the user changes resolution or FPS while a stream is active.
- Save the changed resolution/FPS immediately so the next start uses the selected values.
- Log requested versus actual capture settings for diagnostics.
- If the requested dimensions cannot be fully applied, fall back to applying the FPS constraint and keep the capture alive instead of breaking the stream.

### 3. Implementation
- Added `web/host/patch-1.8.2c-runtime.js`.
- Loaded the patch after the existing host application script from `web/host/index.html`.
- Existing `web/host/app.js` was intentionally left intact to minimize regression risk.

## Validation
- Local JavaScript syntax check of the patch: **PASS** (`node --check`).
- Runtime validation required in the next Windows CI build:
  1. Start stream.
  2. Connect one receiver.
  3. Connect second receiver.
  4. Stop stream.
  5. Start stream again without restarting the application.
  6. Change resolution while stopped and while active.
  7. Verify selected resolution/FPS are reflected in capture settings and diagnostics.
  8. Verify both receivers remain independent after restart.

## Acceptance criteria
- Stop → Start works repeatedly in the same application session.
- Resolution/FPS changes are not ignored by the active capture track.
- Default installation remains 1280×720 / 30 FPS.
- Existing saved configuration is preserved unless the user changes it.
- No new receiver reconnect storm is introduced.
- CI syntax/build remains green.
