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
        '<section class="card dispatch-col">' +
          '<div class="dispatch-head"><h3>待分发 <span class="count">' + q.dispatch.length + '</span></h3><span class="hint">选择执行人 · 派发后进入执行中</span></div>' +
          '<div class="dispatch-body" id="dispatchCol">' +
            (q.dispatch.length ? q.dispatch.map(function (x) { return card(x, 'dispatch'); }).join('') : U().emptyState('没有待分发任务', '所有子任务都已派发', 'send')) +
          '</div>' +
        '</section>' +
        '<section class="card dispatch-col">' +
          '<div class="dispatch-head"><h3>负责人审批 <span class="count">' + q.approval.length + '</span></h3><span class="hint">审核成果物 · 驳回退回执行中</span></div>' +
          '<div class="dispatch-body" id="approvalCol">' +
            (q.approval.length ? q.approval.map(function (x) { return card(x, 'approve'); }).join('') : U().emptyState('没有待审批任务', '负责人审批队列已清空', 'shield')) +
          '</div>' +
        '</section>' +
        '<section class="card dispatch-col">' +
          '<div class="dispatch-head"><h3>领导审批 <span class="count">' + q.leader.length + '</span></h3><span class="hint">大任务已完成 · 不影响闭环</span></div>' +
          '<div class="dispatch-body" id="leaderCol">' +
            (q.leader.length ? q.leader.map(function (x) { return card(x, 'leader'); }).join('') : U().emptyState('没有待领导审批', '领导下发任务完成后会出现在这里', 'check')) +
          '</div>' +
        '</section>' +
        '<section class="card dispatch-col">' +
          '<div class="dispatch-head"><h3>待汇总报审 <span class="count">' + q.summary.length + '</span></h3><span class="hint">负责人汇总后提交领导</span></div>' +
          '<div class="dispatch-body" id="summaryCol">' +
            (q.summary.length ? q.summary.map(function (x) { return card(x, 'summary'); }).join('') : U().emptyState('没有待汇总任务', '子任务全部完成后可汇总报审', 'clipboard')) +
          '</div>' +
        '</section>' +
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

  function myActions(t, s) {
    let out = '<button class="btn btn-ghost btn-sm" data-act="detail-sub" data-task="' + t.id + '" data-sub="' + s.id + '" type="button">详情</button>';
    if (s.status === '执行中') out += '<button class="btn btn-primary btn-sm" data-act="submit" data-task="' + t.id + '" data-sub="' + s.id + '" type="button">提交成果</button>';
    if (s.status === '已挂起') out += '<button class="btn btn-soft btn-sm" data-act="resubmit" data-task="' + t.id + '" data-sub="' + s.id + '" type="button">重新提交</button>';
    return out;
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
      const myHandoverRows = handovers.map(function (h) {
        const action = h.person === st.user.name && h.status === '待提交' ? '提交交接' :
          h.incoming === st.user.name && h.status === '待接班确认' ? '确认接班' : '';
        return '<div class="mini-row"><div class="txt"><b>值班交接 · 第 ' + h.week.weekNo + ' 周</b><details><summary>查看交接</summary>' +
          ITO.handoverDetails(h) + '</details></div>' + U().badge(h.status) +
          (action ? '<button class="btn btn-primary btn-sm" type="button" data-my-handover="' + U().esc(h.week.key) + '">' + action + '</button>' : '') + '</div>';
      }).join('');
      const isLead = st.role === 'manager' || st.role === 'leader' || st.role === 'super';
      const showPersonalBadges = st.role === 'employee' || st.role === 'manager';
      const showPersonalAuth = showPersonalBadges;
      const planTasks = (st.planTasks || []).filter(function (t) { return t.executor === st.user.name; });
      const launched = st.tasks.filter(function (t) { return t.initiator === st.user.name && !t.canceled && !t.draft; });
      const owned = st.tasks.filter(function (t) { return t.owner === st.user.name && !t.canceled && !t.draft; });
      const miniTaskRows = function (list, mode) {
        return list.map(function (t) {
          return '<tr data-detail-task="' + t.id + '" style="cursor:pointer">' +
            '<td><div class="cell-task"><b>' + U().esc(t.name) + '</b><small>' + U().esc(t.id + ' · ' + t.type) + '</small></div></td>' +
            '<td>' + U().groupPill(t.group) + '</td>' +
            '<td>' + U().esc(mode === 'own' ? t.initiator : t.owner) + '</td>' +
            '<td>' + U().badge(U().displayStatus(t)) + '</td>' +
            '<td class="num" style="white-space:nowrap">' + U().shortDate(t.due) + '</td>' +
            '<td style="text-align:right">' + (mode === 'own'
              ? '<button class="btn btn-ghost btn-sm" type="button" data-my-reassign="' + t.id + '">改派</button>'
              : '<button class="btn btn-ghost btn-sm" type="button" data-my-detail="' + t.id + '">详情</button>') +
            '</td></tr>';
        }).join('');
      };
      const planRows = planTasks.map(function (t) {
        return '<tr data-plan-task="' + U().esc(t.id) + '">' +
          '<td><div class="cell-task"><b>' + U().esc(t.name) + '</b><small>' + U().esc(t.source + ' · ' + t.planId) + '</small></div></td>' +
          '<td>' + U().groupPill(t.group) + '</td>' +
          '<td class="num">' + (t.hours || 0) + ' h</td>' +
          '<td class="num" style="white-space:nowrap">' + U().shortDate(t.due) + '</td>' +
          '<td>' + U().badge(t.status) + '</td>' +
          '<td style="text-align:right"><a class="btn btn-ghost btn-sm" href="#/' + (t.planType === 'inspection' ? 'inspection' : 'maintenance') + '">去执行</a></td></tr>';
      }).join('');

      const rows = items.map(function (x) {
        const rec = window.DeliverableStore ? window.DeliverableStore.getLatestSubmission(x.sub.id) : null;
        return '<tr>' +
          '<td><div class="cell-task"><b>' + U().esc(x.sub.name) + '</b><small>' + x.sub.id + ' · ' + U().esc(x.task.name) + '</small></div></td>' +
          '<td>' + U().groupPill(x.sub.group) + '</td>' +
          '<td>' + U().badge(x.sub.status) + '</td>' +
          '<td class="num" style="white-space:nowrap">' + U().shortDate(x.sub.due) + (U().isOverdue(x.sub) ? ' <span class="text-red">超期</span>' : '') + '</td>' +
          '<td>' + (rec && rec.files.length ? '<button class="btn btn-ghost btn-sm" type="button" data-deliv-preview="' + U().esc(rec.files[0].id) + '">v' + rec.version + ' · ' + rec.files.length + ' 个</button>' : '<span class="muted">—</span>') + '</td>' +
          '<td><div class="row-actions">' + myActions(x.task, x.sub) + '</div></td>' +
        '</tr>';
      }).join('');

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

      '<div class="mine-grid">' +
        '<section class="card chart-card">' +
          '<div class="chart-head"><div><h3 class="chart-title">个人闭环趋势</h3><p class="chart-sub">近 5 个月验收通过的任务数 · 数据来自任务归档</p></div>' +
            '<span class="head-tag">PERSONAL</span></div>' +
          '<div class="chart-body" id="myChart"></div>' +
        '</section>' +
        '<div class="side-stack">' +
          (showPersonalBadges ? '<section class="card mini-card">' +
            '<div class="mini-head"><h3>我的属性勋章</h3><span class="table-note">' + tags.length + ' 项</span></div>' +
            '<div class="achievement-grid" style="grid-template-columns:1fr 1fr;margin-bottom:0">' +
              (tags.length ? tags.map(function (a) {
                const isPerson = a.type === '人员标签';
                return '<div class="achievement-card"><div class="tag-name">' + U().esc(a.name) + '<span class="tag-kind">' + U().esc(a.type) + '</span></div>' +
                  (isPerson ? '<div class="stars">' + '★'.repeat(a.source === '授权' ? 3 : a.stars) + '<span class="star-off">' + '★'.repeat(3 - (a.source === '授权' ? 3 : a.stars)) + '</span></div>' : '') +
                  (a.source === '授权' ? '<div class="tag-count">授权属性勋章 · 默认 3 星</div>' : '<div class="tag-count">累计 ' + a.count + ' 次</div>') +
                  (isPerson && a.source !== '授权' && a.firstClaimed ? '<div class="tag-first">首次领取 ' + U().esc(a.firstClaimed) + '</div>' : '') +
                  '<div class="tag-desc">' + U().esc(a.desc) + '</div></div>';
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
        '</div>' +
      '</div>' +

      (handovers.length || dutyActorPicker ? '<section class="card table-card" style="margin-top:16px"><div class="table-head"><div><h3>我的值班交接</h3><p class="table-note">接班人由下一班排班自动带出</p></div>' + dutyActorPicker + '</div>' + (myHandoverRows || '<div class="mini-empty">暂无待交接记录</div>') + '</section>' : '') +
      '<section class="card table-card" style="margin-top:16px">' +
        '<div class="table-head"><div><h3>我的常规任务</h3><p class="table-note">巡检 / 维保计划同步到执行人的常规任务</p></div>' +
          '<span class="table-note">' + planTasks.length + ' 项</span></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>任务</th><th>专业组</th><th>标准工时</th><th>截止时间</th><th>状态</th><th style="text-align:right">操作</th></tr></thead>' +
        '<tbody>' + (planRows || '<tr><td colspan="6">' + U().emptyState('暂无常规任务', '巡检 / 维保计划同步后会出现在这里', 'clipboard') + '</td></tr>') + '</tbody></table></div>' +
      '</section>' +

      (isLead
        ?       '<section class="card table-card" style="margin-top:16px">' +
            '<div class="table-head"><div><h3>大修专项任务</h3><p class="table-note">大修行动项接入后在此展示</p></div><span class="table-note">待接入</span></div>' +
            '<div style="padding:8px 0">' + U().emptyState('暂无大修专项任务', '大修行动项字段确认后接入', 'wrench') + '</div>' +
          '</section>' +
      '<section class="card table-card" style="margin-top:16px">' +
            '<div class="table-head"><div><h3>我发起的任务</h3><p class="table-note">我发起、当前在流转的任务</p></div><span class="table-note">' + launched.length + ' 项</span></div>' +
            '<div class="table-wrap"><table class="data-table"><thead><tr><th>任务</th><th>专业组</th><th>负责人</th><th>状态</th><th>截止时间</th><th style="text-align:right">操作</th></tr></thead>' +
            '<tbody>' + (miniTaskRows(launched, 'launched') || '<tr><td colspan="6">' + U().emptyState('暂无我发起的任务', '新建或下发任务后会出现在这里', 'task') + '</td></tr>') + '</tbody></table></div>' +
          '</section>' +
      '<section class="card table-card" style="margin-top:16px">' +
            '<div class="table-head"><div><h3>我负责的任务</h3><p class="table-note">我负责的任务，可查看详情或发起改派</p></div><span class="table-note">' + owned.length + ' 项</span></div>' +
            '<div class="table-wrap"><table class="data-table"><thead><tr><th>任务</th><th>专业组</th><th>发起人</th><th>状态</th><th>截止时间</th><th style="text-align:right">操作</th></tr></thead>' +
            '<tbody>' + (miniTaskRows(owned, 'own') || '<tr><td colspan="6">' + U().emptyState('暂无我负责的任务', '作为负责人后会出现在这里', 'users') + '</td></tr>') + '</tbody></table></div>' +
          '</section>'
        : '') +

      '<section class="card table-card" style="margin-top:16px">' +
        '<div class="table-head"><div><h3>我的子任务</h3><p class="table-note">接收、执行并提交成果物，全部子任务完成后主任务自动闭环</p></div>' +
          '<span class="table-note">' + items.length + ' 项</span></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>子任务</th><th>专业组</th><th>状态</th><th>截止时间</th><th>成果物</th><th style="text-align:right">操作</th></tr></thead>' +
        '<tbody id="myTbody">' + (rows || '<tr><td colspan="6">' + U().emptyState('暂无分配到我的任务', '主管派发后会出现在这里', 'task') + '</td></tr>') + '</tbody></table></div>' +
      '</section>';
    },

    after: function () {
      const st = S();
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

      const tbody = document.getElementById('myTbody');
      if (tbody) {
        tbody.addEventListener('click', function (e) {
          const btn = e.target.closest('[data-act]');
          if (!btn) return;
          ITO.taskActions.run(btn.dataset.act, btn.dataset.task, btn.dataset.sub);
        });
      }

      U().$$('[data-detail-task]').forEach(function (row) {
        row.addEventListener('click', function (e) {
          if (e.target.closest('button, a')) return;
          ITO.taskActions.detail(row.dataset.detailTask);
        });
      });
      U().$$('[data-my-detail]').forEach(function (btn) {
        btn.addEventListener('click', function () { ITO.taskActions.detail(btn.dataset.myDetail); });
      });
      U().$$('[data-my-reassign]').forEach(function (btn) {
        btn.addEventListener('click', function () { ITO.taskActions.reassign(btn.dataset.myReassign); });
      });

      const exp = document.getElementById('myExportBtn');
      if (exp) exp.addEventListener('click', function () {
        const rows = [['子任务编号', '子任务', '主任务', '专业组', '状态', '截止时间', '成果物数量', '成果物文件', '提交版本']];
        items.forEach(function (x) {
          const rec = window.DeliverableStore ? window.DeliverableStore.getLatestSubmission(x.sub.id) : null;
          rows.push([
            x.sub.id, x.sub.name, x.task.name, (ITO.getGroup(x.sub.group) || {}).name, x.sub.status, x.sub.due,
            rec ? rec.files.length : 0,
            rec ? rec.files.map(function (f) { return f.name; }).join(' / ') : '',
            rec ? 'v' + rec.version : ''
          ]);
        });
        U().exportPreview({ title: '我的任务导出预览', rows: rows, filename: 'ITO我的任务-' + st.user.name + '.csv' });
        ITO.log('导出个人任务', st.user.name + ' · ' + items.length + ' 项', '任务');
        U().toast('我的任务已导出');
      });
    }
  };
})();
