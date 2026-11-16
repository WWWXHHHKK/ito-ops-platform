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

  /* 记分项一律整数；只有季度均分保留一位小数。 */
  function round1(value) {
    return Math.round((Number(value) || 0) * 10) / 10;
  }

  function fmt(value) {
    const n = round1(value);
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  function sum(list, fn) {
    return (list || []).reduce(function (total, item) { return total + fn(item); }, 0);
  }

  function monthPeriod(key) {
    const parts = String(key || '').split('-');
    const year = Number(parts[0]) || 2026;
    const month = Number(parts[1]) || 11;
    const lastDay = new Date(year, month, 0).getDate();
    return {
      key: key,
      label: year + ' 年 ' + month + ' 月',
      short: month + ' 月',
      start: key + '-01',
      end: key + '-' + String(lastDay).padStart(2, '0')
    };
  }

  function statusOf(total) {
    const diff = round1(total - TARGET);
    if (diff > 0) return '高于合格线 ' + fmt(diff) + ' 分';
    if (diff === 0) return '压线合格';
    return '低于合格线 ' + fmt(Math.abs(diff)) + ' 分';
  }

  function statusShortOf(total) {
    const diff = round1(total - TARGET);
    if (diff > 0) return '高于 ' + fmt(diff) + ' 分';
    if (diff === 0) return '压线合格';
    return '低于 ' + fmt(Math.abs(diff)) + ' 分';
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

  function buildPeriod(mode, period, detail) {
    const source = detail || {};
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

    (source.deductions || []).forEach(function (item) {
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

    const deductionTotal = deductions.reduce(function (total, item) {
      return total + Math.abs(int(item.points));
    }, 0);

    const bonusMap = {};
    (source.bonuses || []).forEach(function (item) {
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

    const bonusTotal = bonusRows.reduce(function (total, item) {
      return total + int(item.awarded);
    }, 0);

    const sla = Math.max(0, Math.min(BASE_SLA, BASE_SLA + bonusTotal - deductionTotal));

    const safetyEvents = (source.safetyEvents || []).slice();
    const yellow = safetyEvents.filter(function (event) { return event.level === '黄灯'; }).length;
    const red = safetyEvents.filter(function (event) { return event.level === '红灯'; }).length;
    const redEvents = safetyEvents.filter(function (event) { return event.level === '红灯'; });
    const safety = Math.max(0, BASE_SAFETY - yellow - red * 3);
    const total = sla + safety;

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
      isAverage: false,
      period: period,
      label: period.label || source.label || '',
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
      qualified: total >= TARGET,
      statusText: statusOf(total),
      statusShort: statusShortOf(total),
      deductionRows: deductions,
      bonusRows: bonusRows,
      tickets: tickets,
      exams: (A.exams || []).filter(function (item) { return inPeriod(item.date, period); }),
      keyNodes: (A.keyNodes || []).filter(function (item) { return inPeriod(item.date, period); }),
      safetyEvents: safetyEvents,
      redEvents: redEvents,
      safetySummary: { yellow: yellow, red: red, score: safety },
      safetyStandards: A.safetyStandards || [],
      monthRows: [],
      trend: trend,
      taskSla: taskReference()
    };
  }

  function buildMonth(key) {
    const period = monthPeriod(key);
    const detail = (A.months || {})[key] || {};
    const model = buildPeriod('month', period, detail);
    if (detail.label) model.label = detail.label;
    return model;
  }

  /* 季度取季度内已结算月份的均分，不累加历史月份明细。 */
  function buildQuarter() {
    const period = periodOf('quarter');
    const keys = (period.months || []).filter(function (key) {
      return !!(A.months && A.months[key]);
    });
    const rows = keys.map(buildMonth);
    if (!rows.length) {
      const empty = buildPeriod('quarter', period, {});
      empty.isAverage = true;
      return empty;
    }

    const sla = round1(sum(rows, function (row) { return row.sla; }) / rows.length);
    const safety = round1(sum(rows, function (row) { return row.safety; }) / rows.length);
    const total = round1(sla + safety);
    const yellow = round1(sum(rows, function (row) { return row.safetySummary.yellow; }) / rows.length);
    const red = sum(rows, function (row) { return row.safetySummary.red; });
    const safetyEvents = rows.reduce(function (list, row) { return list.concat(row.safetyEvents); }, []);
    const redEvents = rows.reduce(function (list, row) { return list.concat(row.redEvents); }, []);

    return {
      kind: 'quarter',
      isQuarter: true,
      isAverage: true,
      period: period,
      label: period.label || '2026 Q4',
      shortLabel: period.short || 'Q4',
      rangeLabel: period.start && period.end ? period.start + ' 至 ' + period.end : '',
      target: TARGET,
      baseSla: BASE_SLA,
      baseSafety: BASE_SAFETY,
      bonusCap: BONUS_CAP,
      sla: sla,
      safety: safety,
      total: total,
      deduction: 0,
      bonus: 0,
      qualified: total >= TARGET,
      statusText: statusOf(total),
      statusShort: statusShortOf(total),
      deductionRows: [],
      bonusRows: [],
      tickets: [],
      exams: [],
      keyNodes: [],
      safetyEvents: safetyEvents,
      redEvents: redEvents,
      safetySummary: { yellow: yellow, red: red, score: safety },
      safetyStandards: A.safetyStandards || [],
      trend: (A.monthTrend || []).map(function (row) { return Object.assign({}, row); }),
      monthRows: rows.map(function (row) {
        return {
          key: row.period.key,
          label: row.label,
          short: row.shortLabel,
          sla: row.sla,
          safety: row.safety,
          total: row.total
        };
      }),
      taskSla: taskReference()
    };
  }

  ITO.assessmentModel = function (kind) {
    return kind === 'quarter' ? buildQuarter() : buildMonth(periodOf('month').key);
  };

  ITO.assessmentMonth = function (key) {
    const target = (A.monthTrend || []).some(function (row) { return row.key === key; })
      ? key
      : periodOf('month').key;
    return buildMonth(target);
  };

  ITO.assessmentPeriods = function () {
    return {
      month: periodOf('month'),
      quarter: periodOf('quarter')
    };
  };
})();
