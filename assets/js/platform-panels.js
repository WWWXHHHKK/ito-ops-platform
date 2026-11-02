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

  const pending = D.tasks.reduce((n, task) => n + task.subs.filter(sub =>
    sub.status === '待派发' || sub.status === '待审批' || sub.status === '待接收'
  ).length, 0);

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText('tsActive', D.dashboard.active);
  setText('tsOverdue', D.dashboard.overdue);
  setText('tsPending', pending);

  /* inspection */
  const inspectionList = $('#inspectionList');
  if (inspectionList) {
    const plans = D.inspectionPlans.slice(0, 4);
    inspectionList.innerHTML = plans.map(plan => {
      const enabled = plan.status === '启用';
      return '<div class="insp-row">' +
        '<div class="insp-main"><b>' + esc(plan.name) + '</b><span>' + esc(plan.owner) + ' · 下次 ' + esc(short(plan.next)) + '</span></div>' +
        '<div class="insp-right"><span class="tag-chip ' + (enabled ? 'ok' : 'off') + '">' + esc(plan.status) + '</span><em>' + esc(plan.cycle) + '</em></div>' +
      '</div>';
    }).join('');
  }
  setText('inspRecordCount', D.inspectionRecords.length);
  setText('inspAbnormalCount', D.inspectionRecords.reduce((n, r) => n + (r.abnormal || 0), 0));

  /* maintenance */
  const maintenanceList = $('#maintenanceList');
  if (maintenanceList) {
    maintenanceList.innerHTML = D.maintenancePlans.map(plan => {
      const enabled = plan.status === '启用';
      return '<div class="maint-row">' +
        '<div class="maint-main"><b>' + esc(plan.name) + '</b><span>' + esc(plan.vendor) + ' · ' + esc(short(plan.next)) + '</span></div>' +
        '<span class="tag-chip ' + (enabled ? 'ok' : 'off') + '">' + esc(plan.status) + '</span>' +
      '</div>';
    }).join('');
  }
  const enabledMaint = D.maintenancePlans.filter(p => p.status === '启用');
  setText('maintEnabled', enabledMaint.length);
  setText('maintNext', enabledMaint.length ? short(enabledMaint[0].next).slice(0, 5) : '—');

  /* messages */
  const actionList = $('#actionList');
  if (actionList) {
    const messages = D.messages.slice(0, 4);
    actionList.innerHTML = messages.map(msg => {
      const tone = msg.type === '超期' ? 'warn' : msg.type === '审批' ? 'info' : msg.type === '巡检' ? 'ok' : 'muted';
      return '<div class="action-row' + (msg.read ? '' : ' is-unread') + '">' +
        '<span class="action-type ' + tone + '">' + esc(msg.type) + '</span>' +
        '<div class="action-main"><b>' + esc(msg.title) + '</b><span>' + esc(short(msg.time)) + ' · ' + esc(msg.id) + '</span></div>' +
        (msg.read ? '' : '<i class="action-dot"></i>') +
      '</div>';
    }).join('');
  }
  const unread = D.messages.filter(m => !m.read).length;
  setText('msgUnread', unread);
  setText('msgUnreadFoot', unread);
  setText('msgTotal', D.messages.length);
})();
