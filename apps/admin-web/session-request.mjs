/** Same-origin Web Locks serialize cookie rotation across tabs; the queue covers older single-tab clients. */
export function createSessionTransport({ fetchImpl = fetch, locks = globalThis.navigator?.locks, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  let tail = Promise.resolve();
  async function call(url, options) {
    let response;
    for (let attempt=0;attempt<3;attempt++) {
      response = await fetchImpl(url, options);
      if (response.status !== 409 || (await response.clone().json().catch(()=>null))?.error?.code !== 'SESSION_REFRESH_RETRY') return response;
      if (attempt<2) await wait(150 * (attempt+1));
    }
    return response;
  }
  return (url, options) => {
    const task = () => locks?.request ? locks.request('traina-admin-session', () => call(url,options)) : call(url,options);
    const pending = tail.then(task); tail = pending.catch(()=>undefined); return pending;
  };
}
