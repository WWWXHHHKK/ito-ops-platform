/* ─────────────────────────────────────────────
   ITO OPS · management console core
   login, shell, routing, overlays, charts
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  window.ITO = window.ITO || {};
  const D = window.ITO_DATA;
  const BUILD_VERSION = '20261112z33';
  const DATA_SOURCE = window.ITO_DATA_SOURCE;
  const PERSIST_KEYS = [
    'tasks', 'personalArchive', 'messages', 'logs', 'staff', 'groups', 'auths',
    'alertRules', 'achievements', 'personAchievements', 'wallTags',
    'inspectionPlans', 'inspectionRecords', 'maintenancePlans', 'maintenanceRecords',
    'planTasks', 'duty', 'permissions', 'metrics', 'trend', 'dictionaries',
    'fieldDefs', 'overhaul'
  ];
  let persistTimer = null;
  let devMode = false;
  const state = {
    role: null,
    user: null,
    route: 'tasks',
    routeParams: {},
    tasks: [],
    messages: [],
    logs: [],
    staff: [],
    dutyTypes: [],
    groups: [],
    auths: [],
    alertRules: [],
    achievements: [],
    personAchievements: [],
    wallTags: [],
    inspectionPlans: [],
    inspectionRecords: [],
    maintenancePlans: [],
    maintenanceRecords: [],
    planTasks: [],
    duty: null,
    permissions: {},
    metrics: {},
    trend: null,
    expanded: {},
    taskFilters: {},
    collapsed: {},
    pendingQuery: null,
    taskSeq: 10031,
    charts: [],
    notifications: [],
    entryNotified: {},
    notifyTimers: []
  };

  ITO.state = state;

  /* ── helpers ─────────────────────────────── */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const clone = (v) => JSON.parse(JSON.stringify(v));

  function snapshotData() {
    const out = {};
    PERSIST_KEYS.forEach(function (key) {
      if (state[key] !== undefined) out[key] = state[key];
    });
    return out;
  }

  function restoreSnapshot(data) {
    if (!data) return false;
    PERSIST_KEYS.forEach(function (key) {
      if (data[key] !== undefined && data[key] !== null) state[key] = data[key];
    });
    return true;
  }

  function persistState(immediate) {
    if (!DATA_SOURCE || !DATA_SOURCE.save) return;
    if (immediate) {
      if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
      DATA_SOURCE.save(snapshotData(), {
        version: BUILD_VERSION,
        today: D.meta.today,
        demoOverride: !!D.meta.demoOverride
      });
      return;
    }
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      persistTimer = null;
      DATA_SOURCE.save(snapshotData(), {
        version: BUILD_VERSION,
        today: D.meta.today,
        demoOverride: !!D.meta.demoOverride
      });
    }, 180);
  }

  function loadSnapshot() {
    if (!DATA_SOURCE || !DATA_SOURCE.load) return null;
    try {
      return DATA_SOURCE.load({
        version: BUILD_VERSION,
        today: D.meta.today,
        demoOverride: !!D.meta.demoOverride
      });
    } catch (e) {
      return null;
    }
  }

  async function resetDemoData() {
    if (DATA_SOURCE && DATA_SOURCE.clear) DATA_SOURCE.clear();
    sessionStorage.removeItem('ito.admin.role');
    try {
      if (window.DeliverableStore && window.DeliverableStore.resetAll) {
        await window.DeliverableStore.resetAll();
      }
    } catch (e) {
      /* 清理失败也继续重置页面数据 */
    }
    const target = new URL(location.href);
    target.search = '?login=1';
    target.hash = '';
    location.assign(target.href);
  }

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);

  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    task: '<path d="M9 5h10M9 12h10M9 19h10"/><path d="M4 5l1 1 2-2M4 12l1 1 2-2M4 19l1 1 2-2"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/>',
    clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    wrench: '<path d="M15 3a5 5 0 0 0-5 8L3 18a2 2 0 0 0 3 3l7-7a5 5 0 0 0 5-8l-3 3-3-3 3-3z"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5a3 3 0 0 1 0 6M18 20a6 6 0 0 0-2-4.5"/>',
    shield: '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    alert: '<path d="M12 3 2 21h20L12 3z"/><path d="M12 9v5M12 17h.01"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14 9l2 2"/>',
    award: '<circle cx="12" cy="9" r="5"/><path d="M8.5 13 7 22l5-3 5 3-1.5-9"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v5l3 2"/>',
    screen: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/>',
    filter: '<path d="M3 5h18M6 12h12M10 19h4"/>',
    external: '<path d="M14 3h7v7M21 3l-9 9"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
    play: '<path d="m7 4 13 8-13 8V4z"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
  };

  function icon(name, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function nowStamp() {
    return D.meta.demoNow;
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseDate(str) {
    return new Date(String(str).replace(/-/g, '/').replace('T', ' '));
  }

  function fmtDateTime(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  function addHours(str, hours) {
    const d = parseDate(str);
    d.setHours(d.getHours() + hours);
    return fmtDateTime(d);
  }

  const APPROVAL_HOURS = 72;
  const EDITABLE_STATUS = ['草稿', '待分发', '执行中'];
  const CANCELABLE_STATUS = ['草稿', '待分发', '执行中', '审批中', '已挂起'];

  function approvalOverdue(approval) {
    return !!(approval && approval.dueAt && parseDate(approval.dueAt) < parseDate(D.meta.demoNow));
  }

  function groupManagerName(groupId) {
    const g = groupById(groupId);
    return g ? g.manager : '';
  }

  function isTaskEditable(task) {
    if (!task) return true;
    return EDITABLE_STATUS.indexOf(mainStatus(task)) > -1 && mainStatus(task) !== '已完成';
  }

  function isTaskCancelable(task) {
    const status = mainStatus(task);
    return CANCELABLE_STATUS.indexOf(status) > -1;
  }

  function leaderApprovalOf(task) {
    if (!task || task.source !== 'leader') return null;
    return task.leaderApproval || { status: '待汇总' };
  }

  function isLeaderApprovalPending(task) {
    const la = leaderApprovalOf(task);
    return !!la && (la.status === '待汇总' || la.status === '审批中' || la.status === '已挂起' || la.status === '已驳回');
  }

  function groupById(id) {
    return state.groups.find((g) => g.id === id) || D.groups.find((g) => g.id === id) || null;
  }

  const TONE = {
    '待分发': 'blue', '待派发': 'blue', '待接收': 'purple', '执行中': 'blue',
    '审批中': 'purple', '待审批': 'yellow', '已挂起': 'red', '已取消': 'gray',
    '已完成': 'green', '完成': 'green', '正常': 'green', '启用': 'green', '有效': 'green',
    '超期': 'red', '异常': 'red', '已过期': 'red', '紧急': 'red', '高风险作业': 'red',
    '临期': 'yellow', '重要': 'yellow', '一般': 'gray', '停用': 'gray', '已撤销': 'gray',
    '待处理': 'yellow', '计划中': 'blue', '草稿': 'gray',
    '待交接': 'yellow', '待接班确认': 'purple',
    '待汇总': 'yellow', '已通过': 'green', '已驳回': 'red', '审批驳回': 'red'
  };

  function badge(text, tone) {
    const t = tone || TONE[text] || 'gray';
    return '<span class="badge ' + t + '">' + esc(text) + '</span>';
  }

  function groupPill(id) {
    const g = groupById(id);
    if (!g) return '<span class="muted">—</span>';
    return '<span class="group-pill"><i style="background:' + g.color + '"></i>' + esc(g.name) + '</span>';
  }

  function avatar(name, small) {
    const person = state.staff.find((s) => s.name === name);
    const g = person ? groupById(person.group) : state.groups.find((group) => group.manager === name);
    const bg = g ? g.color : '#EB612A';
    const initial = String(name || '?').slice(0, 1);
    return '<span class="avatar' + (small ? ' avatar-sm' : '') + '" style="background:' + bg + '">' + esc(initial) + '</span>';
  }

  function progressBar(value, width) {
    return '<span class="progress"' + (width ? ' style="width:' + width + '"' : '') + '><i style="width:' + Math.max(0, Math.min(100, value)) + '%"></i></span>';
  }

  function isOverdue(sub) {
    if (!sub || !sub.due) return false;
    return ['已完成', '已取消', '草稿'].indexOf(sub.status) === -1 && parseDate(sub.due) < parseDate(D.meta.demoNow);
  }

  function isLateClosed(sub) {
    if (!sub || sub.status !== '已完成' || !sub.due || !sub.completedAt) return false;
    return parseDate(sub.completedAt) > parseDate(sub.due);
  }

  function mainStatus(task) {
    const subs = task.subs || [];
    if (task.canceled) return '已取消';
    if (task.draft) return '草稿';
    if (task.summaryRework) return '执行中';
    if (!subs.length) return task.status || '待分发';
    if (subs.every((s) => s.status === '已取消')) return '已取消';
    if (subs.every((s) => s.status === '已完成')) return '已完成';
    if (subs.some((s) => s.status === '已挂起')) return '已挂起';
    if (subs.some((s) => s.status === '审批中')) return '审批中';
    if (subs.some((s) => s.status === '执行中')) return '执行中';
    if (subs.some((s) => s.status === '待分发')) return '待分发';
    if (subs.every((s) => s.status === '草稿')) return '草稿';
    return '执行中';
  }

  function mainProgress(task) {
    if (!task.subs.length) return Number(task.progress) || 0;
    return Math.round(task.subs.reduce((n, s) => n + (s.progress || 0), 0) / task.subs.length);
  }

  function starForCount(count, star2, star3) {
    const two = Number(star2) || 5;
    const three = Number(star3) || 10;
    if (count >= three) return 3;
    if (count >= two) return 2;
    return 1;
  }

  function roleChip(name, role) {
    const label = role === 'initiator' ? '发起人' : role === 'owner' ? '负责人' : '执行人';
    return '<span class="role-chip ' + role + '" title="' + label + '">' + esc(name || '—') + '</span>';
  }

  function displayStatus(task) {
    if (!task) return '';
    if (task.canceled) return '已取消';
    if (task.draft) return '草稿';

    const la = task.leaderApproval;
    if (la) {
      if (la.status === '待汇总') return '待汇总';
      if (la.status === '已驳回') return '审批驳回';
      if (la.status === '已挂起') return '已挂起';
      if (la.status === '审批中') return approvalOverdue(la) ? '已挂起' : '审批中';
    }

    if (task.summaryRework) return '执行中';
    return mainStatus(task);
  }

  function overdueCount() {
    let n = 0;
    state.tasks.forEach((t) => {
      if (t.canceled || t.draft) return;
      t.subs.forEach((s) => { if (isOverdue(s)) n += 1; });
    });
    return n;
  }

  function unreadCount() {
    return state.messages.filter((m) => !m.read).length;
  }

  function pendingCount() {
    let n = 0;
    state.tasks.forEach((t) => {
      if (t.canceled || t.draft) return;
      t.subs.forEach((s) => {
        if (s.status === '待分发' || s.status === '审批中' || s.status === '已挂起') n += 1;
      });
      if (t.source === 'leader' && t.leaderApproval &&
        (t.leaderApproval.status === '审批中' || t.leaderApproval.status === '已挂起')) n += 1;
    });
    return n;
  }

  function myOpenSubs() {
    if (!state.user) return 0;
    let n = 0;
    state.tasks.forEach((t) => {
      if (t.canceled) return;
      t.subs.forEach((s) => {
        if (s.owner === state.user.name && ['已完成', '草稿', '已取消', '待分发'].indexOf(s.status) === -1) n += 1;
      });
    });
    return n;
  }

  function pageHead(o) {
    return '<div class="page-head">' +
      '<div><h1 class="page-title">' + o.title + '</h1>' +
      (o.sub ? '<p class="page-sub">' + o.sub + '</p>' : '') + '</div>' +
      (o.actions ? '<div class="page-actions">' + o.actions + '</div>' : '') +
      '</div>';
  }

  function emptyState(title, text, iconName) {
    return '<div class="empty-state"><div class="empty-icon">' + icon(iconName || 'search') + '</div>' +
      '<b>' + esc(title) + '</b><span>' + esc(text || '') + '</span></div>';
  }

  function csvEscape(v) {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function csv(rows) {
    return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
  }

  function download(name, content, mime) {
    const blob = new Blob(['\uFEFF' + content], { type: mime || 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  function exportPreview(opts) {
    const rows = opts.rows || [];
    const limit = Math.min(Math.max(0, rows.length - 1), 300);
    const head = rows.length ? rows[0] : [];
    const body = rows.slice(1, limit + 1);
    const total = Math.max(0, rows.length - 1);
    const isHtml = !!opts.html;
    const content = isHtml ? opts.html : csv(rows);
    const mime = isHtml ? 'text/html;charset=utf-8' : 'text/csv;charset=utf-8';
    const filename = opts.filename || ('ITO导出-' + D.meta.today + (isHtml ? '.html' : '.csv'));
    modal({
      title: opts.title || '导出预览',
      sub: opts.sub || (isHtml ? '预览确认后下载 HTML'
        : (total > limit ? '共 ' + total + ' 行 · 预览前 ' + limit + ' 行' : '共 ' + total + ' 行 · 全部预览')),
      wide: true,
      body: isHtml
        ? '<iframe class="report-frame export-preview-frame" title="导出预览"></iframe>'
        : '<div class="export-preview-wrap" tabindex="0" role="region" aria-label="导出数据预览"><table class="export-preview-table"><thead><tr>' +
            head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
          '</tr></thead><tbody>' +
            (body.length ? body.map(function (r) {
              return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
            }).join('') : '<tr><td colspan="' + Math.max(1, head.length) + '">暂无数据</td></tr>') +
          '</tbody></table>' +
          (total > limit ? '<p class="table-note" style="padding:10px 2px 0">仅预览前 ' + limit + ' 行，导出包含全部 ' + total + ' 行。</p>' : '') +
          '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><span class="spacer"></span>' +
        '<button class="btn btn-primary" data-export type="button">' + icon('download') + '确认下载</button>',
      onMount: function (close, root) {
        const frame = root.querySelector('.export-preview-frame');
        if (frame && isHtml) frame.srcdoc = content;
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-export]').addEventListener('click', function () {
          if (typeof opts.onDownload === 'function') opts.onDownload();
          else download(filename, content, mime);
          close();
          toast('导出已开始下载');
        });
      }
    });
  }

  function toast(message, kind) {
    const root = $('#toastRoot');
    if (!root) return;
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = icon(kind === 'warn' ? 'alert' : 'check') + '<span>' + esc(message) + '</span>';
    root.appendChild(node);
    setTimeout(() => {
      node.classList.add('leaving');
      setTimeout(() => node.remove(), 220);
    }, 2400);
  }

  /* ── notification popups ─────────────────── */
  const NOTIFY_DURATION = 6000;
  const NOTIFY_MAX = 2;

  function notifyIcon(type) {
    return ({ '审批': 'shield', '任务': 'task', '成果物': 'clipboard', '超期': 'clock', '消息': 'message', '系统': 'alert' })[type] || 'message';
  }

  function dismissNotification(card) {
    if (!card || card.classList.contains('leaving')) return;
    card.classList.add('leaving');
    setTimeout(() => card.remove(), 240);
  }

  function showNotification(n) {
    const root = $('#notifyRoot');
    if (!root) return;
    let active = Array.from(root.querySelectorAll('.notify-card:not(.leaving)'));
    while (active.length >= NOTIFY_MAX) {
      if (active[0].__notifyCleanup) active[0].__notifyCleanup();
      active[0].remove();
      active = Array.from(root.querySelectorAll('.notify-card:not(.leaving)'));
    }
    const card = document.createElement('div');
    card.className = 'notify-card';
    card.setAttribute('role', 'status');
    card.innerHTML =
      '<div class="notify-icon">' + icon(notifyIcon(n.type)) + '</div>' +
      '<div class="notify-main">' +
        '<div class="notify-head"><span>' + esc(n.type || '消息') + '</span><time>' + esc(n.time || '') + '</time></div>' +
        '<strong class="notify-title">' + esc(n.title || '新的消息') + '</strong>' +
        (n.body ? '<p>' + esc(n.body) + '</p>' : '') +
        '<div class="notify-foot">' +
          '<span class="notify-timer">6 秒后收起</span>' +
        '</div>' +
      '</div>' +
      '<button class="notify-close" type="button" aria-label="关闭通知">' + icon('close') + '</button>' +
      '<i class="notify-progress"></i>';
    root.appendChild(card);

    let remaining = NOTIFY_DURATION;
    let deadline = Date.now() + remaining;
    let timer = null;
    let tick = null;
    const timerEl = card.querySelector('.notify-timer');
    const clearTimers = () => { clearTimeout(timer); clearInterval(tick); };
    const paint = () => {
      if (!timerEl) return;
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      timerEl.textContent = left + ' 秒后收起';
    };
    const schedule = (ms) => {
      clearTimeout(timer);
      clearInterval(tick);
      deadline = Date.now() + ms;
      timer = setTimeout(() => { clearInterval(tick); dismissNotification(card); }, Math.max(600, ms));
      tick = setInterval(paint, 250);
      state.notifyTimers.push(timer, tick);
      paint();
    };
    const close = () => { clearTimers(); dismissNotification(card); };
    card.__notifyCleanup = clearTimers;
    card.querySelector('.notify-close').addEventListener('click', (e) => { e.stopPropagation(); close(); });
    card.addEventListener('click', (e) => {
      if (e.target.closest('.notify-close')) return;
      if (!n.link) return;
      e.preventDefault();
      close();
      location.hash = n.link.replace(/^#/, '');
    });
    card.addEventListener('mouseenter', () => {
      clearTimers();
      remaining = deadline - Date.now();
      card.classList.add('paused');
      if (timerEl) timerEl.textContent = '已暂停';
    });
    card.addEventListener('mouseleave', () => {
      card.classList.remove('paused');
      schedule(remaining);
    });
    schedule(remaining);
  }

  function flushNotifications() {
    if (!state.user) return;
    const list = state.notifications.filter((n) => n.to === state.user.name && !n.shown);
    list.slice(0, NOTIFY_MAX).forEach((n) => { n.shown = true; showNotification(n); });
  }

  function showEntryMessages() {
    if (!state.user || !state.role) return;
    /* 系统管理员界面不提供站内消息入口，也不再弹出消息卡。 */
    if (state.role === 'admin') return;
    if (state.entryNotified[state.role]) { flushNotifications(); return; }
    state.entryNotified[state.role] = true;
    const unread = state.messages.filter((m) => !m.read).slice(0, NOTIFY_MAX);
    unread.forEach((m) => {
      showNotification({
        id: 'ENTRY-' + m.id,
        type: m.type,
        title: m.title,
        body: m.body,
        time: m.time,
        link: '#/messages?id=' + m.id
      });
    });
    flushNotifications();
  }

  function clearNotifications() {
    state.notifyTimers.forEach((t) => clearTimeout(t));
    state.notifyTimers = [];
    const root = $('#notifyRoot');
    if (root) root.innerHTML = '';
  }

  function notify(target, payload) {
    if (!target) return;
    const n = {
      id: 'N-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      to: target,
      type: payload.type || '任务',
      title: payload.title || '新的任务通知',
      body: payload.body || '',
      time: payload.time || nowStamp(),
      link: payload.link || '#/tasks',
      shown: false
    };
    state.notifications.push(n);
    if (state.user && state.user.name === target) {
      n.shown = true;
      showNotification(n);
    }
  }

  /* ── overlays ────────────────────────────── */
  function lockScroll(on) {
    document.body.style.overflow = on ? 'hidden' : '';
  }

  let overlayDepth = 0;
  function setAppInert(on) {
    const app = document.getElementById('appView');
    if (!app) return;
    if (on) app.setAttribute('inert', '');
    else app.removeAttribute('inert');
  }
  function pushOverlay() {
    overlayDepth += 1;
    setAppInert(true);
  }
  function popOverlay() {
    overlayDepth = Math.max(0, overlayDepth - 1);
    if (!overlayDepth) setAppInert(false);
  }

  const modalStack = [];

  function modalFocusables(root) {
    if (!root) return [];
    return Array.from(root.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (el) {
      return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
    });
  }

  function onModalKey(e) {
    if (!modalStack.length) return;
    const top = modalStack[modalStack.length - 1];
    if (!top) return;
    if (e.key === 'Escape') {
      if (top.close) top.close();
      return;
    }
    if (e.key !== 'Tab' || !top.backdrop) return;
    const list = modalFocusables(top.backdrop);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && (document.activeElement === first || !top.backdrop.contains(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !top.backdrop.contains(document.activeElement))) {
      e.preventDefault();
      first.focus();
    }
  }

  function modal(o) {
    const root = $('#modalRoot');
    const previouslyFocused = document.activeElement;
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.zIndex = String(200 + modalStack.length * 4);
    backdrop.innerHTML =
      '<div class="modal' + (o.xwide ? ' xwide' : o.wide ? ' wide' : '') + (o.detail ? ' detail' : '') + (o.inset ? ' inset' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '">' +
        '<div class="modal-head">' +
          '<div><h2>' + esc(o.title) + '</h2>' + (o.sub ? '<p>' + esc(o.sub) + '</p>' : '') + '</div>' +
          '<button class="modal-close" type="button" aria-label="关闭">' + icon('close') + '</button>' +
        '</div>' +
        '<div class="modal-body">' + (o.body || '') + '</div>' +
        (o.foot ? '<div class="modal-foot">' + o.foot + '</div>' : '') +
      '</div>';
    root.appendChild(backdrop);

    let closed = false;
    const entry = { close: null, backdrop: backdrop };
    const close = () => {
      if (closed) return;
      closed = true;
      if (window.ITO && ITO.cleanupCustomFieldUploads) ITO.cleanupCustomFieldUploads(backdrop);
      const idx = modalStack.indexOf(entry);
      if (idx > -1) modalStack.splice(idx, 1);
      backdrop.remove();
      closeAllSelects();
      popOverlay();
      if (!modalStack.length) {
        lockScroll(false);
        document.removeEventListener('keydown', onModalKey);
      }
      if (typeof o.onClose === 'function') o.onClose();
      if (!modalStack.length && previouslyFocused && previouslyFocused.focus && document.contains(previouslyFocused)) {
        try { previouslyFocused.focus(); } catch (e) { /* noop */ }
      }
    };
    entry.close = close;
    modalStack.push(entry);
    pushOverlay();

    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    $('.modal-close', backdrop).addEventListener('click', close);
    if (modalStack.length === 1) document.addEventListener('keydown', onModalKey);
    lockScroll(true);
    if (typeof o.onMount === 'function') o.onMount(close, backdrop);
    if (window.ITO && ITO.mountCustomFields) ITO.mountCustomFields(backdrop);
    enhanceSelects(backdrop);
    enhanceFormDates(backdrop);
    ensureFormLabels(backdrop);
    ensureControlNames(backdrop);
    ensureTableA11y(backdrop);
    ensureRowKeyboard(backdrop);
    ensureHeadingOrder(backdrop);
    setTimeout(function () {
      ensureFormLabels(backdrop);
      ensureControlNames(backdrop);
      ensureTableA11y(backdrop);
      ensureRowKeyboard(backdrop);
      ensureHeadingOrder(backdrop);
    }, 450);
    const focusTarget = backdrop.querySelector('.modal-body input:not([type="hidden"]), .modal-body select, .modal-body textarea, .modal-foot .btn-primary') ||
      backdrop.querySelector('.modal-close');
    if (focusTarget) {
      setTimeout(function () {
        try { focusTarget.focus(); } catch (e) { /* noop */ }
      }, 0);
    }
    return close;
  }

  function confirmDialog(o) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (v) => { if (!settled) { settled = true; resolve(v); } };

      modal({
        title: o.title,
        sub: o.sub || '',
        body: '<p class="confirm-text">' + (o.text || '') + '</p>',
        foot:
          '<button class="btn btn-ghost" data-confirm="no" type="button">取消</button>' +
          '<button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-confirm="yes" type="button">' + esc(o.okText || '确认') + '</button>',
        onClose: function () { finish(false); },
        onMount(c, root) {
          root.querySelector('[data-confirm="no"]').addEventListener('click', () => { finish(false); c(); });
          root.querySelector('[data-confirm="yes"]').addEventListener('click', () => { finish(true); c(); });
        }
      });
    });
  }

  function detailModal(o) {
    return modal(Object.assign({}, o, { detail: true }));
  }

  function drawer(o) {
    const root = $('#drawerRoot');
    const previouslyFocused = document.activeElement;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      root.innerHTML = '';
      lockScroll(false);
      document.removeEventListener('keydown', onKey);
      popOverlay();
      if (previouslyFocused && previouslyFocused.focus && document.contains(previouslyFocused)) {
        try { previouslyFocused.focus(); } catch (e) { /* noop */ }
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      const list = modalFocusables(backdrop);
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || !backdrop.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !backdrop.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };

    root.innerHTML =
      '<div class="drawer-backdrop">' +
        '<aside class="drawer' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '">' +
          '<div class="drawer-head">' +
            '<div><h2>' + esc(o.title) + '</h2>' + (o.sub ? '<p>' + esc(o.sub) + '</p>' : '') + '</div>' +
            '<button class="modal-close" type="button" aria-label="关闭">' + icon('close') + '</button>' +
          '</div>' +
          '<div class="drawer-body">' + (o.body || '') + '</div>' +
          (o.foot ? '<div class="drawer-foot">' + o.foot + '</div>' : '') +
        '</aside>' +
      '</div>';

    const backdrop = root.firstElementChild;
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    $('.modal-close', backdrop).addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    lockScroll(true);
    pushOverlay();
    if (typeof o.onMount === 'function') o.onMount(close, backdrop);
    enhanceSelects(backdrop);
    enhanceFormDates(backdrop);
    ensureFormLabels(backdrop);
    ensureControlNames(backdrop);
    ensureTableA11y(backdrop);
    ensureRowKeyboard(backdrop);
    ensureHeadingOrder(backdrop);
    setTimeout(function () {
      ensureFormLabels(backdrop);
      ensureControlNames(backdrop);
      ensureTableA11y(backdrop);
      ensureRowKeyboard(backdrop);
      ensureHeadingOrder(backdrop);
    }, 450);
    const focusTarget = backdrop.querySelector('.drawer-body input, .drawer-body select, .drawer-body textarea, .drawer-foot .btn-primary, .modal-close');
    if (focusTarget) setTimeout(function () { try { focusTarget.focus(); } catch (e) { /* noop */ } }, 0);
    return close;
  }

  function closeOverlays() {
    modalStack.length = 0;
    closeAllSelects();
    document.removeEventListener('keydown', onModalKey);
    $('#modalRoot').innerHTML = '';
    $('#drawerRoot').innerHTML = '';
    lockScroll(false);
  }

  /* ── charts ──────────────────────────────── */
  const PREFERS_REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function chart(id, option) {
    const node = document.getElementById(id);
    if (!node || !window.echarts) return null;
    if (PREFERS_REDUCED) {
      option.animation = false;
      option.animationDuration = 0;
    }
    if (!node.hasAttribute('role')) node.setAttribute('role', 'img');
    if (!node.hasAttribute('aria-label')) node.setAttribute('aria-label', id + ' 图表');
    const inst = window.echarts.init(node, null, { renderer: 'canvas' });
    option.aria = Object.assign({ enabled: true, decal: { show: false } }, option.aria || {});
    inst.setOption(option);
    state.charts.push(inst);
    return inst;
  }

  function disposeCharts() {
    state.charts.forEach((c) => { try { if (c && !c.isDisposed()) c.dispose(); } catch (e) { /* noop */ } });
    state.charts = [];
  }

  window.addEventListener('resize', () => {
    state.charts.forEach((c) => { try { if (c && !c.isDisposed()) c.resize(); } catch (e) { /* noop */ } });
  });

  /* ── access ──────────────────────────────── */
  function isSuper() {
    return state.role === 'super';
  }

  function roleIs() {
    if (isSuper()) return true;
    return Array.prototype.slice.call(arguments).indexOf(state.role) > -1;
  }

  function perm(key) {
    if (isSuper()) return true;
    const set = state.permissions[state.role];
    return !!(set && set[key]);
  }

  const ACCESS = {
    tasks: () => perm('task') && state.role !== 'employee',
    dispatch: () => perm('task') && roleIs('leader', 'manager'),
    regular: () => perm('task') && state.role !== 'employee',
    workload: () => perm('task') && state.role !== 'employee',
    mine: () => perm('task'),
    personal: () => perm('task') && state.role !== 'admin',
    inspection: () => perm('inspect'),
    duty: () => perm('duty'),
    maintenance: () => perm('maintain'),
    overhaul: () => perm('overhaul'),
    groups: () => perm('group'),
    auth: () => perm('auth'),
    messages: () => perm('message'),
    dictionary: () => perm('dictionary'),
    alerts: () => perm('config'),
    roles: () => roleIs('admin'),
    tags: () => !!state.role,
    logs: () => roleIs('admin')
  };

  const ROUTE_TITLE = {
    tasks: '任务管理', dispatch: '派发与审批', regular: '常规任务', workload: '工时负载',
    mine: '我的任务', personal: '个人统计',
    inspection: '巡检管理', duty: '值班管理', maintenance: '维保管理',
    overhaul: '大修管理',
    groups: '组织架构', auth: '作业授权', messages: '站内消息',
    dictionary: '字典配置', alerts: '预警规则', roles: '角色权限', tags: '属性勋章', logs: '操作日志'
  };

  /* 同一路由在不同身份下使用不同名称，页面标题与侧边栏必须保持一致。 */
  function routeTitle(route) {
    if (route === 'mine' && state.role === 'leader') return '团队任务';
    if (route === 'personal') {
      return state.role === 'leader' ? '运营统计' : state.role === 'manager' ? '团队统计' : '个人统计';
    }
    return ROUTE_TITLE[route] || route;
  }

  function can(route) {
    const fn = ACCESS[route];
    return fn ? fn() : false;
  }

  function defaultRoute() {
    if (state.role === 'admin') return 'dictionary';
    return 'mine';
  }

  function hashParams() {
    const raw = (location.hash || '').replace(/^#\/?/, '');
    const q = raw.indexOf('?');
    const out = {};
    if (q < 0) return out;
    raw.slice(q + 1).split('&').forEach(function (pair) {
      if (!pair) return;
      const i = pair.indexOf('=');
      const k = i > -1 ? pair.slice(0, i) : pair;
      const v = i > -1 ? pair.slice(i + 1) : '';
      try { out[decodeURIComponent(k)] = decodeURIComponent(v); } catch (e) { out[k] = v; }
    });
    return out;
  }

  function parseHash() {
    const raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    if (ROUTE_TITLE[raw]) return raw;
    return defaultRoute();
  }

  function go(route, params) {
    if (!can(route)) { toast('当前身份无权访问该模块', 'warn'); return; }
    state.routeParams = params || {};
    if (route === 'tasks' && params && params.q != null) state.pendingQuery = params.q;
    const qs = params ? Object.keys(params).filter(function (k) {
      return params[k] != null && params[k] !== '';
    }).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&') : '';
    const hash = '#/' + route + (qs ? '?' + qs : '');
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function refresh() {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    normalizeApprovals();
    persistState();
    render({ preservePager: true, preserveScroll: true, scrollY: scrollY });
  }

  function log(action, target, type) {
    state.logs.unshift({
      time: nowStamp(),
      actor: state.user ? state.user.name : '系统',
      action: action,
      target: target,
      type: type || '操作'
    });
    persistState();
    /* 业务动作后顺带跑一次规则检测，命中只写站内消息与日志。 */
    if (window.ITO_ALERT_ENGINE && !window.ITO_ALERT_ENGINE.running) {
      window.ITO_ALERT_ENGINE.schedule(700);
    }
  }

  /* ── nav ─────────────────────────────────── */
  const NAV = [
    {
      label: '工作台', items: [
        { id: 'mine', name: '我的任务', icon: 'user', count: () => myOpenSubs() },
        { id: 'tasks', name: '任务管理', icon: 'task' },
        { id: 'personal', name: '个人统计', icon: 'chart' }
      ]
    },
    {
      label: '运维运营', items: [
        { id: 'inspection', name: '巡检管理', icon: 'clipboard' },
        { id: 'maintenance', name: '维保管理', icon: 'gear' },
        { id: 'duty', name: '值班管理', icon: 'calendar' }
      ]
    },
    {
      label: '', standalone: true, items: [
        { id: 'overhaul', name: '大修管理' }
      ]
    },
    {
      label: '组织与授权', items: [
        { id: 'groups', name: '组织架构', icon: 'users' },
        { id: 'auth', name: '作业授权', icon: 'shield' }
      ]
    },
    {
      label: '', standalone: true, items: [
        { id: 'messages', name: '站内消息', count: () => unreadCount() }
      ]
    },
    {
      label: '', standalone: true, items: [
        { id: 'tags', name: '属性勋章' }
      ]
    },
    {
      label: '配置中心', adminOnly: true, items: [
        { id: 'dictionary', name: '字典配置', icon: 'book' },
        { id: 'alerts', name: '预警规则', icon: 'alert' },
        { id: 'roles', name: '角色权限', icon: 'key' },
        { id: 'logs', name: '操作日志', icon: 'history' }
      ]
    }
  ];

  function navHtml() {
    return NAV.map((group) => {
      const items = group.items.filter((it) => can(it.id) && (!it.hide || !it.hide()));
      if (!items.length) return '';
      const label = group.label || '';
      const collapsed = label ? !!state.collapsed[label] : false;
      const isActive = (it) => state.route === it.id ||
        (it.id === 'tasks' && ['dispatch', 'regular', 'workload'].indexOf(state.route) > -1);
      const hasActive = items.some(isActive);
      const head = label
        ? '<div class="nav-label" role="button" tabindex="0" aria-expanded="' + (collapsed ? 'false' : 'true') + '">' +
            '<span class="nav-label-text">' + esc(label) + '</span>' +
            icon('chevron', 'nav-chevron') +
          '</div>'
        : '';
      return '<div class="nav-group' + (group.standalone ? ' standalone' : '') +
        (hasActive ? ' has-active' : '') + (collapsed ? ' collapsed' : '') + '" data-group="' + esc(label) + '">' +
        head +
        '<div class="nav-items">' + items.map((it) => {
          const count = it.count ? it.count() : 0;
          const name = esc(it.id === 'auth' && state.role === 'employee' ? '我的授权' : routeTitle(it.id));
          const content = group.standalone
            ? '<span>' + name + '</span>'
            : icon(it.icon) + '<span>' + name + '</span>';
          return '<a class="nav-item' + (isActive(it) ? ' active' : '') + '" href="#/' + it.id + '" data-route="' + it.id + '"' + (isActive(it) ? ' aria-current="page"' : '') + '>' +
            content +
            (count ? '<b class="nav-count">' + count + '</b>' : '') +
            '</a>';
        }).join('') + '</div></div>';
    }).join('');
  }

  function updateDevDock() {
    const dock = document.getElementById('devDock');
    if (!dock) return;
    const show = devMode && !!state.role && !$('#appView').hidden;
    dock.hidden = !show;
    if (!show) return;
    Array.prototype.forEach.call(dock.querySelectorAll('[data-dev-role]'), function (btn) {
      btn.classList.toggle('active', btn.dataset.devRole === state.role);
    });
  }

  function switchRole(role) {
    if (!D.roleInfo[role]) return;
    if (role === 'super' && !devMode) return;
    clearNotifications();
    closeOverlays();
    const url = new URL(location.href);
    url.searchParams.set('role', role);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    enterApp(role, { routeMode: 'preserve' });
  }

  function renderShell() {
    const u = state.user;
    $('#sideNav').innerHTML = navHtml();
    $('#appbarUser').innerHTML = avatar(u.name, true) +
      '<div><b>' + esc(u.name) + '</b><span>' + esc(u.role === u.name ? u.title : u.role) + '</span></div>';
    const screenLink = document.querySelector('.appbar-right .screen-link');
    if (screenLink) screenLink.style.display = state.role === 'admin' ? 'none' : '';
    /* 系统管理员界面以配置为主，不提供站内消息入口。 */
    const bell = document.getElementById('bellBtn');
    if (bell) bell.style.display = state.role === 'admin' ? 'none' : '';
    updateDevDock();
    const dateObj = parseDate(D.meta.today);
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dateObj.getDay()];
    $('#dateChip').textContent = D.meta.today.replace(/-/g, '.') + ' ' + weekday;
    const unread = unreadCount();
    const bellCount = $('#bellCount');
    const bellBtn = $('#bellBtn');
    if (bellCount) {
      bellCount.hidden = unread === 0;
      bellCount.textContent = unread === 0 ? '' : (unread > 9 ? '9+' : String(unread));
    }
    if (bellBtn) {
      bellBtn.setAttribute('aria-label', unread > 0 ? '消息通知，' + unread + ' 条未读' : '消息通知');
      bellBtn.title = unread > 0 ? '消息通知 · ' + unread + ' 条未读' : '消息通知';
    }
  }

  /* ── routing ─────────────────────────────── */
  /* ── accessibility helpers ───────────────── */
  function ensureFormLabels(root) {
    const scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll('.form-field'), function (field) {
      const label = field.querySelector(':scope > label');
      if (!label) return;
      const controls = Array.prototype.filter.call(
        field.querySelectorAll('input:not([type="hidden"]), select, textarea'),
        function (el) { return !el.closest('label'); }
      );
      if (controls.length !== 1) return;
      const control = controls[0];
      if (!control.id) control.id = 'ff-auto-' + (++formFieldSeq);
      if (!label.id) label.id = control.id + '-label';
      if (!label.hasAttribute('for')) label.setAttribute('for', control.id);
      if (label.querySelector('em') && control.getAttribute('aria-required') !== 'true') control.setAttribute('aria-required', 'true');
      const wrap = control.closest('.sel-wrap');
      const trigger = wrap && wrap.querySelector('.sel-trigger');
      if (trigger && !trigger.getAttribute('aria-labelledby')) trigger.setAttribute('aria-labelledby', label.id);
      if (trigger && control.getAttribute('aria-describedby') && !trigger.getAttribute('aria-describedby')) {
        trigger.setAttribute('aria-describedby', control.getAttribute('aria-describedby'));
      }
      if (trigger && control.getAttribute('aria-required') === 'true') {
        const labelText = trigger.getAttribute('aria-label') || '';
        if (labelText && labelText.indexOf('必填') === -1) trigger.setAttribute('aria-label', labelText + '，必填');
      }
    });
  }

  function ensureControlNames(root) {
    const scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll('input:not([type="hidden"]):not([type="button"]), select, textarea'), function (control) {
      if (control.labels && control.labels.length) return;
      if (control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')) return;
      if (control.type === 'checkbox' || control.type === 'radio' || control.type === 'file') return;
      let name = '';
      const cell = control.closest('td');
      const table = control.closest('table');
      if (cell && table) {
        const row = cell.parentElement;
        const index = Array.prototype.indexOf.call(row.children, cell);
        const heads = table.querySelectorAll('thead tr:last-child th');
        const head = heads[index] || table.querySelectorAll('thead th')[index];
        if (head) name = head.textContent.trim();
      }
      if (!name) name = control.getAttribute('placeholder') || control.getAttribute('title') || '';
      if (!name) return;
      control.setAttribute('aria-label', name.replace(/\s+/g, ' ').trim());
      const wrap = control.closest('.sel-wrap');
      const trigger = wrap && wrap.querySelector('.sel-trigger');
      if (trigger) trigger.setAttribute('aria-label', name.replace(/\s+/g, ' ').trim() + '：' + (trigger.textContent || '').trim());
    });
  }

  function ensureTableA11y(root) {
    const scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll('table'), function (table) {
      if (!table.hasAttribute('aria-label') && !table.querySelector('caption')) {
        const card = table.closest('.table-card, .card, .detail-section, .cf-preview-card');
        const head = card && card.querySelector('h2, h3, h4');
        if (head) table.setAttribute('aria-label', head.textContent.trim());
      }
      Array.prototype.forEach.call(table.querySelectorAll('thead th'), function (th) {
        if (!th.hasAttribute('scope')) th.setAttribute('scope', 'col');
      });
    });
    Array.prototype.forEach.call(scope.querySelectorAll('.table-wrap'), function (wrap) {
      const scrollable = wrap.scrollWidth > wrap.clientWidth + 1 || wrap.scrollHeight > wrap.clientHeight + 1;
      if (scrollable) {
        wrap.setAttribute('tabindex', '0');
        wrap.setAttribute('data-a11y-scroll', '1');
        if (!wrap.hasAttribute('role')) wrap.setAttribute('role', 'region');
        if (!wrap.hasAttribute('aria-label')) {
          const card = wrap.closest('.table-card, .card, .detail-section');
          const head = card && card.querySelector('h2, h3, h4');
          wrap.setAttribute('aria-label', (head ? head.textContent.trim() : '数据表格') + '，可滚动');
        }
      } else if (wrap.getAttribute('data-a11y-scroll') === '1') {
        wrap.removeAttribute('tabindex');
        wrap.removeAttribute('role');
        wrap.removeAttribute('data-a11y-scroll');
        wrap.removeAttribute('aria-label');
      }
    });
    Array.prototype.forEach.call(scope.querySelectorAll('.modal-body, .drawer-body'), function (body) {
      const scrollable = body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1;
      const hasFocusable = !!body.querySelector('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (scrollable && !hasFocusable) {
        body.setAttribute('tabindex', '0');
        body.setAttribute('role', 'region');
        if (!body.hasAttribute('aria-label')) body.setAttribute('aria-label', '弹窗内容，可滚动');
      } else if (body.getAttribute('data-a11y-scroll') === '1') {
        body.removeAttribute('tabindex');
        body.removeAttribute('role');
        body.removeAttribute('aria-label');
        body.removeAttribute('data-a11y-scroll');
      }
      if (scrollable && !hasFocusable) body.setAttribute('data-a11y-scroll', '1');
    });
  }

  function ensureRowKeyboard(root) {
    const scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll('tr[data-detail], tr[data-detail-task], tr[data-auth-person], tr[data-duty-week]'), function (row) {
      if (row.getAttribute('data-a11y-row') === '1' || row.hasAttribute('tabindex')) return;
      if (row.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')) {
        if (row.querySelector('[data-act="detail"], .task-name-text, [data-a11y-cell]')) return;
        const cells = Array.prototype.slice.call(row.querySelectorAll('td'));
        const cell = cells.find(function (td) {
          return !td.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        });
        if (!cell) return;
        cell.setAttribute('data-a11y-cell', '1');
        cell.setAttribute('tabindex', '0');
        cell.setAttribute('role', 'button');
        const label = cell.textContent.replace(/\s+/g, ' ').trim().slice(0, 60);
        cell.setAttribute('aria-label', (label ? label + '，' : '') + '查看详情');
        cell.addEventListener('keydown', function (event) {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          row.click();
        });
        return;
      }
      row.setAttribute('data-a11y-row', '1');
      row.setAttribute('tabindex', '0');
      const first = row.querySelector('td, th');
      const label = (first ? first.textContent : '').replace(/\s+/g, ' ').trim().slice(0, 60);
      row.setAttribute('aria-label', (label ? label + '，' : '') + '按 Enter 查看详情');
      row.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        row.click();
      });
    });
  }

  function ensureHeadingOrder(root) {
    const scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll('.table-head h3, h3.chart-title'), function (heading) {
      if (heading.getAttribute('data-a11y-heading') === '1') return;
      const h2 = document.createElement('h2');
      h2.className = heading.className;
      h2.setAttribute('data-a11y-heading', '1');
      while (heading.firstChild) h2.appendChild(heading.firstChild);
      heading.replaceWith(h2);
    });
    if (!scope.querySelector('h2')) {
      const firstLower = scope.querySelector('h3, h4');
      if (firstLower) {
        const h2 = document.createElement('h2');
        h2.className = 'sr-only';
        h2.textContent = '页面内容';
        firstLower.parentNode.insertBefore(h2, firstLower);
      }
    }
    if (!scope.querySelector('h3')) {
      const firstH4 = scope.querySelector('h4');
      if (firstH4) {
        const h3 = document.createElement('h3');
        h3.className = 'sr-only';
        h3.textContent = '详细内容';
        firstH4.parentNode.insertBefore(h3, firstH4);
      }
    }
  }

  function announceRoute(route) {
    document.title = routeTitle(route) + ' · ITO 运维管理平台';
    const ann = document.getElementById('routeAnnouncer');
    if (ann) ann.textContent = routeTitle(route) + '页面已加载';
  }

  function render(options) {
    if (!state.role) return;
    const opts = options || {};
    const route = parseHash();
    if (!can(route)) {
      const fallback = defaultRoute();
      if (location.hash === '#/' + fallback) {
        toast('当前身份无权访问该模块', 'warn');
        return;
      }
      location.hash = '#/' + fallback;
      return;
    }

    state.route = route;
    state.routeParams = hashParams();
    disposeCharts();
    if (!opts.preservePager) ITO.pagerState = {};
    closeOverlays();
    renderShell();

    if (window.ITO_ENSURE_AUTH_TAGS) window.ITO_ENSURE_AUTH_TAGS();

    const def = window.ITO_PAGES && window.ITO_PAGES[route];
    const root = $('#pageRoot');
    if (!def) {
      root.innerHTML = pageHead({ title: '模块建设中', sub: '该模块尚未接入' }) + emptyState('暂无内容', '请稍后再试');
      return;
    }

    root.innerHTML = def.render();
    if (typeof def.after === 'function') def.after();
    enhanceSelects(root);
    enhanceFormDates(root);
    ensureFormLabels(root);
    ensureControlNames(root);
    ensureTableA11y(root);
    ensureRowKeyboard(root);
    ensureHeadingOrder(root);

    const routeChanged = state.__a11yRoute && state.__a11yRoute !== route;
    state.__a11yRoute = route;
    if (routeChanged) {
      announceRoute(route);
      const heading = root.querySelector('.page-head h1');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        setTimeout(function () {
          try { heading.focus({ preventScroll: true }); } catch (e) { /* noop */ }
        }, 0);
      }
    }

    if (opts.preserveScroll) {
      const y = Number(opts.scrollY) || 0;
      requestAnimationFrame(function () {
        window.scrollTo({ top: y, behavior: 'auto' });
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    persistState();
  }

  /* ── login ───────────────────────────────── */
  const ROLE_ICON = { leader: 'chart', manager: 'users', employee: 'user', admin: 'shield' };

  function renderLogin() {
    const grid = $('#roleGrid');
    grid.innerHTML = Object.keys(D.roleInfo).filter((key) => key !== 'super').map((key) => {
      const r = D.roleInfo[key];
      return '<button class="role-card" type="button" data-role="' + key + '">' +
        '<span class="role-icon ' + key + '">' + icon(ROLE_ICON[key]) + '</span>' +
        '<span class="role-name">' + esc(r.role === r.name ? r.role : r.role + ' · ' + r.name) + '</span>' +
        '<span class="role-desc">' + esc(r.desc) + '</span>' +
        '<span class="role-arrow">→</span>' +
        '</button>';
    }).join('');

    grid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-role]');
      if (card) enterApp(card.dataset.role, { routeMode: 'default' });
    });
  }

  function enterApp(roleKey, options) {
    if (!D.roleInfo[roleKey]) return;
    if (roleKey === 'super' && !devMode) return;
    const opts = options || {};
    const mode = opts.routeMode || 'auto';
    const prevScroll = window.scrollY || 0;
    state.role = roleKey;
    state.user = D.roleInfo[roleKey];
    sessionStorage.setItem('ito.admin.role', roleKey);

    $('#loginView').hidden = true;
    $('#appView').hidden = false;
    renderShell();

    const fullHash = (location.hash || '').replace(/^#\/?/, '');
    const qIndex = fullHash.indexOf('?');
    const rawHash = qIndex > -1 ? fullHash.slice(0, qIndex) : fullHash;
    const rawQuery = qIndex > -1 ? fullHash.slice(qIndex) : '';
    const saved = parseHash();
    let target;
    if (mode === 'default') {
      target = defaultRoute();
    } else if (mode === 'preserve' && rawHash) {
      target = can(saved) ? saved : defaultRoute();
      if (target !== saved) toast('当前身份无权访问该模块，已返回默认页', 'warn');
    } else {
      target = !rawHash ? defaultRoute() : (can(saved) ? saved : defaultRoute());
    }
    const keepQuery = mode !== 'default' && target === rawHash;
    const hash = '#/' + target + (keepQuery ? rawQuery : '');
    if (location.hash === hash) {
      render({
        preservePager: mode === 'preserve',
        preserveScroll: mode === 'preserve',
        scrollY: prevScroll
      });
    } else {
      location.hash = hash;
    }
    setTimeout(showEntryMessages, 420);
    if (window.ITO_ALERT_ENGINE) window.ITO_ALERT_ENGINE.start();
  }

  function logout() {
    clearNotifications();
    state.role = null;
    state.user = null;
    state.entryNotified = {};
    sessionStorage.removeItem('ito.admin.role');
    disposeCharts();
    closeOverlays();
    $('#appView').hidden = true;
    $('#loginView').hidden = false;
    $('#sideNav').innerHTML = '';
    updateDevDock();
    location.hash = '';
    window.scrollTo(0, 0);
  }

  /* ── task status migration / approval clock ─ */
  function migrateTask(task) {
    task.mode = task.mode || 'split';
    task.draft = !!task.draft;
    task.canceled = task.canceled || null;
    task.summaryRework = !!task.summaryRework;
    task.leaderApproval = task.leaderApproval || null;
    task.source = task.source || (task.initiator === D.roleInfo.leader.name ? 'leader' : task.initiator === '系统' ? 'system' : 'self');

    task.subs = (task.subs || []).map((sub) => {
      if (sub.status === '待派发') sub.status = '待分发';
      if (sub.status === '待接收') sub.status = '执行中';
      if (sub.status === '待审批') sub.status = '执行中';
      sub.tags = sub.tags || [];
      if (sub.status === '审批中' || sub.status === '已挂起') {
        if (!sub.approval) {
          const submittedAt = sub.submittedAt || task.due || D.meta.demoNow;
          sub.approval = {
            level: 1,
            approver: groupManagerName(sub.group) || task.owner,
            status: sub.status === '已挂起' ? '已挂起' : '待审批',
            submittedAt: submittedAt,
            dueAt: addHours(submittedAt, APPROVAL_HOURS),
            decidedAt: '',
            comment: ''
          };
        }
      }
      return sub;
    });

    if (task.source === 'leader') {
      const done = task.subs.length && task.subs.every((s) => s.status === '已完成');
      if (!task.leaderApproval && done) {
        task.leaderApproval = {
          status: '待汇总', approver: task.initiator,
          submittedAt: '', dueAt: '', decidedAt: '', comment: ''
        };
      }
    }
    return task;
  }

  function normalizeApprovals() {
    state.tasks.forEach((task) => {
      if (task.canceled) return;
      task.subs.forEach((sub) => {
        if (sub.status === '审批中' && sub.approval && approvalOverdue(sub.approval)) {
          sub.status = '已挂起';
          sub.approval.status = '已挂起';
        }
      });
      if (task.source === 'leader' && task.leaderApproval &&
        task.leaderApproval.status === '审批中' && approvalOverdue(task.leaderApproval)) {
        task.leaderApproval.status = '已挂起';
      }
    });
  }

  /* ── boot ────────────────────────────────── */
  function idNum(value, prefix) {
    const raw = String(value == null ? '' : value).replace(prefix || '', '');
    const n = Number(String(raw).replace(/\D/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function sortNewest(list, selector) {
    list.sort(function (a, b) {
      const av = String(selector(a) || '');
      const bv = String(selector(b) || '');
      return bv.localeCompare(av);
    });
    return list;
  }

  function nextTaskId() {
    const prefix = 'TS-' + String(D.meta.today || '').slice(0, 7).replace('-', '') + '-';
    let max = 0;
    state.tasks.forEach(function (t) {
      if (String(t.id).indexOf(prefix) !== 0) return;
      max = Math.max(max, Number(String(t.id).slice(prefix.length)) || 0);
    });
    return prefix + String(max + 1).padStart(4, '0');
  }

  function ensureAudit(obj, at, by, label) {
    if (!obj) return;
    obj.createdAt = obj.createdAt || at;
    obj.createdBy = obj.createdBy || by || '系统';
    obj.updatedAt = obj.updatedAt || obj.createdAt;
    obj.updatedBy = obj.updatedBy || obj.createdBy;
    obj.audit = obj.audit || [{ time: obj.createdAt, actor: obj.createdBy, action: label || '创建' }];
  }

  function planTaskId(plan, type) {
    return 'PT-' + plan.id + '-' + String(plan.next || '').replace(/\D/g, '').slice(0, 12);
  }

  function syncPlanTasks() {
    const st = state;
    const pending = [];
    const add = function (plan, type) {
      if (!plan || plan.status !== '启用' || !plan.next) return;
      const existing = (st.planTasks || []).find(function (task) {
        return task.planId === plan.id && task.planType === type && task.due === plan.next && task.status !== '已完成';
      });
      const data = {
        planId: plan.id,
        planType: type,
        name: plan.name + (type === 'inspection' ? ' · 巡检任务' : ' · 维保任务'),
        group: plan.group,
        owner: plan.owner,
        executor: plan.executor || plan.owner,
        due: plan.next,
        hours: Number(plan.hours) || 0,
        source: type === 'inspection' ? '巡检计划' : '维保计划',
        tags: [type === 'inspection' ? '巡检' : '维保', plan.name],
        status: '计划中'
      };
      if (existing) Object.assign(existing, data);
      else st.planTasks.push(Object.assign({ id: planTaskId(plan, type), createdAt: D.meta.demoNow, createdBy: st.user ? st.user.name : '系统' }, data));
      pending.push(existing || st.planTasks[st.planTasks.length - 1]);
    };
    (st.inspectionPlans || []).forEach(function (plan) { add(plan, 'inspection'); });
    (st.maintenancePlans || []).forEach(function (plan) { add(plan, 'maintenance'); });

    /* 值班作为常规任务：当前周 + 未来 2 周，出勤写入实际工时。 */
    if (st.duty && st.duty.weeks && st.duty.weeks.length) {
      const duty = st.duty;
      const ci = duty.weeks.findIndex(function (w) { return w.key === duty.currentKey; });
      const ROLE_CODE = { '应急': 'YJ', '线路': 'XL', '网络': 'WL', '桌面': 'ZM' };
      duty.weeks.forEach(function (w, wi) {
        if (ci < 0 || wi < ci || wi > ci + 2) return;
        (w.dutyRoster || []).forEach(function (row) {
          if (!row.post || row.post.indexOf('通信值班-') !== 0) return;
          const role = row.post.replace('通信值班-', '');
          const code = ROLE_CODE[role] || role;
          const planId = 'DUTY-' + w.key + '-' + code;
          const calls = (duty.calls || []).filter(function (c) {
            return c.weekKey === w.key && c.role === role && c.person === row.name;
          });
          const actual = calls.reduce(function (n, c) { return n + (Number(c.hours) || 0); }, 0);
          const data = {
            planId: planId,
            planType: 'duty',
            name: '通信值班 · 第' + w.weekNo + '周 · ' + role,
            group: 'comm',
            owner: (D.groups.find(function (g) { return g.id === 'comm'; }) || {}).manager || D.roleInfo.manager.name,
            executor: row.name,
            due: w.end + ' 20:00',
            hours: 8,
            source: '值班',
            tags: ['值班', role],
            status: wi === ci ? '进行中' : '计划中',
            actualHours: actual,
            attendances: calls
          };
          const existing = (st.planTasks || []).find(function (task) { return task.id === 'PT-' + planId; });
          if (existing) Object.assign(existing, data);
          else st.planTasks.push(Object.assign({ id: 'PT-' + planId, createdAt: D.meta.demoNow, createdBy: '系统' }, data));
          pending.push(existing || st.planTasks[st.planTasks.length - 1]);
        });
      });
    }

    const wanted = {};
    pending.forEach(function (task) { wanted[task.id] = true; });
    st.planTasks = (st.planTasks || []).filter(function (task) {
      return task.status === '已完成' || wanted[task.id];
    });
    st.planTasks.sort(function (a, b) { return String(a.due).localeCompare(String(b.due)); });
  }

  function completePlanTask(planId, type, actualHours) {
    const task = (state.planTasks || []).find(function (item) {
      return item.planId === planId && item.planType === type && item.status !== '已完成';
    });
    if (!task) return;
    task.status = '已完成';
    task.actualHours = Number(actualHours) || task.hours || 0;
    task.completedAt = D.meta.demoNow;
    task.updatedAt = D.meta.demoNow;
    task.updatedBy = state.user ? state.user.name : '系统';
  }

  function migrateTaskMainFields() {
    const key = 'ito.ops.field.taskMainDisabled.v1';
    let applied = false;
    try {
      applied = !!(window.localStorage && window.localStorage.getItem(key) === '1');
    } catch (e) {
      applied = false;
    }
    if (applied) return false;

    const ids = ['CF-TASK-CHANGE', 'CF-TASK-CHANGE-TYPE', 'CF-TASK-EMERGENCY'];
    let changed = false;
    (state.fieldDefs || []).forEach(function (f) {
      if (ids.indexOf(f.id) > -1 && f.enabled !== false) {
        f.enabled = false;
        changed = true;
      }
    });
    try {
      if (window.localStorage) window.localStorage.setItem(key, '1');
    } catch (e) {
      /* 本地存储不可用时仅在当前内存状态生效 */
    }
    return changed;
  }

  function initState() {
    state.tasks = clone(D.tasks).map(migrateTask);
    state.personalArchive = clone(D.personalArchive || []);
    state.messages = clone(D.messages);
    state.logs = clone(D.logs);
    state.staff = clone(D.staff);
    state.dutyTypes = clone(D.dutyTypes || []);
    state.groups = clone(D.groups);
    state.auths = clone(D.auths);
    state.alertRules = clone(D.alertRules);
    state.achievements = clone(D.achievements);
    state.personAchievements = clone(D.personAchievements || []);
    state.wallTags = clone(D.achievementWall || []);
    state.inspectionPlans = clone(D.inspectionPlans);
    state.inspectionRecords = clone(D.inspectionRecords);
    state.maintenancePlans = clone(D.maintenancePlans);
    state.maintenanceRecords = clone(D.maintenanceRecords);
    state.duty = clone(D.duty);
    state.planTasks = [];
    syncPlanTasks();
    state.permissions = clone(D.permissions);
    state.metrics = clone(D.dashboard);
    state.trend = clone(D.trend);
    state.dictionaries = clone(D.dictionaries || []);
    state.fieldDefs = clone(D.fieldDefs || []);
    state.overhaul = clone(D.overhaul || {});

    /* 刷新恢复上一次本地快照；版本 / 演示日期变化时自动回到初始演示数据。 */
    const restored = loadSnapshot();
    state.__restoredSnapshot = !!restored;
    if (restored) {
      restoreSnapshot(restored);
      /* 旧快照缺少新追加的常规计划时，补入默认计划，保留原有任务与记录。 */
      const mergePlans = function (target, defaults) {
        (defaults || []).forEach(function (plan) {
          if (!target.some(function (x) { return x.id === plan.id; })) target.push(clone(plan));
        });
      };
      mergePlans(state.inspectionPlans || (state.inspectionPlans = []), D.inspectionPlans);
      mergePlans(state.maintenancePlans || (state.maintenancePlans = []), D.maintenancePlans);
      syncPlanTasks();
    }

    /* 旧快照可能缺少新版权限键，按默认值补齐。 */
    Object.keys(D.permissions || {}).forEach(function (role) {
      state.permissions[role] = Object.assign({}, D.permissions[role], state.permissions[role] || {});
    });
    /* 变更单号已由顶部模糊搜索覆盖：列表列移除，详情与导出保留。 */
    (state.fieldDefs || []).forEach(function (f) {
      if (f.id === 'CF-TASK-CHANGE') {
        f.list = false;
        f.filter = false;
      }
    });
    /* 业务系统统一使用任务标签：移除旧的自定义字段，并把旧值迁入标签。 */
    state.fieldDefs = (state.fieldDefs || []).filter(function (f) { return f.id !== 'CF-TASK-IMPACT'; });
    /* 主任务扩展字段默认停用；仅首次迁移，保留管理员后续在字段定义中重新启用的选择。 */
    state.__taskMainFieldsMigrated = migrateTaskMainFields();
    const officialSystems = {};
    (D.systemGroups || []).forEach(function (group) {
      (group.systems || []).forEach(function (name) { officialSystems[name] = true; });
    });
    const tagRenames = {
      '移动终端设备': '终端',
      '视频会议': '视频会议系统',
      '卫星电话': '卫星电话系统',
      '厂房通信': '厂房通信系统'
    };
    const normalizeTags = function (tags) {
      const out = [];
      (tags || []).forEach(function (tag) {
        const name = tagRenames[tag] || tag;
        if (out.indexOf(name) === -1) out.push(name);
      });
      return out;
    };
    state.tasks.forEach(function (task) {
      task.tags = normalizeTags(task.tags);
      (task.subs || []).forEach(function (sub) { sub.tags = normalizeTags(sub.tags); });
      if (!task.extra || task.extra.impactSystem == null || task.extra.impactSystem === '') return;
      const values = String(task.extra.impactSystem).split(/[、,，]/).map(function (v) { return v.trim(); }).filter(Boolean);
      const additions = [];
      values.forEach(function (value) {
        const normalized = tagRenames[value] || value;
        if (officialSystems[normalized]) additions.push(normalized);
        else {
          const group = (D.systemGroups || []).find(function (g) { return g.name === normalized; });
          if (group) (group.systems || []).forEach(function (name) { additions.push(name); });
        }
      });
      if (additions.length) {
        task.tags = (task.tags || []).slice();
        additions.forEach(function (name) {
          if (task.tags.indexOf(name) === -1) task.tags.push(name);
        });
      }
      delete task.extra.impactSystem;
    });

    /* 统一“新建内容置顶、历史内容倒序”的展示顺序 */
    state.tasks.sort(function (a, b) {
      return String(b.id).localeCompare(String(a.id));
    });
    sortNewest(state.messages, function (m) { return m.time; });
    sortNewest(state.logs, function (l) { return l.time; });
    sortNewest(state.inspectionRecords, function (r) { return r.time; });
    sortNewest(state.maintenanceRecords, function (r) { return r.time; });
    state.auths.sort(function (a, b) { return idNum(b.id, 'AU-') - idNum(a.id, 'AU-'); });
    state.inspectionPlans.sort(function (a, b) { return idNum(b.id, 'IP-') - idNum(a.id, 'IP-'); });
    state.maintenancePlans.sort(function (a, b) { return idNum(b.id, 'MP-') - idNum(a.id, 'MP-'); });

    /* 新记录编号从现有最大值继续，避免刷新后重复 */
    state.taskSeq = state.tasks.reduce(function (n, t) { return Math.max(n, idNum(t.id, 'T')); }, 10030) + 1;
    state.staffSeq = state.staff.reduce(function (n, p) { return Math.max(n, idNum(p.uid, 'E')); }, 20008);
    state.authSeq = state.auths.reduce(function (n, a) {
      return Math.max(n, Number(String(a.id).split('-').pop()) || 0);
    }, 187);
    state.planSeq = state.inspectionPlans.reduce(function (n, p) { return Math.max(n, idNum(p.id, 'IP-')); }, 5);
    state.mpPlanSeq = state.maintenancePlans.reduce(function (n, p) { return Math.max(n, idNum(p.id, 'MP-')); }, 4);
    state.recordSeq = state.inspectionRecords.reduce(function (n, r) { return Math.max(n, idNum(r.id, 'IR-')); }, 1027);

    /* 演示数据补齐审计字段，后续所有新建 / 编辑都会继续追加 */
    state.tasks.forEach(function (t, i) {
      ensureAudit(t, '2026-10-20 09:' + String(10 + (i % 40)).padStart(2, '0'), t.initiator || '系统', '创建任务');
    });
    state.inspectionPlans.forEach(function (p, i) {
      ensureAudit(p, '2026-10-0' + ((i % 8) + 1) + ' 09:00', p.owner || '系统', '创建计划');
      if (!p.statusChangedAt) { p.statusChangedAt = p.createdAt; p.statusChangedBy = p.createdBy; }
    });
    state.maintenancePlans.forEach(function (p, i) {
      ensureAudit(p, '2026-10-0' + ((i % 8) + 1) + ' 10:00', p.owner || '系统', '创建计划');
      if (!p.statusChangedAt) { p.statusChangedAt = p.createdAt; p.statusChangedBy = p.createdBy; }
    });
    state.staff.forEach(function (p) {
      ensureAudit(p, (p.joined || D.meta.today) + ' 09:00', '系统', '加入组织');
    });
    state.auths.forEach(function (a) {
      ensureAudit(a, '2026-01-01 09:00', D.roleInfo.manager.name, '创建授权');
    });
    state.wallTags.forEach(function (t) {
      ensureAudit(t, '2025-01-01 09:00', '系统', '创建标签');
    });
    state.alertRules.forEach(function (r, i) {
      ensureAudit(r, '2026-09-0' + ((i % 8) + 1) + ' 09:00', '系统', '创建预警规则');
      if (!r.statusChangedAt) { r.statusChangedAt = r.createdAt; r.statusChangedBy = r.createdBy; }
    });

    normalizeApprovals();
  }

  function bindShell() {
    $('#switchRoleBtn').addEventListener('click', logout);

    $('#sideNav').addEventListener('click', (e) => {
      const label = e.target.closest('.nav-label');
      if (label) {
        const group = label.parentElement;
        const key = group.dataset.group;
        state.collapsed[key] = !state.collapsed[key];
        group.classList.toggle('collapsed', state.collapsed[key]);
        label.setAttribute('aria-expanded', state.collapsed[key] ? 'false' : 'true');
        return;
      }
      if (e.target.closest('.nav-item')) closeMobileNav();
    });
    $('#sideNav').addEventListener('keydown', (e) => {
      const label = e.target.closest('.nav-label');
      if (!label || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      label.click();
    });

    $('#bellBtn').addEventListener('click', () => go('messages'));

    const devDock = $('#devDock');
    if (devDock) {
      devDock.addEventListener('click', (e) => {
        const reset = e.target.closest('[data-dev-reset]');
        if (reset) {
          confirmDialog({
            title: '重置演示数据',
            text: '将清空成果物、审批流程与本地演示数据，恢复初始状态。当前角色保持不变。',
            okText: '重置并刷新',
            danger: true
          }).then(function (ok) {
            if (ok) resetDemoData();
          });
          return;
        }
        const btn = e.target.closest('[data-dev-role]');
        if (btn) switchRole(btn.dataset.devRole);
      });
    }

    const loginReset = $('#loginReset');
    if (loginReset) {
      loginReset.addEventListener('click', function () {
        confirmDialog({
          title: '重置演示数据',
          text: '将清空本地任务、自定义字段、附件与操作记录，恢复到初始演示状态。',
          okText: '重置演示',
          danger: true
        }).then(function (ok) { if (ok) resetDemoData(); });
      });
    }

    const skip = document.querySelector('.skip-link');
    if (skip) {
      skip.addEventListener('click', function (event) {
        event.preventDefault();
        const main = $('#pageRoot');
        if (main) {
          main.focus({ preventScroll: false });
          main.scrollIntoView({ block: 'start' });
        }
      });
    }

    $('#menuBtn').addEventListener('click', () => {
      const opening = !$('#sidebar').classList.contains('open');
      $('#sidebar').classList.toggle('open', opening);
      $('#sidebarScrim').classList.toggle('on', opening);
      $('#menuBtn').setAttribute('aria-expanded', String(opening));
    });
    $('#sidebarScrim').addEventListener('click', closeMobileNav);

    window.addEventListener('hashchange', render);
  }

  function closeMobileNav() {
    $('#sidebar').classList.remove('open');
    $('#sidebarScrim').classList.remove('on');
    const menu = $('#menuBtn');
    if (menu) menu.setAttribute('aria-expanded', 'false');
  }

  function boot() {
    const bootUrl = new URL(location.href);
    let resetRequested = false;
    if (bootUrl.searchParams.get('reset') === '1') {
      resetRequested = true;
      if (DATA_SOURCE && DATA_SOURCE.clear) DATA_SOURCE.clear();
      sessionStorage.removeItem('ito.admin.role');
      bootUrl.searchParams.delete('reset');
      history.replaceState(null, '', bootUrl.pathname + bootUrl.search + bootUrl.hash);
    }
    initState();
    if (state.__taskMainFieldsMigrated) persistState(true);
    if (!resetRequested && !state.__restoredSnapshot && window.DeliverableStore && window.DeliverableStore.applyWorkflow) {
      window.DeliverableStore.applyWorkflow();
    }

    if (!D.meta.demoOverride) {
      setInterval(function () {
        if (todayKey() !== D.meta.today) location.reload();
      }, 60000);
    }

    const params = new URLSearchParams(location.search);
    if (params.get('still') === '1') document.documentElement.classList.add('still');
    devMode = location.protocol === 'file:' ||
      /^(localhost|127\.0\.0\.1|::1|\[::1\])$/.test(location.hostname) ||
      params.get('dev') === '1';

    /* 进入界面前先跑一次规则检测，保证列表里的“最近触发”是最新一轮结果。 */
    if (window.ITO_ALERT_ENGINE) window.ITO_ALERT_ENGINE.check({ auto: true, boot: true });

    renderLogin();
    bindShell();
    updateDevDock();

    if (window.DeliverableStore && window.DeliverableStore.ready) {
      window.DeliverableStore.ready.then(async function () {
        if (resetRequested && window.DeliverableStore.resetAll) {
          try {
            await window.DeliverableStore.resetAll();
            if (window.DeliverableStore.seedSamples) await window.DeliverableStore.seedSamples();
          } catch (e) { /* noop */ }
        }
        if (window.DeliverableStore.error) {
          toast('成果物存储初始化失败：' + (window.DeliverableStore.error.message || '请刷新页面重试'), 'warn');
        }
        if (!resetRequested && !state.__restoredSnapshot && window.DeliverableStore.applyWorkflow) {
          window.DeliverableStore.applyWorkflow();
        }
        if (state.role) render();
      });
    }

    const forceLogin = params.get('login') === '1' || params.get('roles') === '1';
    const saved = sessionStorage.getItem('ito.admin.role');
    const requested = params.get('role');
    if (!forceLogin && requested && D.roleInfo[requested] && (requested !== 'super' || devMode)) {
      enterApp(requested);
    } else if (!forceLogin && saved && D.roleInfo[saved] && (saved !== 'super' || devMode)) {
      enterApp(saved);
    } else {
      $('#appView').hidden = true;
      $('#loginView').hidden = false;
      updateDevDock();
    }
  }

  function taskTabs(active) {
    const items = [
      { id: 'ledger', name: '任务台账', href: '#/tasks' },
      { id: 'dispatch', name: '派发与审批', href: '#/dispatch' },
      { id: 'workload', name: '工时负载', href: '#/workload' }
    ];
    return '<div class="tabs task-tabs">' + items.map(function (item) {
      return '<a class="tab' + (item.id === active ? ' active' : '') + '" href="' + item.href + '">' + item.name + '</a>';
    }).join('') + '</div>';
  }

  /* ── pager：列表分页（路由切换时重置；页面内 refresh 保留当前页） ── */
  ITO.pagerState = {};
  ITO.pager = function (id, total, page, pageSize) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const cur = Math.min(Math.max(1, page), pages);
    if (!total) return '';
    return '<div class="pager"><span class="pager-info">共 ' + total + ' 条</span>' +
      '<span class="pager-nums">' +
      '<button type="button" class="pager-nav" data-pager="' + id + '" data-page="' + (cur - 1) + '"' + (cur <= 1 ? ' disabled' : '') + ' aria-label="上一页">‹</button>' +
      '<span class="pager-current">第 <input class="pager-input" type="text" inputmode="numeric" pattern="[0-9]*" value="' + cur + '" data-pager-input="' + id + '" data-pages="' + pages + '" title="输入页码后按回车跳转" aria-label="当前第 ' + cur + ' 页，共 ' + pages + ' 页，输入页码后跳转"> / ' + pages + ' 页</span>' +
      '<button type="button" class="pager-nav" data-pager="' + id + '" data-page="' + (cur + 1) + '"' + (cur >= pages ? ' disabled' : '') + ' aria-label="下一页">›</button>' +
      '<button type="button" class="pager-jump" data-pager="' + id + '" data-page="' + cur + '" hidden aria-hidden="true"></button>' +
      '</span></div>';
  };

  document.addEventListener('keydown', function (e) {
    const input = e.target && e.target.closest ? e.target.closest('[data-pager-input]') : null;
    if (!input || e.key !== 'Enter') return;
    e.preventDefault();
    input.blur();
  });

  document.addEventListener('change', function (e) {
    const input = e.target && e.target.closest ? e.target.closest('[data-pager-input]') : null;
    if (!input) return;
    const pages = Math.max(1, Number(input.dataset.pages) || 1);
    const value = Math.round(Number(input.value));
    const page = Math.min(Math.max(1, Number.isFinite(value) ? value : 1), pages);
    input.value = String(page);
    const pager = input.closest('.pager');
    const jump = pager && pager.querySelector('.pager-jump');
    if (!jump) return;
    jump.dataset.page = String(page);
    jump.click();
  });

  /* ── public API ──────────────────────────── */
  ITO.ui = {
    $, $$, esc, icon, badge, groupPill, avatar, roleChip, progressBar, isOverdue, isLateClosed, mainStatus, displayStatus,
    mainProgress, starForCount, pageHead, emptyState, taskTabs, csv, download, exportPreview, toast, modal, confirm: confirmDialog,
    drawer, detailModal, chart, groupOptions, staffOptions, peopleOptions, leadOptions, statusOptions, formRow, shortDate, addCycle,
    showFieldError, clearFieldError, validateRequired, bindFieldClear, enhanceSelects, enhanceFormDates,
    fmtDateTime, addHours, APPROVAL_HOURS, approvalOverdue, isTaskEditable, isTaskCancelable,
    leaderApprovalOf, isLeaderApprovalPending, normalizeApprovals, groupManagerName
  };
  ITO.go = go;
  ITO.nextTaskId = nextTaskId;
  ITO.refresh = refresh;
  ITO.log = log;
  ITO.persistState = persistState;
  ITO.resetDemoData = resetDemoData;
  ITO.dataSource = DATA_SOURCE;
  ITO.buildVersion = BUILD_VERSION;
  ITO.notify = notify;
  ITO.can = can;
  ITO.isReadOnly = () => state.role === 'admin' && !isSuper();
  ITO.isSuper = isSuper;
  ITO.roleIs = roleIs;
  ITO.canSwitchDutyActor = function () { return devMode && roleIs('employee'); };
  ITO.switchDutyActor = function (name) {
    if (!ITO.canSwitchDutyActor()) return;
    const member = state.staff.find(function (person) { return person.name === name; });
    if (!member) return;
    clearNotifications();
    closeOverlays();
    state.user = Object.assign({}, D.roleInfo.employee, { name: member.name, title: member.title });
    renderShell();
    render();
  };
  ITO.switchRole = switchRole;
  ITO.renderShell = renderShell;
  ITO.logout = logout;
  ITO.routes = ROUTE_TITLE;
  ITO.routeName = routeTitle;
  ITO.syncPlanTasks = syncPlanTasks;
  ITO.completePlanTask = completePlanTask;
  ITO.getGroup = groupById;
  ITO.counts = { overdueCount, unreadCount, pendingCount, myOpenSubs };
  ITO.disposeCharts = disposeCharts;

  /* small shared option builders used by page modules */
  function groupOptions(selected) {
    return state.groups.map((g) => '<option value="' + g.id + '"' + (g.id === selected ? ' selected' : '') + '>' + esc(g.name) + '</option>').join('');
  }

  function groupOrder(gid) {
    const idx = state.groups.findIndex((g) => g.id === gid);
    return idx < 0 ? 99 : idx;
  }

  function staffOptions(groupId, selected) {
    return state.staff
      .filter((s) => !groupId || s.group === groupId)
      .sort((a, b) => groupOrder(a.group) - groupOrder(b.group) || a.name.localeCompare(b.name, 'zh'))
      .map((s) => {
        const group = state.groups.find((g) => g.id === s.group) || {};
        return '<option value="' + esc(s.name) + '"' +
          (s.name === selected ? ' selected' : '') +
          ' data-label="' + esc(s.name) + '"' +
          ' data-meta="' + esc(s.title || '') + '"' +
          ' data-group="' + esc(group.name || '') + '"' +
          ' data-role="' + esc(group.leader === s.name ? '组长' : (group.manager === s.name ? '主管' : '')) + '">' +
          esc(s.name) + ' · ' + esc(s.title) + '</option>';
      })
      .join('');
  }

  function leadOptions(groupId, selected) {
    const groups = state.groups.filter((g) => !groupId || g.id === groupId);
    const names = {};
    groups.forEach((g) => { if (g.manager) names[g.manager] = g; if (g.leader) names[g.leader] = g; });
    return state.staff.filter((s) => names[s.name])
      .sort((a, b) => groupOrder(a.group) - groupOrder(b.group) || a.name.localeCompare(b.name, 'zh'))
      .map((s) => {
      const group = names[s.name] || {};
      return '<option value="' + esc(s.name) + '"' + (s.name === selected ? ' selected' : '') +
        ' data-label="' + esc(s.name) + '"' +
        ' data-meta="' + esc(group.name || '') + ' · ' + esc(s.title || '') + '"' +
        ' data-group="' + esc(group.name || '') + '"' +
        ' data-role="' + esc(group.manager === s.name ? '主管' : '组长') + '">' +
        esc(s.name) + ' · ' + esc(s.title) + '</option>';
    }).join('');
  }

  function peopleOptions(groupId, selected, options) {
    const opts = options || {};
    const showLoad = !!options;
    const group = state.groups.find((g) => g.id === groupId);
    const list = [];
    const seen = {};
    if (group && group.manager) {
      list.push({ name: group.manager, title: '组主管', gid: group.id });
      seen[group.manager] = true;
    }
    state.staff.filter((s) => !groupId || s.group === groupId).forEach((s) => {
      if (seen[s.name]) return;
      seen[s.name] = true;
      list.push(s);
    });
    const model = showLoad && ITO.workloadModel ? ITO.workloadModel() : null;
    const loadMap = {};
    (model ? model.rows : []).forEach((r) => { loadMap[r.person.name] = r; });
    const infoOf = (name) => {
      const row = loadMap[name];
      const weekRate = row ? row.weekRate : 0;
      const weekRemain = row ? Math.max(0, Math.round((40 - row.week) * 10) / 10) : 40;
      const authOk = ITO.hasAuth ? ITO.hasAuth(name, opts.auth) : true;
      const authMissing = !!opts.auth && opts.auth !== '无需授权' && opts.auth !== '—' && !authOk;
      return { weekRate, weekRemain, authOk, authMissing };
    };
    list.sort((a, b) => {
      const ga = groupOrder(a.gid || a.group) - groupOrder(b.gid || b.group);
      if (ga) return ga;
      if (showLoad && opts.auth) {
        const aa = infoOf(a.name).authOk ? 0 : 1;
        const ab = infoOf(b.name).authOk ? 0 : 1;
        if (aa !== ab) return aa - ab;
      }
      if (showLoad) {
        const la = infoOf(a.name).weekRate;
        const lb = infoOf(b.name).weekRate;
        if (la !== lb) return la - lb;
      }
      return a.name.localeCompare(b.name, 'zh');
    });
    return list.map((p) => {
      const staff = state.staff.find((s) => s.name === p.name);
      const group = state.groups.find((g) => g.id === (staff ? staff.group : groupId)) || {};
      const role = group.manager === p.name ? '主管' : (group.leader === p.name ? '组长' : '');
      const info = infoOf(p.name);
      const metaBits = [p.title || ''];
      if (showLoad) {
        metaBits.push('本周 ' + info.weekRate + '% · 剩余 ' + info.weekRemain + 'h');
        if (opts.auth && opts.auth !== '无需授权' && opts.auth !== '—') {
          metaBits.push(info.authOk ? '具备' + opts.auth : '缺少' + opts.auth);
        }
      }
      return '<option value="' + esc(p.name) + '"' + (p.name === selected ? ' selected' : '') +
        ' data-label="' + esc(p.name) + '"' +
        ' data-meta="' + esc(metaBits.filter(Boolean).join(' · ')) + '"' +
        ' data-group="' + esc(group.name || '') + '"' +
        ' data-role="' + esc(role) + '"' +
        (showLoad ? ' data-load="' + info.weekRate + '" data-auth-ok="' + (info.authOk ? '1' : '0') + '"' : '') + '>' +
        esc(p.name) + ' · ' + esc(p.title) + '</option>';
    }).join('');
  }

  function statusOptions(list, selected) {
    return list.map((s) => '<option value="' + esc(s) + '"' + (s === selected ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
  }

  /* ── custom select / person picker ─────────── */
  let activeSelectPopup = null;
  let selectSeq = 0;

  function closeAllSelects() {
    if (!activeSelectPopup) return;
    const current = activeSelectPopup;
    activeSelectPopup = null;
    current.pop.remove();
    current.trigger.classList.remove('is-open');
    current.trigger.setAttribute('aria-expanded', 'false');
  }

  function enhanceSelect(select) {
    if (!select || select.dataset.enhanced === '1') return;
    select.dataset.enhanced = '1';

    const wrap = document.createElement('div');
    wrap.className = 'sel-wrap';
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'sel-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const pop = document.createElement('div');
    pop.className = 'sel-pop';
    pop.id = 'sel-pop-' + (++selectSeq);
    trigger.setAttribute('aria-controls', pop.id);
    pop.hidden = true;
    pop.innerHTML = '<div class="sel-search"><input type="search" placeholder="搜索选项" aria-label="搜索选项"></div><div class="sel-list" role="listbox" aria-label="可选项"></div>';
    wrap.appendChild(trigger);

    const search = pop.querySelector('.sel-search');
    const searchInput = pop.querySelector('input');
    const list = pop.querySelector('.sel-list');
    let isOpen = false;

    function emptyOption() {
      return Array.prototype.find.call(select.options, function (o) { return o.value === ''; }) || null;
    }

    function placeholder() {
      const empty = emptyOption();
      return (empty && empty.textContent.trim()) || select.dataset.placeholder || '请选择';
    }

    function labelOf(option) {
      if (!option) return '';
      return option.dataset.label || String(option.textContent || '').split(' · ')[0].trim();
    }

    function syncTrigger() {
      const option = select.options[select.selectedIndex];
      const isEmpty = !select.value;
      const valueText = isEmpty ? placeholder() : labelOf(option);
      trigger.innerHTML = '<span class="sel-value' + (isEmpty ? ' is-placeholder' : '') + '">' + esc(valueText) + '</span><i class="sel-arrow"></i>';
      trigger.disabled = !!select.disabled;
      trigger.classList.toggle('is-disabled', !!select.disabled);
      const fieldLabel = select.dataset.fieldLabel || select.getAttribute('aria-label') || '';
      const required = select.getAttribute('aria-required') === 'true' ? '，必填' : '';
      if (fieldLabel) trigger.setAttribute('aria-label', fieldLabel + '：' + valueText + required);
    }

    function realOptions() {
      // 筛选类下拉（工具栏 / 卡头筛选）保留占位选项（全部 XXX），便于单独清空
      const isFilter = !!select.closest('.filters, .report-head-left, .toolbar');
      return Array.prototype.filter.call(select.options, function (o) {
        return !o.disabled && (isFilter || o.value !== '');
      });
    }

    function renderList(query) {
      const q = String(query || '').trim().toLowerCase();
      const options = realOptions();
      const isPerson = options.some(function (o) { return !!o.dataset.group; });
      const allowSearch = select.dataset.search !== '0';
      search.hidden = !allowSearch || !(isPerson || options.length > 10 || select.dataset.search === '1');
      searchInput.placeholder = isPerson ? '搜索姓名 / 专业组' : '搜索' + (select.getAttribute('aria-label') || '选项');
      list.innerHTML = '';
      if (!options.length) {
        list.innerHTML = '<div class="sel-empty">暂无可选项</div>';
        return;
      }
      let lastGroup = '';
      let shown = 0;
      options.forEach(function (option) {
        const label = labelOf(option);
        const meta = option.dataset.meta || '';
        const role = option.dataset.role || '';
        const group = option.dataset.group || '';
        const hay = (label + ' ' + meta + ' ' + role + ' ' + group).toLowerCase();
        if (q && hay.indexOf(q) === -1) return;
        if (isPerson && !q && group && group !== lastGroup) {
          const heading = document.createElement('div');
          heading.className = 'sel-group';
          heading.textContent = group;
          list.appendChild(heading);
          lastGroup = group;
        }
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'sel-option' + (option.value === select.value ? ' is-selected' : '');
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', option.value === select.value ? 'true' : 'false');
        row.innerHTML = '<span class="so-main"><b>' + esc(label) + '</b>' +
          (meta ? '<small>' + esc(meta) + '</small>' : '') + '</span>' +
          (role ? '<span class="so-role">' + esc(role) + '</span>' : '') +
          (option.value === select.value ? '<span class="so-check">' + icon('check') + '</span>' : '');
        row.addEventListener('click', function (event) {
          event.stopPropagation();
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          syncTrigger();
          closeAllSelects();
          trigger.focus();
        });
        list.appendChild(row);
        shown += 1;
      });
      if (!shown) list.innerHTML = '<div class="sel-empty">没有匹配项</div>';
    }

    function openPop() {
      closeAllSelects();
      activeSelectPopup = { pop: pop, trigger: trigger, select: select };
      if (!pop.isConnected) document.body.appendChild(pop);
      const rect = trigger.getBoundingClientRect();
      const width = Math.max(rect.width, 260);
      pop.hidden = false;
      list.setAttribute('aria-label', (select.dataset.fieldLabel || select.getAttribute('aria-label') || '请选择') + '选项');
      trigger.setAttribute('aria-expanded', 'true');
      pop.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) + 'px';
      pop.style.top = (rect.bottom + 4) + 'px';
      pop.style.width = width + 'px';
      pop.style.maxHeight = Math.min(330, Math.max(180, window.innerHeight - rect.bottom - 16)) + 'px';
      trigger.classList.add('is-open');
      searchInput.value = '';
      renderList('');
      if (!search.hidden) setTimeout(function () { searchInput.focus(); }, 20);
      else setTimeout(function () {
        const first = list.querySelector('.sel-option');
        if (first) first.focus();
      }, 20);
    }

    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (select.disabled) return;
      if (activeSelectPopup && activeSelectPopup.pop === pop) closeAllSelects();
      else openPop();
    });

    searchInput.addEventListener('input', function () { renderList(searchInput.value); });
    pop.addEventListener('click', function (event) { event.stopPropagation(); });
    pop.addEventListener('keydown', function (event) {
      const options = Array.prototype.slice.call(list.querySelectorAll('.sel-option'));
      if (!options.length) return;
      const idx = options.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        (options[idx + 1] || options[0]).focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        (options[idx - 1] || options[options.length - 1]).focus();
      } else if (event.key === 'Home') {
        event.preventDefault();
        options[0].focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        options[options.length - 1].focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeAllSelects();
        trigger.focus();
      }
    });
    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openPop();
      }
    });
    select.addEventListener('change', syncTrigger);
    new MutationObserver(function () {
      syncTrigger();
      if (activeSelectPopup && activeSelectPopup.pop === pop) renderList(searchInput.value);
    }).observe(select, { childList: true, subtree: true, attributes: true });

    select.__syncPicker = syncTrigger;
    syncTrigger();
  }

  function enhanceSelects(root) {
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll('.form-field select, .cell-select, [data-picker], .filters select, .report-head-left select'), enhanceSelect);
  }

  function enhanceFormDates(root) {
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll('.form-field input[type="date"], .form-field input[type="datetime-local"], [data-date-picker]'), function (input) {
      if (input.closest('.date-wrap')) return;
      const wrap = document.createElement('div');
      wrap.className = 'date-wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      const ph = document.createElement('span');
      ph.className = 'date-ph';
      ph.textContent = input.type === 'date' ? '请选择日期' : '请选择日期时间';
      wrap.appendChild(ph);
      const sync = function () {
        const hasValue = !!input.value;
        input.classList.toggle('has-value', hasValue);
        ph.hidden = hasValue;
      };
      input.addEventListener('input', sync);
      input.addEventListener('change', sync);
      input.addEventListener('focus', function () { ph.hidden = true; });
      input.addEventListener('blur', sync);
      sync();
    });
  }

  document.addEventListener('click', function (event) {
    if (!activeSelectPopup) return;
    if (event.target.closest('.sel-wrap') || event.target.closest('.sel-pop')) return;
    closeAllSelects();
  });
  window.addEventListener('scroll', function (event) {
    if (event.target && event.target.closest && event.target.closest('.sel-pop')) return;
    closeAllSelects();
  }, true);
  window.addEventListener('resize', closeAllSelects);

  let formFieldSeq = 0;
  function formRow(o) {
    let control = o.control || '';
    const open = /^\s*<(input|select|textarea)\b([^>]*)>/i.exec(control);
    let id = '';
    if (open) {
      const tagName = open[1].toLowerCase();
      let attrs = open[2];
      const idMatch = /\bid="([^"]+)"/i.exec(attrs);
      id = idMatch ? idMatch[1] : '';
      if (!id) {
        id = 'ff-' + (++formFieldSeq);
        attrs = ' id="' + id + '"' + attrs;
      }
      if (o.label && tagName === 'select' && !/\bdata-field-label=/i.test(attrs)) {
        attrs = ' data-field-label="' + esc(o.label) + '"' + attrs;
      }
      if (o.required && !/\baria-required=/i.test(attrs)) {
        attrs = ' aria-required="true"' + attrs;
      }
      if (o.hint && !/\baria-describedby=/i.test(attrs)) {
        attrs = ' aria-describedby="' + id + '-hint"' + attrs;
      }
      control = control.replace(open[0], '<' + tagName + attrs + '>');
    }
    return '<div class="form-field' + (o.full ? ' full' : '') + (o.span2 ? ' span-2' : '') + '">' +
      '<label' + (id ? ' for="' + id + '"' : '') + '>' + o.label + (o.required ? ' <em aria-hidden="true">*</em>' : '') + '</label>' +
      control + (o.hint ? '<span class="form-hint"' + (id ? ' id="' + id + '-hint"' : '') + '>' + esc(o.hint) + '</span>' : '') +
      '</div>';
  }

  function showFieldError(control, message) {
    if (!control) return;
    const field = control.closest('.form-field') || control.closest('td') || control.parentElement;
    if (!field) return;
    field.classList.add('has-error');
    let err = field.querySelector('.field-error');
    if (!err) {
      err = document.createElement('span');
      err.className = 'field-error';
      err.id = 'err-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1000);
      err.setAttribute('role', 'alert');
      field.appendChild(err);
    }
    err.textContent = message;
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('aria-describedby', err.id);
    const wrap = control.closest('.sel-wrap');
    const trigger = wrap && wrap.querySelector('.sel-trigger');
    if (trigger) {
      trigger.setAttribute('aria-invalid', 'true');
      trigger.setAttribute('aria-describedby', err.id);
    }
  }

  function clearFieldError(control) {
    if (!control) return;
    const field = control.closest('.form-field') || control.closest('td') || control.parentElement;
    if (!field) return;
    field.classList.remove('has-error');
    control.removeAttribute('aria-invalid');
    control.removeAttribute('aria-describedby');
    const wrap = control.closest('.sel-wrap');
    const trigger = wrap && wrap.querySelector('.sel-trigger');
    if (trigger) {
      trigger.removeAttribute('aria-invalid');
      trigger.removeAttribute('aria-describedby');
    }
    const err = field.querySelector('.field-error');
    if (err) err.remove();
  }

  function validateRequired(pairs) {
    let ok = true;
    pairs.forEach(function (pair) {
      const control = pair[0];
      const message = pair[1] || '请填写必填项';
      if (!control) return;
      if (!String(control.value || '').trim()) {
        showFieldError(control, message);
        ok = false;
      } else {
        clearFieldError(control);
      }
    });
    return ok;
  }

  function bindFieldClear(root) {
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll('input, textarea, select'), function (control) {
      const clear = function () { clearFieldError(control); };
      control.addEventListener('input', clear);
      control.addEventListener('change', clear);
    });
  }

  function shortDate(str) {
    if (!str) return '—';
    return String(str).replace(/^\d{4}-/, '').replace(' ', ' ');
  }

  function addCycle(dateStr, cycle) {
    const d = parseDate(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const map = { '每日': 1, '每周': 7, '每月': 30, '每季度': 90, '每半年': 182, '每年': 365 };
    d.setDate(d.getDate() + (map[cycle] || 7));
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
