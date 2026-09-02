(() => {
  // Keep the host signaling session authenticated with the token returned by api.start().
  // The main host app predates token support, so inject the token at the WebSocket join boundary.
  let hostToken = '';
  const originalStart = window.api?.start;
  if (typeof originalStart === 'function') {
    window.api.start = async (...args) => {
      const result = await originalStart(...args);
      hostToken = typeof result?.hostToken === 'string' ? result.hostToken : '';
      return result;
    };
  }

  const NativeWebSocket = window.WebSocket;
  if (typeof NativeWebSocket !== 'function') return;

  class HostWebSocket extends NativeWebSocket {
    send(data) {
      try {
        const message = JSON.parse(data);
        if (message?.type === 'join' && message?.role === 'host' && hostToken) {
          return super.send(JSON.stringify({ ...message, token: hostToken }));
        }
      } catch (_) {
        // Non-JSON frames are passed through unchanged.
      }
      return super.send(data);
    }
  }

  Object.defineProperty(window, 'WebSocket', {
    configurable: true,
    writable: true,
    value: HostWebSocket,
  });
})();
