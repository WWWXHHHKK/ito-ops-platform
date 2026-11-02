/* ─────────────────────────────────────────────
   page · task center / dispatch engine
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const P = (window.ITO_PAGES = window.ITO_PAGES || {});
  const D = window.ITO_DATA;
  const ACT = {};

  const TASK_TAGS = D.taskTags || ['机房', '终端', 'KCC', 'KNS', 'DTT'];
  const AUTH_TYPES = D.authTypes || ['无需授权', '工作负责人授权', '准备工程师授权', '高风险作业授权'];
  const TASK_TYPES = ['巡检', '故障', '维保', '变更', '操作', '试验', '开发'];

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
          return s.owner === st.user.name && s.status !== '待派发' && s.status !== '待审批' && s.status !== '草稿';
        });
      });
    }

    if (f.group) list = list.filter(function (t) { return t.group === f.group; });
    if (f.level) list = list.filter(function (t) { return t.level === f.level; });

    if (f.status === '草稿') {
      list = list.filter(function (t) { return t.draft; });
    } else if (f.status === '超期') {
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
    let subs = 0, overdue = 0, pending = 0, drafts = 0;
    list.forEach(function (t) {
      if (t.draft) drafts += 1;
      visibleSubs(t).forEach(function (s) {
        subs += 1;
        if (U().isOverdue(s)) overdue += 1;
        if (s.status === '待派发' || s.status === '待审批' || s.status === '待接收') pending += 1;
      });
    });
    return { main: list.length, subs: subs, overdue: overdue, pending: pending, drafts: drafts };
  }

  function dueCell(due, status) {
    if (status === '草稿') return '<div class="due-cell done"><b>' + (due ? U().shortDate(due) : '—') + '</b><span>草稿待派发</span></div>';
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

  function authSummary(task) {
    const auths = [];
    task.subs.forEach(function (sub) {
      if (sub.auth && sub.auth !== '—' && auths.indexOf(sub.auth) === -1) auths.push(sub.auth);
    });
    if (!auths.length) return '<span class="muted">—</span>';
    return '<span class="tag-inline auth-inline">' + U().esc(auths[0]) + '</span>' +
      (auths.length > 1 ? '<span class="tag-more" title="' + U().esc(auths.join('、')) + '">+' + (auths.length - 1) + '</span>' : '');
  }

  function tagsCell(task) {
    const tags = task.tags || [];
    if (!tags.length) return '<span class="muted">—</span>';
    const shown = tags.slice(0, 2);
    return shown.map(function (tag) {
      return '<span class="tag-inline">' + U().esc(tag) + '</span>';
    }).join('') + (tags.length > 2 ? '<span class="tag-more" title="' + U().esc(tags.join('、')) + '">+' + (tags.length - 2) + '</span>' : '');
  }

  function draftActions(task) {
    return '<button class="btn btn-soft btn-sm" data-act="edit" data-task="' + task.id + '" type="button">编辑</button>' +
      '<button class="btn btn-danger btn-sm" data-act="delete" data-task="' + task.id + '" type="button">删除</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="detail" data-task="' + task.id + '" type="button">详情</button>';
  }

  function subActions(task, sub) {
    if (task.draft) {
      return '<button class="btn btn-ghost btn-sm" data-act="detail-sub" data-task="' + task.id + '" data-sub="' + sub.id + '" type="button">详情</button>';
    }
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
    if (task.draft) return '';
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
      return '<tr><td colspan="11">' + U().emptyState('没有匹配的任务', '调整筛选条件，或新建一个任务', 'task') + '</td></tr>';
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
          '<td style="white-space:nowrap">' + U().avatar(t.initiator, true) + U().esc(t.initiator || '—') + '</td>' +
          '<td style="white-space:nowrap">' + U().avatar(t.owner, true) + U().esc(t.owner) + '</td>' +
          '<td>' + authSummary(t) + '</td>' +
          '<td>' + tagsCell(t) + '</td>' +
          '<td>' + U().badge(t.level) + '</td>' +
          '<td>' + dueCell(t.due, status) + '</td>' +
          '<td><div class="progress-cell">' + U().progressBar(progress) + '<b>' + progress + '%</b></div></td>' +
          '<td>' + U().badge(status) + (over && status !== '已完成' && status !== '草稿' ? '<span class="overdue-mark" title="存在超期子任务">!</span>' : '') + '</td>' +
          '<td><div class="row-actions">' + (t.draft ? draftActions(t) : quickAction(t) +
            '<button class="btn btn-ghost btn-sm" data-act="detail" data-task="' + t.id + '" type="button">详情</button>') + '</div></td>' +
        '</tr>';

      const subRow =
        '<tr class="task-subrow" data-sub="' + t.id + '"' + (expanded ? '' : ' hidden') + '><td colspan="11"><div class="sub-list">' +
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
      (s.drafts ? '<i></i><span>草稿 <b>' + s.drafts + '</b></span>' : '') +
      '<span class="stats-spacer"></span><span class="stats-hint">' + (S().role === 'employee' ? '仅显示与我相关的任务' : '按当前筛选统计') + '</span></div>';
  }

  /* ── task detail drawer ──────────────────── */
  ACT.detail = function (taskId, subId) {
    const t = taskById(taskId);
    if (!t) return;
    const st = S();
    const focus = subId ? findSub(t, subId) : null;
    const mgr = st.role === 'leader' || st.role === 'manager';
    const auths = [];
    t.subs.forEach(function (s) {
      if (s.auth && s.auth !== '—' && auths.indexOf(s.auth) === -1) auths.push(s.auth);
    });
    const tickets = t.subs.filter(function (s) { return s.ticket; }).length;

    const events = st.logs.filter(function (l) {
      return l.target.indexOf(t.id) > -1 || l.target.indexOf(t.name) > -1;
    }).slice(0, 8);
    if (!events.length) {
      D.activity.filter(function (a) { return a.task === t.name; }).forEach(function (a) {
        events.push({ time: a.time, actor: a.owner, action: a.status, type: '任务' });
      });
    }
    if (!events.length) events.push({ time: t.due || D.meta.demoNow, actor: t.initiator || t.owner, action: '任务创建', type: '任务' });

    const subs = t.subs.map(function (s) {
      const subTags = (s.tags && s.tags.length ? s.tags : (s.tag ? [s.tag] : []));
      return '<tr><td class="mono">' + s.id + '</td>' +
        '<td><div class="cell-task"><b>' + U().esc(s.name) + '</b><small>' + U().esc(s.type) + ' · ' + (s.hours || 0) + 'h</small></div></td>' +
        '<td style="white-space:nowrap">' + U().esc(s.owner) + '</td>' +
        '<td>' + U().esc(s.auth || '—') + '</td>' +
        '<td>' + (s.ticket ? U().badge('需开票', 'yellow') : '<span class="muted">—</span>') + '</td>' +
        '<td>' + (subTags.length ? subTags.map(function (tag) { return '<span class="tag-inline">' + U().esc(tag) + '</span>'; }).join('') : '<span class="muted">—</span>') + '</td>' +
        '<td>' + U().badge(s.status) + '</td>' +
        '<td><div class="progress-cell">' + U().progressBar(s.progress) + '<b>' + s.progress + '%</b></div></td>' +
        '<td style="white-space:nowrap">' + U().shortDate(s.due) + '</td>' +
        '<td>' + subActions(t, s) + '</td></tr>';
    }).join('');

    const body =
      '<div class="detail-top">' + U().groupPill(t.group) + U().badge(t.level) + U().badge(U().mainStatus(t)) +
        '<span class="detail-id">' + t.id + '</span></div>' +
      (t.desc ? '<p class="detail-desc">' + U().esc(t.desc) + '</p>' : '') +
      '<div class="detail-grid">' +
        '<div class="detail-field"><label>专业组</label><div>' + U().esc((ITO.getGroup(t.group) || {}).name || '') + '</div></div>' +
        '<div class="detail-field"><label>负责人</label><div>' + U().esc(t.owner) + '</div></div>' +
        '<div class="detail-field"><label>发起人</label><div>' + U().esc(t.initiator || '—') + '</div></div>' +
        '<div class="detail-field"><label>任务来源</label><div>' + U().esc(sourceLabel(t)) + '</div></div>' +
        '<div class="detail-field"><label>任务类型</label><div>' + U().esc(t.type) + '</div></div>' +
        '<div class="detail-field"><label>优先级</label><div>' + U().esc(t.level) + '</div></div>' +
        '<div class="detail-field"><label>截止时间</label><div>' + U().esc(t.due || '—') + '</div></div>' +
        '<div class="detail-field"><label>整体进度</label><div>' + U().mainProgress(t) + '%</div></div>' +
        '<div class="detail-field"><label>任务标签</label><div>' + ((t.tags || []).length ? (t.tags || []).map(function (x) {
          return '<span class="tag-inline">' + U().esc(x) + '</span>';
        }).join('') : '<span class="muted">—</span>') + '</div></div>' +
        '<div class="detail-field"><label>授权汇总</label><div>' + (auths.length ? auths.map(function (a) {
          return '<span class="tag-inline">' + U().esc(a) + '</span>';
        }).join('') : '<span class="muted">—</span>') + '</div></div>' +
        '<div class="detail-field"><label>开票需求</label><div>' + (tickets ? tickets + ' 个子任务需开票' : '无需开票') + '</div></div>' +
      '</div>' +
      (focus ? '<div class="detail-section"><h4>当前关注子任务</h4><div class="focus-sub">' +
        '<b>' + focus.id + ' · ' + U().esc(focus.name) + '</b><span>' + U().esc(focus.owner) + ' · ' + focus.progress + '% · ' + U().esc(focus.due || '—') + '</span></div></div>' : '') +
      '<div class="detail-section"><h4>子任务（' + t.subs.length + '）</h4>' +
        '<div class="table-wrap"><table class="sub-table task-detail-sub"><thead><tr><th>编号</th><th>名称</th><th>执行人</th><th>授权</th><th>开票</th><th>标签</th><th>状态</th><th>进度</th><th>截止</th><th>操作</th></tr></thead><tbody>' +
        subs + '</tbody></table></div></div>' +
      '<div class="detail-section"><h4>操作记录</h4><div class="timeline">' +
        events.map(function (e) {
          return '<div class="timeline-item"><b>' + U().esc(e.action) + ' · ' + U().esc(e.actor) + '</b><span>' + U().esc(e.time) + ' · ' + U().esc(e.type) + '</span></div>';
        }).join('') + '</div></div>';

    const foot = t.draft
      ? '<button class="btn btn-ghost" data-detail-close type="button">关闭</button><span class="spacer"></span>' +
        '<button class="btn btn-danger" data-draft-delete type="button">删除草稿</button>' +
        '<button class="btn btn-primary" data-draft-edit type="button">编辑草稿</button>'
      : '<button class="btn btn-ghost" data-detail-close type="button">关闭</button>' +
        (mgr ? '<span class="spacer"></span><a class="btn btn-soft" href="#/dispatch">进入派发审批</a>' : '');

    U().drawer({
      title: t.name,
      sub: t.id + ' · ' + (ITO.getGroup(t.group) || {}).name,
      wide: true,
      body: body,
      foot: foot,
      onMount: function (c, root) {
        root.querySelector('[data-detail-close]').addEventListener('click', c);
        U().$$('[data-act]', root).forEach(function (btn) {
          btn.addEventListener('click', function () {
            c();
            ACT.run(btn.dataset.act, btn.dataset.task, btn.dataset.sub);
          });
        });
        const edit = root.querySelector('[data-draft-edit]');
        if (edit) edit.addEventListener('click', function () { c(); ACT.openTaskForm(t.id); });
        const del = root.querySelector('[data-draft-delete]');
        if (del) del.addEventListener('click', function () { c(); ACT.deleteDraft(t.id); });
      }
    });
  };


  /* ── task create / split / draft ─────────── */
  function localDue(days) {
    const d = pd(D.meta.today);
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T18:00';
  }

  function dueInput(value) {
    if (!value) return '';
    return String(value).slice(0, 16).replace(' ', 'T');
  }

  function sourceOf(t) {
    if (t.source) return t.source;
    if (t.initiator === '张总') return 'leader';
    if (t.initiator === '系统') return 'system';
    return 'self';
  }

  function sourceLabel(t) {
    const source = sourceOf(t);
    return source === 'leader' ? '领导下发' : source === 'system' ? '系统生成' : '主管自建';
  }

  function tagChips(tags, max) {
    const list = tags || [];
    if (!list.length) return '<span class="muted">未选择</span>';
    const shown = max ? list.slice(0, max) : list;
    return shown.map(function (tag) {
      return '<span class="tag-inline">' + U().esc(tag) + '</span>';
    }).join('') + (max && list.length > max
      ? '<span class="tag-more" title="' + U().esc(list.join('、')) + '">+' + (list.length - max) + '</span>'
      : '');
  }

  function blankRow(owner) {
    return {
      id: '', name: '', type: '操作', hours: 4, owner: owner,
      auth: '无需授权', ticket: false, due: localDue(3), tags: []
    };
  }

  function openTagPicker(root, title, selected, done) {
    const shell = root.querySelector('.modal');
    if (!shell) return;
    const current = selected.slice();
    const mask = document.createElement('div');
    mask.className = 'tag-pop-mask';
    mask.innerHTML =
      '<div class="tag-pop" role="dialog" aria-label="' + U().esc(title) + '">' +
        '<div class="tag-pop-head"><b>' + U().esc(title) + '</b><span>可多选 · 不限数量</span></div>' +
        '<div class="tag-pop-body">' + TASK_TAGS.map(function (tag) {
          return '<button class="tag-option' + (current.indexOf(tag) > -1 ? ' is-on' : '') + '" data-tag="' + U().esc(tag) + '" type="button">' + U().esc(tag) + '</button>';
        }).join('') + '</div>' +
        '<div class="tag-pop-foot"><span>已选 <b>0</b> 项</span><span class="spacer"></span>' +
          '<button class="btn btn-ghost btn-sm" data-tag-cancel type="button">取消</button>' +
          '<button class="btn btn-primary btn-sm" data-tag-done type="button">确定</button></div>' +
      '</div>';
    shell.appendChild(mask);

    const count = mask.querySelector('.tag-pop-foot b');
    const paint = function () { count.textContent = current.length; };
    paint();

    mask.addEventListener('click', function (e) {
      if (e.target === mask) { mask.remove(); return; }
      const opt = e.target.closest('[data-tag]');
      if (opt) {
        const tag = opt.dataset.tag;
        const idx = current.indexOf(tag);
        if (idx > -1) current.splice(idx, 1); else current.push(tag);
        opt.classList.toggle('is-on', idx === -1);
        paint();
        return;
      }
      if (e.target.closest('[data-tag-cancel]')) { mask.remove(); return; }
      if (e.target.closest('[data-tag-done]')) { mask.remove(); done(current); }
    });
  }

  ACT.openTaskForm = function (taskId) {
    const st = S();
    const editing = taskId ? taskById(taskId) : null;
    if (editing && !editing.draft) { ACT.detail(taskId); return; }

    const ownGroup = st.groups.find(function (g) { return g.manager === st.user.name; });
    const groupId = editing ? editing.group : (ownGroup ? ownGroup.id : (st.groups[0] || {}).id || 'app');
    let currentGroup = groupId;
    const group = st.groups.find(function (g) { return g.id === groupId; });
    const managerName = (group && group.manager) || st.user.name;
    const defaultSource = editing ? sourceOf(editing) : (st.role === 'leader' ? 'leader' : 'self');
    const leaders = [D.roleInfo.leader.name];
    if (st.user.name !== leaders[0] && st.role === 'leader') leaders.unshift(st.user.name);

    let source = defaultSource;
    let mainTags = (editing && editing.tags ? editing.tags : []).slice();
    let rows = editing && editing.subs.length
      ? editing.subs.map(function (s) {
          return {
            id: s.id, name: s.name, type: s.type || '操作', hours: s.hours || 4,
            owner: s.owner || managerName, auth: s.auth || '无需授权', ticket: !!s.ticket,
            due: dueInput(s.due) || localDue(3), tags: (s.tags || []).slice()
          };
        })
      : [blankRow(managerName)];

    const body =
      '<div class="task-form">' +
        '<div class="task-source">' +
          '<span class="task-source-label">任务来源</span>' +
          '<div class="seg-toggle" id="ntSource">' +
            '<button type="button" data-source="leader">领导下发</button>' +
            '<button type="button" data-source="self">主管自建</button>' +
          '</div>' +
          '<span class="task-source-hint" id="ntSourceHint"></span>' +
        '</div>' +
        '<div class="form-grid cols-3">' +
          '<div class="form-field span-2"><label>任务名称 <em>*</em></label>' +
            '<input id="ntName" type="text" maxlength="48" placeholder="例如：核心机房季度巡检与整改" value="' + U().esc(editing ? editing.name : '') + '"></div>' +
          '<div class="form-field"><label>任务等级</label>' +
            '<select id="ntLevel">' + U().statusOptions(['重要', '一般', '紧急'], editing ? editing.level : '重要') + '</select></div>' +
          '<div class="form-field"><label>专业组 <em>*</em></label>' +
            '<select id="ntGroup">' + U().groupOptions(groupId) + '</select></div>' +
          '<div class="form-field"><label>负责人 <em>*</em></label>' +
            '<select id="ntOwner">' + U().peopleOptions(groupId, editing ? editing.owner : managerName) + '</select></div>' +
          '<div class="form-field"><label>发起人</label><select id="ntInitiator"></select></div>' +
          '<div class="form-field span-2"><label>任务标签</label><div class="tag-field" id="ntTags"></div></div>' +
          '<div class="form-field"><label>发布日期</label><div class="static-field">' + U().esc(D.meta.today) + '</div></div>' +
          '<div class="form-field full"><label>任务描述</label>' +
            '<textarea id="ntDesc" placeholder="补充背景、交付物与验收标准">' + U().esc(editing ? (editing.desc || '') : '') + '</textarea></div>' +
        '</div>' +
        '<div class="subtask-head">' +
          '<div><h4>任务拆分</h4><span>共 <b id="ntSubCount">' + rows.length + '</b> 个子任务 · 每个子任务独立设置执行人、授权、开票与标签</span></div>' +
          '<button class="btn btn-soft btn-sm" id="ntAddRow" type="button">' + U().icon('plus') + '添加子任务行</button>' +
        '</div>' +
        '<div class="subtask-wrap">' +
          '<table class="subtask-table">' +
            '<thead><tr><th>子任务名称 <em>*</em></th><th>类型</th><th>预估工时</th><th>执行人 <em>*</em></th><th>授权</th><th>开票</th><th>截止时间 <em>*</em></th><th>任务标签</th><th></th></tr></thead>' +
            '<tbody id="ntSubBody"></tbody>' +
          '</table>' +
        '</div>' +
      '</div>';

    const foot =
      '<button class="btn btn-ghost" data-cancel type="button">取消</button>' +
      '<span class="spacer"></span>' +
      '<span class="draft-hint">草稿不进入在办、超期与趋势统计</span>' +
      '<button class="btn btn-soft" data-draft type="button">保存草稿</button>' +
      '<button class="btn btn-primary" data-publish type="button">' + (editing ? '确认派发' : '创建并派发') + '</button>';

    U().modal({
      title: editing ? '编辑草稿任务' : '新建任务',
      sub: editing ? editing.id + ' · 草稿可继续拆分，确认派发后进入执行流程' : '创建时直接拆分子任务 · 保存草稿或直接派发',
      xwide: true,
      body: body,
      foot: foot,
      onMount: function (close, root) {
        const nameInput = root.querySelector('#ntName');
        const groupSel = root.querySelector('#ntGroup');
        const ownerSel = root.querySelector('#ntOwner');
        const levelSel = root.querySelector('#ntLevel');
        const initSel = root.querySelector('#ntInitiator');
        const descEl = root.querySelector('#ntDesc');
        const tagsBox = root.querySelector('#ntTags');
        const tbody = root.querySelector('#ntSubBody');
        const hint = root.querySelector('#ntSourceHint');
        const sourceBtns = U().$$('#ntSource [data-source]', root);

        function rowHtml(row, i) {
          return '<tr data-row="' + i + '">' +
            '<td><input class="cell-input" data-f="name" type="text" maxlength="40" placeholder="子任务名称" value="' + U().esc(row.name) + '"></td>' +
            '<td><select class="cell-select" data-f="type">' + U().statusOptions(TASK_TYPES, row.type) + '</select></td>' +
            '<td><input class="cell-input num" data-f="hours" type="number" min="0.5" max="200" step="0.5" value="' + row.hours + '"></td>' +
            '<td><select class="cell-select" data-f="owner">' + U().peopleOptions(currentGroup, row.owner) + '</select></td>' +
            '<td><select class="cell-select" data-f="auth">' + U().statusOptions(AUTH_TYPES, row.auth) + '</select></td>' +
            '<td class="cell-center"><label class="ticket-check" title="是否需要开票"><input type="checkbox" data-f="ticket"' + (row.ticket ? ' checked' : '') + '><span></span></label></td>' +
            '<td><input class="cell-input" data-f="due" type="datetime-local" value="' + U().esc(row.due) + '"></td>' +
            '<td><div class="sub-tags" data-row-tags="' + i + '"></div></td>' +
            '<td class="cell-center"><button class="row-del" data-del-row="' + i + '" type="button" aria-label="删除子任务">' + U().icon('trash') + '</button></td>' +
          '</tr>';
        }

        function paintRowTags(i) {
          const cell = root.querySelector('[data-row-tags="' + i + '"]');
          if (!cell) return;
          cell.innerHTML = tagChips(rows[i].tags, 2) +
            '<button class="tag-add" data-tag-row="' + i + '" type="button" aria-label="选择标签">+</button>';
        }

        function renderRows() {
          tbody.innerHTML = rows.map(rowHtml).join('');
          rows.forEach(function (_, i) { paintRowTags(i); });
          const count = root.querySelector('#ntSubCount');
          if (count) count.textContent = rows.length;
        }

        function syncRows() {
          U().$$('#ntSubBody tr[data-row]', root).forEach(function (tr) {
            const row = rows[Number(tr.dataset.row)];
            if (!row) return;
            row.name = tr.querySelector('[data-f="name"]').value.trim();
            row.type = tr.querySelector('[data-f="type"]').value;
            row.hours = Number(tr.querySelector('[data-f="hours"]').value) || 0;
            row.owner = tr.querySelector('[data-f="owner"]').value;
            row.auth = tr.querySelector('[data-f="auth"]').value;
            row.ticket = tr.querySelector('[data-f="ticket"]').checked;
            row.due = tr.querySelector('[data-f="due"]').value;
          });
        }

        function paintInitiator() {
          sourceBtns.forEach(function (btn) { btn.classList.toggle('is-on', btn.dataset.source === source); });
          if (source === 'leader') {
            initSel.disabled = false;
            const selected = currentInitiator();
            initSel.innerHTML = leaders.map(function (name) {
              return '<option value="' + U().esc(name) + '"' + (name === selected ? ' selected' : '') + '>' + U().esc(name) + ' · 领导下发</option>';
            }).join('');
            hint.textContent = '发起人关联领导下发记录，负责人与执行人仍由专业组安排。';
          } else {
            initSel.disabled = true;
            initSel.innerHTML = '<option value="' + U().esc(st.user.name) + '">' + U().esc(st.user.name) + ' · 当前登录人</option>';
            hint.textContent = '发起人默认为当前主管，可同时担任负责人与执行人。';
          }
        }

        function currentInitiator() {
          if (source === 'self') return st.user.name;
          if (editing && editing.initiator && leaders.indexOf(editing.initiator) > -1) return editing.initiator;
          return st.user.name === leaders[0] ? st.user.name : '张总';
        }

        function paintMainTags() {
          tagsBox.innerHTML = tagChips(mainTags) +
            '<button class="tag-add" data-tag-main type="button">' + (mainTags.length ? '+' : '选择标签') + '</button>';
        }

        renderRows();
        paintMainTags();
        paintInitiator();

        sourceBtns.forEach(function (btn) {
          btn.addEventListener('click', function () {
            source = btn.dataset.source;
            paintInitiator();
          });
        });

        groupSel.addEventListener('change', function () {
          syncRows();
          currentGroup = groupSel.value;
          const g = st.groups.find(function (x) { return x.id === currentGroup; });
          const nextManager = (g && g.manager) || st.user.name;
          ownerSel.innerHTML = U().peopleOptions(currentGroup, nextManager);
          rows = rows.map(function (row) {
            row.owner = nextManager;
            return row;
          });
          renderRows();
        });

        tagsBox.addEventListener('click', function (e) {
          if (!e.target.closest('[data-tag-main]')) return;
          openTagPicker(root, '任务标签', mainTags, function (picked) {
            mainTags = picked;
            paintMainTags();
          });
        });

        root.querySelector('#ntAddRow').addEventListener('click', function () {
          syncRows();
          const g = st.groups.find(function (x) { return x.id === currentGroup; });
          rows.push(blankRow((g && g.manager) || st.user.name));
          renderRows();
          if (tbody.lastElementChild) tbody.lastElementChild.scrollIntoView({ block: 'nearest' });
        });

        tbody.addEventListener('click', function (e) {
          const del = e.target.closest('[data-del-row]');
          if (del) {
            syncRows();
            const i = Number(del.dataset.delRow);
            if (rows.length <= 1) {
              const g = st.groups.find(function (x) { return x.id === currentGroup; });
              rows = [blankRow((g && g.manager) || st.user.name)];
            } else {
              rows.splice(i, 1);
            }
            renderRows();
            return;
          }
          const tagBtn = e.target.closest('[data-tag-row]');
          if (tagBtn) {
            syncRows();
            const i = Number(tagBtn.dataset.tagRow);
            openTagPicker(root, '子任务标签 · ' + (rows[i].name || '未命名'), rows[i].tags, function (picked) {
              rows[i].tags = picked;
              paintRowTags(i);
            });
          }
        });

        function save(isDraft) {
          syncRows();
          const name = nameInput.value.trim();
          if (!name) {
            U().toast('请填写任务名称', 'warn');
            nameInput.focus();
            return;
          }
          const level = levelSel.value;
          const owner = ownerSel.value;
          const initiator = source === 'leader' ? initSel.value : st.user.name;

          let kept = rows.slice();
          if (isDraft) {
            kept = kept.filter(function (row) { return row.name || row.tags.length || row.ticket; });
          } else {
            if (!kept.length) { U().toast('请至少拆分一个子任务', 'warn'); return; }
            for (let i = 0; i < kept.length; i += 1) {
              const row = kept[i];
              if (!row.name) { U().toast('第 ' + (i + 1) + ' 行子任务名称未填写', 'warn'); return; }
              if (!row.owner) { U().toast('第 ' + (i + 1) + ' 行执行人未选择', 'warn'); return; }
              if (!row.due) { U().toast('第 ' + (i + 1) + ' 行截止时间未填写', 'warn'); return; }
            }
          }

          const baseId = editing ? editing.id : 'T' + (st.taskSeq++);
          const subs = kept.map(function (row, i) {
            return {
              id: baseId + '-' + String(i + 1).padStart(2, '0'),
              name: row.name || '未命名子任务',
              group: currentGroup, owner: row.owner, initiator: initiator,
              level: level, type: row.type, status: isDraft ? '草稿' : '待派发',
              due: (row.due || '').replace('T', ' '),
              hours: row.hours || 4, progress: 0,
              auth: row.auth || '无需授权', ticket: !!row.ticket, tags: row.tags.slice()
            };
          });
          const dues = subs.map(function (s) { return s.due; }).filter(Boolean).sort();
          const due = dues.length ? dues[dues.length - 1] : '';
          const type = subs.length > 1 ? '综合' : (subs[0] ? subs[0].type : '待定');
          const record = {
            id: baseId, name: name, group: currentGroup, owner: owner,
            initiator: initiator, source: source, level: level, type: type,
            due: due, tags: mainTags.slice(),
            desc: descEl.value.trim() || '待补充任务背景与验收标准。',
            draft: isDraft, subs: subs
          };

          if (editing) Object.assign(editing, record);
          else st.tasks.unshift(record);

          if (!isDraft) {
            st.metrics.active += 1;
            st.metrics.groupActive[currentGroup] = (st.metrics.groupActive[currentGroup] || 0) + 1;
            st.metrics.newTasks += 1;
            st.trend.newTasks[st.trend.newTasks.length - 1] += 1;
          }

          ITO.log(
            isDraft ? (editing ? '更新任务草稿' : '保存任务草稿') : (editing ? '派发草稿任务' : '新建并派发任务'),
            baseId + ' ' + name + ' · ' + subs.length + ' 个子任务',
            '任务'
          );

          st.taskFilters.q = '';
          st.taskFilters.group = '';
          st.taskFilters.level = '';
          st.taskFilters.status = isDraft ? '草稿' : '';

          close();
          U().toast(isDraft ? '草稿已保存，可稍后继续拆分' : '任务已创建并进入派发队列');
          ITO.refresh();
        }

        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-draft]').addEventListener('click', function () { save(true); });
        root.querySelector('[data-publish]').addEventListener('click', function () { save(false); });
        nameInput.focus();
      }
    });
  };

  ACT.newTask = function () {
    ACT.openTaskForm();
  };

  ACT.deleteDraft = function (taskId) {
    const t = taskById(taskId);
    if (!t || !t.draft) return;
    U().confirm({
      title: '删除草稿任务',
      text: (t.subs.length
        ? '将删除「' + t.name + '」及其 ' + t.subs.length + ' 个子任务草稿。'
        : '将删除草稿「' + t.name + '」。') + '该操作不会影响在办、超期与趋势统计。',
      okText: '删除草稿',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      const st = S();
      const idx = st.tasks.indexOf(t);
      if (idx > -1) st.tasks.splice(idx, 1);
      ITO.log('删除任务草稿', t.id + ' ' + t.name, '任务');
      U().toast('草稿已删除', 'warn');
      ITO.refresh();
    });
  };

  /* ── dispatch ────────────────────────────── */
  ACT.openDispatch = function (taskId, subId) {
    const t = taskById(taskId);
    if (!t) return;
    const sub = findSub(t, subId);
    if (!sub) return;
    const st = S();
    const authOptions = AUTH_TYPES;
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
    else if (act === 'edit') ACT.openTaskForm(taskId);
    else if (act === 'delete') ACT.deleteDraft(taskId);
  };

  ACT.exportTasks = function () {
    const list = visibleTasks();
    const rows = [['主任务编号', '主任务', '子任务编号', '子任务', '专业组', '发起人', '任务来源', '负责人', '优先级', '状态', '子任务授权', '需要开票', '主任务标签', '进度', '截止时间']];
    list.forEach(function (t) {
      visibleSubs(t).forEach(function (s) {
        rows.push([
          t.id, t.name, s.id, s.name, (ITO.getGroup(s.group) || {}).name,
          t.initiator || '', sourceLabel(t), s.owner, s.level, s.status,
          s.auth || '—', s.ticket ? '是' : '否', (t.tags || []).join(' / '),
          s.progress + '%', s.due
        ]);
      });
    });
    U().download('ITO任务清单-' + D.meta.today + '.csv', U().csv(rows));
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
      const statusList = ['', '草稿', '待派发', '待审批', '待接收', '执行中', '已完成', '超期'];
      const statusLabels = { '': '全部状态', '草稿': '草稿', '待派发': '待派发', '待审批': '待审批', '待接收': '待接收', '执行中': '执行中', '已完成': '已完成', '超期': '仅超期' };

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
          '<thead><tr><th>任务</th><th>专业组</th><th>发起人</th><th>负责人</th><th>授权</th><th>标签</th><th>优先级</th><th>截止时间</th><th>进度</th><th>状态</th><th style="text-align:right">操作</th></tr></thead>' +
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
