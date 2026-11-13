/* ─────────────────────────────────────────────
   page · task center / dispatch engine
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const P = (window.ITO_PAGES = window.ITO_PAGES || {});
  const D = window.ITO_DATA;
  const ACT = {};

  const AUTH_TYPES = D.authTypes || ['无需授权', '工作负责人授权', '准备工程师授权', '高风险作业授权'];
  const TASK_TYPES = ['巡检', '故障', '维保', '变更', '操作', '试验', '开发', '工单', '综合'];
  const TASK_OTHER_TYPES = ['操作', '试验', '工单', '综合', '故障'];
  const LEVELS = ['紧急', '重要', '一般'];
  const TERMINAL = ['已完成', '已取消'];

  function S() { return ITO.state; }
  function U() { return ITO.ui; }
  function taskTagNames() {
    const names = (S().wallTags || [])
      .filter(function (tag) { return tag.type === '任务标签'; })
      .map(function (tag) { return tag.name; });
    (D.systemGroups || []).forEach(function (group) {
      (group.systems || []).forEach(function (name) {
        if (names.indexOf(name) === -1) names.push(name);
      });
    });
    return names;
  }

  function systemAliasSet() {
    const out = {};
    Object.keys(D.systemAliases || {}).forEach(function (system) {
      (D.systemAliases[system] || []).forEach(function (alias) { out[alias] = true; });
    });
    return out;
  }

  function matchesSystemTag(tag, system) {
    if (tag === system) return true;
    const aliases = (D.systemAliases && D.systemAliases[system]) || [];
    return aliases.indexOf(tag) > -1;
  }

  function taskSystemTags(task) {
    const values = [];
    const push = function (list) {
      (list || []).forEach(function (tag) {
        if (values.indexOf(tag) === -1) values.push(tag);
      });
    };
    push(task.tags);
    (task.subs || []).forEach(function (sub) { push(sub.tags); });
    return values;
  }

  function taskMatchesSystems(task, selected) {
    if (!selected || !selected.length) return true;
    const tags = taskSystemTags(task);
    return selected.some(function (system) {
      return tags.some(function (tag) { return matchesSystemTag(tag, system); });
    });
  }
  function pd(str) { return new Date(String(str).replace(/-/g, '/').replace('T', ' ')); }
  function now() { return D.meta.demoNow; }

  function hashQuery() {
    const raw = (location.hash.split('?')[1] || '');
    const out = {};
    raw.split('&').forEach(function (pair) {
      if (!pair) return;
      const i = pair.indexOf('=');
      const k = decodeURIComponent(i < 0 ? pair : pair.slice(0, i));
      const v = decodeURIComponent(i < 0 ? '' : pair.slice(i + 1));
      out[k] = v;
    });
    return out;
  }

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

  function taskOverdue(task) {
    if (!task.subs.length) return U().isOverdue(task);
    return visibleSubs(task).some(function (s) { return U().isOverdue(s); });
  }

  function taskLateClosed(task) {
    if (!task.subs.length) return U().isLateClosed(task);
    return visibleSubs(task).some(function (s) { return U().isLateClosed(s); });
  }

  function taskAgeBucket(task) {
    if (!task.subs.length) return overdueBucket(task);
    return visibleSubs(task).map(function (s) { return overdueBucket(s); });
  }

  function overdueBucket(sub) {
    if (!U().isOverdue(sub)) return '';
    const hours = (new Date(D.meta.demoNow.replace(/-/g, '/')) - new Date(String(sub.due).replace(/-/g, '/'))) / 3600000;
    if (hours < 24) return 'lt1';
    if (hours < 72) return '1to3';
    if (hours < 120) return '3to5';
    return 'gte5';
  }

  function visibleTasks() {
    const st = S();
    const f = st.taskFilters;
    let list = st.tasks;

    if (st.role === 'employee') {
      list = list.filter(function (t) {
        if (!t.subs.length) {
          return t.owner === st.user.name && !t.draft && !t.canceled && t.status !== '已取消';
        }
        return t.subs.some(function (s) {
          return s.owner === st.user.name && ['草稿', '待分发', '已取消'].indexOf(s.status) === -1;
        });
      });
    }

    if (f.group) list = list.filter(function (t) { return t.group === f.group; });
    if (f.level) list = list.filter(function (t) { return t.level === f.level; });

    if (f.status === '草稿') {
      list = list.filter(function (t) { return t.draft; });
    } else if (f.status === '超期') {
      list = list.filter(function (t) { return taskOverdue(t) || taskLateClosed(t); });
    } else if (f.status) {
      list = list.filter(function (t) { return U().displayStatus(t) === f.status; });
    }

    if (f.type) {
      let typeMatch = [f.type];
      if (f.type === '其他') typeMatch = TASK_OTHER_TYPES;
      list = list.filter(function (t) { return typeMatch.indexOf(t.type) > -1; });
    }
    if (f.age) {
      list = list.filter(function (t) {
        const buckets = taskAgeBucket(t);
        return Array.isArray(buckets) ? buckets.indexOf(f.age) > -1 : buckets === f.age;
      });
    }
    if (ITO.customFieldMatch && f.custom && Object.keys(f.custom).some(function (k) { return !!f.custom[k]; })) {
      list = list.filter(function (t) { return ITO.customFieldMatch('task', t, f.custom); });
    }
    if (f.systems && f.systems.length) {
      list = list.filter(function (t) { return taskMatchesSystems(t, f.systems); });
    }

    if (f.q) {
      const q = f.q.toLowerCase();
      list = list.filter(function (t) {
        const hay = [t.id, t.name, t.owner, t.initiator, t.type, (t.tags || []).join(' ')]
          .concat(t.subs.map(function (s) { return s.id + ' ' + s.name + ' ' + s.owner; }))
          .join(' ').toLowerCase();
        return hay.indexOf(q) > -1;
      });
    }
    return list;
  }

  function stats(list) {
    let subs = 0, overdue = 0, approval = 0, hung = 0, drafts = 0, canceled = 0, completed = 0, late = 0;
    list.forEach(function (t) {
      if (t.draft) drafts += 1;
      const ds = U().displayStatus(t);
      if (ds === '已取消') canceled += 1;
      if (ds === '已完成') completed += 1;
      if (ds === '审批中') approval += 1;
      if (ds === '已挂起') hung += 1;
      if (!t.subs.length) {
        if (taskOverdue(t)) overdue += 1;
        if (taskLateClosed(t)) late += 1;
      } else {
        visibleSubs(t).forEach(function (s) {
          subs += 1;
          if (U().isOverdue(s)) overdue += 1;
          if (U().isLateClosed(s)) late += 1;
        });
      }
    });
    return { main: list.length, subs: subs, overdue: overdue, late: late, allOverdue: overdue + late, approval: approval, hung: hung, drafts: drafts, canceled: canceled, completed: completed };
  }

  function formatMins(mins) {
    const abs = Math.abs(Math.round(mins));
    if (abs < 60) return abs + ' 分钟';
    if (abs < 1440) return Math.round(abs / 60) + ' 小时';
    return Math.round(abs / 1440) + ' 天';
  }

  function remainingText(dueAt) {
    if (!dueAt) return '—';
    const diff = Math.round((pd(dueAt) - pd(now())) / 60000);
    return diff < 0 ? '已超时 ' + formatMins(diff) : '剩余 ' + formatMins(diff);
  }

  function dueCell(due, status) {
    if (status === '草稿') return '<div class="due-cell done"><b>' + (due ? U().shortDate(due) : '—') + '</b><span>草稿待提交</span></div>';
    if (status === '已取消') return '<div class="due-cell done"><b>' + (due ? U().shortDate(due) : '—') + '</b><span>已取消</span></div>';
    if (status === '已完成') return '<div class="due-cell done"><b>' + U().shortDate(due) + '</b><span>已闭环</span></div>';
    const diff = Math.round((pd(due) - pd(now())) / 60000);
    return '<div class="due-cell' + (diff < 0 ? ' over' : '') + '"><b>' + U().shortDate(due) + '</b><span>' +
      (diff < 0 ? '超期 ' + formatMins(diff) : '剩余 ' + formatMins(diff)) + '</span></div>';
  }

  function authSummary(task) {
    const auths = [];
    task.subs.forEach(function (sub) {
      if (sub.auth && sub.auth !== '—' && sub.auth !== '无需授权' && auths.indexOf(sub.auth) === -1) auths.push(sub.auth);
    });
    if (!auths.length) return '<span class="muted">—</span>';
    return '<span class="tag-inline auth-inline">' + U().esc(auths[0]) + '</span>' +
      (auths.length > 1 ? '<span class="tag-more" title="' + U().esc(auths.join('、')) + '">+' + (auths.length - 1) + '</span>' : '');
  }

  function tagsCell(task) {
    const tags = task.tags || [];
    if (!tags.length) return '<span class="muted">—</span>';
    return tags.slice(0, 2).map(function (tag) {
      return '<span class="tag-inline">' + U().esc(tag) + '</span>';
    }).join('') + (tags.length > 2 ? '<span class="tag-more" title="' + U().esc(tags.join('、')) + '">+' + (tags.length - 2) + '</span>' : '');
  }

  function sourceOf(t) {
    if (t.source) return t.source;
    if (t.initiator === D.roleInfo.leader.name) return 'leader';
    if (t.initiator === '系统') return 'system';
    return 'self';
  }

  function sourceLabel(t) {
    const source = sourceOf(t);
    return source === 'leader' ? '领导下发' : source === 'system' ? '系统生成' : '主管自建';
  }

  function modeLabel(t) {
    if (t.mode === 'single') return '未拆分';
    return t.subs.length + ' 个任务';
  }

  function canManage(task) {
    const st = S();
    if (!st.user) return false;
    return ITO.roleIs('manager');
  }

  function canEditTask(task) {
    const st = S();
    if (!st.user) return false;
    if (!ITO.roleIs('leader', 'manager')) return false;
    return U().isTaskEditable(task);
  }

  function canLogWork(task, sub) {
    const st = S();
    if (!st.user || !sub || task.draft || task.canceled) return false;
    if (ITO.isSuper()) return true;
    if (sub.owner === st.user.name) return true;
    return ITO.roleIs('leader', 'manager');
  }

  function canDirectClose(task, sub) {
    if (!sub || sub.status === '已完成' || sub.status === '已取消') return false;
    return ITO.isSuper() || ITO.roleIs('leader', 'manager');
  }

  const DELIVERABLE_EDITABLE_STATUS = ['执行中', '审批中', '已挂起', '已完成'];

  function employeeEditTarget(task) {
    const st = S();
    if (!window.DeliverableStore) return null;
    const PRIORITY = { '审批中': 4, '已挂起': 3, '执行中': 2, '已完成': 1 };
    let best = null;
    visibleSubs(task).forEach(function (sub) {
      if (sub.owner !== st.user.name) return;
      const rec = window.DeliverableStore.getLatestSubmission(sub.id);
      if (!rec || !rec.files.length) return;
      const priority = PRIORITY[sub.status] || 0;
      if (!best ||
        priority > best.priority ||
        (priority === best.priority && String(rec.submittedAt || '') >= String(best.rec.submittedAt || ''))) {
        best = { sub: sub, rec: rec, priority: priority };
      }
    });
    return best;
  }

  function editAction(task) {
    const st = S();
    if (!st.user) return '';
    if (!task.subs.length) return '';
    if (ITO.roleIs('leader', 'manager')) {
      if (U().mainStatus(task) === '已完成') return '';
      const enabled = canEditTask(task);
      return '<button class="btn btn-soft btn-sm" type="button"' +
        (enabled
          ? ' data-act="edit" data-task="' + task.id + '"'
          : ' disabled title="当前状态不可编辑"') +
        '>编辑</button>';
    }
    if (st.role === 'employee') {
      const target = employeeEditTarget(task);
      let enabled = false;
      let title = '暂无可编辑成果物';
      let subId = '';
      if (target) {
        if (DELIVERABLE_EDITABLE_STATUS.indexOf(target.sub.status) > -1) {
          enabled = true;
          subId = target.sub.id;
        } else {
          title = '当前状态不可编辑';
        }
      }
      return '<button class="btn btn-soft btn-sm" type="button"' +
        (enabled
          ? ' data-act="edit-deliverable" data-task="' + task.id + '" data-sub="' + U().esc(subId) + '"'
          : ' disabled title="' + title + '"') +
        '>编辑</button>';
    }
    return '';
  }

  function canLeaderApprove(task) {
    const st = S();
    const la = task.leaderApproval;
    if (!la) return false;
    return ITO.isSuper() || la.approver === st.user.name || st.role === 'leader';
  }

  function isOwnerOrInitiator(task) {
    const st = S();
    if (!st.user) return false;
    return ITO.roleIs('manager');
  }

  function subDeliverableAction(task, sub) {
    const rec = window.DeliverableStore ? window.DeliverableStore.getLatestSubmission(sub.id) : null;
    if (!rec || !rec.files.length) return '';
    return '<button class="btn btn-ghost btn-sm" data-act="deliverables" data-task="' + task.id + '" data-sub="' + sub.id + '" type="button">查看成果物</button>';
  }

  function subActions(task, sub) {
    const st = S();
    if (task.draft || task.canceled) return '<span class="muted">—</span>';
    let out = '';
    const editable = sub.status !== '已完成';
    if ((sub.owner === st.user.name || ITO.isSuper()) && sub.status === '执行中') {
      out += '<button class="btn btn-primary btn-sm" data-act="submit" data-task="' + task.id + '" data-sub="' + sub.id + '" type="button">提交成果</button>';
    }
    if ((sub.owner === st.user.name || ITO.isSuper()) && sub.status === '已挂起') {
      out += '<button class="btn btn-soft btn-sm" data-act="resubmit" data-task="' + task.id + '" data-sub="' + sub.id + '" type="button">重新提交</button>';
    }
    if (editable && canLogWork(task, sub)) {
      out += '<button class="btn btn-ghost btn-sm" data-act="log-hours" data-task="' + task.id + '" data-sub="' + sub.id + '" type="button">补录工时</button>';
    }
    if (editable && canLogWork(task, sub) && ITO.fieldDefsFor && ITO.fieldDefsFor('task', 'sub').length) {
      out += '<button class="btn btn-ghost btn-sm" data-act="edit-sub-fields" data-task="' + task.id + '" data-sub="' + sub.id + '" type="button">执行字段</button>';
    }
    if (editable && canLogWork(task, sub) && ['待分发', '执行中', '已挂起'].indexOf(sub.status) > -1) {
      out += '<button class="btn btn-ghost btn-sm" data-act="update-progress" data-task="' + task.id + '" data-sub="' + sub.id + '" type="button">更新进度</button>';
    }
    if (canDirectClose(task, sub)) {
      out += '<button class="btn btn-soft btn-sm" data-act="close-sub" data-task="' + task.id + '" data-sub="' + sub.id + '" type="button">直接闭环</button>';
    }
    if (canManage(task) && ['待分发', '执行中'].indexOf(sub.status) > -1) {
      out += '<button class="btn btn-ghost btn-sm" data-act="reassign" data-task="' + task.id + '" data-sub="' + sub.id + '" type="button">改派</button>';
    }
    out += subDeliverableAction(task, sub);
    return out || '<span class="muted">—</span>';
  }

  function rowActions(task) {
    return editAction(task) + deliverableAction(task);
  }

  function deliverableCount(task) {
    if (!window.DeliverableStore) return 0;
    let count = 0;
    visibleSubs(task).forEach(function (s) {
      const rec = window.DeliverableStore.getLatestSubmission(s.id);
      if (rec) count += rec.files.length;
    });
    if (S().role !== 'employee') {
      const summary = window.DeliverableStore.getLatestSummary(task.id);
      if (summary) count += summary.files.length;
    }
    return count;
  }

  function deliverableAction(task) {
    const count = deliverableCount(task);
    if (!count) {
      return '<button class="btn btn-ghost btn-sm" type="button" disabled title="暂无成果物">查看成果物</button>';
    }
    return '<button class="btn btn-ghost btn-sm" data-act="deliverables" data-task="' + task.id + '" type="button">查看成果物</button>';
  }

  function customFilterHtml(f, value) {
    const vals = f.source === 'dict'
      ? ITO.dictValues(f.dictId, true)
      : ((f.type === 'select' || f.type === 'multiselect') ? String(f.options || '').split(/[\n,，、]/).map(function (s) { return s.trim(); }).filter(Boolean) : []);
    if (vals.length && f.type === 'multiselect') {
      const selected = (Array.isArray(value) ? value : String(value || '').split(/[,，]/)).map(function (v) { return String(v).trim(); }).filter(Boolean);
      const label = '全部' + f.label;
      return '<div class="cf-filter-multi" data-cf-filter-wrap="' + U().esc(f.key) + '">' +
        '<button type="button" class="select cf-filter-toggle" data-cf-filter-label="' + U().esc(label) + '" aria-expanded="false">' +
          U().esc(selected.length ? selected.join('、') : label) +
        '</button>' +
        '<div class="cf-filter-menu" hidden>' +
          '<div class="cf-filter-options">' + vals.map(function (v) {
            return '<label class="cf-filter-option"><input type="checkbox" data-cf-filter-opt="' + U().esc(v) + '"' + (selected.indexOf(v) > -1 ? ' checked' : '') + '><span>' + U().esc(v) + '</span></label>';
          }).join('') + '</div>' +
          '<div class="cf-filter-foot"><span>可多选</span><button type="button" class="link-btn" data-cf-filter-clear>清空</button></div>' +
        '</div>' +
        '<input type="hidden" data-task-cf="' + U().esc(f.key) + '" value="' + U().esc(selected.join(',')) + '">' +
      '</div>';
    }
    if (vals.length) {
      return '<select class="select" data-task-cf="' + U().esc(f.key) + '" aria-label="' + U().esc(f.label) + '"><option value="">全部' + U().esc(f.label) + '</option>' +
        vals.map(function (v) { return '<option value="' + U().esc(v) + '"' + (value === v ? ' selected' : '') + '>' + U().esc(v) + '</option>'; }).join('') + '</select>';
    }
    return '<input class="oh-search" type="search" data-task-cf="' + U().esc(f.key) + '" value="' + U().esc(value || '') + '" placeholder="筛选' + U().esc(f.label) + '">';
  }

  function systemFilterHtml(selected) {
    const chosen = selected || [];
    const groups = D.systemGroups || [];
    const label = chosen.length === 1 ? chosen[0] : (chosen.length ? '已选 ' + chosen.length + ' 项' : '全部涉及业务系统');
    return '<div class="cf-system-filter" data-system-filter>' +
      '<button type="button" class="select cf-filter-toggle cf-system-trigger" aria-expanded="false">' + U().esc(label) + '</button>' +
      '<div class="cf-system-menu" hidden>' +
        '<div class="cf-system-search"><input type="search" data-system-search placeholder="搜索系统组 / 业务系统" aria-label="搜索业务系统"></div>' +
        '<div class="cf-system-tree">' + groups.map(function (group) {
          const systems = group.systems || [];
          const allChecked = systems.length && systems.every(function (name) { return chosen.indexOf(name) > -1; });
          return '<section class="cf-system-group" data-system-group="' + U().esc(group.key) + '">' +
            '<label class="cf-system-group-head"><input type="checkbox" data-system-group-box="' + U().esc(group.key) + '"' + (allChecked ? ' checked' : '') + '><b>' + U().esc(group.name) + '</b></label>' +
            '<div class="cf-system-children">' + systems.map(function (name) {
              return '<label class="cf-system-option" data-system-option-text="' + U().esc(name) + '"><input type="checkbox" data-system-opt="' + U().esc(name) + '"' + (chosen.indexOf(name) > -1 ? ' checked' : '') + '><span>' + U().esc(name) + '</span></label>';
            }).join('') + '</div></section>';
        }).join('') + '</div>' +
        '<div class="cf-system-foot"><span data-system-count>已选 ' + chosen.length + ' 项</span><button type="button" class="link-btn" data-system-clear>清空</button></div>' +
      '</div></div>';
  }

  function rowsHtml(list) {
    const st = S();
    const customHeaders = ITO.customFieldHeaders ? ITO.customFieldHeaders('task') : [];
    const cols = 10 + customHeaders.length;
    if (!list.length) {
      return '<tr><td colspan="' + cols + '">' + U().emptyState('没有匹配的任务', '调整筛选条件，或新建一个任务', 'task') + '</td></tr>';
    }
    return list.map(function (t) {
      const subs = visibleSubs(t);
      const status = U().displayStatus(t);
      const expanded = !!st.expanded[t.id];
      const caret = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
      const expandable = t.mode !== 'single';

      const mainRow =
        '<tr class="task-main-row" data-id="' + t.id + '">' +
          '<td><div class="task-name">' +
            (expandable
              ? '<button class="expand-btn' + (expanded ? ' open' : '') + '" data-act="expand" data-id="' + t.id + '" type="button" aria-label="' + (expanded ? '收起任务' : '展开任务') + '" aria-expanded="' + (expanded ? 'true' : 'false') + '">' + caret + '</button>'
              : '') +
            '<button class="task-name-text" data-act="detail" data-task="' + t.id + '" type="button"><b>' + U().esc(t.name) + '</b><small>' + t.id + ' · ' + modeLabel(t) + ' · ' + U().esc(t.type) + '</small></button></div></td>' +
          '<td>' + U().groupPill(t.group) + '</td>' +
          '<td style="white-space:nowrap">' + U().roleChip(t.initiator, 'initiator') + '</td>' +
          '<td style="white-space:nowrap">' + U().roleChip(t.owner, 'owner') + '</td>' +
          '<td>' + authSummary(t) + '</td>' +
          '<td>' + tagsCell(t) + '</td>' +
          '<td>' + U().badge(t.level) + '</td>' +
          '<td>' + dueCell(t.due, status) + '</td>' +
          '<td><div class="status-cell">' + U().badge(status) + '</div></td>' +
          (ITO.customFieldCells ? ITO.customFieldCells('task', t) : '') +
          '<td><div class="row-actions">' + rowActions(t) + '</div></td>' +
        '</tr>';

      const subRow = expandable
        ? '<tr class="task-subrow" data-sub="' + t.id + '"' + (expanded ? '' : ' hidden') + '><td colspan="' + cols + '"><div class="sub-list">' +
            subs.map(function (s) {
              return '<div class="sub-item' + (U().isOverdue(s) ? ' is-over' : '') + '" data-sub-detail="' + t.id + '|' + s.id + '" tabindex="0" role="button" aria-label="查看执行任务 ' + U().esc(s.name) + '">' +
                '<span class="sid">' + s.id + '</span>' +
                '<span class="sname" title="' + U().esc(s.name) + '">' + U().esc(s.name) + '</span>' +
                '<span class="sowner">' + U().roleChip(s.owner, 'executor') + '</span>' +
                '<span>' + U().badge(s.status) + '</span>' +
                '<span class="sdue' + (U().isOverdue(s) ? ' over' : '') + '">' + U().shortDate(s.due) + '</span>' +
                '<span class="row-actions">' + subActions(t, s) + '</span>' +
              '</div>';
            }).join('') +
          '</div></td></tr>'
        : '';

      return mainRow + subRow;
    }).join('');
  }

  function statsChipsHtml(list) {
    const s = stats(list);
    const parts = [
      '<span class="stat-chip">主任务 <b>' + s.main + '</b></span>',
      '<span class="stat-chip">子任务 <b>' + s.subs + '</b></span>',
      '<span class="stat-chip">审批中 <b>' + s.approval + '</b></span>',
      '<span class="stat-chip' + (s.hung ? ' warn' : '') + '">已挂起 <b>' + s.hung + '</b></span>',
      '<span class="stat-chip' + (s.allOverdue ? ' warn' : '') + '" title="含未完成超期与已完成但晚于截止的任务">超期 <b>' + s.allOverdue + '</b></span>',
      '<span class="stat-chip good">已完成 <b>' + s.completed + '</b></span>'
    ];
    parts.push('<span class="stat-chip">草稿 <b>' + s.drafts + '</b></span>');
    parts.push('<span class="stat-chip">已取消 <b>' + s.canceled + '</b></span>');
    parts.push('<span class="stat-chip hint">' + (S().role === 'employee' ? '仅显示与我相关的任务' : '按当前筛选统计') + '</span>');
    return parts.join('');
  }

  /* ── approval metrics ───────────────────── */
  function grantExecutionTags(task, sub) {
    const st = S();
    if (sub.owner === D.roleInfo.leader.name || !st.staff.some(function (p) { return p.name === sub.owner; })) return;
    const names = new Set((sub.tags || []).concat(task.tags || []));
    st.wallTags.filter(function (tag) { return names.has(tag.name); }).forEach(function (tag) {
      const existing = st.personAchievements.find(function (item) {
        return item.person === sub.owner && item.name === tag.name && item.type === tag.type;
      });
      if (existing) {
        if (existing.source !== '授权') existing.count += 1;
        return;
      }
      st.personAchievements.push({
        person: sub.owner, name: tag.name, type: tag.type, count: 1,
        firstClaimed: sub.completedAt.slice(0, 10), desc: tag.desc || ''
      });
    });
  }

  function completionMetrics(task, before) {
    const after = U().mainStatus(task);
    if (before === after || before === '草稿') return;
    const st = S();
    const group = task.group;
    if (before !== '已完成' && after === '已完成') {
      st.metrics.active = Math.max(0, st.metrics.active - 1);
      st.metrics.closed += 1;
      st.metrics.groupActive[group] = Math.max(0, (st.metrics.groupActive[group] || 0) - 1);
      st.trend.completed[st.trend.completed.length - 1] += 1;
    } else if (before === '已完成' && after !== '已完成' && after !== '已取消') {
      st.metrics.active += 1;
      st.metrics.closed = Math.max(0, st.metrics.closed - 1);
      st.metrics.groupActive[group] = (st.metrics.groupActive[group] || 0) + 1;
    }
  }

  function publishMetrics(task) {
    const st = S();
    st.metrics.active += 1;
    st.metrics.groupActive[task.group] = (st.metrics.groupActive[task.group] || 0) + 1;
    st.metrics.newTasks += 1;
    st.trend.newTasks[st.trend.newTasks.length - 1] += 1;
  }

  function cancelMetrics(task, before) {
    if (before === '已完成' || before === '已取消' || before === '草稿') return;
    const st = S();
    st.metrics.active = Math.max(0, st.metrics.active - 1);
    st.metrics.groupActive[task.group] = Math.max(0, (st.metrics.groupActive[task.group] || 0) - 1);
  }

  function ensureLeaderApproval(task) {
    if (task.source !== 'leader') return;
    if (!task.subs.length || !task.subs.every(function (s) { return s.status === '已完成'; })) return;
    if (!task.leaderApproval) {
      task.leaderApproval = {
        status: '待汇总', approver: task.initiator,
        submittedAt: '', dueAt: '', decidedAt: '', comment: ''
      };
    }
  }

  /* ── task detail drawer ──────────────────── */
  ACT.detail = function (taskId, subId) {
    const t = taskById(taskId);
    if (!t) return;
    const st = S();
    const status = U().displayStatus(t);
    const focus = subId ? findSub(t, subId) : null;
    const focusStatus = focus && focus.status ? focus.status : '';
    const displayStatusText = focusStatus || status;
    const closedView = focusStatus === '已完成' || U().mainStatus(t) === '已完成';
    const auths = [];
    t.subs.forEach(function (s) {
      if (s.auth && s.auth !== '—' && s.auth !== '无需授权' && auths.indexOf(s.auth) === -1) auths.push(s.auth);
    });
    const tickets = t.subs.filter(function (s) { return s.ticket; }).length;
    const la = t.leaderApproval;

    const events = st.logs.filter(function (l) {
      return l.target.indexOf(t.id) > -1 || l.target.indexOf(t.name) > -1;
    }).slice(0, 10);
    if (!events.length) {
      events.push({ time: t.due || now(), actor: t.initiator || t.owner, action: '任务创建', type: '任务' });
    }

    const subRows = t.mode === 'single' ? '' : t.subs.map(function (s) {
      const subTags = s.tags || [];
      return '<tr><td class="mono">' + s.id + '</td>' +
        '<td><div class="cell-task"><b>' + U().esc(s.name) + '</b><small>' + U().esc(s.type) + ' · ' + (s.hours || 0) + 'h</small></div></td>' +
        '<td style="white-space:nowrap">' + U().roleChip(s.owner, 'executor') + '</td>' +
        '<td>' + U().badge(s.level) + '</td>' +
        '<td>' + (s.auth && s.auth !== '—' ? '<span class="tag-inline auth-inline">' + U().esc(s.auth) + '</span>' : '<span class="muted">—</span>') + '</td>' +
        '<td>' + (s.ticket ? U().badge('需开票', 'yellow') : '<span class="muted">—</span>') + '</td>' +
        '<td>' + (subTags.length ? subTags.map(function (tag) { return '<span class="tag-inline">' + U().esc(tag) + '</span>'; }).join('') : '<span class="muted">—</span>') + '</td>' +
        '<td>' + U().badge(s.status) + '</td>' +
        '<td style="white-space:nowrap">' + U().shortDate(s.due) + '</td>' +
        '<td>' + subActions(t, s) + '</td></tr>';
    }).join('');

    const single = t.mode === 'single' ? t.subs[0] : null;
    const singleApproval = single && single.approval ? single.approval : null;

    const approvalBox = t.source === 'leader' && la
      ? '<div class="detail-section"><h4>领导审批</h4><div class="approval-card">' +
          '<div class="approval-head">' + U().badge(U().displayStatus(t)) + '<b>' + U().esc(la.approver) + '</b>' +
            '<span>' + (la.submittedAt ? '提交 ' + U().esc(la.submittedAt) : '等待负责人汇总') + '</span></div>' +
          (la.dueAt ? '<div class="approval-time">' + (la.status === '审批中' || la.status === '已挂起' ? remainingText(la.dueAt) : '截止 ' + U().esc(la.dueAt)) + '</div>' : '') +
          (la.comment ? '<p class="approval-comment">' + U().esc(la.comment) + '</p>' : '') +
        '</div></div>'
      : '';

    const deliverableSection = (function () {
      if (!window.DeliverableStore) return '';
      let html = '';
      t.subs.forEach(function (s) {
        const rec = window.DeliverableStore.getLatestSubmission(s.id);
        if (!rec) return;
        html += '<div class="deliverable-section"><h4>' + U().esc(s.id) + ' · ' + U().esc(s.name) +
          '<span class="deliverable-version">v' + rec.version + '</span></h4>' +
          window.DeliverableStore.fileListHtml(rec.files) +
          (rec.note ? '<div class="deliverable-note">' + U().esc(rec.note) + '</div>' : '') +
        '</div>';
      });
      const summary = window.DeliverableStore.getLatestSummary(t.id);
      if (summary) {
        html += '<div class="deliverable-section"><h4>领导汇总附件<span class="deliverable-version">v' + summary.version + '</span></h4>' +
          window.DeliverableStore.fileListHtml(summary.files) +
          (summary.note ? '<div class="deliverable-note">' + U().esc(summary.note) + '</div>' : '') +
        '</div>';
      }
      return html ? '<div class="detail-section"><h4>成果物</h4>' + html + '</div>' : '';
    })();

    const body =
      '<div class="detail-top">' + U().groupPill(t.group) + U().badge(t.level) + U().badge(displayStatusText) +
        '<span class="detail-id">' + t.id + '</span></div>' +
      (t.desc ? '<p class="detail-desc">' + U().esc(t.desc) + '</p>' : '') +
      (t.canceled ? '<div class="cancel-note"><b>任务已取消</b><span>' + U().esc(t.canceled.reason) + ' · ' + U().esc(t.canceled.by) + ' · ' + U().esc(t.canceled.at) + '</span></div>' : '') +
      (focusStatus === '已完成' && t.subs.some(function (s) { return s.status !== '已完成' && s.status !== '已取消'; })
        ? '<p class="table-note" style="margin:0 0 10px">当前关注子任务已完成，仅可查看；其他子任务按各自状态操作。</p>'
        : '') +
      '<div class="detail-grid">' +
        '<div class="detail-field"><label>任务编号</label><div class="mono">' + t.id + '</div></div>' +
        (focus ? '<div class="detail-field"><label>执行任务编号</label><div class="mono">' + focus.id + '</div></div>' : '') +
        '<div class="detail-field"><label>专业组</label><div>' + U().esc((ITO.getGroup(t.group) || {}).name || '') + '</div></div>' +
        '<div class="detail-field"><label>负责人</label><div>' + U().esc(t.owner) + '</div></div>' +
        '<div class="detail-field"><label>发起人</label><div>' + U().esc(t.initiator || '—') + '</div></div>' +
        '<div class="detail-field"><label>任务模式</label><div>' + U().esc(t.mode === 'single' ? '未拆分' : '拆分任务') + '</div></div>' +
        '<div class="detail-field"><label>任务类型</label><div>' + U().esc(t.type) + '</div></div>' +
        '<div class="detail-field"><label>优先级</label><div>' + U().esc(t.level) + '</div></div>' +
        '<div class="detail-field"><label>截止时间</label><div>' + U().esc(t.due || '—') + '</div></div>' +
        '<div class="detail-field"><label>任务标签</label><div>' + ((t.tags || []).length ? (t.tags || []).map(function (x) {
          return '<span class="tag-inline">' + U().esc(x) + '</span>';
        }).join('') : '<span class="muted">—</span>') + '</div></div>' +
        '<div class="detail-field"><label>授权汇总</label><div>' + (auths.length ? auths.map(function (a) {
          return '<span class="tag-inline auth-inline">' + U().esc(a) + '</span>';
        }).join('') : '<span class="muted">—</span>') + '</div></div>' +
        '<div class="detail-field"><label>开票需求</label><div>' + (tickets ? tickets + ' 个任务需开票' : '无需开票') + '</div></div>' +
        '<div class="detail-field"><label>实际工时</label><div>' + (ITO.actualHoursOf ? Math.round(t.subs.reduce(function (n, s) { return n + ITO.actualHoursOf(s); }, 0) * 10) / 10 : 0) + ' 小时</div></div>' +
        '<div class="detail-field"><label>创建</label><div>' + U().esc((t.createdAt || '—') + ' · ' + (t.createdBy || '—')) + '</div></div>' +
        '<div class="detail-field"><label>最近更新</label><div>' + U().esc((t.updatedAt || '—') + ' · ' + (t.updatedBy || '—')) + '</div></div>' +
      '</div>' +
      (ITO.fieldDefsFor && ITO.fieldDefsFor('task').length ? '<div class="detail-section"><h4>扩展字段</h4><div class="table-wrap"><table class="data-table"><tbody>' + ITO.customFieldRows('task', t) + '</tbody></table></div></div>' : '') +
      (single ? '<div class="detail-section"><h4>执行信息</h4><div class="detail-grid">' +
        '<div class="detail-field"><label>执行人</label><div>' + U().esc(single.owner) + '</div></div>' +
        '<div class="detail-field"><label>预估工时</label><div>' + (single.hours || 0) + ' 小时</div></div>' +
        '<div class="detail-field"><label>开票 / 授权</label><div>' + (single.ticket ? '需开票' : '无需开票') + ' · ' + U().esc(single.auth || '无需授权') + '</div></div>' +
        '<div class="detail-field"><label>审批状态</label><div>' + (singleApproval ? U().badge(singleApproval.status) + ' · ' + U().esc(singleApproval.approver) : '<span class="muted">尚未提交</span>') + '</div></div>' +
        (singleApproval && singleApproval.dueAt ? '<div class="detail-field"><label>审批时限</label><div>' + U().esc(singleApproval.dueAt) + ' · ' + remainingText(singleApproval.dueAt) + '</div></div>' : '') +
        (singleApproval && singleApproval.comment ? '<div class="detail-field"><label>审批意见</label><div>' + U().esc(singleApproval.comment) + '</div></div>' : '') +
        (single.completedAt ? '<div class="detail-field"><label>完成时间</label><div>' + U().esc(single.completedAt) + '</div></div>' : '') +
      '</div></div>' : '') +
      (focus ? '<div class="detail-section"><h4>当前关注任务</h4><div class="focus-sub">' +
        '<b>' + focus.id + ' · ' + U().esc(focus.name) + '</b><span>' + U().esc(focus.owner) + ' · ' + U().esc(focus.status) + '</span></div></div>' : '') +
      (focus && ITO.fieldDefsFor && ITO.fieldDefsFor('task', 'sub').length
        ? '<div class="detail-section"><h4>执行任务扩展字段</h4><div class="table-wrap"><table class="data-table"><tbody>' +
            ITO.customFieldRows('task', focus, 'sub') + '</tbody></table></div></div>'
        : '') +
      approvalBox +
      deliverableSection +
      (t.mode !== 'single' ? '<div class="detail-section"><h4>任务（' + t.subs.length + '）</h4>' +
        '<div class="table-wrap"><table class="sub-table task-detail-sub"><thead><tr><th>编号</th><th>名称</th><th>执行人</th><th>等级</th><th>授权</th><th>开票</th><th>标签</th><th>状态</th><th>截止</th><th>操作</th></tr></thead><tbody>' +
        subRows + '</tbody></table></div></div>' : '') +
      '<div class="detail-section"><h4>操作记录</h4><div class="timeline">' +
        events.map(function (e) {
          return '<div class="timeline-item"><b>' + U().esc(e.action) + ' · ' + U().esc(e.actor) + '</b><span>' + U().esc(e.time) + ' · ' + U().esc(e.type) + '</span></div>';
        }).join('') + '</div></div>';

    let foot = '<button class="btn btn-ghost" data-detail-close type="button">关闭</button><span class="spacer"></span>';
    if (closedView) {
      foot += '<span class="muted" style="margin-right:8px">任务已闭环 · 仅可查看</span>';
    }
    if (t.draft) {
      if (ITO.roleIs('manager')) {
        foot += '<button class="btn btn-danger" data-draft-delete type="button">删除草稿</button>';
      }
      if (canEditTask(t)) {
        foot += '<button class="btn btn-primary" data-draft-edit type="button">编辑草稿</button>';
      }
    } else {
      if (canEditTask(t) && t.subs.length && !closedView) {
        foot += '<button class="btn btn-soft" data-edit-task type="button">编辑任务</button>';
      }
      if (t.mode === 'single' && U().isTaskEditable(t) && t.subs[0] && ['待分发', '执行中'].indexOf(t.subs[0].status) > -1 && canManage(t)) {
        foot += '<button class="btn btn-soft" data-reassign type="button">改派执行人</button>';
      }
      if (t.mode === 'single' && single && (single.owner === st.user.name || ITO.isSuper())) {
        if (single.status === '执行中') foot += '<button class="btn btn-primary" data-submit-single type="button">提交成果</button>';
        if (single.status === '已挂起') foot += '<button class="btn btn-soft" data-resubmit-single type="button">重新提交</button>';
      }
      if (t.mode === 'single' && single && single.status !== '已完成' && canLogWork(t, single)) {
        foot += '<button class="btn btn-ghost" data-act="log-hours" data-task="' + t.id + '" data-sub="' + single.id + '" type="button">补录工时</button>';
      }
      if (t.mode === 'single' && single && single.status !== '已完成' && canLogWork(t, single) && ITO.fieldDefsFor && ITO.fieldDefsFor('task', 'sub').length) {
        foot += '<button class="btn btn-ghost" data-act="edit-sub-fields" data-task="' + t.id + '" data-sub="' + single.id + '" type="button">执行字段</button>';
      }
      if (t.mode === 'single' && single && canLogWork(t, single) && ['待分发', '执行中', '已挂起'].indexOf(single.status) > -1) {
        foot += '<button class="btn btn-ghost" data-act="update-progress" data-task="' + t.id + '" data-sub="' + single.id + '" type="button">更新进度</button>';
      }
      if (t.mode === 'single' && single && canDirectClose(t, single)) {
        foot += '<button class="btn btn-soft" data-act="close-sub" data-task="' + t.id + '" data-sub="' + single.id + '" type="button">直接闭环</button>';
      }
      if (U().isTaskCancelable(t) && isOwnerOrInitiator(t) && !closedView) {
        foot += '<button class="btn btn-danger" data-cancel-task type="button">取消任务</button>';
      }
      const approvalPending = ['审批中', '已挂起', '审批驳回', '待汇总'].indexOf(displayStatusText) > -1;
      if (approvalPending && !closedView) {
        foot += '<a class="btn btn-soft" href="#/dispatch">前往派发与审批</a>';
      }
    }

    U().detailModal({
      title: t.name,
      sub: t.id + ' · ' + (ITO.getGroup(t.group) || {}).name,
      xwide: true,
      body: body,
      foot: foot,
      onMount: function (close, root) {
        root.querySelector('[data-detail-close]').addEventListener('click', close);
        U().$$('[data-act]', root).forEach(function (btn) {
          btn.addEventListener('click', function () {
            close();
            ACT.run(btn.dataset.act, btn.dataset.task, btn.dataset.sub);
          });
        });
        const edit = root.querySelector('[data-draft-edit]');
        if (edit) edit.addEventListener('click', function () { close(); ACT.openTaskForm(t.id); });
        const del = root.querySelector('[data-draft-delete]');
        if (del) del.addEventListener('click', function () { close(); ACT.deleteDraft(t.id); });
        const editTask = root.querySelector('[data-edit-task]');
        if (editTask) editTask.addEventListener('click', function () { close(); ACT.openTaskForm(t.id); });
        const reassign = root.querySelector('[data-reassign]');
        if (reassign) reassign.addEventListener('click', function () { close(); ACT.reassign(t.id); });
        const cancel = root.querySelector('[data-cancel-task]');
        if (cancel) cancel.addEventListener('click', function () { close(); ACT.cancelTask(t.id); });
        const leader = root.querySelector('[data-leader]');
        if (leader) leader.addEventListener('click', function () { close(); ACT.openLeaderApproval(t.id); });
        const submitSingle = root.querySelector('[data-submit-single]');
        if (submitSingle) submitSingle.addEventListener('click', function () { close(); ACT.submit(t.id, t.subs[0].id); });
        const resubmitSingle = root.querySelector('[data-resubmit-single]');
        if (resubmitSingle) resubmitSingle.addEventListener('click', function () { close(); ACT.resubmit(t.id, t.subs[0].id); });
      }
    });
  };

  /* ── task form ───────────────────────────── */
  function localDue(days) {
    const d = pd(D.meta.today);
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T18:00';
  }

  function dueInput(value) {
    if (!value) return '';
    return String(value).slice(0, 16).replace(' ', 'T');
  }

  function tagChips(tags, max) {
    const list = tags || [];
    if (!list.length) return max ? '' : '<span class="muted">未选择</span>';
    return list.slice(0, max || list.length).map(function (tag) {
      return '<span class="tag-inline">' + U().esc(tag) + '</span>';
    }).join('') + (max && list.length > max
      ? '<span class="tag-more" title="' + U().esc(list.join('、')) + '">+' + (list.length - max) + '</span>'
      : '');
  }

  function blankRow() {
    return {
      id: '', name: '', type: '', level: '', hours: '', owner: '',
      auth: '', ticket: false, due: '', tags: []
    };
  }

  function openTagPicker(root, title, selected, done) {
    const shell = root.querySelector('.modal');
    if (!shell) return;
    const current = selected.slice();
    const available = taskTagNames();
    const aliases = systemAliasSet();
    const used = {};
    const groups = (D.systemGroups || []).map(function (group) {
      const systems = (group.systems || []).filter(function (name) { return available.indexOf(name) > -1; });
      systems.forEach(function (name) { used[name] = true; });
      return { name: group.name, systems: systems };
    }).filter(function (group) { return group.systems.length; });
    const other = available.filter(function (tag) { return !used[tag] && !aliases[tag]; });
    const tagButton = function (tag) {
      return '<button class="tag-option' + (current.indexOf(tag) > -1 ? ' is-on' : '') + '" data-tag="' + U().esc(tag) + '" type="button">' + U().esc(tag) + '</button>';
    };
    const groupHtml = function (name, tags) {
      if (!tags.length) return '';
      return '<div class="tag-group"><div class="tag-group-title">' + U().esc(name) + '</div><div class="tag-group-options">' +
        tags.map(tagButton).join('') + '</div></div>';
    };
    const groupedHtml = groups.map(function (group) { return groupHtml(group.name, group.systems); }).join('') +
      (other.length ? groupHtml('其他标签', other) : '');
    const mask = document.createElement('div');
    mask.className = 'tag-pop-mask';
    mask.innerHTML =
      '<div class="tag-pop" role="dialog" aria-label="' + U().esc(title) + '">' +
        '<div class="tag-pop-head"><b>' + U().esc(title) + '</b><span>可多选 · 不限数量</span></div>' +
        '<div class="tag-pop-body">' + (groupedHtml || '<p class="muted" style="padding:16px 2px">暂无可选任务标签</p>') + '</div>' +
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
    if (editing && U().mainStatus(editing) !== '草稿' && !U().isTaskEditable(editing)) {
      ACT.detail(taskId);
      return;
    }

    const groupId = editing ? editing.group : '';
    let currentGroup = groupId;
    const group = st.groups.find(function (g) { return g.id === groupId; });
    const managerName = (group && group.manager) || '';
    const leaders = [D.roleInfo.leader.name];

    let currentMode = editing ? (editing.mode || 'split') : 'single';
    const live = !!(editing && U().mainStatus(editing) !== '草稿');
    let mainTags = (editing && editing.tags ? editing.tags : []).slice();
    let rows = editing && editing.mode !== 'single' && editing.subs.length
      ? editing.subs.map(function (s) {
          return {
            id: s.id, name: s.name, type: s.type || '', level: s.level || '', hours: s.hours || '',
            owner: s.owner || '', auth: s.auth || '', ticket: !!s.ticket,
            due: dueInput(s.due) || '', tags: (s.tags || []).slice()
          };
        })
      : editing && editing.mode === 'single' && editing.subs[0]
        ? [{
            id: editing.subs[0].id, name: editing.subs[0].name, type: editing.subs[0].type || '',
            level: editing.subs[0].level || '', hours: editing.subs[0].hours || '',
            owner: editing.subs[0].owner || '', auth: editing.subs[0].auth || '',
            ticket: !!editing.subs[0].ticket, due: dueInput(editing.subs[0].due) || '',
            tags: (editing.subs[0].tags || []).slice()
          }]
        : [blankRow()];

    const singleInit = editing && editing.mode === 'single' && editing.subs[0] ? editing.subs[0] : null;
    const singleLevel = singleInit ? (singleInit.level || '') : '';
    const singleType = singleInit ? (singleInit.type || '') : '';
    const singleHours = singleInit ? (singleInit.hours || '') : '';
    const singleOwner = singleInit ? (singleInit.owner || '') : '';
    const singleDue = singleInit ? (dueInput(singleInit.due) || '') : '';
    const singleTicket = singleInit ? !!singleInit.ticket : false;
    const singleAuth = singleInit ? (singleInit.auth || '') : '';

    const initiatorNames = leaders.slice();
    if (editing && editing.initiator && initiatorNames.indexOf(editing.initiator) === -1) initiatorNames.push(editing.initiator);
    if (st.user.name && initiatorNames.indexOf(st.user.name) === -1) initiatorNames.push(st.user.name);
    const initiatorOptions = '<option value="">请选择发起人</option>' +
      initiatorNames.map(function (name) {
        const isLeader = leaders.indexOf(name) > -1;
        const grp = st.groups.find(function (g) { return g.manager === name || g.leader === name; });
        const groupRole = grp ? (grp.manager === name ? '主管' : '组长') : '自建';
        const meta = isLeader ? '领导层' : (grp ? grp.name + ' · ' + groupRole : '专业组');
        return '<option value="' + U().esc(name) + '"' +
          (editing && editing.initiator === name ? ' selected' : '') +
          ' data-label="' + U().esc(name) + '" data-meta="' + U().esc(meta) + '" data-role="' + U().esc(isLeader ? '领导' : groupRole) + '">' + U().esc(name) + '</option>';
      }).join('');

    const body =
      '<div class="task-form">' +
        '<div class="assign-top-alert" id="ntOverhaulTop" hidden></div>' +
        '<div class="task-mode-row">' +
          '<span class="task-source-label">任务模式</span>' +
          '<div class="seg-toggle" id="ntMode">' +
            '<button type="button" data-mode="single">不拆分 · 普通任务</button>' +
            '<button type="button" data-mode="split">拆分任务</button>' +
          '</div>' +
          '<span class="task-source-hint" id="ntModeHint"></span>' +
        '</div>' +
        '<div class="form-grid cols-3">' +
          '<div class="form-field span-2" id="ntNameWrap"><label>任务名称 <em>*</em></label>' +
            '<input id="ntName" type="text" maxlength="48" placeholder="例如：核心机房季度巡检与整改" value="' + U().esc(editing ? editing.name : '') + '"></div>' +
          '<div class="form-field" id="ntLevelWrap"><label>任务等级</label>' +
            '<select id="ntLevel"><option value="">请选择等级</option>' + U().statusOptions(LEVELS, editing ? editing.level : singleLevel) + '</select></div>' +
          '<div class="form-field"><label>专业组 <em>*</em></label>' +
            '<select id="ntGroup"><option value="">请选择专业组</option>' + U().groupOptions(groupId) + '</select></div>' +
          '<div class="form-field"><label>负责人 <em>*</em></label>' +
            '<select id="ntOwner"><option value="">请选择负责人</option>' + U().leadOptions(groupId, editing ? editing.owner : '') + '</select></div>' +
          '<div class="form-field"><label>发起人</label><select id="ntInitiator">' + initiatorOptions + '</select></div>' +
          '<div class="form-field span-2"><label>任务标签</label><div class="tag-field" id="ntTags"></div></div>' +
          '<div class="form-field"><label>发布日期</label><div class="static-field">' + U().esc(D.meta.today) + '</div></div>' +
          '<div class="form-field full"><label>任务描述</label>' +
            '<textarea id="ntDesc" placeholder="补充背景、交付物与验收标准">' + U().esc(editing ? (editing.desc || '') : '') + '</textarea></div>' +
        '</div>' +
        (ITO.customFieldForm ? ITO.customFieldForm('task', editing) : '') +
        '<div class="single-fields" id="ntSingleFields">' +
          '<div class="subtask-head"><div><h4>执行信息</h4><span>普通任务只需填写一次执行信息，提交后进入审批</span></div></div>' +
          '<div class="form-grid cols-3">' +
            '<div class="form-field"><label>任务类型</label><select id="ntSingleType"><option value="">请选择类型</option>' + U().statusOptions(TASK_TYPES, singleType) + '</select></div>' +
            '<div class="form-field"><label>预估工时</label><input id="ntSingleHours" type="number" min="0.5" max="200" step="0.5" value="' + singleHours + '" placeholder="请输入工时"></div>' +
            '<div class="form-field"><label>执行人 <em>*</em></label><select id="ntSingleOwner"><option value="">请选择执行人</option>' + U().peopleOptions(groupId, singleOwner, { auth: singleAuth, hours: singleHours }) + '</select></div>' +
            '<div class="form-field"><label>截止时间 <em>*</em></label><input id="ntSingleDue" type="datetime-local" value="' + singleDue + '"></div>' +
            '<div class="form-field"><label>开票</label><label class="ticket-check-line"><input id="ntSingleTicket" type="checkbox"' + (singleTicket ? ' checked' : '') + '><span>需要开票</span></label></div>' +
            '<div class="form-field"><label>授权</label><select id="ntSingleAuth"><option value="">请选择授权</option>' + U().statusOptions(AUTH_TYPES, singleAuth) + '</select></div>' +
          '</div>' +
          '<div id="ntSingleOverhaul"></div>' +
        '</div>' +
        '<div class="split-fields" id="ntSplitFields">' +
          '<div class="subtask-head">' +
            '<div><h4>任务拆分</h4><span>共 <b id="ntSubCount">' + rows.length + '</b> 个任务 · 每个任务独立设置执行人、授权、开票与标签</span></div>' +
            (live ? '' : '<button class="btn btn-soft btn-sm" id="ntAddRow" type="button">' + U().icon('plus') + '添加任务行</button>') +
          '</div>' +
          '<div class="subtask-errors" id="ntSubErrors" hidden></div>' +
          '<div class="assign-split-summary" id="ntSplitOverhaul" hidden></div>' +
          '<div class="subtask-wrap">' +
            '<table class="subtask-table">' +
              '<thead><tr><th>任务名称 <em>*</em></th><th>类型</th><th>等级</th><th>预估工时</th><th>执行人 <em>*</em></th><th>授权</th><th>开票</th><th>截止时间 <em>*</em></th><th>任务标签</th><th></th></tr></thead>' +
              '<tbody id="ntSubBody"></tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>';

    const foot = live
      ? '<button class="btn btn-ghost" data-cancel type="button">取消</button><span class="spacer"></span>' +
        '<button class="btn btn-primary" data-save-live type="button">保存修改</button>'
      : '<button class="btn btn-ghost" data-cancel type="button">取消</button>' +
        '<span class="spacer"></span>' +
        '<span class="draft-hint">草稿不进入在办、超期与趋势统计</span>' +
        '<button class="btn btn-soft" data-draft type="button">保存草稿</button>' +
        '<button class="btn btn-primary" data-publish type="button">' + (editing ? '确认派发' : '创建并派发') + '</button>';

    U().modal({
      title: editing ? (live ? '编辑任务' : '编辑草稿任务') : '新建任务',
      sub: editing ? editing.id + ' · ' + (live ? '修改任务内容，审批中不可编辑' : '草稿可继续拆分，确认派发后进入执行流程') : '创建时直接拆分任务 · 保存草稿或直接派发',
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
        const subErrors = root.querySelector('#ntSubErrors');
        const modeHint = root.querySelector('#ntModeHint');
        const modeBtns = U().$$('#ntMode [data-mode]', root);
        const singleBox = root.querySelector('#ntSingleFields');
        const splitBox = root.querySelector('#ntSplitFields');
        const levelWrap = root.querySelector('#ntLevelWrap');
        const singleType = root.querySelector('#ntSingleType');
        const singleHours = root.querySelector('#ntSingleHours');
        const singleOwner = root.querySelector('#ntSingleOwner');
        let singleAnchorOwner = singleOwner.value;
        let singleAltUsed = false;
        let singleDueUsed = false;
        const singleDue = root.querySelector('#ntSingleDue');
        const singleTicket = root.querySelector('#ntSingleTicket');
        const singleAuth = root.querySelector('#ntSingleAuth');
        const overhaulTop = root.querySelector('#ntOverhaulTop');
        const singleOverhaul = root.querySelector('#ntSingleOverhaul');
        const splitOverhaul = root.querySelector('#ntSplitOverhaul');

        if (live) {
          groupSel.disabled = true;
          ownerSel.disabled = true;
          initSel.disabled = true;
          singleOwner.disabled = true;
        }
        U().bindFieldClear(root);
        function refreshRowErrors() {
          if (!subErrors) return;
          const lines = Array.prototype.map.call(tbody.querySelectorAll('.is-invalid'), function (control) {
            return control.dataset.rowError || '';
          }).filter(Boolean);
          subErrors.innerHTML = lines.map(function (line) { return '<div>' + U().esc(line) + '</div>'; }).join('');
          subErrors.hidden = !lines.length;
        }
        function clearRowInvalid(control) {
          if (!control) return;
          control.classList.remove('is-invalid');
          const wrap = control.closest('.sel-wrap') || control.closest('.date-wrap');
          if (wrap) wrap.classList.remove('is-invalid');
          refreshRowErrors();
        }
        function markRowInvalid(control, message) {
          if (!control) return;
          control.classList.add('is-invalid');
          control.dataset.rowError = message || '';
          const wrap = control.closest('.sel-wrap') || control.closest('.date-wrap');
          if (wrap) wrap.classList.add('is-invalid');
        }
        tbody.addEventListener('input', function (e) { U().clearFieldError(e.target); clearRowInvalid(e.target); });

        function rowHtml(row, i) {
          return '<tr data-row="' + i + '">' +
            '<td><input class="cell-input" data-f="name" type="text" maxlength="40" placeholder="任务名称" value="' + U().esc(row.name) + '"></td>' +
            '<td><select class="cell-select" data-f="type"><option value="">请选择类型</option>' + U().statusOptions(TASK_TYPES, row.type) + '</select></td>' +
            '<td><select class="cell-select" data-f="level"><option value="">请选择等级</option>' + U().statusOptions(LEVELS, row.level) + '</select></td>' +
            '<td><input class="cell-input num" data-f="hours" type="number" min="0.5" max="200" step="0.5" value="' + row.hours + '" placeholder="工时"></td>' +
            '<td><select class="cell-select" data-f="owner"' + (live ? ' disabled' : '') + '><option value="">请选择执行人</option>' + U().peopleOptions(currentGroup, row.owner, { auth: row.auth, hours: row.hours }) + '</select>' +
              '<span class="assign-row-chip" data-row-overhaul="' + i + '"></span></td>' +
            '<td><select class="cell-select" data-f="auth"' + (row.ticket ? '' : ' disabled') + '><option value="">请选择授权</option>' + U().statusOptions(AUTH_TYPES, row.auth) + '</select></td>' +
            '<td class="cell-center"><label class="ticket-check" title="是否需要开票"><input type="checkbox" data-f="ticket"' + (row.ticket ? ' checked' : '') + '><span></span></label></td>' +
            '<td><input class="cell-input" data-f="due" data-date-picker="1" type="datetime-local" value="' + U().esc(row.due) + '"></td>' +
            '<td><div class="sub-tags" data-row-tags="' + i + '"></div></td>' +
            '<td class="cell-center">' + (live ? '' : '<button class="row-del" data-del-row="' + i + '" type="button" aria-label="删除任务">' + U().icon('trash') + '</button>') + '</td>' +
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
          U().enhanceSelects(tbody);
          U().enhanceFormDates(tbody);
          const count = root.querySelector('#ntSubCount');
          if (count) count.textContent = rows.length;
        }

        function syncRows() {
          U().$$('#ntSubBody tr[data-row]', root).forEach(function (tr) {
            const row = rows[Number(tr.dataset.row)];
            if (!row) return;
            row.name = tr.querySelector('[data-f="name"]').value.trim();
            row.type = tr.querySelector('[data-f="type"]').value;
            row.level = tr.querySelector('[data-f="level"]').value;
            row.hours = Number(tr.querySelector('[data-f="hours"]').value) || 0;
            row.owner = tr.querySelector('[data-f="owner"]').value;
            row.auth = tr.querySelector('[data-f="auth"]').value;
            row.ticket = tr.querySelector('[data-f="ticket"]').checked;
            row.due = tr.querySelector('[data-f="due"]').value;
          });
        }

        function hints() {
          modeHint.textContent = currentMode === 'single'
            ? '普通任务只需要一套执行信息，执行完成后进入负责人审批。'
            : '父任务只填基本信息，任务独立派发、执行、审批，全部完成后父任务闭环。';
        }

        function paintMainTags() {
          tagsBox.innerHTML = tagChips(mainTags) +
            '<button class="tag-add" data-tag-main type="button">' + (mainTags.length ? '+' : '选择标签') + '</button>';
        }

        function syncSingleAuth() {
          if (singleTicket.checked) {
            singleAuth.disabled = false;
            if (singleAuth.value === '无需授权') singleAuth.value = '';
          } else {
            singleAuth.value = '无需授权';
            singleAuth.disabled = true;
          }
          if (singleAuth.__syncPicker) singleAuth.__syncPicker();
        }

        function paintMode() {
          modeBtns.forEach(function (btn) { btn.classList.toggle('is-on', btn.dataset.mode === currentMode); });
          modeBtns.forEach(function (btn) { btn.disabled = live; });
          const single = currentMode === 'single';
          const formRoot = root.querySelector('.task-form');
          if (formRoot) {
            formRoot.classList.toggle('is-single', single);
            formRoot.classList.toggle('is-split', !single);
          }
          singleBox.hidden = !single;
          splitBox.hidden = single;
          levelWrap.hidden = !single;
          if (subErrors) { subErrors.hidden = true; subErrors.innerHTML = ''; }
          if (single) renderRows();
          hints();
          paintSingleOverhaul();
          paintSplitOverhaul();
        }

        function authForRow(i, tr) {
          const ticket = tr.querySelector('[data-f="ticket"]').checked;
          const auth = tr.querySelector('[data-f="auth"]');
          auth.disabled = !ticket;
          if (ticket && auth.value === '无需授权') auth.value = '';
          if (!ticket) auth.value = '无需授权';
          if (auth.__syncPicker) auth.__syncPicker();
          rows[i].ticket = ticket;
          rows[i].auth = auth.value;
        }

        renderRows();
        paintMainTags();
        paintMode();
        syncSingleAuth();
        paintSingleOverhaul();
        paintSplitOverhaul();

        [singleDue, singleAuth].forEach(function (el) {
          if (el) el.addEventListener('change', paintSingleOverhaul);
        });
        if (singleOwner) singleOwner.addEventListener('change', function () {
          if (singleAnchorOwner && singleOwner.value !== singleAnchorOwner) singleAltUsed = true;
          paintSingleOverhaul();
        });
        if (singleHours) singleHours.addEventListener('input', paintSingleOverhaul);
        if (singleTicket) singleTicket.addEventListener('change', paintSingleOverhaul);
        tbody.addEventListener('change', function (e) {
          const f = e.target.dataset ? e.target.dataset.f : '';
          if (f === 'owner' || f === 'due' || f === 'auth' || f === 'ticket') {
            if (f === 'owner') {
              const tr = e.target.closest('tr[data-row]');
              const row = tr ? rows[Number(tr.dataset.row)] : null;
              if (row && row._altAnchor && e.target.value !== row._altAnchor) row._altUsed = true;
            }
            syncRows();
            paintSplitOverhaul();
          }
        });
        tbody.addEventListener('input', function (e) {
          if (e.target.dataset && e.target.dataset.f === 'due') {
            syncRows();
            paintSplitOverhaul();
          }
        });

        modeBtns.forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (live) return;
            currentMode = btn.dataset.mode;
            paintMode();
          });
        });

        groupSel.addEventListener('change', function () {
          if (live) { groupSel.value = currentGroup; return; }
          syncRows();
          currentGroup = groupSel.value;
          ownerSel.innerHTML = '<option value="">请选择负责人</option>' + U().leadOptions(currentGroup, '');
          singleOwner.innerHTML = '<option value="">请选择执行人</option>' + U().peopleOptions(currentGroup, '', {
            auth: singleAuth.value, hours: singleHours.value
          });
          singleAnchorOwner = '';
          singleAltUsed = false;
          singleDueUsed = false;
          rows = rows.map(function (row) {
            row.owner = '';
            row._altAnchor = '';
            row._altUsed = false;
            row._dueUsed = false;
            return row;
          });
          renderRows();
          paintSingleOverhaul();
          paintSplitOverhaul();
        });

        singleTicket.addEventListener('change', syncSingleAuth);

        tagsBox.addEventListener('click', function (e) {
          if (!e.target.closest('[data-tag-main]')) return;
          openTagPicker(root, '任务标签', mainTags, function (picked) {
            mainTags = picked;
            paintMainTags();
          });
        });

        if (root.querySelector('#ntAddRow')) {
          root.querySelector('#ntAddRow').addEventListener('click', function () {
            syncRows();
            const g = st.groups.find(function (x) { return x.id === currentGroup; });
            rows.push(blankRow((g && g.manager) || st.user.name));
            renderRows();
            if (tbody.lastElementChild) tbody.lastElementChild.scrollIntoView({ block: 'nearest' });
          });
        }

        tbody.addEventListener('click', function (e) {
          const del = e.target.closest('[data-del-row]');
          if (del && !live) {
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
            openTagPicker(root, '任务标签 · ' + (rows[i].name || '未命名'), rows[i].tags, function (picked) {
              rows[i].tags = picked;
              paintRowTags(i);
            });
          }
        });

        tbody.addEventListener('change', function (e) {
          U().clearFieldError(e.target);
          clearRowInvalid(e.target);
          const tr = e.target.closest('tr[data-row]');
          if (!tr) return;
          if (e.target.dataset.f === 'ticket') authForRow(Number(tr.dataset.row), tr);
        });

        function readSingle() {
          return {
            level: levelSel.value,
            type: singleType.value,
            hours: Number(singleHours.value) || 0,
            owner: singleOwner.value,
            due: singleDue.value,
            ticket: singleTicket.checked,
            auth: singleTicket.checked ? singleAuth.value : '无需授权'
          };
        }

        function fitFor(owner, auth, hours, due) {
          if (!owner || !window.ITO.assignmentFit) return null;
          return window.ITO.assignmentFit({
            name: owner,
            group: currentGroup,
            auth: auth,
            hours: hours,
            due: due
          });
        }

        function paintSingleOverhaul() {
          if (!singleOverhaul) return;
          if (overhaulTop) {
            overhaulTop.hidden = true;
            overhaulTop.innerHTML = '';
          }
          singleOverhaul.innerHTML = '';
          if (currentMode !== 'single') return;
          const s = readSingle();
          if (!s.owner) return;
          if (!singleAnchorOwner) singleAnchorOwner = s.owner;
          const suppressAlt = singleAltUsed || (!!singleAnchorOwner && s.owner !== singleAnchorOwner);
          const fit = fitFor(s.owner, s.auth, s.hours, s.due);
          if (!fit || fit.level === 'none') return;
          singleOverhaul.innerHTML = window.ITO.assignPanelHtml(fit, { allowPick: !live && !suppressAlt, allowDue: !singleDueUsed });
          window.ITO.bindAssignPanel(singleOverhaul, null, {
            onPick: function (name) {
              singleAltUsed = true;
              singleOwner.value = name;
              singleOwner.dispatchEvent(new Event('change', { bubbles: true }));
            },
            onDue: function (date) {
              singleDueUsed = true;
              singleDue.value = date + 'T18:00';
              singleDue.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
          if (overhaulTop && fit.level === 'red') {
            overhaulTop.hidden = false;
            overhaulTop.innerHTML = U().icon('alert') + '<span>执行人存在后续大修冲突，请查看下方“后续大修专项”。</span>';
          }
        }

        function paintSplitOverhaul() {
          if (!splitOverhaul || !tbody) return;
          const shown = [];
          U().$$('#ntSubBody tr[data-row]', root).forEach(function (tr) {
            const i = Number(tr.dataset.row);
            const row = rows[i];
            const chip = tr.querySelector('[data-row-overhaul]');
            if (!chip) return;
            chip.hidden = true;
            chip.textContent = '';
            chip.className = 'assign-row-chip';
            chip.onclick = null;
            if (!row || !row.owner) return;
            if (!row._altAnchor) row._altAnchor = row.owner;
            const suppressAlt = !!row._altUsed || (!!row._altAnchor && row.owner !== row._altAnchor);
            const fit = fitFor(row.owner, row.ticket ? row.auth : '无需授权', Number(row.hours) || 0, row.due);
            if (!fit || fit.level === 'none') return;
            chip.hidden = false;
            chip.textContent = fit.level === 'red' ? '大修冲突' : '大修需关注';
            chip.classList.add(fit.level === 'red' ? 'is-red' : 'is-warn');
            chip.onclick = function (event) {
              event.stopPropagation();
              if (splitOverhaul) splitOverhaul.click();
            };
            shown.push({ i: i, row: row, fit: fit, suppressAlt: suppressAlt });
          });
          if (!shown.length) {
            splitOverhaul.hidden = true;
            splitOverhaul.innerHTML = '';
            splitOverhaul.onclick = null;
            return;
          }
          const red = shown.filter(function (x) { return x.fit.level === 'red'; }).length;
          splitOverhaul.hidden = false;
          splitOverhaul.innerHTML = '<b>' + shown.length + ' 名执行人存在大修' + (red ? '冲突' : '安排') +
            '</b><span>点击查看详情</span>';
          splitOverhaul.onclick = function () {
            const body = shown.map(function (x, idx) {
              return '<div class="detail-section" data-overhaul-section="' + idx + '"><h4>第 ' + (x.i + 1) + ' 行 · ' +
                U().esc(x.row.name || '未命名') + ' · ' + U().esc(x.row.owner) + '</h4>' +
                window.ITO.assignPanelHtml(x.fit, { allowPick: !live && !x.suppressAlt, allowDue: !x.row._dueUsed }) + '</div>';
            }).join('');
            U().modal({
              title: '拆分任务大修冲突',
              sub: '共 ' + shown.length + ' 行存在大修安排',
              xwide: true,
              body: body,
              foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
              onMount: function (closeModal, modalRoot) {
                modalRoot.querySelector('[data-close]').addEventListener('click', closeModal);
                U().$$('[data-overhaul-section]', modalRoot).forEach(function (section, idx) {
                  const entry = shown[idx];
                  if (!entry) return;
                  window.ITO.bindAssignPanel(section, null, {
                    onPick: function (name) {
                      entry.row._altUsed = true;
                      const sel = tbody.querySelector('tr[data-row="' + entry.i + '"] [data-f="owner"]');
                      if (sel) {
                        sel.value = name;
                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                      }
                      closeModal();
                      paintSplitOverhaul();
                    },
                    onDue: function (date) {
                      entry.row._dueUsed = true;
                      const input = tbody.querySelector('tr[data-row="' + entry.i + '"] [data-f="due"]');
                      if (input) {
                        input.value = date + 'T18:00';
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                      }
                      closeModal();
                      paintSplitOverhaul();
                    }
                  });
                });
              }
            });
          };
        }

        function save(isDraft, isLive) {
          syncRows();
          const name = nameInput.value.trim();
          const owner = ownerSel.value;
          const initiator = initSel.value || st.user.name;
          const source = leaders.indexOf(initiator) > -1 ? 'leader' : 'self';
          const beforeStatus = editing ? U().mainStatus(editing) : '草稿';
          const single = readSingle();

          if (!isLive) {
            const valid = U().validateRequired([
              [nameInput, '请输入任务名称'],
              [groupSel, '请选择专业组'],
              [ownerSel, '请选择负责人']
            ]);
            if (!valid) return;
          } else if (!name) {
            U().showFieldError(nameInput, '请输入任务名称');
            return;
          }

          let kept = rows.slice();
          if (currentMode === 'single') {
            if (!isDraft && !isLive) {
              const validSingle = U().validateRequired([
                [levelSel, '请选择任务等级'],
                [singleType, '请选择任务类型'],
                [singleHours, '请输入预估工时'],
                [singleOwner, '请选择执行人'],
                [singleDue, '请选择截止时间']
              ]);
              if (single.ticket && !single.auth) {
                U().showFieldError(singleAuth, '请选择授权');
                return;
              }
              if (!validSingle) return;
            }
          } else if (isDraft) {
            kept = kept.filter(function (row) { return row.name || row.tags.length || row.ticket; });
          } else {
            if (!kept.length) { U().toast('请至少拆分一个任务', 'warn'); return; }
            if (subErrors) { subErrors.hidden = true; subErrors.innerHTML = ''; }
            tbody.querySelectorAll('.is-invalid').forEach(function (el) { el.classList.remove('is-invalid'); });
            tbody.querySelectorAll('.sel-wrap.is-invalid, .date-wrap.is-invalid').forEach(function (el) { el.classList.remove('is-invalid'); });
            for (let i = 0; i < kept.length; i += 1) {
              const tr = tbody.querySelector('tr[data-row="' + i + '"]');
              if (!tr) continue;
              const checks = [
                ['name', '请输入任务名称'],
                ['type', '请选择类型'],
                ['level', '请选择等级'],
                ['hours', '请输入工时'],
                ['owner', '请选择执行人'],
                ['due', '请选择截止时间']
              ];
              checks.forEach(function (pair) {
                const field = pair[0];
                const control = tr.querySelector('[data-f="' + field + '"]');
                const empty = field === 'hours' ? !kept[i].hours : !kept[i][field];
                if (empty && control) markRowInvalid(control, '第 ' + (i + 1) + ' 行：' + pair[1]);
              });
            }
            refreshRowErrors();
            if (tbody.querySelector('.is-invalid')) return;
          }

          const assignments = currentMode === 'single'
            ? [{ name: single.owner, auth: single.ticket ? single.auth : '无需授权', hours: single.hours, due: single.due }]
            : kept.map(function (row) {
                return { name: row.owner, auth: row.ticket ? row.auth : '无需授权', hours: Number(row.hours) || 0, due: row.due };
              });
          const risky = (!isDraft && !isLive && ITO.assigneeInfo) ? assignments.map(function (a) {
            return { a: a, info: ITO.assigneeInfo(a.name, a.auth, a.hours, a.due) };
          }).filter(function (entry) {
            return entry.info.weekAfter > 100 || entry.info.monthAfter > 100 || !entry.info.authOk;
          }) : [];
          const fits = (!isDraft && window.ITO.assignmentFit) ? assignments.map(function (a) {
            return window.ITO.assignmentFit({
              name: a.name,
              group: currentGroup,
              auth: a.auth,
              hours: a.hours,
              due: a.due
            });
          }) : [];
          let redFits = fits.filter(function (f) { return f.level === 'red'; });
          if (isLive) {
            redFits = redFits.filter(function (f, idx) {
              const a = assignments[idx];
              const row = currentMode === 'single'
                ? (editing && editing.subs[0] ? editing.subs[0] : null)
                : kept[idx];
              const oldDue = row ? dueInput(row.due) : '';
              return oldDue !== a.due;
            });
          }
          let overhaulConfirmed = false;

          const proceed = function () {
          const cf = ITO.readCustomFields ? ITO.readCustomFields(root, 'task', editing ? editing.extra : null) : { values: {}, errors: [] };
          if (cf.errors.length) { U().toast(cf.errors[0], 'warn'); return; }
          const baseId = editing ? editing.id : ITO.nextTaskId();
          let subs;
          if (currentMode === 'single') {
            const existing = editing && editing.subs[0];
            const subStatus = isLive ? existing.status : (isDraft ? '草稿' : '待分发');
            subs = [{
              id: existing ? existing.id : baseId + '-01',
              name: name, group: currentGroup, owner: single.owner, initiator: initiator,
              level: single.level, type: single.type, status: subStatus,
              due: (single.due || '').replace('T', ' '), hours: single.hours, progress: isLive ? existing.progress : 0,
              auth: single.ticket ? single.auth : '无需授权', ticket: single.ticket,
              tags: mainTags.slice(),
              approval: isLive ? existing.approval : null,
              submittedAt: isLive ? existing.submittedAt : '',
              completedAt: isLive ? existing.completedAt : ''
            }];
          } else {
            subs = kept.map(function (row, i) {
              const existing = isLive && editing ? editing.subs.find(function (s) { return s.id === row.id; }) : null;
              const subStatus = isLive && existing ? existing.status : (isDraft ? '草稿' : '待分发');
              return {
                id: existing ? existing.id : baseId + '-' + String(i + 1).padStart(2, '0'),
                name: row.name || '未命名任务', group: currentGroup, owner: row.owner, initiator: initiator,
                level: row.level, type: row.type, status: subStatus,
                due: (row.due || '').replace('T', ' '), hours: row.hours || 0,
                progress: isLive && existing ? existing.progress : 0,
                auth: row.ticket ? row.auth : '无需授权', ticket: !!row.ticket,
                tags: row.tags.slice(),
                approval: isLive && existing ? existing.approval : null,
                submittedAt: isLive && existing ? existing.submittedAt : '',
                completedAt: isLive && existing ? existing.completedAt : ''
              };
            });
          }

          const dues = subs.map(function (s) { return s.due; }).filter(Boolean).sort();
          const due = dues.length ? dues[dues.length - 1] : '';
          const levels = subs.map(function (s) { return s.level; });
          const level = levels.indexOf('紧急') > -1 ? '紧急' : levels.indexOf('重要') > -1 ? '重要' : (levels[0] || '一般');
          const type = currentMode === 'single' ? single.type : (subs.length > 1 ? '综合' : (subs[0] ? subs[0].type : '待定'));
          const record = {
            id: baseId, name: name, group: currentGroup, owner: owner,
            initiator: initiator, source: source, level: level, type: type,
            due: due, tags: mainTags.slice(), desc: descEl.value.trim() || '待补充任务背景与验收标准。',
            extra: cf.values,
            mode: currentMode, draft: isDraft, canceled: null,
            summaryRework: isLive ? !!editing.summaryRework : false,
            leaderApproval: editing ? editing.leaderApproval : null,
            subs: subs
          };

          if (editing) {
            Object.assign(editing, record, { updatedAt: D.meta.demoNow, updatedBy: st.user.name });
            editing.audit = editing.audit || [];
            editing.audit.push({ time: D.meta.demoNow, actor: st.user.name, action: isLive ? '编辑任务' : '更新任务' });
          } else {
            record.createdAt = D.meta.demoNow;
            record.createdBy = st.user.name;
            record.updatedAt = D.meta.demoNow;
            record.updatedBy = st.user.name;
            record.audit = [{ time: D.meta.demoNow, actor: st.user.name, action: '创建任务' }];
            st.tasks.unshift(record);
          }

          const wasDraft = !!(editing && record.draft === false && beforeStatus === '草稿');
          if (!isLive && !isDraft) {
            if (!editing || wasDraft) publishMetrics(record);
          }
          if (isLive) completionMetrics(record, beforeStatus);

          ITO.log(
            isLive ? '编辑任务' : isDraft ? (editing ? '更新任务草稿' : '保存任务草稿') : (editing ? '派发草稿任务' : '新建并派发任务'),
            baseId + ' ' + name + ' · ' + subs.length + ' 个任务',
            '任务'
          );
          if (overhaulConfirmed && redFits.length) {
            ITO.log(
              (isLive ? '编辑任务' : editing ? '派发草稿任务' : '新建并派发任务') + ' · 大修冲突确认',
              baseId + ' ' + name + ' · ' + redFits.map(function (f) { return f.summary.name + ' ' + f.summary.count + ' 项'; }).join('、'),
              '任务'
            );
          }

          st.taskFilters.q = '';
          st.taskFilters.group = '';
          st.taskFilters.level = '';
          st.taskFilters.status = isDraft ? '草稿' : '';
          close();
          U().toast(isLive ? '任务已更新' : isDraft ? '草稿已保存，可稍后继续拆分' : '任务已创建并进入待分发');
          ITO.refresh();
          };

          if (redFits.length) {
            window.ITO.confirmAssignment(redFits, {
              okText: isLive ? '仍要保存' : '仍要派发',
              sub: isLive ? '截止时间调整后出现新的大修冲突，确认后保存修改' : '仍可继续创建并派发，确认后进入后续流程',
              onConfirm: function () {
                overhaulConfirmed = true;
                proceed();
              }
            });
          } else if (risky.length) {
            const lines = risky.map(function (entry) {
              const reasons = [];
              if (entry.info.weekAfter > 100 || entry.info.monthAfter > 100) {
                reasons.push('本周 ' + entry.info.weekAfter + '% / 本月 ' + entry.info.monthAfter + '%');
              }
              if (!entry.info.authOk) reasons.push('缺少' + (entry.a.auth || '所需授权'));
              return '<li style="margin:4px 0"><b>' + U().esc(entry.a.name || '未选择执行人') + '</b> · ' + U().esc(entry.a.hours || 0) + 'h · ' + U().esc(reasons.join(' / ')) + '</li>';
            }).join('');
            U().modal({
              title: '派发风险确认',
              sub: '以下人员负荷将超过 100% 或缺少作业授权',
              body: '<div class="detail-section"><p style="margin:0 0 8px">仍可继续派发，确认后任务进入待分发状态。</p><ul style="margin:0;padding-left:18px">' + lines + '</ul></div>',
              foot: '<button class="btn btn-ghost" data-close type="button">返回调整</button><button class="btn btn-primary" data-ok type="button">确认继续</button>',
              onMount: function (closeGuard, root) {
                root.querySelector('[data-close]').addEventListener('click', closeGuard);
                root.querySelector('[data-ok]').addEventListener('click', function () { closeGuard(); proceed(); });
              }
            });
          } else {
            proceed();
          }
        }

        root.querySelector('[data-cancel]').addEventListener('click', close);
        const draftBtn = root.querySelector('[data-draft]');
        if (draftBtn) draftBtn.addEventListener('click', function () { save(true, false); });
        const publishBtn = root.querySelector('[data-publish]');
        if (publishBtn) publishBtn.addEventListener('click', function () { save(false, false); });
        const saveLive = root.querySelector('[data-save-live]');
        if (saveLive) saveLive.addEventListener('click', function () { save(false, true); });
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
        ? '将删除「' + t.name + '」及其 ' + t.subs.length + ' 个任务草稿。'
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
    const dueVal = String(sub.due).replace(' ', 'T');

    U().modal({
      title: '派发任务',
      sub: t.id + ' · ' + t.name,
      body:
        '<div class="dispatch-preview">' + U().badge(sub.level) + U().groupPill(sub.group) +
          '<b>' + U().esc(sub.name) + '</b><span class="mono">' + sub.id + '</span></div>' +
        '<div id="dpOverhaul" style="margin-top:12px"></div>' +
        '<div class="form-grid" style="margin-top:16px">' +
          U().formRow({ label: '执行人', required: true, control: '<select id="dpOwner"><option value="">请选择执行人</option>' + U().peopleOptions(sub.group, '', { auth: sub.ticket ? sub.auth : '无需授权', hours: sub.hours, due: sub.due }) + '</select>' }) +
          U().formRow({ label: '截止时间', required: true, control: '<input id="dpDue" type="datetime-local" value="' + dueVal + '">' }) +
          U().formRow({ label: '作业授权', full: true, control: '<select id="dpAuth">' + U().statusOptions(AUTH_TYPES, sub.ticket ? (sub.auth === '—' ? '工作负责人授权' : sub.auth) : '无需授权') + '</select>' }) +
          '<div class="form-field full"><div class="assign-hint" id="dpHint"></div></div>' +
          U().formRow({ label: '派发说明', full: true, control: '<textarea id="dpNote" placeholder="说明交付物、验收标准与注意事项"></textarea>' }) +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">' + U().icon('send') + '确认派发</button>',
      onMount: function (close, root) {
        const authSel = root.querySelector('#dpAuth');
        if (!sub.ticket) authSel.disabled = true;
        const ownerSel = root.querySelector('#dpOwner');
        const dueInput = root.querySelector('#dpDue');
        const dpHint = root.querySelector('#dpHint');
        const dpOverhaul = root.querySelector('#dpOverhaul');
        let anchorOwner = '';
        let altUsed = false;
        let dueUsed = false;
        const fitNow = function () {
          if (!window.ITO.assignmentFit || !ownerSel.value) return null;
          return window.ITO.assignmentFit({
            name: ownerSel.value,
            group: sub.group,
            auth: sub.ticket ? authSel.value : '无需授权',
            hours: sub.hours,
            due: (dueInput.value || '').replace('T', ' ')
          });
        };
        const paintOverhaul = function () {
          if (!dpOverhaul || !window.ITO.assignPanelHtml) return;
          if (!anchorOwner && ownerSel.value) anchorOwner = ownerSel.value;
          const fit = fitNow();
          const suppressAlt = altUsed || (!!anchorOwner && ownerSel.value !== anchorOwner);
          dpOverhaul.innerHTML = fit ? window.ITO.assignPanelHtml(fit, { allowPick: !suppressAlt, allowDue: !dueUsed }) : '';
          window.ITO.bindAssignPanel(dpOverhaul, null, {
            onPick: function (name) {
              altUsed = true;
              ownerSel.value = name;
              ownerSel.dispatchEvent(new Event('change', { bubbles: true }));
            },
            onDue: function (date) {
              dueUsed = true;
              dueInput.value = date + 'T18:00';
              dueInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
        };
        const paintHint = function () {
          if (!dpHint) return;
          if (!ownerSel.value) {
            dpHint.innerHTML = '<span class="muted">选择执行人后显示本周 / 本月负荷与授权匹配</span>';
            return;
          }
          if (!ITO.assigneeInfo) return;
          const auth = sub.ticket ? authSel.value : '无需授权';
          const info = ITO.assigneeInfo(ownerSel.value, auth, sub.hours, (dueInput.value || '').replace('T', ' '));
          const bad = info.weekAfter > 100 || info.monthAfter > 100 || !info.authOk;
          dpHint.innerHTML = '<span class="' + (bad ? 'text-red' : '') + '">本周 ' + info.weekRate + '% → ' + info.weekAfter + '% · 本月 ' +
            info.monthRate + '% → ' + info.monthAfter + '% · 本周剩余 ' + info.weekRemain + 'h · ' +
            (info.authOk ? '授权匹配' : '缺少' + U().esc(auth)) + '</span>';
        };
        paintHint();
        paintOverhaul();
        ownerSel.addEventListener('change', function () {
          if (anchorOwner && ownerSel.value !== anchorOwner) altUsed = true;
          paintHint();
          paintOverhaul();
        });
        authSel.addEventListener('change', function () { paintHint(); paintOverhaul(); });
        dueInput.addEventListener('change', function () { paintHint(); paintOverhaul(); });
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', function () {
          const owner = root.querySelector('#dpOwner').value;
          const dueRaw = root.querySelector('#dpDue').value;
          if (!owner || !dueRaw) { U().toast('请补全执行人与截止时间', 'warn'); return; }
          const authVal = sub.ticket ? authSel.value : '无需授权';
          const fit = fitNow();
          const commit = function (confirmed) {
            sub.owner = owner;
            sub.due = dueRaw.replace('T', ' ');
            sub.auth = authVal;
            sub.status = '执行中';
            sub.note = root.querySelector('#dpNote').value.trim();
            ITO.log('派发任务', sub.id + ' ' + sub.name + ' → ' + owner, '任务');
            if (confirmed && fit && fit.level === 'red') {
              ITO.log('派发任务 · 大修冲突确认', sub.id + ' ' + owner + ' · ' + fit.summary.count + ' 项大修任务', '任务');
            }
            ITO.notify(owner, {
              type: '任务',
              title: '新任务已派发',
              body: t.name + ' · ' + sub.name + '，截止 ' + sub.due,
              link: '#/mine'
            });
            close();
            U().toast('已派发给 ' + owner + '，任务进入执行中');
            ITO.refresh();
          };
          if (fit && fit.level === 'red') {
            window.ITO.confirmAssignment(fit, {
              okText: '仍要派发',
              onConfirm: function () { commit(true); }
            });
            return;
          }
          if (ITO.guardAssignment) {
            ITO.guardAssignment({ name: owner, auth: authVal, hours: sub.hours, due: dueRaw.replace('T', ' ') }, function () { commit(false); });
          } else {
            commit(false);
          }
        });
      }
    });
  };

  /* ── submit deliverable ──────────────────── */
  ACT.submit = function (taskId, subId) {
    const t = taskById(taskId);
    const sub = t && findSub(t, subId);
    if (!sub) return;
    const ticket = sub.ticket;
    U().modal({
      title: '提交成果物',
      sub: sub.id + ' · ' + sub.name,
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '执行人', control: '<div class="static-field">' + U().esc(sub.owner) + '</div>' }) +
          U().formRow({ label: '负责人审批', control: '<div class="static-field">' + U().esc(t.owner) + '</div>' }) +
          U().formRow({ label: ticket ? '开票 / 授权' : '开票', control: '<div class="static-field">' + (ticket ? '需开票 · ' + U().esc(sub.auth) : '无需开票') + '</div>' }) +
          U().formRow({ label: '本次投入工时', required: true, control: '<input id="sbHours" type="number" min="0.5" max="200" step="0.5" value="' + (ITO.remainingHoursOf ? Math.max(0.5, ITO.remainingHoursOf(sub)) : (sub.hours || 1)) + '"><span class="form-hint">按本次实际投入填写，用于个人工时与负载统计</span>' }) +
          U().formRow({ label: '成果说明', full: true, control: '<textarea id="sbNote" placeholder="填写交付物、验证结果与遗留事项"></textarea>' }) +
          U().formRow({ label: '成果物', full: true, control: '<div id="sbFiles"></div><div class="form-hint">至少上传 1 个文件；提交后进入审批中。</div>' }) +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">提交审批</button>',
      onMount: function (close, root) {
        const uploader = window.DeliverableStore
          ? window.DeliverableStore.mountUploader(root.querySelector('#sbFiles'))
          : null;
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', async function () {
          const okBtn = root.querySelector('[data-ok]');
          const note = root.querySelector('#sbNote').value.trim();
          const files = uploader ? uploader.getFiles() : [];
          const hoursEl = root.querySelector('#sbHours');
          const hours = Number(hoursEl.value) || 0;
          if (!files.length) {
            U().toast('请至少上传 1 个成果物文件', 'warn');
            return;
          }
          if (!(hours > 0)) {
            U().showFieldError(hoursEl, '请填写本次投入工时');
            return;
          }
          okBtn.disabled = true;
          const submittedAt = now();
          try {
            await window.DeliverableStore.saveSubmission(sub.id, t.id, {
              note: note,
              submittedBy: sub.owner,
              submittedAt: submittedAt,
              files: files
            });
            sub.status = '审批中';
            sub.progress = 100;
            sub.submittedAt = submittedAt;
            sub.submissionNote = note;
            sub.approval = {
              level: 1,
              approver: t.owner,
              status: '待审批',
              submittedAt: submittedAt,
              dueAt: U().addHours(submittedAt, U().APPROVAL_HOURS),
              decidedAt: '',
              comment: ''
            };
            await window.DeliverableStore.saveWorkflow(sub.id, t.id, {
              status: sub.status, progress: sub.progress, submittedAt: submittedAt,
              submissionNote: note, approval: sub.approval
            });
            if (ITO.addWorkLog) ITO.addWorkLog(sub, hours);
            ITO.log('提交成果物', sub.id + ' ' + sub.name + ' · ' + files.length + ' 个文件 · ' + hours + 'h · 等待 ' + t.owner + ' 审批', '任务');
            ITO.notify(t.owner, {
              type: '成果物',
              title: '收到新的成果物',
              body: t.name + ' · ' + sub.name + '，等待你审批',
              link: '#/dispatch'
            });
            close();
            U().toast('成果物已提交，等待负责人审批');
            ITO.refresh();
          } catch (err) {
            okBtn.disabled = false;
            U().toast(err.message || '成果物保存失败，请检查浏览器存储空间', 'warn');
          }
        });
      }
    });
  };

  /* ── L1 approval ─────────────────────────── */
  ACT.openApprove = function (taskId, subId) {
    const t = taskById(taskId);
    if (!t) return;
    const sub = findSub(t, subId);
    if (!sub || !sub.approval) return;
    const ap = sub.approval;
    const tags = sub.tags || [];
    const subRec = window.DeliverableStore ? window.DeliverableStore.getLatestSubmission(sub.id) : null;
    const submitNote = sub.submissionNote || (subRec && subRec.note) || ap.comment || '执行人已提交成果物，请审核交付内容与验收标准。';

    U().modal({
      title: '审批成果物',
      sub: t.id + ' · ' + t.name,
      wide: true,
      body:
        '<div class="approve-grid">' +
          '<div class="detail-field"><label>任务</label><div>' + U().esc(sub.name) + '</div></div>' +
          '<div class="detail-field"><label>编号</label><div class="mono">' + sub.id + '</div></div>' +
          '<div class="detail-field"><label>执行人</label><div>' + U().esc(sub.owner) + '</div></div>' +
          '<div class="detail-field"><label>审批人</label><div>' + U().esc(ap.approver) + '</div></div>' +
          '<div class="detail-field"><label>提交时间</label><div>' + U().esc(ap.submittedAt) + '</div></div>' +
          '<div class="detail-field"><label>审批时限</label><div>' + U().esc(ap.dueAt) + ' · ' + remainingText(ap.dueAt) + '</div></div>' +
          '<div class="detail-field"><label>开票 / 授权</label><div>' + (sub.ticket ? '需开票 · ' + U().esc(sub.auth) : '无需开票') + '</div></div>' +
          '<div class="detail-field"><label>等级</label><div>' + U().badge(sub.level) + '</div></div>' +
        '</div>' +
        '<div class="deliverable-section"><h4>成果物' + (subRec ? '<span class="deliverable-version">v' + subRec.version + '</span>' : '') + '</h4>' +
          (subRec && subRec.files && subRec.files.length ? window.DeliverableStore.fileListHtml(subRec.files) : '<div class="deliverable-empty">该提交未包含成果物文件</div>') +
        '</div>' +
        '<div class="approve-note">' + U().esc(submitNote) + '</div>' +
        '<div class="form-field" style="margin-top:14px"><label>审批意见</label><textarea id="apComment" placeholder="通过或驳回的说明"></textarea></div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button>' +
        '<button class="btn btn-danger" data-reject type="button">驳回</button>' +
        '<button class="btn btn-primary" data-pass type="button">' + U().icon('check') + '审批通过</button>',
      onMount: function (close, root) {
        const comment = function () { return root.querySelector('#apComment').value.trim(); };
        const before = U().mainStatus(t);
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-pass]').addEventListener('click', function () {
          sub.status = '已完成';
          sub.progress = 100;
          sub.completedAt = now();
          sub.approval.status = '通过';
          sub.approval.decidedAt = now();
          sub.approval.comment = comment();
          const closureHours = ITO.ensureCompletionHours ? ITO.ensureCompletionHours(sub, sub.completedAt.slice(0, 10)) : 0;
          if (window.DeliverableStore) {
            window.DeliverableStore.saveWorkflow(sub.id, t.id, {
              status: sub.status, progress: sub.progress, completedAt: sub.completedAt, approval: sub.approval,
              actualHours: sub.actualHours, workLogs: sub.workLogs
            });
          }
          grantExecutionTags(t, sub);
          ensureLeaderApproval(t);
          completionMetrics(t, before);
          ITO.log('审批通过', sub.id + ' ' + sub.name + (closureHours ? ' · 补记 ' + closureHours + 'h' : '') + (comment() ? ' · ' + comment() : ''), '审批');
          ITO.notify(sub.owner, {
            type: '审批',
            title: '审批通过',
            body: t.name + ' · ' + sub.name + ' 已闭环',
            link: '#/mine'
          });
          close();
          U().toast('审批通过，任务已闭环');
          ITO.refresh();
        });
        root.querySelector('[data-reject]').addEventListener('click', function () {
          if (!comment()) { U().toast('驳回请填写审批意见', 'warn'); return; }
          sub.status = '执行中';
          sub.progress = 90;
          sub.approval.status = '驳回';
          sub.approval.decidedAt = now();
          sub.approval.comment = comment();
          if (window.DeliverableStore) {
            window.DeliverableStore.saveWorkflow(sub.id, t.id, {
              status: sub.status, progress: sub.progress, approval: sub.approval
            });
          }
          ITO.log('审批驳回', sub.id + ' ' + sub.name + ' · ' + comment(), '审批');
          ITO.notify(sub.owner, {
            type: '审批',
            title: '审批驳回',
            body: t.name + ' · ' + sub.name + '：' + comment(),
            link: '#/mine'
          });
          close();
          U().toast('已驳回，任务退回执行中', 'warn');
          ITO.refresh();
        });
      }
    });
  };

  /* ── resubmit ────────────────────────────── */
  ACT.resubmit = function (taskId, subId) {
    const t = taskById(taskId);
    const sub = t && findSub(t, subId);
    if (!sub) return;
    U().modal({
      title: '重新提交成果物',
      sub: sub.id + ' · ' + sub.name,
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '执行人', control: '<div class="static-field">' + U().esc(sub.owner) + '</div>' }) +
          U().formRow({ label: '审批人', control: '<div class="static-field">' + U().esc(t.owner) + '</div>' }) +
          U().formRow({ label: '本次补录工时', required: true, control: '<input id="rsHours" type="number" min="0.5" max="200" step="0.5" value="' + (ITO.remainingHoursOf ? (ITO.remainingHoursOf(sub) || Math.max(0.5, (sub.hours || 2) * 0.1)) : 1) + '"><span class="form-hint">补充本次投入，会计入个人工时与负载</span>' }) +
          U().formRow({ label: '重新提交说明', full: true, control: '<textarea id="rsNote" placeholder="说明本次补充或修正的内容"></textarea>' }) +
          U().formRow({ label: '成果物', full: true, control: '<div id="rsFiles"></div><div class="form-hint">至少上传 1 个文件；历史版本会保留。</div>' }) +
        '</div>' +
        '<div class="form-hint" style="margin-top:10px">重新提交后审批计时重置，负责人有新的 72 小时审批窗口。</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">重新提交</button>',
      onMount: function (close, root) {
        const uploader = window.DeliverableStore
          ? window.DeliverableStore.mountUploader(root.querySelector('#rsFiles'))
          : null;
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', async function () {
          const okBtn = root.querySelector('[data-ok]');
          const note = root.querySelector('#rsNote').value.trim();
          const files = uploader ? uploader.getFiles() : [];
          const hoursEl = root.querySelector('#rsHours');
          const hours = Number(hoursEl.value) || 0;
          if (!files.length) {
            U().toast('请至少上传 1 个成果物文件', 'warn');
            return;
          }
          if (!(hours > 0)) {
            U().showFieldError(hoursEl, '请填写本次补录工时');
            return;
          }
          okBtn.disabled = true;
          const submittedAt = now();
          try {
            await window.DeliverableStore.saveSubmission(sub.id, t.id, {
              note: note,
              submittedBy: sub.owner,
              submittedAt: submittedAt,
              files: files
            });
            sub.status = '审批中';
            sub.progress = 100;
            sub.submittedAt = submittedAt;
            sub.submissionNote = note;
            sub.approval = {
              level: 1,
              approver: t.owner,
              status: '待审批',
              submittedAt: submittedAt,
              dueAt: U().addHours(submittedAt, U().APPROVAL_HOURS),
              decidedAt: '',
              comment: ''
            };
            await window.DeliverableStore.saveWorkflow(sub.id, t.id, {
              status: sub.status, progress: sub.progress, submittedAt: submittedAt,
              submissionNote: note, approval: sub.approval
            });
            if (ITO.addWorkLog) ITO.addWorkLog(sub, hours);
            ITO.log('重新提交成果物', sub.id + ' ' + sub.name + ' · ' + files.length + ' 个文件 · ' + hours + 'h · 审批计时重新开始', '任务');
            ITO.notify(t.owner, {
              type: '成果物',
              title: '成果物已重新提交',
              body: t.name + ' · ' + sub.name + '，审批计时已重置',
              link: '#/dispatch'
            });
            close();
            U().toast('已重新提交，审批计时已重置');
            ITO.refresh();
          } catch (err) {
            okBtn.disabled = false;
            U().toast(err.message || '成果物保存失败，请检查浏览器存储空间', 'warn');
          }
        });
      }
    });
  };

  /* ── edit submitted deliverable (employee) ─ */
  ACT.editDeliverable = function (taskId, subId) {
    const st = S();
    const t = taskById(taskId);
    if (!t || st.role !== 'employee') return;
    const target = subId ? { sub: findSub(t, subId) } : employeeEditTarget(t);
    const sub = target && target.sub;
    if (!sub || sub.owner !== st.user.name) return;
    const rec = window.DeliverableStore ? window.DeliverableStore.getLatestSubmission(sub.id) : null;
    if (!rec || !rec.files.length) {
      U().toast('暂无可编辑成果物', 'warn');
      return;
    }
    if (DELIVERABLE_EDITABLE_STATUS.indexOf(sub.status) === -1) {
      U().toast('当前状态不可编辑成果物', 'warn');
      return;
    }
    const completed = sub.status === '已完成';
    U().modal({
      title: '编辑成果物',
      sub: sub.id + ' · ' + sub.name + ' · 当前 v' + rec.version,
      wide: true,
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '执行人', control: '<div class="static-field">' + U().esc(sub.owner) + '</div>' }) +
          U().formRow({ label: '当前版本', control: '<div class="static-field">v' + rec.version + ' · ' + U().esc(rec.submittedAt || '—') + '</div>' }) +
          U().formRow({ label: '成果说明', full: true, control: '<textarea id="edNote" placeholder="说明本次修改、补充或替换的内容">' + U().esc(rec.note || '') + '</textarea>' }) +
          U().formRow({ label: '成果物', full: true, control: '<div id="edFiles"></div><div class="form-hint">已有文件默认保留，可移除；保存后生成 v' + (rec.version + 1) + '，旧版本保留。</div>' }) +
        '</div>' +
        '<div class="form-hint" style="margin-top:10px">' +
          (completed
            ? '任务已完成，保存后作为补充版本归档，不重新进入审批。'
            : '保存后替换为最新版本，原审批意见作废，审批计时重新开始（72 小时）。') +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">保存新版本</button>',
      onMount: function (close, root) {
        const uploader = window.DeliverableStore
          ? window.DeliverableStore.mountUploader(root.querySelector('#edFiles'), { existing: rec.files })
          : null;
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', async function () {
          const okBtn = root.querySelector('[data-ok]');
          const note = root.querySelector('#edNote').value.trim();
          const files = uploader ? uploader.getFiles() : [];
          const kept = uploader ? uploader.getKept() : [];
          if (!files.length && !kept.length) {
            U().toast('请至少保留或上传 1 个成果物文件', 'warn');
            return;
          }
          okBtn.disabled = true;
          const submittedAt = now();
          try {
            const version = await window.DeliverableStore.saveSubmission(sub.id, t.id, {
              note: note,
              submittedBy: st.user.name,
              submittedAt: submittedAt,
              files: files,
              existingFiles: kept
            });
            sub.submissionNote = note;
            if (completed) {
              ITO.log('补充成果物', sub.id + ' ' + sub.name + ' · v' + version.version + ' · 不重新审批', '任务');
            } else {
              sub.status = '审批中';
              sub.progress = 100;
              sub.submittedAt = submittedAt;
              sub.completedAt = '';
              sub.approval = {
                level: 1,
                approver: (sub.approval && sub.approval.approver) || t.owner,
                status: '待审批',
                submittedAt: submittedAt,
                dueAt: U().addHours(submittedAt, U().APPROVAL_HOURS),
                decidedAt: '',
                comment: ''
              };
              await window.DeliverableStore.saveWorkflow(sub.id, t.id, {
                status: sub.status, progress: sub.progress, submittedAt: submittedAt,
                completedAt: '', submissionNote: note, approval: sub.approval
              });
              ITO.log('编辑成果物并重新提交', sub.id + ' ' + sub.name + ' · v' + version.version + ' · 审批计时重新开始', '任务');
              ITO.notify(t.owner, {
                type: '成果物',
                title: '成果物已更新并重新提交',
                body: t.name + ' · ' + sub.name + '，审批计时已重置',
                link: '#/dispatch'
              });
            }
            close();
            U().toast(completed ? '已保存补充版本' : '成果物已更新，审批计时已重置');
            ITO.refresh();
          } catch (err) {
            okBtn.disabled = false;
            U().toast(err.message || '成果物保存失败，请检查浏览器存储空间', 'warn');
          }
        });
      }
    });
  };

  /* ── leader approval / summary ───────────── */
  ACT.openLeaderApproval = function (taskId) {
    const t = taskById(taskId);
    if (!t || t.source !== 'leader') return;
    const la = t.leaderApproval;
    const isApprover = canLeaderApprove(t) && la && (la.status === '审批中' || la.status === '已挂起');
    const summaryRec = window.DeliverableStore ? window.DeliverableStore.getLatestSummary(t.id) : null;

    if (isApprover) {
      const subs = t.subs.map(function (s) {
        return '<div class="summary-sub"><b>' + s.id + ' · ' + U().esc(s.name) + '</b><span>' + U().esc(s.owner) + ' · ' + U().esc(s.status) + '</span></div>';
      }).join('');
      U().modal({
        title: '领导审批',
        sub: t.id + ' · ' + t.name,
        wide: true,
        body:
          '<div class="detail-grid">' +
            '<div class="detail-field"><label>发起人</label><div>' + U().esc(t.initiator) + '</div></div>' +
            '<div class="detail-field"><label>负责人</label><div>' + U().esc(t.owner) + '</div></div>' +
            '<div class="detail-field"><label>提交时间</label><div>' + U().esc(la.submittedAt || '—') + '</div></div>' +
            '<div class="detail-field"><label>审批时限</label><div>' + U().esc(la.dueAt || '—') + ' · ' + remainingText(la.dueAt) + '</div></div>' +
          '</div>' +
          '<div class="summary-list">' + subs + '</div>' +
          '<div class="deliverable-section"><h4>汇总附件' + (summaryRec ? '<span class="deliverable-version">v' + summaryRec.version + '</span>' : '') + '</h4>' +
            (summaryRec && summaryRec.files && summaryRec.files.length ? window.DeliverableStore.fileListHtml(summaryRec.files) : '<div class="deliverable-empty">该汇总未包含附件</div>') +
          '</div>' +
          ((summaryRec && summaryRec.note) || la.comment ? '<div class="approve-note">' + U().esc((summaryRec && summaryRec.note) || la.comment) + '</div>' : '') +
          '<div class="form-field" style="margin-top:14px"><label>审批意见</label><textarea id="laComment" placeholder="通过或驳回的说明"></textarea></div>',
        foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button>' +
          '<button class="btn btn-danger" data-reject type="button">驳回</button>' +
          '<button class="btn btn-primary" data-pass type="button">' + U().icon('check') + '审批通过</button>',
        onMount: function (close, root) {
          root.querySelector('[data-cancel]').addEventListener('click', close);
          root.querySelector('[data-pass]').addEventListener('click', function () {
            la.status = '已通过';
            la.decidedAt = now();
            la.comment = root.querySelector('#laComment').value.trim() || la.comment;
            if (window.DeliverableStore) window.DeliverableStore.saveLeaderWorkflow(t.id, { leaderApproval: la });
            ITO.log('领导审批通过', t.id + ' ' + t.name, '审批');
            ITO.notify(t.owner, {
              type: '审批',
              title: '领导审批通过',
              body: t.name + ' 已完成领导审批',
              link: '#/tasks'
            });
            close();
            U().toast('领导审批通过');
            ITO.refresh();
          });
          root.querySelector('[data-reject]').addEventListener('click', function () {
            close();
            ACT.openLeaderReject(t.id);
          });
        }
      });
      return;
    }

    // owner submits summary
    const subs = t.subs.map(function (s) {
      return '<div class="summary-sub"><b>' + s.id + ' · ' + U().esc(s.name) + '</b><span>' + U().esc(s.owner) + ' · ' + U().esc(s.status) + '</span></div>';
    }).join('');
    U().modal({
      title: '汇总提交领导审批',
      sub: t.id + ' · ' + t.name,
      wide: true,
      body:
        '<div class="detail-grid">' +
          '<div class="detail-field"><label>发起人</label><div>' + U().esc(t.initiator) + '</div></div>' +
          '<div class="detail-field"><label>负责人</label><div>' + U().esc(t.owner) + '</div></div>' +
          '<div class="detail-field"><label>任务状态</label><div>' + U().badge(U().mainStatus(t)) + '</div></div>' +
          '<div class="detail-field"><label>汇总任务</label><div>' + t.subs.length + ' 个</div></div>' +
        '</div>' +
        '<div class="summary-list">' + subs + '</div>' +
        '<div class="form-field" style="margin-top:14px"><label>汇总说明</label><textarea id="laSummary" placeholder="汇总成果物、验收结论与需要领导关注的事项"></textarea></div>' +
        '<div class="form-field" style="margin-top:12px"><label>汇总附件</label><div id="laFiles"></div><div class="form-hint">至少上传 1 个汇总附件，领导审批时可在线预览。</div></div>' +
        '<div class="form-hint" style="margin-top:10px">提交后领导有 72 小时审批窗口；超时只影响领导审批状态，不改变任务已完成状态。</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">提交领导审批</button>',
      onMount: function (close, root) {
        const uploader = window.DeliverableStore
          ? window.DeliverableStore.mountUploader(root.querySelector('#laFiles'))
          : null;
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', async function () {
          const okBtn = root.querySelector('[data-ok]');
          const note = root.querySelector('#laSummary').value.trim();
          const files = uploader ? uploader.getFiles() : [];
          if (!files.length) {
            U().toast('请至少上传 1 个汇总附件', 'warn');
            return;
          }
          okBtn.disabled = true;
          const before = U().mainStatus(t);
          const submittedAt = now();
          try {
            await window.DeliverableStore.saveSummary(t.id, {
              note: note,
              submittedBy: t.owner,
              submittedAt: submittedAt,
              files: files
            });
            t.leaderApproval = {
              status: '审批中', approver: t.initiator,
              submittedAt: submittedAt, dueAt: U().addHours(submittedAt, U().APPROVAL_HOURS),
              decidedAt: '', comment: ''
            };
            t.summaryNote = note;
            t.summaryRework = false;
            await window.DeliverableStore.saveLeaderWorkflow(t.id, {
              leaderApproval: t.leaderApproval, summaryNote: note, summaryRework: false
            });
            completionMetrics(t, before);
            ITO.log('提交领导审批', t.id + ' ' + t.name + ' · ' + files.length + ' 个汇总附件', '审批');
            ITO.notify(t.initiator, {
              type: '审批',
              title: '待领导审批',
              body: t.name + ' · ' + t.owner + ' 已提交汇总',
              link: '#/dispatch'
            });
            close();
            U().toast('已提交领导审批');
            ITO.refresh();
          } catch (err) {
            okBtn.disabled = false;
            U().toast(err.message || '汇总附件保存失败，请检查浏览器存储空间', 'warn');
          }
        });
      }
    });
  };

  ACT.openLeaderReject = function (taskId) {
    const t = taskById(taskId);
    if (!t || !t.leaderApproval) return;
    const subs = t.subs.map(function (s) {
      return '<label class="reopen-item"><input type="checkbox" value="' + s.id + '"><span><b>' + s.id + ' · ' + U().esc(s.name) + '</b><small>' + U().esc(s.owner) + ' · ' + U().esc(s.status) + '</small></span></label>';
    }).join('');
    U().modal({
      title: '驳回领导审批',
      sub: t.id + ' · ' + t.name,
      wide: true,
      body:
        '<div class="form-field"><label>驳回原因 <em>*</em></label><textarea id="lrReason" placeholder="说明材料问题、成果问题或需要整改的内容"></textarea></div>' +
        '<div class="reject-options">' +
          '<label class="reject-option"><input type="radio" name="lrMode" value="summary" checked><span><b>退回负责人补充汇总</b><small>任务保持已完成，负责人修改汇总后重新提交</small></span></label>' +
          '<label class="reject-option"><input type="radio" name="lrMode" value="reopen"><span><b>重开指定任务</b><small>勾选的任务退回执行中，其余保持已完成</small></span></label>' +
        '</div>' +
        '<div class="reopen-list" id="lrReopen" hidden>' + subs + '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-danger" data-ok type="button">确认驳回</button>',
      onMount: function (close, root) {
        const reason = root.querySelector('#lrReason');
        const reopen = root.querySelector('#lrReopen');
        U().$$('[name="lrMode"]', root).forEach(function (radio) {
          radio.addEventListener('change', function () { reopen.hidden = radio.value !== 'reopen' || !radio.checked; });
        });
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', function () {
          if (!reason.value.trim()) { U().toast('请填写驳回原因', 'warn'); reason.focus(); return; }
          const mode = root.querySelector('[name="lrMode"]:checked').value;
          const selected = U().$$('#lrReopen input:checked', root).map(function (el) { return el.value; });
          if (mode === 'reopen' && !selected.length) { U().toast('请至少选择一个需要重开的任务', 'warn'); return; }
          const before = U().mainStatus(t);
          t.leaderApproval.status = '已驳回';
          t.leaderApproval.decidedAt = now();
          t.leaderApproval.comment = reason.value.trim();
          if (mode === 'summary') {
            t.summaryRework = true;
          } else {
            t.summaryRework = false;
            t.subs.forEach(function (s) {
              if (selected.indexOf(s.id) > -1) {
                s.status = '执行中';
                s.progress = 90;
                s.completedAt = '';
                s.approval = { level: 1, approver: t.owner, status: '驳回', submittedAt: s.submittedAt || '', dueAt: '', decidedAt: now(), comment: reason.value.trim() };
              }
            });
          }
          if (window.DeliverableStore) {
            window.DeliverableStore.saveLeaderWorkflow(t.id, {
              leaderApproval: t.leaderApproval, summaryRework: t.summaryRework
            });
          }
          completionMetrics(t, before);
          ITO.log('领导审批驳回', t.id + ' ' + t.name + ' · ' + (mode === 'summary' ? '补充汇总' : '重开 ' + selected.length + ' 个任务'), '审批');
          ITO.notify(t.owner, {
            type: '审批',
            title: '领导审批驳回',
            body: t.name + '：' + reason.value.trim(),
            link: '#/tasks'
          });
          close();
          U().toast('已驳回，按处理方式退回', 'warn');
          ITO.refresh();
        });
      }
    });
  };

  /* ── cancel / reassign ───────────────────── */
  ACT.cancelTask = function (taskId) {
    const t = taskById(taskId);
    if (!t || !U().isTaskCancelable(t)) return;
    const before = U().mainStatus(t);
    U().modal({
      title: '取消任务',
      sub: t.id + ' · ' + t.name,
      body:
        '<div class="form-field"><label>取消原因 <em>*</em></label><textarea id="cancelReason" placeholder="说明取消原因，取消后任务不计闭环、不计在办"></textarea></div>' +
        '<div class="form-hint" style="margin-top:10px">取消后任务状态变为已取消，所有任务同步取消，且不可恢复。</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">返回</button><button class="btn btn-danger" data-ok type="button">确认取消任务</button>',
      onMount: function (close, root) {
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', function () {
          const reason = root.querySelector('#cancelReason').value.trim();
          if (!reason) { U().toast('请填写取消原因', 'warn'); return; }
          t.canceled = { reason: reason, by: S().user.name, at: now() };
          t.draft = false;
          t.subs.forEach(function (s) {
            s.status = '已取消';
          });
          cancelMetrics(t, before);
          ITO.log('取消任务', t.id + ' ' + t.name + ' · ' + reason, '任务');
          const owners = Array.from(new Set([t.owner].concat(t.subs.map(function (s) { return s.owner; })))).filter(Boolean);
          owners.forEach(function (owner) {
            ITO.notify(owner, {
              type: '任务',
              title: '任务已取消',
              body: t.name + ' · ' + reason,
              link: '#/tasks'
            });
          });
          close();
          U().toast('任务已取消', 'warn');
          ITO.refresh();
        });
      }
    });
  };

  ACT.reassign = function (taskId, subId) {
    const t = taskById(taskId);
    if (!t) return;
    if (!U().isTaskEditable(t)) { U().toast('当前状态不允许改派', 'warn'); return; }
    let candidates = t.subs.filter(function (s) { return ['待分发', '执行中'].indexOf(s.status) > -1; });
    if (subId) candidates = candidates.filter(function (s) { return s.id === subId; });
    if (!candidates.length) { U().toast('没有可改派的执行人', 'warn'); return; }
    const target = candidates[0];
    U().modal({
      title: '改派执行人',
      sub: target.id + ' · ' + target.name,
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '当前执行人', control: '<div class="static-field">' + U().esc(target.owner) + '</div>' }) +
          U().formRow({ label: '新截止时间', required: true, control: '<input id="raDue" type="datetime-local" value="' + dueInput(target.due) + '">' }) +
          U().formRow({ label: '新执行人', required: true, control: '<select id="raOwner"><option value="">请选择新执行人</option>' + U().peopleOptions(target.group, '', { auth: target.auth, hours: target.hours, due: target.due }) + '</select>' }) +
          '<div class="form-field full" id="raRelease"></div>' +
          '<div class="form-field full" id="raOverhaul"></div>' +
          '<div class="form-field full"><div class="assign-hint" id="raHint"></div></div>' +
          U().formRow({ label: '改派原因', full: true, required: true, control: '<textarea id="raReason" placeholder="说明改派原因，改派后保留当前任务状态并记录日志"></textarea>' }) +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">确认改派</button>',
      onMount: function (close, root) {
        const ownerSel = root.querySelector('#raOwner');
        const dueInputEl = root.querySelector('#raDue');
        const reason = root.querySelector('#raReason');
        const hint = root.querySelector('#raHint');
        const releaseEl = root.querySelector('#raRelease');
        const overhaulEl = root.querySelector('#raOverhaul');
        let anchorOwner = '';
        let altUsed = false;
        let dueUsed = false;
        const oldDue = target.due;
        const oldSummary = window.ITO.overhaulSummaryOf ? window.ITO.overhaulSummaryOf(target.owner) : null;
        if (releaseEl) {
          releaseEl.innerHTML = '<div class="assign-release">原执行人 <b>' + U().esc(target.owner) + '</b>：' +
            (oldSummary && oldSummary.count ? '大修 ' + oldSummary.count + ' 项，改派后不再承担本任务' : '无大修任务') +
            '</div>';
        }
        const fitNow = function () {
          if (!window.ITO.assignmentFit || !ownerSel.value) return null;
          return window.ITO.assignmentFit({
            name: ownerSel.value,
            group: target.group,
            auth: target.auth,
            hours: target.hours,
            due: (dueInputEl.value || '').replace('T', ' ')
          });
        };
        const paintOverhaul = function () {
          if (!overhaulEl || !window.ITO.assignPanelHtml) return;
          if (!anchorOwner && ownerSel.value) anchorOwner = ownerSel.value;
          const fit = fitNow();
          const suppressAlt = altUsed || (!!anchorOwner && ownerSel.value !== anchorOwner);
          overhaulEl.innerHTML = fit ? window.ITO.assignPanelHtml(fit, { allowPick: !suppressAlt, allowDue: !dueUsed }) : '';
          window.ITO.bindAssignPanel(overhaulEl, null, {
            onPick: function (name) {
              altUsed = true;
              ownerSel.value = name;
              ownerSel.dispatchEvent(new Event('change', { bubbles: true }));
            },
            onDue: function (date) {
              dueUsed = true;
              dueInputEl.value = date + 'T18:00';
              dueInputEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
        };
        const paintHint = function () {
          if (!hint) return;
          if (!ownerSel.value) {
            hint.innerHTML = '<span class="muted">选择新执行人后显示负荷变化与授权匹配</span>';
            return;
          }
          if (!ITO.assigneeInfo) return;
          const newDue = (dueInputEl.value || '').replace('T', ' ');
          const oldInfo = ITO.assigneeInfo(target.owner, target.auth, 0, target.due);
          const newInfo = ITO.assigneeInfo(ownerSel.value, target.auth, target.hours, newDue);
          hint.innerHTML = '原执行人 <b>' + U().esc(target.owner) + '</b> 本周 ' + oldInfo.weekRate + '% → 改派后 ' +
            Math.max(0, Math.round((oldInfo.weekRate - (target.hours || 0) / 40 * 100))) + '%；新执行人 <b>' + U().esc(ownerSel.value || '未选择') + '</b> 本周 ' +
            newInfo.weekRate + '% → <b>' + newInfo.weekAfter + '%</b>' +
            (newInfo.authOk ? '' : ' · <span class="text-red">缺少' + U().esc(target.auth || '所需授权') + '</span>');
        };
        paintHint();
        paintOverhaul();
        ownerSel.addEventListener('change', function () {
          if (anchorOwner && ownerSel.value !== anchorOwner) altUsed = true;
          paintHint();
          paintOverhaul();
        });
        dueInputEl.addEventListener('change', function () { paintHint(); paintOverhaul(); });
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', function () {
          if (!ownerSel.value || ownerSel.value === target.owner) { U().toast('请选择新的执行人', 'warn'); return; }
          if (!reason.value.trim()) { U().toast('请填写改派原因', 'warn'); return; }
          if (!dueInputEl.value) { U().toast('请选择新的截止时间', 'warn'); return; }
          const old = target.owner;
          const newDue = dueInputEl.value.replace('T', ' ');
          const fit = fitNow();
          const commit = function (confirmed) {
            target.owner = ownerSel.value;
            target.due = newDue;
            ITO.log('改派执行人', target.id + ' ' + target.name + ' · ' + old + ' → ' + target.owner +
              (newDue !== oldDue ? ' · 截止 ' + oldDue + ' → ' + newDue : '') + ' · ' + reason.value.trim(), '任务');
            if (confirmed && fit && fit.level === 'red') {
              ITO.log('改派执行人 · 大修冲突确认', target.id + ' ' + target.owner + ' · ' + fit.summary.count + ' 项大修任务', '任务');
            }
            ITO.notify(old, {
              type: '任务',
              title: '任务已改派',
              body: target.name + ' 已改派给 ' + target.owner,
              link: '#/tasks'
            });
            ITO.notify(target.owner, {
              type: '任务',
              title: '你收到一个改派任务',
              body: t.name + ' · ' + target.name + '，截止 ' + target.due,
              link: '#/mine'
            });
            close();
            U().toast('已改派给 ' + target.owner);
            ITO.refresh();
          };
          if (fit && fit.level === 'red') {
            window.ITO.confirmAssignment(fit, {
              okText: '仍要改派',
              sub: '新执行人存在大修冲突，确认后完成改派',
              onConfirm: function () { commit(true); }
            });
            return;
          }
          if (ITO.guardAssignment) {
            ITO.guardAssignment({ name: ownerSel.value, auth: target.auth, hours: target.hours, due: newDue }, function () { commit(false); });
          } else {
            commit(false);
          }
        });
      }
    });
  };

  ACT.openDeliverables = function (taskId, subId) {
    const t = taskById(taskId);
    if (!t || !window.DeliverableStore) return;
    const section = [];
    visibleSubs(t).forEach(function (s) {
      if (subId && s.id !== subId) return;
      const rec = window.DeliverableStore.getLatestSubmission(s.id);
      if (!rec) return;
      section.push('<div class="deliverable-section"><h4>' + U().esc(s.id) + ' · ' + U().esc(s.name) +
        '<span class="deliverable-version">v' + rec.version + '</span></h4>' +
        window.DeliverableStore.fileListHtml(rec.files) +
        (rec.note ? '<div class="deliverable-note">' + U().esc(rec.note) + '</div>' : '') +
      '</div>');
    });
    if (!subId && S().role !== 'employee') {
      const summary = window.DeliverableStore.getLatestSummary(t.id);
      if (summary) {
        section.push('<div class="deliverable-section"><h4>领导汇总附件<span class="deliverable-version">v' + summary.version + '</span></h4>' +
          window.DeliverableStore.fileListHtml(summary.files) +
          (summary.note ? '<div class="deliverable-note">' + U().esc(summary.note) + '</div>' : '') +
        '</div>');
      }
    }
    if (!section.length) {
      U().toast('该任务暂无成果物', 'warn');
      return;
    }
    U().modal({
      title: '成果物',
      sub: t.id + ' · ' + t.name,
      xwide: true,
      body: '<div class="deliverable-section">' + section.join('') + '</div>',
      foot: '<button class="btn btn-ghost" data-close-modal type="button">关闭</button>',
      onMount: function (close, root) {
        root.querySelector('[data-close-modal]').addEventListener('click', close);
      }
    });
  };

  ACT.addWorkLog = function (taskId, subId) {
    const t = taskById(taskId);
    const sub = t && findSub(t, subId);
    if (!sub) return;
    const actual = ITO.actualHoursOf ? ITO.actualHoursOf(sub) : 0;
    const budget = Number(sub.hours) || 0;
    U().modal({
      title: '补录工时',
      sub: sub.id + ' · ' + sub.name,
      body: '<div class="form-grid">' +
        U().formRow({ label: '执行人', control: '<div class="static-field">' + U().esc(sub.owner) + '</div>' }) +
        U().formRow({ label: '预算 / 已记录', control: '<div class="static-field">' + budget + ' h / ' + actual + ' h</div>' }) +
        U().formRow({ label: '本次补录工时', required: true, control: '<input id="wlHours" type="number" min="0.5" max="200" step="0.5" value="1"><span class="form-hint">补录后计入个人工时与工时负载</span>' }) +
        U().formRow({ label: '补录日期', required: true, control: '<input id="wlDate" type="date" value="' + U().esc(D.meta.today) + '">' }) +
        U().formRow({ label: '补录说明', full: true, control: '<input id="wlNote" type="text" maxlength="60" placeholder="例如：现场故障排查与恢复">' }) +
      '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">确认补录</button>',
      onMount: function (close, root) {
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', function () {
          const hoursEl = root.querySelector('#wlHours');
          const dateEl = root.querySelector('#wlDate');
          const hours = Number(hoursEl.value) || 0;
          const date = dateEl.value;
          if (!(hours > 0)) { U().showFieldError(hoursEl, '请输入本次补录工时'); return; }
          if (!date) { U().showFieldError(dateEl, '请选择补录日期'); return; }
          const applied = ITO.addWorkLog ? ITO.addWorkLog(sub, hours, date) : 0;
          if (!applied) { U().showFieldError(hoursEl, '补录工时必须大于 0'); return; }
          t.updatedAt = D.meta.demoNow;
          t.updatedBy = S().user.name;
          ITO.log('补录工时', sub.id + ' ' + sub.name + ' · ' + applied + 'h · ' + date + (root.querySelector('#wlNote').value.trim() ? ' · ' + root.querySelector('#wlNote').value.trim() : ''), '任务');
          close();
          U().toast('已补录 ' + applied + ' 小时');
          ITO.refresh();
        });
      }
    });
  };

  ACT.updateProgress = function (taskId, subId) {
    const t = taskById(taskId);
    const sub = t && findSub(t, subId);
    if (!sub || !canLogWork(t, sub)) return;
    const current = Math.max(0, Math.min(100, Number(sub.progress) || 0));
    const budget = Number(sub.hours) || 0;
    const next = Math.min(100, current + 10);
    const suggested = Math.max(0.5, Math.round(Math.max(1, next - current) / 100 * budget * 10) / 10);
    U().modal({
      title: '更新执行进度',
      sub: sub.id + ' · ' + sub.name,
      body: '<div class="form-grid">' +
        U().formRow({ label: '当前进度', control: '<div class="static-field">' + current + '%</div>' }) +
        U().formRow({ label: '更新后进度', required: true, control: '<input id="upProgress" type="number" min="0" max="100" step="1" value="' + next + '"><span class="form-hint">按实际完成比例填写</span>' }) +
        U().formRow({ label: '本次投入工时', required: true, control: '<input id="upHours" type="number" min="0" max="200" step="0.5" value="' + suggested + '"><span class="form-hint">按进度折算，会计入个人工时</span>' }) +
        U().formRow({ label: '记录日期', required: true, control: '<input id="upDate" type="date" value="' + U().esc(D.meta.today) + '">' }) +
        U().formRow({ label: '进度说明', full: true, control: '<input id="upNote" type="text" maxlength="60" placeholder="例如：完成接口联调，进入压测">' }) +
      '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">保存进度</button>',
      onMount: function (close, root) {
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', function () {
          const progressEl = root.querySelector('#upProgress');
          const hoursEl = root.querySelector('#upHours');
          const dateEl = root.querySelector('#upDate');
          const progress = Number(progressEl.value);
          const hours = Number(hoursEl.value) || 0;
          if (!(progress >= 0 && progress <= 100)) { U().showFieldError(progressEl, '进度需在 0–100 之间'); return; }
          if (!(hours > 0)) { U().showFieldError(hoursEl, '请输入本次投入工时'); return; }
          if (!dateEl.value) { U().showFieldError(dateEl, '请选择记录日期'); return; }
          if (progress === current && hours <= 0) { U().showFieldError(progressEl, '请更新进度或填写工时'); return; }
          sub.progress = Math.round(progress);
          sub.updatedAt = D.meta.demoNow;
          sub.updatedBy = S().user.name;
          ITO.addWorkLog(sub, hours, dateEl.value, 'progress');
          if (window.DeliverableStore) {
            window.DeliverableStore.saveWorkflow(sub.id, t.id, {
              progress: sub.progress, actualHours: sub.actualHours, workLogs: sub.workLogs
            });
          }
          const note = root.querySelector('#upNote').value.trim();
          ITO.log('更新执行进度', sub.id + ' · ' + sub.progress + '% · ' + hours + 'h' + (note ? ' · ' + note : ''), '任务');
          close();
          U().toast('进度与工时已更新');
          ITO.refresh();
        });
      }
    });
  };

  ACT.closeDirect = function (taskId, subId) {
    const t = taskById(taskId);
    const sub = t && findSub(t, subId);
    if (!sub || !canDirectClose(t, sub)) return;
    const actual = ITO.actualHoursOf ? ITO.actualHoursOf(sub) : 0;
    const target = Math.round((Number(sub.hours) || 0) * 0.9 * 10) / 10;
    const suggested = Math.max(0.5, Math.round(Math.max(0, target - actual) * 10) / 10);
    U().modal({
      title: '直接闭环任务',
      sub: sub.id + ' · ' + sub.name,
      body: '<div class="form-grid">' +
        U().formRow({ label: '当前状态', control: '<div class="static-field">' + U().esc(sub.status) + ' · ' + (Number(sub.progress) || 0) + '%</div>' }) +
        U().formRow({ label: '本次投入工时', required: true, control: '<input id="dcHours" type="number" min="0" max="200" step="0.5" value="' + suggested + '"><span class="form-hint">闭环后按实际投入补记工时</span>' }) +
        U().formRow({ label: '完成日期', required: true, control: '<input id="dcDate" type="date" value="' + U().esc(D.meta.today) + '">' }) +
        U().formRow({ label: '闭环说明', full: true, control: '<input id="dcNote" type="text" maxlength="60" placeholder="例如：现场确认完成，验收通过">' }) +
      '</div>' +
      '<div class="form-hint" style="margin-top:10px">直接闭环会跳过成果物审批，适用于线下确认完成或演示补录；操作会写入任务记录。</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">确认闭环</button>',
      onMount: function (close, root) {
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', function () {
          const hoursEl = root.querySelector('#dcHours');
          const dateEl = root.querySelector('#dcDate');
          const hours = Number(hoursEl.value) || 0;
          if (!(hours > 0)) { U().showFieldError(hoursEl, '请输入本次投入工时'); return; }
          if (!dateEl.value) { U().showFieldError(dateEl, '请选择完成日期'); return; }
          const before = U().mainStatus(t);
          const note = root.querySelector('#dcNote').value.trim();
          sub.status = '已完成';
          sub.progress = 100;
          sub.completedAt = now();
          if (!sub.approval) {
            sub.approval = { level: 1, approver: t.owner, submittedAt: now(), dueAt: '', decidedAt: now(), comment: note };
          }
          sub.approval.status = '通过';
          sub.approval.decidedAt = now();
          sub.approval.comment = note;
          ITO.addWorkLog(sub, hours, dateEl.value, 'closure');
          const added = ITO.ensureCompletionHours(sub, dateEl.value);
          if (window.DeliverableStore) {
            window.DeliverableStore.saveWorkflow(sub.id, t.id, {
              status: sub.status, progress: sub.progress, completedAt: sub.completedAt,
              approval: sub.approval, actualHours: sub.actualHours, workLogs: sub.workLogs
            });
          }
          grantExecutionTags(t, sub);
          ensureLeaderApproval(t);
          completionMetrics(t, before);
          ITO.log('直接闭环', sub.id + ' ' + sub.name + ' · ' + hours + 'h' + (added ? ' · 补记 ' + added + 'h' : '') + (note ? ' · ' + note : ''), '任务');
          ITO.notify(sub.owner, {
            type: '任务',
            title: '任务已闭环',
            body: t.name + ' · ' + sub.name + ' 已由 ' + S().user.name + ' 闭环',
            link: '#/mine'
          });
          close();
          U().toast('任务已闭环');
          ITO.refresh();
        });
      }
    });
  };

  ACT.editSubFields = function (taskId, subId) {
    const t = taskById(taskId);
    const sub = t && findSub(t, subId);
    if (!sub || !ITO.customFieldForm) return;
    const form = ITO.customFieldForm('task', sub, 'sub');
    U().modal({
      title: '执行任务扩展字段',
      sub: sub.id + ' · ' + sub.name,
      wide: true,
      body: form || U().emptyState('暂无执行任务字段', '可在字典配置中新增作用层级为执行任务的字段', 'clipboard'),
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">保存字段</button>',
      onMount: function (close, root) {
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', function () {
          if (!form) { close(); return; }
          const cf = ITO.readCustomFields(root, 'task', sub.extra || {}, 'sub');
          if (cf.errors.length) { U().toast(cf.errors[0], 'warn'); return; }
          sub.extra = cf.values;
          sub.updatedAt = D.meta.demoNow;
          sub.updatedBy = S().user.name;
          ITO.log('编辑执行任务字段', sub.id + ' · ' + sub.name, '任务');
          close();
          U().toast('执行任务字段已保存');
          ITO.refresh();
        });
      }
    });
  };

  ACT.run = function (act, taskId, subId) {
    if (act === 'dispatch') ACT.openDispatch(taskId, subId);
    else if (act === 'deliverables') ACT.openDeliverables(taskId, subId);
    else if (act === 'approve') ACT.openApprove(taskId, subId);
    else if (act === 'submit') ACT.submit(taskId, subId);
    else if (act === 'resubmit') ACT.resubmit(taskId, subId);
    else if (act === 'log-hours') ACT.addWorkLog(taskId, subId);
    else if (act === 'edit-sub-fields') ACT.editSubFields(taskId, subId);
    else if (act === 'update-progress') ACT.updateProgress(taskId, subId);
    else if (act === 'close-sub') ACT.closeDirect(taskId, subId);
    else if (act === 'detail-sub') ACT.detail(taskId, subId);
    else if (act === 'detail') ACT.detail(taskId);
    else if (act === 'edit') ACT.openTaskForm(taskId);
    else if (act === 'edit-deliverable') ACT.editDeliverable(taskId, subId);
    else if (act === 'delete') ACT.deleteDraft(taskId);
    else if (act === 'reassign') ACT.reassign(taskId, subId);
    else if (act === 'leader') ACT.openLeaderApproval(taskId);
    else if (act === 'cancel') ACT.cancelTask(taskId);
  };

  ACT.exportTasks = function () {
    const list = visibleTasks();
    const customHeaders = (ITO.customFieldExportHeaders ? ITO.customFieldExportHeaders('task') : [])
      .concat(ITO.customFieldExportHeaders ? ITO.customFieldExportHeaders('task', 'sub').map(function (h) { return '执行·' + h; }) : []);
    const rows = [['主任务编号', '主任务', '模式', '任务编号', '任务', '专业组', '发起人', '任务来源', '负责人', '执行人', '等级', '状态', '完成时间', '审批状态', '审批意见', '授权', '需要开票', '标签', '截止时间', '成果物数量', '成果物文件', '提交说明', '提交版本', '汇总附件数量', '汇总附件', '汇总说明'].concat(customHeaders)];
    list.forEach(function (t) {
      const summaryRec = window.DeliverableStore ? window.DeliverableStore.getLatestSummary(t.id) : null;
      if (!t.subs.length) {
        rows.push([
          t.id, t.name, modeLabel(t), t.id, t.name, (ITO.getGroup(t.group) || {}).name,
          t.initiator || '', sourceLabel(t), t.owner, t.owner, t.level, U().displayStatus(t),
          t.completedAt || '—', '—', '—', '—', '否',
          (t.tags || []).join(' / '), t.due,
          summaryRec ? summaryRec.files.length : 0,
          summaryRec ? summaryRec.files.map(function (f) { return f.name; }).join(' / ') : '',
          summaryRec ? summaryRec.note : ''
        ].concat(ITO.customFieldExport ? ITO.customFieldExport('task', t) : [])
          .concat(ITO.customFieldExport ? ITO.customFieldExport('task', t, 'sub') : []));
        return;
      }
      visibleSubs(t).forEach(function (s) {
        const rec = window.DeliverableStore ? window.DeliverableStore.getLatestSubmission(s.id) : null;
        rows.push([
          t.id, t.name, modeLabel(t), s.id, s.name, (ITO.getGroup(s.group) || {}).name,
          t.initiator || '', sourceLabel(t), t.owner, s.owner, s.level, s.status,
          s.completedAt || '—',
          s.approval ? s.approval.status : '—', s.approval ? (s.approval.comment || '') : '—',
          s.auth || '—', s.ticket ? '是' : '否',
          (s.tags || []).join(' / ') || (t.tags || []).join(' / '), s.due,
          rec ? rec.files.length : 0,
          rec ? rec.files.map(function (f) { return f.name; }).join(' / ') : '',
          rec ? rec.note : '',
          rec ? 'v' + rec.version : '',
          summaryRec ? summaryRec.files.length : 0,
          summaryRec ? summaryRec.files.map(function (f) { return f.name; }).join(' / ') : '',
          summaryRec ? summaryRec.note : ''
        ].concat(ITO.customFieldExport ? ITO.customFieldExport('task', t) : [])
          .concat(ITO.customFieldExport ? ITO.customFieldExport('task', s, 'sub') : []));
      });
    });
    U().exportPreview({ title: '任务清单导出预览', rows: rows, filename: 'ITO任务清单-' + D.meta.today + '.csv' });
    ITO.log('预览任务清单', list.length + ' 个主任务', '任务');
    U().toast('任务清单预览已打开');
  };

  /* ── page ────────────────────────────────── */
  let ledgerPage = 1;
  const LEDGER_PAGE_SIZE = 10;
  P.tasks = {
    render: function () {
      const st = S();
      const f = st.taskFilters;
      if (typeof f.q !== 'string') { f.q = ''; f.group = ''; f.status = ''; f.level = ''; f.type = ''; f.age = ''; }
      f.custom = f.custom || {};
      f.systems = f.systems || [];
      const hq = hashQuery();
      if (Object.keys(hq).length) {
        if (st.appliedTaskHash !== location.hash) {
          if (hq.status) f.status = hq.status;
          if (hq.q) f.q = hq.q;
          if (hq.type) f.type = hq.type;
          if (hq.age) f.age = hq.age;
          st.appliedTaskHash = location.hash;
        }
      } else {
        st.appliedTaskHash = '';
      }
      if (st.pendingQuery != null) { f.q = st.pendingQuery; st.pendingQuery = null; }

      const list = visibleTasks();
      ledgerPage = Math.min(Math.max(1, ledgerPage), Math.max(1, Math.ceil(list.length / LEDGER_PAGE_SIZE)));
      const listPage = list.slice((ledgerPage - 1) * LEDGER_PAGE_SIZE, ledgerPage * LEDGER_PAGE_SIZE);
      const taskCustomHeaders = ITO.customFieldHeaders ? ITO.customFieldHeaders('task') : [];
      const flowStatuses = ['草稿', '待分发', '执行中', '审批中', '已挂起', '待汇总', '审批驳回', '已完成', '已取消'];
      const statusLabels = {
        '': '全部状态', '草稿': '草稿', '待分发': '待分发', '执行中': '执行中',
        '审批中': '审批中', '已挂起': '已挂起', '待汇总': '待汇总', '审批驳回': '审批驳回',
        '已完成': '已完成', '已取消': '已取消', '超期': '超期'
      };
      const statusOption = function (x) {
        return '<option value="' + x + '"' + (x === f.status ? ' selected' : '') + '>' + statusLabels[x] + '</option>';
      };

      return U().pageHead({
        title: '任务管理',
        sub: '专项与常规任务台账 · 覆盖 4 个专业组',
        actions: ''
      }) +
      U().taskTabs('ledger') +
      '<div class="jump-float" id="tasksJumpBar">' +
        '<button type="button" data-jump="ledgerCard" class="active">专项任务</button>' +
        '<span class="jump-dot">·</span>' +
        '<button type="button" data-jump="regularCard">常规任务</button>' +
      '</div>' +
      '<div class="toolbar">' +
        '<div class="filters">' +
          '<label class="search-field">' + U().icon('search') + '<input id="taskSearch" type="search" placeholder="搜索任务、人员或编号" value="' + U().esc(f.q) + '"></label>' +
          '<select class="select" id="fGroup"><option value="">全部专业组</option>' + U().groupOptions(f.group) + '</select>' +
          '<select class="select" id="fStatus" data-search="0" aria-label="状态">' +
            '<option value=""' + (f.status === '' ? ' selected' : '') + '>全部状态</option>' +
            flowStatuses.map(statusOption).join('') +
            '<option value="超期"' + (f.status === '超期' ? ' selected' : '') + '>超期</option>' +
          '</select>' +
          '<select class="select" id="fLevel"><option value="">全部优先级</option>' + U().statusOptions(['紧急', '重要', '一般'], f.level) + '</select>' +
          '<select class="select" id="fType" data-search="0" aria-label="类型"><option value="">全部类型</option>' + U().statusOptions(TASK_TYPES, f.type) + '<option value="其他"' + (f.type === '其他' ? ' selected' : '') + '>其他</option></select>' +
          '<select class="select" id="fAge">' +
            '<option value="">全部超期时长</option>' +
            '<option value="lt1"' + (f.age === 'lt1' ? ' selected' : '') + '>&lt;1 天</option>' +
            '<option value="1to3"' + (f.age === '1to3' ? ' selected' : '') + '>1–3 天</option>' +
            '<option value="3to5"' + (f.age === '3to5' ? ' selected' : '') + '>3–5 天</option>' +
            '<option value="gte5"' + (f.age === 'gte5' ? ' selected' : '') + '>≥5 天</option>' +
          '</select>' +
          (ITO.customFieldFilters ? ITO.customFieldFilters('task').filter(function (cf) {
            return cf.key !== 'changeNo';
          }).map(function (cf) {
            return customFilterHtml(cf, f.custom[cf.key]);
          }).join('') : '') +
          systemFilterHtml(f.systems) +
          '<button class="btn btn-ghost" id="clearFilters" type="button">' + U().icon('refresh') + '重置</button>' +
        '</div>' +
      '</div>' +
      '<section class="card table-card" id="ledgerCard">' +
        '<div class="table-head"><div><h3>专项任务</h3><p class="table-note">手工新建任务 · <a href="#/overhaul">大修管理</a> · 点击行查看详情，展开可查看任务；审批中的任务不可编辑</p></div>' +
          '<div class="ledger-meta"><span id="ledgerStats">' + statsChipsHtml(list) + '</span><button class="btn btn-ghost btn-sm" id="taskExportBtn" type="button">' + U().icon('download') + '导出清单</button></div></div>' +
        '<div class="table-wrap"><table class="data-table task-table">' +
          '<thead><tr><th>任务</th><th>专业组</th><th>发起人</th><th>负责人</th><th>授权</th><th>标签</th><th>优先级</th><th>截止时间</th><th>状态</th>' +
            taskCustomHeaders.map(function (h) { return '<th>' + U().esc(h) + '</th>'; }).join('') +
            '<th>操作</th></tr></thead>' +
          '<tbody id="taskTbody">' + rowsHtml(listPage) + '</tbody>' +
        '</table></div>' +
        (list.length ? '<div id="ledgerPager">' + ITO.pager('ledger', list.length, ledgerPage, LEDGER_PAGE_SIZE) + '</div>' : '') +
      '</section>' + P.regular.render(true);
    },

    after: function () {
      const st = S();
      const f = st.taskFilters;

      function updateRows() {
        const list = visibleTasks();
        ledgerPage = Math.min(Math.max(1, ledgerPage), Math.max(1, Math.ceil(list.length / LEDGER_PAGE_SIZE)));
        document.getElementById('taskTbody').innerHTML = rowsHtml(list.slice((ledgerPage - 1) * LEDGER_PAGE_SIZE, ledgerPage * LEDGER_PAGE_SIZE));
        const pagerBox = document.getElementById('ledgerPager');
        if (pagerBox) pagerBox.innerHTML = ITO.pager('ledger', list.length, ledgerPage, LEDGER_PAGE_SIZE);
        const statsBox = document.getElementById('ledgerStats');
        if (statsBox) statsBox.innerHTML = statsChipsHtml(list);
      }
      function applyFilter() { ledgerPage = 1; updateRows(); }

      const search = document.getElementById('taskSearch');
      if (search) search.addEventListener('input', function () { f.q = search.value.trim(); applyFilter(); });
      const fg = document.getElementById('fGroup');
      if (fg) fg.addEventListener('change', function () { f.group = fg.value; applyFilter(); });
      const fs = document.getElementById('fStatus');
      if (fs) fs.addEventListener('change', function () { f.status = fs.value; applyFilter(); });
      const fl = document.getElementById('fLevel');
      if (fl) fl.addEventListener('change', function () { f.level = fl.value; applyFilter(); });
      const ft = document.getElementById('fType');
      if (ft) ft.addEventListener('change', function () { f.type = ft.value; applyFilter(); });
      const fa = document.getElementById('fAge');
      if (fa) fa.addEventListener('change', function () { f.age = fa.value; applyFilter(); });
      const systemFilter = document.querySelector('[data-system-filter]');
      if (systemFilter) {
        const trigger = systemFilter.querySelector('.cf-system-trigger');
        const menu = systemFilter.querySelector('.cf-system-menu');
        const search = systemFilter.querySelector('[data-system-search]');
        const count = systemFilter.querySelector('[data-system-count]');
        const clearBtn = systemFilter.querySelector('[data-system-clear]');
        const options = Array.prototype.slice.call(systemFilter.querySelectorAll('[data-system-opt]'));
        const sections = Array.prototype.slice.call(systemFilter.querySelectorAll('[data-system-group]'));
        const collect = function () {
          return options.filter(function (cb) { return cb.checked; }).map(function (cb) { return cb.dataset.systemOpt; });
        };
        const positionMenu = function () {
          if (menu.hidden) return;
          menu.style.left = '0px';
          const triggerRect = trigger.getBoundingClientRect();
          const menuRect = menu.getBoundingClientRect();
          let offset = 0;
          if (menuRect.right > window.innerWidth - 12) offset = (window.innerWidth - 12) - menuRect.right;
          if (triggerRect.left + offset < 12) offset = 12 - triggerRect.left;
          menu.style.left = offset + 'px';
        };
        const paint = function (apply) {
          const picked = collect();
          f.systems = picked;
          if (count) count.textContent = '已选 ' + picked.length + ' 项';
          trigger.textContent = picked.length === 1 ? picked[0] : (picked.length ? '已选 ' + picked.length + ' 项' : '全部涉及业务系统');
          sections.forEach(function (section) {
            const boxes = Array.prototype.slice.call(section.querySelectorAll('[data-system-opt]'));
            const checked = boxes.filter(function (cb) { return cb.checked; }).length;
            const groupBox = section.querySelector('[data-system-group-box]');
            if (groupBox) {
              groupBox.checked = boxes.length > 0 && checked === boxes.length;
              groupBox.indeterminate = checked > 0 && checked < boxes.length;
            }
          });
          if (apply) applyFilter();
        };
        trigger.addEventListener('click', function (e) {
          e.stopPropagation();
          const willOpen = menu.hidden;
          U().$$('.cf-system-menu, .cf-filter-menu').forEach(function (m) { m.hidden = true; });
          menu.hidden = !willOpen;
          trigger.setAttribute('aria-expanded', String(willOpen));
          if (willOpen) requestAnimationFrame(positionMenu);
          if (willOpen && search) {
            search.value = '';
            search.dispatchEvent(new Event('input', { bubbles: true }));
            setTimeout(function () { search.focus(); }, 0);
          }
        });
        sections.forEach(function (section) {
          const groupBox = section.querySelector('[data-system-group-box]');
          if (!groupBox) return;
          groupBox.addEventListener('change', function () {
            section.querySelectorAll('[data-system-opt]').forEach(function (cb) { cb.checked = groupBox.checked; });
            paint(true);
          });
        });
        options.forEach(function (cb) { cb.addEventListener('change', function () { paint(true); }); });
        if (search) {
          search.addEventListener('input', function () {
            const q = search.value.trim().toLowerCase();
            sections.forEach(function (section) {
              const name = section.querySelector('.cf-system-group-head b').textContent.trim().toLowerCase();
              const groupMatch = !q || name.indexOf(q) > -1;
              let visible = 0;
              section.querySelectorAll('.cf-system-option').forEach(function (opt) {
                const text = String(opt.dataset.systemOptionText || '').toLowerCase();
                const match = !q || groupMatch || text.indexOf(q) > -1;
                opt.style.display = match ? '' : 'none';
                if (match) visible += 1;
              });
              section.style.display = visible ? '' : 'none';
            });
          });
        }
        if (clearBtn) clearBtn.addEventListener('click', function () {
          options.forEach(function (cb) { cb.checked = false; });
          paint(true);
        });
        paint(false);
        window.__systemFilterPosition = positionMenu;
      }
      if (!window.__systemFilterResizeBound) {
        window.__systemFilterResizeBound = true;
        window.addEventListener('resize', function () {
          if (window.__systemFilterPosition) window.__systemFilterPosition();
        });
      }
      if (!window.__systemFilterDocBound) {
        window.__systemFilterDocBound = true;
        document.addEventListener('click', function (e) {
          if (e.target.closest('.cf-system-filter')) return;
          U().$$('.cf-system-menu').forEach(function (m) { m.hidden = true; });
        });
      }
      U().$$('[data-cf-filter-wrap]').forEach(function (wrap) {
        const key = wrap.dataset.cfFilterWrap;
        const toggle = wrap.querySelector('.cf-filter-toggle');
        const menu = wrap.querySelector('.cf-filter-menu');
        const hidden = wrap.querySelector('[data-task-cf]');
        const opts = Array.prototype.slice.call(wrap.querySelectorAll('[data-cf-filter-opt]'));
        const label = toggle.dataset.cfFilterLabel;
        const sync = function () {
          const selected = opts.filter(function (cb) { return cb.checked; }).map(function (cb) { return cb.dataset.cfFilterOpt; });
          hidden.value = selected.join(',');
          toggle.textContent = selected.length ? selected.join('、') : label;
          f.custom = f.custom || {};
          f.custom[key] = selected;
          applyFilter();
        };
        toggle.addEventListener('click', function (e) {
          e.stopPropagation();
          const willOpen = menu.hidden;
          U().$$('.cf-filter-menu').forEach(function (m) { m.hidden = true; });
          menu.hidden = !willOpen;
          toggle.setAttribute('aria-expanded', String(willOpen));
        });
        opts.forEach(function (cb) { cb.addEventListener('change', sync); });
        const clearBtn = wrap.querySelector('[data-cf-filter-clear]');
        if (clearBtn) clearBtn.addEventListener('click', function () {
          opts.forEach(function (cb) { cb.checked = false; });
          sync();
        });
      });
      if (!window.__cfFilterDocBound) {
        window.__cfFilterDocBound = true;
        document.addEventListener('click', function (e) {
          if (e.target.closest('.cf-filter-multi')) return;
          U().$$('.cf-filter-menu').forEach(function (m) { m.hidden = true; });
        });
      }
      const taskCf = Array.prototype.slice.call(document.querySelectorAll('[data-task-cf]'));
      taskCf.forEach(function (el) {
        ['input', 'change'].forEach(function (ev) {
          el.addEventListener(ev, function () {
            f.custom = f.custom || {};
            f.custom[el.dataset.taskCf] = el.value;
            applyFilter();
          });
        });
      });
      const clear = document.getElementById('clearFilters');
      if (clear) clear.addEventListener('click', function () {
        f.q = ''; f.group = ''; f.status = ''; f.level = ''; f.type = ''; f.age = '';
        f.custom = {};
        f.systems = [];
        if (search) search.value = '';
        [fg, fs, fl, ft, fa].forEach(function (el) {
          if (el) { el.value = ''; if (el.__syncPicker) el.__syncPicker(); }
        });
        taskCf.forEach(function (el) { el.value = ''; });
        U().$$('.cf-filter-multi').forEach(function (wrap) {
          wrap.querySelectorAll('[data-cf-filter-opt]').forEach(function (cb) { cb.checked = false; });
          const toggle = wrap.querySelector('.cf-filter-toggle');
          if (toggle) toggle.textContent = toggle.dataset.cfFilterLabel;
        });
        U().$$('[data-system-filter]').forEach(function (wrap) {
          wrap.querySelectorAll('[data-system-opt]').forEach(function (cb) { cb.checked = false; });
          wrap.querySelectorAll('[data-system-group-box]').forEach(function (cb) { cb.checked = false; cb.indeterminate = false; });
          const toggle = wrap.querySelector('.cf-system-trigger');
          if (toggle) toggle.textContent = '全部涉及业务系统';
          const counter = wrap.querySelector('[data-system-count]');
          if (counter) counter.textContent = '已选 0 项';
        });
        applyFilter();
      });
      const ledgerCard = document.getElementById('ledgerCard');
      if (ledgerCard) ledgerCard.addEventListener('click', function (e) {
        const pagerBtn = e.target.closest('[data-pager]');
        if (pagerBtn && !pagerBtn.disabled) { ledgerPage = Number(pagerBtn.dataset.page); updateRows(); }
      });

      const jumpBar = document.getElementById('tasksJumpBar');
      if (jumpBar) {
        jumpBar.addEventListener('click', function (e) {
          const btn = e.target.closest('[data-jump]');
          if (!btn) return;
          const target = document.getElementById(btn.dataset.jump);
          if (!target) return;
          const y = target.getBoundingClientRect().top + (window.scrollY || 0) - 150;
          window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        });
        const spy = function () {
          const bar = document.getElementById('tasksJumpBar');
          if (!bar) return;
          const ledgerEl = document.getElementById('ledgerCard');
          const regularEl = document.getElementById('regularCard');
          const inList = ledgerEl && ledgerEl.getBoundingClientRect().top <= 160;
          bar.classList.toggle('is-visible', !!inList);
          let current = 'ledgerCard';
          if (regularEl && regularEl.getBoundingClientRect().top <= 180) current = 'regularCard';
          Array.prototype.forEach.call(bar.querySelectorAll('[data-jump]'), function (b) {
            b.classList.toggle('active', b.dataset.jump === current);
          });
        };
        if (!window.__tasksSpyBound) {
          window.addEventListener('scroll', function () { if (window.__tasksSpyFn) window.__tasksSpyFn(); }, { passive: true });
          window.__tasksSpyBound = true;
        }
        window.__tasksSpyFn = spy;
        spy();
      }

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
                btn.setAttribute('aria-expanded', String(!row.hidden));
                btn.setAttribute('aria-label', row.hidden ? '展开任务' : '收起任务');
              }
              return;
            }
            ACT.run(btn.dataset.act, btn.dataset.task, btn.dataset.sub);
            return;
          }
          const subItem = e.target.closest('.sub-item[data-sub-detail]');
          if (subItem) {
            const parts = subItem.dataset.subDetail.split('|');
            ACT.run('detail-sub', parts[0], parts[1]);
            return;
          }
          const row = e.target.closest('tr.task-main-row');
          if (row) ACT.detail(row.dataset.id);
        });
        tbody.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          if (e.target.closest('button, a, input, select, textarea')) return;
          const subItem = e.target.closest('.sub-item[data-sub-detail]');
          if (subItem) {
            e.preventDefault();
            const parts = subItem.dataset.subDetail.split('|');
            ACT.run('detail-sub', parts[0], parts[1]);
            return;
          }
          const row = e.target.closest('tr.task-main-row');
          if (row) {
            e.preventDefault();
            ACT.detail(row.dataset.id);
          }
        });
      }

      P.regular.after();
      const expBtn = document.getElementById('taskExportBtn');
      if (expBtn) expBtn.addEventListener('click', ACT.exportTasks);
    }
  };

  ITO.taskActions = ACT;
  P.tasks.actions = ACT;
})();
