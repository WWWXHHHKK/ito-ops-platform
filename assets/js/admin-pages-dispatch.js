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
    st.tasks.forEach(function (t) {
      t.subs.forEach(function (s) {
        if (s.status === '待派发') dispatch.push({ task: t, sub: s });
        if (s.status === '待审批') approval.push({ task: t, sub: s });
      });
    });
    return { dispatch: dispatch, approval: approval };
  }

  function card(item, mode) {
    const t = item.task;
    const s = item.sub;
    const over = U().isOverdue(s);
    const btn = mode === 'dispatch'
      ? '<button class="btn btn-primary btn-sm" data-act="dispatch" data-task="' + t.id + '" data-sub="' + s.id + '" type="button">' + U().icon('send') + '派发</button>'
      : '<button class="btn btn-soft btn-sm" data-act="approve" data-task="' + t.id + '" data-sub="' + s.id + '" type="button">' + U().icon('check') + '去审批</button>';

    return '<article class="dispatch-card">' +
      '<div class="dispatch-top"><b>' + U().esc(s.name) + '</b>' + U().badge(over ? '超期' : s.level) + '</div>' +
      '<div class="dispatch-meta">' +
        '<span class="mono">' + s.id + '</span>' +
        '<span>' + U().groupPill(s.group) + '</span>' +
        '<span>' + U().avatar(s.owner, true) + U().esc(s.owner) + '</span>' +
        '<span>' + U().icon('clock') + U().shortDate(s.due) + '</span>' +
      '</div>' +
      '<div class="dispatch-sub">' + U().esc(t.name) + ' · 发起人 ' + U().esc(t.initiator) + '</div>' +
      '<div class="dispatch-actions">' +
        '<span class="auth-chip">' + U().esc(s.auth || '—') + '</span>' +
        (s.ticket ? '<span class="auth-chip warn">需工作票</span>' : '') +
        '<span class="spacer"></span>' + btn +
      '</div>' +
    '</article>';
  }

  P.dispatch = {
    render: function () {
      const q = queue();
      const total = q.dispatch.length + q.approval.length;

      return U().pageHead({
        title: '派发与审批',
        sub: '当前 ' + total + ' 个子任务等待处理 · 派发后进入接收，审批通过后通知负责人',
        actions: '<button class="btn btn-ghost" id="queueExportBtn" type="button">' + U().icon('download') + '导出队列</button>'
      }) +
      '<div class="dispatch-overview">' +
        '<div class="summary-chip"><span class="icon">' + U().icon('send') + '</span><div><b>' + q.dispatch.length + '</b><span>待派发</span></div></div>' +
        '<div class="summary-chip"><span class="icon blue">' + U().icon('shield') + '</span><div><b>' + q.approval.length + '</b><span>待审批</span></div></div>' +
        '<div class="summary-chip"><span class="icon green">' + U().icon('check') + '</span><div><b>' + ITO.counts.pendingCount() + '</b><span>待处理合计</span></div></div>' +
      '</div>' +
      '<div class="dispatch-grid">' +
        '<section class="card dispatch-col">' +
          '<div class="dispatch-head"><h3>待派发 <span class="count">' + q.dispatch.length + '</span></h3><span class="hint">指派负责人 · 设置授权与时限</span></div>' +
          '<div class="dispatch-body" id="dispatchCol">' +
            (q.dispatch.length ? q.dispatch.map(function (x) { return card(x, 'dispatch'); }).join('') : U().emptyState('没有待派发任务', '所有子任务已完成派发', 'send')) +
          '</div>' +
        '</section>' +
        '<section class="card dispatch-col">' +
          '<div class="dispatch-head"><h3>待审批 <span class="count" style="background:var(--blue-soft);color:var(--blue)">' + q.approval.length + '</span></h3><span class="hint">审核授权范围 · 通过或驳回</span></div>' +
          '<div class="dispatch-body" id="approvalCol">' +
            (q.approval.length ? q.approval.map(function (x) { return card(x, 'approve'); }).join('') : U().emptyState('没有待审批任务', '审批队列已清空', 'shield')) +
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
          });
        });
      }
      bind();

      const exp = document.getElementById('queueExportBtn');
      if (exp) exp.addEventListener('click', function () {
        const q = queue();
        const rows = [['队列', '主任务编号', '主任务', '子任务编号', '子任务', '专业组', '负责人', '截止时间', '授权', '工作票']];
        q.dispatch.forEach(function (x) {
          rows.push(['待派发', x.task.id, x.task.name, x.sub.id, x.sub.name, (ITO.getGroup(x.sub.group) || {}).name, x.sub.owner, x.sub.due, x.sub.auth, x.sub.ticket ? '是' : '否']);
        });
        q.approval.forEach(function (x) {
          rows.push(['待审批', x.task.id, x.task.name, x.sub.id, x.sub.name, (ITO.getGroup(x.sub.group) || {}).name, x.sub.owner, x.sub.due, x.sub.auth, x.sub.ticket ? '是' : '否']);
        });
        U().download('ITO派发审批队列-' + D.meta.today + '.csv', U().csv(rows));
        ITO.log('导出派发审批队列', q.dispatch.length + ' 待派发 / ' + q.approval.length + ' 待审批', '任务');
        U().toast('派发审批队列已导出');
      });
    }
  };

  /* ── my tasks ────────────────────────────── */
  function myItems() {
    const st = S();
    const items = [];
    st.tasks.forEach(function (t) {
      t.subs.forEach(function (s) {
        if (s.owner === st.user.name && s.status !== '待派发' && s.status !== '待审批') items.push({ task: t, sub: s });
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
    let out = '';
    if (s.status === '待接收') out += '<button class="btn btn-soft btn-sm" data-act="accept" data-task="' + t.id + '" data-sub="' + s.id + '" type="button">接收</button>';
    if (s.status === '执行中') out += '<button class="btn btn-primary btn-sm" data-act="submit" data-task="' + t.id + '" data-sub="' + s.id + '" type="button">提交进度</button>';
    out += '<button class="btn btn-ghost btn-sm" data-act="detail-sub" data-task="' + t.id + '" data-sub="' + s.id + '" type="button">详情</button>';
    return out;
  }

  P.mine = {
    render: function () {
      const st = S();
      const items = myItems();
      const open = items.filter(function (x) { return x.sub.status !== '已完成'; });
      const done = items.filter(function (x) { return x.sub.status === '已完成'; });
      const receive = items.filter(function (x) { return x.sub.status === '待接收'; });
      const hours = items.reduce(function (n, x) { return n + (x.sub.hours || 0); }, 0);
      const me = st.staff.find(function (p) { return p.name === st.user.name; });
      const myGroup = me ? st.groups.find(function (g) { return g.id === me.group; }) : null;
      const tags = st.achievements.filter(function (a) { return me && a.group === me.group; });
      const auths = st.auths.filter(function (a) { return a.person === st.user.name; });

      const rows = items.map(function (x) {
        return '<tr>' +
          '<td><div class="cell-task"><b>' + U().esc(x.sub.name) + '</b><small>' + x.sub.id + ' · ' + U().esc(x.task.name) + '</small></div></td>' +
          '<td>' + U().groupPill(x.sub.group) + '</td>' +
          '<td>' + U().badge(x.sub.status) + '</td>' +
          '<td><div class="progress-cell">' + U().progressBar(x.sub.progress) + '<b>' + x.sub.progress + '%</b></div></td>' +
          '<td class="num" style="white-space:nowrap">' + U().shortDate(x.sub.due) + (U().isOverdue(x.sub) ? ' <span class="text-red">超期</span>' : '') + '</td>' +
          '<td><div class="row-actions">' + myActions(x.task, x.sub) + '</div></td>' +
        '</tr>';
      }).join('');

      return U().pageHead({
        title: '我的任务',
        sub: st.user.name + '，' + greet() + ' · ' + (myGroup ? myGroup.name + ' · ' : '') + st.user.title,
        actions:
          '<a class="btn btn-ghost" href="#/tasks">' + U().icon('task') + '任务中心</a>' +
          '<button class="btn btn-primary" id="myExportBtn" type="button">' + U().icon('download') + '导出我的任务</button>'
      }) +

      '<div class="kpi-grid mine-kpis">' +
        '<article class="card kpi-card"><div class="kpi-label">' + U().icon('task') + '<span>我的在办</span></div><div class="kpi-value">' + open.length + '<span class="unit">项</span></div><div class="kpi-meta"><span>含 ' + receive.length + ' 项待接收</span></div></article>' +
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
          '<section class="card mini-card">' +
            '<div class="mini-head"><h3>我的成就标签</h3><span class="table-note">' + tags.length + ' 项</span></div>' +
            '<div class="achievement-grid" style="grid-template-columns:1fr 1fr;margin-bottom:0">' +
              (tags.length ? tags.map(function (a) {
                return '<div class="achievement-card"><div class="tag-name">' + U().esc(a.name) + '</div>' +
                  '<div class="stars">' + '★'.repeat(a.stars) + '<span class="star-off">' + '★'.repeat(3 - a.stars) + '</span></div>' +
                  '<div class="tag-count">累计 ' + a.count + ' 次</div><div class="tag-desc">' + U().esc(a.desc) + '</div></div>';
              }).join('') : '<div class="mini-empty">暂无成就标签</div>') +
            '</div>' +
          '</section>' +
          '<section class="card mini-card">' +
            '<div class="mini-head"><h3>我的作业授权</h3><a href="#/auth">授权中心' + U().icon('arrow') + '</a></div>' +
            '<div class="mini-list">' +
              (auths.length ? auths.map(function (a) {
                return '<div class="mini-row"><span class="dot" style="background:' + (a.status === '有效' ? 'var(--green)' : 'var(--red)') + '"></span>' +
                  '<div class="txt"><b>' + U().esc(a.type) + '</b><span>' + U().esc(a.scope) + ' · 至 ' + a.validTo + '</span></div>' +
                  U().badge(a.status) + '</div>';
              }).join('') : '<div class="mini-empty">暂无授权记录</div>') +
            '</div>' +
          '</section>' +
        '</div>' +
      '</div>' +

      '<section class="card table-card" style="margin-top:16px">' +
        '<div class="table-head"><div><h3>我的子任务</h3><p class="table-note">接收、执行并提交交付物，全部子任务完成后主任务自动闭环</p></div>' +
          '<span class="table-note">' + items.length + ' 项</span></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>子任务</th><th>专业组</th><th>状态</th><th>进度</th><th>截止时间</th><th style="text-align:right">操作</th></tr></thead>' +
        '<tbody id="myTbody">' + (rows || '<tr><td colspan="6">' + U().emptyState('暂无分配到我的任务', '主管派发后会出现在这里', 'task') + '</td></tr>') + '</tbody></table></div>' +
      '</section>';
    },

    after: function () {
      const st = S();
      const items = myItems();
      const monthBase = new Date(D.meta.today.replace(/-/g, '/'));
      const monthLabels = [];
      for (let i = 4; i >= 0; i -= 1) {
        const d = new Date(monthBase.getFullYear(), monthBase.getMonth() - i, 1);
        monthLabels.push((d.getMonth() + 1) + ' 月');
      }

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
          type: 'bar', data: [18, 22, 19, 24, 21], barWidth: 22,
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

      const exp = document.getElementById('myExportBtn');
      if (exp) exp.addEventListener('click', function () {
        const rows = [['子任务编号', '子任务', '主任务', '专业组', '状态', '进度', '截止时间']];
        items.forEach(function (x) {
          rows.push([x.sub.id, x.sub.name, x.task.name, (ITO.getGroup(x.sub.group) || {}).name, x.sub.status, x.sub.progress + '%', x.sub.due]);
        });
        U().download('ITO我的任务-' + st.user.name + '.csv', U().csv(rows));
        ITO.log('导出个人任务', st.user.name + ' · ' + items.length + ' 项', '任务');
        U().toast('我的任务已导出');
      });
    }
  };
})();
