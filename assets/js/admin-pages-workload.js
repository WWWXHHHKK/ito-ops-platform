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

  function loadModel() {
    const st = S();
    const period = periods();
    const rows = st.staff.map(function (person) {
      let week = 0;
      let month = 0;
      let weekTasks = 0;
      let monthTasks = 0;

      st.tasks.forEach(function (task) {
        if (task.canceled || task.draft) return;
        (task.subs || []).forEach(function (sub) {
          if (sub.owner !== person.name) return;
          if (sub.status === '已完成' || sub.status === '已取消') return;
          const hours = Math.max(0, (Number(sub.hours) || 0) * (1 - Math.min(100, Math.max(0, Number(sub.progress) || 0)) / 100));
          if (hours <= 0) return;
          if (inPeriod(sub.due, period, 'week')) { week += hours; weekTasks += 1; }
          if (inPeriod(sub.due, period, 'month')) { month += hours; monthTasks += 1; }
        });
      });

      (st.planTasks || []).forEach(function (task) {
        if (task.executor !== person.name) return;
        const hours = task.status === '已完成' ? (Number(task.actualHours) || 0) : (Number(task.hours) || 0);
        if (inPeriod(task.due, period, 'week')) { week += hours; weekTasks += 1; }
        if (inPeriod(task.due, period, 'month')) { month += hours; monthTasks += 1; }
      });

      // 值班按 8h/天，每周模拟 1 个值班日；仅当前周 / 当月排班计入。
      (st.duty.weeks || []).forEach(function (weekRow) {
        if (weekRow.person !== person.name) return;
        const dutyHours = 8;
        if (inPeriod(weekRow.start, period, 'week')) { week += dutyHours; weekTasks += 1; }
        if (inPeriod(weekRow.start, period, 'month')) { month += dutyHours; monthTasks += 1; }
      });

      return {
        person: person,
        group: person.group,
        week: Math.round(week * 10) / 10,
        month: Math.round(month * 10) / 10,
        weekTasks: weekTasks,
        monthTasks: monthTasks,
        weekRate: Math.round(week / 40 * 100),
        monthRate: Math.round(month / 160 * 100)
      };
    });
    return { period: period, rows: rows };
  }

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
    U().detailModal({
      title: task.name,
      sub: task.source + ' · ' + task.planId,
      body:
        '<div class="detail-grid">' +
          '<div class="detail-field"><label>专业组</label><div>' + U().esc(group.name || '') + '</div></div>' +
          '<div class="detail-field"><label>负责人</label><div>' + U().esc(task.owner || '') + '</div></div>' +
          '<div class="detail-field"><label>执行人</label><div>' + U().esc(task.executor || '') + '</div></div>' +
          '<div class="detail-field"><label>截止时间</label><div>' + U().esc(task.due || '') + '</div></div>' +
          '<div class="detail-field"><label>标准工时</label><div>' + (task.hours || 0) + ' 小时</div></div>' +
          '<div class="detail-field"><label>状态</label><div>' + U().badge(task.status) + '</div></div>' +
          (task.actualHours ? '<div class="detail-field"><label>实际工时</label><div>' + task.actualHours + ' 小时</div></div>' : '') +
        '</div>',
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
      onMount: function (close, root) {
        root.querySelector('[data-close]').addEventListener('click', close);
      }
    });
  }

  function dutyHandovers() {
    const st = S();
    return st.duty.weeks.slice(0, -1).map(function (week, index) {
      const next = st.duty.weeks[index + 1];
      const saved = (st.duty.handovers || {})[week.key];
      const member = st.staff.find(function (p) { return p.name === week.person; });
      return Object.assign({
        week, person: week.person, incoming: next.person, group: member && member.group,
        due: next.start + ' ' + st.duty.handover, status: '待提交'
      }, saved);
    });
  }

  function handoverDetails(h) {
    return '<p>班次 ' + U().esc(h.week.start + ' 至 ' + h.week.end) + ' · 接班人 ' + U().esc(h.incoming) + '</p>' +
      (h.record ? '<p>交接记录：' + U().esc(h.record) + '</p><p>提交：' + U().esc(h.person + ' · ' + h.submittedAt) + '</p>' : '') +
      (h.confirmedAt ? '<p>确认：' + U().esc(h.incoming + ' · ' + h.confirmedAt) + '</p>' : '');
  }

  ITO.dutyHandovers = dutyHandovers;
  ITO.handoverDetails = handoverDetails;
  ITO.openHandover = function (key) {
    const st = S();
    const h = dutyHandovers().find(function (item) { return item.week.key === key; });
    if (!h) return;
    const submitting = h.person === st.user.name && h.status === '待提交';
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
    const isRegularSource = function (task) { return ['巡检计划', '维保计划'].indexOf(task.source) > -1; };
    const rows = (st.planTasks || []).filter(function (task) {
      return isRegularSource(task) && (!groupFilter || task.group === groupFilter) && (!sourceFilter || task.source === sourceFilter);
    });
    const dutyRows = dutyHandovers().filter(function (h) {
      return (!sourceFilter || sourceFilter === '值班') && (!groupFilter || h.group === groupFilter);
    });
    return { rows: rows, dutyRows: dutyRows };
  }

  function regularTaskRow(task) {
    return '<tr data-plan-task="' + U().esc(task.id) + '" style="cursor:pointer">' +
      '<td><div class="cell-task"><b>' + U().esc(task.name) + '</b><small>' + U().esc(task.planId + ' · ' + task.source) + '</small></div></td>' +
      '<td>' + U().groupPill(task.group) + '</td>' +
      '<td>' + U().esc(task.executor || '—') + '</td>' +
      '<td class="num">' + (task.hours || 0) + ' h</td>' +
      '<td class="num" style="white-space:nowrap">' + U().shortDate(task.due) + '</td>' +
      '<td>' + U().badge(task.status) + '</td>' +
      '<td style="text-align:right"><a class="btn btn-ghost btn-sm" href="#/' + (task.planType === 'inspection' ? 'inspection' : 'maintenance') + '">查看来源</a></td>' +
    '</tr>';
  }

  function regularDutyRow(h) {
    return '<tr><td><details><summary>值班排班 · 第 ' + h.week.weekNo + ' 周</summary>' + handoverDetails(h) +
      '</details></td><td>' + (h.group ? U().groupPill(h.group) : '—') + '</td><td>' + U().esc(h.person) +
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
          '<div class="table-head"><div><h3>常规任务</h3><p class="table-note">巡检 / 维保计划与值班排班 · 共 ' + all.length + ' 项 · 已完成 ' + doneCount + '</p></div>' +
            '<button class="btn btn-ghost btn-sm" id="regularExportBtn" type="button">' + U().icon('download') + '导出常规任务</button></div>' +
          '<div class="toolbar" style="margin:0 20px 12px"><div class="filters">' +
            '<select class="select" id="regularGroup"><option value="">全部专业组</option>' + U().groupOptions(groupFilter) + '</select>' +
            '<select class="select" id="regularSource"><option value="">全部来源</option>' + sourceOptions + '</select>' +
          '</div></div>' +
          '<div class="table-wrap"><table class="data-table"><thead><tr><th>任务</th><th>专业组</th><th>执行人</th><th>标准工时</th><th>截止时间</th><th>状态</th><th style="text-align:right">操作</th></tr></thead>' +
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
          }
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
          '<td>' + U().groupPill(r.group) + '</td>' +
          '<td class="num">' + r.weekTasks + '</td>' +
          '<td class="num">' + r.week + ' h</td>' +
          '<td><div class="load-cell"><b>' + r.weekRate + '%</b><i style="--v:' + Math.min(100, r.weekRate) + '%"></i></div></td>' +
          '<td class="num">' + r.month + ' h</td>' +
          '<td><div class="load-cell"><b>' + r.monthRate + '%</b><i style="--v:' + Math.min(100, r.monthRate) + '%"></i></div></td>' +
          '<td>' + U().badge(state.label, state.tone) + '</td>' +
        '</tr>';
      }).join('');
      return U().pageHead({
        title: '工时负载',
        sub: '当前周 ' + model.period.weekStart + ' 至 ' + model.period.weekEnd + ' · 周容量 40h / 月容量 160h · 值班按 8h/天、每周 1 天模拟',
        actions: ''
      }) +
      U().taskTabs('workload') +
      summary([
        { icon: 'users', value: rows.length, label: '统计人员' },
        { icon: 'chart', value: avgWeek + '%', label: '平均周负载', tone: 'blue' },
        { icon: 'alert', value: overloaded, label: '超载人员', tone: overloaded ? 'red' : 'green' },
        { icon: 'clock', value: rows.reduce(function (n, r) { return n + r.month; }, 0) + ' h', label: '本月已排工时' }
      ]) +
      '<div class="toolbar" style="margin-bottom:12px"><div class="filters">' +
        '<select class="select" id="workloadGroup"><option value="">全部专业组</option>' + U().groupOptions(groupFilter) + '</select>' +
      '</div><span class="table-note">含常规任务、专项任务与值班工时</span></div>' +
      '<section class="card table-card"><div class="table-wrap"><table class="data-table"><thead><tr><th>人员</th><th>专业组</th><th>本周任务</th><th>本周工时</th><th>周负载</th><th>本月工时</th><th>月负载</th><th>状态</th></tr></thead><tbody>' +
        (body || '<tr><td colspan="8">' + U().emptyState('暂无负载数据', '任务或值班排班后自动计算', 'chart') + '</td></tr>') +
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
