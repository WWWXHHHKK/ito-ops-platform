/* ─────────────────────────────────────────────
   deliverables · IndexedDB persistence
   Front-end demo storage. Replace this layer with
   the real API/object storage when the backend is ready.
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const DB_NAME = 'ito-deliverables-v3';
  const DB_VERSION = 1;
  const SEED_VERSION = '2026-11-03-v2';
  const SAMPLE_BASE = 'assets/samples/deliverables/';

  const state = {
    db: null,
    submissions: new Map(),
    summaries: new Map(),
    workflow: new Map(),
    leaderWorkflow: new Map(),
    files: new Map(),
    error: null,
    ready: null,
    resolveReady: null
  };

  const SEEDS = [
    {
      subId: 'T10026-01', taskId: 'T10026',
      note: '需求评审完成，方案与回退安排已确认。',
      submittedAt: '2026-11-02 16:40',
      files: ['需求评审方案.docx']
    },
    {
      subId: 'T10024-01', taskId: 'T10024',
      note: '告警规则梳理完成，重复告警已收敛。',
      submittedAt: '2026-11-01 17:05',
      files: ['告警规则梳理报告.pdf']
    },
    {
      subId: 'T10016-01', taskId: 'T10016',
      note: '10 月缺失监测数据补录完成，跨系统核对一致。',
      submittedAt: '2026-11-01 17:20',
      files: ['监测数据补录清单.xlsx']
    },
    {
      subId: 'T10017-01', taskId: 'T10017',
      note: '滤网清洗与冷媒检测完成，现场照片已归档。',
      submittedAt: '2026-11-02 10:15',
      files: ['空调滤网清洗照片.png']
    },
    {
      subId: 'T10029-01', taskId: 'T10029',
      note: '交换机日志巡检完成，发现 2 个端口错包增长。',
      submittedAt: '2026-11-01 16:50',
      files: ['交换机日志巡检记录.pdf']
    },
    {
      subId: 'T10022-01', taskId: 'T10022',
      note: '数据库容量评估完成，建议本月内扩容 2TB。',
      submittedAt: '2026-11-02 11:20',
      files: ['数据库容量评估.xlsx']
    },
    {
      taskId: 'T10029', summary: true,
      note: '核心交换机巡检汇总：设备整体正常，2 个端口错包已转整改。',
      submittedAt: '2026-11-02 19:40',
      files: ['核心交换机巡检汇总.pptx', '巡检照片.zip']
    }
  ];

  function requestToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function txDone(tx) {
    return new Promise(function (resolve, reject) {
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('IndexedDB transaction aborted')); };
    });
  }

  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('当前浏览器不支持 IndexedDB'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains('fileMeta')) db.createObjectStore('fileMeta', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('fileBlobs')) db.createObjectStore('fileBlobs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('submissions')) db.createObjectStore('submissions', { keyPath: 'subId' });
        if (!db.objectStoreNames.contains('summaries')) db.createObjectStore('summaries', { keyPath: 'taskId' });
        if (!db.objectStoreNames.contains('workflow')) db.createObjectStore('workflow', { keyPath: 'subId' });
        if (!db.objectStoreNames.contains('leaderWorkflow')) db.createObjectStore('leaderWorkflow', { keyPath: 'taskId' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () {
        reject(new Error('成果物数据库被其他后台标签页占用，请关闭其他后台标签页后刷新'));
      };
    });
  }

  function readAll(storeName) {
    const tx = state.db.transaction(storeName, 'readonly');
    return requestToPromise(tx.objectStore(storeName).getAll());
  }

  function put(storeName, value) {
    const tx = state.db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    return txDone(tx);
  }

  function putFiles(fileMetas, blobs) {
    const tx = state.db.transaction(['fileMeta', 'fileBlobs'], 'readwrite');
    fileMetas.forEach(function (meta, i) {
      tx.objectStore('fileMeta').put(meta);
      tx.objectStore('fileBlobs').put({ id: meta.id, blob: blobs[i] });
    });
    return txDone(tx);
  }

  function idFor(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function mimeOf(name, type) {
    if (type) return type;
    const ext = String(name).split('.').pop().toLowerCase();
    return {
      pdf: 'application/pdf',
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
      txt: 'text/plain', csv: 'text/csv', json: 'application/json', md: 'text/markdown',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      zip: 'application/zip', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav'
    }[ext] || 'application/octet-stream';
  }

  function formatSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let n = bytes;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
    return (i === 0 ? n : n.toFixed(n >= 10 ? 0 : 1)) + ' ' + units[i];
  }

  async function addFiles(files, uploadedBy) {
    if (!state.db) throw new Error('成果物存储未初始化，请刷新页面后重试');
    const metas = [];
    const blobs = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (!file || !file.size) throw new Error('不能上传空文件：' + (file ? file.name : '未知文件'));
      const id = idFor('DEL');
      metas.push({
        id: id,
        name: file.name,
        mime: mimeOf(file.name, file.type),
        size: file.size,
        uploadedBy: uploadedBy || '当前用户',
        uploadedAt: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
      });
      blobs.push(file instanceof Blob ? file : new Blob([file]));
    }
    await putFiles(metas, blobs);
    metas.forEach(function (m) { state.files.set(m.id, m); });
    return metas;
  }

  function latestOf(record) {
    if (!record || !record.versions || !record.versions.length) return null;
    return record.versions[record.versions.length - 1];
  }

  async function saveSubmission(subId, taskId, payload) {
    const files = Array.isArray(payload.files) ? payload.files : [];
    const existingFiles = Array.isArray(payload.existingFiles) ? payload.existingFiles : [];
    if (!files.length && !existingFiles.length) throw new Error('请至少保留或上传 1 个成果物文件');
    const metas = existingFiles.concat(files.length ? await addFiles(files, payload.submittedBy) : []);
    const existing = state.submissions.get(subId);
    const record = existing || { subId: subId, taskId: taskId, versions: [] };
    const version = {
      version: record.versions.length + 1,
      note: payload.note || '',
      submittedBy: payload.submittedBy || '当前用户',
      submittedAt: payload.submittedAt || new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
      files: metas
    };
    record.versions.push(version);
    await put('submissions', record);
    state.submissions.set(subId, record);
    return version;
  }

  async function saveSummary(taskId, payload) {
    const files = Array.isArray(payload.files) ? payload.files : [];
    if (!files.length) throw new Error('请至少上传 1 个汇总附件');
    const metas = await addFiles(files, payload.submittedBy);
    const existing = state.summaries.get(taskId);
    const record = existing || { taskId: taskId, versions: [] };
    const version = {
      version: record.versions.length + 1,
      note: payload.note || '',
      submittedBy: payload.submittedBy || '当前用户',
      submittedAt: payload.submittedAt || new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
      files: metas
    };
    record.versions.push(version);
    await put('summaries', record);
    state.summaries.set(taskId, record);
    return version;
  }

  async function saveWorkflow(subId, taskId, patch) {
    const record = { subId: subId, taskId: taskId, patch: patch || {}, updatedAt: Date.now() };
    await put('workflow', record);
    state.workflow.set(subId, record);
    return record;
  }

  async function saveLeaderWorkflow(taskId, patch) {
    const record = { taskId: taskId, patch: patch || {}, updatedAt: Date.now() };
    await put('leaderWorkflow', record);
    state.leaderWorkflow.set(taskId, record);
    return record;
  }

  function applyWorkflow() {
    const data = (window.ITO && ITO.state && ITO.state.tasks) || (window.ITO_DATA && ITO_DATA.tasks) || [];
    data.forEach(function (task) {
      const leader = state.leaderWorkflow.get(task.id);
      if (leader && leader.patch) Object.assign(task, leader.patch);
      (task.subs || []).forEach(function (sub) {
        const rec = state.workflow.get(sub.id);
        if (rec && rec.patch) Object.assign(sub, rec.patch);
      });
    });
    return data.length;
  }

  async function getFile(fileId) {
    const meta = state.files.get(fileId);
    if (!meta) return null;
    const tx = state.db.transaction('fileBlobs', 'readonly');
    const rec = await requestToPromise(tx.objectStore('fileBlobs').get(fileId));
    if (!rec || !rec.blob) return null;
    return { meta: meta, blob: rec.blob };
  }

  async function download(fileId) {
    const rec = await getFile(fileId);
    if (!rec) throw new Error('成果物文件不存在');
    const url = URL.createObjectURL(rec.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = rec.meta.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  async function seedSamples() {
    let failures = 0;
    for (let i = 0; i < SEEDS.length; i += 1) {
      const item = SEEDS[i];
      if (item.summary) {
        if (state.summaries.has(item.taskId)) continue;
      } else if (state.submissions.has(item.subId)) {
        continue;
      }
      try {
        const blobs = [];
        for (let j = 0; j < item.files.length; j += 1) {
          const name = item.files[j];
          const res = await fetch(SAMPLE_BASE + encodeURIComponent(name));
          if (!res.ok) throw new Error('样例文件加载失败：' + name);
          const blob = await res.blob();
          blobs.push(new File([blob], name, { type: mimeOf(name, blob.type) }));
        }
        const payload = {
          note: item.note,
          submittedBy: item.submittedBy || '演示数据',
          submittedAt: item.submittedAt,
          files: blobs
        };
        if (item.summary) await saveSummary(item.taskId, payload);
        else await saveSubmission(item.subId, item.taskId, payload);
      } catch (err) {
        failures += 1;
        if (window.console && console.warn) console.warn('[deliverables] seed skipped:', err.message);
      }
    }
    if (failures === 0) await put('meta', { key: 'seedVersion', value: SEED_VERSION });
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fileExt(name) {
    return String(name || '').split('.').pop().toLowerCase();
  }

  function fileListHtml(files, opts) {
    const list = Array.isArray(files) ? files : [];
    if (!list.length) return '<div class="deliverable-empty">暂无成果物</div>';
    return '<div class="deliverable-file-list">' + list.map(function (f) {
      const ext = fileExt(f.name).toUpperCase().slice(0, 4) || 'FILE';
      return '<div class="deliverable-file">' +
        '<span class="deliverable-file-icon">' + esc(ext) + '</span>' +
        '<span class="deliverable-file-main"><b>' + esc(f.name) + '</b><small>' + formatSize(f.size) + (f.uploadedAt ? ' · ' + esc(f.uploadedAt) : '') + '</small></span>' +
        '<span class="deliverable-file-actions">' +
          '<button class="btn btn-ghost btn-sm" type="button" data-deliv-preview="' + esc(f.id) + '">预览</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-deliv-download="' + esc(f.id) + '">下载</button>' +
        '</span></div>';
    }).join('') + '</div>';
  }

  function mountUploader(container, opts) {
    const options = opts || {};
    let files = [];
    let existing = Array.isArray(options.existing) ? options.existing.slice() : [];
    if (!container) return { getFiles: function () { return files; }, getKept: function () { return existing; } };

    container.classList.add('deliverable-uploader');
    container.innerHTML =
      '<input type="file" multiple hidden>' +
      '<div class="deliverable-drop" tabindex="0" role="button" aria-label="选择成果物文件">' +
        '<b>点击选择或拖拽上传成果物</b>' +
        '<span>支持 PDF、图片、Office、压缩包、音视频；可多选</span>' +
      '</div>' +
      '<div class="deliverable-picked"></div>';

    const input = container.querySelector('input[type=file]');
    const drop = container.querySelector('.deliverable-drop');
    const picked = container.querySelector('.deliverable-picked');

    function rowHtml(file, kind, index) {
      const ext = fileExt(file.name).toUpperCase().slice(0, 4) || 'FILE';
      const action = kind === 'existing'
        ? '<button class="btn btn-ghost btn-sm" type="button" data-deliv-remove-existing="' + index + '">移除</button>'
        : '<button class="btn btn-ghost btn-sm" type="button" data-deliv-remove="' + index + '">移除</button>';
      return '<div class="deliverable-file">' +
        '<span class="deliverable-file-icon">' + esc(ext) + '</span>' +
        '<span class="deliverable-file-main"><b>' + esc(file.name) + '</b><small>' + formatSize(file.size) +
          (kind === 'existing' && file.uploadedAt ? ' · ' + esc(file.uploadedAt) : '') + '</small></span>' +
        '<span class="deliverable-file-actions">' + action + '</span>' +
      '</div>';
    }

    function render() {
      if (!existing.length && !files.length) {
        picked.innerHTML = '<div class="deliverable-empty">尚未选择文件</div>';
        return;
      }
      let html = '';
      if (existing.length) {
        html += '<div class="deliverable-existing-label">已有成果物 · 保存后保留</div>' +
          '<div class="deliverable-file-list">' + existing.map(function (f, i) { return rowHtml(f, 'existing', i); }).join('') + '</div>';
      }
      if (files.length) {
        html += (existing.length ? '<div class="deliverable-existing-label">新增文件</div>' : '') +
          '<div class="deliverable-file-list">' + files.map(function (f, i) { return rowHtml(f, 'new', i); }).join('') + '</div>';
      }
      picked.innerHTML = html;
    }

    function add(list) {
      Array.prototype.forEach.call(list || [], function (file) {
        if (!file || !file.size) return;
        files.push(file);
      });
      render();
      if (typeof options.onChange === 'function') options.onChange(files);
    }

    drop.addEventListener('click', function () { input.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') input.click(); });
    input.addEventListener('change', function () { add(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (name) {
      drop.addEventListener(name, function (e) { e.preventDefault(); drop.classList.add('is-drag'); });
    });
    ['dragleave', 'drop'].forEach(function (name) {
      drop.addEventListener(name, function (e) { e.preventDefault(); drop.classList.remove('is-drag'); });
    });
    drop.addEventListener('drop', function (e) { add(e.dataTransfer.files); });
    container.addEventListener('click', function (e) {
      const oldBtn = e.target.closest('[data-deliv-remove-existing]');
      if (oldBtn) {
        existing.splice(Number(oldBtn.dataset.delivRemoveExisting), 1);
        render();
        if (typeof options.onChange === 'function') options.onChange(files);
        return;
      }
      const btn = e.target.closest('[data-deliv-remove]');
      if (!btn) return;
      files.splice(Number(btn.dataset.delivRemove), 1);
      render();
      if (typeof options.onChange === 'function') options.onChange(files);
    });
    render();
    return {
      getFiles: function () { return files.slice(); },
      getKept: function () { return existing.slice(); },
      isEmpty: function () { return files.length === 0 && existing.length === 0; }
    };
  }

  async function resetAll() {
    if (!state.db) return false;
    const stores = ['submissions', 'summaries', 'fileMeta', 'fileBlobs', 'workflow', 'leaderWorkflow', 'meta'];
    await new Promise(function (resolve, reject) {
      const tx = state.db.transaction(stores, 'readwrite');
      stores.forEach(function (name) { tx.objectStore(name).clear(); });
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error || new Error('清理成果物失败')); };
      tx.onabort = function () { reject(tx.error || new Error('清理成果物中止')); };
    });
    state.submissions.clear();
    state.summaries.clear();
    state.files.clear();
    state.workflow.clear();
    state.leaderWorkflow.clear();
    return true;
  }

  async function init() {
    try {
      state.db = await openDB();
      const results = await Promise.all([
        readAll('submissions'), readAll('summaries'), readAll('fileMeta'), readAll('meta'),
        readAll('workflow'), readAll('leaderWorkflow')
      ]);
      results[0].forEach(function (r) { state.submissions.set(r.subId, r); });
      results[1].forEach(function (r) { state.summaries.set(r.taskId, r); });
      results[2].forEach(function (r) { state.files.set(r.id, r); });
      results[4].forEach(function (r) { state.workflow.set(r.subId, r); });
      results[5].forEach(function (r) { state.leaderWorkflow.set(r.taskId, r); });
      const seeded = results[3].some(function (m) { return m.key === 'seedVersion' && m.value === SEED_VERSION; });
      if (!seeded) await seedSamples();
    } catch (err) {
      state.error = err;
      if (window.console && console.error) console.error('[deliverables] init failed:', err);
    }
    if (state.resolveReady) state.resolveReady();
  }

  state.ready = new Promise(function (resolve) { state.resolveReady = resolve; });
  init();

  window.DeliverableStore = {
    ready: state.ready,
    get error() { return state.error; },
    getSubmission: function (subId) { return state.submissions.get(subId) || null; },
    getLatestSubmission: function (subId) { return latestOf(state.submissions.get(subId)); },
    getSummary: function (taskId) { return state.summaries.get(taskId) || null; },
    getLatestSummary: function (taskId) { return latestOf(state.summaries.get(taskId)); },
    getFile: getFile,
    download: download,
    saveSubmission: saveSubmission,
    saveSummary: saveSummary,
    saveWorkflow: saveWorkflow,
    saveLeaderWorkflow: saveLeaderWorkflow,
    applyWorkflow: applyWorkflow,
    resetAll: resetAll,
    fileListHtml: fileListHtml,
    mountUploader: mountUploader,
    formatSize: formatSize,
    mimeOf: mimeOf
  };
})();
