/* ─────────────────────────────────────────────
   pages · dispatch & my tasks
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const P = (window.ITO_PAGES = window.ITO_PAGES || {});
  const D = window.ITO_DATA;

  function S() { return ITO.state; }
  function U() { return ITO.ui; }

  function queue() {
    const st = S();
    const dispatch = [];
    const approval = [];
    const leader = [];
    const summary = [];
    st.tasks.forEach(function (t) {
      if (t.canceled || t.draft) return;
      t.subs.forEach(function (s) {
        if (s.status === '待分发') dispatch.push({ task: t, sub: s });
        if (s.status === '审批中' || s.status === '已挂起') approval.push({ task: t, sub: s });
      });
      const la = t.leaderApproval;
      if (t.source === 'leader' && la) {
        if (la.status === '待汇总' || la.status === '已驳回') summary.push({ task: t });
        if (la.status === '审批中' || la.status === '已挂起') leader.push({ task: t });
      }
    });
    return { dispatch: dispatch, approval: approval, leader: leader, summary: summary };
  }

  const DISPATCH_QUEUES = [
    { key: 'dispatch', name: '待分发', hint: '选择执行人 · 派发后进入执行中', mode: 'dispatch', bodyId: 'dispatchCol', empty: ['没有待分发任务', '所有子任务都已派发', 'send'] },
    { key: 'approval', name: '负责人审批', hint: '审核成果物 · 驳回退回执行中', mode: 'approve', bodyId: 'approvalCol', empty: ['没有待审批任务', '负责人审批队列已清空', 'shield'] },
    { key: 'leader', name: '领导审批', hint: '大任务已完成 · 不影响闭环', mode: 'leader', bodyId: 'leaderCol', empty: ['没有待领导审批', '领导下发任务完成后会出现在这里', 'check'] },
    { key: 'summary', name: '待汇总报审', hint: '负责人汇总后提交领导', mode: 'summary', bodyId: 'summaryCol', empty: ['没有待汇总任务', '子任务全部完成后可汇总报审', 'clipboard'] }
  ];
  const QUEUE_PAGE_SIZE = 10;

  function card(item, mode) {
    const t = item.task;
    const s = item.sub;
    const over = s ? U().isOverdue(s) : false;
    const ap = s ? s.approval : null;
    const la = t.leaderApproval;
    const status = s ? s.status : U().displayStatus(t);
    const readOnly = S().role === 'leader' && !ITO.isSuper();
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
    if ((readOnly && mode !== 'leader') || (mode === 'leader' && !ITO.roleIs('leader'))) {
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
        sub: '待分发、负责人审批、领导审批与汇总报审 · 当前 ' + total + ' 项待处理',
        actions: '<button class="btn btn-primary" id="dispatchNewTask" type="button">' + U().icon('plus') + '新建任务</button>' +
          '<button class="btn btn-ghost" id="queueExportBtn" type="button">' + U().icon('download') + '导出队列</button>'
      }) +
      U().taskTabs('dispatch') +
      '<div class="dispatch-overview">' +
        '<div class="summary-chip"><span class="icon">' + U().icon('send') + '</span><div><b>' + q.dispatch.length + '</b><span>待分发</span></div></div>' +
        '<div class="summary-chip"><span class="icon blue">' + U().icon('shield') + '</span><div><b>' + q.approval.length + '</b><span>负责人审批</span></div></div>' +
        '<div class="summary-chip"><span class="icon purple">' + U().icon('check') + '</span><div><b>' + q.leader.length + '</b><span>领导审批</span></div></div>' +
        '<div class="summary-chip"><span class="icon green">' + U().icon('clipboard') + '</span><div><b>' + q.summary.length + '</b><span>待汇总报审</span></div></div>' +
      '</div>' +
      '<div class="dispatch-grid four">' +
        DISPATCH_QUEUES.map(function (def) {
          const list = q[def.key];
          const pages = Math.max(1, Math.ceil(list.length / QUEUE_PAGE_SIZE));
          const pageNum = Math.min(Math.max(1, ITO.pagerState['q-' + def.key] || 1), pages);
          ITO.pagerState['q-' + def.key] = pageNum;
          const bodyCards = list.length
            ? list.slice((pageNum - 1) * QUEUE_PAGE_SIZE, pageNum * QUEUE_PAGE_SIZE).map(function (x) { return card(x, def.mode); }).join('')
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
          const list = queue()[key];
          const pages = Math.max(1, Math.ceil(list.length / QUEUE_PAGE_SIZE));
          const pageNum = Math.min(Math.max(1, Number(pagerBtn.dataset.page) || 1), pages);
          ITO.pagerState['q-' + key] = pageNum;
          const body = col.querySelector('.dispatch-body');
          if (body) body.innerHTML = list.length
            ? list.slice((pageNum - 1) * QUEUE_PAGE_SIZE, pageNum * QUEUE_PAGE_SIZE).map(function (x) { return card(x, def.mode); }).join('')
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
        const rows = [['队列', '主任务编号', '主任务', '子任务编号', '子任务', '专业组', '负责人', '执行人', '截止时间', '授权', '开票', '审批状态']];
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

  function planTasksOf(st) {
    return (st.planTasks || []).filter(function (t) { return t.executor === st.user.name; });
  }

  function planRows(list) {
    return list.map(function (t) {
      return '<tr data-plan-task="' + U().esc(t.id) + '">' +
        '<td><div class="cell-task"><b>' + U().esc(t.name) + '</b><small>' + U().esc(t.source + ' · ' + t.planId) + '</small></div></td>' +
        '<td>' + U().groupPill(t.group) + '</td>' +
        '<td class="num">' + (t.hours || 0) + ' h</td>' +
        '<td class="num" style="white-space:nowrap">' + U().shortDate(t.due) + '</td>' +
        '<td>' + U().badge(t.status) + '</td>' +
        '<td style="text-align:right"><a class="btn btn-ghost btn-sm" href="#/' + (t.planType === 'inspection' ? 'inspection' : 'maintenance') + '">去执行</a></td></tr>';
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
      return '<tr data-subrow-task="' + x.task.id + '" data-subrow-sub="' + s.id + '" style="cursor:pointer">' +
        '<td><div class="cell-task"><b>' + U().esc(s.name) + '</b><small>' + s.id + ' · ' + U().esc(x.task.name) + '</small></div></td>' +
        '<td>' + U().groupPill(s.group) + '</td>' +
        '<td>' + U().badge(s.status) + '</td>' +
        '<td class="num" style="white-space:nowrap">' + U().shortDate(s.due) + (U().isOverdue(s) ? ' <span class="text-red">超期</span>' : '') + '</td>' +
        '<td>' + (rec && rec.files.length ? '<span class="muted">v' + rec.version + ' · ' + rec.files.length + ' 个</span>' : '<span class="muted">—</span>') + '</td>' +
        '<td><div class="row-actions">' + (acts || '<span class="muted">—</span>') + '</div></td>' +
      '</tr>';
    }).join('');
  }

  function managedList(st) {
    const map = {};
    st.tasks.forEach(function (t) {
      if (t.canceled || t.draft) return;
      const launchedByMe = t.initiator === st.user.name;
      const ownedByMe = t.owner === st.user.name;
      if (!launchedByMe && !ownedByMe) return;
      map[t.id] = { task: t, source: launchedByMe && ownedByMe ? 'both' : launchedByMe ? 'launched' : 'own' };
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function managedRows(slice) {
    const sourceLabel = {
      launched: '<span class="badge blue">我发起</span>',
      own: '<span class="badge green">我负责</span>',
      both: '<span class="badge purple">发起+负责</span>'
    };
    return slice.map(function (x) {
      const t = x.task;
      return '<tr data-detail-task="' + t.id + '" style="cursor:pointer">' +
        '<td><div class="cell-task"><b>' + U().esc(t.name) + '</b><small>' + U().esc(t.id + ' · ' + t.type) + '</small></div></td>' +
        '<td>' + sourceLabel[x.source] + '</td>' +
        '<td>' + U().groupPill(t.group) + '</td>' +
        '<td>' + U().esc(t.owner) + '</td>' +
        '<td>' + U().esc(t.initiator) + '</td>' +
        '<td>' + U().badge(U().displayStatus(t)) + '</td>' +
        '<td class="num" style="white-space:nowrap">' + U().shortDate(t.due) + '</td>' +
        '<td style="text-align:right"><div class="row-actions">' +
          (x.source !== 'launched' ? '<button class="btn btn-ghost btn-sm" type="button" data-my-reassign="' + t.id + '">改派</button>' : '<span class="muted">—</span>') +
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
      const items = myItems();
      const open = items.filter(function (x) { return x.sub.status !== '已完成'; });
      const done = items.filter(function (x) { return x.sub.status === '已完成'; });
      const approval = items.filter(function (x) { return x.sub.status === '审批中' || x.sub.status === '已挂起'; });
      const hours = items.reduce(function (n, x) { return n + (x.sub.hours || 0); }, 0);
      const me = st.staff.find(function (p) { return p.name === st.user.name; });
      const myGroup = me ? st.groups.find(function (g) { return g.id === me.group; }) : null;
      const tags = (st.personAchievements || []).filter(function (a) { return a.person === st.user.name; }).map(function (a) {
        if (a.type !== '人员标签') return Object.assign({}, a, { stars: 0 });
        const wall = (st.wallTags || []).find(function (t) { return t.name === a.name && t.type === '人员标签'; });
        return Object.assign({}, a, { stars: a.source === '授权' ? 3 : U().starForCount(a.count, wall && wall.star2, wall && wall.star3) });
      });
      const wallList = tags.filter(function (a) {
        return a.type === '人员标签' ? a.source !== '授权' : true;
      });
      const auths = st.auths.filter(function (a) { return a.person === st.user.name; });
      const handovers = ITO.dutyHandovers().filter(function (h) {
        return h.person === st.user.name || (h.incoming === st.user.name && h.status !== '待提交');
      });
      const dutyActors = ITO.canSwitchDutyActor() ? Array.from(new Set(
        [st.user.name].concat(ITO.dutyHandovers().flatMap(function (h) { return [h.person, h.incoming]; }))
      )) : [];
      const dutyActorPicker = dutyActors.length ? '<label>演示值班身份 <select id="dutyActor" class="select">' +
        dutyActors.map(function (name) {
          return '<option' + (name === st.user.name ? ' selected' : '') + '>' + U().esc(name) + '</option>';
        }).join('') + '</select></label>' : '';
      const isLead = st.role === 'manager' || st.role === 'leader' || st.role === 'super';
      const showPersonalBadges = st.role === 'employee' || st.role === 'manager';
      const showPersonalAuth = showPersonalBadges;
      const planTasks = planTasksOf(st);
      const managed = managedList(st);
      const PAGE_SIZE = 10;
      const managedPage = pageSlice('managed', managed, PAGE_SIZE);
      const subPage = pageSlice('subtasks', items, PAGE_SIZE);
      const regPage = pageSlice('regular', planTasks, PAGE_SIZE);
      const anchors = [];
      if (isLead) anchors.push({ key: 'managed', label: '我管理的任务' });
      if (!isLead || items.length) anchors.push({ key: 'subtasks', label: '我的子任务' });
      anchors.push({ key: 'regular', label: '我的常规任务' });
      if (handovers.length || dutyActorPicker) anchors.push({ key: 'handover', label: '值班交接' });
      const anchorNav = anchors.length
        ? '<nav class="anchor-nav" id="mineAnchorNav" aria-label="页内导航">' + anchors.map(function (a) {
            return '<button type="button" data-anchor="' + a.key + '">' + a.label + '</button>';
          }).join('') + '</nav>'
        : '';

      return U().pageHead({
        title: '我的任务',
        sub: st.user.name + '，' + greet() + ' · ' + (myGroup ? myGroup.name + ' · ' : '') + st.user.title,
        actions:
          (ITO.isSuper() || ITO.roleIs('manager', 'leader')
            ? '<a class="btn btn-ghost" href="#/tasks">' + U().icon('task') + '任务管理</a>'
            : '') +
          '<button class="btn btn-primary" id="myExportBtn" type="button">' + U().icon('download') + '导出我的任务</button>'
      }) +

      '<div class="kpi-grid mine-kpis">' +
        '<article class="card kpi-card"><div class="kpi-label">' + U().icon('task') + '<span>我的在办</span></div><div class="kpi-value">' + open.length + '<span class="unit">项</span></div><div class="kpi-meta"><span>含 ' + approval.length + ' 项审批中</span></div></article>' +
        '<article class="card kpi-card" data-tone="green"><div class="kpi-label">' + U().icon('check') + '<span>已完成</span></div><div class="kpi-value">' + done.length + '<span class="unit">项</span></div><div class="kpi-meta"><span>验收通过并归档</span></div></article>' +
        '<article class="card kpi-card" data-tone="red"><div class="kpi-label">' + U().icon('clock') + '<span>超期子任务</span></div><div class="kpi-value">' + items.filter(function (x) { return U().isOverdue(x.sub); }).length + '<span class="unit">项</span></div><div class="kpi-meta"><span>需优先处理</span></div></article>' +
        '<article class="card kpi-card" data-tone="blue"><div class="kpi-label">' + U().icon('chart') + '<span>投入工时</span></div><div class="kpi-value">' + hours + '<span class="unit">h</span></div><div class="kpi-meta"><span>本周期任务预算工时</span></div></article>' +
      '</div>' +

      anchorNav +

      '<div class="mine-stack">' +
        (showPersonalBadges ? '<section class="card mini-card">' +
          '<div class="mini-head"><h3>我的属性勋章</h3><span class="table-note">' + wallList.length + ' 项</span></div>' +
          '<div class="medal-wall">' +
            (wallList.length ? wallList.map(function (a) {
              const isPerson = a.type === '人员标签';
              const stars = a.stars || 0;
              const note = isPerson ? '累计 ' + a.count + ' 次' + (a.firstClaimed ? ' · 首次 ' + a.firstClaimed : '') : '任务标签 · 累计 ' + a.count + ' 次';
              return '<div class="medal-card' + (!isPerson ? ' is-task' : '') + '">' +
                '<div class="medal-icon">' + U().esc(a.name.slice(0, 1)) + '</div>' +
                '<b>' + U().esc(a.name) + '</b>' +
                (isPerson ? '<div class="medal-stars">' + '★'.repeat(stars) + '<span class="medal-star-off">' + '★'.repeat(3 - stars) + '</span></div>' : '<div class="medal-kind">任务标签</div>') +
                '<div class="medal-note">' + U().esc(note) + '</div>' +
              '</div>';
            }).join('') : '<div class="mini-empty">暂无属性勋章</div>') +
          '</div>' +
        '</section>' : '') +
        (showPersonalAuth ? '<section class="card mini-card">' +
          '<div class="mini-head"><h3>我的作业授权</h3><a href="#/auth">授权中心' + U().icon('arrow') + '</a></div>' +
          '<div class="mini-list">' +
            (auths.length ? auths.map(function (a) {
              const { status, left } = a.status === '已撤销' ? a : ITO.authStatus(a.validTo);
              const dot = status === '有效' ? 'var(--green)' : status === '临期' ? 'var(--yellow)' : 'var(--red)';
              const remaining = status === '临期' ? ' · 剩余 ' + left + ' 天' : '';
              return '<div class="mini-row"><span class="dot" style="background:' + dot + '"></span>' +
                '<div class="txt"><b>' + U().esc(a.type) + '</b><span>' + U().esc(a.scope) + ' · 至 ' + a.validTo + remaining + '</span></div>' +
                U().badge(status) + '</div>';
            }).join('') : '<div class="mini-empty">暂无授权记录</div>') +
          '</div>' +
        '</section>' : '') +

      '<section class="card chart-card">' +
        '<div class="chart-head"><div><h3 class="chart-title">个人闭环趋势</h3><p class="chart-sub">近 5 个月验收通过的任务数 · 数据来自任务归档</p></div>' +
          '<span class="head-tag">PERSONAL</span></div>' +
        '<div class="chart-body" id="myChart"></div>' +
      '</section>' +

      (isLead
        ? '<section class="card table-card" id="sec-managed" data-mine-section>' +
            '<div class="table-head"><div><h3>我管理的任务</h3><p class="table-note">我发起或由我负责的任务 · 已按任务去重</p></div>' +
              '<span class="table-note">' + managed.length + ' 项</span></div>' +
            '<div class="table-wrap"><table class="data-table"><thead><tr><th>任务</th><th>来源</th><th>专业组</th><th>负责人</th><th>发起人</th><th>状态</th><th>截止时间</th><th style="text-align:right">操作</th></tr></thead>' +
            '<tbody id="managedBody">' + (managedRows(managedPage.list) || '<tr><td colspan="8">' + U().emptyState('暂无我管理的任务', '新建任务或作为负责人后会出现在这里', 'task') + '</td></tr>') + '</tbody></table></div>' +
            (managed.length ? '<div id="managedPager">' + managedPage.pager + '</div>' : '') +
          '</section>'
        : '') +

      ((!isLead || items.length)
        ? '<section class="card table-card" id="sec-subtasks" data-mine-section>' +
            '<div class="table-head"><div><h3>我的子任务</h3><p class="table-note">接收、执行并提交成果物，全部子任务完成后主任务自动闭环</p></div>' +
              '<span class="table-note">' + items.length + ' 项</span></div>' +
            '<div class="table-wrap"><table class="data-table"><thead><tr><th>子任务</th><th>专业组</th><th>状态</th><th>截止时间</th><th>成果物</th><th style="text-align:right">操作</th></tr></thead>' +
            '<tbody id="myTbody">' + (subRows(subPage.list) || '<tr><td colspan="6">' + U().emptyState('暂无分配到我的任务', '主管派发后会出现在这里', 'task') + '</td></tr>') + '</tbody></table></div>' +
            (items.length ? '<div id="subtasksPager">' + subPage.pager + '</div>' : '') +
          '</section>'
        : '') +

      '<section class="card table-card" id="sec-regular" data-mine-section>' +
        '<div class="table-head"><div><h3>我的常规任务</h3><p class="table-note">巡检 / 维保计划同步到执行人的常规任务</p></div>' +
          '<span class="table-note">' + planTasks.length + ' 项</span></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>任务</th><th>专业组</th><th>标准工时</th><th>截止时间</th><th>状态</th><th style="text-align:right">操作</th></tr></thead>' +
        '<tbody id="regularBody">' + (planRows(regPage.list) || '<tr><td colspan="6">' + U().emptyState('暂无常规任务', '巡检 / 维保计划同步后会出现在这里', 'clipboard') + '</td></tr>') + '</tbody></table></div>' +
        (planTasks.length ? '<div id="regularPager">' + regPage.pager + '</div>' : '') +
      '</section>' +

      (handovers.length || dutyActorPicker
        ? '<section class="card table-card" id="sec-handover" data-mine-section>' +
            '<div class="table-head"><div><h3>我的值班交接</h3><p class="table-note">接班人由下一班排班自动带出 · 周一 08:00 交接</p></div>' + dutyActorPicker + '</div>' +
            '<div class="table-wrap"><table class="data-table"><thead><tr><th>班次</th><th>交接人</th><th>接班人</th><th>交接记录</th><th>状态</th><th style="text-align:right">操作</th></tr></thead><tbody>' +
            (handovers.length ? handovers.map(function (h) {
              const action = h.person === st.user.name && h.status === '待提交' ? '<button class="btn btn-primary btn-sm" type="button" data-my-handover="' + U().esc(h.week.key) + '">提交交接</button>' :
                h.incoming === st.user.name && h.status === '待接班确认' ? '<button class="btn btn-primary btn-sm" type="button" data-my-handover="' + U().esc(h.week.key) + '">确认接班</button>' : '';
              const recordShort = h.record ? (h.record.length > 42 ? h.record.slice(0, 42) + '…' : h.record) : '';
              return '<tr>' +
                '<td><div class="cell-task"><b>第 ' + h.week.weekNo + ' 周</b><small>' + U().esc(h.week.start + ' ~ ' + h.week.end) + '</small></div></td>' +
                '<td>' + U().esc(h.person) + '</td>' +
                '<td>' + U().esc(h.incoming) + '</td>' +
                '<td class="muted" style="max-width:260px">' + (recordShort ? '<span title="' + U().esc(h.record) + '">' + U().esc(recordShort) + '</span>' : '<span class="muted">—</span>') + '</td>' +
                '<td>' + U().badge(h.status) + '</td>' +
                '<td style="text-align:right"><div class="row-actions">' + (action || '<span class="muted">—</span>') + '</div></td></tr>';
            }).join('') : '<tr><td colspan="6">' + U().emptyState('暂无待交接记录', '轮到值班周时这里会出现交接任务', 'clock') + '</td></tr>') +
            '</tbody></table></div>' +
          '</section>'
        : '') +
      '</div>';
    },

    after: function () {
      const st = S();
      const PAGE_SIZE = 10;
      const dutyActor = document.getElementById('dutyActor');
      if (dutyActor) dutyActor.addEventListener('change', function () { ITO.switchDutyActor(dutyActor.value); });
      U().$$('[data-my-handover]').forEach(function (button) {
        button.addEventListener('click', function () { ITO.openHandover(button.dataset.myHandover); });
      });
      const monthBase = new Date(D.meta.today.replace(/-/g, '/'));
      const monthLabels = [];
      const monthStarts = [];
      for (let i = 4; i >= 0; i -= 1) {
        const d = new Date(monthBase.getFullYear(), monthBase.getMonth() - i, 1);
        monthStarts.push(d);
        monthLabels.push((d.getMonth() + 1) + ' 月');
      }
      const monthCounts = monthStarts.map(function (month) {
        const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
        return st.tasks.reduce(function (count, task) {
          return count + task.subs.filter(function (sub) {
            return sub.owner === st.user.name && sub.status === '已完成' &&
              sub.completedAt && new Date(sub.completedAt.replace(/-/g, '/')) >= month &&
              new Date(sub.completedAt.replace(/-/g, '/')) < next;
          }).length;
        }, 0);
      });

      U().chart('myChart', {
        tooltip: {
          trigger: 'axis', backgroundColor: 'rgba(29,29,31,.92)', borderWidth: 0,
          padding: [9, 12], textStyle: { color: '#fff', fontSize: 11 },
          formatter: '{b}<br/>闭环 {c} 项'
        },
        grid: { left: 6, right: 14, top: 24, bottom: 4, containLabel: true },
        xAxis: {
          type: 'category', data: monthLabels,
          axisLine: { lineStyle: { color: 'rgba(29,29,31,.10)' } }, axisTick: { show: false },
          axisLabel: { color: '#AEAEB2', fontSize: 10 }
        },
        yAxis: {
          type: 'value', splitLine: { lineStyle: { color: 'rgba(29,29,31,.055)', type: 'dashed' } },
          axisLabel: { color: '#AEAEB2', fontSize: 9 }, axisLine: { show: false }, axisTick: { show: false }
        },
        series: [{
          type: 'bar', data: monthCounts, barWidth: 22,
          itemStyle: {
            borderRadius: [5, 5, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#F28D5E' }, { offset: 1, color: '#EB612A' }
            ])
          },
          label: { show: true, position: 'top', fontSize: 9, color: '#AEAEB2' }
        }]
      });

      // 分页与行内操作（section 级事件委托，翻页重渲染后依然有效）
      function rebuildManaged() {
        const page = pageSlice('managed', managedList(st), PAGE_SIZE);
        const body = document.getElementById('managedBody');
        if (body) body.innerHTML = managedRows(page.list) || '<tr><td colspan="8">' + U().emptyState('暂无我管理的任务', '新建任务或作为负责人后会出现在这里', 'task') + '</td></tr>';
        const box = document.getElementById('managedPager');
        if (box) box.innerHTML = page.pager;
      }
      function rebuildSubs() {
        const page = pageSlice('subtasks', myItems(), PAGE_SIZE);
        const body = document.getElementById('myTbody');
        if (body) body.innerHTML = subRows(page.list) || '<tr><td colspan="6">' + U().emptyState('暂无分配到我的任务', '主管派发后会出现在这里', 'task') + '</td></tr>';
        const box = document.getElementById('subtasksPager');
        if (box) box.innerHTML = page.pager;
      }
      function rebuildRegular() {
        const page = pageSlice('regular', planTasksOf(st), PAGE_SIZE);
        const body = document.getElementById('regularBody');
        if (body) body.innerHTML = planRows(page.list) || '<tr><td colspan="6">' + U().emptyState('暂无常规任务', '巡检 / 维保计划同步后会出现在这里', 'clipboard') + '</td></tr>';
        const box = document.getElementById('regularPager');
        if (box) box.innerHTML = page.pager;
      }
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
          if (pagerBtn && !pagerBtn.disabled) { ITO.pagerState.regular = Number(pagerBtn.dataset.page); rebuildRegular(); }
        });
      }

      // 锚点导航：点击平滑滚动 + 滚动高亮当前区
      const nav = document.getElementById('mineAnchorNav');
      if (nav) {
        nav.addEventListener('click', function (e) {
          const btn = e.target.closest('[data-anchor]');
          if (!btn) return;
          const sec = document.getElementById('sec-' + btn.dataset.anchor);
          if (!sec) return;
          const y = sec.getBoundingClientRect().top + (window.scrollY || 0) - 150;
          window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        });
        const spy = function () {
          const navNow = document.getElementById('mineAnchorNav');
          if (!navNow) return;
          const btns = Array.prototype.slice.call(navNow.querySelectorAll('[data-anchor]'));
          let current = btns.length ? btns[0].dataset.anchor : null;
          btns.forEach(function (b) {
            const sec = document.getElementById('sec-' + b.dataset.anchor);
            if (sec && sec.getBoundingClientRect().top <= 180) current = b.dataset.anchor;
          });
          btns.forEach(function (b) { b.classList.toggle('active', b.dataset.anchor === current); });
        };
        if (!window.__mineSpyBound) {
          window.addEventListener('scroll', function () { if (window.__mineSpyFn) window.__mineSpyFn(); }, { passive: true });
          window.__mineSpyBound = true;
        }
        window.__mineSpyFn = spy;
        spy();
      }

      const exp = document.getElementById('myExportBtn');
      if (exp) exp.addEventListener('click', function () {
        const myItemsNow = myItems();
        const rows = [['子任务编号', '子任务', '主任务', '专业组', '状态', '截止时间', '成果物数量', '成果物文件', '提交版本']];
        myItemsNow.forEach(function (x) {
          const rec = window.DeliverableStore ? window.DeliverableStore.getLatestSubmission(x.sub.id) : null;
          rows.push([
            x.sub.id, x.sub.name, x.task.name, (ITO.getGroup(x.sub.group) || {}).name, x.sub.status, x.sub.due,
            rec ? rec.files.length : 0,
            rec ? rec.files.map(function (f) { return f.name; }).join(' / ') : '',
            rec ? 'v' + rec.version : ''
          ]);
        });
        U().exportPreview({ title: '我的任务导出预览', rows: rows, filename: 'ITO我的任务-' + st.user.name + '.csv' });
        ITO.log('导出个人任务', st.user.name + ' · ' + myItemsNow.length + ' 项', '任务');
        U().toast('我的任务已导出');
      });
    }
  };
})();
