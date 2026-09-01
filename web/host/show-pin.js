const pinInput = document.getElementById('pin');
const showPin = document.getElementById('showPin');
if (pinInput && showPin) {
  showPin.addEventListener('change', () => {
    pinInput.type = showPin.checked ? 'text' : 'password';
  });
}
