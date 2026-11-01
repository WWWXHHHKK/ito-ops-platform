/* ─────────────────────────────────────────────
   page · task center / dispatch engine
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const P = (window.ITO_PAGES = window.ITO_PAGES || {});
  const D = window.ITO_DATA;
  const ACT = {};

  function S() { return ITO.state; }
  function U() { return ITO.ui; }
  function pd(str) { return new Date(String(str).replace(/-/g, '/').replace('T', ' ')); }

  function taskById(id) {
    return S().tasks.find(function (t) { return t.id === id; });
  }

  function findSub(task, subId) {
    return task.subs.find(function (s) { return s.id === subId; });
  }

  function visibleSubs(task) {
    if (S().role === 'employee') {
      return task.subs.filter(function (s) { return s.owner === S().user.name; });
    }
    return task.subs;
  }

  function visibleTasks() {
    const st = S();
    const f = st.taskFilters;
    let list = st.tasks;

    if (st.role === 'employee') {
      list = list.filter(function (t) {
        return t.subs.some(function (s) {
          return s.owner === st.user.name && s.status !== '待派发' && s.status !== '待审批';
        });
      });
    }

    if (f.group) list = list.filter(function (t) { return t.group === f.group; });
    if (f.level) list = list.filter(function (t) { return t.level === f.level; });

    if (f.status === '超期') {
      list = list.filter(function (t) { return visibleSubs(t).some(function (s) { return U().isOverdue(s); }); });
    } else if (f.status === '已完成') {
      list = list.filter(function (t) {
        const subs = visibleSubs(t);
        return subs.length && subs.every(function (s) { return s.status === '已完成'; });
      });
    } else if (f.status) {
      list = list.filter(function (t) {
        return visibleSubs(t).some(function (s) { return s.status === f.status; });
      });
    }

    if (f.q) {
      const q = f.q.toLowerCase();
      list = list.filter(function (t) {
        const hay = [t.id, t.name, t.owner, t.initiator, t.type, t.tags.join(' ')]
          .concat(t.subs.map(function (s) { return s.id + ' ' + s.name + ' ' + s.owner; }))
          .join(' ').toLowerCase();
        return hay.indexOf(q) > -1;
      });
    }
    return list;
  }

  function stats(list) {
    let subs = 0, overdue = 0, pending = 0;
    list.forEach(function (t) {
      visibleSubs(t).forEach(function (s) {
        subs += 1;
        if (U().isOverdue(s)) overdue += 1;
        if (s.status === '待派发' || s.status === '待审批' || s.status === '待接收') pending += 1;
      });
    });
    return { main: list.length, subs: subs, overdue: overdue, pending: pending };
  }

  function dueCell(due, status) {
    if (status === '已完成') return '<div class="due-cell done"><b>' + U().shortDate(due) + '</b><span>已闭环</span></div>';
    const diff = Math.round((pd(due) - pd(D.meta.demoNow)) / 60000);
    const abs = Math.abs(diff);
    let hint;
    if (abs < 60) hint = abs + ' 分钟';
    else if (abs < 1440) hint = Math.round(abs / 60) + ' 小时';
    else hint = Math.round(abs / 1440) + ' 天';
    return '<div class="due-cell' + (diff < 0 ? ' over' : '') + '"><b>' + U().shortDate(due) + '</b><span>' +
      (diff < 0 ? '超期 ' + hint : '剩余 ' + hint) + '</span></div>';
  }

  function subActions(task, sub) {
    const st = S();
    const mgr = st.role === 'leader' || st.role === 'manager';
    const mine = sub.owner === st.user.name;
    let out = '';

    if (mgr && sub.status === '待派发') out += '<button class="btn btn-soft btn-sm" data-act="dispatch" data-task="' + task.id + '" data-sub="' + sub.id + '" type="button">派发</button>';
    if (mgr && sub.status === '待审批') out += '<button class="btn btn-soft btn-sm" data-act="approve" data-task="' + task.id + '" data-sub="' + sub.id + '" type="button">审批</button>';
    if ((mine || mgr) && sub.status === '待接收') out += '<button class="btn btn-soft btn-sm" data-act="accept" data-task="' + task.id + '" data-sub="' + sub.id + '" type="button">' + (mine ? '接收' : '代接收') + '</button>';
    if (mine && sub.status === '执行中') out += '<button class="btn btn-primary btn-sm" data-act="submit" data-task="' + task.id + '" data-sub="' + sub.id + '" type="button">提交</button>';
    out += '<button class="btn btn-ghost btn-sm" data-act="detail-sub" data-task="' + task.id + '" data-sub="' + sub.id + '" type="button">详情</button>';
    return out;
  }

  function quickAction(task) {
    const st = S();
    const subs = visibleSubs(task);
    const mgr = st.role === 'leader' || st.role === 'manager';
    let target = null;
    if (mgr) {
      target = subs.find(function (s) { return s.status === '待审批'; }) ||
        subs.find(function (s) { return s.status === '待派发'; }) ||
        subs.find(function (s) { return s.status === '待接收'; });
    } else {
      target = subs.find(function (s) { return s.status === '待接收'; }) ||
        subs.find(function (s) { return s.status === '执行中'; });
    }
    if (!target) return '';
    const act = target.status === '待审批' ? 'approve' : target.status === '待派发' ? 'dispatch' :
      target.status === '待接收' ? 'accept' : 'submit';
    const label = act === 'approve' ? '审批' : act === 'dispatch' ? '派发' :
      act === 'accept' ? (target.owner === st.user.name ? '接收' : '代接收') : '提交';
    return '<button class="btn btn-soft btn-sm" data-act="' + act + '" data-task="' + task.id + '" data-sub="' + target.id + '" type="button">' + label + '</button>';
  }

  function rowsHtml() {
    const list = visibleTasks();
    const st = S();
    if (!list.length) {
      return '<tr><td colspan="8">' + U().emptyState('没有匹配的任务', '调整筛选条件，或新建一个任务', 'task') + '</td></tr>';
    }
    return list.map(function (t) {
      const subs = visibleSubs(t);
      const status = subs.length && subs.every(function (s) { return s.status === '已完成'; }) ? '已完成' : U().mainStatus(t);
      const progress = Math.round(subs.reduce(function (n, s) { return n + (s.progress || 0); }, 0) / (subs.length || 1));
      const over = subs.some(function (s) { return U().isOverdue(s); });
      const expanded = !!st.expanded[t.id];
      const caret = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

      const mainRow =
        '<tr class="task-main-row" data-id="' + t.id + '">' +
          '<td><div class="task-name"><button class="expand-btn' + (expanded ? ' open' : '') + '" data-act="expand" data-id="' + t.id + '" type="button" aria-label="展开子任务">' + caret + '</button>' +
            '<div class="task-name-text"><b>' + U().esc(t.name) + '</b><small>' + t.id + ' · ' + t.subs.length + ' 个子任务 · ' + U().esc(t.type) + '</small></div></div></td>' +
          '<td>' + U().groupPill(t.group) + '</td>' +
          '<td style="white-space:nowrap">' + U().avatar(t.owner, true) + U().esc(t.owner) + '</td>' +
          '<td>' + U().badge(t.level) + '</td>' +
          '<td>' + dueCell(t.due, status) + '</td>' +
          '<td><div class="progress-cell">' + U().progressBar(progress) + '<b>' + progress + '%</b></div></td>' +
          '<td>' + U().badge(status) + (over && status !== '已完成' ? '<span class="overdue-mark" title="存在超期子任务">!</span>' : '') + '</td>' +
          '<td><div class="row-actions">' + quickAction(t) +
            '<button class="btn btn-ghost btn-sm" data-act="detail" data-task="' + t.id + '" type="button">详情</button></div></td>' +
        '</tr>';

      const subRow =
        '<tr class="task-subrow" data-sub="' + t.id + '"' + (expanded ? '' : ' hidden') + '><td colspan="8"><div class="sub-list">' +
          subs.map(function (s) {
            return '<div class="sub-item' + (U().isOverdue(s) ? ' is-over' : '') + '">' +
              '<span class="sid">' + s.id + '</span>' +
              '<span class="sname" title="' + U().esc(s.name) + '">' + U().esc(s.name) + '</span>' +
              '<span class="sowner">' + U().avatar(s.owner, true) + U().esc(s.owner) + '</span>' +
              '<span>' + U().badge(s.status) + '</span>' +
              '<span class="sbar">' + U().progressBar(s.progress) + '<b>' + s.progress + '%</b></span>' +
              '<span class="sdue' + (U().isOverdue(s) ? ' over' : '') + '">' + U().shortDate(s.due) + '</span>' +
              '<span class="row-actions">' + subActions(t, s) + '</span>' +
            '</div>';
          }).join('') +
        '</div></td></tr>';

      return mainRow + subRow;
    }).join('');
  }

  function statsHtml(list) {
    const s = stats(list);
    return '<div class="task-stats">' +
      '<span>主任务 <b>' + s.main + '</b></span><i></i>' +
      '<span>子任务 <b>' + s.subs + '</b></span><i></i>' +
      '<span>超期 <b class="' + (s.overdue ? 'text-red' : '') + '">' + s.overdue + '</b></span><i></i>' +
      '<span>待处理 <b>' + s.pending + '</b></span>' +
      '<span class="stats-spacer"></span><span class="stats-hint">' + (S().role === 'employee' ? '仅显示与我相关的任务' : '按当前筛选统计') + '</span></div>';
  }

  /* ── task detail drawer ──────────────────── */
  ACT.detail = function (taskId, subId) {
    const t = taskById(taskId);
    if (!t) return;
    const st = S();
    const focus = subId ? findSub(t, subId) : null;
    const mgr = st.role === 'leader' || st.role === 'manager';

    const events = st.logs.filter(function (l) {
      return l.target.indexOf(t.id) > -1 || l.target.indexOf(t.name) > -1;
    }).slice(0, 8);
    if (!events.length) {
      D.activity.filter(function (a) { return a.task === t.name; }).forEach(function (a) {
        events.push({ time: a.time, actor: a.owner, action: a.status, type: '任务' });
      });
    }
    if (!events.length) events.push({ time: t.due, actor: t.initiator, action: '任务创建', type: '任务' });

    const subs = t.subs.map(function (s) {
      return '<tr><td class="mono">' + s.id + '</td><td>' + U().esc(s.name) + '</td>' +
        '<td style="white-space:nowrap">' + U().esc(s.owner) + '</td><td>' + U().badge(s.status) + '</td>' +
        '<td>' + U().progressBar(s.progress) + ' ' + s.progress + '%</td>' +
        '<td style="white-space:nowrap">' + U().shortDate(s.due) + '</td>' +
        '<td>' + subActions(t, s) + '</td></tr>';
    }).join('');

    const body =
      '<div class="detail-top">' + U().groupPill(t.group) + U().badge(t.level) + U().badge(U().mainStatus(t)) +
        '<span class="detail-id">' + t.id + '</span></div>' +
      (t.desc ? '<p class="detail-desc">' + U().esc(t.desc) + '</p>' : '') +
      '<div class="detail-grid">' +
        '<div class="detail-field"><label>专业组</label><div>' + U().esc((ITO.getGroup(t.group) || {}).name || '') + '</div></div>' +
        '<div class="detail-field"><label>主负责人</label><div>' + U().esc(t.owner) + '</div></div>' +
        '<div class="detail-field"><label>任务类型</label><div>' + U().esc(t.type) + '</div></div>' +
        '<div class="detail-field"><label>优先级</label><div>' + U().esc(t.level) + '</div></div>' +
        '<div class="detail-field"><label>发起人</label><div>' + U().esc(t.initiator) + '</div></div>' +
        '<div class="detail-field"><label>截止时间</label><div>' + U().esc(t.due) + '</div></div>' +
        '<div class="detail-field"><label>整体进度</label><div>' + U().mainProgress(t) + '%</div></div>' +
        '<div class="detail-field"><label>标签</label><div>' + (t.tags || []).map(function (x) {
          return '<span class="tag-inline">' + U().esc(x) + '</span>';
        }).join('') + '</div></div>' +
      '</div>' +
      (focus ? '<div class="detail-section"><h4>当前关注子任务</h4><div class="focus-sub">' +
        '<b>' + focus.id + ' · ' + U().esc(focus.name) + '</b><span>' + U().esc(focus.owner) + ' · ' + focus.progress + '% · ' + U().esc(focus.due) + '</span></div></div>' : '') +
      '<div class="detail-section"><h4>子任务（' + t.subs.length + '）</h4>' +
        '<div class="table-wrap"><table class="sub-table"><thead><tr><th>编号</th><th>名称</th><th>负责人</th><th>状态</th><th>进度</th><th>截止</th><th>操作</th></tr></thead><tbody>' +
        subs + '</tbody></table></div></div>' +
      '<div class="detail-section"><h4>操作记录</h4><div class="timeline">' +
        events.map(function (e) {
          return '<div class="timeline-item"><b>' + U().esc(e.action) + ' · ' + U().esc(e.actor) + '</b><span>' + U().esc(e.time) + ' · ' + U().esc(e.type) + '</span></div>';
        }).join('') + '</div></div>';

    const close = U().drawer({
      title: t.name,
      sub: t.id + ' · ' + (ITO.getGroup(t.group) || {}).name,
      body: body,
      foot: '<button class="btn btn-ghost" data-detail-close type="button">关闭</button>' +
        (mgr ? '<span class="spacer"></span><a class="btn btn-soft" href="#/dispatch">进入派发审批</a>' : ''),
      onMount: function (c) {
        c.querySelector('[data-detail-close]').addEventListener('click', c);
        U().$$('[data-act]', c).forEach(function (btn) {
          btn.addEventListener('click', function () {
            c();
            ACT.run(btn.dataset.act, btn.dataset.task, btn.dataset.sub);
          });
        });
      }
    });
    void close;
  };

  /* ── new task ────────────────────────────── */
  ACT.newTask = function () {
    const st = S();
    const authOptions = ['无需授权', '工作负责人授权', '准备工程师授权', '高风险作业授权', 'RP1 授权'];

    const body =
      '<div class="form-grid">' +
        U().formRow({ label: '任务名称', required: true, full: true, control: '<input id="ntName" type="text" maxlength="40" placeholder="例如：核心机房季度巡检与整改">' }) +
        U().formRow({ label: '专业组', required: true, control: '<select id="ntGroup">' + U().groupOptions('app') + '</select>' }) +
        U().formRow({ label: '负责人', required: true, control: '<select id="ntOwner">' + U().staffOptions('app') + '</select>' }) +
        U().formRow({ label: '优先级', control: '<select id="ntLevel">' + U().statusOptions(['重要', '一般', '紧急'], '重要') + '</select>' }) +
        U().formRow({ label: '任务类型', control: '<select id="ntType">' + U().statusOptions(['变更', '操作', '巡检', '维保', '开发', '工单', '试验'], '变更') + '</select>' }) +
        U().formRow({ label: '截止时间', required: true, control: '<input id="ntDue" type="datetime-local" value="2026-11-05T18:00">' }) +
        U().formRow({ label: '作业授权', control: '<select id="ntAuth">' + U().statusOptions(authOptions, '工作负责人授权') + '</select>' }) +
        U().formRow({ label: '任务描述', full: true, control: '<textarea id="ntDesc" placeholder="补充背景、交付物与验收标准"></textarea>' }) +
      '</div>' +
      '<div class="form-hint" style="margin-top:10px">任务创建后进入「待派发」，由主管指派负责人并设置作业授权。</div>';

    U().modal({
      title: '新建任务',
      sub: '创建后自动进入派发队列 · 编号自动生成',
      wide: true,
      body: body,
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-create type="button">' + U().icon('plus') + '创建任务</button>',
      onMount: function (close, root) {
        const groupSel = root.querySelector('#ntGroup');
        const ownerSel = root.querySelector('#ntOwner');
        const levelSel = root.querySelector('#ntLevel');
        const authSel = root.querySelector('#ntAuth');

        groupSel.addEventListener('change', function () {
          ownerSel.innerHTML = U().staffOptions(groupSel.value);
        });
        levelSel.addEventListener('change', function () {
          authSel.value = levelSel.value === '紧急' ? '高风险作业授权' : levelSel.value === '重要' ? '工作负责人授权' : '无需授权';
        });
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-create]').addEventListener('click', function () {
          const name = root.querySelector('#ntName').value.trim();
          const dueRaw = root.querySelector('#ntDue').value;
          if (!name) { U().toast('请填写任务名称', 'warn'); root.querySelector('#ntName').focus(); return; }
          if (!dueRaw) { U().toast('请选择截止时间', 'warn'); return; }
          const group = groupSel.value;
          const owner = ownerSel.value;
          const level = levelSel.value;
          const type = root.querySelector('#ntType').value;
          const auth = authSel.value;
          const due = dueRaw.replace('T', ' ');
          const desc = root.querySelector('#ntDesc').value.trim() || '待补充任务背景与验收标准。';
          const id = 'T' + (st.taskSeq++);

          st.tasks.unshift({
            id: id, name: name, group: group, owner: owner, initiator: st.user.name,
            level: level, type: type, due: due, tags: [type, (ITO.getGroup(group) || {}).name],
            desc: desc,
            subs: [{
              id: id + '-01', name: name, group: group, owner: owner, initiator: st.user.name,
              level: level, type: type, status: '待派发', due: due, hours: 8, progress: 0,
              auth: auth, ticket: auth === '高风险作业授权'
            }]
          });

          st.metrics.active += 1;
          st.metrics.groupActive[group] = (st.metrics.groupActive[group] || 0) + 1;
          st.metrics.newTasks += 1;
          st.trend.newTasks[st.trend.newTasks.length - 1] += 1;

          ITO.log('新建任务', id + ' ' + name, '任务');
          close();
          U().toast('任务已创建并进入派发队列');
          ITO.refresh();
        });
      }
    });
  };

  /* ── dispatch ────────────────────────────── */
  ACT.openDispatch = function (taskId, subId) {
    const t = taskById(taskId);
    if (!t) return;
    const sub = findSub(t, subId);
    if (!sub) return;
    const st = S();
    const authOptions = ['无需授权', '工作负责人授权', '准备工程师授权', '高风险作业授权', 'RP1 授权'];
    const dueVal = String(sub.due).replace(' ', 'T');

    U().modal({
      title: '派发子任务',
      sub: t.id + ' · ' + t.name,
      body:
        '<div class="dispatch-preview">' + U().badge(sub.level) + U().groupPill(sub.group) +
          '<b>' + U().esc(sub.name) + '</b><span class="mono">' + sub.id + '</span></div>' +
        '<div class="form-grid" style="margin-top:16px">' +
          U().formRow({ label: '执行负责人', required: true, control: '<select id="dpOwner">' + U().staffOptions(sub.group, sub.owner) + '</select>' }) +
          U().formRow({ label: '截止时间', required: true, control: '<input id="dpDue" type="datetime-local" value="' + dueVal + '">' }) +
          U().formRow({ label: '作业授权', full: true, control: '<select id="dpAuth">' + U().statusOptions(authOptions, sub.auth === '—' ? '工作负责人授权' : sub.auth) + '</select>' }) +
          U().formRow({ label: '派发说明', full: true, control: '<textarea id="dpNote" placeholder="说明交付物、验收标准与注意事项"></textarea>' }) +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">' + U().icon('send') + '确认派发</button>',
      onMount: function (close, root) {
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', function () {
          const owner = root.querySelector('#dpOwner').value;
          const dueRaw = root.querySelector('#dpDue').value;
          if (!owner || !dueRaw) { U().toast('请补全负责人与截止时间', 'warn'); return; }
          sub.owner = owner;
          sub.due = dueRaw.replace('T', ' ');
          sub.auth = root.querySelector('#dpAuth').value;
          sub.status = '待接收';
          sub.note = root.querySelector('#dpNote').value.trim();
          ITO.log('派发任务', sub.id + ' ' + sub.name + ' → ' + owner, '任务');
          close();
          U().toast('已派发给 ' + owner + '，等待接收');
          ITO.refresh();
        });
      }
    });
    void st;
  };

  /* ── approve ─────────────────────────────── */
  ACT.openApprove = function (taskId, subId) {
    const t = taskById(taskId);
    if (!t) return;
    const sub = findSub(t, subId);
    if (!sub) return;

    U().modal({
      title: '审批子任务',
      sub: t.id + ' · ' + t.name,
      wide: true,
      body:
        '<div class="approve-grid">' +
          '<div class="detail-field"><label>子任务</label><div>' + U().esc(sub.name) + '</div></div>' +
          '<div class="detail-field"><label>编号</label><div class="mono">' + sub.id + '</div></div>' +
          '<div class="detail-field"><label>专业组</label><div>' + U().esc((ITO.getGroup(sub.group) || {}).name) + '</div></div>' +
          '<div class="detail-field"><label>负责人</label><div>' + U().esc(sub.owner) + '</div></div>' +
          '<div class="detail-field"><label>作业授权</label><div>' + U().esc(sub.auth) + '</div></div>' +
          '<div class="detail-field"><label>截止时间</label><div>' + U().esc(sub.due) + '</div></div>' +
          '<div class="detail-field"><label>风险等级</label><div>' + U().badge(sub.level) + '</div></div>' +
          '<div class="detail-field"><label>工作票</label><div>' + (sub.ticket ? U().badge('需工作票', 'yellow') : '无需工作票') + '</div></div>' +
        '</div>' +
        '<div class="approve-note">' + U().esc(sub.note || '申请人已提交作业方案与风险预控措施，请审核授权范围与作业时间。') + '</div>' +
        '<div class="form-field" style="margin-top:14px"><label>审批意见</label><textarea id="apComment" placeholder="通过或驳回的说明（选填）"></textarea></div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button>' +
        '<button class="btn btn-danger" data-reject type="button">驳回</button>' +
        '<button class="btn btn-primary" data-pass type="button">' + U().icon('check') + '审批通过</button>',
      onMount: function (close, root) {
        const comment = function () { return root.querySelector('#apComment').value.trim(); };
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-pass]').addEventListener('click', function () {
          sub.status = '待接收';
          sub.auth = sub.auth === '—' ? '工作负责人授权' : sub.auth;
          ITO.log('审批通过', sub.id + ' ' + sub.name + (comment() ? ' · ' + comment() : ''), '审批');
          close();
          U().toast('审批通过，已通知负责人接收');
          ITO.refresh();
        });
        root.querySelector('[data-reject]').addEventListener('click', function () {
          sub.status = '待派发';
          sub.note = comment() || '审批驳回，请补充作业方案后重新提交。';
          ITO.log('审批驳回', sub.id + ' ' + sub.name, '审批');
          close();
          U().toast('已驳回并退回派发队列', 'warn');
          ITO.refresh();
        });
      }
    });
  };

  /* ── accept / submit ─────────────────────── */
  ACT.accept = function (taskId, subId) {
    const t = taskById(taskId);
    const sub = t && findSub(t, subId);
    if (!sub) return;
    sub.status = '执行中';
    sub.progress = Math.max(sub.progress || 0, 5);
    ITO.log('接收任务', sub.id + ' ' + sub.name, '任务');
    U().toast('任务已接收，开始执行');
    ITO.refresh();
  };

  ACT.submit = function (taskId, subId) {
    const t = taskById(taskId);
    const sub = t && findSub(t, subId);
    if (!sub) return;
    const st = S();

    U().modal({
      title: '提交进度',
      sub: sub.id + ' · ' + sub.name,
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '完成进度（%）', required: true, control: '<input id="sbProgress" type="number" min="0" max="100" step="5" value="' + sub.progress + '">' }) +
          U().formRow({ label: '预计剩余工时', control: '<input id="sbHours" type="number" min="0" max="200" value="' + Math.max(1, (sub.hours || 8) - Math.round((sub.hours || 8) * sub.progress / 100)) + '">' }) +
          U().formRow({ label: '交付说明', full: true, control: '<textarea id="sbNote" placeholder="填写本次交付物、验证结果与遗留事项"></textarea>' }) +
        '</div>' +
        '<div class="form-hint" style="margin-top:10px">进度达到 100% 时子任务自动闭环；全部子任务完成则主任务闭环。</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">提交进度</button>',
      onMount: function (close, root) {
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', function () {
          const val = Math.max(0, Math.min(100, Number(root.querySelector('#sbProgress').value) || 0));
          const wasDone = U().mainStatus(t) === '已完成';
          sub.progress = val;
          sub.status = val >= 100 ? '已完成' : '执行中';
          if (val >= 100) sub.completedAt = D.meta.demoNow;

          const nowDone = U().mainStatus(t) === '已完成';
          if (!wasDone && nowDone) {
            st.metrics.active = Math.max(0, st.metrics.active - 1);
            st.metrics.closed += 1;
            st.metrics.groupActive[t.group] = Math.max(0, (st.metrics.groupActive[t.group] || 0) - 1);
            st.trend.completed[st.trend.completed.length - 1] += 1;
            ITO.log('闭环任务', t.id + ' ' + t.name, '任务');
          }

          ITO.log(val >= 100 ? '完成子任务' : '更新进度', sub.id + ' ' + sub.name + ' · ' + val + '%', '任务');
          close();
          U().toast(val >= 100 ? '子任务已闭环' : '进度已更新至 ' + val + '%');
          ITO.refresh();
        });
      }
    });
  };

  ACT.run = function (act, taskId, subId) {
    if (act === 'dispatch') ACT.openDispatch(taskId, subId);
    else if (act === 'approve') ACT.openApprove(taskId, subId);
    else if (act === 'accept') ACT.accept(taskId, subId);
    else if (act === 'submit') ACT.submit(taskId, subId);
    else if (act === 'detail-sub') ACT.detail(taskId, subId);
    else if (act === 'detail') ACT.detail(taskId);
  };

  ACT.exportTasks = function () {
    const list = visibleTasks();
    const rows = [['主任务编号', '主任务', '子任务编号', '子任务', '专业组', '负责人', '优先级', '状态', '进度', '截止时间']];
    list.forEach(function (t) {
      visibleSubs(t).forEach(function (s) {
        rows.push([t.id, t.name, s.id, s.name, (ITO.getGroup(s.group) || {}).name, s.owner, s.level, s.status, s.progress + '%', s.due]);
      });
    });
    U().download('ITO任务清单-2026-11-01.csv', U().csv(rows));
    ITO.log('导出任务清单', list.length + ' 个主任务', '任务');
    U().toast('任务清单已导出');
  };

  /* ── page ────────────────────────────────── */
  P.tasks = {
    render: function () {
      const st = S();
      const f = st.taskFilters;
      if (typeof f.q !== 'string') { f.q = ''; f.group = ''; f.status = ''; f.level = ''; }
      if (st.pendingQuery != null) { f.q = st.pendingQuery; st.pendingQuery = null; }

      const list = visibleTasks();
      const s = stats(list);
      const statusList = ['', '待派发', '待审批', '待接收', '执行中', '已完成', '超期'];
      const statusLabels = { '': '全部状态', '待派发': '待派发', '待审批': '待审批', '待接收': '待接收', '执行中': '执行中', '已完成': '已完成', '超期': '仅超期' };

      return U().pageHead({
        title: '任务中心',
        sub: (st.role === 'employee' ? '仅展示与我相关的任务 · ' : '覆盖 4 个专业组 · ') + '全生命周期：创建、派发、审批、接收、执行、闭环',
        actions:
          '<button class="btn btn-ghost" id="taskExportBtn" type="button">' + U().icon('download') + '导出清单</button>' +
          (st.role === 'employee' ? '' : '<button class="btn btn-primary" id="taskNewBtn" type="button">' + U().icon('plus') + '新建任务</button>')
      }) +
      statsHtml(list) +
      '<div class="toolbar">' +
        '<div class="filters">' +
          '<label class="search-field">' + U().icon('search') + '<input id="taskSearch" type="search" placeholder="搜索任务、人员或编号" value="' + U().esc(f.q) + '"></label>' +
          '<select class="select" id="fGroup"><option value="">全部专业组</option>' + U().groupOptions(f.group) + '</select>' +
          '<select class="select" id="fStatus">' + statusList.map(function (x) {
            return '<option value="' + x + '"' + (x === f.status ? ' selected' : '') + '>' + statusLabels[x] + '</option>';
          }).join('') + '</select>' +
          '<select class="select" id="fLevel"><option value="">全部优先级</option>' + U().statusOptions(['紧急', '重要', '一般'], f.level) + '</select>' +
          '<button class="btn btn-ghost btn-sm" id="clearFilters" type="button">' + U().icon('refresh') + '重置</button>' +
        '</div>' +
      '</div>' +
      '<section class="card table-card">' +
        '<div class="table-head"><div><h3>任务清单</h3><p class="table-note">点击行查看详情，展开可查看子任务</p></div>' +
          '<span class="table-note" id="resultCount">' + s.main + ' 个主任务 / ' + s.subs + ' 个子任务</span></div>' +
        '<div class="table-wrap"><table class="data-table task-table">' +
          '<thead><tr><th>任务</th><th>专业组</th><th>负责人</th><th>优先级</th><th>截止时间</th><th>进度</th><th>状态</th><th style="text-align:right">操作</th></tr></thead>' +
          '<tbody id="taskTbody">' + rowsHtml() + '</tbody>' +
        '</table></div>' +
      '</section>';
    },

    after: function () {
      const st = S();
      const f = st.taskFilters;

      function updateRows() {
        const list = visibleTasks();
        document.getElementById('taskTbody').innerHTML = rowsHtml();
        const s = stats(list);
        const statsBox = document.querySelector('.task-stats');
        if (statsBox) {
          statsBox.outerHTML = statsHtml(list);
        }
        const count = document.getElementById('resultCount');
        if (count) count.textContent = s.main + ' 个主任务 / ' + s.subs + ' 个子任务';
      }

      const search = document.getElementById('taskSearch');
      if (search) {
        search.addEventListener('input', function () { f.q = search.value.trim(); updateRows(); });
      }
      const fg = document.getElementById('fGroup');
      if (fg) fg.addEventListener('change', function () { f.group = fg.value; updateRows(); });
      const fs = document.getElementById('fStatus');
      if (fs) fs.addEventListener('change', function () { f.status = fs.value; updateRows(); });
      const fl = document.getElementById('fLevel');
      if (fl) fl.addEventListener('change', function () { f.level = fl.value; updateRows(); });
      const clear = document.getElementById('clearFilters');
      if (clear) clear.addEventListener('click', function () {
        f.q = ''; f.group = ''; f.status = ''; f.level = '';
        if (search) search.value = '';
        if (fg) fg.value = '';
        if (fs) fs.value = '';
        if (fl) fl.value = '';
        updateRows();
      });

      const tbody = document.getElementById('taskTbody');
      if (tbody) {
        tbody.addEventListener('click', function (e) {
          const btn = e.target.closest('[data-act]');
          if (btn) {
            e.stopPropagation();
            if (btn.dataset.act === 'expand') {
              const id = btn.dataset.id;
              const row = tbody.querySelector('tr.task-subrow[data-sub="' + id + '"]');
              if (row) {
                row.hidden = !row.hidden;
                st.expanded[id] = !row.hidden;
                btn.classList.toggle('open', !row.hidden);
              }
              return;
            }
            ACT.run(btn.dataset.act, btn.dataset.task, btn.dataset.sub);
            return;
          }
          const row = e.target.closest('tr.task-main-row');
          if (row) ACT.detail(row.dataset.id);
        });
      }

      const newBtn = document.getElementById('taskNewBtn');
      if (newBtn) newBtn.addEventListener('click', ACT.newTask);
      const expBtn = document.getElementById('taskExportBtn');
      if (expBtn) expBtn.addEventListener('click', ACT.exportTasks);
    }
  };

  ITO.taskActions = ACT;
  P.tasks.actions = ACT;
})();
