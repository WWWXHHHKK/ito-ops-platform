/* ─────────────────────────────────────────────
   cockpit side panels · platform data
   Pulls tasks / inspection / maintenance / messages
   from the shared admin demo data.
   ───────────────────────────────────────────── */

(() => {
  'use strict';

  const D = window.ITO_DATA;
  if (!D) return;

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const short = value => {
    const text = String(value || '');
    const date = text.slice(5, 10);
    const time = text.slice(11, 16);
    return time ? date + ' ' + time : date;
  };

  const shortDate = value => String(value || '').slice(5, 10).replace('-', '/');

  const pending = D.tasks.reduce((n, task) => n + task.subs.filter(sub =>
    sub.status === '待分发' || sub.status === '审批中' || sub.status === '已挂起'
  ).length, 0) + D.tasks.filter(task =>
    task.leaderApproval && (task.leaderApproval.status === '审批中' || task.leaderApproval.status === '已挂起')
  ).length;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText('tsActive', D.dashboard.active);
  setText('tsOverdue', D.dashboard.overdue);
  setText('tsPending', pending);

  /* duty ticker */
  const tickerDuty = D.duty.weeks.find(w => w.key === D.duty.currentKey);
  const tickerNext = D.duty.weeks.find(w => w.key === D.duty.nextKey);
  if (tickerDuty && tickerNext) {
    document.querySelectorAll('[data-ticker="duty"]').forEach(el => {
      el.textContent = '本周值班：' + tickerDuty.person + ' · 下周值班：' + tickerNext.person + ' · 周一 08:00 交接';
    });
  }

  /* ── 03 巡检执行矩阵 ─────────────────────── */
  const inspectionList = $('#inspectionList');
  if (inspectionList && D.inspectionWeek) {
    const today = new Date(D.meta.today.replace(/-/g, '/'));
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      days.push(String(d.getDate()).padStart(2, '0'));
    }
    const rows = D.inspectionWeek.patterns.map(row => {
      const cells = row.cells.map((c, i) => {
        const cls = c === 'bad' ? 'bad' : c === 'off' ? 'off' : 'ok';
        return '<i class="ig-cell ' + cls + (i === 6 ? ' due' : '') + '"></i>';
      }).join('');
      return '<div class="insp-grid-row" data-drill="inspection" tabindex="0" role="link">' +
        '<span class="ig-name"><b>' + esc(row.plan) + '</b><em>' + esc(row.cycle) + '</em></span>' +
        cells +
      '</div>';
    }).join('');
    inspectionList.innerHTML =
      '<div class="insp-grid">' +
        '<div class="insp-grid-head"><span>巡检计划 · 近 7 天</span>' +
          days.map((d, i) => '<i' + (i === days.length - 1 ? ' class="is-today"' : '') + '>' + d + '</i>').join('') +
        '</div>' + rows +
      '</div>';
  }
  const weekRows = (D.inspectionWeek && D.inspectionWeek.patterns) || [];
  const weekCells = weekRows.reduce((n, r) => n + r.cells.filter(c => c !== 'off').length, 0);
  const weekBad = weekRows.reduce((n, r) => n + r.cells.filter(c => c === 'bad').length, 0);
  setText('inspPlanCount', weekCells);
  setText('inspAbnormalCount', weekBad);

  /* ── 10 维保排期甘特 ─────────────────────── */
  const maintenanceList = $('#maintenanceList');
  if (maintenanceList) {
    const today = new Date(D.meta.today.replace(/-/g, '/'));
    const horizon = 30;
    const scale = '<div class="mg-scale"><b>今天 ' + shortDate(D.meta.today) + '</b><span>未来 ' + horizon + ' 天</span></div>';
    const rows = D.maintenancePlans.map(plan => {
      const due = new Date(String(plan.next).replace(/-/g, '/'));
      const days = Math.max(0, Math.round((due - today) / 86400000));
      const pct = Math.min(100, Math.max(4, (days / horizon) * 100));
      const cls = plan.status === '停用' ? 'off' : days <= 7 ? 'warn' : 'ok';
      return '<div class="mg-row ' + cls + '" data-drill="maintenance" tabindex="0" role="link">' +
        '<div class="mg-name"><b>' + esc(plan.name) + '</b><span>' + esc(plan.vendor) + ' · ' + esc(plan.cycle) + '</span></div>' +
        '<div class="mg-track"><i style="width:' + pct.toFixed(1) + '%"></i><em style="left:' + pct.toFixed(1) + '%"></em></div>' +
        '<div class="mg-date">' + shortDate(plan.next) + '</div>' +
      '</div>';
    }).join('');
    maintenanceList.innerHTML = scale + '<div class="maint-gantt">' + rows + '</div>';
  }
  const enabledMaint = D.maintenancePlans.filter(p => p.status === '启用');
  setText('maintEnabled', enabledMaint.length);
  setText('maintNext', enabledMaint.length ? shortDate(enabledMaint[0].next) : '—');

  /* ── 11 待办消息时间线 ───────────────────── */
  const actionList = $('#actionList');
  if (actionList) {
    const messages = D.messages.slice(0, 4);
    actionList.innerHTML = messages.map(msg => {
      const tone = msg.type === '超期' ? 'warn' : msg.type === '审批' ? 'info' : msg.type === '巡检' ? 'ok' : 'muted';
      return '<div class="feed-row' + (msg.read ? '' : ' is-unread') + '" data-drill="messages" tabindex="0" role="link">' +
        '<i class="feed-dot ' + tone + '"></i>' +
        '<div class="feed-main">' +
          '<div class="feed-top"><b>' + esc(msg.title) + '</b><time>' + esc(short(msg.time)) + '</time></div>' +
          '<p>' + esc(msg.body) + '</p>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  const unread = D.messages.filter(m => !m.read).length;
  setText('msgUnread', unread);
  setText('msgTotal', D.messages.length);
})();
