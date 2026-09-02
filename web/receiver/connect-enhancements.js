(() => {
  const pin = document.getElementById('pin');
  const name = document.getElementById('name');
  const go = document.getElementById('go');
  const view = document.getElementById('view');
  const join = document.getElementById('join');
  const params = new URLSearchParams(location.search);
  const instance = params.get('instance')?.match(/^[a-zA-Z0-9_-]{1,32}$/)?.[0] || '';
  const storagePrefix = instance ? `lanStream:${instance}:` : 'lanStream:';
  const resumeKey = storagePrefix + 'resumeToken';
  let retryTimer = null;
  let retryUsed = false;

  const submit = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (!go.disabled) go.click();
  };
  pin?.addEventListener('keydown', submit);
  name?.addEventListener('keydown', submit);

  const NativeWebSocket = window.WebSocket;
  if (typeof NativeWebSocket === 'function') {
    class ReceiverWebSocket extends NativeWebSocket {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message?.type === 'joined' && typeof message.resumeToken === 'string' && message.resumeToken) {
              localStorage.setItem(resumeKey, message.resumeToken);
            } else if (message?.type === 'auth-error' || message?.type === 'kicked') {
              localStorage.removeItem(resumeKey);
            }
          } catch (_) {
            // Ignore non-JSON signaling messages.
          }
        });
      }

      send(data) {
        try {
          const message = JSON.parse(data);
          if (message?.type === 'join' && message?.role === 'receiver') {
            const resumeToken = localStorage.getItem(resumeKey);
            if (resumeToken) return super.send(JSON.stringify({ ...message, resumeToken }));
          }
        } catch (_) {
          // Pass non-JSON frames through unchanged.
        }
        return super.send(data);
      }
    }
    window.WebSocket = ReceiverWebSocket;
  }

  const armRecovery = () => {
    clearTimeout(retryTimer);
    retryUsed = false;
    retryTimer = setTimeout(() => {
      const waitingForVideo = join && getComputedStyle(join).display !== 'none';
      if (!retryUsed && waitingForVideo && go?.disabled && typeof connect === 'function') {
        retryUsed = true;
        if (typeof setStatus === 'function') setStatus('Поток не получен — повторное подключение…');
        connect(true);
      }
    }, 10000);
  };

  go?.addEventListener('click', armRecovery);
  view?.addEventListener('loadeddata', () => clearTimeout(retryTimer));
  view?.addEventListener('playing', () => clearTimeout(retryTimer));
  window.addEventListener('beforeunload', () => clearTimeout(retryTimer));
})();
