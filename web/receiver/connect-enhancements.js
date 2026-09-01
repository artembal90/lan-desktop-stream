(() => {
  const pin = document.getElementById('pin');
  const name = document.getElementById('name');
  const go = document.getElementById('go');
  const view = document.getElementById('view');
  const join = document.getElementById('join');
  let retryTimer = null;
  let retryUsed = false;

  const submit = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (!go.disabled) go.click();
  };
  pin?.addEventListener('keydown', submit);
  name?.addEventListener('keydown', submit);

  const armRecovery = () => {
    clearTimeout(retryTimer);
    retryUsed = false;
    retryTimer = setTimeout(() => {
      const waitingForVideo = join && getComputedStyle(join).display !== 'none';
      if (!retryUsed && waitingForVideo && go?.disabled && typeof connect === 'function') {
        retryUsed = true;
        if (typeof setStatus === 'function') setStatus('Поток не получен — повторное подключение…');
        connect(false);
      }
    }, 10000);
  };

  go?.addEventListener('click', armRecovery);
  view?.addEventListener('loadeddata', () => clearTimeout(retryTimer));
  view?.addEventListener('playing', () => clearTimeout(retryTimer));
  window.addEventListener('beforeunload', () => clearTimeout(retryTimer));
})();
