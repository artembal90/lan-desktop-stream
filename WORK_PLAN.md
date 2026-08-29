# LAN Desktop Stream — План работ

## Цель проекта
Стабильная передача рабочего стола по локальной сети с минимальной задержкой, поддержкой нескольких приёмников и контролем реальной сетевой нагрузки.

## Порядок этапов

### 1. Оптимизация сети
- [ ] Оптимизировать общий исходящий лимит.
- [ ] Разделить сетевую нагрузку между несколькими приёмниками.
- [ ] Исключить перегрузку сети при подключении второго/следующих ПК.
- [ ] Настроить adaptive bitrate/FPS.
- [ ] Проверить реальный TX каждого приёмника.
- [ ] Проверить aggregate TX.

### 2. Базовая стабильность
- [ ] Стабильный Start/Stop.
- [ ] Отсутствие перезапусков при подключении второго пользователя.
- [ ] Стабильный reconnect.
- [ ] Корректное отключение приёмника.
- [ ] Стабильность после перезапуска приложения.

### 3. Диагностика и наблюдаемость
- [ ] Реальный bitrate каждого receiver.
- [ ] Реальный FPS каждого receiver.
- [ ] RTT/jitter/loss.
- [ ] Aggregate TX.
- [ ] Adaptive state.
- [ ] Корректные локальные timestamps.
- [ ] Структурированные логи без `[object Object]`.

### 4. UI/UX
- [ ] Удобный выбор экрана/окна.
- [ ] Preview выбранного источника.
- [ ] Copy link.
- [ ] Firewall status.
- [ ] Tray.
- [ ] Diagnostics screen.

### 5. Рефакторинг архитектуры 🟡
- [ ] Разделить `src/main.js` на логические модули.
- [ ] Вынести HTTP server.
- [ ] Вынести signaling.
- [ ] Вынести receiver management.
- [ ] Вынести network/firewall.
- [ ] Вынести diagnostics/logger.
- [ ] Разделить host `app.js`.
- [ ] Вынести capture.
- [ ] Вынести WebRTC.
- [ ] Вынести diagnostics.
- [ ] Вынести UI.
- [ ] Разделить receiver `app.js`.
- [ ] Унифицировать обработку ошибок.
- [ ] Не изменять внешнее поведение без необходимости.

### 6. Безопасность 🟡
- [ ] Проверить PIN.
- [ ] Проверить Origin.
- [ ] Валидировать WebSocket messages.
- [ ] Проверить clientId.
- [ ] Проверить доступ только из разрешённой LAN.
- [ ] Проверить Firewall rules.
- [ ] Добавить защиту от некорректных запросов.

### 7. CI/CD и автоматическое тестирование 🟢
- [ ] Добавить lint.
- [ ] Добавить unit tests.
- [ ] Добавить server smoke test.
- [ ] Добавить HTTP test.
- [ ] Добавить WebSocket test.
- [ ] Добавить receiver connection test.
- [ ] Добавить максимально возможный WebRTC smoke test.
- [ ] Проверять результат сборки.
- [ ] Проверять наличие installer.
- [ ] Загружать EXE как artifact.

### 8. Финальная сборка и выпуск EXE 🟢
- [ ] Финальный Windows build.
- [ ] Проверить installer.
- [ ] Проверить иконку.
- [ ] Проверить tray.
- [ ] Проверить установку.
- [ ] Проверить запуск после установки.
- [ ] Проверить Start/Stop.
- [ ] Проверить receiver.
- [ ] Проверить сеть.
- [ ] Проверить diagnostics.
- [ ] Проверить логи.
- [ ] Провести финальный smoke test.
- [ ] Опубликовать финальный EXE artifact.

## 1.8.2 — Unified statistics, logging and startup/source discovery patch

### 1.8.2a — Statistics consistency / aggregate TX
- [x] Aggregate TX is calculated from active receivers' current measured bitrate values.
- [x] `Receivers TX sum` and `Aggregate TX` use the same active receiver set/statistics cycle.
- [x] `Total TX` UI uses the same aggregate calculation.
- [x] Receiver/PeerConnection count is available in diagnostic data.
- [x] No additional `getStats()` call is used solely for aggregation.
- [ ] Runtime two-receiver equality test.

### 1.8.2b — Diagnostic logging normalization
- [x] Structured diagnostic data is serialized instead of becoming `[object Object]`.
- [x] Periodic statistics include receiver ID, TX, FPS, RTT, jitter, loss and adaptive state.
- [x] Aggregate TX and receiver TX sum are logged together.
- [x] Statistics-cycle duration is logged for CPU overhead analysis.
- [ ] Runtime verification of exported logs.

### 1.8.2c — CPU impact verification
- [x] Statistics-cycle timing added without an additional stats collection.
- [ ] Measure CPU with one receiver.
- [ ] Measure CPU with two receivers.
- [ ] Decide on further CPU optimization from measurements.

### 1.8.2d — Validation
- [ ] One-receiver controlled test.
- [ ] Two-receiver controlled test without source restart.
- [ ] Verify aggregate/per-receiver TX consistency.
- [ ] Verify readable periodic logs.
- [ ] Verify reconnect behavior.
- [ ] Repeat after application restart.

### 1.8.2e — Startup/source selector hardening
- [x] Screen enumeration is separated from window enumeration.
- [x] Selected source is cached in `src/main.js`.
- [x] Display-media capture reuses the cached selected source where available.
- [x] Window enumeration runs after the initial screen list is available.
- [ ] Runtime confirmation of fast cold start on Windows.
- [ ] Runtime confirmation of source selector after restart.

### 1.8.2f — Default startup parameters
- [x] UI default resolution: `1280x720`.
- [x] UI default FPS: `30`.
- [x] Default config in `src/main.js`: `1280x720`, `30 FPS`.
- [x] Existing saved user configuration is preserved.

