let activeTab = null;
let activeToken = null;
let lastSnapshot = 0;
browser.tabs.onRemoved.addListener(tabId => {
  if (tabId === activeTab) { activeTab = null; activeToken = null; lastSnapshot = 0; }
});
async function reuseGameTab(sender, token) {
  const tabs = await browser.tabs.query({url:'https://play.kaldora.eu/*'});
  for (const tab of tabs) {
    if (tab.id === sender.tab.id) continue;
    try {
      const reply = await browser.tabs.sendMessage(tab.id, {type:'thor-probe',token});
      if (reply?.active !== true) continue;
      await browser.tabs.update(tab.id, {active:true});
      await browser.tabs.remove(sender.tab.id);
      return {reused:true};
    } catch { }
  }
  return {reused:false};
}
browser.runtime.onMessage.addListener((request, sender) => {
  if (!sender.url || new URL(sender.url).origin !== 'https://play.kaldora.eu' ||
      !/^[a-f0-9]{64}$/.test(request?.token || '') || sender.tab?.id == null) return;
  if (request.type === 'claim') {
    if (activeTab !== null && activeTab !== sender.tab.id &&
        activeToken === request.token && Date.now() - lastSnapshot < 4000) {
      return browser.tabs.update(activeTab, {active:true}).then(() =>
        browser.tabs.remove(sender.tab.id)).then(() => ({reused:true}))
        .catch(() => ({reused:false}));
    }
    return reuseGameTab(sender, request.token).catch(() => ({reused:false}));
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
    if (request.type === 'snapshot' && request.data?.snapshot &&
        (activeTab === null || activeTab === sender.tab.id || Date.now() - lastSnapshot >= 4000)) {
      activeTab = sender.tab.id;
      activeToken = request.token;
      lastSnapshot = Date.now();
    }
    return response.json();
  }).catch(() => null);
});
