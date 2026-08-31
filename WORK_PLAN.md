# LAN Desktop Stream — План работ

## Цель проекта
Стабильная передача рабочего стола по локальной сети с минимальной задержкой, поддержкой нескольких приёмников и контролем реальной сетевой нагрузки.

## Порядок этапов

### 1. Оптимизация сети
- [x] Оптимизировать общий исходящий лимит.
- [x] Разделить сетевую нагрузку между несколькими приёмниками.
- [x] Исключить перегрузку сети при подключении второго/следующих ПК — подтверждено runtime-тестом с несколькими receiver и общим TX budget.
- [x] Настроить adaptive bitrate/FPS.
- [x] Проверить реальный TX каждого приёмника.
- [x] Проверить aggregate TX.

### 2. Базовая стабильность
- [ ] Стабильный Start/Stop.
- [ ] Отсутствие перезапусков при подключении второго пользователя.
- [ ] Стабильный reconnect.
- [ ] Корректное отключение приёмника.
- [ ] Стабильность после перезапуска приложения.

### 3. Диагностика и наблюдаемость
- [x] Реальный bitrate каждого receiver.
- [x] Реальный FPS каждого receiver.
- [x] RTT/jitter/loss.
- [x] Aggregate TX.
- [x] Adaptive state.
- [x] Корректные локальные timestamps.
- [ ] Структурированные логи без `[object Object]` — остаётся отдельная проблема writer `main.js`.

### 4. UI/UX
- [x] Удобный выбор экрана/окна.
- [x] Preview выбранного источника.
- [x] Copy link.
- [x] Firewall status.
- [x] Tray.
- [x] Diagnostics screen.

### 5. Рефакторинг архитектуры 🟡
- [ ] Полностью разделить `src/main.js` на логические модули.
- [x] Вынести HTTP/signaling server в `src/signaling-server.js`.
- [x] Вынести signaling.
- [x] Вынести receiver management в signaling server.
- [x] Вынести network/firewall в отдельные модули.
- [x] Вынести diagnostics/logger в отдельный logger/runtime-monitor pipeline.
- [ ] Полностью разделить host `app.js`.
- [ ] Вынести capture в отдельный модуль.
- [ ] Вынести WebRTC в отдельный модуль.
- [x] Вынести diagnostics UI в `web/host/diagnostics.js`.
- [ ] Вынести UI из host `app.js`.
- [ ] Полностью разделить receiver `app.js`.
- [x] Унифицировать базовую обработку ошибок и lifecycle на уровне main/signaling.
- [x] Не изменять внешнее поведение без необходимости.

### 6. Безопасность 🟡
- [x] Проверить PIN и timing-safe сравнение секретов.
- [x] Проверить Origin.
- [x] Валидировать WebSocket messages.
- [x] Проверить clientId.
- [x] Проверить доступ только из разрешённой LAN.
- [x] Проверить Firewall rules.
- [x] Добавить rate limiting и защиту от некорректных запросов.

### 7. CI/CD и автоматическое тестирование 🟢
- [ ] Добавить lint в реально выполняемую CI-проверку.
- [ ] Добавить unit tests в реально выполняемую CI-проверку.
- [ ] Добавить server smoke test.
- [ ] Добавить HTTP test.
- [ ] Добавить WebSocket test.
- [ ] Добавить receiver connection test.
- [ ] Добавить максимально возможный WebRTC smoke test.
- [x] Проверять результат сборки.
- [x] Проверять наличие installer.
- [x] Загружать EXE как artifact.

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
- [x] Runtime multi-receiver equality/consistency test — подтверждено новой сборкой и логом.

### 1.8.2b — Diagnostic logging normalization
- [x] Structured diagnostic data is serialized instead of becoming `[object Object]` in the diagnostics pipeline.
- [x] Periodic statistics include receiver ID, TX, FPS, RTT, jitter, loss and adaptive state.
- [x] Aggregate TX and receiver TX sum are logged together.
- [x] Statistics-cycle duration is logged for CPU overhead analysis.
- [x] Runtime verification of periodic diagnostic data — новая сборка пишет реальные TX/FPS/RTT/jitter/loss/adaptive данные.
- [ ] Runtime verification of exported logs — отдельный экспорт требует дополнительной проверки.

### 1.8.2c — CPU impact verification
- [x] Statistics-cycle timing added without an additional stats collection.
- [x] Measure CPU with one receiver.
- [x] Measure CPU with two receivers.
- [x] Decide on further CPU optimization from measurements.

### 1.8.2d — Validation
- [x] One-receiver controlled test — выполнен ранее в рамках CPU/runtime baseline.
- [x] Two-receiver controlled test without source restart — подтверждён ранее и новой сборкой при многопользовательском тесте.
- [x] Verify aggregate/per-receiver TX consistency.
- [x] Verify readable periodic logs, за исключением отдельного `[object Object]` writer regression.
- [x] Verify reconnect behavior — reconnect/session handling реализован и проверялся в runtime; дополнительный стресс-тест остаётся в этапе 2.
- [ ] Repeat после полного application restart в отдельном regression-сценарии.

