# Stage 1.7 — Network and reconnect stability

## Goal
Reduce network load caused by receiver reconnect storms and preserve receiver state during temporary network instability.

## Planned fixes

### 1.7.1 — One clientId = one active session
- Enforce exactly one active receiver session per `clientId`.
- A replacement connection must atomically retire the previous session.
- The receiver list must never contain multiple active entries for the same `clientId`.

### 1.7.2 — Reconnect protection / backoff
- Prevent reconnect loops that create new WebSocket sessions every 1–2 seconds.
- Add controlled retry/backoff on the receiver side.
- Avoid aggressive reconnect attempts while the network is unavailable.

### 1.7.3 — Correct WebSocket replacement
- Close the previous WebSocket cleanly before accepting its replacement where possible.
- Remove stale session state deterministically.
- Prevent old-session disconnect events from removing the newly established session.

### 1.7.4 — Preserve receiver state
- Temporary network loss must not create a new logical receiver.
- Preserve the receiver identity/name while reconnecting.
- Treat temporary connection loss separately from an intentional disconnect.

### 1.7.5 — Adaptive network handling
- Coordinate reconnect handling with adaptive bitrate/FPS logic.
- Do not trigger unnecessary full session teardown during temporary congestion.

### 1.7.6 — Diagnostic logging
Record every adaptive transition with:
- user-selected/base FPS and bitrate;
- current effective FPS and bitrate;
- state: `normal`, `congested`, or `congested2`;
- reason for the transition;
- timestamp of degradation and recovery;
- restoration of the user-selected values.

This will allow future tests to prove whether stages 1.5/1.6 actually react to network degradation and recover correctly.

### 1.7.7 — Automatic Windows Firewall rule
- Investigate and fix the current `Firewall rule result {"ok":false}` condition.
- Ensure the rule is created/updated automatically after the relevant configuration is completed.
- Log the actual reason when rule creation fails.

## Acceptance criteria
- A receiver reconnecting repeatedly does not create an ever-growing receiver list.
- At any time there is at most one active session for each `clientId`.
- A temporary network interruption does not unnecessarily destroy logical receiver state.
- Reconnect attempts use controlled backoff.
- Adaptive bitrate/FPS transitions are visible in logs and return to the user's selected values after recovery.
- Firewall rule creation succeeds or provides an actionable error.
- CI syntax/tests/build remain green.
