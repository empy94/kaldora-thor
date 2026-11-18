(() => {
  let token = /^#thor=([a-f0-9]{64})$/.exec(location.hash)?.[1];
  browser.runtime.onMessage.addListener(request => {
    if (request?.type === 'thor-probe' && request.token === token)
      return Promise.resolve({active:true});
  });
  let sequence = 0;
  function game(command) {
    return new Promise(resolve => {
      const id = String(++sequence);
      const timeout = setTimeout(() => finish(null), 1000);
      function finish(value) {
        clearTimeout(timeout);
        window.removeEventListener('message', reply);
        resolve(value);
      }
      function reply(event) {
        if (event.source === window && event.origin === location.origin &&
            event.data?.type === 'kaldora-thor-reply' && event.data.id === id) finish(event.data.result);
      }
      window.addEventListener('message', reply);
      window.postMessage({ type: 'kaldora-thor-request', id, command }, location.origin);
    });
  }

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const send = (type, data) => browser.runtime.sendMessage({type, token, data});

  async function sendSnapshots() {
    while (true) {
      try {
        const snapshot = await game(null);
        if (snapshot !== null && location.hash === '#thor=' + token)
          history.replaceState(history.state, '', location.pathname + location.search);
        await send('snapshot', {snapshot});
      } catch { }
      await delay(550);
    }
  }

  async function receiveCommands() {
    let completed = null;
    while (true) {
      try {
        // The relay waits for an action. No interval or screen capture delays delivery.
        const next = await send('commands', {completed});
        if (next?.action && typeof next.id === 'string') {
          completed = {id: next.id, ok: await game(next.action) === true};
        } else if (next != null) {
          completed = null;
        } else {
          await delay(200);
        }
      } catch { await delay(200); }
    }
  }
  async function start() {
    if (!token) {
      try { token = (await browser.runtime.sendMessage({type:'resume'}))?.token; } catch { }
      if (!/^[a-f0-9]{64}$/.test(token || '')) return;
    }
    window.postMessage({type:'kaldora-thor-init'}, location.origin);
    try {
      const result = await browser.runtime.sendMessage({type:'claim',token});
      if (result?.reused) return;
    } catch { }
    void sendSnapshots();
    void receiveCommands();
  }
  void start();

  let entering = false;
  async function enterFullscreen(event) {
    if (!event.isTrusted || entering || document.fullscreenElement) return;
    entering = true;
    try {
      await document.documentElement.requestFullscreen({navigationUI:'hide'});
    } catch {
      // Firefox can deny an event without browser user activation.
    } finally { entering = false; }
  }
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'])
    window.addEventListener(type, enterFullscreen, true);
})();