### 1.8.2e — Startup/source selector hardening
- [x] Screen enumeration is separated from window enumeration.
- [x] Selected source is cached in `src/main.js`.
- [x] Display-media capture reuses the cached selected source where available.
- [x] Window enumeration runs after the initial screen list is available.
- [x] Runtime startup/source selection работает в новой сборке.
- [ ] Отдельное измерение fast cold start на Windows.
- [ ] Отдельная проверка source selector после полного restart.

### 1.8.2f — Default startup parameters
- [x] UI default resolution: `1280x720`.
- [x] UI default FPS: `30`.
- [x] Default config in `src/main.js`: `1280x720`, `30 FPS`.
- [x] Existing saved user configuration is preserved.

### 1.8.2g — Start button regression validation
- [x] Start launches the stream.
- [x] URL appears after Start.
- [x] Selected source is not replaced by a second slow enumeration.
- [x] One receiver.
- [x] Two receivers.
- [ ] Repeat Start after Stop.
- [ ] Repeat after application restart.

### 1.8.2h — Critical startup regression fix
- [x] Fixed `SyntaxError: await is only valid in async functions` in Electron main process.
- [x] `app.whenReady()` startup is correctly async.
- [x] Syntax verification was performed.
- [x] Current Windows build contains the startup correction and builds successfully.
- [ ] Runtime installation/start verification after installer installation.

### 1.8.2i — Fixed output resolution pipeline
- [x] Identified root cause: `getDisplayMedia()` dimensions are capture preferences and do not guarantee exact encoded dimensions.
- [x] Added fixed-size canvas normalization fallback.
- [x] Output video track can be normalized to selected dimensions.
- [x] Aspect ratio is preserved with letterboxing.
- [x] Audio tracks are preserved when enabled.
- [x] Original capture source is cleaned up when normalized stream ends.
- [x] Runtime tests confirmed the resolution pipeline and exposed the near-match issue that was subsequently fixed in 1.8.5.
- [ ] Portrait/narrow-window runtime test.
- [ ] Complete 1280×720 → 1920×1080 runtime switch verification.
- [ ] Complete receiver-diagnostics output-dimension verification for all target resolutions.

### 1.8.3 — Readable diagnostic log
- [x] Added structured log formatter bootstrap.
- [x] Log timestamps use local Windows time with milliseconds.
- [x] Log levels are aligned (`INFO`, `WARN`, `ERROR`, `STAT`, `DEBUG`).
- [x] Log records receive readable categories (`APP`, `SOURCE`, `SERVER`, `RECEIVER`, `STAT`, `NETWORK`, `LIFECYCLE`).
- [x] Structured objects are expanded as indented JSON in the formatter.
- [x] Existing main functionality remains the source of log events.
- [x] CI/build path is currently functional.
- [ ] Runtime verification that every exported log is UTF-8/readable.
- [ ] Eliminate the remaining `[[object Object]] [MAIN]` writer-path regression.

### 1.8.4 — CPU optimization: fixed-resolution capture path
- [x] Identified per-frame 2D canvas normalization as CPU-heavy.
- [x] Native same-aspect downscaling preferred where exact native capture is possible.
- [x] Per-receiver encoder-side `scaleResolutionDownBy` used for common 16:9 downscale.
- [x] Canvas normalization remains correctness fallback.
- [x] One-receiver CPU measurement: ~3.7% CPU at tested resolution, ~29 FPS, GPU ~4.1%.
- [x] Two-receiver CPU measurement: ~7.2% CPU, ~28–29 FPS, GPU ~4.0%.
- [x] High-resolution test: one receiver ~5.1% CPU/GPU 7.4%; two receivers ~8.1% CPU/GPU 7.4%.
- [x] Second receiver adds only ~3.0–3.5 percentage points CPU in captured tests.
- [x] CI Windows build and installer/runtime verification — Run #119 completed successfully and installer artifact was produced.
- [x] CPU/quality results justified keeping the optimization.
- [ ] Complete final dimension matrix 1280×720 / 1920×1080 / 2560×1440.
- [ ] Final preview/Start/Stop/reconnect regression.

### 1.8.5 — Exact output resolution correction
- [x] Runtime test identified near-match outputs such as 1280×698 / 1920×1040.
- [x] Native low-CPU path now requires exact captured dimensions.
- [x] Added best-effort `track.applyConstraints()`.
- [x] Non-exact captures use fixed-size canvas fallback, including upscaling.
- [x] Runtime 1280 and 1920 tests confirmed the corrected path in the current development sequence.
- [ ] Runtime 2560×1440 exact output verification.
- [ ] CPU impact measurement for exact-resolution fallback at high resolutions.
- [ ] Final Start/Stop/reconnect regression after resolution correction.

