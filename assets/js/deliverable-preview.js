/* ─────────────────────────────────────────────
   deliverables · preview + file actions
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const U = function () { return window.ITO.ui; };
  const store = function () { return window.DeliverableStore; };
  const objectUrls = [];

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function extOf(name) {
    return String(name || '').split('.').pop().toLowerCase();
  }

  function blobUrl(blob) {
    const url = URL.createObjectURL(blob);
    objectUrls.push(url);
    return url;
  }

  function cleanupUrls() {
    while (objectUrls.length) {
      try { URL.revokeObjectURL(objectUrls.pop()); } catch (e) { /* noop */ }
    }
  }

  function fallback(root, meta, reason) {
    root.innerHTML =
      '<div class="dpv-fallback">' +
        '<div class="dpv-fallback-icon">' + esc(extOf(meta.name).toUpperCase() || 'FILE') + '</div>' +
        '<h3>该格式暂不支持在线预览</h3>' +
        '<p>' + esc(reason || '请下载后使用本地应用打开。') + '</p>' +
        '<button class="btn btn-primary" type="button" data-deliv-download="' + esc(meta.id) + '">下载文件</button>' +
      '</div>';
  }

  async function render(root, meta, rec) {
    const blob = rec.blob;
    const ext = extOf(meta.name);
    const mime = meta.mime || blob.type || '';
    root.innerHTML = '<div class="dpv-loading">正在加载成果物…</div>';

    try {
      if (mime === 'application/pdf' || ext === 'pdf') {
        const url = blobUrl(blob);
        root.innerHTML = '<iframe class="dpv-frame" src="' + url + '" title="' + esc(meta.name) + '"></iframe>';
        return;
      }

      if (mime.indexOf('image/') === 0 || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].indexOf(ext) > -1) {
        const url = blobUrl(blob);
        root.innerHTML =
          '<div class="dpv-image-wrap"><img class="dpv-image" src="' + url + '" alt="' + esc(meta.name) + '">' +
          '<div class="dpv-image-tools"><button class="btn btn-ghost btn-sm" type="button" data-dpv-zoom="-">−</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-dpv-zoom="+">+</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-dpv-reset>重置</button></div></div>';
        const img = root.querySelector('.dpv-image');
        let scale = 1;
        const apply = function () { img.style.transform = 'scale(' + scale + ')'; };
        root.querySelectorAll('[data-dpv-zoom]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            scale = Math.max(0.25, Math.min(4, scale + (btn.dataset.dpvZoom === '+' ? 0.2 : -0.2)));
            apply();
          });
        });
        root.querySelector('[data-dpv-reset]').addEventListener('click', function () { scale = 1; apply(); });
        return;
      }

      if (mime.indexOf('video/') === 0 || ['mp4', 'webm', 'mov'].indexOf(ext) > -1) {
        const url = blobUrl(blob);
        root.innerHTML = '<video class="dpv-video" controls src="' + url + '"></video>';
        return;
      }

      if (mime.indexOf('audio/') === 0 || ['mp3', 'wav', 'ogg', 'm4a'].indexOf(ext) > -1) {
        const url = blobUrl(blob);
        root.innerHTML = '<div class="dpv-audio"><audio controls src="' + url + '"></audio></div>';
        return;
      }

      if (['txt', 'md', 'json', 'csv', 'log', 'xml', 'yaml', 'yml'].indexOf(ext) > -1 || mime.indexOf('text/') === 0) {
        const text = await blob.text();
        root.innerHTML = '<pre class="dpv-text">' + esc(text) + '</pre>';
        return;
      }

      if (ext === 'docx') {
        if (!window.docx || typeof window.docx.renderAsync !== 'function') {
          fallback(root, meta, 'DOCX 预览库未加载。');
          return;
        }
        const host = document.createElement('div');
        host.className = 'dpv-docx';
        root.innerHTML = '';
        root.appendChild(host);
        await window.docx.renderAsync(blob, host, null, { className: 'docx', inWrapper: true });
        return;
      }

      if (ext === 'xlsx' || ext === 'xls') {
        if (!window.XLSX) {
          fallback(root, meta, 'XLSX 预览库未加载。');
          return;
        }
        const wb = window.XLSX.read(await blob.arrayBuffer(), { type: 'array' });
        const names = wb.SheetNames;
        const wrap = document.createElement('div');
        wrap.className = 'dpv-xlsx';
        wrap.innerHTML = '<div class="dpv-sheet-tabs">' + names.map(function (name, i) {
          return '<button class="btn btn-ghost btn-sm' + (i === 0 ? ' active' : '') + '" type="button" data-dpv-sheet="' + i + '">' + esc(name) + '</button>';
        }).join('') + '</div><div class="dpv-sheet-body"></div>';
        root.innerHTML = '';
        root.appendChild(wrap);
        const body = wrap.querySelector('.dpv-sheet-body');
        const draw = function (index) {
          const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[names[index]], { header: 1, blankrows: false, defval: '' });
          body.innerHTML = '<table class="dpv-sheet">' + rows.map(function (row) {
            return '<tr>' + row.map(function (cell) { return '<td>' + esc(cell) + '</td>'; }).join('') + '</tr>';
          }).join('') + '</table>';
          wrap.querySelectorAll('[data-dpv-sheet]').forEach(function (btn) {
            btn.classList.toggle('active', Number(btn.dataset.dpvSheet) === index);
          });
        };
        wrap.querySelectorAll('[data-dpv-sheet]').forEach(function (btn) {
          btn.addEventListener('click', function () { draw(Number(btn.dataset.dpvSheet)); });
        });
        draw(0);
        return;
      }

      if (ext === 'pptx') {
        if (!window.pptxPreview || typeof window.pptxPreview.init !== 'function') {
          fallback(root, meta, 'PPTX 预览库未加载。');
          return;
        }
        const host = document.createElement('div');
        host.className = 'dpv-pptx';
        root.innerHTML = '';
        root.appendChild(host);
        const previewer = window.pptxPreview.init(host, { width: 960, height: 540 });
        await previewer.preview(await blob.arrayBuffer());
        return;
      }

      if (ext === 'zip') {
        if (!window.JSZip) {
          fallback(root, meta, 'ZIP 预览库未加载。');
          return;
        }
        const zip = await window.JSZip.loadAsync(blob);
        const entries = Object.keys(zip.files).map(function (name) {
          const item = zip.files[name];
          if (item.dir) return '';
          const size = item._data && item._data.uncompressedSize ? item._data.uncompressedSize : 0;
          return '<div class="dpv-zip-row"><span>' + esc(name) + '</span><small>' + (window.DeliverableStore.formatSize(size)) + '</small></div>';
        }).join('');
        root.innerHTML = '<div class="dpv-zip"><div class="dpv-zip-head">压缩包内容 · ' + Object.keys(zip.files).filter(function (n) { return !zip.files[n].dir; }).length + ' 个文件</div>' + entries + '</div>';
        return;
      }

      fallback(root, meta, '该文件类型没有内置预览器。');
    } catch (err) {
      fallback(root, meta, '预览失败：' + (err && err.message ? err.message : '文件可能已损坏。'));
    }
  }

  let activeClose = null;

  async function openFile(fileId) {
    const rec = await store().getFile(fileId);
    if (!rec) {
      U().toast('成果物文件不存在或已被清理', 'warn');
      return;
    }
    const host = document.getElementById('previewRoot');
    if (!host) {
      U().toast('预览容器未初始化，请刷新页面', 'warn');
      return;
    }
    if (activeClose) activeClose();
    const meta = rec.meta;
    const previousOverflow = document.body.style.overflow;
    const close = function () {
      host.innerHTML = '';
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      cleanupUrls();
      activeClose = null;
    };
    const onKey = function (e) { if (e.key === 'Escape') close(); };
    host.innerHTML =
      '<div class="modal-backdrop">' +
        '<div class="modal xwide" role="dialog" aria-modal="true" aria-label="成果物预览">' +
          '<div class="modal-head">' +
            '<div><h2>成果物预览</h2><p>' + esc(meta.name) + ' · ' + store().formatSize(meta.size) + (meta.uploadedAt ? ' · ' + esc(meta.uploadedAt) : '') + '</p></div>' +
            '<button class="modal-close" type="button" aria-label="关闭">' + U().icon('close') + '</button>' +
          '</div>' +
          '<div class="modal-body"><div class="dpv-root" id="dpvRoot"><div class="dpv-loading">正在加载成果物…</div></div></div>' +
          '<div class="modal-foot"><button class="btn btn-ghost" type="button" data-dpv-close>关闭</button><span class="spacer"></span>' +
            '<button class="btn btn-soft" type="button" data-deliv-download="' + esc(meta.id) + '">下载</button></div>' +
        '</div>' +
      '</div>';
    const backdrop = host.firstElementChild;
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    host.querySelector('.modal-close').addEventListener('click', close);
    host.querySelector('[data-dpv-close]').addEventListener('click', close);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    activeClose = close;
    render(host.querySelector('#dpvRoot'), meta, rec);
  }

  async function downloadFile(fileId) {
    try {
      await store().download(fileId);
      if (window.ITO && ITO.log) ITO.log('下载成果物', fileId, '任务');
    } catch (err) {
      U().toast(err.message || '下载失败', 'warn');
    }
  }

  document.addEventListener('click', function (e) {
    const preview = e.target.closest('[data-deliv-preview]');
    if (preview) {
      e.preventDefault();
      openFile(preview.dataset.delivPreview);
      return;
    }
    const download = e.target.closest('[data-deliv-download]');
    if (download) {
      e.preventDefault();
      downloadFile(download.dataset.delivDownload);
    }
  });

  window.DeliverablePreview = {
    open: openFile,
    download: downloadFile
  };
})();
