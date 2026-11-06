/* ─────────────────────────────────────────────
   pages · inspection & maintenance
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const P = (window.ITO_PAGES = window.ITO_PAGES || {});
  const D = window.ITO_DATA;

  function S() { return ITO.state; }
  function U() { return ITO.ui; }

  function summary(items) {
    return '<div class="summary-grid">' + items.map(function (x) {
      return '<div class="summary-chip"><span class="icon ' + (x.tone || '') + '">' + U().icon(x.icon) + '</span>' +
        '<div><b>' + x.value + '</b><span>' + x.label + '</span></div></div>';
    }).join('') + '</div>';
  }

  function tabs(current, list) {
    return '<div class="tabs">' + list.map(function (t) {
      return '<button class="tab' + (t.id === current ? ' active' : '') + '" data-tab="' + t.id + '" type="button">' + t.name + '</button>';
    }).join('') + '</div>';
  }

  function planCycleOptions(selected) {
    return U().statusOptions(['每日', '每周', '每月', '每季度', '每半年', '每年'], selected);
  }

  function offsetDate(days, time) {
    const d = new Date(D.meta.today.replace(/-/g, '/'));
    d.setDate(d.getDate() + days);
    const p = function (n) { return n < 10 ? '0' + n : n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + (time || '18:00');
  }

  function futureDate(days) {
    return offsetDate(days || 3, '18:00');
  }

  function autoRectifyTask(group, planName, note, abnormal) {
    const st = S();
    const id = 'T' + (st.taskSeq++);
    const staff = st.staff.filter(function (p) { return p.group === group; });
    const owner = (staff.find(function (p) { return p.tags.indexOf('核心岗') > -1; }) || staff[0] || {}).name || '待指派';
    st.tasks.unshift({
      id: id, name: planName + '异常整改', group: group, owner: owner, initiator: '系统',
      level: abnormal >= 2 ? '紧急' : '重要', type: '工单', due: futureDate(3),
      tags: ['巡检整改', '自动生成'], desc: note,
      subs: [{
        id: id + '-01', name: planName + '异常整改', group: group, owner: owner, initiator: '系统',
        level: abnormal >= 2 ? '紧急' : '重要', type: '工单', status: '待派发', due: futureDate(3),
        hours: 4, progress: 0, auth: '工作负责人授权', ticket: false
      }]
    });
    st.metrics.active += 1;
    st.metrics.groupActive[group] = (st.metrics.groupActive[group] || 0) + 1;
    st.metrics.newTasks += 1;
    st.trend.newTasks[st.trend.newTasks.length - 1] += 1;
    ITO.log('自动生成整改任务', id + ' ' + planName + '异常整改', '系统');
    return id;
  }

  /* ── inspection ──────────────────────────── */
  const IP = {};

  IP.savePlan = function (planId) {
    const st = S();
    const plan = planId ? st.inspectionPlans.find(function (p) { return p.id === planId; }) : null;
    const editing = !!plan;

    U().modal({
      title: editing ? '编辑巡检计划' : '新建巡检计划',
      sub: editing ? plan.id : '计划启用后将按周期自动生成待执行提醒',
      wide: true,
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '计划名称', required: true, full: true, control: '<input id="ipName" type="text" maxlength="30" value="' + U().esc(plan ? plan.name : '') + '" placeholder="例如：核心机房周检">' }) +
          U().formRow({ label: '专业组', required: true, control: '<select id="ipGroup"><option value="">请选择专业组</option>' + U().groupOptions(plan ? plan.group : '') + '</select>' }) +
          U().formRow({ label: '负责人', required: true, control: '<select id="ipOwner"><option value="">请选择负责人</option>' + U().leadOptions(plan ? plan.group : '', plan ? plan.owner : '') + '</select>' }) +
          U().formRow({ label: '执行人', required: true, control: '<select id="ipExecutor"><option value="">请选择执行人</option>' + U().staffOptions(plan ? plan.group : '', plan ? plan.executor : '') + '</select>' }) +
          U().formRow({ label: '标准工时', required: true, control: '<input id="ipHours" type="number" min="1" max="999" step="0.5" value="' + (plan ? (plan.hours || '') : '') + '" placeholder="例如：4"><span class="form-hint">每次执行的标准工时，用于任务同步和人员负载</span>' }) +
          U().formRow({ label: '执行周期', required: true, control: '<select id="ipCycle"><option value="">请选择执行周期</option>' + planCycleOptions(plan ? plan.cycle : '') + '</select>' }) +
          U().formRow({ label: '下次执行', required: true, control: '<input id="ipNext" type="datetime-local" value="' + String(plan ? plan.next : '').replace(' ', 'T') + '">' }) +
          U().formRow({ label: '巡检内容', full: true, control: '<textarea id="ipContent" placeholder="填写巡检范围与检查项">' + U().esc(plan ? plan.content : '') + '</textarea>' }) +
          U().formRow({ label: '合格标准', full: true, control: '<textarea id="ipStandard" placeholder="填写判定标准与阈值">' + U().esc(plan ? plan.standard : '') + '</textarea>' }) +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-save type="button">' + (editing ? '保存修改' : '创建计划') + '</button>',
      onMount: function (close, root) {
        root.querySelector('#ipGroup').addEventListener('change', function (e) {
          root.querySelector('#ipOwner').innerHTML = '<option value="">请选择负责人</option>' + U().leadOptions(e.target.value);
          root.querySelector('#ipExecutor').innerHTML = '<option value="">请选择执行人</option>' + U().staffOptions(e.target.value, '');
        });
        root.querySelector('[data-cancel]').addEventListener('click', close);
        U().bindFieldClear(root);
        root.querySelector('[data-save]').addEventListener('click', function () {
          const nameEl = root.querySelector('#ipName');
          const groupEl = root.querySelector('#ipGroup');
          const ownerEl = root.querySelector('#ipOwner');
          const executorEl = root.querySelector('#ipExecutor');
          const hoursEl = root.querySelector('#ipHours');
          const cycleEl = root.querySelector('#ipCycle');
          const nextEl = root.querySelector('#ipNext');
          const valid = U().validateRequired([
            [nameEl, '请输入计划名称'],
            [groupEl, '请选择专业组'],
            [ownerEl, '请选择负责人'],
            [executorEl, '请选择执行人'],
            [hoursEl, '请输入标准工时'],
            [cycleEl, '请选择执行周期'],
            [nextEl, '请选择下次执行时间']
          ]);
          if (!valid) return;
          const hours = Number(hoursEl.value);
          if (!(hours > 0)) { U().showFieldError(hoursEl, '标准工时必须大于 0'); return; }
          const name = nameEl.value.trim();
          const group = groupEl.value;
          const owner = ownerEl.value;
          const executor = executorEl.value;
          const cycle = cycleEl.value;
          const next = nextEl.value;
          const now = D.meta.demoNow;
          const data = {
            name: name,
            group: group,
            owner: owner,
            executor: executor,
            hours: hours,
            cycle: cycle,
            next: next.replace('T', ' '),
            content: root.querySelector('#ipContent').value.trim() || '按标准巡检清单执行',
            standard: root.querySelector('#ipStandard').value.trim() || '设备运行正常，无异常告警',
            status: plan ? plan.status : '启用'
          };
          if (editing) {
            Object.assign(plan, data, { updatedAt: now, updatedBy: st.user.name });
            plan.audit = plan.audit || [];
            plan.audit.push({ time: now, actor: st.user.name, action: '编辑计划' });
            ITO.log('编辑巡检计划', plan.id + ' ' + plan.name, '巡检');
            U().toast('巡检计划已更新');
          } else {
            st.planSeq = (st.planSeq || 5) + 1;
            const id = 'IP-' + String(st.planSeq).padStart(3, '0');
            st.inspectionPlans.unshift(Object.assign({
              id: id,
              createdAt: now,
              createdBy: st.user.name,
              updatedAt: now,
              updatedBy: st.user.name,
              statusChangedAt: now,
              statusChangedBy: st.user.name,
              audit: [{ time: now, actor: st.user.name, action: '创建计划' }]
            }, data));
            ITO.log('新建巡检计划', id + ' ' + name, '巡检');
            U().toast('巡检计划已创建');
          }
          close();
          ITO.syncPlanTasks();
          ITO.refresh();
        });
      }
    });
  };

  IP.execute = function (planId) {
    const st = S();
    const plan = st.inspectionPlans.find(function (p) { return p.id === planId; });
    if (!plan) return;

    U().modal({
      title: '执行巡检',
      sub: plan.name + ' · ' + plan.id,
      wide: true,
      body:
        '<div class="exec-brief"><div><label>巡检内容</label><p>' + U().esc(plan.content) + '</p></div>' +
          '<div><label>合格标准</label><p>' + U().esc(plan.standard) + '</p></div></div>' +
        '<div class="form-grid" style="margin-top:16px">' +
          U().formRow({ label: '执行人', control: '<select id="exOwner">' + U().staffOptions(plan.group, plan.executor || plan.owner) + '</select>' }) +
          U().formRow({ label: '实际工时', required: true, control: '<input id="exHours" type="number" min="0.5" max="999" step="0.5" value="' + (plan.hours || '') + '">' }) +
          U().formRow({ label: '巡检结果', control: '<select id="exResult">' + U().statusOptions(['正常', '异常'], '正常') + '</select>' }) +
          U().formRow({ label: '检查项数量', control: '<input id="exItems" type="number" min="1" max="99" value="12">' }) +
          U().formRow({ label: '异常项数量', control: '<input id="exAbnormal" type="number" min="0" max="99" value="0">' }) +
          U().formRow({ label: '巡检说明', full: true, control: '<textarea id="exNote" placeholder="记录关键读数、异常现象与临时处置"></textarea>' }) +
        '</div>' +
        '<div class="form-hint" style="margin-top:10px">结果选择「异常」时，系统将自动生成整改任务并进入派发队列。</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">' + U().icon('check') + '提交巡检记录</button>',
      onMount: function (close, root) {
        const resultSel = root.querySelector('#exResult');
        const abnormalInput = root.querySelector('#exAbnormal');
        resultSel.addEventListener('change', function () {
          if (resultSel.value === '异常' && Number(abnormalInput.value) === 0) abnormalInput.value = 1;
          if (resultSel.value === '正常') abnormalInput.value = 0;
        });
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', function () {
          const result = resultSel.value;
          const abnormal = Math.max(0, Number(abnormalInput.value) || 0);
          const hours = Number(root.querySelector('#exHours').value);
          if (!(hours > 0)) { U().toast('请填写实际工时', 'warn'); return; }
          if (result === '异常' && abnormal < 1) { U().toast('异常巡检需填写异常项数量', 'warn'); return; }
          st.recordSeq = (st.recordSeq || 1027) + 1;
          const id = 'IR-' + st.recordSeq;
          const note = root.querySelector('#exNote').value.trim() ||
            (result === '正常' ? '各项指标均在标准范围内' : '发现异常项，已安排整改');
          const record = {
            id: id, plan: plan.name, group: plan.group,
            owner: root.querySelector('#exOwner').value,
            hours: hours,
            time: ITO.state.logs[0].time,
            result: result,
            items: Math.max(1, Number(root.querySelector('#exItems').value) || 1),
            abnormal: abnormal,
            note: note
          };
          st.inspectionRecords.unshift(record);
          ITO.completePlanTask(plan.id, 'inspection', hours);
          plan.next = U().addCycle(plan.next, plan.cycle);
          ITO.syncPlanTasks();
          ITO.log('提交巡检记录', id + ' ' + plan.name + ' · ' + result, '巡检');

          let taskId = null;
          if (result === '异常') taskId = autoRectifyTask(plan.group, plan.name, note, abnormal);

          close();
          U().toast(taskId ? '巡检已提交，已生成整改任务 ' + taskId : '巡检记录已提交');
          ITO.refresh();
        });
      }
    });
  };

  IP.toggle = function (planId) {
    const st = S();
    const plan = st.inspectionPlans.find(function (p) { return p.id === planId; });
    if (!plan) return;
    plan.status = plan.status === '启用' ? '停用' : '启用';
    plan.statusChangedAt = D.meta.demoNow;
    plan.statusChangedBy = st.user.name;
    plan.updatedAt = D.meta.demoNow;
    plan.updatedBy = st.user.name;
    plan.audit = plan.audit || [];
    plan.audit.push({ time: plan.statusChangedAt, actor: plan.statusChangedBy, action: plan.status === '启用' ? '启用计划' : '停用计划' });
    ITO.log(plan.status === '启用' ? '启用巡检计划' : '停用巡检计划', plan.id + ' ' + plan.name, '巡检');
    ITO.syncPlanTasks();
    U().toast('计划已' + plan.status);
    ITO.refresh();
  };

  const OPS = {};

  OPS.detail = function (spec) {
    const st = S();
    const parts = String(spec || '').split(':');
    const kind = parts[0];
    const id = parts[1];
    let title = '详情';
    let sub = '';
    let rows = [];
    let note = '';
    let records = [];
    let audit = [];

    if (kind === 'inspection-plan') {
      const p = st.inspectionPlans.find(function (x) { return x.id === id; });
      if (!p) return;
      title = p.name;
      sub = p.id + ' · ' + p.group;
      rows = [
        ['专业组', U().esc((ITO.getGroup(p.group) || {}).name || p.group)],
        ['周期', U().esc(p.cycle)],
        ['负责人', U().esc(p.owner)],
        ['执行人', U().esc(p.executor || p.owner)],
        ['标准工时', (p.hours || 0) + ' 小时'],
        ['下次执行', U().esc(p.next)],
        ['状态', U().badge(p.status)],
        ['巡检内容', U().esc(p.content)],
        ['执行标准', U().esc(p.standard)],
        ['创建', U().esc((p.createdAt || '—') + ' · ' + (p.createdBy || '—'))],
        ['最近更新', U().esc((p.updatedAt || '—') + ' · ' + (p.updatedBy || '—'))],
        ['状态变更', U().esc(p.statusChangedAt ? (p.statusChangedAt + ' · ' + (p.statusChangedBy || '—')) : '—')]
      ];
      audit = (p.audit || []).slice().reverse();
      records = st.inspectionRecords.filter(function (r) { return r.plan === p.name; }).slice(0, 5);
    } else if (kind === 'inspection-record') {
      const r = st.inspectionRecords.find(function (x) { return x.id === id; });
      if (!r) return;
      title = r.plan + ' · 巡检记录';
      sub = r.id + ' · ' + r.time;
      rows = [
        ['专业组', U().esc((ITO.getGroup(r.group) || {}).name || r.group)],
        ['执行人', U().esc(r.owner)],
        ['实际工时', (r.hours || 0) + ' 小时'],
        ['执行时间', U().esc(r.time)],
        ['结果', U().badge(r.result)],
        ['检查项', r.items + ' 项'],
        ['异常项', r.abnormal + ' 项'],
        ['说明', U().esc(r.note)]
      ];
      note = r.note;
    } else if (kind === 'maintenance-plan') {
      const p = st.maintenancePlans.find(function (x) { return x.id === id; });
      if (!p) return;
      title = p.name;
      sub = p.id + ' · ' + p.group;
      rows = [
        ['专业组', U().esc((ITO.getGroup(p.group) || {}).name || p.group)],
        ['厂商', U().esc(p.vendor)],
        ['周期', U().esc(p.cycle)],
        ['负责人', U().esc(p.owner)],
        ['执行人', U().esc(p.executor || p.owner)],
        ['标准工时', (p.hours || 0) + ' 小时'],
        ['下次维保', U().esc(p.next)],
        ['状态', U().badge(p.status)],
        ['维保范围', U().esc(p.scope)],
        ['创建', U().esc((p.createdAt || '—') + ' · ' + (p.createdBy || '—'))],
        ['最近更新', U().esc((p.updatedAt || '—') + ' · ' + (p.updatedBy || '—'))],
        ['状态变更', U().esc(p.statusChangedAt ? (p.statusChangedAt + ' · ' + (p.statusChangedBy || '—')) : '—')]
      ];
      audit = (p.audit || []).slice().reverse();
      records = st.maintenanceRecords.filter(function (r) { return r.plan === p.name; }).slice(0, 5);
    } else if (kind === 'maintenance-record') {
      const r = st.maintenanceRecords.find(function (x) { return x.id === id; });
      if (!r) return;
      title = r.plan + ' · 维保记录';
      sub = r.id + ' · ' + r.time;
      rows = [
        ['专业组', U().esc((ITO.getGroup(r.group) || {}).name || r.group)],
        ['厂商', U().esc(r.vendor)],
        ['执行人', U().esc(r.owner)],
        ['实际工时', (r.hours || 0) + ' 小时'],
        ['执行时间', U().esc(r.time)],
        ['结果', U().badge(r.result)],
        ['说明', U().esc(r.note)]
      ];
      note = r.note;
    } else {
      return;
    }

    U().detailModal({
      title: title,
      sub: sub,
      body:
        '<div class="detail-grid">' + rows.map(function (row) {
          return '<div class="detail-field"><label>' + row[0] + '</label><div>' + row[1] + '</div></div>';
        }).join('') + '</div>' +
        (records.length ? '<div class="detail-section"><h4>最近记录</h4><div class="mini-list">' + records.map(function (r) {
          const recKind = kind === 'inspection-plan' ? 'inspection-record' : 'maintenance-record';
          return '<div class="mini-row" data-detail="' + recKind + ':' + r.id + '" style="cursor:pointer"><span class="dot" style="background:' + (r.result === '正常' || r.result === '完成' ? 'var(--green)' : 'var(--red)') + '"></span>' +
            '<div class="txt"><b>' + U().esc(r.time) + '</b><span>' + U().esc(r.owner) + ' · ' + U().esc(r.note) + '</span></div>' +
            U().badge(r.result) + '</div>';
        }).join('') + '</div></div>' : '') +
        (audit.length ? '<div class="detail-section"><h4>操作记录</h4><div class="timeline">' + audit.map(function (a) {
          return '<div class="timeline-item"><b>' + U().esc(a.action) + ' · ' + U().esc(a.actor) + '</b><span>' + U().esc(a.time) + '</span></div>';
        }).join('') + '</div></div>' : ''),
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
      onMount: function (close, root) {
        root.querySelector('[data-close]').addEventListener('click', close);
        U().$$('[data-detail]', root).forEach(function (row) {
          row.addEventListener('click', function () {
            close();
            OPS.detail(row.dataset.detail);
          });
        });
      }
    });
  };

  function bindDetailRows() {
    U().$$('.data-table tbody tr[data-detail]').forEach(function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target.closest('button, a, input, select, .switch')) return;
        OPS.detail(tr.dataset.detail);
      });
    });
  }

  function planRow(p, st) {
    return '<tr data-detail="inspection-plan:' + p.id + '" style="cursor:pointer">' +
      '<td class="mono">' + p.id + '</td>' +
      '<td><div class="cell-task"><b>' + U().esc(p.name) + '</b><small>' + U().esc(p.content) + '</small></div></td>' +
      '<td>' + U().groupPill(p.group) + '</td>' +
      '<td>' + U().esc(p.cycle) + '</td>' +
      '<td style="white-space:nowrap">' + U().esc(p.owner) + '</td>' +
      '<td style="white-space:nowrap">' + U().esc(p.executor || p.owner) + '</td>' +
      '<td class="num">' + (p.hours || 0) + ' h</td>' +
      '<td class="num" style="white-space:nowrap">' + U().shortDate(p.next) + '</td>' +
      '<td><button class="switch' + (p.status === '启用' ? ' on' : '') + '" data-act="toggle" data-plan="' + p.id + '" type="button" aria-label="启用或停用" aria-pressed="' + (p.status === '启用') + '"></button></td>' +
      '<td><div class="row-actions">' +
        '<button class="btn btn-soft btn-sm" data-act="execute" data-plan="' + p.id + '" type="button">执行</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="edit" data-plan="' + p.id + '" type="button">编辑</button>' +
      '</div></td></tr>';
    void st;
  }

  P.inspection = {
    render: function () {
      const st = S();
      st.ui = st.ui || {};
      const tab = st.ui.inspectionTab || 'plans';
      const fRes = st.ui.inspectionResult || '';
      const records = st.inspectionRecords.filter(function (r) { return !fRes || r.result === fRes; });
      const enabled = st.inspectionPlans.filter(function (p) { return p.status === '启用'; }).length;
      const abnormal = st.inspectionRecords.reduce(function (n, r) { return n + (r.abnormal || 0); }, 0);

      const planRows = st.inspectionPlans.map(function (p) { return planRow(p, st); }).join('');
      const recordRows = records.map(function (r) {
        return '<tr data-detail="inspection-record:' + r.id + '" style="cursor:pointer">' +
          '<td class="mono">' + r.id + '</td>' +
          '<td>' + U().esc(r.plan) + '</td>' +
          '<td>' + U().groupPill(r.group) + '</td>' +
          '<td style="white-space:nowrap">' + U().esc(r.owner) + '</td>' +
          '<td class="num">' + (r.hours || 0) + ' h</td>' +
          '<td class="num" style="white-space:nowrap">' + U().shortDate(r.time) + '</td>' +
          '<td>' + U().badge(r.result) + '</td>' +
          '<td class="num">' + r.items + ' 项</td>' +
          '<td class="num' + (r.abnormal ? ' text-red' : '') + '">' + r.abnormal + ' 项</td>' +
          '<td class="muted" style="max-width:240px">' + U().esc(r.note) + '</td>' +
        '</tr>';
      }).join('');

      return U().pageHead({
        title: '巡检管理',
        sub: '计划驱动 · 执行留痕 · 异常自动生成整改任务',
        actions: tabs(tab, [{ id: 'plans', name: '巡检计划' }, { id: 'records', name: '巡检记录' }]) +
          '<button class="btn btn-ghost" id="irExportBtn" type="button">' + U().icon('download') + '导出记录</button>' +
          '<button class="btn btn-primary" id="ipNewBtn" type="button">' + U().icon('plus') + '新建计划</button>'
      }) +
      summary([
        { icon: 'clipboard', value: enabled + ' / ' + st.inspectionPlans.length, label: '启用计划' },
        { icon: 'check', value: st.inspectionRecords.length, label: '累计执行', tone: 'green' },
        { icon: 'alert', value: abnormal, label: '发现异常项', tone: 'red' },
        { icon: 'refresh', value: '100%', label: '异常整改率', tone: 'blue' }
      ]) +

      '<section class="card table-card" data-panel="plans"' + (tab === 'plans' ? '' : ' hidden') + '>' +
        '<div class="table-head"><div><h3>巡检计划</h3><p class="table-note">按周期自动提醒，可在计划中查看检查内容与合格标准</p></div>' +
          '<span class="table-note">' + enabled + ' 个启用</span></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>编号</th><th>计划</th><th>专业组</th><th>周期</th><th>负责人</th><th>执行人</th><th>标准工时</th><th>下次执行</th><th>状态</th><th style="text-align:right">操作</th></tr></thead>' +
        '<tbody>' + planRows + '</tbody></table></div>' +
      '</section>' +

      '<section class="card table-card" data-panel="records"' + (tab === 'records' ? '' : ' hidden') + '>' +
        '<div class="table-head"><div><h3>巡检记录</h3><p class="table-note">记录执行人、检查项与异常项，异常项可追溯至整改任务</p></div>' +
          '<div class="table-head-actions"><select class="select" id="irFilter" style="height:30px"><option value="">全部结果</option>' +
            U().statusOptions(['正常', '异常'], fRes) + '</select></div></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>编号</th><th>计划</th><th>专业组</th><th>执行人</th><th>实际工时</th><th>执行时间</th><th>结果</th><th>检查项</th><th>异常项</th><th>说明</th></tr></thead>' +
        '<tbody>' + (recordRows || '<tr><td colspan="10">' + U().emptyState('暂无巡检记录', '执行一次巡检后记录会出现在这里', 'clipboard') + '</td></tr>') + '</tbody></table></div>' +
      '</section>';
    },

    after: function () {
      const st = S();

      U().$$('[data-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          st.ui = st.ui || {};
          st.ui.inspectionTab = btn.dataset.tab;
          U().$$('[data-tab]').forEach(function (b) { b.classList.toggle('active', b === btn); });
          U().$$('[data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== btn.dataset.tab; });
        });
      });

      U().$$('[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.dataset.act === 'toggle') IP.toggle(btn.dataset.plan);
          if (btn.dataset.act === 'execute') IP.execute(btn.dataset.plan);
          if (btn.dataset.act === 'edit') IP.savePlan(btn.dataset.plan);
        });
      });

      const filter = document.getElementById('irFilter');
      if (filter) filter.addEventListener('change', function () {
        st.ui.inspectionResult = filter.value;
        ITO.refresh();
      });

      const newBtn = document.getElementById('ipNewBtn');
      if (newBtn) newBtn.addEventListener('click', function () { IP.savePlan(null); });

      const exp = document.getElementById('irExportBtn');
      if (exp) exp.addEventListener('click', function () {
        const rows = [['记录编号', '计划', '专业组', '执行人', '实际工时', '执行时间', '结果', '检查项', '异常项', '说明']];
        st.inspectionRecords.forEach(function (r) {
          rows.push([r.id, r.plan, (ITO.getGroup(r.group) || {}).name, r.owner, r.hours || 0, r.time, r.result, r.items, r.abnormal, r.note]);
        });
        U().exportPreview({ title: '巡检记录导出预览', rows: rows, filename: 'ITO巡检记录.csv' });
        ITO.log('预览巡检记录', st.inspectionRecords.length + ' 条', '巡检');
        U().toast('巡检记录预览已打开');
      });

      bindDetailRows();
    }
  };

  /* ── maintenance ─────────────────────────── */
  const MP = {};

  MP.savePlan = function (planId) {
    const st = S();
    const plan = planId ? st.maintenancePlans.find(function (p) { return p.id === planId; }) : null;
    const editing = !!plan;

    U().modal({
      title: editing ? '编辑维保计划' : '新建维保计划',
      sub: editing ? plan.id : '记录维保厂商、周期与作业范围',
      wide: true,
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '计划名称', required: true, full: true, control: '<input id="mpName" type="text" maxlength="30" value="' + U().esc(plan ? plan.name : '') + '" placeholder="例如：机房空调季度维保">' }) +
          U().formRow({ label: '专业组', required: true, control: '<select id="mpGroup"><option value="">请选择专业组</option>' + U().groupOptions(plan ? plan.group : '') + '</select>' }) +
          U().formRow({ label: '负责人', required: true, control: '<select id="mpOwner"><option value="">请选择负责人</option>' + U().leadOptions(plan ? plan.group : '', plan ? plan.owner : '') + '</select>' }) +
          U().formRow({ label: '执行人', required: true, control: '<select id="mpExecutor"><option value="">请选择执行人</option>' + U().staffOptions(plan ? plan.group : '', plan ? plan.executor : '') + '</select>' }) +
          U().formRow({ label: '标准工时', required: true, control: '<input id="mpHours" type="number" min="1" max="999" step="0.5" value="' + (plan ? (plan.hours || '') : '') + '" placeholder="例如：8"><span class="form-hint">每次执行的标准工时，用于任务同步和人员负载</span>' }) +
          U().formRow({ label: '维保周期', required: true, control: '<select id="mpCycle"><option value="">请选择维保周期</option>' + planCycleOptions(plan ? plan.cycle : '') + '</select>' }) +
          U().formRow({ label: '维保厂商', control: '<input id="mpVendor" type="text" value="' + U().esc(plan ? plan.vendor : '') + '" placeholder="厂商或原厂服务">' }) +
          U().formRow({ label: '下次执行', required: true, control: '<input id="mpNext" type="datetime-local" value="' + String(plan ? plan.next : '').replace(' ', 'T') + '">' }) +
          U().formRow({ label: '作业范围', full: true, control: '<textarea id="mpScope" placeholder="描述维保作业范围">' + U().esc(plan ? plan.scope : '') + '</textarea>' }) +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-save type="button">' + (editing ? '保存修改' : '创建计划') + '</button>',
      onMount: function (close, root) {
        root.querySelector('#mpGroup').addEventListener('change', function (e) {
          root.querySelector('#mpOwner').innerHTML = '<option value="">请选择负责人</option>' + U().leadOptions(e.target.value);
          root.querySelector('#mpExecutor').innerHTML = '<option value="">请选择执行人</option>' + U().staffOptions(e.target.value, '');
        });
        root.querySelector('[data-cancel]').addEventListener('click', close);
        U().bindFieldClear(root);
        root.querySelector('[data-save]').addEventListener('click', function () {
          const nameEl = root.querySelector('#mpName');
          const groupEl = root.querySelector('#mpGroup');
          const ownerEl = root.querySelector('#mpOwner');
          const executorEl = root.querySelector('#mpExecutor');
          const hoursEl = root.querySelector('#mpHours');
          const cycleEl = root.querySelector('#mpCycle');
          const nextEl = root.querySelector('#mpNext');
          const valid = U().validateRequired([
            [nameEl, '请输入计划名称'],
            [groupEl, '请选择专业组'],
            [ownerEl, '请选择负责人'],
            [executorEl, '请选择执行人'],
            [hoursEl, '请输入标准工时'],
            [cycleEl, '请选择维保周期'],
            [nextEl, '请选择下次执行时间']
          ]);
          if (!valid) return;
          const hours = Number(hoursEl.value);
          if (!(hours > 0)) { U().showFieldError(hoursEl, '标准工时必须大于 0'); return; }
          const name = nameEl.value.trim();
          const group = groupEl.value;
          const owner = ownerEl.value;
          const executor = executorEl.value;
          const cycle = cycleEl.value;
          const next = nextEl.value;
          const now = D.meta.demoNow;
          const data = {
            name: name,
            group: group,
            owner: owner,
            executor: executor,
            hours: hours,
            cycle: cycle,
            vendor: root.querySelector('#mpVendor').value.trim() || '待指定',
            next: next.replace('T', ' '),
            scope: root.querySelector('#mpScope').value.trim() || '按维保合同执行',
            status: plan ? plan.status : '启用'
          };
          if (editing) {
            Object.assign(plan, data, { updatedAt: now, updatedBy: st.user.name });
            plan.audit = plan.audit || [];
            plan.audit.push({ time: now, actor: st.user.name, action: '编辑计划' });
            ITO.log('编辑维保计划', plan.id + ' ' + plan.name, '维保');
            U().toast('维保计划已更新');
          } else {
            st.mpPlanSeq = (st.mpPlanSeq || 4) + 1;
            const id = 'MP-' + String(st.mpPlanSeq).padStart(3, '0');
            st.maintenancePlans.unshift(Object.assign({
              id: id,
              createdAt: now,
              createdBy: st.user.name,
              updatedAt: now,
              updatedBy: st.user.name,
              statusChangedAt: now,
              statusChangedBy: st.user.name,
              audit: [{ time: now, actor: st.user.name, action: '创建计划' }]
            }, data));
            ITO.log('新建维保计划', id + ' ' + name, '维保');
            U().toast('维保计划已创建');
          }
          close();
          ITO.syncPlanTasks();
          ITO.refresh();
        });
      }
    });
  };

  MP.execute = function (planId) {
    const st = S();
    const plan = st.maintenancePlans.find(function (p) { return p.id === planId; });
    if (!plan) return;

    U().modal({
      title: '登记维保记录',
      sub: plan.name + ' · ' + plan.vendor,
      body:
        '<div class="exec-brief"><div><label>作业范围</label><p>' + U().esc(plan.scope) + '</p></div></div>' +
        '<div class="form-grid" style="margin-top:16px">' +
          U().formRow({ label: '执行人', control: '<select id="mxOwner">' + U().staffOptions(plan.group, plan.executor || plan.owner) + '</select>' }) +
          U().formRow({ label: '实际工时', required: true, control: '<input id="mxHours" type="number" min="0.5" max="999" step="0.5" value="' + (plan.hours || '') + '">' }) +
          U().formRow({ label: '维保结果', control: '<select id="mxResult">' + U().statusOptions(['完成', '异常'], '完成') + '</select>' }) +
          U().formRow({ label: '维保厂商', control: '<input id="mxVendor" type="text" value="' + U().esc(plan.vendor) + '">' }) +
          U().formRow({ label: '作业说明', full: true, control: '<textarea id="mxNote" placeholder="填写更换部件、测试结论与遗留问题"></textarea>' }) +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">提交记录</button>',
      onMount: function (close, root) {
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', function () {
          st.mpRecordSeq = (st.mpRecordSeq || 301) + 1;
          const id = 'MR-' + st.mpRecordSeq;
          const result = root.querySelector('#mxResult').value;
          const hours = Number(root.querySelector('#mxHours').value);
          if (!(hours > 0)) { U().toast('请填写实际工时', 'warn'); return; }
          const note = root.querySelector('#mxNote').value.trim() || (result === '完成' ? '维保作业完成，运行正常' : '维保发现异常，待复检');
          st.maintenanceRecords.unshift({
            id: id, plan: plan.name, group: plan.group, owner: root.querySelector('#mxOwner').value, hours: hours,
            time: st.logs[0].time, result: result, vendor: root.querySelector('#mxVendor').value.trim() || plan.vendor, note: note
          });
          ITO.completePlanTask(plan.id, 'maintenance', hours);
          plan.next = U().addCycle(plan.next, plan.cycle);
          ITO.syncPlanTasks();
          ITO.log('提交维保记录', id + ' ' + plan.name + ' · ' + result, '维保');
          close();
          U().toast(result === '异常' ? '维保记录已提交，请安排复检' : '维保记录已提交');
          ITO.refresh();
        });
      }
    });
  };

  MP.toggle = function (planId) {
    const st = S();
    const plan = st.maintenancePlans.find(function (p) { return p.id === planId; });
    if (!plan) return;
    plan.status = plan.status === '启用' ? '停用' : '启用';
    plan.statusChangedAt = D.meta.demoNow;
    plan.statusChangedBy = st.user.name;
    plan.updatedAt = D.meta.demoNow;
    plan.updatedBy = st.user.name;
    plan.audit = plan.audit || [];
    plan.audit.push({ time: plan.statusChangedAt, actor: plan.statusChangedBy, action: plan.status === '启用' ? '启用计划' : '停用计划' });
    ITO.log(plan.status === '启用' ? '启用维保计划' : '停用维保计划', plan.id + ' ' + plan.name, '维保');
    ITO.syncPlanTasks();
    U().toast('计划已' + plan.status);
    ITO.refresh();
  };

  P.maintenance = {
    render: function () {
      const st = S();
      st.ui = st.ui || {};
      const tab = st.ui.maintenanceTab || 'plans';
      const fRes = st.ui.maintenanceResult || '';
      const records = st.maintenanceRecords.filter(function (r) { return !fRes || r.result === fRes; });
      const enabled = st.maintenancePlans.filter(function (p) { return p.status === '启用'; }).length;
      const vendors = Array.from(new Set(st.maintenancePlans.map(function (p) { return p.vendor; }))).length;
      const nextPlan = st.maintenancePlans.filter(function (p) { return p.status === '启用'; })
        .sort(function (a, b) { return a.next < b.next ? -1 : 1; })[0];

      const planRows = st.maintenancePlans.map(function (p) {
        return '<tr data-detail="maintenance-plan:' + p.id + '" style="cursor:pointer">' +
          '<td class="mono">' + p.id + '</td>' +
          '<td><div class="cell-task"><b>' + U().esc(p.name) + '</b><small>' + U().esc(p.scope) + '</small></div></td>' +
          '<td>' + U().groupPill(p.group) + '</td>' +
          '<td>' + U().esc(p.cycle) + '</td>' +
          '<td>' + U().esc(p.vendor) + '</td>' +
          '<td style="white-space:nowrap">' + U().esc(p.owner) + '</td>' +
          '<td style="white-space:nowrap">' + U().esc(p.executor || p.owner) + '</td>' +
          '<td class="num">' + (p.hours || 0) + ' h</td>' +
          '<td class="num" style="white-space:nowrap">' + U().shortDate(p.next) + '</td>' +
          '<td><button class="switch' + (p.status === '启用' ? ' on' : '') + '" data-act="toggle" data-plan="' + p.id + '" type="button" aria-label="启用或停用" aria-pressed="' + (p.status === '启用') + '"></button></td>' +
          '<td><div class="row-actions">' +
            '<button class="btn btn-soft btn-sm" data-act="execute" data-plan="' + p.id + '" type="button">登记</button>' +
            '<button class="btn btn-ghost btn-sm" data-act="edit" data-plan="' + p.id + '" type="button">编辑</button>' +
          '</div></td></tr>';
      }).join('');

      const recordRows = records.map(function (r) {
        return '<tr data-detail="maintenance-record:' + r.id + '" style="cursor:pointer">' +
          '<td class="mono">' + r.id + '</td>' +
          '<td>' + U().esc(r.plan) + '</td>' +
          '<td>' + U().groupPill(r.group) + '</td>' +
          '<td>' + U().esc(r.vendor) + '</td>' +
          '<td style="white-space:nowrap">' + U().esc(r.owner) + '</td>' +
          '<td class="num">' + (r.hours || 0) + ' h</td>' +
          '<td class="num" style="white-space:nowrap">' + U().shortDate(r.time) + '</td>' +
          '<td>' + U().badge(r.result) + '</td>' +
          '<td class="muted" style="max-width:260px">' + U().esc(r.note) + '</td>' +
        '</tr>';
      }).join('');

      return U().pageHead({
        title: '维保管理',
        sub: '计划维保 · 厂商协同 · 记录可追溯',
        actions: tabs(tab, [{ id: 'plans', name: '维保计划' }, { id: 'records', name: '维保记录' }]) +
          '<button class="btn btn-ghost" id="mrExportBtn" type="button">' + U().icon('download') + '导出记录</button>' +
          '<button class="btn btn-primary" id="mpNewBtn" type="button">' + U().icon('plus') + '新建计划</button>'
      }) +
      summary([
        { icon: 'wrench', value: enabled + ' / ' + st.maintenancePlans.length, label: '启用计划' },
        { icon: 'check', value: st.maintenanceRecords.length, label: '累计维保', tone: 'green' },
        { icon: 'users', value: vendors, label: '协同厂商', tone: 'blue' },
        { icon: 'calendar', value: U().shortDate(nextPlan ? nextPlan.next : ''), label: '最近维保' }
      ]) +

      '<section class="card table-card" data-panel="plans"' + (tab === 'plans' ? '' : ' hidden') + '>' +
        '<div class="table-head"><div><h3>维保计划</h3><p class="table-note">按合同周期管理厂商维保，登记后自动顺延下次执行时间</p></div>' +
          '<span class="table-note">' + enabled + ' 个启用</span></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>编号</th><th>计划</th><th>专业组</th><th>周期</th><th>厂商</th><th>负责人</th><th>执行人</th><th>标准工时</th><th>下次执行</th><th>状态</th><th style="text-align:right">操作</th></tr></thead>' +
        '<tbody>' + planRows + '</tbody></table></div>' +
      '</section>' +

      '<section class="card table-card" data-panel="records"' + (tab === 'records' ? '' : ' hidden') + '>' +
        '<div class="table-head"><div><h3>维保记录</h3><p class="table-note">厂商、执行人与作业结论</p></div>' +
          '<div class="table-head-actions"><select class="select" id="mrFilter" style="height:30px"><option value="">全部结果</option>' +
            U().statusOptions(['完成', '异常'], fRes) + '</select></div></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>编号</th><th>计划</th><th>专业组</th><th>厂商</th><th>执行人</th><th>实际工时</th><th>执行时间</th><th>结果</th><th>说明</th></tr></thead>' +
        '<tbody>' + (recordRows || '<tr><td colspan="9">' + U().emptyState('暂无维保记录', '登记一次维保后记录会出现在这里', 'wrench') + '</td></tr>') + '</tbody></table></div>' +
      '</section>';
    },

    after: function () {
      const st = S();

      U().$$('[data-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          st.ui = st.ui || {};
          st.ui.maintenanceTab = btn.dataset.tab;
          U().$$('[data-tab]').forEach(function (b) { b.classList.toggle('active', b === btn); });
          U().$$('[data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== btn.dataset.tab; });
        });
      });

      U().$$('[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.dataset.act === 'toggle') MP.toggle(btn.dataset.plan);
          if (btn.dataset.act === 'execute') MP.execute(btn.dataset.plan);
          if (btn.dataset.act === 'edit') MP.savePlan(btn.dataset.plan);
        });
      });

      const filter = document.getElementById('mrFilter');
      if (filter) filter.addEventListener('change', function () {
        st.ui.maintenanceResult = filter.value;
        ITO.refresh();
      });

      const newBtn = document.getElementById('mpNewBtn');
      if (newBtn) newBtn.addEventListener('click', function () { MP.savePlan(null); });

      const exp = document.getElementById('mrExportBtn');
      if (exp) exp.addEventListener('click', function () {
        const rows = [['记录编号', '计划', '专业组', '厂商', '执行人', '实际工时', '执行时间', '结果', '说明']];
        st.maintenanceRecords.forEach(function (r) {
          rows.push([r.id, r.plan, (ITO.getGroup(r.group) || {}).name, r.vendor, r.owner, r.hours || 0, r.time, r.result, r.note]);
        });
        U().exportPreview({ title: '维保记录导出预览', rows: rows, filename: 'ITO维保记录.csv' });
        ITO.log('预览维保记录', st.maintenanceRecords.length + ' 条', '维保');
        U().toast('维保记录预览已打开');
      });

      bindDetailRows();
    }
  };

  /* ── overhaul · menu shell only ───────────── */
  P.overhaul = {
    render: function () {
      return U().pageHead({
        title: '大修管理',
        sub: '行动 / 物资 / 人员专项台账 · 模块待接入',
        actions: '<span class="badge" style="height:32px">待接入</span>'
      }) +
      '<section class="card" style="padding:48px 24px">' +
        U().emptyState('大修管理待接入', '行动、物资、人员三类台账将在字段确认后接入', 'wrench') +
      '</section>';
    }
  };
})();