### 1.8.6 — Resolution change lifecycle and high-resolution diagnostics
- [x] Identified reuse of the previous `stream` after resolution change.
- [x] Confirmed resolution changes perform Stop → Start and temporarily disconnect receivers.
- [x] Stable two-receiver baseline at 1280/1920: ~29 FPS and loss 0.
- [x] Old capture stream is explicitly disposed before a new Start.
- [x] Added resolution lifecycle diagnostics (`RESOLUTION_REQUESTED`, `CAPTURE_CREATED`, `CAPTURE_SETTINGS`, `OUTPUT_TRACK_READY`, `RESOLUTION_PIPELINE_FAILED`).
- [x] Current build no longer intentionally clamps selected resolution in the host configuration path.
- [ ] Confirm `2560×1440` and `3840×2160` are accepted by the actual capture/runtime environment.
- [ ] Verify exact outbound resolution at all four target resolutions.
- [ ] Verify/document receiver behavior during resolution changes.
- [ ] Re-measure CPU/RAM after the final high-resolution lifecycle changes.

### 1.8.7 — `[object Object]` regression isolation: `main.js` writer
- [x] Run #145 control experiment showed that disabling the `main.js` writer removes `[[object Object]] [MAIN]` messages.
- [x] Writer was restored.
- [x] Writer input tracing was added without changing streaming logic.
- [x] CI was run after restoring writer/tracing.
- [x] Runtime test was repeated on a less-loaded PC; the issue persisted, so high system load is not considered the sole cause.
- [ ] Map each `[object Object]` occurrence to the exact writer input/caller.
- [ ] Identify the exact formatting source.
- [ ] Apply minimal point fix without changing streaming logic.
- [ ] Run CI after the fix.
- [ ] Runtime confirm that `[object Object]` is absent and structured objects remain readable JSON.

## Текущий статус по этапам

| Этап | Статус |
|---|---|
| 1. Оптимизация сети | 🟢 Основная реализация и runtime-подтверждение выполнены; остаются дополнительные regression-тесты разрешений/жизненного цикла |
| 2. Базовая стабильность | 🟡 Частичные исправления есть, полный regression-набор ещё не закрыт |
| 3. Диагностика и наблюдаемость | 🟢 Основная реализация выполнена; остаётся `[object Object]` writer regression и экспортный тест |
| 4. UI/UX | 🟢 Основные заявленные функции реализованы |
| 5. Рефакторинг | 🟡 Частично выполнен; host/receiver ещё требуют дальнейшего разделения |
| 6. Безопасность | 🟢 Основные меры реализованы в текущем коде |
| 7. CI/CD | 🟡 Build/installer/artifact работают; автоматические runtime/unit/lint проверки ещё не закрыты полностью |
| 8. Финальная сборка | ⬜ Не начата как финальный релизный этап |

## Журнал выполнения

| Дата | Этап | Изменение | Результат |
|---|---|---|---|
| 2026-08-29 | Планирование | Зафиксирован порядок этапов | Готов к этапу 1 |
| 2026-08-29 | Этап 1 | WebRTC `maxBitrate`, общий TX budget, распределение по receiver, adaptive bitrate/FPS, сетевые метрики и профили качества | Реализовано |
| 2026-08-29 | Этап 1.8.2 | Unified statistics, structured diagnostics, CPU-cycle timing, cached source selection, fast screen enumeration, 1280×720/30 defaults | Реализовано |
| 2026-08-29 | Этап 1.8.2h | Исправлен критический startup regression `await is only valid in async functions` | Исправлено |
| 2026-08-29 | Этап 1.8.2i | Добавлена фиксированная resolution normalization pipeline | Реализовано |
| 2026-08-29 | Этап 1.8.3 | Добавлен читаемый структурированный logger | Реализовано; остаётся writer regression |
| 2026-08-29 | Этап 1.8.4 | Native/encoder-side downscale вместо per-frame canvas для типового пути | Реализовано; CPU тесты пройдены; Run #119 успешен |
| 2026-08-29 | Этап 1.8.5 | Исправлен near-match resolution path | Реализовано; дополнительные high-resolution тесты остаются |
| 2026-08-30 | Этап 1.8.6 | Исправлено переиспользование старого capture stream при смене разрешения; добавлены lifecycle diagnostics | Реализовано; 2560/3840 runtime matrix остаётся |
| 2026-08-30 | Этап 1.8.7 | Исследован `[object Object]` writer regression | Источник ещё не локализован окончательно |
| 2026-08-31 | Этап 1 / 1.8.2 | Новая сборка протестирована с несколькими receiver: реальные TX/FPS/RTT/jitter/loss/adaptive state и aggregate TX подтверждены runtime-логом | Основная сетевой контроль подтверждён; aggregate TX порядка 7 Mbps при 3 receiver в тесте |
| 2026-08-31 | CI/CD | В `main` восстановлена/синхронизирована validation-инфраструктура; текущий `package.json` содержит `check`, `lint`, `test`, `smoke`, `verify-package`, `dist` | Build path работает; полноценный runtime CI ещё не закрыт |

## Правило работы с планом

После выполнения каждой задачи обновлять соответствующий пункт `[ ] → [x]`, при необходимости добавлять дату, commit SHA, номер workflow и результат тестирования.
