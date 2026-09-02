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

  // The signaling server returns a short-lived resume token. Inject it into every
  // subsequent receiver join so an automatic recovery reconnect replaces the
  // existing signaling socket instead of being rejected as a duplicate session.
  const NativeWebSocket = window.WebSocket;
  if (typeof NativeWebSocket === 'function') {
    class ReceiverWebSocket extends NativeWebSocket {
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

  const rememberResumeToken = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message?.type === 'joined' && typeof message.resumeToken === 'string' && message.resumeToken) {
        localStorage.setItem(resumeKey, message.resumeToken);
      }
      if (message?.type === 'auth-error' || message?.type === 'kicked') {
        localStorage.removeItem(resumeKey);
      }
    } catch (_) {
      // Ignore non-JSON signaling messages.
    }
  };

  // Watch sockets created by app.js and persist the server-issued resume token.
  if (NativeWebSocket?.prototype?.addEventListener) {
    const CurrentWebSocket = window.WebSocket;
    const OriginalCtor = CurrentWebSocket;
    const WrappedWebSocket = function(...args) {
      const socket = new OriginalCtor(...args);
      socket.addEventListener('message', rememberResumeToken);
      return socket;
    };
    WrappedWebSocket.prototype = OriginalCtor.prototype;
    Object.setPrototypeOf(WrappedWebSocket, OriginalCtor);
    window.WebSocket = WrappedWebSocket;
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
