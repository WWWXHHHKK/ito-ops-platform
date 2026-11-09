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
    const base = ['每日', '每周', '每月', '每季度', '每半年', '每年'];
    const list = [];
    (ITO.dictValues ? ITO.dictValues('inspectionCycle', true) : []).concat(ITO.dictValues ? ITO.dictValues('maintenanceCycle', true) : []).concat(base)
      .forEach(function (v) { if (v && list.indexOf(v) === -1) list.push(v); });
    return U().statusOptions(list, selected);
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
        '</div>' +
        (ITO.customFieldForm ? ITO.customFieldForm('inspectionPlan', plan) : ''),
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
          const cf = ITO.readCustomFields ? ITO.readCustomFields(root, 'inspectionPlan', editing ? plan.extra : null) : { values: {}, errors: [] };
          if (cf.errors.length) { U().toast(cf.errors[0], 'warn'); return; }
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
            status: plan ? plan.status : '启用',
            extra: cf.values
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
        (ITO.customFieldForm ? ITO.customFieldForm('inspectionRecord', null) : '') +
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
          const cf = ITO.readCustomFields ? ITO.readCustomFields(root, 'inspectionRecord', null) : { values: {}, errors: [] };
          if (cf.errors.length) { U().toast(cf.errors[0], 'warn'); return; }
          const record = {
            id: id, plan: plan.name, group: plan.group,
            owner: root.querySelector('#exOwner').value,
            hours: hours,
            time: ITO.state.logs[0].time,
            result: result,
            items: Math.max(1, Number(root.querySelector('#exItems').value) || 1),
            abnormal: abnormal,
            note: note,
            extra: cf.values
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
    let customRecord = null;
    let customModule = '';

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
      customRecord = p; customModule = 'inspectionPlan';
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
      customRecord = r; customModule = 'inspectionRecord';
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
      customRecord = p; customModule = 'maintenancePlan';
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
      customRecord = r; customModule = 'maintenanceRecord';
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
        (customRecord && customModule && ITO.fieldDefsFor && ITO.fieldDefsFor(customModule).length
          ? '<div class="detail-section"><h4>扩展字段</h4><div class="table-wrap"><table class="data-table"><tbody>' + ITO.customFieldRows(customModule, customRecord) + '</tbody></table></div></div>'
          : '') +
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
      (ITO.customFieldCells ? ITO.customFieldCells('inspectionPlan', p) : '') +
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
      const planCustom = st.ui.inspectionPlanCustom || {};
      const recordCustom = st.ui.inspectionRecordCustom || {};
      const plans = st.inspectionPlans.filter(function (p) {
        return !ITO.customFieldMatch || ITO.customFieldMatch('inspectionPlan', p, planCustom);
      });
      const records = st.inspectionRecords.filter(function (r) {
        return (!fRes || r.result === fRes) && (!ITO.customFieldMatch || ITO.customFieldMatch('inspectionRecord', r, recordCustom));
      });
      const planCustomHeaders = ITO.customFieldHeaders ? ITO.customFieldHeaders('inspectionPlan') : [];
      const recordCustomHeaders = ITO.customFieldHeaders ? ITO.customFieldHeaders('inspectionRecord') : [];
      const enabled = st.inspectionPlans.filter(function (p) { return p.status === '启用'; }).length;
      const abnormal = st.inspectionRecords.reduce(function (n, r) { return n + (r.abnormal || 0); }, 0);

      const planRows = plans.map(function (p) { return planRow(p, st); }).join('');
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
          (ITO.customFieldCells ? ITO.customFieldCells('inspectionRecord', r) : '') +
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
          '<div class="table-head-actions">' + (ITO.customFieldFilters ? ITO.customFieldFilters('inspectionPlan').map(function (cf) {
            return customFilterControl(cf, planCustom[cf.key], 'data-ip-plan-cf');
          }).join('') : '') +
          '<button class="btn btn-ghost btn-sm" id="ipPlanExportBtn" type="button">' + U().icon('download') + '导出计划</button></div></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>编号</th><th>计划</th><th>专业组</th><th>周期</th><th>负责人</th><th>执行人</th><th>标准工时</th><th>下次执行</th><th>状态</th>' +
          planCustomHeaders.map(function (h) { return '<th>' + U().esc(h) + '</th>'; }).join('') +
          '<th style="text-align:right">操作</th></tr></thead>' +
        '<tbody>' + (planRows || '<tr><td colspan="' + (10 + planCustomHeaders.length) + '">' + U().emptyState('暂无巡检计划', '新建计划后会出现在这里', 'clipboard') + '</td></tr>') + '</tbody></table></div>' +
      '</section>' +

      '<section class="card table-card" data-panel="records"' + (tab === 'records' ? '' : ' hidden') + '>' +
        '<div class="table-head"><div><h3>巡检记录</h3><p class="table-note">记录执行人、检查项与异常项，异常项可追溯至整改任务</p></div>' +
          '<div class="table-head-actions"><select class="select" id="irFilter" style="height:30px"><option value="">全部结果</option>' +
            U().statusOptions(['正常', '异常'], fRes) + '</select>' +
            (ITO.customFieldFilters ? ITO.customFieldFilters('inspectionRecord').map(function (cf) {
              return customFilterControl(cf, recordCustom[cf.key], 'data-ip-record-cf');
            }).join('') : '') + '</div></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>编号</th><th>计划</th><th>专业组</th><th>执行人</th><th>实际工时</th><th>执行时间</th><th>结果</th><th>检查项</th><th>异常项</th><th>说明</th>' +
          recordCustomHeaders.map(function (h) { return '<th>' + U().esc(h) + '</th>'; }).join('') +
          '</tr></thead>' +
        '<tbody>' + (recordRows || '<tr><td colspan="' + (10 + recordCustomHeaders.length) + '">' + U().emptyState('暂无巡检记录', '执行一次巡检后记录会出现在这里', 'clipboard') + '</td></tr>') + '</tbody></table></div>' +
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
      document.querySelectorAll('[data-ip-plan-cf]').forEach(function (el) {
        el.addEventListener('change', function () {
          st.ui.inspectionPlanCustom = st.ui.inspectionPlanCustom || {};
          st.ui.inspectionPlanCustom[el.dataset.ipPlanCf] = el.value;
          ITO.refresh();
        });
      });
      document.querySelectorAll('[data-ip-record-cf]').forEach(function (el) {
        el.addEventListener('change', function () {
          st.ui.inspectionRecordCustom = st.ui.inspectionRecordCustom || {};
          st.ui.inspectionRecordCustom[el.dataset.ipRecordCf] = el.value;
          ITO.refresh();
        });
      });

      const planExp = document.getElementById('ipPlanExportBtn');
      if (planExp) planExp.addEventListener('click', function () {
        const customHeaders = ITO.customFieldExportHeaders ? ITO.customFieldExportHeaders('inspectionPlan') : [];
        const rows = [['编号', '计划', '专业组', '周期', '负责人', '执行人', '标准工时', '下次执行', '状态', '巡检内容', '执行标准'].concat(customHeaders)];
        st.inspectionPlans.forEach(function (p) {
          rows.push([p.id, p.name, (ITO.getGroup(p.group) || {}).name, p.cycle, p.owner, p.executor || p.owner, p.hours || 0, p.next, p.status, p.content, p.standard].concat(ITO.customFieldExport ? ITO.customFieldExport('inspectionPlan', p) : []));
        });
        U().exportPreview({ title: '巡检计划导出预览', rows: rows, filename: 'ITO巡检计划.csv' });
        ITO.log('预览巡检计划', st.inspectionPlans.length + ' 条', '巡检');
        U().toast('巡检计划预览已打开');
      });

      const newBtn = document.getElementById('ipNewBtn');
      if (newBtn) newBtn.addEventListener('click', function () { IP.savePlan(null); });

      const exp = document.getElementById('irExportBtn');
      if (exp) exp.addEventListener('click', function () {
        const customHeaders = ITO.customFieldExportHeaders ? ITO.customFieldExportHeaders('inspectionRecord') : [];
        const rows = [['记录编号', '计划', '专业组', '执行人', '实际工时', '执行时间', '结果', '检查项', '异常项', '说明'].concat(customHeaders)];
        st.inspectionRecords.forEach(function (r) {
          rows.push([r.id, r.plan, (ITO.getGroup(r.group) || {}).name, r.owner, r.hours || 0, r.time, r.result, r.items, r.abnormal, r.note].concat(ITO.customFieldExport ? ITO.customFieldExport('inspectionRecord', r) : []));
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
    const vendorList = [];
    (ITO.dictValues ? ITO.dictValues('maintenanceVendor', true) : []).concat(st.maintenancePlans.map(function (p) { return p.vendor; })).forEach(function (v) {
      if (v && vendorList.indexOf(v) === -1) vendorList.push(v);
    });

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
          U().formRow({ label: '维保厂商', control: '<input id="mpVendor" type="text" list="mpVendorList" value="' + U().esc(plan ? plan.vendor : '') + '" placeholder="厂商或原厂服务">' }) +
          U().formRow({ label: '下次执行', required: true, control: '<input id="mpNext" type="datetime-local" value="' + String(plan ? plan.next : '').replace(' ', 'T') + '">' }) +
          U().formRow({ label: '作业范围', full: true, control: '<textarea id="mpScope" placeholder="描述维保作业范围">' + U().esc(plan ? plan.scope : '') + '</textarea>' }) +
        '</div>' + (ITO.customFieldForm ? ITO.customFieldForm('maintenancePlan', plan) : '') +
        '<datalist id="mpVendorList">' + vendorList.map(function (v) { return '<option value="' + U().esc(v) + '">'; }).join('') + '</datalist>',
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
          const cf = ITO.readCustomFields ? ITO.readCustomFields(root, 'maintenancePlan', editing ? plan.extra : null) : { values: {}, errors: [] };
          if (cf.errors.length) { U().toast(cf.errors[0], 'warn'); return; }
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
            status: plan ? plan.status : '启用',
            extra: cf.values
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
        '</div>' +
        (ITO.customFieldForm ? ITO.customFieldForm('maintenanceRecord', null) : ''),
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
          const cf = ITO.readCustomFields ? ITO.readCustomFields(root, 'maintenanceRecord', null) : { values: {}, errors: [] };
          if (cf.errors.length) { U().toast(cf.errors[0], 'warn'); return; }
          st.maintenanceRecords.unshift({
            id: id, plan: plan.name, group: plan.group, owner: root.querySelector('#mxOwner').value, hours: hours,
            time: st.logs[0].time, result: result, vendor: root.querySelector('#mxVendor').value.trim() || plan.vendor, note: note,
            extra: cf.values
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
      const planCustom = st.ui.maintenancePlanCustom || {};
      const recordCustom = st.ui.maintenanceRecordCustom || {};
      const plans = st.maintenancePlans.filter(function (p) {
        return !ITO.customFieldMatch || ITO.customFieldMatch('maintenancePlan', p, planCustom);
      });
      const records = st.maintenanceRecords.filter(function (r) {
        return (!fRes || r.result === fRes) && (!ITO.customFieldMatch || ITO.customFieldMatch('maintenanceRecord', r, recordCustom));
      });
      const planCustomHeaders = ITO.customFieldHeaders ? ITO.customFieldHeaders('maintenancePlan') : [];
      const recordCustomHeaders = ITO.customFieldHeaders ? ITO.customFieldHeaders('maintenanceRecord') : [];
      const enabled = st.maintenancePlans.filter(function (p) { return p.status === '启用'; }).length;
      const vendors = Array.from(new Set(st.maintenancePlans.map(function (p) { return p.vendor; }))).length;
      const nextPlan = st.maintenancePlans.filter(function (p) { return p.status === '启用'; })
        .sort(function (a, b) { return a.next < b.next ? -1 : 1; })[0];

      const planRows = plans.map(function (p) {
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
          (ITO.customFieldCells ? ITO.customFieldCells('maintenancePlan', p) : '') +
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
          (ITO.customFieldCells ? ITO.customFieldCells('maintenanceRecord', r) : '') +
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
          '<div class="table-head-actions">' + (ITO.customFieldFilters ? ITO.customFieldFilters('maintenancePlan').map(function (cf) {
            return customFilterControl(cf, planCustom[cf.key], 'data-mp-plan-cf');
          }).join('') : '') +
          '<button class="btn btn-ghost btn-sm" id="mpPlanExportBtn" type="button">' + U().icon('download') + '导出计划</button></div></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>编号</th><th>计划</th><th>专业组</th><th>周期</th><th>厂商</th><th>负责人</th><th>执行人</th><th>标准工时</th><th>下次执行</th><th>状态</th>' +
          planCustomHeaders.map(function (h) { return '<th>' + U().esc(h) + '</th>'; }).join('') +
          '<th style="text-align:right">操作</th></tr></thead>' +
        '<tbody>' + (planRows || '<tr><td colspan="' + (11 + planCustomHeaders.length) + '">' + U().emptyState('暂无维保计划', '新建计划后会出现在这里', 'wrench') + '</td></tr>') + '</tbody></table></div>' +
      '</section>' +

      '<section class="card table-card" data-panel="records"' + (tab === 'records' ? '' : ' hidden') + '>' +
        '<div class="table-head"><div><h3>维保记录</h3><p class="table-note">厂商、执行人与作业结论</p></div>' +
          '<div class="table-head-actions"><select class="select" id="mrFilter" style="height:30px"><option value="">全部结果</option>' +
            U().statusOptions(['完成', '异常'], fRes) + '</select>' +
            (ITO.customFieldFilters ? ITO.customFieldFilters('maintenanceRecord').map(function (cf) {
              return customFilterControl(cf, recordCustom[cf.key], 'data-mp-record-cf');
            }).join('') : '') + '</div></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>编号</th><th>计划</th><th>专业组</th><th>厂商</th><th>执行人</th><th>实际工时</th><th>执行时间</th><th>结果</th><th>说明</th>' +
          recordCustomHeaders.map(function (h) { return '<th>' + U().esc(h) + '</th>'; }).join('') +
          '</tr></thead>' +
        '<tbody>' + (recordRows || '<tr><td colspan="' + (9 + recordCustomHeaders.length) + '">' + U().emptyState('暂无维保记录', '登记一次维保后记录会出现在这里', 'wrench') + '</td></tr>') + '</tbody></table></div>' +
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
      document.querySelectorAll('[data-mp-plan-cf]').forEach(function (el) {
        el.addEventListener('change', function () {
          st.ui.maintenancePlanCustom = st.ui.maintenancePlanCustom || {};
          st.ui.maintenancePlanCustom[el.dataset.mpPlanCf] = el.value;
          ITO.refresh();
        });
      });
      document.querySelectorAll('[data-mp-record-cf]').forEach(function (el) {
        el.addEventListener('change', function () {
          st.ui.maintenanceRecordCustom = st.ui.maintenanceRecordCustom || {};
          st.ui.maintenanceRecordCustom[el.dataset.mpRecordCf] = el.value;
          ITO.refresh();
        });
      });

      const planExp = document.getElementById('mpPlanExportBtn');
      if (planExp) planExp.addEventListener('click', function () {
        const customHeaders = ITO.customFieldExportHeaders ? ITO.customFieldExportHeaders('maintenancePlan') : [];
        const rows = [['编号', '计划', '专业组', '周期', '厂商', '负责人', '执行人', '标准工时', '下次执行', '状态', '作业范围'].concat(customHeaders)];
        st.maintenancePlans.forEach(function (p) {
          rows.push([p.id, p.name, (ITO.getGroup(p.group) || {}).name, p.cycle, p.vendor, p.owner, p.executor || p.owner, p.hours || 0, p.next, p.status, p.scope].concat(ITO.customFieldExport ? ITO.customFieldExport('maintenancePlan', p) : []));
        });
        U().exportPreview({ title: '维保计划导出预览', rows: rows, filename: 'ITO维保计划.csv' });
        ITO.log('预览维保计划', st.maintenancePlans.length + ' 条', '维保');
        U().toast('维保计划预览已打开');
      });

      const newBtn = document.getElementById('mpNewBtn');
      if (newBtn) newBtn.addEventListener('click', function () { MP.savePlan(null); });

      const exp = document.getElementById('mrExportBtn');
      if (exp) exp.addEventListener('click', function () {
        const customHeaders = ITO.customFieldExportHeaders ? ITO.customFieldExportHeaders('maintenanceRecord') : [];
        const rows = [['记录编号', '计划', '专业组', '厂商', '执行人', '实际工时', '执行时间', '结果', '说明'].concat(customHeaders)];
        st.maintenanceRecords.forEach(function (r) {
          rows.push([r.id, r.plan, (ITO.getGroup(r.group) || {}).name, r.vendor, r.owner, r.hours || 0, r.time, r.result, r.note].concat(ITO.customFieldExport ? ITO.customFieldExport('maintenanceRecord', r) : []));
        });
        U().exportPreview({ title: '维保记录导出预览', rows: rows, filename: 'ITO维保记录.csv' });
        ITO.log('预览维保记录', st.maintenanceRecords.length + ' 条', '维保');
        U().toast('维保记录预览已打开');
      });

      bindDetailRows();
    }
  };

  /* ── overhaul · HZ101 大修专项 ───────────── */
  const OVERHAUL_TABS = [
    { key: 'items', name: '行动' },
    { key: 'mats', name: '物资' },
    { key: 'person', name: '人员' }
  ];
  const OVERHAUL_PAGE_SIZE = 10;
  function overhaulData() { return (window.ITO_DATA && window.ITO_DATA.overhaul) || {}; }

  const PERSON_HEADERS = ['基地', '专业组', '技术工人', '辅助工人', '基本安全', '工作负责人', '准备工程师', '辐射防护一级', '辐射防护二级', 'QC授权', '电工证', '授权说明', '备注'];
  const PERSON_GROUP_ALIASES = { '通信组': 'comm', '基础组': 'infra', '基础设施组': 'infra', '应用组': 'app', '在线组': 'online', comm: 'comm', infra: 'infra', app: 'app', online: 'online' };
  const PERSON_AUTH_COLUMNS = {
    5: { label: '工作负责人', types: ['工作负责人授权'] },
    6: { label: '准备工程师', types: ['准备工程师授权'] },
    7: { label: '辐射防护一级', types: ['RP1 授权'] },
    8: { label: '辐射防护二级', types: ['RP2 授权'] },
    9: { label: 'QC授权', types: [] },
    10: { label: '电工证', types: ['低压电工证', '高压电工证'] }
  };

  function overhaulBaseLabel(raw) {
    const value = String(raw || '').trim();
    if (!value) return 'X地区';
    if (value === '惠州' || value === 'A地区') return 'A地区';
    if (value === '防城港' || value === 'B地区') return 'B地区';
    const configured = ITO.dictValues ? ITO.dictValues('overhaulBase', true) : [];
    if (configured.indexOf(value) > -1) return value;
    return 'X地区';
  }

  function maskOverhaulBases(text) {
    return String(text || '').replace(/惠州/g, 'A地区').replace(/防城港/g, 'B地区');
  }

  function overhaulGroupId(raw) {
    const value = String(raw || '').trim();
    return PERSON_GROUP_ALIASES[value] || value || '';
  }

  function overhaulGroupName(id) {
    const group = (S().groups || []).find(function (g) { return g.id === id; });
    return group ? group.name : (id || '—');
  }

  function parseWorkerCount(raw) {
    const text = String(raw == null ? '' : raw);
    const matched = text.match(/(\d+)\s*[（(]\s*(技术工人|辅助工人)\s*[）)]/);
    if (matched) return { count: Number(matched[1]) || 0, type: matched[2] };
    const num = Number(text);
    return { count: isNaN(num) ? 0 : num, type: '' };
  }

  function parseCount(raw) {
    const matched = String(raw == null ? '' : raw).match(/-?\d+(?:\.\d+)?/);
    return matched ? Number(matched[0]) : 0;
  }

  function ensureMaterialProgress(m) {
    if (!m || m.progressLog) return;
    const raw = String(m.progress || '').trim();
    const year = String((S().meta && S().meta.today) || '2026').slice(0, 4);
    const pad = function (n) { return String(n).padStart(2, '0'); };
    const list = [];
    raw.split(/[；;\n]+/).forEach(function (segment) {
      const text = segment.trim();
      if (!text) return;
      const dated = text.match(/^(\d{1,2})[.\-/月](\d{1,2})日?[：:]\s*(.*)$/);
      if (dated) {
        list.push({ at: year + '-' + pad(dated[1]) + '-' + pad(dated[2]) + 'T00:00', text: dated[3].trim() });
      } else {
        list.push({ at: '', text: text });
      }
    });
    m.progressLog = list;
  }

  function materialProgressText(m) {
    ensureMaterialProgress(m);
    return (m.progressLog || []).map(function (item) {
      return (item.at ? item.at.replace('T', ' ') + ' · ' : '') + (item.text || '');
    }).filter(Boolean).join('；');
  }

  function latestMaterialProgress(m) {
    ensureMaterialProgress(m);
    const list = m.progressLog || [];
    if (!list.length) return null;
    return list.slice().sort(function (a, b) {
      return String(a.at || '').localeCompare(String(b.at || ''));
    }).pop();
  }

  ITO.normalizeOverhaulPersonnel = function (o) { return normalizeOverhaulPersonnel(o); };

  function normalizeOverhaulPersonnel(o) {
    if (!o || !o.personnel || !o.personnel.length) return;
    if (o.personnel[0] && !Array.isArray(o.personnel[0])) return;

    const legacy = o.personnel;
    const buckets = {};
    let currentGroup = '';
    let currentBase = '';

    legacy.forEach(function (vals) {
      if (!Array.isArray(vals) || !vals.length) return;
      if (/缺口/.test(String(vals[0] || ''))) {
        o.personnelGap = maskOverhaulBases(vals[0]);
        return;
      }
      if (vals[0]) currentGroup = vals[0];
      if (vals[8]) currentBase = vals[8];
      if (!currentGroup) return;
      const groupId = overhaulGroupId(currentGroup);
      const base = overhaulBaseLabel(vals[8] || currentBase);
      const key = groupId + '|' + base;
      if (!buckets[key]) {
        buckets[key] = {
          base: base,
          group: groupId,
          tech: 0,
          aux: 0,
          basic: 0,
          workLead: 0,
          prep: 0,
          rp1: 0,
          rp2: 0,
          qc: 0,
          electric: 0,
          authNote: '',
          note: ''
        };
      }
      const row = buckets[key];
      const worker = parseWorkerCount(vals[1]);
      if (worker.type === '技术工人') row.tech += worker.count;
      else if (worker.type === '辅助工人') row.aux += worker.count;

      if (!row.__countsSet && (vals[2] !== '' || vals[3] !== '' || vals[4] !== '' || vals[5] !== '' || vals[6] !== '' || vals[7] !== '')) {
        row.workLead = parseCount(vals[2]);
        row.prep = parseCount(vals[3]);
        row.rp1 = parseCount(vals[4]);
        row.rp2 = parseCount(vals[5]);
        row.qc = parseCount(vals[6]);
        row.electric = parseCount(vals[7]);
        const rp2Text = String(vals[5] == null ? '' : vals[5]);
        if (/[^\d.,\s]/.test(rp2Text)) row.authNote = maskOverhaulBases(rp2Text);
        row.__countsSet = true;
      }
      if (vals[9] && !row.note) row.note = maskOverhaulBases(vals[9]);
    });

    o.personnel = Object.keys(buckets).map(function (key) {
      const row = buckets[key];
      row.basic = row.tech + row.aux;
      if (o.demoPersonnelExtras && o.demoPersonnelExtras[key]) {
        row.extra = Object.assign({}, row.extra, o.demoPersonnelExtras[key]);
      }
      delete row.__countsSet;
      return row;
    });
    sortOverhaulPersonnel(o.personnel);
    o.personnelHeader = PERSON_HEADERS.slice();
  }

  function personnelValues(row) {
    return [
      row.base, overhaulGroupName(row.group), row.tech, row.aux, row.basic,
      row.workLead, row.prep, row.rp1, row.rp2, row.qc, row.electric,
      row.authNote || '—', row.note || '—'
    ];
  }

  function sortOverhaulPersonnel(rows) {
    const baseOrder = {};
    (ITO.dictValues ? ITO.dictValues('overhaulBase', true) : ['A地区', 'B地区']).forEach(function (b, i) { baseOrder[b] = i; });
    baseOrder['X地区'] = 99;
    const groupOrder = { app: 0, comm: 1, online: 2, infra: 3 };
    (S().groups || []).forEach(function (g, i) {
      if (groupOrder[g.id] == null) groupOrder[g.id] = i + 10;
    });
    return (rows || []).sort(function (a, b) {
      const ga = groupOrder[a.group] == null ? 99 : groupOrder[a.group];
      const gb = groupOrder[b.group] == null ? 99 : groupOrder[b.group];
      return (baseOrder[a.base] - baseOrder[b.base]) || (ga - gb);
    });
  }
  function overhaulFilters() {
    const st = S();
    st.ui = st.ui || {};
    st.ui.overhaulFilters = st.ui.overhaulFilters || { cat: '', group: '', phase: '', status: '', custom: {} };
    if (!st.ui.overhaulFilters.custom) st.ui.overhaulFilters.custom = {};
    return st.ui.overhaulFilters;
  }
  function overhaulSearch() {
    const st = S();
    st.ui = st.ui || {};
    return (st.ui.overhaulSearch || '').trim().toLowerCase();
  }
  function overhaulItems() {
    const f = overhaulFilters();
    const q = overhaulSearch();
    const list = (overhaulData().items || []).filter(function (it) {
      if (f.cat && it.cat !== f.cat) return false;
      if (f.group && it.group !== f.group) return false;
      if (f.phase && it.phase !== f.phase) return false;
      if (f.status && it.status !== f.status) return false;
      if (ITO.customFieldMatch && !ITO.customFieldMatch('overhaulAction', it, f.custom || {})) return false;
      if (q) {
        const hay = [it.name, it.desc, it.output, it.owner, it.cat, it.phase, it.status, (it.attachments || []).map(function (a) { return a.name; }).join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    return { list: list, f: f, q: q };
  }
  /* 描述拆点：按分号切分后再按「N、/N）」编号前缀拆分 */
  function overhaulPoints(desc) {
    const text = String(desc || '').replace(/\n+/g, '；');
    const out = [];
    text.split(/[；;。]+/).forEach(function (seg) {
      seg.trim().split(/(?=(?:^|\s)[0-9]{1,2}[、）)])/).forEach(function (x) {
        const v = x.trim();
        if (v) out.push(v);
      });
    });
    return out.length ? out : (text.trim() ? [text.trim()] : []);
  }
  function overhaulOptions(key, list) {
    const seen = {};
    const dictMap = { cat: 'overhaulCat', phase: 'overhaulPhase', prio: 'overhaulPrio' };
    if (dictMap[key] && ITO.dictValues) {
      ITO.dictValues(dictMap[key], true).forEach(function (v) { seen[v] = true; });
    }
    list.forEach(function (it) { if (it[key]) seen[it[key]] = true; });
    return Object.keys(seen).sort().map(function (v) {
      return '<option value="' + U().esc(v) + '">' + U().esc(v) + '</option>';
    }).join('');
  }
  function customFilterControl(cf, current, attr) {
    const vals = cf.type === 'switch' ? ['是', '否'] : (cf.source === 'dict'
      ? ITO.dictValues(cf.dictId, true)
      : ((cf.type === 'select' || cf.type === 'multiselect') ? String(cf.options || '').split(/[\n,，、]/).map(function (s) { return s.trim(); }).filter(Boolean) : []));
    if (vals.length && cf.type !== 'multiselect') {
      return '<select class="select" ' + attr + '="' + U().esc(cf.key) + '" aria-label="' + U().esc(cf.label) + '"><option value="">全部' + U().esc(cf.label) + '</option>' +
        vals.map(function (v) { return '<option value="' + U().esc(v) + '"' + (current === v ? ' selected' : '') + '>' + U().esc(v) + '</option>'; }).join('') + '</select>';
    }
    return '<input class="oh-search" type="text" ' + attr + '="' + U().esc(cf.key) + '" value="' + U().esc(current || '') + '" placeholder="' + (cf.type === 'multiselect' ? '多个' + U().esc(cf.label) + '用逗号分隔' : '筛选' + U().esc(cf.label)) + '">';
  }

  function overhaulRounds(it) { return (it.progress || []).filter(Boolean); }
  function overhaulLatest(it) { const ps = overhaulRounds(it); return ps.length ? ps[ps.length - 1] : '—'; }
  function prioHtml(p) {
    const cls = p === '高' ? 'prio-high' : p === '中' ? 'prio-mid' : 'prio-low';
    return '<span class="' + cls + '">' + U().esc(p || '—') + '</span>';
  }
  function overhaulRowClass(it) {
    if (it.risk === '风险') return ' row-risk';
    if (it.status === '已完成') return ' row-done';
    return '';
  }
  function overhaulOutputLabel(it) {
    const files = it.attachments || [];
    if (files.length) return files.length + ' 个附件 · ' + files[0].name;
    return it.output || '—';
  }

  function downloadOverhaulAttachment(att) {
    if (!att || !att.file) {
      if (typeof U === 'function') U().toast('该附件来自历史数据，暂无可下载文件');
      return;
    }
    const url = URL.createObjectURL(att.file);
    const link = document.createElement('a');
    link.href = url;
    link.download = att.name || 'attachment';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function overhaulRows(list) {
    return list.map(function (it) {
      const tone = it.status === '已完成' ? ' good' : '';
      return '<tr data-oh-seq="' + it.seq + '" class="oh-row' + overhaulRowClass(it) + '">' +
        '<td><div class="cell-task"><b>' + U().esc(it.name) + '</b></div></td>' +
        '<td>' + U().esc(it.cat) + '</td>' +
        '<td>' + U().groupPill(it.group) + '</td>' +
        '<td style="white-space:nowrap">' + U().esc(it.phase) + '</td>' +
        '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + U().esc(overhaulOutputLabel(it)) + '">' + U().esc(overhaulOutputLabel(it)) + '</td>' +
        '<td style="text-align:center">' + prioHtml(it.prio) + '</td>' +
        '<td style="white-space:nowrap">' + U().esc(it.owner) + '</td>' +
        '<td class="num" style="white-space:nowrap">' + U().shortDate(it.start) + '</td>' +
        '<td class="num" style="white-space:nowrap">' + U().shortDate(it.due) + '</td>' +
        '<td class="num">' + U().esc(it.days || '—') + '</td>' +
        '<td><span class="stat-chip' + tone + '">' + U().esc(it.status) + '</span></td>' +
        (ITO.customFieldCells ? ITO.customFieldCells('overhaulAction', it) : '') +
      '</tr>';
    }).join('');
  }

  function matsFilteredOf(st) {
    st.ui = st.ui || {};
    const q = (st.ui.overhaulMatsSearch || '').trim().toLowerCase();
    const rf = st.ui.matsReqFilter || '';
    const mats = (window.ITO_DATA && window.ITO_DATA.overhaul ? window.ITO_DATA.overhaul.materials : []);
    return mats.filter(function (m) {
      if (rf && String(m.req || '').indexOf(rf) < 0) return false;
      if (ITO.customFieldMatch && !ITO.customFieldMatch('overhaulMaterial', m, st.ui.matsCustomFilters || {})) return false;
      if (!q) return true;
      return [m.name, m.spec, m.use, m.req, materialProgressText(m), m.plan].map(function (v) { return v || ''; }).join(' ').toLowerCase().indexOf(q) > -1;
    });
  }

  function personFilteredOf(st) {
    st.ui = st.ui || {};
    const q = (st.ui.overhaulPersonSearch || '').trim().toLowerCase();
    const gf = st.ui.personGroupFilter || '';
    const bf = st.ui.personBaseFilter || '';
    const all = (overhaulData().personnel || []);
    return all.filter(function (row) {
      if (gf && row.group !== gf) return false;
      if (bf && row.base !== bf) return false;
      if (ITO.customFieldMatch && !ITO.customFieldMatch('overhaulPerson', row, st.ui.personCustomFilters || {})) return false;
      if (!q) return true;
      return [row.base, overhaulGroupName(row.group), row.tech, row.aux, row.basic, row.workLead, row.prep, row.rp1, row.rp2, row.qc, row.electric, row.authNote, row.note]
        .join(' ').toLowerCase().indexOf(q) > -1;
    });
  }

  function overhaulMatRow(m) {
    const latest = latestMaterialProgress(m);
    const progressLabel = latest ? (latest.at ? latest.at.replace('T', ' ') + ' · ' : '') + latest.text : '—';
    return '<tr data-oh-mat="' + m.__idx + '">' +
      '<td><div class="cell-task"><b>' + U().esc(m.name) + '</b><small>' + U().esc(m.spec) + '</small></div></td>' +
      '<td class="num">' + U().esc(m.qty) + '</td>' +
      '<td class="num">' + (m.total ? m.total.toLocaleString() : '—') + '</td>' +
      '<td>' + U().esc(m.req) + '</td>' +
      '<td style="font-size:11px;color:var(--muted);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + U().esc(materialProgressText(m)) + '">' + U().esc(progressLabel) + '</td>' +
      '<td style="font-size:11px;color:var(--muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + U().esc(m.plan) + '">' + U().esc(m.plan || '—') + '</td>' +
      (ITO.customFieldCells ? ITO.customFieldCells('overhaulMaterial', m) : '') +
    '</tr>';
  }
  function overhaulPersonRow(row, idx) {
    const values = personnelValues(row);
    return '<tr data-oh-person="' + idx + '" class="oh-person-row">' +
      values.map(function (value, i) {
        if (i === 1) return '<td>' + U().groupPill(row.group) + '</td>';
        if (i >= 5 && i <= 10) {
          const n = Number(value) || 0;
          return '<td class="num"><button type="button" class="auth-count-btn' + (n ? '' : ' is-zero') + '" data-oh-auth-col="' + i + '" title="查看系统授权持有人">' + U().esc(value) + '</button></td>';
        }
        if (i >= 2 && i <= 10) return '<td class="num">' + U().esc(value) + '</td>';
        const text = String(value == null ? '' : value);
        return '<td title="' + U().esc(text) + '"><span class="oh-person-note">' + U().esc(text) + '</span></td>';
      }).join('') +
      (ITO.customFieldCells ? ITO.customFieldCells('overhaulPerson', row) : '') +
    '</tr>';
  }

  P.overhaul = {
    render: function () {
      const o = overhaulData();
      normalizeOverhaulPersonnel(o);
      sortOverhaulPersonnel(o.personnel);
      (o.materials || []).forEach(ensureMaterialProgress);
      const isEmployee = S().role === 'employee';
      const items = o.items || [];
      const mats = o.materials || [];
      const done = items.filter(function (i) { return i.status === '已完成'; }).length;
      const doing = items.filter(function (i) { return i.status === '进行中'; }).length;
      const riskN = items.filter(function (i) { return i.risk === '风险'; }).length;
      const budget = (o.materials || []).reduce(function (n, m2) { return n + (Number(m2.total) || 0); }, 0);
      const tab = (S().ui && S().ui.overhaulTab) || 'items';

      const overview =
        '<div class="kpi-grid">' +
          '<article class="card kpi-card"><div class="kpi-label">' + U().icon('clipboard') + '<span>行动项总数</span></div><div class="kpi-value">' + items.length + '<span class="unit"> 项</span></div><div class="kpi-meta"><span>进行中 ' + doing + ' · 已完成 ' + done + '</span></div></article>' +
          '<article class="card kpi-card" data-tone="green"><div class="kpi-label">' + U().icon('check') + '<span>已完成</span></div><div class="kpi-value">' + done + '<span class="unit"> 项</span></div><div class="kpi-meta"><span>完成率 ' + (items.length ? Math.round(done / items.length * 100) : 0) + '%</span></div></article>' +
          '<article class="card kpi-card" data-tone="blue"><div class="kpi-label">' + U().icon('award') + '<span>物资预算</span></div><div class="kpi-value">' + (budget / 10000).toFixed(1) + '<span class="unit"> 万</span></div><div class="kpi-meta"><span>物资 ' + mats.length + ' 项 · 到货跟踪中</span></div></article>' +
          '<article class="card kpi-card" data-tone="red"><div class="kpi-label">' + U().icon('alert') + '<span>风险项</span></div><div class="kpi-value">' + riskN + '<span class="unit"> 项</span></div><div class="kpi-meta"><span>人员缺口：准备工程师 / QC / RP2</span></div></article>' +
        '</div>';

      const tabHead = '<div class="tabs overhaul-tabs">' + OVERHAUL_TABS.map(function (t) {
        return '<button type="button" class="tab' + (t.key === tab ? ' active' : '') + '" data-otab="' + t.key + '">' + t.name + '</button>';
      }).join('') + '</div>';

      const f = overhaulFilters();
      const q = overhaulSearch();
      const groupOpts = '<option value="">全部专业组</option>' + (S().groups || []).map(function (g) {
        return '<option value="' + g.id + '"' + (f.group === g.id ? ' selected' : '') + '>' + g.name + '</option>';
      }).join('');
      const itemsHead =
        '<div class="table-head oh-head"><div class="report-head-left">' +
          '<h3>大修行动项任务清单</h3>' +
          '<input class="oh-search" id="ohSearch" type="text" placeholder="搜索任务名 / 描述 / 负责人…" value="' + U().esc(q) + '">' +
          '<select class="select" id="ohCat" aria-label="分类"><option value="">全部分类</option>' + overhaulOptions('cat', items) + '</select>' +
          '<select class="select" id="ohGroup" aria-label="专业组">' + groupOpts + '</select>' +
          '<select class="select" id="ohPhase" aria-label="阶段"><option value="">全部阶段</option>' + overhaulOptions('phase', items) + '</select>' +
          '<select class="select" id="ohStatus" aria-label="状态"><option value="">全部状态</option>' + overhaulOptions('status', items) + '</select>' +
          (ITO.customFieldFilters ? ITO.customFieldFilters('overhaulAction').map(function (cf) {
            return customFilterControl(cf, (f.custom || {})[cf.key], 'data-oh-cf-filter');
          }).join('') : '') +
        '</div>' +
        '<div class="toolbar-right">' + (isEmployee ? '' :
          '<button class="btn btn-primary btn-sm" id="ohAddItemBtn" type="button">' + U().icon('plus') + '添加行动项</button>' +
          '<button class="btn btn-ghost btn-sm" id="ohExportBtn" type="button">' + U().icon('download') + '导出行动项</button>') + '</div></div>';
      const filtered = overhaulItems();
      const pages = Math.max(1, Math.ceil(filtered.list.length / OVERHAUL_PAGE_SIZE));
      const pageNum = Math.min(Math.max(1, ITO.pagerState['oh-items'] || 1), pages);
      ITO.pagerState['oh-items'] = pageNum;
      const itemsPanel =
        '<section class="card table-card" id="ohItemsCard">' +
          itemsHead +
          '<div class="table-wrap"><table class="data-table oh-items-table"><thead><tr><th style="min-width:200px">任务名</th><th>分类</th><th>专业组</th><th>阶段</th><th>成果物附件</th><th style="text-align:center">优先级</th><th>负责人</th><th>开始</th><th>截止</th><th style="text-align:center">天数</th><th>状态</th>' + (ITO.customFieldHeaders ? ITO.customFieldHeaders('overhaulAction').map(function (h) { return '<th>' + U().esc(h) + '</th>'; }).join('') : '') + '</tr></thead>' +
            '<tbody id="ohTbody">' + (overhaulRows(filtered.list.slice((pageNum - 1) * OVERHAUL_PAGE_SIZE, pageNum * OVERHAUL_PAGE_SIZE)) || '<tr><td colspan="' + (11 + (ITO.customFieldHeaders ? ITO.customFieldHeaders('overhaulAction').length : 0)) + '">' + U().emptyState('没有匹配的行动项', '调整筛选或搜索条件', 'clipboard') + '</td></tr>') + '</tbody></table></div>' +
          (filtered.list.length ? '<div id="ohPager">' + ITO.pager('oh-items', filtered.list.length, pageNum, OVERHAUL_PAGE_SIZE) + '</div>' : '') +
        '</section>';

      const stR = S();
      stR.ui = stR.ui || {};
      const matsQ = (stR.ui.overhaulMatsSearch || '').trim().toLowerCase();
      const matsFiltered = matsFilteredOf(stR);
      matsFiltered.forEach(function (m) { m.__idx = mats.indexOf(m); });
      const matsRows = matsFiltered.map(overhaulMatRow).join('');
      const reqOptions = '<option value="">全部需求人</option>' + (function () {
        const seen = {};
        (mats || []).forEach(function (m2) {
          String(m2.req || '').split('、').forEach(function (p2) { if (p2.trim()) seen[p2.trim()] = true; });
        });
        return Object.keys(seen).sort().map(function (r2) {
          return '<option value="' + U().esc(r2) + '"' + (stR.ui.matsReqFilter === r2 ? ' selected' : '') + '>' + U().esc(r2) + '</option>';
        }).join('');
      })();
      const matsPanel =
        '<section class="card table-card" id="ohMatsCard">' +
          '<div class="table-head oh-head"><div class="report-head-left"><h3>大修物资专项跟踪</h3>' +
            '<input class="oh-search" id="ohMatsSearch" type="text" placeholder="搜索物资 / 规格 / 需求人…" value="' + U().esc(matsQ) + '">' +
            '<select class="select" id="ohMatReqFilter" aria-label="需求人">' + reqOptions + '</select>' +
            (ITO.customFieldFilters ? ITO.customFieldFilters('overhaulMaterial').map(function (cf) {
              return customFilterControl(cf, (stR.ui.matsCustomFilters || {})[cf.key], 'data-oh-mat-cf-filter');
            }).join('') : '') + '</div>' +
            '<div class="toolbar-right">' + (isEmployee ? '' :
            '<button class="btn btn-primary btn-sm" id="ohMatsAddBtn" type="button">' + U().icon('plus') + '添加物资</button>' +
            '<button class="btn btn-ghost btn-sm" id="ohMatsExportBtn" type="button">' + U().icon('download') + '导出物资</button>') + '</div></div>' +
          '<div class="table-wrap"><table class="data-table"><thead><tr><th style="min-width:240px">物资</th><th>数量</th><th>总价（元）</th><th>需求人</th><th>最新采购进度</th><th>采购计划</th>' + (ITO.customFieldHeaders ? ITO.customFieldHeaders('overhaulMaterial').map(function (h) { return '<th>' + U().esc(h) + '</th>'; }).join('') : '') + '</tr></thead>' +
            '<tbody id="ohMatsTbody">' + (matsRows || '<tr><td colspan="' + (6 + (ITO.customFieldHeaders ? ITO.customFieldHeaders('overhaulMaterial').length : 0)) + '">' + U().emptyState('没有匹配的物资', '调整搜索条件', 'award') + '</td></tr>') + '</tbody></table></div>' +
        '</section>';

      const person = o.personnel || [];
      const personHead = PERSON_HEADERS.concat(ITO.customFieldHeaders ? ITO.customFieldHeaders('overhaulPerson') : []);
      const personFiltered = personFilteredOf(S());
      const personRows = personFiltered.map(function (row) {
        return overhaulPersonRow(row, person.indexOf(row));
      }).join('');
      const personBase = S().ui.personBaseFilter || '';
      const personQuery = (S().ui.overhaulPersonSearch || '').trim().toLowerCase();
      const gapText = o.personnelGap || '';
      const gapVisible = gapText &&
        (!S().ui.personGroupFilter || S().ui.personGroupFilter === 'comm') &&
        (!personBase || personBase === 'B地区') &&
        (!personQuery || gapText.toLowerCase().indexOf(personQuery) > -1);
      const gapRow = gapVisible ? '<tr data-oh-person="-1"><td colspan="' + (13 + (ITO.customFieldHeaders ? ITO.customFieldHeaders('overhaulPerson').length : 0)) + '" class="oh-gap-row">' + U().esc(gapText) + '</td></tr>' : '';
      const personPanel =
        '<section class="card table-card" id="ohPersonCard">' +
          '<div class="table-head oh-head"><div class="report-head-left"><h3>大修人员专项矩阵</h3>' +
            '<input class="oh-search" id="ohPersonSearch" type="text" placeholder="搜索专业组 / 基地 / 备注…" value="' + U().esc((S().ui.overhaulPersonSearch || '')) + '">' +
            '<select class="select" id="ohPersonBaseFilter" aria-label="基地"><option value="">全部基地</option>' +
              (function () {
                const list = ITO.dictValues ? ITO.dictValues('overhaulBase', true) : ['A地区', 'B地区'];
                if ((o.personnel || []).some(function (r) { return r.base === 'X地区'; }) && list.indexOf('X地区') === -1) list.push('X地区');
                return list;
              })().map(function (b2) {
                return '<option value="' + U().esc(b2) + '"' + (personBase === b2 ? ' selected' : '') + '>' + U().esc(b2) + '</option>';
              }).join('') +
            '</select>' +
            '<select class="select" id="ohPersonGroupFilter" aria-label="专业组"><option value="">全部专业组</option>' +
              (S().groups || []).map(function (g2) {
                return '<option value="' + U().esc(g2.id) + '"' + (S().ui.personGroupFilter === g2.id ? ' selected' : '') + '>' + U().esc(g2.name) + '</option>';
              }).join('') +
            '</select>' +
            (ITO.customFieldFilters ? ITO.customFieldFilters('overhaulPerson').map(function (cf) {
              return customFilterControl(cf, (S().ui.personCustomFilters || {})[cf.key], 'data-oh-person-cf-filter');
            }).join('') : '') + '</div>' +
            '<div class="toolbar-right">' + (isEmployee ? '' :
            '<button class="btn btn-primary btn-sm" id="ohPersonAddBtn" type="button">' + U().icon('plus') + '添加组行</button>' +
            '<button class="btn btn-ghost btn-sm" id="ohPersonExportBtn" type="button">' + U().icon('download') + '导出人员矩阵</button>') + '</div></div>' +
          '<div class="table-wrap"><table class="data-table oh-person-table"><thead><tr>' + personHead.map(function (h) { return '<th>' + U().esc(h || '—') + '</th>'; }).join('') + '</tr></thead>' +
            '<tbody id="ohPersonTbody">' + ((personRows + gapRow) || '<tr><td colspan="' + (13 + (ITO.customFieldHeaders ? ITO.customFieldHeaders('overhaulPerson').length : 0)) + '">' + U().emptyState('没有匹配的人员记录', '调整搜索条件', 'users') + '</td></tr>') + '</tbody></table></div>' +
        '</section>';

      const panels = { items: itemsPanel, mats: matsPanel, person: personPanel };

      const phaseStats = {};
      items.forEach(function (it) { if (it.phase) phaseStats[it.phase] = (phaseStats[it.phase] || 0) + 1; });
      const phaseNote = '阶段分布 · ' + Object.keys(phaseStats).map(function (k) { return k + ' ' + phaseStats[k]; }).join(' · ');
      const chartCard =
        '<section class="card chart-card">' +
          '<div class="chart-head"><div><h3 class="chart-title">行动项分析</h3><p class="chart-sub">' + phaseNote + '</p></div>' +
            '<span class="head-tag">HZ101</span></div>' +
          '<div class="oh-charts"><div id="ohChartStatus"></div><div id="ohChartGroup"></div></div>' +
        '</section>';

      return U().pageHead({
        title: '大修管理',
        sub: (o.project || '大修专项行动') + ' · 行动项 ' + items.length + ' 项 · 物资 ' + mats.length + ' 项 / ' + (budget / 10000).toFixed(1) + ' 万 · 人员 4 组',
        actions: ''
      }) +
      overview +
      chartCard +
      tabHead +
      OVERHAUL_TABS.map(function (t) {
        return '<div data-oh-panel="' + t.key + '"' + (t.key === tab ? '' : ' hidden') + '>' + panels[t.key] + '</div>';
      }).join('');
    },

    after: function () {
      const st = S();
      const o = overhaulData();
      const isEmployee = st.role === 'employee';
      normalizeOverhaulPersonnel(o);
      const groupName = {};
      (S().groups || []).forEach(function (g) { groupName[g.id] = g.name; });
      function round2(n) { return Math.round(n * 100) / 100; }


      function uniqueOptions(extra, values) {
        const out = (extra || []).slice();
        (values || []).forEach(function (v) {
          if (v && out.indexOf(v) === -1) out.push(v);
        });
        return out;
      }

      function optionHtml(values, selected, placeholder) {
        return '<option value="">' + U().esc(placeholder || '请选择') + '</option>' +
          values.map(function (v) {
            return '<option value="' + U().esc(v) + '"' + (v === selected ? ' selected' : '') + '>' + U().esc(v) + '</option>';
          }).join('');
      }

      function formSection(title, note, body, cols) {
        const grid = cols === 2 ? 'form-grid' : (cols === 4 ? 'form-grid cols-4' : 'form-grid cols-3');
        return '<div class="oh-form-section">' +
          '<div class="subtask-head"><div><h4>' + U().esc(title) + '</h4>' +
            (note ? '<span>' + U().esc(note) + '</span>' : '') +
          '</div></div>' +
          '<div class="' + grid + '">' + body + '</div>' +
        '</div>';
      }

      function calcDays(start, due) {
        if (!start || !due) return '';
        const a = new Date(start + 'T00:00:00');
        const b = new Date(due + 'T00:00:00');
        if (isNaN(a.getTime()) || isNaN(b.getTime())) return '';
        return String(Math.max(0, Math.round((b - a) / 86400000)));
      }

      function initMultiPicker(root, pickerId, hiddenId, groupFn) {
        const picker = root.querySelector(pickerId);
        const hidden = root.querySelector(hiddenId);
        if (!picker || !hidden) return;
        const trigger = picker.querySelector('.multi-trigger');
        const pop = picker.querySelector('.multi-pop');
        const search = picker.querySelector('.multi-search');
        const list = picker.querySelector('.multi-list');
        let selected = String(hidden.value || '').split(/[、,，]/).map(function (s) { return s.trim(); }).filter(Boolean);

        function staffOfGroup() {
          const groupId = groupFn();
          return (S().staff || []).filter(function (p2) { return !groupId || p2.group === groupId; });
        }
        function paintTrigger() {
          if (!selected.length) {
            trigger.innerHTML = '<span class="multi-placeholder">请选择负责人</span>';
          } else {
            trigger.innerHTML = selected.map(function (name) {
              return '<span class="multi-chip"><span>' + U().esc(name) + '</span>' +
                '<button type="button" data-multi-remove="' + U().esc(name) + '" aria-label="移除 ' + U().esc(name) + '">×</button></span>';
            }).join('');
          }
          hidden.value = selected.join('、');
        }
        function paintList() {
          const q = (search.value || '').trim().toLowerCase();
          const listData = staffOfGroup().filter(function (p2) {
            return !q || (p2.name + ' ' + (p2.title || '') + ' ' + (p2.uid || '')).toLowerCase().indexOf(q) > -1;
          });
          if (!listData.length) {
            list.innerHTML = '<div class="multi-empty">没有匹配人员</div>';
            return;
          }
          list.innerHTML = listData.map(function (p2) {
            const group = (S().groups || []).find(function (g2) { return g2.id === p2.group; });
            return '<label><input type="checkbox" value="' + U().esc(p2.name) + '"' + (selected.indexOf(p2.name) > -1 ? ' checked' : '') + '>' +
              '<span>' + U().esc(p2.name) + '</span><small>' + U().esc(group ? group.name : '') + ' · ' + U().esc(p2.title || '') + '</small></label>';
          }).join('');
        }
        trigger.addEventListener('click', function (e) {
          if (e.target.closest('[data-multi-remove]')) {
            e.stopPropagation();
            const name = e.target.closest('[data-multi-remove]').dataset.multiRemove;
            selected = selected.filter(function (x) { return x !== name; });
            paintTrigger();
            paintList();
            return;
          }
          pop.hidden = !pop.hidden;
          trigger.classList.toggle('is-open', !pop.hidden);
          if (!pop.hidden) {
            paintList();
            search.focus();
          }
        });
        search.addEventListener('input', paintList);
        list.addEventListener('change', function (e) {
          const cb = e.target.closest('input[type="checkbox"]');
          if (!cb) return;
          if (cb.checked) {
            if (selected.indexOf(cb.value) === -1) selected.push(cb.value);
          } else {
            selected = selected.filter(function (x) { return x !== cb.value; });
          }
          paintTrigger();
        });
        document.addEventListener('click', function (e) {
          if (!picker.isConnected || picker.contains(e.target)) return;
          pop.hidden = true;
          trigger.classList.remove('is-open');
        });
        picker.__syncGroup = function () {
          const groupId = groupFn();
          if (groupId) {
            const valid = {};
            staffOfGroup().forEach(function (p2) { valid[p2.name] = true; });
            selected = selected.filter(function (name) { return valid[name]; });
          }
          paintTrigger();
          paintList();
        };
        paintTrigger();
        paintList();
      }


      function bindTabs() {
        U().$$('[data-otab]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (st.ui.overhaulTab === btn.dataset.otab) return;
            st.ui.overhaulTab = btn.dataset.otab;
            U().$$('[data-otab]').forEach(function (b2) { b2.classList.toggle('active', b2 === btn); });
            U().$$('[data-oh-panel]').forEach(function (panel) { panel.hidden = panel.dataset.ohPanel !== st.ui.overhaulTab; });
          });
        });
      }

      function renderItemsPage() {
        const filtered = overhaulItems();
        const pages = Math.max(1, Math.ceil(filtered.list.length / OVERHAUL_PAGE_SIZE));
        const pageNum = Math.min(Math.max(1, ITO.pagerState['oh-items'] || 1), pages);
        ITO.pagerState['oh-items'] = pageNum;
        const tbody = document.getElementById('ohTbody');
        if (tbody) tbody.innerHTML = overhaulRows(filtered.list.slice((pageNum - 1) * OVERHAUL_PAGE_SIZE, pageNum * OVERHAUL_PAGE_SIZE)) || '<tr><td colspan="' + (11 + (ITO.customFieldHeaders ? ITO.customFieldHeaders('overhaulAction').length : 0)) + '">' + U().emptyState('没有匹配的行动项', '调整筛选或搜索条件', 'clipboard') + '</td></tr>';
        const box = document.getElementById('ohPager');
        if (box) box.innerHTML = filtered.list.length ? ITO.pager('oh-items', filtered.list.length, pageNum, OVERHAUL_PAGE_SIZE) : '';
      }

      function bindHeadControls() {
        const search = document.getElementById('ohSearch');
        if (search) search.addEventListener('input', function () {
          st.ui.overhaulSearch = search.value;
          ITO.pagerState['oh-items'] = 1;
          renderItemsPage();
        });
        [['ohCat', 'cat'], ['ohGroup', 'group'], ['ohPhase', 'phase'], ['ohStatus', 'status']].forEach(function (pair) {
          const el = document.getElementById(pair[0]);
          if (el) el.addEventListener('change', function () {
            st.ui.overhaulFilters = st.ui.overhaulFilters || { cat: '', group: '', phase: '', status: '' };
            st.ui.overhaulFilters[pair[1]] = el.value;
            ITO.pagerState['oh-items'] = 1;
            renderItemsPage();
          });
        });
        document.querySelectorAll('[data-oh-cf-filter]').forEach(function (el) {
          ['input', 'change'].forEach(function (ev) {
            el.addEventListener(ev, function () {
              const f = overhaulFilters();
              f.custom = f.custom || {};
              f.custom[el.dataset.ohCfFilter] = el.value;
              ITO.pagerState['oh-items'] = 1;
              renderItemsPage();
            });
          });
        });
      }

      /* ── 行动项详情 + 编辑层（参照值班管理查看/编辑双弹窗） ── */
      function itemDetailBody(it) {
        const pts = overhaulPoints(it.desc);
        return '<div class="detail-section"><h4>任务信息</h4><div class="table-wrap"><table class="data-table"><tbody>' +
            '<tr><td>任务名</td><td>' + U().esc(it.name) + '</td></tr>' +
            '<tr><td>分类</td><td>' + U().esc(it.cat) + '</td></tr>' +
            '<tr><td>专业组</td><td>' + U().groupPill(it.group) + '</td></tr>' +
            '<tr><td>阶段</td><td>' + U().esc(it.phase) + '</td></tr>' +
            '<tr><td>优先级</td><td>' + prioHtml(it.prio) + '</td></tr>' +
            '<tr><td>负责人</td><td>' + U().esc(it.owner) + '</td></tr>' +
            '<tr><td>周期</td><td>' + U().esc(it.start + ' ~ ' + it.due + (it.days ? '（' + it.days + ' 天）' : '')) + '</td></tr>' +
            '<tr><td>状态</td><td>' + U().esc(it.status) + '</td></tr>' +
            '<tr><td>成果物附件</td><td>' + (it.output ? '<div class="form-hint">历史说明：' + U().esc(it.output) + '</div>' : '') +
              ((it.attachments || []).length ? '<div class="oh-attach-list">' + it.attachments.map(function (a, i) {
                return '<button type="button" class="oh-attach-chip" data-oh-file="' + i + '"><span>' + U().esc(a.name) + '</span>' +
                  (a.size ? '<small>' + (a.size >= 1024 * 1024 ? (a.size / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(a.size / 1024)) + ' KB') + '</small>' : '') +
                  '</button>';
              }).join('') + '</div>' : (it.output ? '' : '—')) + '</td></tr>' +
            (it.risk === '风险' ? '<tr><td>风险</td><td><span class="text-red">风险项（Excel 红底标注）</span></td></tr>' : '') +
            (ITO.customFieldRows ? ITO.customFieldRows('overhaulAction', it) : '') +
          '</tbody></table></div></div>' +
          '<div class="detail-section"><h4>任务描述（' + pts.length + ' 点）</h4>' +
            (pts.length ? '<div class="table-wrap"><table class="data-table"><tbody>' + pts.map(function (p, i) {
              return '<tr><td class="num" style="width:56px;text-align:center">' + (i + 1) + '</td><td>' + U().esc(p) + '</td></tr>';
            }).join('') + '</tbody></table></div>' : '<p class="muted" style="font-size:12px">—</p>') +
          '</div>' +
          (function () {
            const rounds = overhaulRounds(it);
            const n = rounds.length;
            return '<div class="detail-section"><h4>进展跟踪（' + n + ' 轮 · 最新在前）</h4>' +
              (n ? '<div class="table-wrap"><table class="data-table"><tbody>' + rounds.map(function (p, i) {
                return '<tr><td style="width:90px;white-space:nowrap">第 ' + (n - i) + ' 轮</td><td>' + U().esc(p) + '</td></tr>';
              }).join('') + '</tbody></table></div>' : '<p class="muted" style="font-size:12px">暂无进展记录</p>') +
            '</div>';
          })();
      }

      function openItemEdit(it, refreshDetail) {
        openItemForm(it, refreshDetail);
      }

      function openItemDetail(it) {
        const canEdit = !isEmployee || String(it.owner || '').indexOf(st.user.name) > -1;
        let changed = false;
        U().detailModal({
          title: it.name + '（' + it.seq + '）',
          sub: (groupName[it.group] || it.group) + ' · ' + it.cat + ' · ' + it.phase + ' · ' + it.status + (it.risk === '风险' ? ' · 风险项' : ''),
          body: itemDetailBody(it),
          foot: '<button class="btn btn-ghost" data-close type="button">关闭</button><span class="spacer"></span>' +
            (canEdit ? '<button class="btn btn-soft" data-edit type="button">' + U().icon('edit') + '编辑</button>' : ''),
          onClose: function () { if (changed) ITO.refresh(); },
          onMount: function (closeFn, root) {
            function bindFiles() {
              root.querySelectorAll('[data-oh-file]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                  downloadOverhaulAttachment((it.attachments || [])[Number(btn.dataset.ohFile)]);
                });
              });
            }
            bindFiles();
            root.querySelector('[data-close]').addEventListener('click', closeFn);
            const editBtn = root.querySelector('[data-edit]');
            if (editBtn) editBtn.addEventListener('click', function () {
              openItemEdit(it, function () {
                changed = true;
                const bodyEl = root.querySelector('.modal-body');
                if (bodyEl) {
                  bodyEl.innerHTML = itemDetailBody(it);
                  bindFiles();
                }
                const subEl = root.querySelector('.modal-head p');
                if (subEl) subEl.textContent = (groupName[it.group] || it.group) + ' · ' + it.cat + ' · ' + it.phase + ' · ' + it.status + (it.risk === '风险' ? ' · 风险项' : '');
                const headEl = root.querySelector('.modal-head h2');
                if (headEl) headEl.textContent = it.name + '（' + it.seq + '）';
              });
            });
          }
        });
      }

      function matDetailBody(m) {
        ensureMaterialProgress(m);
        const progressLog = (m.progressLog || []).slice().sort(function (a, b) {
          return String(b.at || '').localeCompare(String(a.at || ''));
        });
        return '<div class="detail-section"><h4>物资信息</h4><div class="table-wrap"><table class="data-table"><tbody>' +
            '<tr><td>物资名称</td><td>' + U().esc(m.name) + '</td></tr>' +
            '<tr><td>规格型号</td><td>' + U().esc(m.spec || '—') + '</td></tr>' +
            '<tr><td>用途说明及数量依据</td><td>' + U().esc(m.use || '—') + '</td></tr>' +
            '<tr><td>数量</td><td>' + U().esc(m.qty) + '</td></tr>' +
            '<tr><td>总价</td><td>' + (m.total ? m.total.toLocaleString() + ' 元' : '—') + '</td></tr>' +
            '<tr><td>需求人</td><td>' + U().esc(m.req || '—') + '</td></tr>' +
            (ITO.customFieldRows ? ITO.customFieldRows('overhaulMaterial', m) : '') +
          '</tbody></table></div></div>' +
          '<div class="detail-section"><h4>采购进度</h4>' +
            (progressLog.length ? '<div class="oh-progress-log">' + progressLog.map(function (item) {
              return '<div class="oh-progress-item"><span class="oh-progress-time">' + U().esc(item.at ? item.at.replace('T', ' ') : '未注明时间') + '</span><span>' + U().esc(item.text || '') + '</span></div>';
            }).join('') + '</div>' : '<p class="muted" style="font-size:12px">暂无采购进度记录</p>') +
          '</div>' +
          '<div class="detail-section"><h4>采购计划</h4><p style="font-size:12px;color:var(--ink-2);line-height:1.7">' + U().esc(m.plan || '暂无采购计划') + '</p></div>';
      }

      function openMatEdit(m, refreshDetail) {
        openMatForm(m, refreshDetail);
      }

      function openMatDetail(m) {
        const canEdit = !isEmployee || String(m.req || '').indexOf(st.user.name) > -1;
        let changed = false;
        U().detailModal({
          title: m.name,
          sub: '大修物资专项跟踪 · 需求人 ' + (m.req || '—'),
          body: matDetailBody(m),
          foot: '<button class="btn btn-ghost" data-close type="button">关闭</button><span class="spacer"></span>' +
            (canEdit ? '<button class="btn btn-soft" data-edit type="button">' + U().icon('edit') + '编辑</button>' : ''),
          onClose: function () { if (changed) ITO.refresh(); },
          onMount: function (closeFn, root) {
            root.querySelector('[data-close]').addEventListener('click', closeFn);
            const editBtn = root.querySelector('[data-edit]');
            if (editBtn) editBtn.addEventListener('click', function () {
              openMatEdit(m, function () {
                changed = true;
                const bodyEl = root.querySelector('.modal-body');
                if (bodyEl) bodyEl.innerHTML = matDetailBody(m);
                const subEl = root.querySelector('.modal-head p');
                if (subEl) subEl.textContent = '大修物资专项跟踪 · 需求人 ' + (m.req || '—');
                const headEl = root.querySelector('.modal-head h2');
                if (headEl) headEl.textContent = m.name;
              });
            });
          }
        });
      }

      function openAuthHolders(colIdx) {
        const col = PERSON_AUTH_COLUMNS[colIdx];
        if (!col) return;
        const holders = [];
        (st.staff || []).forEach(function (person) {
          (st.auths || []).forEach(function (a) {
            if (a.person !== person.name) return;
            if (col.types.length && col.types.indexOf(a.type) === -1) return;
            if (!col.types.length && a.type.indexOf('QC') === -1) return;
            const vst = a.status === '已撤销' ? { status: '已撤销', left: 0 } : ITO.authStatus(a.validTo);
            if (vst.status === '已过期' || vst.status === '已撤销') return;
            holders.push({ person: person, auth: a, status: vst.status, left: vst.left });
          });
        });
        U().detailModal({
          title: col.label + ' · 授权持有人',
          sub: '系统作业授权 · 只读 · 共 ' + holders.length + ' 人',
          body: '<div class="detail-section"><div class="table-wrap"><table class="data-table"><thead><tr><th>人员</th><th>专业组</th><th>授权类型</th><th>有效期至</th><th>状态</th></tr></thead><tbody>' +
            (holders.length ? holders.map(function (h) {
              return '<tr><td><div class="cell-task"><b>' + U().esc(h.person.name) + '</b><small>' + U().esc(h.person.title || '') + '</small></div></td>' +
                '<td>' + U().groupPill(h.person.group) + '</td><td>' + U().esc(h.auth.type) + '</td>' +
                '<td class="num">' + U().esc(h.auth.validTo) + '</td><td>' + U().badge(h.status) + (h.status === '临期' ? ' <span class="text-red">剩 ' + h.left + ' 天</span>' : '') + '</td></tr>';
            }).join('') : '<tr><td colspan="5">' + U().emptyState('暂无对应授权持有人', '系统授权矩阵中暂无该类型授权', 'shield') + '</td></tr>') +
          '</tbody></table></div></div><p class="form-hint">人员矩阵中的授权人数为只读统计，持有人明细直接读取系统作业授权，不支持在此修改人数。</p>',
          foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
          onMount: function (closeFn, root) { root.querySelector('[data-close]').addEventListener('click', closeFn); }
        });
      }

      function openPersonDetail(idx) {
        let detailRoot = null;
        if (idx < 0) {
          const text = o.personnelGap || '';
          let changed = false;
          U().detailModal({
            title: '人员缺口说明',
            sub: '大修人员专项跟踪 · 人员缺口',
            body: '<div class="detail-section"><p style="font-size:13px;font-weight:600;color:#CF4B18;line-height:1.8">' + U().esc(text) + '</p></div>',
            foot: '<button class="btn btn-ghost" data-close type="button">关闭</button><span class="spacer"></span>' +
              (isEmployee ? '' : '<button class="btn btn-soft" data-edit type="button">' + U().icon('edit') + '编辑</button>'),
            onClose: function () { if (changed) ITO.refresh(); },
            onMount: function (closeFn, root) {
              detailRoot = root;
              root.querySelector('[data-close]').addEventListener('click', closeFn);
              const editBtn = root.querySelector('[data-edit]');
              if (editBtn) editBtn.addEventListener('click', function () {
                openPersonForm(null, -1, true, function () {
                  changed = true;
                  const bodyEl = detailRoot && detailRoot.querySelector('.modal-body');
                  if (bodyEl) bodyEl.innerHTML = '<div class="detail-section"><p style="font-size:13px;font-weight:600;color:#CF4B18;line-height:1.8">' + U().esc(o.personnelGap || '') + '</p></div>';
                });
              });
            }
          });
          return;
        }

        const rows = o.personnel || [];
        const row = rows[idx];
        if (!row) return;

        function bodyHtml() {
          return '<div class="detail-section"><h4>人员信息</h4><div class="table-wrap"><table class="data-table"><tbody>' +
            '<tr><td>基地</td><td>' + U().esc(row.base) + '</td></tr>' +
            '<tr><td>专业组</td><td>' + U().groupPill(row.group) + '</td></tr>' +
            '<tr><td>技术工人</td><td class="num">' + row.tech + ' 人</td></tr>' +
            '<tr><td>辅助工人</td><td class="num">' + row.aux + ' 人</td></tr>' +
            '<tr><td>基本安全</td><td class="num">' + row.basic + ' 人</td></tr>' +
            '<tr><td>工作负责人</td><td class="num">' + row.workLead + ' 人</td></tr>' +
            '<tr><td>准备工程师</td><td class="num">' + row.prep + ' 人</td></tr>' +
            '<tr><td>辐射防护一级</td><td class="num">' + row.rp1 + ' 人</td></tr>' +
            '<tr><td>辐射防护二级</td><td class="num">' + row.rp2 + ' 人</td></tr>' +
            '<tr><td>QC授权</td><td class="num">' + row.qc + ' 人</td></tr>' +
            '<tr><td>电工证</td><td class="num">' + row.electric + ' 人</td></tr>' +
            '<tr><td>授权说明</td><td>' + U().esc(row.authNote || '—') + '</td></tr>' +
            '<tr><td>备注</td><td>' + U().esc(row.note || '—') + '</td></tr>' +
            (ITO.customFieldRows ? ITO.customFieldRows('overhaulPerson', row) : '') +
          '</tbody></table></div></div>';
        }

        let changed = false;
        U().detailModal({
          title: row.base + ' · ' + overhaulGroupName(row.group) + ' · 授权人数',
          sub: '大修人员专项跟踪 · 技术工人 / 辅助工人 / 授权人数',
          body: bodyHtml(),
          foot: '<button class="btn btn-ghost" data-close type="button">关闭</button><span class="spacer"></span>' +
            (isEmployee ? '' : '<button class="btn btn-soft" data-edit type="button">' + U().icon('edit') + '编辑</button>'),
          onClose: function () { if (changed) ITO.refresh(); },
          onMount: function (closeFn, root) {
            detailRoot = root;
            root.querySelector('[data-close]').addEventListener('click', closeFn);
            const editBtn = root.querySelector('[data-edit]');
            if (editBtn) editBtn.addEventListener('click', function () {
              openPersonForm(row, idx, false, function () {
                changed = true;
                const bodyEl = detailRoot && detailRoot.querySelector('.modal-body');
                if (bodyEl) bodyEl.innerHTML = bodyHtml();
                const headEl = detailRoot && detailRoot.querySelector('.modal-head h2');
                if (headEl) headEl.textContent = row.base + ' · ' + overhaulGroupName(row.group) + ' · 授权人数';
              });
            });
          }
        });
      }

      function bindCards() {
        const ohCard = document.getElementById('ohItemsCard');
        if (ohCard) {
          ohCard.addEventListener('click', function (e) {
            const pagerBtn = e.target.closest('[data-pager]');
            if (pagerBtn && !pagerBtn.disabled) {
              ITO.pagerState['oh-items'] = Number(pagerBtn.dataset.page);
              renderItemsPage();
              return;
            }
            const row = e.target.closest('tr[data-oh-seq]');
            if (row && !e.target.closest('button, a')) {
              const it = (o.items || []).find(function (x) { return String(x.seq) === row.dataset.ohSeq; });
              if (it) openItemDetail(it);
            }
          });
        }
        const matsCard = document.getElementById('ohMatsCard');
        if (matsCard) {
          matsCard.addEventListener('click', function (e) {
            const row = e.target.closest('tr[data-oh-mat]');
            if (row) {
              const m = (o.materials || [])[Number(row.dataset.ohMat)];
              if (m) openMatDetail(m);
            }
          });
          function rebuildMats() {
            const list = matsFilteredOf(st);
            list.forEach(function (m) { m.__idx = (o.materials || []).indexOf(m); });
            const tbody = document.getElementById('ohMatsTbody');
            if (tbody) tbody.innerHTML = list.map(overhaulMatRow).join('') || '<tr><td colspan="' + (6 + (ITO.customFieldHeaders ? ITO.customFieldHeaders('overhaulMaterial').length : 0)) + '">' + U().emptyState('没有匹配的物资', '调整搜索或筛选条件', 'award') + '</td></tr>';
          }
          const matsSearch = document.getElementById('ohMatsSearch');
          if (matsSearch) matsSearch.addEventListener('input', function () {
            st.ui.overhaulMatsSearch = matsSearch.value;
            rebuildMats();
          });
          const matReqFilter = document.getElementById('ohMatReqFilter');
          if (matReqFilter) matReqFilter.addEventListener('change', function () {
            st.ui.matsReqFilter = matReqFilter.value;
            rebuildMats();
          });
          document.querySelectorAll('[data-oh-mat-cf-filter]').forEach(function (el) {
            ['input', 'change'].forEach(function (ev) {
              el.addEventListener(ev, function () {
                st.ui.matsCustomFilters = st.ui.matsCustomFilters || {};
                st.ui.matsCustomFilters[el.dataset.ohMatCfFilter] = el.value;
                rebuildMats();
              });
            });
          });
        }
        const personCard = document.getElementById('ohPersonCard');
        if (personCard) {
          personCard.addEventListener('click', function (e) {
            const authBtn = e.target.closest('[data-oh-auth-col]');
            if (authBtn) { openAuthHolders(Number(authBtn.dataset.ohAuthCol)); return; }
            const row = e.target.closest('tr[data-oh-person]');
            if (row) openPersonDetail(Number(row.dataset.ohPerson));
          });
          function rebuildPerson() {
            const all = o.personnel || [];
            const list = personFilteredOf(st);
            const q = (st.ui.overhaulPersonSearch || '').trim().toLowerCase();
            const bf = st.ui.personBaseFilter || '';
            const gf = st.ui.personGroupFilter || '';
            const gapText = o.personnelGap || '';
            const gapVisible = gapText && (!gf || gf === 'comm') && (!bf || bf === 'B地区') && (!q || gapText.toLowerCase().indexOf(q) > -1);
            const gapRow = gapVisible ? '<tr data-oh-person="-1"><td colspan="' + (13 + (ITO.customFieldHeaders ? ITO.customFieldHeaders('overhaulPerson').length : 0)) + '" class="oh-gap-row">' + U().esc(gapText) + '</td></tr>' : '';
            const tbody = document.getElementById('ohPersonTbody');
            if (tbody) tbody.innerHTML = (list.map(function (row) { return overhaulPersonRow(row, all.indexOf(row)); }).join('') + gapRow) || '<tr><td colspan="' + (13 + (ITO.customFieldHeaders ? ITO.customFieldHeaders('overhaulPerson').length : 0)) + '">' + U().emptyState('没有匹配的人员记录', '调整搜索或筛选条件', 'users') + '</td></tr>';
          }
          const personSearch = document.getElementById('ohPersonSearch');
          if (personSearch) personSearch.addEventListener('input', function () {
            st.ui.overhaulPersonSearch = personSearch.value;
            rebuildPerson();
          });
          const personGroupFilter = document.getElementById('ohPersonGroupFilter');
          if (personGroupFilter) personGroupFilter.addEventListener('change', function () {
            st.ui.personGroupFilter = personGroupFilter.value;
            rebuildPerson();
          });
          const personBaseFilter = document.getElementById('ohPersonBaseFilter');
          if (personBaseFilter) personBaseFilter.addEventListener('change', function () {
            st.ui.personBaseFilter = personBaseFilter.value;
            rebuildPerson();
          });
          document.querySelectorAll('[data-oh-person-cf-filter]').forEach(function (el) {
            ['input', 'change'].forEach(function (ev) {
              el.addEventListener(ev, function () {
                st.ui.personCustomFilters = st.ui.personCustomFilters || {};
                st.ui.personCustomFilters[el.dataset.ohPersonCfFilter] = el.value;
                rebuildPerson();
              });
            });
          });
        }
      }

      function refreshKeepScroll() {
        const y = window.scrollY || 0;
        ITO.refresh();
        window.scrollTo(0, y);
      }

      function attachmentListHtml(list) {
        return (list || []).map(function (a, i) {
          const size = a.size ? (a.size >= 1024 * 1024 ? (a.size / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(a.size / 1024)) + ' KB') : '';
          return '<span class="oh-attach-chip"><span>' + U().esc(a.name) + '</span>' + (size ? '<small>' + size + '</small>' : '') +
            '<button type="button" data-attach-remove="' + i + '" aria-label="移除附件">×</button></span>';
        }).join('');
      }

      function actionFormBody(d, editing) {
        const cats = uniqueOptions(ITO.dictValues ? ITO.dictValues('overhaulCat', true) : ['文件支持', '物资保障', '人员保障', '现场实施'], (o.items || []).map(function (x) { return x.cat; }));
        const phases = uniqueOptions(ITO.dictValues ? ITO.dictValues('overhaulPhase', true) : ['大修前', '大修中', '大修后', '大修前/中'], (o.items || []).map(function (x) { return x.phase; }));
        const prios = uniqueOptions(ITO.dictValues ? ITO.dictValues('overhaulPrio', true) : ['高', '中', '低', '中等'], (o.items || []).map(function (x) { return x.prio; }));
        const statuses = uniqueOptions(['进行中', '已完成', '尚未开始'], (o.items || []).map(function (x) { return x.status; }));
        const desc = d.desc ? overhaulPoints(d.desc).join('\n') : '';
        return formSection('基本信息', '任务名称、任务描述与归属',
          U().formRow({ label: '任务名', required: true, full: true, control: '<input id="ohName" type="text" maxlength="60" value="' + U().esc(d.name || '') + '" placeholder="请填写任务名">' }) +
          U().formRow({ label: '任务描述', full: true, control: '<textarea id="ohDesc" rows="4" placeholder="请填写任务描述">' + U().esc(desc) + '</textarea>' }) +
          U().formRow({ label: '分类', control: '<select id="ohCatInput">' + optionHtml(cats, d.cat, '请选择分类') + '</select>' }) +
          U().formRow({ label: '专业组', required: true, control: '<select id="ohGroupInput"><option value="">请选择专业组</option>' + U().groupOptions(d.group || '') + '</select>' }) +
          U().formRow({ label: '负责人', control:
            '<div class="multi-picker" id="ohOwnerPicker">' +
              '<button type="button" class="multi-trigger" aria-haspopup="listbox"><span class="multi-placeholder">请选择负责人</span></button>' +
              '<div class="multi-pop" hidden><input class="multi-search" type="search" placeholder="搜索姓名 / 岗位"><div class="multi-list"></div></div>' +
            '</div><input id="ohOwner" type="hidden" value="' + U().esc(d.owner || '') + '">'
          }) +
          U().formRow({ label: '阶段', required: true, control: '<select id="ohPhaseInput">' + optionHtml(phases, d.phase, '请选择阶段') + '</select>' }) +
          U().formRow({ label: '优先级', required: true, control: '<select id="ohPrioInput">' + optionHtml(prios, d.prio, '请选择优先级') + '</select>' }) +
          U().formRow({ label: '状态', required: true, control: '<select id="ohStatusInput">' + optionHtml(statuses, d.status, '请选择状态') + '</select>' })
        ) +
        formSection('计划安排', '按起止日期自动计算天数',
          U().formRow({ label: '开始日期', control: '<input id="ohStart" type="date" value="' + U().esc(d.start || '') + '">' }) +
          U().formRow({ label: '截止日期', control: '<input id="ohDue" type="date" value="' + U().esc(d.due || '') + '">' }) +
          U().formRow({ label: '天数', control: '<input id="ohDays" type="text" readonly value="' + U().esc(d.days || '') + '" placeholder="自动计算">', hint: '按起止日期自动计算' })
        ) +
        formSection('交付信息', '成果物附件',
          U().formRow({ label: '成果物附件', full: true, control:
            '<div class="oh-attach-field" id="ohAttachField">' +
              (d.output ? '<div class="form-hint">历史成果物说明：' + U().esc(d.output) + '</div>' : '') +
              '<div class="oh-attach-list" id="ohAttachList">' + attachmentListHtml(d.attachments || []) + '</div>' +
              '<input id="ohAttachInput" type="file" multiple hidden>' +
              '<button type="button" class="btn btn-soft btn-sm" id="ohAttachAdd">' + U().icon('plus') + '添加附件</button>' +
              '<span class="form-hint">支持多文件，保存后随行动项记录</span>' +
            '</div>'
          })
        ) +
        (ITO.customFieldForm ? ITO.customFieldForm('overhaulAction', d) : '') +
        (editing ? formSection('进展跟踪', '追加后作为最新一轮，不覆盖历史',
          U().formRow({ label: '追加进展', full: true, control: '<textarea id="ohProgress" rows="3" placeholder="填写本轮进展内容（选填）"></textarea>' })
        ) : '');
      }

      function openItemForm(it, refreshDetail) {
        const editing = !!it;
        const d = it || {};
        U().modal({
          title: editing ? '编辑行动项 · ' + it.seq : '添加行动项',
          sub: editing ? it.name : 'HZ101 大修专项行动 · 新增后将进入清单、筛选与图表统计',
          xwide: true,
          body: actionFormBody(d, editing),
          foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><span class="spacer"></span>' +
            '<button class="btn btn-primary" data-save type="button">' + (editing ? '保存修改' : '保存') + '</button>',
          onMount: function (close, root) {
            U().bindFieldClear(root);
            if (isEmployee) {
              ['#ohName', '#ohCatInput', '#ohGroupInput', '#ohPhaseInput', '#ohPrioInput', '#ohStatusInput', '#ohStart', '#ohDue'].forEach(function (sel) {
                const el = root.querySelector(sel);
                if (el) el.disabled = true;
              });
              const picker = root.querySelector('#ohOwnerPicker .multi-trigger');
              if (picker) { picker.disabled = true; picker.style.pointerEvents = 'none'; }
            }
            const groupEl = root.querySelector('#ohGroupInput');
            const ownerEl = root.querySelector('#ohOwner');
            const ownerPicker = root.querySelector('#ohOwnerPicker');
            const startEl = root.querySelector('#ohStart');
            const dueEl = root.querySelector('#ohDue');
            const daysEl = root.querySelector('#ohDays');
            initMultiPicker(root, '#ohOwnerPicker', '#ohOwner', function () { return groupEl.value; });
            let attachments = (d.attachments || []).slice();
            const attachList = root.querySelector('#ohAttachList');
            const attachInput = root.querySelector('#ohAttachInput');
            function paintAttachments() {
              attachList.innerHTML = attachmentListHtml(attachments) || '<span class="form-hint">暂未添加附件</span>';
            }
            paintAttachments();
            root.querySelector('#ohAttachAdd').addEventListener('click', function () { attachInput.click(); });
            attachInput.addEventListener('change', function () {
              Array.prototype.forEach.call(attachInput.files || [], function (file) {
                attachments.push({ name: file.name, size: file.size, type: file.type, file: file });
              });
              attachInput.value = '';
              paintAttachments();
            });
            attachList.addEventListener('click', function (e) {
              const btn = e.target.closest('[data-attach-remove]');
              if (!btn) return;
              attachments.splice(Number(btn.dataset.attachRemove), 1);
              paintAttachments();
            });
            function refreshDays() {
              const calc = calcDays(startEl.value, dueEl.value);
              daysEl.value = calc || (editing && !startEl.value && !dueEl.value ? (d.days || '') : '');
            }
            startEl.addEventListener('change', refreshDays);
            dueEl.addEventListener('change', refreshDays);
            refreshDays();
            groupEl.addEventListener('change', function () {
              if (ownerPicker.__syncGroup) ownerPicker.__syncGroup();
            });
            root.querySelector('[data-cancel]').addEventListener('click', close);
            root.querySelector('[data-save]').addEventListener('click', function () {
              const nameEl = root.querySelector('#ohName');
              const phaseEl = root.querySelector('#ohPhaseInput');
              const prioEl = root.querySelector('#ohPrioInput');
              const statusEl = root.querySelector('#ohStatusInput');
              if (!U().validateRequired([
                [nameEl, '请填写任务名'],
                [groupEl, '请选择专业组'],
                [phaseEl, '请选择阶段'],
                [prioEl, '请选择优先级'],
                [statusEl, '请选择状态']
              ])) return;
              if (startEl.value && dueEl.value && dueEl.value < startEl.value) {
                U().showFieldError(dueEl, '截止日期不能早于开始日期');
                return;
              }
              const descEl = root.querySelector('#ohDesc');
              const cf = ITO.readCustomFields ? ITO.readCustomFields(root, 'overhaulAction', editing ? it.extra : null) : { values: {}, errors: [] };
              if (cf.errors.length) { U().toast(cf.errors[0], 'warn'); return; }
              const data = {
                name: nameEl.value.trim(),
                cat: root.querySelector('#ohCatInput').value,
                extra: cf.values,
                group: groupEl.value,
                phase: phaseEl.value,
                desc: descEl.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean).join('；'),
                output: editing ? (it.output || '') : '',
                prio: prioEl.value,
                owner: ownerEl.value.trim(),
                attachments: attachments,
                start: startEl.value,
                due: dueEl.value,
                days: calcDays(startEl.value, dueEl.value),
                status: statusEl.value
              };
              if (editing) {
                Object.assign(it, data);
                const progEl = root.querySelector('#ohProgress');
                const prog = progEl ? progEl.value.trim() : '';
                if (prog) (it.progress || (it.progress = [])).push(prog);
                ITO.log('编辑大修行动项', 'seq ' + it.seq + ' · ' + it.name, '任务');
                U().toast('行动项已保存');
                close();
                if (refreshDetail) refreshDetail();
              } else {
                const maxSeq = (o.items || []).reduce(function (n, x) { return Math.max(n, x.seq); }, 0);
                data.seq = maxSeq + 1;
                data.progress = [];
                data.risk = '';
                (o.items || []).push(data);
                ITO.log('新建大修行动项', 'seq ' + (maxSeq + 1) + ' · ' + data.name, '任务');
                U().toast('行动项已添加');
                ITO.pagerState['oh-items'] = 1;
                close();
                refreshKeepScroll();
              }
            });
          }
        });
      }

      function openItemCreate() {
        openItemForm(null);
      }

      function materialFormBody(m) {
        m = m || {};
        const reqOptions = '<option value="">请选择需求人</option>' + U().peopleOptions('', m.req || '');
        return formSection('基本信息', '物资名称与需求人',
          U().formRow({ label: '物资名称', required: true, span2: true, control: '<input id="ohMatName" type="text" maxlength="60" value="' + U().esc(m.name || '') + '" placeholder="请填写物资名称">' }) +
          U().formRow({ label: '需求人', required: true, control: '<select id="ohMatReq">' + reqOptions + '</select>' })
        ) +
        formSection('规格与采购', '规格、数量与预算',
          U().formRow({ label: '规格型号', required: true, control: '<input id="ohMatSpec" type="text" value="' + U().esc(m.spec || '') + '" placeholder="请填写规格型号">' }) +
          U().formRow({ label: '数量', required: true, control: '<input id="ohMatQty" type="number" min="0" step="1" value="' + U().esc(m.qty || '') + '" placeholder="请填写数量">' }) +
          U().formRow({ label: '总价（元）', required: true, control: '<input id="ohMatTotal" type="number" min="0" step="0.01" value="' + U().esc(m.total || '') + '" placeholder="请填写总价">' })
        ) +
        formSection('用途与跟踪', '用途说明、采购进度与计划',
          U().formRow({ label: '用途说明及数量依据', required: true, full: true, control: '<textarea id="ohMatUse" rows="3" placeholder="请填写用途说明及数量依据">' + U().esc(m.use || '') + '</textarea>' }) +
          U().formRow({ label: '采购进度', full: true, control:
            '<div class="oh-progress-edit"><div id="ohMatProgressList"></div>' +
            '<button type="button" class="btn btn-soft btn-sm oh-progress-add" id="ohMatProgressAdd">' + U().icon('plus') + '添加进度</button></div>'
          }) +
          U().formRow({ label: '采购计划', full: true, control: '<textarea id="ohMatPlan" rows="3" placeholder="请填写采购计划">' + U().esc(m.plan || '') + '</textarea>' })
        ) +
        (ITO.customFieldForm ? ITO.customFieldForm('overhaulMaterial', m) : '');
      }

      function openMatForm(m, refreshDetail) {
        const editing = !!m;
        const d = m || {};
        ensureMaterialProgress(d);
        U().modal({
          title: editing ? '编辑物资 · ' + m.name : '添加物资',
          sub: editing ? '大修物资专项跟踪 · 保存后预算与详情同步更新' : '大修物资专项跟踪 · 新增后预算自动累计',
          xwide: true,
          body: materialFormBody(d),
          foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><span class="spacer"></span>' +
            '<button class="btn btn-primary" data-save type="button">' + (editing ? '保存修改' : '保存') + '</button>',
          onMount: function (close, root) {
            U().bindFieldClear(root);
            if (isEmployee) {
              ['#ohMatName', '#ohMatReq', '#ohMatSpec', '#ohMatQty', '#ohMatTotal', '#ohMatUse'].forEach(function (sel) {
                const el = root.querySelector(sel);
                if (el) el.disabled = true;
              });
            }
            const progressList = root.querySelector('#ohMatProgressList');
            function addProgressRow(at, text) {
              const row = document.createElement('div');
              row.className = 'oh-progress-row';
              row.innerHTML = '<input class="oh-pg-at" type="datetime-local" data-date-picker="1" value="' + U().esc(at || '') + '">' +
                '<input class="oh-pg-text" type="text" value="' + U().esc(text || '') + '" placeholder="请填写采购进度说明">' +
                '<button type="button" class="btn btn-ghost btn-sm" data-progress-remove aria-label="移除进度">' + U().icon('close') + '</button>';
              row.querySelector('[data-progress-remove]').addEventListener('click', function () { row.remove(); });
              progressList.appendChild(row);
              U().enhanceFormDates(row);
            }
            (d.progressLog || []).forEach(function (item) { addProgressRow(item.at, item.text); });
            root.querySelector('#ohMatProgressAdd').addEventListener('click', function () { addProgressRow('', ''); });
            root.querySelector('[data-cancel]').addEventListener('click', close);
            root.querySelector('[data-save]').addEventListener('click', function () {
              const nameEl = root.querySelector('#ohMatName');
              const reqEl = root.querySelector('#ohMatReq');
              const specEl = root.querySelector('#ohMatSpec');
              const qtyEl = root.querySelector('#ohMatQty');
              const totalEl = root.querySelector('#ohMatTotal');
              const useEl = root.querySelector('#ohMatUse');
              if (!U().validateRequired([
                [nameEl, '请输入物资名称'],
                [reqEl, '请选择需求人'],
                [specEl, '请输入规格型号'],
                [qtyEl, '请输入数量'],
                [totalEl, '请输入总价'],
                [useEl, '请输入用途说明及数量依据']
              ])) return;
              const totalVal = parseFloat(totalEl.value);
              const total = isNaN(totalVal) ? 0 : totalVal;
              const progressLog = [];
              progressList.querySelectorAll('.oh-progress-row').forEach(function (row) {
                const at = row.querySelector('.oh-pg-at').value;
                const text = row.querySelector('.oh-pg-text').value.trim();
                if (at || text) progressLog.push({ at: at, text: text });
              });
              const progress = progressLog.map(function (item) {
                return (item.at ? item.at.replace('T', ' ') + ' · ' : '') + item.text;
              }).join('；');
              const cf = ITO.readCustomFields ? ITO.readCustomFields(root, 'overhaulMaterial', editing ? m.extra : null) : { values: {}, errors: [] };
              if (cf.errors.length) { U().toast(cf.errors[0], 'warn'); return; }
              const data = {
                name: nameEl.value.trim(),
                spec: specEl.value.trim(),
                extra: cf.values,
                qty: qtyEl.value.trim(),
                total: total,
                req: reqEl.value,
                use: useEl.value.trim(),
                progress: progress,
                progressLog: progressLog,
                plan: root.querySelector('#ohMatPlan').value.trim()
              };
              if (editing) {
                const oldTotal = Number(m.total) || 0;
                Object.assign(m, data);
                o.materialBudget = round2((o.materialBudget || 0) - oldTotal + total);
                ITO.log('编辑大修物资', m.name, '任务');
                U().toast('物资信息已保存');
                close();
                if (refreshDetail) refreshDetail();
              } else {
                o.materialBudget = round2((o.materialBudget || 0) + total);
                (o.materials || []).push(data);
                ITO.log('新建大修物资', data.name, '任务');
                U().toast('物资已添加');
                close();
                refreshKeepScroll();
              }
            });
          }
        });
      }

      function openMatCreate() {
        openMatForm(null);
      }

      function personnelFormBody(row) {
        row = row || {};
        const baseList = (ITO.dictValues ? ITO.dictValues('overhaulBase', true) : ['A地区', 'B地区']).slice();
        if (row.base && baseList.indexOf(row.base) === -1) baseList.push(row.base);
        const baseOptions = baseList.map(function (b2) {
          return '<option value="' + U().esc(b2) + '"' + (row.base === b2 ? ' selected' : '') + '>' + U().esc(b2) + '</option>';
        }).join('');
        const groupOptions = (S().groups || []).map(function (g2) {
          return '<option value="' + U().esc(g2.id) + '"' + (row.group === g2.id ? ' selected' : '') + '>' + U().esc(g2.name) + '</option>';
        }).join('');
        const count = function (key) { return row[key] == null ? 0 : row[key]; };
        const field = function (label, id, value, hint) {
          return U().formRow({ label: label, control: '<input id="' + id + '" type="number" min="0" step="1" value="' + value + '">' + (hint ? '<span class="form-hint">' + hint + '</span>' : '') });
        };
        return formSection('基本信息', '基地与专业组',
          U().formRow({ label: '基地', required: true, control: '<select id="ohPerBase"><option value="">请选择基地</option>' + baseOptions + '</select>' }) +
          U().formRow({ label: '专业组', required: true, control: '<select id="ohPerGroup"><option value="">请选择专业组</option>' + groupOptions + '</select>' })
        ) +
        formSection('人员构成', '技术工人 / 辅助工人；基本安全人数自动合计',
          field('技术工人', 'ohPerTech', count('tech')) +
          field('辅助工人', 'ohPerAux', count('aux')) +
          U().formRow({ label: '基本安全', control: '<input id="ohPerBasic" type="text" readonly value="' + (Number(row.basic) || 0) + '">', hint: '技术工人 + 辅助工人' })
        ) +
        formSection('授权人数', '单位：人',
          field('工作负责人', 'ohPerWorkLead', count('workLead')) +
          field('准备工程师', 'ohPerPrep', count('prep')) +
          field('辐射防护一级', 'ohPerRp1', count('rp1')) +
          field('辐射防护二级', 'ohPerRp2', count('rp2')) +
          field('QC授权', 'ohPerQc', count('qc')) +
          field('电工证', 'ohPerElectric', count('electric'))
        ) +
        formSection('说明', '授权说明与备注',
          U().formRow({ label: '授权说明', full: true, control: '<input id="ohPerAuthNote" type="text" value="' + U().esc(row.authNote || '') + '" placeholder="如：8人已办理，剩余4人…">' }) +
          U().formRow({ label: '备注', full: true, control: '<input id="ohPerNote" type="text" value="' + U().esc(row.note || '') + '" placeholder="请填写备注">' })
        ) +
        (ITO.customFieldForm ? ITO.customFieldForm('overhaulPerson', row) : '');
      }

      function openPersonForm(row, idx, isGap, refreshDetail) {
        const editing = !!row && !isGap;
        if (isGap) {
          U().modal({
            title: '编辑人员缺口说明',
            sub: '大修人员专项跟踪 · 仅修改缺口说明',
            xwide: true,
            body: '<div class="form-grid"><div class="form-field full"><label>缺口说明（整段）</label>' +
              '<textarea id="ohGapText" rows="6">' + U().esc(o.personnelGap || '') + '</textarea></div></div>',
            foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><span class="spacer"></span>' +
              '<button class="btn btn-primary" data-save type="button">保存修改</button>',
            onMount: function (close, root) {
              U().bindFieldClear(root);
              root.querySelector('[data-cancel]').addEventListener('click', close);
              root.querySelector('[data-save]').addEventListener('click', function () {
                o.personnelGap = root.querySelector('#ohGapText').value.trim();
                ITO.log('编辑大修人员备注', '缺口说明', '任务');
                U().toast('缺口说明已保存');
                close();
                if (refreshDetail) refreshDetail();
              });
            }
          });
          return;
        }
        U().modal({
          title: editing ? '编辑人员矩阵行' : '添加人员组行',
          sub: '大修人员专项跟踪 · ' + (editing ? '修改基地、专业组与授权人数' : '仅新增矩阵区组行，作业授权名单区不受影响'),
          xwide: true,
          body: personnelFormBody(row),
          foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><span class="spacer"></span>' +
            '<button class="btn btn-primary" data-save type="button">' + (editing ? '保存修改' : '保存') + '</button>',
          onMount: function (close, root) {
            U().bindFieldClear(root);
            if (isEmployee) {
              root.querySelectorAll('input, select, textarea').forEach(function (el) { el.disabled = true; });
            }
            const techEl = root.querySelector('#ohPerTech');
            const auxEl = root.querySelector('#ohPerAux');
            const basicEl = root.querySelector('#ohPerBasic');
            function syncBasic() {
              basicEl.value = String((Number(techEl.value) || 0) + (Number(auxEl.value) || 0));
            }
            techEl.addEventListener('input', syncBasic);
            auxEl.addEventListener('input', syncBasic);
            root.querySelector('[data-cancel]').addEventListener('click', close);
            root.querySelector('[data-save]').addEventListener('click', function () {
              const baseEl = root.querySelector('#ohPerBase');
              const groupEl = root.querySelector('#ohPerGroup');
              if (!U().validateRequired([[baseEl, '请选择基地'], [groupEl, '请选择专业组']])) return;
              const tech = Number(techEl.value) || 0;
              const aux = Number(auxEl.value) || 0;
              const num = function (id) { return Number(root.querySelector(id).value) || 0; };
              const cf = ITO.readCustomFields ? ITO.readCustomFields(root, 'overhaulPerson', editing ? row.extra : null) : { values: {}, errors: [] };
              if (cf.errors.length) { U().toast(cf.errors[0], 'warn'); return; }
              const data = {
                base: baseEl.value,
                extra: cf.values,
                group: groupEl.value,
                tech: tech,
                aux: aux,
                basic: tech + aux,
                workLead: num('#ohPerWorkLead'),
                prep: num('#ohPerPrep'),
                rp1: num('#ohPerRp1'),
                rp2: num('#ohPerRp2'),
                qc: num('#ohPerQc'),
                electric: num('#ohPerElectric'),
                authNote: root.querySelector('#ohPerAuthNote').value.trim(),
                note: root.querySelector('#ohPerNote').value.trim()
              };
              if (editing) {
                Object.assign(row, data);
                sortOverhaulPersonnel(o.personnel || []);
                ITO.log('编辑大修人员矩阵行', data.base + ' · ' + overhaulGroupName(data.group), '任务');
                U().toast('人员矩阵已保存');
                close();
                if (refreshDetail) refreshDetail();
              } else {
                (o.personnel || (o.personnel = [])).push(data);
                sortOverhaulPersonnel(o.personnel || []);
                ITO.log('新建大修人员矩阵行', data.base + ' · ' + overhaulGroupName(data.group), '任务');
                U().toast('矩阵行已添加');
                close();
                refreshKeepScroll();
              }
            });
          }
        });
      }

      function openPersonCreate() {
        openPersonForm(null, -1, false, null);
      }

      function exportItems() {
        const customHeaders = ITO.customFieldExportHeaders ? ITO.customFieldExportHeaders('overhaulAction') : [];
        const rows = [['序号', '任务名', '分类', '专业组', '阶段', '任务描述', '成果物附件', '优先级', '负责人', '开始日期', '截止日期', '天数', '状态', '最新进展', '进展跟踪（全轮次）', '风险'].concat(customHeaders)];
        (o.items || []).forEach(function (it) {
          const rounds = overhaulRounds(it);
          const allRounds = rounds.map(function (p2, i) { return '第' + (i + 1) + '轮：' + p2; }).join('；');
          const files = (it.attachments || []).map(function (a) { return a.name; }).join(' / ') || it.output || '';
          rows.push([it.seq, it.name, it.cat, groupName[it.group] || it.group, it.phase, it.desc, files, it.prio, it.owner, it.start, it.due, it.days, it.status, overhaulLatest(it), allRounds || '', it.risk === '风险' ? '是' : ''].concat(ITO.customFieldExport ? ITO.customFieldExport('overhaulAction', it) : []));
        });
        U().exportPreview({ title: '大修行动项导出预览', rows: rows, filename: 'ITO大修行动项清单.csv' });
        ITO.log('导出大修行动项', (o.items || []).length + ' 项', '任务');
        U().toast('大修行动项已导出');
      }

      function exportMats() {
        const customHeaders = ITO.customFieldExportHeaders ? ITO.customFieldExportHeaders('overhaulMaterial') : [];
        const rows = [['序号', '物资', '规格型号', '用途说明及数量依据', '数量', '总价（元）', '需求人', '采购进度', '采购计划'].concat(customHeaders)];
        (o.materials || []).forEach(function (m, i) {
          rows.push([i + 1, m.name, m.spec, m.use, m.qty, m.total ? m.total.toLocaleString() : '', m.req || '', materialProgressText(m), m.plan || ''].concat(ITO.customFieldExport ? ITO.customFieldExport('overhaulMaterial', m) : []));
        });
        U().exportPreview({ title: '大修物资导出预览', rows: rows, filename: 'ITO大修物资清单.csv' });
        ITO.log('导出大修物资', (o.materials || []).length + ' 项', '任务');
        U().toast('大修物资已导出');
      }

      function exportPerson() {
        const rows = [];
        const customHeaders = ITO.customFieldExportHeaders ? ITO.customFieldExportHeaders('overhaulPerson') : [];
        rows.push(PERSON_HEADERS.concat(customHeaders));
        (o.personnel || []).forEach(function (row) {
          rows.push(personnelValues(row).concat(ITO.customFieldExport ? ITO.customFieldExport('overhaulPerson', row) : []));
        });
        if (o.personnelGap) {
          const gap = new Array(PERSON_HEADERS.length + customHeaders.length).fill('');
          gap[PERSON_HEADERS.length - 1] = o.personnelGap;
          rows.push(gap);
        }
        U().exportPreview({ title: '大修人员矩阵导出预览', rows: rows, filename: 'ITO大修人员矩阵.csv' });
        ITO.log('导出大修人员矩阵', (o.personnel || []).length + ' 行', '任务');
        U().toast('大修人员矩阵已导出');
      }

      const expBtn = document.getElementById('ohExportBtn');
      if (expBtn) expBtn.addEventListener('click', exportItems);
      const matsExpBtn = document.getElementById('ohMatsExportBtn');
      if (matsExpBtn) matsExpBtn.addEventListener('click', exportMats);
      const personExpBtn = document.getElementById('ohPersonExportBtn');
      if (personExpBtn) personExpBtn.addEventListener('click', exportPerson);
      const addItemBtn = document.getElementById('ohAddItemBtn');
      if (addItemBtn) addItemBtn.addEventListener('click', openItemCreate);
      const addMatBtn = document.getElementById('ohMatsAddBtn');
      if (addMatBtn) addMatBtn.addEventListener('click', openMatCreate);
      const addPersonBtn = document.getElementById('ohPersonAddBtn');
      if (addPersonBtn) addPersonBtn.addEventListener('click', openPersonCreate);

      /* ── 行动项分析图表（状态环形 + 专业组堆叠柱） ── */
      function initCharts() {
        const itemsAll = o.items || [];
        const done2 = itemsAll.filter(function (i2) { return i2.status === '已完成'; }).length;
        const doing2 = itemsAll.filter(function (i2) { return i2.status === '进行中'; }).length;
        const pending2 = itemsAll.filter(function (i2) { return i2.status === '尚未开始'; }).length;
        const total2 = itemsAll.length || 1;
        if (document.getElementById('ohChartStatus')) {
          U().chart('ohChartStatus', {
            tooltip: { trigger: 'item', backgroundColor: 'rgba(29,29,31,.92)', borderWidth: 0, padding: [9, 12], textStyle: { color: '#fff', fontSize: 11 }, formatter: '{b}：{c} 项（{d}%）' },
            title: { text: Math.round(done2 / total2 * 100) + '%', subtext: '完成率', left: 'center', top: '42%', textStyle: { fontSize: 22, fontWeight: 700, color: '#1D1D1F' }, subtextStyle: { fontSize: 10, color: '#8A8A8E' } },
            series: [{
              type: 'pie', radius: ['58%', '82%'], center: ['50%', '50%'], label: { show: false },
              data: [
                { value: done2, name: '已完成', itemStyle: { color: '#1FAE5C' } },
                { value: doing2, name: '进行中', itemStyle: { color: '#0A72E8' } },
                { value: pending2, name: '尚未开始', itemStyle: { color: '#C9C4BD' } }
              ]
            }]
          });
        }
        if (document.getElementById('ohChartGroup')) {
          const gOrder = ['comm', 'app', 'online', 'infra'];
          const names2 = gOrder.map(function (g2) { return (groupName[g2] || g2); });
          const pick = function (g2, st) { return itemsAll.filter(function (i2) { return i2.group === g2 && i2.status === st; }).length; };
          const mk = function (st, color) {
            return { name: st, type: 'bar', stack: 'total', barWidth: 26, itemStyle: { color: color },
              data: gOrder.map(function (g2) { return pick(g2, st); }) };
          };
          U().chart('ohChartGroup', {
            tooltip: { trigger: 'axis', backgroundColor: 'rgba(29,29,31,.92)', borderWidth: 0, padding: [9, 12], textStyle: { color: '#fff', fontSize: 11 } },
            legend: { top: 0, right: 6, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 10, color: '#6E6E73' } },
            grid: { left: 6, right: 10, top: 30, bottom: 4, containLabel: true },
            xAxis: { type: 'category', data: names2, axisLine: { lineStyle: { color: 'rgba(29,29,31,.10)' } }, axisTick: { show: false }, axisLabel: { color: '#6E6E73', fontSize: 10 } },
            yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(29,29,31,.055)', type: 'dashed' } }, axisLabel: { color: '#AEAEB2', fontSize: 9 } },
            series: [mk('已完成', '#1FAE5C'), mk('进行中', '#0A72E8'), mk('尚未开始', '#C9C4BD')]
          });
        }
      }
      initCharts();
      bindTabs();
      bindHeadControls();
      bindCards();
      renderItemsPage();
    }
  };
})();
