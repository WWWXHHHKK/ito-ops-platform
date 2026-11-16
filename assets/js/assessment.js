/* ─────────────────────────────────────────────
   assessment · monthly / quarterly score model
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const ITO = window.ITO = window.ITO || {};
  const D = window.ITO_DATA || {};
  const A = D.assessment || {};
  const BASE_SLA = Number(A.baseSla) || 80;
  const BASE_SAFETY = Number(A.baseSafety) || 20;
  const TARGET = Number(A.target) || 95;
  const BONUS_CAP = Number(A.bonusCap) || 2;

  function periodOf(kind) {
    const p = A.period || {};
    return kind === 'quarter' ? (p.quarter || {}) : (p.month || {});
  }

  function inPeriod(value, period) {
    const date = String(value || '').slice(0, 10);
    if (!date || !period.start || !period.end) return false;
    return date >= period.start && date <= period.end;
  }

  function int(value) {
    return Math.round(Number(value) || 0);
  }

  function taskReference() {
    const ts = (D.dashboard && D.dashboard.slaMetrics) || {};
    return {
      score: Number(ts.score != null ? ts.score : 92.0),
      grade: ts.grade || 'A',
      onTimeRate: Number(ts.onTimeRate != null ? ts.onTimeRate : 88.9),
      overdueRate: Number(ts.overdueRate != null ? ts.overdueRate : 5.5),
      avgClosureText: ts.avgClosureText || '6h 12m'
    };
  }

  function build(kind) {
    const mode = kind === 'quarter' ? 'quarter' : 'month';
    const period = periodOf(mode);
    const deductions = [];
    const tickets = (A.tickets || []).filter(function (ticket) {
      return inPeriod(ticket.submitted, period);
    }).map(function (ticket) {
      (ticket.deductions || []).forEach(function (item) {
        deductions.push({
          date: ticket.submitted,
          category: 'IT100 / SAP',
          item: item.reason,
          count: 1,
          points: int(item.points),
          ticket: ticket.id
        });
      });
      return ticket;
    });

    (A.deductions || []).forEach(function (item) {
      if (!inPeriod(item.date, period)) return;
      deductions.push({
        date: item.date,
        category: item.category,
        item: item.item,
        count: int(item.count) || 1,
        points: int(item.points)
      });
    });

    deductions.sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date)) || String(a.category).localeCompare(String(b.category), 'zh');
    });

    const deductionTotal = deductions.reduce(function (sum, item) {
      return sum + Math.abs(int(item.points));
    }, 0);

    const bonusMap = {};
    (A.bonuses || []).forEach(function (item) {
      if (!inPeriod(item.date, period)) return;
      const key = item.item;
      if (!bonusMap[key]) {
        bonusMap[key] = {
          date: item.date,
          category: item.category,
          item: item.item,
          count: 0,
          points: int(item.points),
          used: 0,
          awarded: 0,
          capped: false
        };
      }
      bonusMap[key].count += int(item.count);
      if (item.date < bonusMap[key].date) bonusMap[key].date = item.date;
    });

    const bonusRows = Object.keys(bonusMap).map(function (key) {
      const row = bonusMap[key];
      row.capped = row.count > BONUS_CAP;
      row.used = Math.min(BONUS_CAP, row.count);
      row.awarded = row.used * row.points;
      return row;
    });

    const bonusTotal = bonusRows.reduce(function (sum, item) {
      return sum + int(item.awarded);
    }, 0);

    const sla = Math.max(0, Math.min(BASE_SLA, BASE_SLA + bonusTotal - deductionTotal));

    const safetyEvents = (A.safetyEvents || []).filter(function (event) {
      return inPeriod(event.date, period);
    });
    const yellow = safetyEvents.filter(function (event) { return event.level === '黄灯'; }).length;
    const red = safetyEvents.filter(function (event) { return event.level === '红灯'; }).length;
    const redEvents = safetyEvents.filter(function (event) { return event.level === '红灯'; });
    const safety = Math.max(0, BASE_SAFETY - yellow - red * 3);
    const total = sla + safety;
    const qualified = total >= TARGET;
    const statusText = total > TARGET
      ? '高于合格线 ' + (total - TARGET) + ' 分'
      : total === TARGET
        ? '压线合格'
        : '低于合格线 ' + (TARGET - total) + ' 分';

    const trend = (A.monthTrend || []).map(function (row) {
      return Object.assign({}, row);
    });
    if (mode === 'month') {
      const current = trend.find(function (row) { return row.key === period.key; });
      if (current) {
        current.total = total;
        current.sla = sla;
        current.safety = safety;
      }
    }

    return {
      kind: mode,
      isQuarter: mode === 'quarter',
      period: period,
      label: period.label || '',
      shortLabel: period.short || '',
      rangeLabel: period.start && period.end ? period.start + ' 至 ' + period.end : '',
      target: TARGET,
      baseSla: BASE_SLA,
      baseSafety: BASE_SAFETY,
      bonusCap: BONUS_CAP,
      sla: sla,
      safety: safety,
      total: total,
      deduction: deductionTotal,
      bonus: bonusTotal,
      qualified: qualified,
      statusText: statusText,
      statusShort: total > TARGET ? '高于 ' + (total - TARGET) + ' 分' : total === TARGET ? '压线合格' : '低于 ' + (TARGET - total) + ' 分',
      deductionRows: deductions,
      bonusRows: bonusRows,
      tickets: tickets,
      exams: (A.exams || []).filter(function (item) { return inPeriod(item.date, period); }),
      keyNodes: (A.keyNodes || []).filter(function (item) { return inPeriod(item.date, period); }),
      safetyEvents: safetyEvents,
      redEvents: redEvents,
      safetySummary: { yellow: yellow, red: red, score: safety },
      safetyStandards: A.safetyStandards || [],
      weeklyLogNote: A.weeklyLogNote || '本期按 0 处理，本期无扣分。',
      trend: trend,
      taskSla: taskReference()
    };
  }

  ITO.assessmentModel = function (kind) {
    return build(kind === 'quarter' ? 'quarter' : 'month');
  };

  ITO.assessmentPeriods = function () {
    return {
      month: periodOf('month'),
      quarter: periodOf('quarter')
    };
  };
})();
