/* ─────────────────────────────────────────────
   ITO OPS · replaceable data source
   Default: browser-local demo persistence.
   Replace window.ITO_DATA_SOURCE with a remote
   adapter before admin.js loads to connect APIs.
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const STORAGE_KEY = 'ito.ops.demo.snapshot.v1';

  function createLocalAdapter() {
    let memorySnapshot = null;

    function readStorage() {
      try {
        return window.localStorage ? window.localStorage.getItem(STORAGE_KEY) : null;
      } catch (e) {
        return null;
      }
    }

    return {
      mode: 'local',
      load: function (meta) {
        let raw = readStorage();
        if (!raw && memorySnapshot) raw = JSON.stringify(memorySnapshot);
        if (!raw) return null;
        try {
          const payload = JSON.parse(raw);
          const expected = meta || {};
          if (payload.version !== expected.version) return null;
          if (payload.today !== expected.today) return null;
          if (!!payload.demoOverride !== !!expected.demoOverride) return null;
          return payload.data || null;
        } catch (e) {
          return null;
        }
      },
      save: function (data, meta) {
        const payload = {
          version: (meta || {}).version || '',
          today: (meta || {}).today || '',
          demoOverride: !!(meta || {}).demoOverride,
          savedAt: new Date().toISOString(),
          data: data
        };
        memorySnapshot = payload;
        try {
          if (window.localStorage) {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            return true;
          }
        } catch (e) {
          if (window.console && console.warn) console.warn('[data-source] 本地持久化不可用，当前使用内存快照:', e.message);
        }
        return false;
      },
      clear: function () {
        memorySnapshot = null;
        try {
          if (window.localStorage) window.localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
          /* noop */
        }
      },
      info: function () {
        return { mode: 'local', key: STORAGE_KEY };
      }
    };
  }

  window.ITO_DATA_SOURCE = window.ITO_DATA_SOURCE || createLocalAdapter();
  window.ITO_DATA_SOURCE.createLocal = createLocalAdapter;
})();
