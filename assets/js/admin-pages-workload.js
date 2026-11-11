/* ─────────────────────────────────────────────
   pages · regular tasks & workload
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const P = (window.ITO_PAGES = window.ITO_PAGES || {});
  const D = window.ITO_DATA;

  function S() { return ITO.state; }
  function U() { return ITO.ui; }

  function fmtDate(d) {
    const p = function (n) { return n < 10 ? '0' + n : n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function periods() {
    const base = new Date(String(D.meta.today).replace(/-/g, '/'));
    const dow = (base.getDay() + 6) % 7;
    const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - dow);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return {
      weekStart: fmtDate(monday),
      weekEnd: fmtDate(sunday),
      month: String(D.meta.today).slice(0, 7)
    };
  }

  function inPeriod(date, period, kind) {
    if (!date) return false;
    const key = String(date).slice(0, 10);
    if (kind === 'week') return key >= period.weekStart && key <= period.weekEnd;
    return key.slice(0, 7) === period.month;
  }

  function workLogsOf(sub) {
    return Array.isArray(sub && sub.workLogs) ? sub.workLogs : [];
  }

  function actualHoursOf(sub) {
    const logged = workLogsOf(sub).reduce(function (n, log) { return n + (Number(log.hours) || 0); }, 0);
    if (logged > 0) return logged;
    return Number(sub && sub.actualHours) || 0;
  }

  function remainingHoursOf(sub) {
    const budget = Number(sub && sub.hours) || 0;
    return Math.max(0, budget - actualHoursOf(sub));
  }

  function addWorkLog(sub, hours, date, source) {
    const value = Math.round((Number(hours) || 0) * 10) / 10;
    if (!sub || value <= 0) return 0;
    if (!Array.isArray(sub.workLogs)) sub.workLogs = [];
    sub.workLogs.push({
      date: String(date || D.meta.today).slice(0, 10),
      hours: value,
      source: source || 'manual'
    });
    sub.actualHours = Math.round(sub.workLogs.reduce(function (n, log) {
      return n + (Number(log.hours) || 0);
    }, 0) * 10) / 10;
    return value;
  }

  /* 闭环时为已提交任务补记到预算的 90%，已有足额流水时不重复写入。 */
  function ensureCompletionHours(sub, date) {
    if (!sub || sub.status !== '已完成') return 0;
    const budget = Number(sub.hours) || 0;
    if (!budget) return 0;
    const actual = actualHoursOf(sub);
    const target = Math.round(budget * 0.9 * 10) / 10;
    if (actual >= target - 0.05) return 0;
    const hours = Math.round((target - actual) * 10) / 10;
    if (hours < 0.1) return 0;
    return addWorkLog(sub, hours, date, 'closure');
  }

  function loadModel() {
    const st = S();
    const period = periods();
    const rows = st.staff.map(function (person) {
      let week = 0;
      let month = 0;
      let weekActual = 0;
      let monthActual = 0;
      let weekRemaining = 0;
      let monthRemaining = 0;
      let weekDuty = 0;
      let monthDuty = 0;
      const weekIds = {};
      const monthIds = {};

      st.tasks.forEach(function (task) {
        if (task.canceled || task.draft) return;
        (task.subs || []).forEach(function (sub) {
          if (sub.owner !== person.name || sub.status === '已取消') return;
          workLogsOf(sub).forEach(function (log) {
            if (inPeriod(log.date, period, 'week')) {
              week += Number(log.hours) || 0;
              weekActual += Number(log.hours) || 0;
              weekIds[sub.id] = true;
            }
            if (inPeriod(log.date, period, 'month')) {
              month += Number(log.hours) || 0;
              monthActual += Number(log.hours) || 0;
              monthIds[sub.id] = true;
            }
          });
          if (sub.status === '已完成') return;
          const remaining = remainingHoursOf(sub);
          if (remaining <= 0) return;
          if (inPeriod(sub.due, period, 'week')) {
            week += remaining;
            weekRemaining += remaining;
            weekIds[sub.id] = true;
          }
          if (inPeriod(sub.due, period, 'month')) {
            month += remaining;
            monthRemaining += remaining;
            monthIds[sub.id] = true;
          }
        });
      });

      (st.planTasks || []).forEach(function (task) {
        if (task.executor !== person.name) return;
        const done = task.status === '已完成';
        let total, actual, remaining;
        if (task.source === '值班') {
          actual = Number(task.actualHours) || 0;
          remaining = done ? 0 : Math.max(0, (Number(task.hours) || 8) - actual);
          total = actual + remaining;
        } else {
          total = done ? (Number(task.actualHours) || Number(task.hours) || 0) : (Number(task.hours) || 0);
          actual = done ? total : 0;
          remaining = done ? 0 : total;
        }
        if (inPeriod(task.due, period, 'week')) {
          week += total;
          weekActual += actual;
          weekRemaining += remaining;
          weekIds[task.id] = true;
        }
        if (inPeriod(task.due, period, 'month')) {
          month += total;
          monthActual += actual;
          monthRemaining += remaining;
          monthIds[task.id] = true;
        }
      });

      const round1 = function (n) { return Math.round(n * 10) / 10; };
      return {
        person: person,
        group: person.group,
        week: round1(week),
        month: round1(month),
        weekActual: round1(weekActual),
        monthActual: round1(monthActual),
        weekRemaining: round1(weekRemaining),
        monthRemaining: round1(monthRemaining),
        weekDuty: round1(weekDuty),
        monthDuty: round1(monthDuty),
        weekTasks: Object.keys(weekIds).length,
        monthTasks: Object.keys(monthIds).length,
        weekRate: Math.round(week / 40 * 100),
        monthRate: Math.round(month / 160 * 100)
      };
    });
    return { period: period, rows: rows };
  }

  function hasAuth(name, authType) {
    if (!authType || authType === '无需授权' || authType === '—' || authType === '-') return true;
    return (S().auths || []).some(function (a) {
      if (a.person !== name || a.status === '已撤销') return false;
      if (a.type !== authType) return false;
      return ITO.authStatus(a.validTo).status !== '已过期';
    });
  }

  function assigneeInfo(name, authType, hours, due) {
    const model = loadModel();
    const row = model.rows.find(function (r) { return r.person.name === name; });
    const add = Math.max(0, Number(hours) || 0);
    if (!row) return { name: name, weekRate: 0, monthRate: 0, weekRemain: 40, monthRemain: 160, weekAfter: 0, monthAfter: 0, authOk: hasAuth(name, authType) };
    const inWeek = due ? inPeriod(due, model.period, 'week') : true;
    const inMonth = due ? inPeriod(due, model.period, 'month') : true;
    return {
      name: name,
      weekRate: row.weekRate,
      monthRate: row.monthRate,
      weekRemain: Math.max(0, Math.round((40 - row.week) * 10) / 10),
      monthRemain: Math.max(0, Math.round((160 - row.month) * 10) / 10),
      weekAfter: Math.round((row.week + (inWeek ? add : 0)) / 40 * 100),
      monthAfter: Math.round((row.month + (inMonth ? add : 0)) / 160 * 100),
      authOk: hasAuth(name, authType),
      authType: authType || ''
    };
  }

  function guardAssignment(options, next) {
    const info = assigneeInfo(options.name, options.auth, options.hours, options.due);
    const overload = info.weekAfter > 100 || info.monthAfter > 100;
    const authBad = !info.authOk;
    if (!overload && !authBad) { next(); return; }
    const reasons = [];
    if (overload) reasons.push('承接后本周负荷 ' + info.weekAfter + '% / 本月 ' + info.monthAfter + '%，将超过容量上限 100%；');
    if (authBad) reasons.push(info.name + ' 当前不具备「' + (options.auth || '所需') + '」，需主管确认风险；');
    U().modal({
      title: '派发风险确认',
      sub: '负荷与授权匹配校验',
      body: '<div class="detail-section"><p style="margin:0 0 10px">' + U().esc(reasons.join(' ')) + '</p>' +
        '<div class="detail-grid">' +
          '<div class="detail-field"><label>本周负荷</label><div>' + info.weekRate + '% → <b>' + info.weekAfter + '%</b></div></div>' +
          '<div class="detail-field"><label>本月负荷</label><div>' + info.monthRate + '% → <b>' + info.monthAfter + '%</b></div></div>' +
          '<div class="detail-field"><label>本周剩余</label><div>' + info.weekRemain + ' h</div></div>' +
          '<div class="detail-field"><label>授权匹配</label><div>' + (info.authOk ? '已具备' : '<span class="text-red">缺少授权</span>') + '</div></div>' +
        '</div></div>',
      foot: '<button class="btn btn-ghost" data-close type="button">取消</button>' +
        '<button class="btn btn-primary" data-guard-ok type="button">确认继续</button>',
      onMount: function (close, root) {
        root.querySelector('[data-close]').addEventListener('click', close);
        root.querySelector('[data-guard-ok]').addEventListener('click', function () {
          close();
          next();
        });
      }
    });
  }

  ITO.workloadModel = loadModel;
  ITO.workloadPeriods = periods;
  ITO.workLogsOf = workLogsOf;
  ITO.actualHoursOf = actualHoursOf;
  ITO.remainingHoursOf = remainingHoursOf;
  ITO.addWorkLog = addWorkLog;
  ITO.ensureCompletionHours = ensureCompletionHours;
  ITO.hasAuth = hasAuth;
  ITO.assigneeInfo = assigneeInfo;
  ITO.guardAssignment = guardAssignment;

  function loadState(rate) {
    if (rate >= 100) return { label: '超载', tone: 'red' };
    if (rate >= 80) return { label: '偏高', tone: 'yellow' };
    return { label: '正常', tone: 'green' };
  }

  function summary(items) {
    return '<div class="summary-grid">' + items.map(function (x) {
      return '<div class="summary-chip"><span class="icon ' + (x.tone || '') + '">' + U().icon(x.icon) + '</span>' +
        '<div><b>' + x.value + '</b><span>' + x.label + '</span></div></div>';
    }).join('') + '</div>';
  }

  function planDetail(task) {
    const group = ITO.getGroup(task.group) || {};
    const isDuty = task.source === '值班';
    const calls = (task.attendances || []).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    const callRows = calls.map(function (c) {
      return '<div class="mini-row"><span class="dot" style="background:var(--brand)"></span>' +
        '<div class="txt"><b>' + U().esc(c.reason || '现场处置') + '</b><span>' + U().esc(c.date + ' · ' + (c.role || '') + ' · ' + c.hours + 'h') + '</span></div></div>';
    }).join('');
    U().detailModal({
      title: task.name,
      sub: task.source + ' · ' + task.planId,
      body:
        '<div class="detail-grid">' +
          '<div class="detail-field"><label>计划编号</label><div class="mono">' + U().esc(task.planId) + '</div></div>' +
          '<div class="detail-field"><label>专业组</label><div>' + U().esc(group.name || '') + '</div></div>' +
          '<div class="detail-field"><label>负责人</label><div>' + U().esc(task.owner || '') + '</div></div>' +
          '<div class="detail-field"><label>执行人</label><div>' + U().esc(task.executor || '') + '</div></div>' +
          '<div class="detail-field"><label>截止时间</label><div>' + U().esc(task.due || '') + '</div></div>' +
          '<div class="detail-field"><label>标准工时</label><div>' + (task.hours || 0) + ' 小时</div></div>' +
          '<div class="detail-field"><label>状态</label><div>' + U().badge(task.status) + '</div></div>' +
          (task.actualHours ? '<div class="detail-field"><label>实际工时</label><div>' + task.actualHours + ' 小时</div></div>' : '') +
        '</div>' +
        (isDuty
          ? '<div class="detail-section"><h4>出勤记录（' + calls.length + '）</h4>' +
            (calls.length ? '<div class="mini-list">' + callRows + '</div>' : '<p class="muted">本周暂未出勤</p>') +
            '</div>'
          : ''),
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
      onMount: function (close, root) {
        root.querySelector('[data-close]').addEventListener('click', close);
      }
    });
  }

  function dutyHandovers() {
    /* 旧版交接列表已下线；值班改为常规任务，交接区块不再展示。 */
    return [];
  }

  function handoverDetails(h) {
    return '<p>班次 ' + U().esc(h.week.start + ' 至 ' + h.week.end) + ' · 接班人 ' + U().esc(h.incoming) + '</p>' +
      (h.record ? '<p>交接记录：' + U().esc(h.record) + '</p><p>提交：' + U().esc(h.person + ' · ' + h.submittedAt) + '</p>' : '') +
      (h.confirmedAt ? '<p>确认：' + U().esc(h.incoming + ' · ' + h.confirmedAt) + '</p>' : '');
  }

  ITO.dutyHandovers = dutyHandovers;
  ITO.openPlanDetail = function (taskId) {
    const task = (S().planTasks || []).find(function (x) { return x.id === taskId; });
    if (task) planDetail(task);
  };
  ITO.handoverDetails = handoverDetails;
  ITO.openHandover = function (key) {
    const st = S();
    const h = dutyHandovers().find(function (item) { return item.week.key === key; });
    if (!h) return;
    const submitting = h.person === st.user.name && h.status === '待交接';
    const confirming = h.incoming === st.user.name && h.status === '待接班确认';
    if (!submitting && !confirming) return;
    U().modal({
      title: submitting ? '提交值班交接' : '确认接班',
      body: handoverDetails(h) + (submitting ? '<label>交接记录<textarea id="handoverRecord" class="textarea" required maxlength="1000"></textarea></label>' : ''),
      foot: '<button class="btn btn-primary" type="button" data-save-handover>' + (submitting ? '提交记录' : '确认接班') + '</button>',
      onMount: function (close, root) {
        root.querySelector('[data-save-handover]').addEventListener('click', function () {
          const record = root.querySelector('#handoverRecord');
          if (record && !record.value.trim()) { U().toast('请填写交接记录'); record.focus(); return; }
          const handovers = st.duty.handovers || (st.duty.handovers = {});
          handovers[key] = submitting
            ? { person: h.person, incoming: h.incoming, record: record.value.trim(), submittedAt: D.meta.demoNow, status: '待接班确认' }
            : Object.assign({}, handovers[key], { confirmedAt: D.meta.demoNow, status: '已完成' });
          ITO.log(submitting ? '提交值班交接' : '确认接班', h.person + ' → ' + h.incoming, '值班');
          close();
          ITO.refresh();
        });
      }
    });
  };

  function regularFiltered(st) {
    const groupFilter = st.ui.regularGroup || '';
    const sourceFilter = st.ui.regularSource || '';
    const q = (st.ui.regularSearch || '').trim().toLowerCase();
    const hit = function (hay) { return !q || String(hay).toLowerCase().indexOf(q) > -1; };
    const isRegularSource = function (task) { return ['巡检计划', '维保计划', '值班'].indexOf(task.source) > -1; };
    const rows = (st.planTasks || []).filter(function (task) {
      return isRegularSource(task) && (!groupFilter || task.group === groupFilter) && (!sourceFilter || task.source === sourceFilter) &&
        hit([task.name, task.planId, task.source, task.executor].join(' '));
    });
    return { rows: rows, dutyRows: [] };
  }

  function regularTaskRow(task) {
    const duty = task.source === '值班';
    const href = duty ? '#/duty' : '#/' + (task.planType === 'inspection' ? 'inspection' : 'maintenance');
    return '<tr data-plan-task="' + U().esc(task.id) + '" style="cursor:pointer">' +
      '<td><div class="cell-task"><b>' + U().esc(task.name) + '</b><small>' + U().esc(task.planId + ' · ' + task.source) + '</small></div></td>' +
      '<td>' + U().groupPill(task.group) + '</td>' +
      '<td>' + U().esc(task.executor || '—') + '</td>' +
      '<td class="num">' + (task.hours || 0) + ' h</td>' +
      '<td class="num" style="white-space:nowrap">' + U().shortDate(task.due) + '</td>' +
      '<td>' + U().badge(task.status) + '</td>' +
      '<td style="text-align:right"><a class="btn btn-ghost btn-sm" href="' + href + '">' + (duty ? '查看排班' : '查看来源') + '</a></td>' +
    '</tr>';
  }

  function regularDutyRow(h) {
    return '<tr data-duty-week="' + U().esc(h.week.key) + '">' +
      '<td><div class="cell-task"><b>值班交接 · 第 ' + h.week.weekNo + ' 周</b><small>' + U().esc(h.week.start + ' ~ ' + h.week.end) + ' · 交接给 ' + U().esc(h.incoming) + (h.record ? ' · 已有交接记录' : '') + '</small></div></td>' +
      '<td>' + (h.group ? U().groupPill(h.group) : '—') + '</td><td>' + U().esc(h.person) +
      '</td><td>—</td><td>' + U().esc(h.due) + '</td><td>' + U().badge(h.status) +
      '</td><td style="text-align:right"><a class="btn btn-ghost btn-sm" href="#/duty">查看排班</a></td></tr>';
  }

  const REGULAR_PAGE_SIZE = 10;

  P.regular = {
    render: function (embedded) {
      const st = S();
      st.ui = st.ui || {};
      const groupFilter = st.ui.regularGroup || '';
      const sourceFilter = st.ui.regularSource || '';
      const filtered = regularFiltered(st);
      const rows = filtered.rows;
      const dutyRows = filtered.dutyRows;
      const sourceOptions = ['巡检计划', '维保计划', '值班'].map(function (x) {
        return '<option value="' + x + '"' + (sourceFilter === x ? ' selected' : '') + '>' + x + '</option>';
      }).join('');
      const all = rows.map(regularTaskRow).concat(dutyRows.map(regularDutyRow));
      const pages = Math.max(1, Math.ceil(all.length / REGULAR_PAGE_SIZE));
      const page = Math.min(Math.max(1, st.ui.regularPage || 1), pages);
      st.ui.regularPage = page;
      const body = all.slice((page - 1) * REGULAR_PAGE_SIZE, page * REGULAR_PAGE_SIZE).join('');
      const doneCount = rows.filter(function (t) { return t.status === '已完成'; }).length + dutyRows.filter(function (h) { return h.status === '已完成'; }).length;
      const table =
        '<section class="card table-card" id="regularCard">' +
          '<div class="table-head"><div class="report-head-left">' +
            '<h3>常规任务</h3><p class="table-note">巡检 / 维保计划与值班排班 · 共 ' + all.length + ' 项 · 已完成 ' + doneCount + '</p>' +
            '<input class="oh-search" id="regularSearch" type="search" placeholder="搜索任务 / 编号 / 执行人…" value="' + U().esc(st.ui.regularSearch || '') + '">' +
            '<select class="select" id="regularGroup" aria-label="专业组"><option value="">全部专业组</option>' + U().groupOptions(groupFilter) + '</select>' +
            '<select class="select" id="regularSource" aria-label="来源"><option value="">全部来源</option>' + sourceOptions + '</select>' +
          '</div>' +
            '<button class="btn btn-ghost btn-sm" id="regularExportBtn" type="button">' + U().icon('download') + '导出常规任务</button></div>' +
          '<div class="table-wrap"><table class="data-table regular-table">' +
            '<colgroup><col style="width:24%"><col style="width:16%"><col style="width:10%"><col style="width:10%"><col style="width:14%"><col style="width:11%"><col style="width:15%"></colgroup>' +
            '<thead><tr><th>任务</th><th>专业组</th><th>执行人</th><th>标准工时</th><th>截止时间</th><th>状态</th><th style="text-align:center">操作</th></tr></thead>' +
            '<tbody id="regularTbody">' + (body || '<tr><td colspan="7">' + U().emptyState('暂无常规任务', '启用巡检 / 维保计划后会自动生成', 'clipboard') + '</td></tr>') + '</tbody></table></div>' +
          (all.length ? '<div id="regularLedgerPager">' + ITO.pager('regularLedger', all.length, page, REGULAR_PAGE_SIZE) + '</div>' : '') +
        '</section>';

      if (embedded) return table;

      return '<section id="regular-ledger">' + U().pageHead({
        title: '常规任务',
        sub: '巡检、维保及值班排班与交接记录',
        actions: '<button class="btn btn-ghost" id="regularExportBtn" type="button">' + U().icon('download') + '导出常规任务</button>'
      }) +
      summary([
        { icon: 'clipboard', value: all.length, label: '常规任务' },
        { icon: 'check', value: doneCount, label: '已完成', tone: 'green' },
        { icon: 'clock', value: all.length - doneCount, label: '待处理', tone: 'yellow' }
      ]) +
      table + '</section>';
    },

    after: function () {
      const st = S();
      function applyRegularFilter() {
        const filtered = regularFiltered(st);
        const all = filtered.rows.map(regularTaskRow).concat(filtered.dutyRows.map(regularDutyRow));
        const pages = Math.max(1, Math.ceil(all.length / REGULAR_PAGE_SIZE));
        const page = Math.min(Math.max(1, st.ui.regularPage || 1), pages);
        st.ui.regularPage = page;
        const body = document.getElementById('regularTbody');
        if (body) body.innerHTML = all.slice((page - 1) * REGULAR_PAGE_SIZE, page * REGULAR_PAGE_SIZE).join('') ||
          '<tr><td colspan="7">' + U().emptyState('暂无常规任务', '启用巡检 / 维保计划后会自动生成', 'clipboard') + '</td></tr>';
        const box = document.getElementById('regularLedgerPager');
        if (box) box.innerHTML = ITO.pager('regularLedger', all.length, page, REGULAR_PAGE_SIZE);
      }
      const group = document.getElementById('regularGroup');
      const source = document.getElementById('regularSource');
      if (group) group.addEventListener('change', function () { st.ui.regularGroup = group.value; st.ui.regularPage = 1; applyRegularFilter(); });
      if (source) source.addEventListener('change', function () { st.ui.regularSource = source.value; st.ui.regularPage = 1; applyRegularFilter(); });
      const searchBox = document.getElementById('regularSearch');
      if (searchBox) searchBox.addEventListener('input', function () { st.ui.regularSearch = searchBox.value; st.ui.regularPage = 1; applyRegularFilter(); });
      const ledger = document.getElementById('regularCard');
      if (ledger) {
        ledger.addEventListener('click', function (e) {
          const pagerBtn = e.target.closest('[data-pager]');
          if (pagerBtn) {
            if (!pagerBtn.disabled) { st.ui.regularPage = Number(pagerBtn.dataset.page); applyRegularFilter(); }
            return;
          }
          const row = e.target.closest('[data-plan-task]');
          if (row && !e.target.closest('a, button')) {
            const task = (st.planTasks || []).find(function (x) { return x.id === row.dataset.planTask; });
            if (task) planDetail(task);
            return;
          }
          const dw = e.target.closest('[data-duty-week]');
          if (dw && !e.target.closest('a, button') && ITO.openDutySheet) ITO.openDutySheet(dw.dataset.dutyWeek);
        });
      }
      const exp = document.getElementById('regularExportBtn');
      if (exp) exp.addEventListener('click', function () {
        const rows = [['来源', '计划编号', '任务', '专业组', '执行人', '标准工时', '截止时间', '状态']];
        (st.planTasks || []).forEach(function (t) {
          rows.push([t.source, t.planId, t.name, (ITO.getGroup(t.group) || {}).name, t.executor, t.hours || 0, t.due, t.status]);
        });
        dutyHandovers().forEach(function (h) {
          rows.push(['值班', h.week.key, '值班交接', (ITO.getGroup(h.group) || {}).name, h.person, '', h.due, h.status]);
        });
        U().exportPreview({ title: '常规任务导出预览', rows: rows, filename: 'ITO常规任务.csv' });
      });
    }
  };

  P.workload = {
    render: function () {
      const st = S();
      st.ui = st.ui || {};
      const model = loadModel();
      const groupFilter = st.ui.workloadGroup || '';
      const rows = model.rows.filter(function (r) { return !groupFilter || r.group === groupFilter; });
      const avgWeek = rows.length ? Math.round(rows.reduce(function (n, r) { return n + r.weekRate; }, 0) / rows.length) : 0;
      const overloaded = rows.filter(function (r) { return r.weekRate >= 100 || r.monthRate >= 100; }).length;
      const body = rows.map(function (r) {
        const state = loadState(Math.max(r.weekRate, r.monthRate));
        return '<tr>' +
          '<td><div class="person-cell"><div><b>' + U().esc(r.person.name) + '</b><small>' + U().esc(r.person.title || '') + '</small></div></div></td>' +
          '<td class="workload-uid mono">' + U().esc(r.person.uid || '—') + '</td>' +
          '<td>' + U().groupPill(r.group) + '</td>' +
          '<td class="num">' + r.weekTasks + '</td>' +
          '<td class="num">' + r.week.toFixed(1) + '</td>' +
          '<td class="num">' + r.weekActual.toFixed(1) + '</td>' +
          '<td class="num">' + r.weekRemaining.toFixed(1) + '</td>' +
          '<td><div class="load-cell"><b>' + r.weekRate + '%</b><i style="--v:' + Math.min(100, r.weekRate) + '%"></i></div></td>' +
          '<td class="num">' + r.month.toFixed(1) + '</td>' +
          '<td class="num">' + r.monthActual.toFixed(1) + '</td>' +
          '<td class="num">' + r.monthRemaining.toFixed(1) + '</td>' +
          '<td><div class="load-cell"><b>' + r.monthRate + '%</b><i style="--v:' + Math.min(100, r.monthRate) + '%"></i></div></td>' +
          '<td>' + U().badge(state.label, state.tone) + '</td>' +
        '</tr>';
      }).join('');
      return U().pageHead({
        title: '工时负载',
        sub: '当前周 ' + model.period.weekStart + ' 至 ' + model.period.weekEnd + ' · 周容量 40h / 月容量 160h · 值班待命不计，出勤按天 8h 计入',
        actions: ''
      }) +
      U().taskTabs('workload') +
      summary([
        { icon: 'users', value: rows.length, label: '统计人员' },
        { icon: 'chart', value: avgWeek + '%', label: '平均周负载', tone: 'blue' },
        { icon: 'alert', value: overloaded, label: '超载人员', tone: overloaded ? 'red' : 'green' },
        { icon: 'clock', value: rows.reduce(function (n, r) { return n + r.month; }, 0).toFixed(1) + ' h', label: '本月负载工时' }
      ]) +
      '<div class="toolbar" style="margin-bottom:12px"><div class="filters">' +
        '<select class="select" id="workloadGroup"><option value="">全部专业组</option>' + U().groupOptions(groupFilter) + '</select>' +
      '</div><span class="table-note">含常规任务、专项任务与值班出勤</span></div>' +
      '<section class="card table-card"><div class="table-wrap"><table class="data-table workload-table">' +
        '<colgroup>' +
          '<col style="width:8%"><col style="width:8%"><col style="width:8%"><col style="width:7%">' +
          '<col style="width:7%"><col style="width:7%"><col style="width:7%">' +
          '<col style="width:10%">' +
          '<col style="width:7%"><col style="width:7%"><col style="width:7%">' +
          '<col style="width:10%"><col style="width:7%">' +
        '</colgroup>' +
        '<thead>' +
          '<tr>' +
            '<th rowspan="2">人员</th><th rowspan="2">UID</th><th rowspan="2">专业组</th><th rowspan="2">本周任务数</th>' +
            '<th colspan="3" class="group-head">本周工时（h）</th>' +
            '<th rowspan="2">周负载</th>' +
            '<th colspan="3" class="group-head">本月工时（h）</th>' +
            '<th rowspan="2">月负载</th><th rowspan="2">状态</th>' +
          '</tr>' +
          '<tr><th>计划</th><th>实际</th><th>剩余</th><th>计划</th><th>实际</th><th>剩余</th></tr>' +
        '</thead><tbody>' +
        (body || '<tr><td colspan="13">' + U().emptyState('暂无负载数据', '任务或值班排班后自动计算', 'chart') + '</td></tr>') +
      '</tbody></table></div></section>';
    },

    after: function () {
      const st = S();
      const group = document.getElementById('workloadGroup');
      if (group) group.addEventListener('change', function () {
        st.ui.workloadGroup = group.value;
        ITO.refresh();
      });
    }
  };
})();
