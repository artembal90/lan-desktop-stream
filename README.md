# LAN Desktop Stream v2

Windows host + browser receiver for low-latency LAN desktop streaming.

Features: monitor/window capture via Chromium, resolution/FPS/bitrate controls, optional system audio, PIN, QR URL, multiple receivers, receiver IP/name list, fullscreen and WebRTC stats, persistent settings, auto-start option, LAN-only ICE, and Windows installer build.

## Build on GitHub

GitHub Actions workflow `.github/workflows/windows-build.yml` builds the NSIS installer on `windows-2022` and uploads it as an artifact.

## Local Windows build

```powershell
npm install
npm run dist
```

The resulting installer is in `dist/`.

Note: Chromium hardware acceleration may use the available GPU. A deterministic native NVENC/AMF/QSV backend is not included in this Electron MVP.
