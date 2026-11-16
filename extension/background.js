let activeTab = null;
let activeToken = null;
let lastSnapshot = 0;
browser.tabs.onRemoved.addListener(tabId => {
  if (tabId === activeTab) { activeTab = null; activeToken = null; lastSnapshot = 0; }
});
browser.runtime.onMessage.addListener((request, sender) => {
  if (!sender.url || new URL(sender.url).origin !== 'https://play.kaldora.eu' ||
      !/^[a-f0-9]{64}$/.test(request?.token || '') || !sender.tab?.id) return;
  if (request.type === 'claim') {
    if (activeTab !== null && activeTab !== sender.tab.id &&
        activeToken === request.token && Date.now() - lastSnapshot < 4000) {
      return browser.tabs.update(activeTab, {active:true}).then(() =>
        browser.tabs.remove(sender.tab.id)).then(() => ({reused:true}))
        .catch(() => ({reused:false}));
    }
    return Promise.resolve({reused:false});
  }
  if (!['snapshot', 'commands'].includes(request.type)) return;
  return fetch('http://127.0.0.1:49227/' + request.type, {
    method: 'POST',
    headers: {Authorization: 'Bearer ' + request.token, 'Content-Type': 'application/json'},
    redirect: 'error',
    body: JSON.stringify(request.data),
    signal: AbortSignal.timeout(2200)
  }).then(async response => {
    if (!response.ok) return null;
    if (request.type === 'snapshot' && request.data?.snapshot?.online === true) {
      activeTab = sender.tab.id;
      activeToken = request.token;
      lastSnapshot = Date.now();
    }
    return response.json();
  }).catch(() => null);
});