### 1.8.2g — Start button regression validation
- [ ] Start launches the stream.
- [ ] URL appears after Start.
- [ ] Selected source is not replaced by a second slow enumeration.
- [ ] One receiver.
- [ ] Two receivers.
- [ ] Repeat Start after Stop.
- [ ] Repeat after application restart.

### 1.8.2h — Critical startup regression fix
- [x] Fixed `SyntaxError: await is only valid in async functions` in Electron main process.
- [x] `app.whenReady()` callback is explicitly async before using `await create()`/startup operations.
- [x] Verified `node --check src/main.js`, `src/preload.js`, `web/host/app.js` locally.
- [ ] CI build after startup fix.
- [ ] Runtime installation/start verification after startup fix.

### 1.8.2i — Fixed output resolution pipeline
- [x] Identified root cause: `getDisplayMedia()` width/height constraints are capture preferences and do not guarantee the exact encoded frame size.
- [x] Added a fixed-size canvas normalization layer in the host capture path.
- [x] Output video track is generated at exactly the selected `width × height`.
- [x] Source aspect ratio is preserved with letterboxing instead of stretching/cropping the content.
- [x] Audio tracks are preserved when system audio capture is enabled.
- [x] Pipeline cleanup stops the original capture source when the normalized stream ends.
- [ ] Runtime test: 1280×720 with a 16:9 screen.
- [ ] Runtime test: 1280×720 with a portrait/narrow window source.
- [ ] Runtime test: switch 1280×720 → 1920×1080 while stopped and verify the next stream.
- [ ] Runtime test: verify receiver diagnostics report the selected output dimensions.
- [ ] CI Windows build and installer/runtime verification.

### 1.8.3 — Readable diagnostic log
- [x] Added structured log formatter bootstrap without changing streaming logic.
- [x] Log timestamps use local Windows time with milliseconds.
- [x] Log levels are aligned (`INFO`, `WARN`, `ERROR`, `STAT`, `DEBUG`).
- [x] Log records receive readable categories (`APP`, `SOURCE`, `SERVER`, `RECEIVER`, `STAT`, `NETWORK`, `LIFECYCLE`).
- [x] Structured objects are expanded as indented JSON instead of `[object Object]`.
- [x] Existing `src/main.js` functionality remains the source of log events; the formatter only normalizes their presentation.
- [ ] CI build.
- [ ] Runtime verification of generated log.
- [ ] Verify exported log remains UTF-8 and readable.

### 1.8.4 — CPU optimization: fixed-resolution capture path
- [x] Identified the per-frame 2D canvas normalization as a potential CPU-heavy path in the fixed-resolution pipeline.
- [x] Native same-aspect downscaling is now preferred for sources that are at least as large as the selected output.
- [x] Per-receiver encoder-side `scaleResolutionDownBy` is used instead of copying every frame through canvas on the common 16:9 downscale path.
- [x] Canvas normalization remains as a correctness fallback for non-matching aspect ratios and upscaling.
- [ ] Measure CPU with one receiver against baseline.
- [ ] Measure CPU with two receivers against baseline.
- [ ] Verify output dimensions at 1280×720, 1920×1080 and 2560×1440.
- [ ] Verify preview, Start/Stop and reconnect behavior.
- [ ] CI Windows build and runtime verification.
- [ ] Keep or revert based on measured CPU/quality results.

## Журнал выполнения

| Дата | Этап | Изменение | Результат |
|---|---|---|---|
| 2026-08-29 | Планирование | Зафиксирован порядок этапов | Готов к этапу 1 |
| 2026-08-29 | Этап 1 | WebRTC `maxBitrate`, общий TX budget, распределение по receiver, adaptive bitrate/FPS, сетевые метрики и профили качества | Реализовано; требуется реальное тестирование на Windows/LAN |
| 2026-08-29 | Этап 1 | Commit `4c2ab73f68c57e46d9e940cb8c5f0d478e3ccb3f` | Код изменений загружен в `main`; workflow запускается push в `main` |
| 2026-08-29 | Этап 1.8.2-prep | Подготовка statistics pipeline: interval packet loss, effective FPS fallback, reuse latest stats, защита от overlapping `getStats`, lightweight periodic logging | Документация обновлена; кодовый патч подготовлен к внесению в текущий `web/host/app.js` |
| 2026-08-29 | Этап 1.8.2 | Unified patch: statistics consistency, structured diagnostics, CPU-cycle timing, cached source selection, fast screen enumeration, background window enumeration, 1280x720/30 FPS defaults | Код объединён без IPC monkey-patching; требуется CI и runtime validation |
| 2026-08-29 | Этап 1.8.2h | Исправлен критический регресс запуска: `app.whenReady().then(async()=>...)` | Commit `8424357a6f3557581da6ae674f41c469a12f5067`; требуется CI и runtime validation |
| 2026-08-29 | Этап 1.8.2i | Добавлена нормализация видеопотока через canvas с фиксированным размером выбранного выхода | Код внесён; требуется CI и Windows runtime validation |
| 2026-08-29 | Этап 1.8.3 | Добавлен bootstrap-форматтер читаемого main-process лога; вынесен logger utility | Требуется CI и runtime проверка лога |
| 2026-08-29 | Этап 1.8.4 | Переведён типовой same-aspect downscale с per-frame canvas на encoder-side WebRTC scaling; canvas оставлен fallback | Commit `31b2cfc95404f468965ca781ed1de663baa74d38`; требуется CPU measurement и Windows runtime validation |

## Правило работы с планом

После выполнения каждой задачи обновлять соответствующий пункт `[ ] → [x]`, при необходимости добавлять дату, commit SHA, номер workflow и результат тестирования в журнал выполнения.
