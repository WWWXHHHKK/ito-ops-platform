/* ─────────────────────────────────────────────
   pages · dispatch & my tasks
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const P = (window.ITO_PAGES = window.ITO_PAGES || {});
  const D = window.ITO_DATA;

  function S() { return ITO.state; }
  function U() { return ITO.ui; }

  function currentGroupId() {
    const st = S();
    const me = st.staff.find(function (p) { return p.name === st.user.name; });
    if (me) return me.group;
    const managed = st.groups.find(function (g) { return g.manager === st.user.name; });
    return managed ? managed.id : '';
  }

  function leaderView() {
    return S().role === 'leader' || S().role === 'super';
  }

  function queue() {
    const st = S();
    const dispatch = [];
    const approval = [];
    const leader = [];
    const summary = [];
    const allScope = leaderView();
    const groupId = currentGroupId();
    st.tasks.forEach(function (t) {
      if (t.canceled || t.draft) return;
      t.subs.forEach(function (s) {
        if (s.status === '待分发' && (allScope || s.group === groupId)) {
          dispatch.push({ task: t, sub: s });
        }
        if ((s.status === '审批中' || s.status === '已挂起') &&
          (allScope || (s.approval && s.approval.approver === st.user.name))) {
          approval.push({ task: t, sub: s });
        }
      });
      const la = t.leaderApproval;
      if (t.source === 'leader' && la) {
        if (la.status === '待汇总' || la.status === '已驳回') {
          if (allScope || t.group === groupId || t.initiator === st.user.name) summary.push({ task: t });
        }
        if (la.status === '审批中' || la.status === '已挂起') {
          if (allScope || la.approver === st.user.name) leader.push({ task: t });
        }
      }
    });
    return { dispatch: dispatch, approval: approval, leader: leader, summary: summary };
  }

  const DISPATCH_QUEUES = [
    { key: 'dispatch', name: '待派发', hint: '选择执行人 · 派发后进入执行中', bodyId: 'dispatchCol', empty: ['没有待派发任务', '所有任务都已派发', 'send'] },
    { key: 'approval', name: '待审批', hint: '负责人审批 / 领导审批 / 汇总报审 · 按类型分块', bodyId: 'approvalCol', empty: ['没有待审批任务', '审批队列已清空', 'shield'] }
  ];
  const QUEUE_PAGE_SIZE = 10;

  function approvalMerged() {
    const q = queue();
    const byDue = function (a, b) { return (a.due || '').localeCompare(b.due || ''); };
    return q.approval.map(function (x) { return { item: x, mode: 'approve' }; }).sort(function (a, b) { return byDue(a.item.sub, b.item.sub); })
      .concat(q.leader.map(function (x) { return { item: x, mode: 'leader' }; }).sort(function (a, b) { return byDue(a.item.task, b.item.task); }))
      .concat(q.summary.map(function (x) { return { item: x, mode: 'summary' }; }).sort(function (a, b) { return byDue(a.item.task, b.item.task); }));
  }

  function queueList(key) {
    const q = queue();
    if (key === 'dispatch') return q.dispatch.map(function (x) { return { item: x, mode: 'dispatch' }; });
    if (key === 'approval') return approvalMerged();
    return [];
  }

  function card(item, mode) {
    const t = item.task;
    const s = item.sub;
    const over = s ? U().isOverdue(s) : false;
    const ap = s ? s.approval : null;
    const la = t.leaderApproval;
    const status = s ? s.status : U().displayStatus(t);
    let btn = '';
    if (mode === 'dispatch') {
      btn = '<button class="btn btn-primary btn-sm" data-act="dispatch" data-task="' + t.id + '" data-sub="' + s.id + '" type="button">' + U().icon('send') + '派发</button>';
    } else if (mode === 'approve') {
      btn = '<button class="btn btn-soft btn-sm" data-act="approve" data-task="' + t.id + '" data-sub="' + s.id + '" type="button">' + U().icon('check') + (s.status === '已挂起' ? '处理挂起' : '去审批') + '</button>';
    } else if (mode === 'leader') {
      btn = '<button class="btn btn-soft btn-sm" data-act="leader" data-task="' + t.id + '" type="button">' + U().icon('check') + (la.status === '已挂起' ? '处理挂起' : '领导审批') + '</button>';
    } else {
      btn = '<button class="btn btn-primary btn-sm" data-act="leader" data-task="' + t.id + '" type="button">' + U().icon('send') + '汇总报审</button>';
    }
    if (mode === 'leader' && !ITO.roleIs('leader') && !ITO.isSuper()) {
      btn = '<span class="auth-chip">只读</span>';
    }

    const meta = s
      ? '<span class="mono">' + s.id + '</span>' +
        '<span>' + U().groupPill(s.group) + '</span>' +
        '<span>' + U().roleChip(s.owner, 'executor') + '</span>' +
        '<span>' + U().icon('clock') + U().shortDate(s.due) + '</span>'
      : '<span class="mono">' + t.id + '</span>' +
        '<span>' + U().groupPill(t.group) + '</span>' +
        '<span>' + U().roleChip(t.owner, 'owner') + '</span>' +
        '<span>' + U().icon('clock') + U().shortDate(t.due) + '</span>';

    const timeLine = s && ap
      ? '<div class="dispatch-sub">提交 ' + U().esc(ap.submittedAt) + ' · 审批截止 ' + U().esc(ap.dueAt) + '</div>'
      : mode === 'leader' && la
        ? '<div class="dispatch-sub">提交 ' + U().esc(la.submittedAt || '—') + ' · 审批截止 ' + U().esc(la.dueAt || '—') + '</div>'
        : '';

    return '<article class="dispatch-card">' +
      '<div class="dispatch-top"><b>' + U().esc(s ? s.name : t.name) + '</b>' + U().badge(status || (over ? '超期' : (s ? s.level : t.level))) + '</div>' +
      '<div class="dispatch-meta">' + meta + '</div>' +
      '<div class="dispatch-sub">' + U().esc(t.name) + ' · 发起人 ' + U().roleChip(t.initiator, 'initiator') + '</div>' +
      timeLine +
      '<div class="dispatch-actions">' +
        (s ? '<span class="auth-chip">' + U().esc(s.auth || '—') + '</span>' : '') +
        (s && s.ticket ? '<span class="auth-chip warn">需开票</span>' : '') +
        '<span class="spacer"></span>' + btn +
      '</div>' +
    '</article>';
  }

  P.dispatch = {
    render: function () {
      const q = queue();
      const total = q.dispatch.length + q.approval.length + q.leader.length + q.summary.length;

      return U().pageHead({
        title: '派发与审批',
        sub: '待派发与待审批 · 当前 ' + total + ' 项待处理',
        actions: '<button class="btn btn-primary" id="dispatchNewTask" type="button">' + U().icon('plus') + '新建任务</button>' +
          '<button class="btn btn-ghost" id="queueExportBtn" type="button">' + U().icon('download') + '导出队列</button>'
      }) +
      U().taskTabs('dispatch') +
      '<div class="dispatch-overview">' +
        '<div class="summary-chip"><span class="icon">' + U().icon('send') + '</span><div><b>' + q.dispatch.length + '</b><span>待派发</span></div></div>' +
        '<div class="summary-chip"><span class="icon blue">' + U().icon('shield') + '</span><div><b>' + approvalMerged().length + '</b><span>待审批</span></div></div>' +
      '</div>' +
      '<div class="dispatch-grid">' +
        DISPATCH_QUEUES.map(function (def) {
          const list = queueList(def.key);
          const pages = Math.max(1, Math.ceil(list.length / QUEUE_PAGE_SIZE));
          const pageNum = Math.min(Math.max(1, ITO.pagerState['q-' + def.key] || 1), pages);
          ITO.pagerState['q-' + def.key] = pageNum;
          const bodyCards = list.length
            ? list.slice((pageNum - 1) * QUEUE_PAGE_SIZE, pageNum * QUEUE_PAGE_SIZE).map(function (x) { return card(x.item, x.mode); }).join('')
            : U().emptyState(def.empty[0], def.empty[1], def.empty[2]);
          return '<section class="card dispatch-col" data-queue="' + def.key + '">' +
            '<div class="dispatch-head"><h3>' + def.name + ' <span class="count">' + list.length + '</span></h3><span class="hint">' + def.hint + '</span></div>' +
            '<div class="dispatch-body" id="' + def.bodyId + '">' + bodyCards + '</div>' +
            (list.length > QUEUE_PAGE_SIZE ? '<div class="queue-pager">' + ITO.pager('q-' + def.key, list.length, pageNum, QUEUE_PAGE_SIZE) + '</div>' : '') +
          '</section>';
        }).join('') +
      '</div>';
    },

    after: function () {
      function bind() {
        U().$$('[data-act]').forEach(function (btn) {
          if (btn.dataset.bound) return;
          btn.dataset.bound = '1';
          btn.addEventListener('click', function () {
            if (btn.dataset.act === 'dispatch') ITO.taskActions.openDispatch(btn.dataset.task, btn.dataset.sub);
            if (btn.dataset.act === 'approve') ITO.taskActions.openApprove(btn.dataset.task, btn.dataset.sub);
            if (btn.dataset.act === 'leader') ITO.taskActions.openLeaderApproval(btn.dataset.task);
          });
        });
      }
      bind();

      const queueGrid = document.querySelector('.dispatch-grid');
      if (queueGrid) {
        queueGrid.addEventListener('click', function (e) {
          const pagerBtn = e.target.closest('[data-pager]');
          if (!pagerBtn || pagerBtn.disabled) return;
          const col = pagerBtn.closest('[data-queue]');
          if (!col) return;
          const key = col.dataset.queue;
          const def = DISPATCH_QUEUES.find(function (d) { return d.key === key; });
          if (!def) return;
          const list = queueList(key);
          const pages = Math.max(1, Math.ceil(list.length / QUEUE_PAGE_SIZE));
          const pageNum = Math.min(Math.max(1, Number(pagerBtn.dataset.page) || 1), pages);
          ITO.pagerState['q-' + key] = pageNum;
          const body = col.querySelector('.dispatch-body');
          if (body) body.innerHTML = list.length
            ? list.slice((pageNum - 1) * QUEUE_PAGE_SIZE, pageNum * QUEUE_PAGE_SIZE).map(function (x) { return card(x.item, x.mode); }).join('')
            : U().emptyState(def.empty[0], def.empty[1], def.empty[2]);
          const box = col.querySelector('.queue-pager');
          if (box) box.innerHTML = list.length > QUEUE_PAGE_SIZE ? ITO.pager('q-' + key, list.length, pageNum, QUEUE_PAGE_SIZE) : '';
          bind();
        });
      }

      document.getElementById('dispatchNewTask').addEventListener('click', function () { ITO.taskActions.newTask(); });
      const exp = document.getElementById('queueExportBtn');
      if (exp) exp.addEventListener('click', function () {
        const q = queue();
        const rows = [['队列', '主任务编号', '主任务', '任务编号', '任务', '专业组', '负责人', '执行人', '截止时间', '授权', '开票', '审批状态']];
        q.dispatch.forEach(function (x) {
          rows.push(['待分发', x.task.id, x.task.name, x.sub.id, x.sub.name, (ITO.getGroup(x.sub.group) || {}).name, x.task.owner, x.sub.owner, x.sub.due, x.sub.auth, x.sub.ticket ? '是' : '否', '—']);
        });
        q.approval.forEach(function (x) {
          rows.push(['负责人审批', x.task.id, x.task.name, x.sub.id, x.sub.name, (ITO.getGroup(x.sub.group) || {}).name, x.task.owner, x.sub.owner, x.sub.due, x.sub.auth, x.sub.ticket ? '是' : '否', x.sub.approval ? x.sub.approval.status : '—']);
        });
        q.leader.forEach(function (x) {
          rows.push(['领导审批', x.task.id, x.task.name, '', '', (ITO.getGroup(x.task.group) || {}).name, x.task.owner, '', x.task.due, '', '', x.task.leaderApproval.status]);
        });
        q.summary.forEach(function (x) {
          rows.push(['待汇总报审', x.task.id, x.task.name, '', '', (ITO.getGroup(x.task.group) || {}).name, x.task.owner, '', x.task.due, '', '', x.task.leaderApproval.status]);
        });
        U().exportPreview({ title: '派发审批队列导出预览', rows: rows, filename: 'ITO派发审批队列-' + D.meta.today + '.csv' });
        ITO.log('导出派发审批队列', q.dispatch.length + ' 待分发 / ' + q.approval.length + ' 审批 / ' + q.leader.length + ' 领导审批', '任务');
        U().toast('派发审批队列已导出');
      });
    }
  };

  /* ── my tasks ────────────────────────────── */
  function myItems() {
    const st = S();
    const items = [];
    st.tasks.forEach(function (t) {
      if (t.canceled) return;
      t.subs.forEach(function (s) {
        if (s.owner === st.user.name && ['待分发', '草稿', '已取消'].indexOf(s.status) === -1) items.push({ task: t, sub: s });
      });
    });
    return items;
  }

  function greet() {
    const h = new Date().getHours();
    if (h < 6) return '凌晨好';
    if (h < 12) return '上午好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  function currentGroup(st) {
    const me = st.staff.find(function (p) { return p.name === st.user.name; });
    return (me && st.groups.find(function (g) { return g.id === me.group; })) ||
      st.groups.find(function (g) { return g.manager === st.user.name; }) || null;
  }

  function scopeItems(st) {
    if (st.role === 'leader' || st.role === 'super') {
      const all = [];
      st.tasks.forEach(function (t) {
        if (t.canceled || t.draft) return;
        (t.subs || []).forEach(function (s) {
          if (['草稿', '已取消', '待分发'].indexOf(s.status) === -1) all.push({ task: t, sub: s });
        });
      });
      return all;
    }
    if (st.role === 'manager') {
      const group = currentGroup(st);
      if (!group) return myItems();
      const all = [];
      st.tasks.forEach(function (t) {
        if (t.canceled || t.draft || t.group !== group.id) return;
        (t.subs || []).forEach(function (s) {
          if (['草稿', '已取消', '待分发'].indexOf(s.status) === -1) all.push({ task: t, sub: s });
        });
      });
      return all;
    }
    return myItems();
  }

  function planTasksOf(st) {
    if (st.role === 'leader' || st.role === 'super') return (st.planTasks || []).slice();
    if (st.role === 'manager') {
      const group = currentGroup(st);
      return (st.planTasks || []).filter(function (t) { return !group || t.group === group.id; });
    }
    return (st.planTasks || []).filter(function (t) { return t.executor === st.user.name; });
  }

  function planRows(list, showAction, st) {
    const state = st || S();
    return list.map(function (item) {
      if (item.kind === 'duty') {
        const h = item.h;
        return '<tr data-duty-week="' + U().esc(h.week.key) + '" class="plan-row duty-row" title="查看值班表">' +
          '<td><div class="cell-task"><b>值班交接 · 第 ' + h.week.weekNo + ' 周</b><small>值班任务 · ' + U().esc(h.person + ' → ' + h.incoming) + '</small></div></td>' +
          '<td>' + U().groupPill(h.group) + '</td>' +
          '<td>' + U().esc(h.person) + '</td>' +
          '<td class="num">—</td>' +
          '<td class="num" style="white-space:nowrap">' + U().shortDate(h.due) + '</td>' +
          '<td>' + U().badge(h.status) + '</td>' +
          (showAction === false ? '' : '<td style="text-align:center">' + dutyActionButton(h, state.user.name) + '</td>') +
          '</tr>';
      }
      const t = item.t;
      const duty = t.source === '值班';
      const actionCell = t.status === '已完成'
        ? '<span class="muted">—</span>'
        : '<a class="btn btn-ghost btn-sm" href="#/' + (duty ? 'duty' : (t.planType === 'inspection' ? 'inspection' : 'maintenance')) + '">' + (duty ? '查看排班' : '去执行') + '</a>';
      return '<tr data-plan-task="' + U().esc(t.id) + '" class="plan-row" title="查看常规任务详情">' +
        '<td><div class="cell-task"><b>' + U().esc(t.name) + '</b><small>' + U().esc(t.source + ' · ' + t.planId) + '</small></div></td>' +
        '<td>' + U().groupPill(t.group) + '</td>' +
        '<td>' + U().esc(t.executor || t.owner || '—') + '</td>' +
        '<td class="num">' + (t.hours || 0) + ' h</td>' +
        '<td class="num" style="white-space:nowrap">' + U().shortDate(t.due) + '</td>' +
        '<td>' + U().badge(t.status) + '</td>' +
        (showAction === false ? '' : '<td style="text-align:center">' + actionCell + '</td>') +
        '</tr>';
    }).join('');
  }

  function subRows(list) {
    return list.map(function (x) {
      const rec = window.DeliverableStore ? window.DeliverableStore.getLatestSubmission(x.sub.id) : null;
      const s = x.sub;
      let acts = '';
      if (s.status === '执行中') acts += '<button class="btn btn-primary btn-sm" data-act="submit" data-task="' + x.task.id + '" data-sub="' + s.id + '" type="button">提交成果</button>';
      if (s.status === '已挂起') acts += '<button class="btn btn-soft btn-sm" data-act="resubmit" data-task="' + x.task.id + '" data-sub="' + s.id + '" type="button">重新提交</button>';
      if (rec && rec.files.length) acts += '<button class="btn btn-ghost btn-sm" type="button" data-deliv-preview="' + U().esc(rec.files[0].id) + '">查看成果</button>';
      const tags = (s.tags || []).slice(0, 2);
      return '<tr data-subrow-task="' + x.task.id + '" data-subrow-sub="' + s.id + '" style="cursor:pointer">' +
        '<td><div class="cell-task"><b>' + U().esc(s.name) + '</b><small>' + s.id + ' · ' + U().esc(x.task.name) + '</small></div></td>' +
        '<td>' + U().groupPill(s.group) + '</td>' +
        '<td>' + (s.auth && s.auth !== '—' && s.auth !== '无需授权' ? '<span class="tag-inline auth-inline">' + U().esc(s.auth) + '</span>' : '<span class="muted">—</span>') + '</td>' +
        '<td>' + (tags.length ? tags.map(function (tag) { return '<span class="tag-inline">' + U().esc(tag) + '</span>'; }).join('') : '<span class="muted">—</span>') + '</td>' +
        '<td>' + U().badge(s.level) + '</td>' +
        '<td class="num" style="white-space:nowrap">' + U().shortDate(s.due) + (U().isOverdue(s) ? ' <span class="text-red">超期</span>' : '') + '</td>' +
        '<td>' + U().badge(s.status) + '</td>' +
        '<td>' + (rec && rec.files.length ? '<span class="muted">v' + rec.version + ' · ' + rec.files.length + ' 个</span>' : '<span class="muted">—</span>') + '</td>' +
        '<td><div class="row-actions">' + (acts || '<span class="muted">—</span>') + '</div></td>' +
      '</tr>';
    }).join('');
  }

  function handoverRows(list, userName) {
    return list.map(function (h) {
      const action = h.person === userName && h.status === '待交接' ? '<button class="btn btn-primary btn-sm" type="button" data-my-handover="' + U().esc(h.week.key) + '">提交交接</button>' :
        h.incoming === userName && h.status === '待接班确认' ? '<button class="btn btn-primary btn-sm" type="button" data-my-handover="' + U().esc(h.week.key) + '">确认接班</button>' : '';
      const recordShort = h.record ? (h.record.length > 42 ? h.record.slice(0, 42) + '…' : h.record) : '';
      return '<tr data-duty-week="' + U().esc(h.week.key) + '">' +
        '<td><div class="cell-task"><b>第 ' + h.week.weekNo + ' 周</b><small>' + U().esc(h.week.start + ' ~ ' + h.week.end) + '</small></div></td>' +
        '<td>' + U().esc(h.person) + '</td>' +
        '<td>' + U().esc(h.incoming) + '</td>' +
        '<td class="muted" style="max-width:260px">' + (recordShort ? '<span title="' + U().esc(h.record) + '">' + U().esc(recordShort) + '</span>' : '<span class="muted">—</span>') + '</td>' +
        '<td>' + U().badge(h.status) + '</td>' +
        '<td style="text-align:right"><div class="row-actions">' + (action || '<span class="muted">—</span>') + '</div></td></tr>';
    }).join('');
  }

  function mineBlockFilters(st) {
    st.ui = st.ui || {};
    return st.ui.mineBlockFilters = st.ui.mineBlockFilters || {
      managed: { status: '', level: '', age: '' },
      subtasks: { type: '', status: '', level: '', age: '' },
      regular: { status: '', age: '' },
      duty: { status: '' }
    };
  }

  function overdueDays(due) {
    const today = D.meta.today || '';
    if (!due || !today) return 0;
    const d = Math.floor((new Date(today.replace(/-/g, '/')) - new Date(due.replace(/-/g, '/'))) / 86400000);
    return d > 0 ? d : 0;
  }

  function ageHit(f, due, isOver) {
    if (!f.age) return true;
    if (!isOver) return false;
    const d = overdueDays(due);
    return f.age === 'lt1' ? d < 1 : f.age === '1to3' ? d >= 1 && d <= 3 : f.age === '3to5' ? d > 3 && d <= 5 : d > 5;
  }

  function ageOptions(selected) {
    return [['lt1', '<1 天'], ['1to3', '1–3 天'], ['3to5', '3–5 天'], ['gte5', '≥5 天']].map(function (pair) {
      return '<option value="' + pair[0] + '"' + (selected === pair[0] ? ' selected' : '') + '>' + pair[1] + '</option>';
    }).join('');
  }

  function statusHit(f, status, isOver) {
    if (!f.status) return true;
    if (f.status === '超期') return !!isOver;
    return status === f.status;
  }

  /* 员工「我的任务」统一列表：子任务 + 巡检 / 维保，按截止时间排序（subtasks 块筛选） */
  function mineUnifiedList(st, blockQ) {
    const f = mineBlockFilters(st).subtasks;
    const q = String(blockQ !== undefined ? blockQ : (st.ui.mineBlockSearch || {}).subtasks || '').trim().toLowerCase();
    const hit = function (hay) { return !q || String(hay).toLowerCase().indexOf(q) > -1; };
    const rows = [];
    if (f.type === '' || f.type === '任务') {
      myItems().forEach(function (x) {
        if (!hit([x.sub.name, x.sub.id, x.task.name, x.sub.owner].join(' '))) return;
        if (!statusHit(f, x.sub.status, U().isOverdue(x.sub))) return;
        if (f.level && x.sub.level !== f.level) return;
        if (!ageHit(f, x.sub.due, U().isOverdue(x.sub))) return;
        rows.push({ kind: 'sub', x: x, due: x.sub.due });
      });
    }
    if (f.type === '' || f.type === '巡检' || f.type === '维保') {
      planTasksOf(st).forEach(function (t) {
        const kind = t.source === '巡检计划' ? '巡检' : '维保';
        if (f.type && f.type !== kind) return;
        if (!hit([t.name, t.planId, t.source, t.executor].join(' '))) return;
        if (!statusHit(f, t.status, false)) return;
        if (f.level || f.age) return;
        rows.push({ kind: 'plan', t: t, due: t.due });
      });
    }
    if (f.type === '' || f.type === '值班') {
      dutyItemsFor(st).forEach(function (h) {
        if (!hit(['值班交接', '第 ' + h.week.weekNo + ' 周', h.person, h.incoming, h.week.start, h.week.end].join(' '))) return;
        if (!statusHit(f, h.status, false)) return;
        if (f.level) return;
        if (!ageHit(f, h.due, false)) return;
        rows.push({ kind: 'duty', h: h, due: h.due });
      });
    }
    rows.sort(function (a, b) { return String(a.due || '').localeCompare(String(b.due || '')); });
    return rows;
  }

  function dutyItemsFor(st) {
    const all = ITO.dutyHandovers();
    if (st.role === 'leader' || st.role === 'super') return all;
    if (st.role === 'manager') {
      const group = currentGroup(st);
      return group ? all.filter(function (h) { return h.group === group.id; }) : [];
    }
    return all.filter(function (h) { return h.person === st.user.name || h.incoming === st.user.name; });
  }

  function dutyActionButton(h, userName) {
    if (h.person === userName && h.status === '待交接') {
      return '<button class="btn btn-primary btn-sm" type="button" data-my-handover="' + U().esc(h.week.key) + '">提交交接</button>';
    }
    if (h.incoming === userName && h.status === '待接班确认') {
      return '<button class="btn btn-primary btn-sm" type="button" data-my-handover="' + U().esc(h.week.key) + '">确认接班</button>';
    }
    return '<button class="btn btn-ghost btn-sm" type="button" data-duty-view="' + U().esc(h.week.key) + '">查看</button>';
  }

  /* 领导 / 主管「常规任务」：巡检、维保计划 + 值班交接（regular 块筛选） */
  function mineRegularItems(st, blockQ) {
    const f = mineBlockFilters(st).regular;
    const q = String(blockQ !== undefined ? blockQ : (st.ui.mineBlockSearch || {}).regular || '').trim().toLowerCase();
    const hit = function (hay) { return !q || String(hay).toLowerCase().indexOf(q) > -1; };
    const items = [];
    planTasksOf(st).forEach(function (t) {
      if (!hit([t.name, t.planId, t.source, t.executor].join(' '))) return;
      if (!statusHit(f, t.status, false)) return;
      if (!ageHit(f, t.due, false)) return;
      items.push({ kind: 'plan', t: t, due: t.due });
    });
    dutyItemsFor(st).forEach(function (h) {
      if (!hit(['值班交接', '第 ' + h.week.weekNo + ' 周', h.person, h.incoming, h.week.start, h.week.end].join(' '))) return;
      if (!statusHit(f, h.status, false)) return;
      if (!ageHit(f, h.due, false)) return;
      items.push({ kind: 'duty', h: h, due: h.due });
    });
    return items.sort(function (a, b) { return String(a.due || '').localeCompare(String(b.due || '')); });
  }

  function unifiedRows(rows) {
    const st = S();
    return rows.map(function (r) {
      if (r.kind === 'duty') {
        const h = r.h;
        return '<tr data-duty-week="' + U().esc(h.week.key) + '">' +
          '<td><div class="cell-task"><b>值班交接 · 第 ' + h.week.weekNo + ' 周</b><small>' + U().esc(h.person + ' → ' + h.incoming) + ' · ' + U().esc(h.week.start + ' ~ ' + h.week.end) + '</small></div></td>' +
          '<td><span class="tag-kind">值班</span></td>' +
          '<td><span class="muted">—</span></td>' +
          '<td class="num">—</td>' +
          '<td class="num" style="white-space:nowrap">' + U().shortDate(h.due) + '</td>' +
          '<td>' + U().badge(h.status) + '</td>' +
          '<td style="text-align:right">' + dutyActionButton(h, st.user.name) + '</td></tr>';
      }
      if (r.kind === 'plan') {
        const t = r.t;
        const kind = t.source === '巡检计划' ? '巡检' : (t.source === '值班' ? '值班' : '维保');
        return '<tr data-plan-task="' + U().esc(t.id) + '">' +
          '<td><div class="cell-task"><b>' + U().esc(t.name) + '</b><small>' + U().esc(t.planId + ' · ' + t.source) + '</small></div></td>' +
          '<td><span class="tag-kind">' + kind + '</span></td>' +
          '<td><span class="muted">—</span></td>' +
          '<td class="num">' + (t.hours || 0) + ' h</td>' +
          '<td class="num" style="white-space:nowrap">' + U().shortDate(t.due) + '</td>' +
          '<td>' + U().badge(t.status) + '</td>' +
          '<td style="text-align:right">' + (t.status === '已完成' ? '<span class="muted">—</span>' : '<a class="btn btn-ghost btn-sm" href="#/' + (t.source === '值班' ? 'duty' : (t.planType === 'inspection' ? 'inspection' : 'maintenance')) + '">' + (t.source === '值班' ? '查看排班' : '去执行') + '</a>') + '</td></tr>';
      }
      const x = r.x;
      const rec = window.DeliverableStore ? window.DeliverableStore.getLatestSubmission(x.sub.id) : null;
      let acts = '';
      if (x.sub.status === '执行中') acts += '<button class="btn btn-primary btn-sm" data-act="submit" data-task="' + x.task.id + '" data-sub="' + x.sub.id + '" type="button">提交成果</button>';
      if (x.sub.status === '已挂起') acts += '<button class="btn btn-soft btn-sm" data-act="resubmit" data-task="' + x.task.id + '" data-sub="' + x.sub.id + '" type="button">重新提交</button>';
      if (rec && rec.files.length) acts += '<button class="btn btn-ghost btn-sm" type="button" data-deliv-preview="' + U().esc(rec.files[0].id) + '">查看成果</button>';
      return '<tr data-subrow-task="' + x.task.id + '" data-subrow-sub="' + x.sub.id + '">' +
        '<td><div class="cell-task"><b>' + U().esc(x.sub.name) + '</b><small>' + x.sub.id + ' · ' + U().esc(x.task.name) + '</small></div></td>' +
        '<td><span class="tag-kind">' + U().esc(x.sub.type || '任务') + '</span></td>' +
        '<td>' + U().esc(x.sub.level || '—') + '</td>' +
        '<td class="num">' + (x.sub.hours || 0) + ' h</td>' +
        '<td class="num" style="white-space:nowrap">' + U().shortDate(x.sub.due) + (U().isOverdue(x.sub) ? ' <span class="text-red">超期</span>' : '') + '</td>' +
        '<td>' + U().badge(x.sub.status) + '</td>' +
        '<td><div class="row-actions">' + (acts || '<span class="muted">—</span>') + '</div></td>' +
      '</tr>';
    }).join('');
  }

  /* 工具栏过滤后的值班任务 / 我管理的任务 */
  function mineDutyList(st, blockQ) {
    const f = mineBlockFilters(st).duty;
    const q = String(blockQ !== undefined ? blockQ : (st.ui.mineBlockSearch || {}).duty || '').trim().toLowerCase();
    const hit = function (hay) { return !q || String(hay).toLowerCase().indexOf(q) > -1; };
    return ITO.dutyHandovers().filter(function (h) {
      return (h.person === st.user.name || (h.incoming === st.user.name && h.status !== '待交接')) &&
        (f.type === '' || f.type === '值班任务') &&
        hit(['第 ' + h.week.weekNo + ' 周', h.week.start, h.week.end, h.person, h.incoming, h.record || ''].join(' ')) &&
        statusHit(f, h.status, false) && !f.level && !f.age;
    });
  }

  function mineManagedList(st, blockQ) {
    const f = mineBlockFilters(st).managed;
    const q = String(blockQ !== undefined ? blockQ : (st.ui.mineBlockSearch || {}).managed || '').trim().toLowerCase();
    const hit = function (hay) { return !q || String(hay).toLowerCase().indexOf(q) > -1; };
    return managedList(st).filter(function (x) {
      const t = x.task;
      const over = (t.subs || []).some(function (s) { return U().isOverdue(s) || U().isLateClosed(s); });
      return hit([t.name, t.id, t.owner, t.initiator].join(' ')) &&
        statusHit(f, U().displayStatus(t), over) &&
        (!f.level || t.level === f.level) &&
        ageHit(f, t.due, over);
    });
  }

  function managedList(st) {
    const map = {};
    const group = currentGroup(st);
    const leader = st.role === 'leader' || st.role === 'super';
    st.tasks.forEach(function (t) {
      if (t.canceled || t.draft) return;
      const launchedByMe = t.initiator === st.user.name;
      const ownedByMe = t.owner === st.user.name;
      const groupTask = !!(group && t.group === group.id);
      if (leader) {
        // 领导层团队任务：全部专业组
      } else if (!groupTask && !launchedByMe && !ownedByMe) {
        return;
      }
      let source = 'team';
      if (launchedByMe && ownedByMe) source = 'both';
      else if (launchedByMe) source = 'launched';
      else if (ownedByMe) source = 'own';
      else if (groupTask) source = 'group';
      map[t.id] = { task: t, source: source };
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function managedRows(slice) {
    const sourceLabel = {
      launched: '<span class="badge blue">我发起</span>',
      own: '<span class="badge green">我负责</span>',
      both: '<span class="badge purple">发起+负责</span>',
      group: '<span class="badge blue">本组任务</span>',
      team: '<span class="badge gray">团队任务</span>'
    };
    return slice.map(function (x) {
      const t = x.task;
      const auths = [];
      (t.subs || []).forEach(function (sub) {
        if (sub.auth && sub.auth !== '—' && sub.auth !== '无需授权' && auths.indexOf(sub.auth) === -1) auths.push(sub.auth);
      });
      const tags = (t.tags || []).slice(0, 2);
      const canReassign = x.source !== 'launched' && U().isTaskEditable(t) &&
        ['待分发', '执行中'].indexOf(U().mainStatus(t)) > -1;
      return '<tr data-detail-task="' + t.id + '" style="cursor:pointer">' +
        '<td><div class="cell-task"><b>' + U().esc(t.name) + '</b><small>' + U().esc(t.id + ' · ' + t.type + ' · ' + (x.source === 'team' ? '团队任务' : x.source === 'group' ? '本组任务' : x.source === 'launched' ? '我发起' : x.source === 'own' ? '我负责' : '发起+负责')) + '</small></div></td>' +
        '<td>' + U().groupPill(t.group) + '</td>' +
        '<td>' + U().esc(t.initiator || '—') + '</td>' +
        '<td>' + U().esc(t.owner || '—') + '</td>' +
        '<td>' + (auths.length ? '<span class="tag-inline auth-inline">' + U().esc(auths[0]) + '</span>' + (auths.length > 1 ? '<span class="tag-more">+' + (auths.length - 1) + '</span>' : '') : '<span class="muted">—</span>') + '</td>' +
        '<td>' + (tags.length ? tags.map(function (tag) { return '<span class="tag-inline">' + U().esc(tag) + '</span>'; }).join('') : '<span class="muted">—</span>') + '</td>' +
        '<td>' + U().badge(t.level) + '</td>' +
        '<td class="num" style="white-space:nowrap">' + U().shortDate(t.due) + '</td>' +
        '<td>' + U().badge(U().displayStatus(t)) + '</td>' +
        '<td style="text-align:center"><div class="row-actions">' +
          (canReassign ? '<button class="btn btn-ghost btn-sm" type="button" data-my-reassign="' + t.id + '">改派</button>' : '<span class="muted">—</span>') +
        '</div></td></tr>';
    }).join('');
  }

  function pageSlice(key, list, size) {
    const pages = Math.max(1, Math.ceil(list.length / size));
    const page = Math.min(Math.max(1, ITO.pagerState[key] || 1), pages);
    ITO.pagerState[key] = page;
    return { list: list.slice((page - 1) * size, page * size), pager: ITO.pager(key, list.length, page, size) };
  }

  P.mine = {
    render: function () {
      const st = S();
      const myExecItems = myItems();
      const items = scopeItems(st);
      const open = items.filter(function (x) { return x.sub.status !== '已完成'; });
      const done = items.filter(function (x) { return x.sub.status === '已完成'; });
      const approval = items.filter(function (x) { return x.sub.status === '审批中' || x.sub.status === '已挂起'; });
      const hours = Math.round(items.reduce(function (n, x) {
        return n + (ITO.actualHoursOf ? ITO.actualHoursOf(x.sub) : (Number(x.sub.hours) || 0));
      }, 0) * 10) / 10;
      const myGroup = currentGroup(st);
      const isLeader = st.role === 'leader' || st.role === 'super';
      const pageTitle = isLeader ? '团队任务' : '我的任务';
      const isLead = st.role === 'manager' || st.role === 'leader' || st.role === 'super';
      const unifiedList = mineUnifiedList(st);
      const managedFiltered = isLead ? mineManagedList(st) : managedList(st);
      const plansFiltered = isLead ? mineRegularItems(st) : [];
      const PAGE_SIZE = 10;
      const managedPage = pageSlice('managed', managedFiltered, PAGE_SIZE);
      const subPage = pageSlice('subtasks', isLead ? myExecItems : unifiedList, PAGE_SIZE);
      const regPage = pageSlice('regular', plansFiltered, PAGE_SIZE);
      const anchors = [];
      if (isLead) anchors.push({ key: 'managed', label: isLeader ? '团队任务' : '我管理的任务' });
      if (!isLeader && (!isLead || myExecItems.length)) anchors.push({ key: 'subtasks', label: isLead ? '我执行的任务' : '我的任务' });
      if (isLead) anchors.push({ key: 'regular', label: '常规任务' });
      const bs = st.ui.mineBlockSearch = st.ui.mineBlockSearch || { managed: '', subtasks: '', regular: '', duty: '' };
      const bf = mineBlockFilters(st);
      const anchorNav = anchors.length
        ? '<nav class="anchor-nav" id="mineAnchorNav" aria-label="页内导航">' + anchors.map(function (a) {
            return '<button type="button" data-anchor="' + a.key + '">' + a.label + '</button>';
          }).join('') + '</nav>'
        : '';

      const scopeLabel = isLeader ? '团队' : (st.role === 'manager' ? '本组' : '我的');
      const hoursLabel = isLeader ? '团队工时消耗' : (st.role === 'manager' ? '本组工时消耗' : '我的实际工时');
      const hoursNote = isLeader || st.role === 'manager' ? '成员实际工时累计 · 非本人' : '本人已记录实际工时';
      return U().pageHead({
        title: pageTitle,
        sub: greet() + '，' + st.user.name + (myGroup ? ' · ' + myGroup.name : '') + (isLeader ? ' · 全部专业组' : ''),
        actions:
          (ITO.isSuper() || ITO.roleIs('manager', 'leader')
            ? '<a class="btn btn-ghost" href="#/tasks">' + U().icon('task') + '任务管理</a>'
            : '') +
          '<button class="btn btn-primary" id="myExportBtn" type="button">' + U().icon('download') + (isLeader ? '导出团队任务' : '导出我的任务') + '</button>'
      }) +

      '<div class="mine-overview">' +
        '<section class="card chart-card">' +
          '<div class="chart-head"><div><h3 class="chart-title">' + (isLeader ? '团队闭环趋势' : (st.role === 'manager' ? '个人与团队闭环趋势' : '个人闭环趋势')) + '</h3><p class="chart-sub">近 5 个月闭环主任务 · 按任务所属月份</p></div>' +
            '<span class="head-tag">' + (isLeader ? 'TEAM' : (st.role === 'manager' ? 'PERSONAL / TEAM' : 'PERSONAL')) + '</span></div>' +
          '<div class="chart-body" id="myChart" role="img" aria-label="近 5 个月闭环主任务趋势图，可按月份查看任务明细"></div>' +
        '</section>' +
        '<div class="mine-kpi-stack">' +
          '<div class="card kpi-card" data-mine-kpi="open" role="button" tabindex="0" aria-label="查看' + scopeLabel + '在办任务"><div class="kpi-label">' + U().icon('task') + '<span>' + scopeLabel + '在办</span></div><div class="kpi-value">' + open.length + '<span class="unit">项</span></div><div class="kpi-meta"><span>含 ' + approval.length + ' 项审批中 · 按子任务统计</span></div></div>' +
          '<div class="card kpi-card" data-mine-kpi="done" data-tone="green" role="button" tabindex="0" aria-label="查看已完成任务"><div class="kpi-label">' + U().icon('check') + '<span>已完成</span></div><div class="kpi-value">' + done.length + '<span class="unit">项</span></div><div class="kpi-meta"><span>按子任务统计 · 验收归档</span></div></div>' +
          '<div class="card kpi-card" data-mine-kpi="overdue" data-tone="red" role="button" tabindex="0" aria-label="查看超期任务"><div class="kpi-label">' + U().icon('clock') + '<span>超期任务</span></div><div class="kpi-value">' + items.filter(function (x) { return U().isOverdue(x.sub); }).length + '<span class="unit">项</span></div><div class="kpi-meta"><span>需优先处理</span></div></div>' +
          '<div class="card kpi-card" data-mine-kpi="hours" data-tone="blue" role="button" tabindex="0" aria-label="查看' + scopeLabel + '工时明细"><div class="kpi-label">' + U().icon('chart') + '<span>' + hoursLabel + '</span></div><div class="kpi-value">' + hours + '<span class="unit">h</span></div><div class="kpi-meta"><span>' + hoursNote + '</span></div></div>' +
        '</div>' +
      '</div>' +

      anchorNav +

      '<div class="mine-stack">' +

      (isLead
        ? '<section class="card table-card" id="sec-managed" data-mine-section>' +
            '<div class="table-head"><div class="report-head-left"><h3>' + (isLeader ? '团队任务' : '我管理的任务') + '</h3>' +
              '<input class="oh-search" id="msManaged" type="search" placeholder="搜索任务 / 编号…" value="' + U().esc(bs.managed) + '">' +
              '<select class="select" id="mfManagedStatus" aria-label="状态"><option value="">全部状态</option>' + ['执行中', '审批中', '已挂起', '已完成', '超期'].map(function (sv) {
                return '<option value="' + sv + '"' + (bf.managed.status === sv ? ' selected' : '') + '>' + sv + '</option>';
              }).join('') + '</select>' +
              '<select class="select" id="mfManagedLevel" aria-label="优先级"><option value="">全部优先级</option>' + ['紧急', '重要', '一般'].map(function (l) {
                return '<option value="' + l + '"' + (bf.managed.level === l ? ' selected' : '') + '>' + l + '</option>';
              }).join('') + '</select>' +
              '<select class="select" id="mfManagedAge" aria-label="超期时长"><option value="">全部超期时长</option>' + ageOptions(bf.managed.age) + '</select>' +
              '<button class="btn btn-ghost" id="rsManaged" type="button">' + U().icon('refresh') + '重置</button></div>' +
              '<span class="table-note" id="managedCount" title="列表状态按主任务统计">' + managedFiltered.length + ' 项 · 按主任务</span></div>' +
            '<div class="table-wrap"><table class="data-table mine-task-table"><thead><tr><th>任务</th><th>专业组</th><th>发起人</th><th>负责人</th><th>授权</th><th>标签</th><th>优先级</th><th>截止时间</th><th>状态</th><th>操作</th></tr></thead>' +
            '<tbody id="managedBody">' + (managedRows(managedPage.list) || '<tr><td colspan="10">' + U().emptyState(isLeader ? '暂无团队任务' : '暂无我管理的任务', '任务创建后会出现在这里', 'task') + '</td></tr>') + '</tbody></table></div>' +
            (managedFiltered.length ? '<div id="managedPager">' + managedPage.pager + '</div>' : '') +
          '</section>'
        : '') +

      ((!isLeader && (!isLead || myExecItems.length))
        ? (isLead
          ? '<section class="card table-card" id="sec-subtasks" data-mine-section>' +
              '<div class="table-head"><div class="report-head-left"><h3>我执行的任务</h3>' +
                '<input class="oh-search" id="msSubtasks" type="search" placeholder="搜索任务 / 编号…" value="' + U().esc(bs.subtasks) + '">' +
                '<select class="select" id="mfSubStatus" aria-label="状态"><option value="">全部状态</option>' + ['执行中', '审批中', '已挂起', '已完成', '超期'].map(function (sv) {
                  return '<option value="' + sv + '"' + (bf.subtasks.status === sv ? ' selected' : '') + '>' + sv + '</option>';
                }).join('') + '</select>' +
                '<select class="select" id="mfSubLevel" aria-label="优先级"><option value="">全部优先级</option>' + ['紧急', '重要', '一般'].map(function (l) {
                  return '<option value="' + l + '"' + (bf.subtasks.level === l ? ' selected' : '') + '>' + l + '</option>';
                }).join('') + '</select>' +
                '<select class="select" id="mfSubAge" aria-label="超期时长"><option value="">全部超期时长</option>' + ageOptions(bf.subtasks.age) + '</select>' +
                '<button class="btn btn-ghost" id="rsSubtasks" type="button">' + U().icon('refresh') + '重置</button></div>' +
                '<span class="table-note">' + myExecItems.length + ' 项</span></div>' +
              '<div class="table-wrap"><table class="data-table mine-task-table"><thead><tr><th>任务</th><th>专业组</th><th>授权</th><th>标签</th><th>优先级</th><th>截止时间</th><th>状态</th><th>成果物</th><th>操作</th></tr></thead>' +
              '<tbody id="myTbody">' + (subRows(subPage.list) || '<tr><td colspan="9">' + U().emptyState('暂无分配到我的任务', '主管派发后会出现在这里', 'task') + '</td></tr>') + '</tbody></table></div>' +
              (myExecItems.length ? '<div id="subtasksPager">' + subPage.pager + '</div>' : '') +
            '</section>'
          : '<section class="card table-card" id="sec-subtasks" data-mine-section>' +
              '<div class="table-head"><div class="report-head-left"><h3>我的任务</h3>' +
                '<input class="oh-search" id="msSubtasks" type="search" placeholder="搜索任务 / 编号…" value="' + U().esc(bs.subtasks) + '">' +
                '<select class="select" id="mfSubType" aria-label="类型"><option value="">全部类型</option>' + ['任务', '巡检', '维保', '值班'].map(function (t) {
                  return '<option value="' + t + '"' + (bf.subtasks.type === t ? ' selected' : '') + '>' + t + '</option>';
                }).join('') + '</select>' +
                '<select class="select" id="mfSubStatus" aria-label="状态"><option value="">全部状态</option>' + ['执行中', '审批中', '已挂起', '已完成', '计划中', '超期'].map(function (sv) {
                  return '<option value="' + sv + '"' + (bf.subtasks.status === sv ? ' selected' : '') + '>' + sv + '</option>';
                }).join('') + '</select>' +
                '<select class="select" id="mfSubLevel" aria-label="优先级"><option value="">全部优先级</option>' + ['紧急', '重要', '一般'].map(function (l) {
                  return '<option value="' + l + '"' + (bf.subtasks.level === l ? ' selected' : '') + '>' + l + '</option>';
                }).join('') + '</select>' +
                '<select class="select" id="mfSubAge" aria-label="超期时长"><option value="">全部超期时长</option>' + ageOptions(bf.subtasks.age) + '</select>' +
                '<button class="btn btn-ghost" id="rsSubtasks" type="button">' + U().icon('refresh') + '重置</button></div>' +
                '<span class="table-note" id="mineUnifiedCount">' + unifiedList.length + ' 项</span></div>' +
              '<div class="table-wrap"><table class="data-table"><thead><tr><th style="min-width:240px">任务</th><th>类型</th><th>优先级</th><th class="num">工时</th><th>截止时间</th><th>状态</th><th style="text-align:right">操作</th></tr></thead>' +
              '<tbody id="myTbody">' + (unifiedRows(subPage.list) || '<tr><td colspan="7">' + U().emptyState('没有匹配的任务', '调整搜索或筛选条件', 'task') + '</td></tr>') + '</tbody></table></div>' +
              '<div id="subtasksPager">' + subPage.pager + '</div>' +
            '</section>')
        : '') +

      (isLead
        ? '<section class="card table-card" id="sec-regular" data-mine-section>' +
            '<div class="table-head"><div class="report-head-left"><h3>常规任务</h3>' +
              '<input class="oh-search" id="msRegular" type="search" placeholder="搜索任务 / 编号 / 周次…" value="' + U().esc(bs.regular) + '">' +
              '<select class="select" id="mfRegularStatus" aria-label="状态"><option value="">全部状态</option>' + ['计划中', '进行中', '已完成'].map(function (sv) {
                return '<option value="' + sv + '"' + (bf.regular.status === sv ? ' selected' : '') + '>' + sv + '</option>';
              }).join('') + '</select>' +
              '<select class="select" id="mfRegularAge" aria-label="超期时长"><option value="">全部超期时长</option>' + ageOptions(bf.regular.age) + '</select>' +
              '<button class="btn btn-ghost" id="rsRegular" type="button">' + U().icon('refresh') + '重置</button></div>' +
              '<span class="table-note" id="regularCount">' + plansFiltered.length + ' 项</span></div>' +
        '<div class="table-wrap"><table class="data-table mine-task-table"><thead><tr><th>任务</th><th>专业组</th><th>执行人</th><th>标准工时</th><th>截止时间</th><th>状态</th>' + (isLeader ? '' : '<th style="text-align:center">操作</th>') + '</tr></thead>' +
            '<tbody id="regularBody">' + (planRows(regPage.list, !isLeader, st) || '<tr><td colspan="' + (isLeader ? 6 : 7) + '">' + U().emptyState('暂无常规任务', '巡检 / 维保 / 值班任务会出现在这里', 'clipboard') + '</td></tr>') + '</tbody></table></div>' +
            (plansFiltered.length ? '<div id="regularPager">' + regPage.pager + '</div>' : '') +
          '</section>'
        : '') +
      '</div>';
    },

    after: function () {
      const st = S();
      const PAGE_SIZE = 10;
      const monthBase = new Date(D.meta.today.replace(/-/g, '/'));
      const monthLabels = [];
      const monthStarts = [];
      for (let i = 4; i >= 0; i -= 1) {
        const d = new Date(monthBase.getFullYear(), monthBase.getMonth() - i, 1);
        monthStarts.push(d);
        monthLabels.push((d.getMonth() + 1) + ' 月');
      }
      const role = st.role;
      const group = currentGroup(st);
      const teamCounts = function (groupId) {
        if (groupId) return (D.teamTrend && D.teamTrend[groupId] || []).slice(-5);
        return [0, 0, 0, 0, 0].map(function (_, i) {
          return Object.keys(D.teamTrend || {}).reduce(function (n, key) { return n + (D.teamTrend[key][i] || 0); }, 0);
        });
      };
      const monthKeyOf = function (date) {
        return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
      };
      const personalCounts = function () {
        return monthStarts.map(function (month) {
          const code = monthKeyOf(month).replace('-', '');
          return st.tasks.filter(function (t) {
            return !t.canceled && !t.draft && t.status === '已完成' &&
              t.owner === st.user.name && t.id.slice(3, 9) === code;
          }).length;
        });
      };
      const chartSeries = [];
      if (role === 'leader' || role === 'super') {
        chartSeries.push({ name: '团队闭环', data: teamCounts(''), color: ['#F28D5E', '#EB612A'] });
      } else if (role === 'manager') {
        chartSeries.push({ name: '我的闭环', data: personalCounts(), color: ['#F6B18A', '#F28D5E'] });
        chartSeries.push({ name: '本组闭环', data: teamCounts(group ? group.id : ''), color: ['#7ED7FF', '#2FA8E8'] });
      } else {
        chartSeries.push({ name: '个人闭环', data: personalCounts(), color: ['#F28D5E', '#EB612A'] });
      }
      const chartMax = Math.max(1, Math.max.apply(null, chartSeries.reduce(function (all, s) { return all.concat(s.data); }, [0])));

      const mineChart = U().chart('myChart', {
        legend: chartSeries.length > 1 ? {
          top: 0, right: 4, itemWidth: 9, itemHeight: 9, itemGap: 12,
          textStyle: { color: '#8A8A8E', fontSize: 10 }
        } : { show: false },
        tooltip: {
          trigger: 'item', backgroundColor: 'rgba(29,29,31,.92)', borderWidth: 0,
          padding: [9, 12], textStyle: { color: '#fff', fontSize: 11 },
          formatter: function (params) {
            return params.marker + params.seriesName + '<br/><b>' + params.value + '</b> 项 · ' + params.name;
          }
        },
        grid: { left: 6, right: 14, top: chartSeries.length > 1 ? 34 : 24, bottom: 4, containLabel: true },
        xAxis: {
          type: 'category', data: monthLabels,
          axisLine: { lineStyle: { color: 'rgba(29,29,31,.10)' } }, axisTick: { show: false },
          axisLabel: { color: '#AEAEB2', fontSize: 10 }
        },
        yAxis: {
          type: 'value', min: 0, minInterval: 1, splitNumber: Math.min(5, Math.max(1, chartMax)),
          splitLine: { lineStyle: { color: 'rgba(29,29,31,.055)', type: 'dashed' } },
          axisLabel: {
            color: '#AEAEB2', fontSize: 9,
            formatter: function (value) { return Number.isInteger(value) ? value : ''; }
          },
          axisLine: { show: false }, axisTick: { show: false }
        },
        series: chartSeries.map(function (item) {
          return {
            name: item.name, type: 'bar', data: item.data, barMaxWidth: chartSeries.length > 1 ? 16 : 22,
            itemStyle: {
              borderRadius: [5, 5, 0, 0],
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: item.color[0] }, { offset: 1, color: item.color[1] }
              ])
            },
            label: {
              show: true, position: 'top', fontSize: 9, color: '#AEAEB2',
              formatter: function (params) { return params.value ? params.value : ''; }
            }
          };
        })
      });
      if (mineChart) {
        mineChart.on('click', function (params) {
          if (!params || params.dataIndex == null) return;
          const scope = {
            '团队闭环': 'team',
            '本组闭环': 'group',
            '我的闭环': 'mine',
            '个人闭环': 'mine'
          }[params.seriesName] || 'mine';
          openMineMonth(params.dataIndex, scope);
        });
      }

      const KPI_STATUS_ORDER = { '审批中': 0, '已挂起': 1, '执行中': 2, '待汇总': 3, '待分发': 4, '计划中': 5 };
      function mineKpiItems(kind) {
        const all = scopeItems(st);
        if (kind === 'done') {
          return all.filter(function (x) { return x.sub.status === '已完成'; }).sort(function (a, b) {
            return String(b.sub.completedAt || '').localeCompare(String(a.sub.completedAt || ''));
          });
        }
        if (kind === 'overdue') {
          return all.filter(function (x) { return U().isOverdue(x.sub); }).sort(function (a, b) {
            return String(a.sub.due || '').localeCompare(String(b.sub.due || ''));
          });
        }
        if (kind === 'open') {
          return all.filter(function (x) { return x.sub.status !== '已完成'; }).sort(function (a, b) {
            const ra = KPI_STATUS_ORDER[a.sub.status] == null ? 9 : KPI_STATUS_ORDER[a.sub.status];
            const rb = KPI_STATUS_ORDER[b.sub.status] == null ? 9 : KPI_STATUS_ORDER[b.sub.status];
            if (ra !== rb) return ra - rb;
            return String(a.sub.due || '').localeCompare(String(b.sub.due || ''));
          });
        }
        return all;
      }

      function overdueDaysOf(sub) {
        const due = new Date(String(sub.due || '').replace(/-/g, '/'));
        const now = new Date(String(D.meta.demoNow || '').replace(/-/g, '/'));
        if (isNaN(due.getTime()) || isNaN(now.getTime())) return 0;
        return Math.max(0, Math.floor((now - due) / 86400000));
      }

      function mineTaskRows(list, opts) {
        const options = opts || {};
        return list.map(function (x) {
          const s = x.sub;
          return '<tr class="mine-kpi-row" data-task="' + U().esc(x.task.id) + '" data-sub="' + U().esc(s.id) + '" data-kpi-status="' + U().esc(s.status) + '" style="cursor:pointer">' +
            '<td><div class="cell-task"><b>' + U().esc(s.name) + '</b><small>' + U().esc(x.task.name) + ' · ' + U().esc(s.id) + '</small></div></td>' +
            '<td>' + U().groupPill(s.group) + '</td>' +
            '<td>' + U().esc(s.owner || '—') + '</td>' +
            '<td>' + U().badge(s.status) + '</td>' +
            '<td class="num" style="white-space:nowrap">' + U().shortDate(s.due) + '</td>' +
            (options.showCompleted ? '<td class="num" style="white-space:nowrap">' + U().esc(s.completedAt || '—') + '</td>' : '') +
            (options.showOverdueDays ? '<td class="num"><span class="text-red">' + overdueDaysOf(s) + ' 天</span></td>' : '') +
            '</tr>';
        }).join('');
      }

      function mineHourRows(list) {
        const records = [];
        list.forEach(function (x) {
          let logs = (ITO.workLogsOf ? ITO.workLogsOf(x.sub) : []).slice().sort(function (a, b) {
            return String(a.date).localeCompare(String(b.date));
          });
          const actual = ITO.actualHoursOf ? ITO.actualHoursOf(x.sub) : 0;
          if (!logs.length && actual > 0) {
            logs = [{ date: String(x.sub.completedAt || x.sub.due || '').slice(0, 10), hours: actual }];
          }
          let cumulative = 0;
          logs.forEach(function (log) {
            cumulative = Math.round((cumulative + (Number(log.hours) || 0)) * 10) / 10;
            records.push({ x: x, log: log, cumulative: cumulative });
          });
        });
        return records.sort(function (a, b) { return String(b.log.date).localeCompare(String(a.log.date)); });
      }

      function mineHoursBody(list) {
        const records = mineHourRows(list);
        const totalActual = Math.round(list.reduce(function (n, x) {
          return n + (ITO.actualHoursOf ? ITO.actualHoursOf(x.sub) : 0);
        }, 0) * 10) / 10;
        const totalBudget = Math.round(list.reduce(function (n, x) { return n + (Number(x.sub.hours) || 0); }, 0) * 10) / 10;
        const remain = Math.max(0, Math.round((totalBudget - totalActual) * 10) / 10);
        const memberScope = role !== 'employee';
        const summary = '<div class="summary-grid" style="margin-bottom:10px">' +
          '<div class="summary-chip"><span class="icon blue">' + U().icon('clock') + '</span><div><b>' + totalActual + ' h</b><span>' + (memberScope ? '成员实际工时合计' : '本人已记录实际工时') + '</span></div></div>' +
          '<div class="summary-chip"><span class="icon">' + U().icon('chart') + '</span><div><b>' + totalBudget + ' h</b><span>任务预算工时</span></div></div>' +
          '<div class="summary-chip"><span class="icon ' + (remain > 0 ? 'yellow' : 'green') + '">' + U().icon('task') + '</span><div><b>' + remain + ' h</b><span>剩余计划工时</span></div></div>' +
          '<div class="summary-chip"><span class="icon green">' + U().icon('check') + '</span><div><b>' + records.length + '</b><span>工时记录条数</span></div></div>' +
        '</div>' +
        '<p class="table-note" style="margin:0 0 12px">' + (memberScope
          ? '以下为团队 / 本组任务执行人填报的实际工时，用于负载与成本统计，不代表当前登录人的个人投入。'
          : '以下为本人任务填报的实际工时。') + '</p>';
        if (!records.length) return summary + U().emptyState('当前周期暂无工时记录', '任务产生工时后会出现在这里', 'clock');
        return summary + '<div class="table-wrap"><table class="data-table"><thead><tr><th>任务</th><th>执行人</th><th>日期</th><th class="num">本次工时</th><th class="num">累计工时</th><th>状态</th></tr></thead><tbody>' +
          records.map(function (r) {
            return '<tr class="mine-kpi-row" data-task="' + U().esc(r.x.task.id) + '" data-sub="' + U().esc(r.x.sub.id) + '" style="cursor:pointer">' +
              '<td><div class="cell-task"><b>' + U().esc(r.x.sub.name) + '</b><small>' + U().esc(r.x.task.name) + ' · ' + U().esc(r.x.sub.id) + '</small></div></td>' +
              '<td>' + U().esc(r.x.sub.owner || '—') + '</td>' +
              '<td class="num">' + U().esc(r.log.date || '—') + '</td>' +
              '<td class="num">' + (Number(r.log.hours) || 0) + ' h</td>' +
              '<td class="num">' + r.cumulative + ' h</td>' +
              '<td>' + U().badge(r.x.sub.status) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      }

      function openMineKpi(kind) {
        const list = mineKpiItems(kind);
        const prefix = role === 'leader' || role === 'super' ? '团队' : (role === 'manager' ? '本组' : '我的');
        const meta = {
          open: { title: prefix + '在办任务', sub: '按执行子任务统计 · 审批中 → 已挂起 → 执行中 · 同类按截止时间升序', empty: '暂无在办任务' },
          done: { title: '已完成任务', sub: '按执行子任务统计 · 验收通过并归档 · 按完成时间倒序', empty: '暂无已完成任务' },
          overdue: { title: '超期任务', sub: '已超过当前演示时间的执行子任务 · 按超期天数排序', empty: '暂无超期任务' },
          hours: { title: prefix + '工时明细', sub: '任务执行人已记录的实际工时 · 用于负载与成本统计', empty: '当前周期暂无工时记录' }
        }[kind];
        let body = '';
        if (kind === 'hours') {
          body = mineHoursBody(list);
        } else {
          const showCompleted = kind === 'done';
          const showOverdue = kind === 'overdue';
          const cols = 5 + (showCompleted || showOverdue ? 1 : 0);
          let filterBar = '';
          if (kind === 'open') {
            const counts = { '审批中': 0, '已挂起': 0, '执行中': 0 };
            list.forEach(function (x) { if (counts[x.sub.status] != null) counts[x.sub.status] += 1; });
            filterBar = '<div class="mine-status-filter" role="group" aria-label="在办状态筛选">' +
              '<button class="active" type="button" data-kpi-filter="all">全部 <b>' + list.length + '</b></button>' +
              ['审批中', '已挂起', '执行中'].map(function (status) {
                return '<button type="button" data-kpi-filter="' + status + '">' + status + ' <b>' + counts[status] + '</b></button>';
              }).join('') +
            '</div>';
          }
          body = filterBar +
            '<div class="table-wrap"><table class="data-table"><thead><tr><th>任务</th><th>专业组</th><th>执行人</th><th>状态</th><th>截止时间</th>' +
            (showCompleted ? '<th>完成时间</th>' : '') + (showOverdue ? '<th>超期</th>' : '') + '</tr></thead><tbody id="mineKpiBody">' +
            (list.length ? mineTaskRows(list, { showCompleted: showCompleted, showOverdueDays: showOverdue }) : '<tr><td colspan="' + cols + '">' + U().emptyState(meta.empty, '当前没有符合条件的任务', 'task') + '</td></tr>') +
            '<tr class="kpi-filter-empty" style="display:none"><td colspan="' + cols + '">' + U().emptyState('该状态下暂无任务', '切换其他状态查看', 'task') + '</td></tr>' +
            '</tbody></table></div>';
        }
        U().modal({
          title: meta.title,
          sub: meta.sub,
          wide: true,
          body: body,
          foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
          onMount: function (close, root) {
            root.querySelector('[data-close]').addEventListener('click', close);
            const filterButtons = root.querySelectorAll('[data-kpi-filter]');
            filterButtons.forEach(function (btn) {
              btn.addEventListener('click', function () {
                const value = btn.dataset.kpiFilter;
                filterButtons.forEach(function (b) { b.classList.toggle('active', b === btn); });
                let visible = 0;
                root.querySelectorAll('#mineKpiBody tr.mine-kpi-row').forEach(function (row) {
                  const show = value === 'all' || row.dataset.kpiStatus === value;
                  row.hidden = !show;
                  if (show) visible += 1;
                });
                const emptyRow = root.querySelector('#mineKpiBody .kpi-filter-empty');
                if (emptyRow) emptyRow.style.display = visible ? 'none' : '';
              });
            });
            root.querySelectorAll('.mine-kpi-row').forEach(function (row) {
              row.addEventListener('click', function () {
                close();
                if (ITO.taskActions && ITO.taskActions.detail) ITO.taskActions.detail(row.dataset.task, row.dataset.sub);
              });
            });
          }
        });
      }

      function openMineMonth(index, scope) {
        if (index == null || !monthStarts[index]) return;
        const month = monthStarts[index];
        const scopeKey = scope || (role === 'leader' || role === 'super' ? 'team' : 'mine');
        const scopeName = scopeKey === 'team' ? '团队'
          : scopeKey === 'group' ? '本组'
          : (role === 'manager' ? '我的' : '个人');
        const code = monthKeyOf(month).replace('-', '');
        const list = st.tasks.filter(function (t) {
          if (t.canceled || t.draft || t.status !== '已完成') return false;
          if (t.id.slice(3, 9) !== code) return false;
          if (scopeKey === 'group') return !!group && t.group === group.id;
          if (scopeKey === 'mine') return t.owner === st.user.name;
          return true;
        }).sort(function (a, b) {
          return String(b.completedAt || '').localeCompare(String(a.completedAt || ''));
        });
        const rows = list.map(function (t) {
          return '<tr class="mine-kpi-row" data-task="' + U().esc(t.id) + '" style="cursor:pointer">' +
            '<td><div class="cell-task"><b>' + U().esc(t.name) + '</b><small>' + U().esc(t.id) + '</small></div></td>' +
            '<td>' + U().groupPill(t.group) + '</td>' +
            '<td>' + U().esc(t.owner || '—') + '</td>' +
            '<td class="num">' + U().esc(t.completedAt || '—') + '</td>' +
            '<td><span class="badge green">主任务</span></td></tr>';
        }).join('');
        U().modal({
          title: scopeName + '闭环 · ' + monthLabels[index],
          sub: month.getFullYear() + ' 年 ' + (month.getMonth() + 1) + ' 月 · 共 ' + list.length + ' 项主任务 · 按任务所属月份',
          wide: true,
          body: rows ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>任务</th><th>专业组</th><th>负责人</th><th>完成时间</th><th>类型</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : U().emptyState('该月暂无闭环任务', '任务完成后会出现在这里', 'task'),
          foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
          onMount: function (close, root) {
            root.querySelector('[data-close]').addEventListener('click', close);
            root.querySelectorAll('.mine-kpi-row').forEach(function (row) {
              row.addEventListener('click', function () {
                close();
                if (ITO.taskActions && ITO.taskActions.detail) ITO.taskActions.detail(row.dataset.task);
              });
            });
          }
        });
      }

      U().$$('[data-mine-kpi]').forEach(function (card) {
        card.addEventListener('click', function () { openMineKpi(card.dataset.mineKpi); });
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMineKpi(card.dataset.mineKpi); }
        });
      });
      // 分页与行内操作（section 级事件委托，翻页重渲染后依然有效）；筛选就地更新
      const isLead = st.role === 'manager' || st.role === 'leader' || st.role === 'super';
      const isLeader = st.role === 'leader' || st.role === 'super';
      const bs = st.ui.mineBlockSearch = st.ui.mineBlockSearch || { managed: '', subtasks: '', regular: '' };
      const bf = mineBlockFilters(st);

      function rebuildTasks() {
        if (!isLead) {
          const rows = mineUnifiedList(st);
          const page = pageSlice('subtasks', rows, PAGE_SIZE);
          const body = document.getElementById('myTbody');
          if (body) body.innerHTML = unifiedRows(page.list) || '<tr><td colspan="7">' + U().emptyState('没有匹配的任务', '调整搜索或筛选条件', 'task') + '</td></tr>';
          const count = document.getElementById('mineUnifiedCount');
          if (count) count.textContent = rows.length + ' 项';
          const box = document.getElementById('subtasksPager');
          if (box) box.innerHTML = page.pager;
        } else {
          const q = (bs.subtasks || '').trim().toLowerCase();
          const subs = myItems().filter(function (x) {
            return !q || [x.sub.name, x.sub.id, x.task.name].join(' ').toLowerCase().indexOf(q) > -1;
          });
          const page = pageSlice('subtasks', subs, PAGE_SIZE);
          const body = document.getElementById('myTbody');
          if (body) body.innerHTML = subRows(page.list) || '<tr><td colspan="9">' + U().emptyState(q ? '没有匹配的任务' : '暂无分配到我的任务', q ? '调整搜索关键词' : '主管派发后会出现在这里', 'task') + '</td></tr>';
          const box = document.getElementById('subtasksPager');
          if (box) box.innerHTML = page.pager;
        }
      }
      function rebuildManaged() {
        const rows = isLead ? mineManagedList(st) : managedList(st);
        const page = pageSlice('managed', rows, PAGE_SIZE);
        const body = document.getElementById('managedBody');
        if (body) body.innerHTML = managedRows(page.list) || '<tr><td colspan="10">' + U().emptyState(isLeader ? '暂无团队任务' : '暂无我管理的任务', '任务创建后会出现在这里', 'task') + '</td></tr>';
        const count = document.getElementById('managedCount');
        if (count) count.textContent = rows.length + ' 项 · 按主任务';
        const box = document.getElementById('managedPager');
        if (box) box.innerHTML = page.pager;
      }
      function rebuildRegular() {
        if (!isLead) return;
        const plans = mineRegularItems(st);
        const page = pageSlice('regular', plans, PAGE_SIZE);
        const body = document.getElementById('regularBody');
        if (body) body.innerHTML = planRows(page.list, !isLeader, st) || '<tr><td colspan="' + (isLeader ? 6 : 7) + '">' + U().emptyState('暂无常规任务', '巡检 / 维保 / 值班任务会出现在这里', 'clipboard') + '</td></tr>';
        const count = document.getElementById('regularCount');
        if (count) count.textContent = plans.length + ' 项';
        const box = document.getElementById('regularPager');
        if (box) box.innerHTML = page.pager;
      }


      /* ── 各任务块搜索（就地更新，保焦点） + 工具栏筛选 / 重置 ── */
      function blockSearchBindings() {
        [['msManaged', 'managed', 'managed'], ['msSubtasks', 'subtasks', 'subtasks'], ['msRegular', 'regular', 'regular']].forEach(function (pair) {
          const input = document.getElementById(pair[0]);
          if (!input) return;
          input.addEventListener('input', function () {
            bs[pair[1]] = input.value;
            if (pair[2]) ITO.pagerState[pair[2]] = 1;
            if (pair[1] === 'managed') rebuildManaged();
            else if (pair[1] === 'subtasks') rebuildTasks();
            else if (pair[1] === 'regular') rebuildRegular();
          });
        });
      }
      blockSearchBindings();
      /* ── 各任务块筛选 + 重置（独立生效，就地更新） ── */
      const blockFilters = [
        { block: 'managed', selects: [['mfManagedStatus', 'status'], ['mfManagedLevel', 'level'], ['mfManagedAge', 'age']], reset: 'rsManaged', search: 'msManaged', rebuild: rebuildManaged, pager: 'managed' },
        { block: 'subtasks', selects: [['mfSubType', 'type'], ['mfSubStatus', 'status'], ['mfSubLevel', 'level'], ['mfSubAge', 'age']], reset: 'rsSubtasks', search: 'msSubtasks', rebuild: rebuildTasks, pager: 'subtasks' },
        { block: 'regular', selects: [['mfRegularStatus', 'status'], ['mfRegularAge', 'age']], reset: 'rsRegular', search: 'msRegular', rebuild: rebuildRegular, pager: 'regular' }
      ];
      blockFilters.forEach(function (cfg) {
        const f = bf[cfg.block];
        cfg.selects.forEach(function (pair) {
          const el = document.getElementById(pair[0]);
          if (el) el.addEventListener('change', function () {
            f[pair[1]] = el.value;
            if (cfg.pager) ITO.pagerState[cfg.pager] = 1;
            cfg.rebuild();
          });
        });
        const resetBtn = document.getElementById(cfg.reset);
        if (resetBtn) resetBtn.addEventListener('click', function () {
          Object.keys(f).forEach(function (k) { f[k] = ''; });
          const searchEl = document.getElementById(cfg.search);
          if (searchEl) { searchEl.value = ''; bs[cfg.block] = ''; }
          cfg.selects.forEach(function (pair) {
            const el = document.getElementById(pair[0]);
            if (el) { el.value = ''; if (el.__syncPicker) el.__syncPicker(); }
          });
          if (cfg.pager) ITO.pagerState[cfg.pager] = 1;
          cfg.rebuild();
        });
      });

      /* ── 我的任务行点击 → 值班表 / 任务详情 ── */
      const managedSec = document.getElementById('sec-managed');
      if (managedSec) {
        managedSec.addEventListener('click', function (e) {
          const pagerBtn = e.target.closest('[data-pager]');
          if (pagerBtn) {
            if (!pagerBtn.disabled) { ITO.pagerState.managed = Number(pagerBtn.dataset.page); rebuildManaged(); }
            return;
          }
          const re = e.target.closest('[data-my-reassign]');
          if (re) { ITO.taskActions.reassign(re.dataset.myReassign); return; }
          const de = e.target.closest('[data-my-detail]');
          if (de) { ITO.taskActions.detail(de.dataset.myDetail); return; }
          const row = e.target.closest('[data-detail-task]');
          if (row && !e.target.closest('button, a')) ITO.taskActions.detail(row.dataset.detailTask);
        });
      }
      const subSec = document.getElementById('sec-subtasks');
      if (subSec) {
        subSec.addEventListener('click', function (e) {
          const pagerBtn = e.target.closest('[data-pager]');
          if (pagerBtn) {
            if (!pagerBtn.disabled) { ITO.pagerState.subtasks = Number(pagerBtn.dataset.page); rebuildSubs(); }
            return;
          }
          const dutyBtn = e.target.closest('[data-my-handover]');
          if (dutyBtn) { ITO.openHandover(dutyBtn.dataset.myHandover); return; }
          const dutyView = e.target.closest('[data-duty-view]');
          if (dutyView) { if (ITO.openDutySheet) ITO.openDutySheet(dutyView.dataset.dutyView); return; }
          const dutyRow = e.target.closest('tr[data-duty-week]');
          if (dutyRow && !e.target.closest('button, a')) { if (ITO.openDutySheet) ITO.openDutySheet(dutyRow.dataset.dutyWeek); return; }
          const prow = e.target.closest('[data-plan-task]');
          if (prow && !e.target.closest('a, button')) { if (ITO.openPlanDetail) ITO.openPlanDetail(prow.dataset.planTask); return; }
          const btn = e.target.closest('[data-act]');
          if (btn) { ITO.taskActions.run(btn.dataset.act, btn.dataset.task, btn.dataset.sub); return; }
          const srow = e.target.closest('tr[data-subrow-task]');
          if (srow && !e.target.closest('button, a')) ITO.taskActions.run('detail-sub', srow.dataset.subrowTask, srow.dataset.subrowSub);
        });
      }
      const regSec = document.getElementById('sec-regular');
      if (regSec) {
        regSec.addEventListener('click', function (e) {
          const pagerBtn = e.target.closest('[data-pager]');
          if (pagerBtn && !pagerBtn.disabled) { ITO.pagerState.regular = Number(pagerBtn.dataset.page); rebuildRegular(); return; }
          const dutyBtn = e.target.closest('[data-my-handover]');
          if (dutyBtn) { ITO.openHandover(dutyBtn.dataset.myHandover); return; }
          const dutyView = e.target.closest('[data-duty-view]');
          if (dutyView) { if (ITO.openDutySheet) ITO.openDutySheet(dutyView.dataset.dutyView); return; }
          const dutyRow = e.target.closest('tr[data-duty-week]');
          if (dutyRow && !e.target.closest('button, a')) { if (ITO.openDutySheet) ITO.openDutySheet(dutyRow.dataset.dutyWeek); return; }
          const prow = e.target.closest('[data-plan-task]');
          if (prow && !e.target.closest('a, button')) {
            if (ITO.openPlanDetail) ITO.openPlanDetail(prow.dataset.planTask);
          }
        });
      }

      // 锚点导航：点击平滑滚动 + 滚动高亮当前区
      const nav = document.getElementById('mineAnchorNav');
      if (nav) {
        let pinnedUntil = 0;
        const setActive = function (key) {
          const navNow = document.getElementById('mineAnchorNav');
          if (!navNow) return;
          Array.prototype.forEach.call(navNow.querySelectorAll('[data-anchor]'), function (b) {
            b.classList.toggle('active', b.dataset.anchor === key);
          });
        };
        nav.addEventListener('click', function (e) {
          const btn = e.target.closest('[data-anchor]');
          if (!btn) return;
          const sec = document.getElementById('sec-' + btn.dataset.anchor);
          if (!sec) return;
          setActive(btn.dataset.anchor);
          pinnedUntil = Date.now() + 900;
          const stickTop = parseFloat(getComputedStyle(nav).top) || 72;
          const y = sec.getBoundingClientRect().top + (window.scrollY || 0) - (stickTop + nav.offsetHeight + 12);
          window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        });
        const spy = function () {
          const navNow = document.getElementById('mineAnchorNav');
          if (!navNow) return;
          const stickTop = parseFloat(getComputedStyle(navNow).top) || 72;
          navNow.classList.toggle('is-stuck', navNow.getBoundingClientRect().top <= stickTop + 1);
          if (Date.now() < pinnedUntil) return;
          const btns = Array.prototype.slice.call(navNow.querySelectorAll('[data-anchor]'));
          let current = btns.length ? btns[0].dataset.anchor : null;
          const atBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 2);
          if (atBottom) current = btns.length ? btns[btns.length - 1].dataset.anchor : current;
          else {
            btns.forEach(function (b) {
              const sec = document.getElementById('sec-' + b.dataset.anchor);
              if (sec && sec.getBoundingClientRect().top <= 180) current = b.dataset.anchor;
            });
          }
          btns.forEach(function (b) { b.classList.toggle('active', b.dataset.anchor === current); });
        };
        if (!window.__mineSpyBound) {
          window.addEventListener('scroll', function () { if (window.__mineSpyFn) window.__mineSpyFn(); }, { passive: true });
          window.addEventListener('resize', function () { if (window.__mineSpyFn) window.__mineSpyFn(); });
          window.__mineSpyBound = true;
        }
        window.__mineSpyFn = spy;
        spy();
      }

      const exp = document.getElementById('myExportBtn');
      if (exp) exp.addEventListener('click', function () {
        const scope = st.role === 'leader' || st.role === 'super' ? '团队' : (st.role === 'manager' ? '本组' : '我的');
        const myItemsNow = scopeItems(st);
        const rows = [['任务编号', '任务', '主任务', '专业组', '执行人', '状态', '截止时间', '成果物数量', '成果物文件', '提交版本']];
        myItemsNow.forEach(function (x) {
          const rec = window.DeliverableStore ? window.DeliverableStore.getLatestSubmission(x.sub.id) : null;
          rows.push([
            x.sub.id, x.sub.name, x.task.name, (ITO.getGroup(x.sub.group) || {}).name, x.sub.owner, x.sub.status, x.sub.due,
            rec ? rec.files.length : 0,
            rec ? rec.files.map(function (f) { return f.name; }).join(' / ') : '',
            rec ? 'v' + rec.version : ''
          ]);
        });
        U().exportPreview({ title: scope + '任务导出预览', rows: rows, filename: 'ITO' + scope + '任务-' + st.user.name + '.csv' });
        ITO.log('导出' + scope + '任务', st.user.name + ' · ' + myItemsNow.length + ' 项', '任务');
        U().toast(scope + '任务已导出');
      });
    }
  };
})();
