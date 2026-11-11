/* ─────────────────────────────────────────────
   ITO OPS · 预警规则执行引擎
   纯前端演示：命中后只生成站内消息与操作日志
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  window.ITO = window.ITO || {};
  const D = window.ITO_DATA;
  if (!D) return;

  function S() { return ITO.state || {}; }
  function pad(n) { return String(n).padStart(2, '0'); }

  function parseTime(value) {
    if (!value) return null;
    const d = new Date(String(value).replace(/-/g, '/').replace('T', ' '));
    return isNaN(d.getTime()) ? null : d;
  }

  const CLOSED = ['已完成', '已取消', '草稿', '待分发'];
  const GROUP_SCOPE = {
    all: '全部专业组',
    app: '应用组',
    comm: '通信组',
    online: '在线监测组',
    infra: '基础设施组'
  };

  const TYPES = [
    {
      key: 'taskOverdue', label: '任务超期', unit: '小时', threshold: 2, messageType: '超期',
      hint: '统计未完成且超过截止时间的子任务，按任务逐项去重',
      condition: function (t) { return '未完成且超期 > ' + t + ' 小时'; }
    },
    {
      key: 'approvalTimeout', label: '审批超时', unit: '分钟', threshold: 30, messageType: '审批',
      hint: '统计处于待审批状态、且已等待超过阈值的审批单',
      condition: function (t) { return '高风险审批未处理 > ' + t + ' 分钟'; }
    },
    {
      key: 'inspectionException', label: '巡检异常', unit: '项', threshold: 1, messageType: '巡检',
      hint: '统计近 7 天异常项达到阈值的巡检记录',
      condition: function (t) { return '近 7 天巡检异常项 ≥ ' + t; }
    },
    {
      key: 'slaThreshold', label: 'SLA 达成率', unit: '%', threshold: 97, messageType: '报表',
      hint: 'SLA 达成率低于阈值时通知领导层与运维主管',
      condition: function (t) { return 'SLA 达成率 < ' + t + '%'; }
    },
    {
      key: 'dutyHandover', label: '值班交接', unit: '分钟', threshold: 15, messageType: '值班',
      hint: '以周一 08:00 为交接时点，超时仍未确认即触发',
      condition: function (t) { return '周一 08:' + pad(Math.min(59, Number(t) || 0)) + ' 未确认交接'; }
    }
  ];

  function typeOf(key) {
    return TYPES.find(function (t) { return t.key === key; }) || null;
  }

  function conditionOf(rule) {
    if (!rule) return '';
    const type = typeOf(rule.type);
    if (!type) return rule.condition || '';
    return type.condition(Number(rule.threshold) || type.threshold);
  }

  /* ── 命中采集 ─────────────────────────────── */
  function collect(rule, now) {
    const st = S();
    const th = Number(rule.threshold);
    const threshold = isNaN(th) ? (typeOf(rule.type) || {}).threshold || 0 : th;
    const scoped = function (group) {
      return !rule.scope || rule.scope === 'all' || group === rule.scope;
    };
    const out = [];

    if (rule.type === 'taskOverdue') {
      (st.tasks || []).forEach(function (task) {
        if (task.canceled || task.draft) return;
        (task.subs || []).forEach(function (sub) {
          if (!sub.due || CLOSED.indexOf(sub.status) > -1) return;
          const due = parseTime(sub.due);
          if (!due) return;
          const mins = Math.round((now - due) / 60000);
          if (mins < threshold * 60) return;
          if (!scoped(sub.group || task.group)) return;
          out.push({
            key: sub.id, name: sub.name, owner: sub.owner,
            group: sub.group || task.group, minutes: mins
          });
        });
      });
      return out;
    }

    if (rule.type === 'approvalTimeout') {
      (st.tasks || []).forEach(function (task) {
        if (task.canceled || task.draft) return;
        (task.subs || []).forEach(function (sub) {
          const ap = sub.approval;
          if (!ap || ap.status !== '待审批') return;
          const from = parseTime(ap.submittedAt || sub.submittedAt);
          if (!from) return;
          const mins = Math.round((now - from) / 60000);
          if (mins < threshold) return;
          if (!scoped(sub.group || task.group)) return;
          out.push({
            key: sub.id, name: sub.name, owner: sub.owner, group: sub.group || task.group,
            approver: ap.approver || '', minutes: mins
          });
        });
        const leader = task.leaderApproval;
        if (leader && leader.status === '待审批') {
          const from = parseTime(leader.submittedAt);
          if (!from) return;
          const mins = Math.round((now - from) / 60000);
          if (mins < threshold) return;
          if (!scoped(task.group)) return;
          out.push({
            key: task.id, name: task.name, owner: task.owner, group: task.group,
            approver: leader.approver || '', minutes: mins
          });
        }
      });
      return out;
    }

    if (rule.type === 'inspectionException') {
      const since = new Date(now.getTime() - 7 * 86400000);
      (st.inspectionRecords || []).forEach(function (rec) {
        const abnormal = Number(rec.abnormal) || 0;
        if (rec.result !== '异常' && abnormal < threshold) return;
        if (abnormal < threshold) return;
        const at = parseTime(rec.time);
        if (!at || at < since) return;
        if (!scoped(rec.group)) return;
        out.push({
          key: rec.id, name: rec.plan, owner: rec.owner,
          group: rec.group, abnormal: abnormal, time: rec.time
        });
      });
      return out;
    }

    if (rule.type === 'slaThreshold') {
      const value = Number((st.metrics || {}).sla != null ? st.metrics.sla : D.dashboard.sla);
      if (!(value < threshold)) return out;
      out.push({ key: 'SLA-' + pad((st.metrics || {}).sla), name: 'SLA 达成率', value: value });
      return out;
    }

    if (rule.type === 'dutyHandover') {
      const duty = st.duty || {};
      const current = duty.currentKey;
      const week = (duty.weeks || []).find(function (w) { return w.key === current; });
      if (!week) return out;
      const deadline = parseTime(week.start + ' 08:' + pad(Math.min(59, threshold)));
      if (!deadline || now < deadline) return out;
      if (week.handover && week.handover.status === '已完成') return out;
      out.push({
        key: week.key, name: '第 ' + week.weekNo + ' 周',
        owner: (week.dutyRoster || []).filter(function (r) { return r.post && r.post.indexOf('通信值班-') === 0; }).map(function (r) { return r.name; }).join('/'),
        weekNo: week.weekNo, deadline: week.start + ' 08:' + pad(Math.min(59, threshold)),
        status: (week.handover && week.handover.status) || '待交接'
      });
      return out;
    }

    return out;
  }

  function describe(rule, hits, threshold) {
    const first = hits[0];
    if (rule.type === 'taskOverdue') {
      const owners = {};
      hits.forEach(function (h) { if (h.owner) owners[h.owner] = true; });
      return '「' + first.name + '」（' + first.key + '）等 ' + hits.length + ' 项任务已超期超过 ' +
        threshold + ' 小时，涉及 ' + Object.keys(owners).length + ' 名负责人，请优先处置。';
    }
    if (rule.type === 'approvalTimeout') {
      return '「' + first.name + '」（' + first.key + '）等 ' + hits.length + ' 项审批已等待超过 ' +
        threshold + ' 分钟，最长等待 ' + Math.round(Math.max.apply(null, hits.map(function (h) { return h.minutes; })) / 60) +
        ' 小时，请审批人尽快处理。';
    }
    if (rule.type === 'inspectionException') {
      return '「' + first.name + '」发现 ' + first.abnormal + ' 项异常，近 7 天共 ' + hits.length +
        ' 条异常巡检记录待整改，请专业组主管确认整改责任人与时限。';
    }
    if (rule.type === 'slaThreshold') {
      return '当前 SLA 达成率 ' + first.value + '%，低于阈值 ' + threshold + '%，请关注审批积压与超期任务。';
    }
    if (rule.type === 'dutyHandover') {
      return '第 ' + first.weekNo + ' 周值班交接截至 ' + first.deadline.slice(11) + ' 仍未确认（当前状态：' +
        first.status + '），请通信助理与接班人补确认。';
    }
    return rule.name + ' 触发 ' + hits.length + ' 项。';
  }

  function shiftMinutes(value, minutes) {
    const d = parseTime(value);
    if (!d) return value;
    d.setMinutes(d.getMinutes() + minutes);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /* ── 引擎 ─────────────────────────────────── */
  const ENGINE = {
    running: false,
    started: false,
    timer: null
  };

  ENGINE.check = function (options) {
    const opts = options || {};
    const st = S();
    if (!st || !Array.isArray(st.alertRules) || ENGINE.running) {
      return { fired: 0, rules: [], skipped: true };
    }
    if (!st.role && !opts.boot) return { fired: 0, rules: [], skipped: true };
    const now = parseTime(D.meta.demoNow) || new Date();
    const fired = [];

    ENGINE.running = true;
    try {
      st.alertRules.forEach(function (rule, ruleIndex) {
        if (!rule.enabled) return;
        const type = typeOf(rule.type);
        if (!type) return;
        const threshold = Number(rule.threshold);
        const hits = collect(rule, now);
        if (!hits.length) return;

        const signature = hits.map(function (h) { return h.key; }).sort().join('|');
        const dedupe = Number(rule.dedupeMinutes) || 30;
        const until = parseTime(rule.dedupeUntil);
        if (rule.lastSignature === signature && until && now < until) return;

        /* 展示时间按规则错峰 2–30 分钟，避免五条规则同一分钟。 */
        const offset = 2 + ((ruleIndex * 7 + 3) % 29);
        const firedAt = shiftMinutes(D.meta.demoNow, -offset);

        st.msgSeq = (st.msgSeq || 0) + 1;
        st.messages.unshift({
          id: 'MSG-A' + pad(st.msgSeq),
          type: type.messageType,
          title: rule.name + ' · ' + hits.length + ' 项',
          body: describe(rule, hits, threshold),
          time: firedAt,
          read: false,
          ruleId: rule.id
        });

        rule.lastFiredAt = firedAt;
        rule.dedupeUntil = shiftMinutes(D.meta.demoNow, dedupe);
        rule.fireCount = (rule.fireCount || 0) + 1;
        rule.lastSignature = signature;
        rule.lastHitCount = hits.length;
        rule.lastHits = hits.slice(0, 6).map(function (h) { return { key: h.key, name: h.name }; });
        rule.triggers = rule.triggers || [];
        rule.triggers.unshift({ time: firedAt, count: hits.length });
        rule.triggers = rule.triggers.slice(0, 8);

        const top = rule.lastHits.slice(0, 3).map(function (h) { return h.key; }).join('、');
        ITO.log('触发预警规则', rule.id + ' ' + rule.name + ' · ' + hits.length + ' 项' + (top ? '（' + top + (hits.length > 3 ? ' 等' : '') + '）' : ''), '预警');
        if (st.logs[0] && st.logs[0].action === '触发预警规则') st.logs[0].time = firedAt;
        fired.push({ id: rule.id, name: rule.name, count: hits.length });
      });

      st.alertEngine = st.alertEngine || {};
      st.alertEngine.lastCheckAt = D.meta.demoNow;
      st.alertEngine.lastFired = fired.length;
      if (fired.length) {
        st.logs.sort(function (a, b) { return String(b.time).localeCompare(String(a.time)); });
        ITO.persistState();
      }
    } finally {
      ENGINE.running = false;
    }

    if (fired.length) {
      setTimeout(function () {
        if (ITO.state && ITO.state.role && ITO.renderShell) ITO.renderShell();
      }, 30);
    }

    return { fired: fired.length, rules: fired, checkedAt: D.meta.demoNow };
  };

  ENGINE.schedule = function (delay) {
    if (ENGINE.timer) return;
    ENGINE.timer = setTimeout(function () {
      ENGINE.timer = null;
      ENGINE.check({ auto: true });
    }, typeof delay === 'number' ? delay : 800);
  };

  ENGINE.start = function () {
    if (ENGINE.started) return;
    ENGINE.started = true;
    setInterval(function () { ENGINE.check({ auto: true }); }, 60000);
  };

  ENGINE.collect = collect;
  ENGINE.types = TYPES;
  ENGINE.conditionOf = conditionOf;
  ENGINE.groupScope = GROUP_SCOPE;

  window.ITO_ALERT_ENGINE = ENGINE;
  ITO.ALERT_TYPES = TYPES;
  ITO.ruleCondition = conditionOf;
})();
