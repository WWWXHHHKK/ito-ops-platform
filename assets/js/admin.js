/* ─────────────────────────────────────────────
   ITO OPS · management console core
   login, shell, routing, overlays, charts
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  window.ITO = window.ITO || {};
  const D = window.ITO_DATA;
  const state = {
    role: null,
    user: null,
    route: 'dashboard',
    routeParams: {},
    tasks: [],
    messages: [],
    logs: [],
    staff: [],
    groups: [],
    auths: [],
    alertRules: [],
    achievements: [],
    inspectionPlans: [],
    inspectionRecords: [],
    maintenancePlans: [],
    maintenanceRecords: [],
    duty: null,
    permissions: {},
    metrics: {},
    trend: null,
    expanded: {},
    taskFilters: {},
    collapsed: {},
    pendingQuery: null,
    taskSeq: 10028,
    charts: []
  };

  ITO.state = state;

  /* ── helpers ─────────────────────────────── */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const clone = (v) => JSON.parse(JSON.stringify(v));

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
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function parseDate(str) {
    return new Date(String(str).replace(/-/g, '/').replace('T', ' '));
  }

  function groupById(id) {
    return state.groups.find((g) => g.id === id) || D.groups.find((g) => g.id === id) || null;
  }

  const TONE = {
    '待审批': 'yellow', '待派发': 'blue', '待接收': 'purple', '执行中': 'blue',
    '已完成': 'green', '完成': 'green', '正常': 'green', '启用': 'green', '有效': 'green',
    '超期': 'red', '异常': 'red', '已过期': 'red', '紧急': 'red', '高风险作业': 'red',
    '重要': 'yellow', '一般': 'gray', '停用': 'gray', '已撤销': 'gray',
    '待处理': 'yellow', '计划中': 'gray'
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
    const g = person ? groupById(person.group) : null;
    const bg = g ? g.color : '#EB612A';
    const initial = String(name || '?').slice(0, 1);
    return '<span class="avatar' + (small ? ' avatar-sm' : '') + '" style="background:' + bg + '">' + esc(initial) + '</span>';
  }

  function progressBar(value, width) {
    return '<span class="progress"' + (width ? ' style="width:' + width + '"' : '') + '><i style="width:' + Math.max(0, Math.min(100, value)) + '%"></i></span>';
  }

  function isOverdue(sub) {
    return sub.status !== '已完成' && parseDate(sub.due) < parseDate(D.meta.demoNow);
  }

  function mainStatus(task) {
    const subs = task.subs;
    if (!subs.length) return '待处理';
    if (subs.every((s) => s.status === '已完成')) return '已完成';
    if (subs.some((s) => s.status === '执行中')) return '执行中';
    if (subs.some((s) => s.status === '待审批')) return '待审批';
    if (subs.some((s) => s.status === '待派发')) return '待派发';
    if (subs.some((s) => s.status === '待接收')) return '待接收';
    return '待处理';
  }

  function mainProgress(task) {
    if (!task.subs.length) return 0;
    return Math.round(task.subs.reduce((n, s) => n + (s.progress || 0), 0) / task.subs.length);
  }

  function overdueCount() {
    let n = 0;
    state.tasks.forEach((t) => t.subs.forEach((s) => { if (isOverdue(s)) n += 1; }));
    return n;
  }

  function unreadCount() {
    return state.messages.filter((m) => !m.read).length;
  }

  function pendingCount() {
    let n = 0;
    state.tasks.forEach((t) => t.subs.forEach((s) => {
      if (s.status === '待派发' || s.status === '待审批') n += 1;
    }));
    return n;
  }

  function myOpenSubs() {
    if (!state.user) return 0;
    let n = 0;
    state.tasks.forEach((t) => t.subs.forEach((s) => {
      if (s.owner === state.user.name && s.status !== '已完成') n += 1;
    }));
    return n;
  }

  function pageHead(o) {
    return '<div class="page-head">' +
      '<div><h1 class="page-title">' + o.title + '</h1>' +
      '<p class="page-sub">' + o.sub + '</p></div>' +
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

  /* ── overlays ────────────────────────────── */
  function lockScroll(on) {
    document.body.style.overflow = on ? 'hidden' : '';
  }

  function modal(o) {
    const root = $('#modalRoot');
    const close = () => {
      root.innerHTML = '';
      lockScroll(false);
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };

    root.innerHTML =
      '<div class="modal-backdrop">' +
        '<div class="modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '">' +
          '<div class="modal-head">' +
            '<div><h2>' + esc(o.title) + '</h2>' + (o.sub ? '<p>' + esc(o.sub) + '</p>' : '') + '</div>' +
            '<button class="modal-close" type="button" aria-label="关闭">' + icon('close') + '</button>' +
          '</div>' +
          '<div class="modal-body">' + (o.body || '') + '</div>' +
          (o.foot ? '<div class="modal-foot">' + o.foot + '</div>' : '') +
        '</div>' +
      '</div>';

    const backdrop = root.firstElementChild;
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    $('.modal-close', backdrop).addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    lockScroll(true);
    if (typeof o.onMount === 'function') o.onMount(close, backdrop);
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
        onMount(c, root) {
          root.querySelector('[data-confirm="no"]').addEventListener('click', () => { finish(false); c(); });
          root.querySelector('[data-confirm="yes"]').addEventListener('click', () => { finish(true); c(); });
        }
      });

      const host = $('#modalRoot');
      const obs = new MutationObserver(() => {
        if (!host.firstElementChild) { obs.disconnect(); finish(false); }
      });
      obs.observe(host, { childList: true });
    });
  }

  function drawer(o) {
    const root = $('#drawerRoot');
    const close = () => {
      root.innerHTML = '';
      lockScroll(false);
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };

    root.innerHTML =
      '<div class="drawer-backdrop">' +
        '<aside class="drawer" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '">' +
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
    if (typeof o.onMount === 'function') o.onMount(close, backdrop);
    return close;
  }

  function closeOverlays() {
    $('#modalRoot').innerHTML = '';
    $('#drawerRoot').innerHTML = '';
    lockScroll(false);
  }

  /* ── charts ──────────────────────────────── */
  function chart(id, option) {
    const node = document.getElementById(id);
    if (!node || !window.echarts) return null;
    const inst = window.echarts.init(node, null, { renderer: 'canvas' });
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
  function perm(key) {
    const set = state.permissions[state.role];
    return !!(set && set[key]);
  }

  const ACCESS = {
    dashboard: () => perm('dashboard'),
    tasks: () => perm('task'),
    dispatch: () => perm('task') && (state.role === 'leader' || state.role === 'manager'),
    mine: () => perm('task'),
    inspection: () => perm('inspect'),
    duty: () => perm('duty'),
    maintenance: () => perm('maintain'),
    groups: () => perm('group'),
    auth: () => perm('auth'),
    messages: () => perm('message'),
    alerts: () => perm('config'),
    roles: () => state.role === 'admin',
    tags: () => perm('config'),
    logs: () => state.role === 'leader' || state.role === 'admin'
  };

  const ROUTE_TITLE = {
    dashboard: '运维驾驶舱', tasks: '任务中心', dispatch: '派发与审批', mine: '我的任务',
    inspection: '巡检管理', duty: '值班管理', maintenance: '维保管理',
    groups: '专业组', auth: '作业授权', messages: '消息中心',
    alerts: '预警规则', roles: '角色权限', tags: '成就标签', logs: '操作日志'
  };

  function can(route) {
    const fn = ACCESS[route];
    return fn ? fn() : false;
  }

  function parseHash() {
    const raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return ROUTE_TITLE[raw] ? raw : 'dashboard';
  }

  function go(route, params) {
    if (!can(route)) { toast('当前身份无权访问该模块', 'warn'); return; }
    state.routeParams = params || {};
    if (route === 'tasks' && params && params.q != null) state.pendingQuery = params.q;
    if (location.hash === '#/' + route) render();
    else location.hash = '#/' + route;
  }

  function refresh() { render(); }

  function log(action, target, type) {
    state.logs.unshift({
      time: nowStamp(),
      actor: state.user ? state.user.name : '系统',
      action: action,
      target: target,
      type: type || '操作'
    });
  }

  /* ── nav ─────────────────────────────────── */
  const NAV = [
    {
      label: '工作台', items: [
        { id: 'dashboard', name: '运维驾驶舱', icon: 'dashboard' },
        { id: 'tasks', name: '任务中心', icon: 'task' },
        { id: 'dispatch', name: '派发与审批', icon: 'send', count: () => pendingCount() },
        { id: 'mine', name: '我的任务', icon: 'user', count: () => myOpenSubs(), hide: () => state.role !== 'employee' }
      ]
    },
    {
      label: '运维执行', items: [
        { id: 'inspection', name: '巡检管理', icon: 'clipboard' },
        { id: 'duty', name: '值班管理', icon: 'calendar' },
        { id: 'maintenance', name: '维保管理', icon: 'wrench' }
      ]
    },
    {
      label: '组织与授权', items: [
        { id: 'groups', name: '专业组', icon: 'users' },
        { id: 'auth', name: '作业授权', icon: 'shield' }
      ]
    },
    {
      label: '平台管理', items: [
        { id: 'messages', name: '消息中心', icon: 'message', count: () => unreadCount() },
        { id: 'alerts', name: '预警规则', icon: 'alert' },
        { id: 'roles', name: '角色权限', icon: 'key' },
        { id: 'tags', name: '成就标签', icon: 'award' },
        { id: 'logs', name: '操作日志', icon: 'history' }
      ]
    }
  ];

  function navHtml() {
    return NAV.map((group) => {
      const items = group.items.filter((it) => can(it.id) && (!it.hide || !it.hide()));
      if (!items.length) return '';
      const collapsed = !!state.collapsed[group.label];
      return '<div class="nav-group' + (collapsed ? ' collapsed' : '') + '" data-group="' + esc(group.label) + '">' +
        '<div class="nav-label">' + esc(group.label) + icon('chevron') + '</div>' +
        '<div class="nav-items">' + items.map((it) => {
          const count = it.count ? it.count() : 0;
          return '<a class="nav-item' + (state.route === it.id ? ' active' : '') + '" href="#/' + it.id + '" data-route="' + it.id + '">' +
            icon(it.icon) + '<span>' + esc(it.name) + '</span>' +
            (count ? '<b class="nav-count">' + count + '</b>' : '') +
            '</a>';
        }).join('') + '</div></div>';
    }).join('');
  }

  function renderShell() {
    const u = state.user;
    $('#sideRole').innerHTML = '<i></i><b>' + esc(u.role) + '</b><span>DEMO</span>';
    $('#sideNav').innerHTML = navHtml();
    $('#sideUser').innerHTML = avatar(u.name) +
      '<div><b>' + esc(u.name) + '</b><span>' + esc(u.title) + '</span></div>';
    $('#appbarUser').innerHTML = avatar(u.name, true) +
      '<div><b>' + esc(u.name) + '</b><span>' + esc(u.role === u.name ? u.title : u.role) + '</span></div>';
    $('#dateChip').textContent = '2026.11.01 周日';
    $('#bellDot').classList.toggle('on', unreadCount() > 0);
  }

  /* ── routing ─────────────────────────────── */
  function render() {
    if (!state.role) return;
    const route = parseHash();
    if (!can(route)) {
      if (location.hash === '#/dashboard') {
        toast('当前身份无权访问该模块', 'warn');
      } else {
        location.hash = '#/dashboard';
      }
      return;
    }

    state.route = route;
    disposeCharts();
    closeOverlays();
    renderShell();

    $('#crumbPage').textContent = ROUTE_TITLE[route] || '运维驾驶舱';

    const def = window.ITO_PAGES && window.ITO_PAGES[route];
    const root = $('#pageRoot');
    if (!def) {
      root.innerHTML = pageHead({ title: '模块建设中', sub: '该模块尚未接入' }) + emptyState('暂无内容', '请稍后再试');
      return;
    }

    root.innerHTML = def.render();
    if (typeof def.after === 'function') def.after();

    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ── login ───────────────────────────────── */
  const ROLE_ICON = { leader: 'chart', manager: 'users', employee: 'user', admin: 'shield' };

  function renderLogin() {
    const grid = $('#roleGrid');
    grid.innerHTML = Object.keys(D.roleInfo).map((key) => {
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
      if (card) enterApp(card.dataset.role);
    });
  }

  function enterApp(roleKey) {
    if (!D.roleInfo[roleKey]) return;
    state.role = roleKey;
    state.user = D.roleInfo[roleKey];
    sessionStorage.setItem('ito.admin.role', roleKey);

    $('#loginView').hidden = true;
    $('#appView').hidden = false;
    renderShell();

    const rawHash = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    const saved = parseHash();
    const target = !rawHash && roleKey === 'employee' ? 'mine' :
      (can(saved) ? saved : (roleKey === 'employee' ? 'mine' : 'dashboard'));
    const hash = '#/' + target;
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function logout() {
    state.role = null;
    state.user = null;
    sessionStorage.removeItem('ito.admin.role');
    disposeCharts();
    closeOverlays();
    $('#appView').hidden = true;
    $('#loginView').hidden = false;
    $('#sideNav').innerHTML = '';
    location.hash = '';
    window.scrollTo(0, 0);
  }

  /* ── boot ────────────────────────────────── */
  function initState() {
    state.tasks = clone(D.tasks);
    state.messages = clone(D.messages);
    state.logs = clone(D.logs);
    state.staff = clone(D.staff);
    state.groups = clone(D.groups);
    state.auths = clone(D.auths);
    state.alertRules = clone(D.alertRules);
    state.achievements = clone(D.achievements);
    state.inspectionPlans = clone(D.inspectionPlans);
    state.inspectionRecords = clone(D.inspectionRecords);
    state.maintenancePlans = clone(D.maintenancePlans);
    state.maintenanceRecords = clone(D.maintenanceRecords);
    state.duty = clone(D.duty);
    state.permissions = clone(D.permissions);
    state.metrics = clone(D.dashboard);
    state.trend = clone(D.trend);
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
        return;
      }
      if (e.target.closest('.nav-item')) closeMobileNav();
    });

    const search = $('#globalSearch');
    search.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const q = search.value.trim();
      state.pendingQuery = q;
      if (state.route === 'tasks' && can('tasks')) refresh();
      else if (can('tasks')) go('tasks', { q });
      else toast('当前身份无任务中心权限', 'warn');
    });

    $('#bellBtn').addEventListener('click', () => go('messages'));

    $('#menuBtn').addEventListener('click', () => {
      $('#sidebar').classList.add('open');
      $('#sidebarScrim').classList.add('on');
    });
    $('#sidebarScrim').addEventListener('click', closeMobileNav);

    window.addEventListener('hashchange', render);
  }

  function closeMobileNav() {
    $('#sidebar').classList.remove('open');
    $('#sidebarScrim').classList.remove('on');
  }

  function boot() {
    initState();

    const params = new URLSearchParams(location.search);
    if (params.get('still') === '1') document.documentElement.classList.add('still');

    renderLogin();
    bindShell();

    const saved = sessionStorage.getItem('ito.admin.role');
    const requested = params.get('role');
    if (requested && D.roleInfo[requested]) {
      enterApp(requested);
    } else if (saved && D.roleInfo[saved]) {
      enterApp(saved);
    } else {
      $('#appView').hidden = true;
      $('#loginView').hidden = false;
    }
  }

  /* ── public API ──────────────────────────── */
  ITO.ui = {
    $, $$, esc, icon, badge, groupPill, avatar, progressBar, isOverdue, mainStatus,
    mainProgress, pageHead, emptyState, csv, download, toast, modal, confirm: confirmDialog,
    drawer, chart, groupOptions, staffOptions, statusOptions, formRow, shortDate, addCycle
  };
  ITO.go = go;
  ITO.refresh = refresh;
  ITO.log = log;
  ITO.can = can;
  ITO.renderShell = renderShell;
  ITO.logout = logout;
  ITO.routes = ROUTE_TITLE;
  ITO.getGroup = groupById;
  ITO.counts = { overdueCount, unreadCount, pendingCount, myOpenSubs };
  ITO.disposeCharts = disposeCharts;

  /* small shared option builders used by page modules */
  function groupOptions(selected) {
    return state.groups.map((g) => '<option value="' + g.id + '"' + (g.id === selected ? ' selected' : '') + '>' + esc(g.name) + '</option>').join('');
  }

  function staffOptions(groupId, selected) {
    return state.staff
      .filter((s) => !groupId || s.group === groupId)
      .map((s) => '<option value="' + esc(s.name) + '"' + (s.name === selected ? ' selected' : '') + '>' + esc(s.name) + ' · ' + esc(s.title) + '</option>')
      .join('');
  }

  function statusOptions(list, selected) {
    return list.map((s) => '<option value="' + esc(s) + '"' + (s === selected ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
  }

  function formRow(o) {
    return '<div class="form-field' + (o.full ? ' full' : '') + '">' +
      '<label' + (o.required ? '' : '') + '>' + o.label + (o.required ? ' <em>*</em>' : '') + '</label>' +
      o.control + (o.hint ? '<span class="form-hint">' + esc(o.hint) + '</span>' : '') +
      '</div>';
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
