browser.runtime.onMessage.addListener((request, sender) => {
  if (!sender.url || new URL(sender.url).origin !== 'https://play.kaldora.eu' ||
      !['snapshot', 'commands'].includes(request?.type) || !/^[a-f0-9]{64}$/.test(request.token)) return;
  return fetch('http://127.0.0.1:49227/' + request.type, {
    method: 'POST',
    headers: {Authorization: 'Bearer ' + request.token, 'Content-Type': 'application/json'},
    redirect: 'error',
    body: JSON.stringify(request.data),
    signal: AbortSignal.timeout(2200)
  }).then(response => response.ok ? response.json() : null).catch(() => null);
});
