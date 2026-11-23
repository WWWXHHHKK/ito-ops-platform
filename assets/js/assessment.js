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
          category: '运维事项',
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
    const safetyDeduction = safetyEvents.reduce(function (total, event) {
      return total + Math.abs(int(event.points));
    }, 0);
    /* 安质环按文档 26 条逐项扣分；红灯 / 一票否决归零。 */
    const safety = (red > 0 || safetyEvents.some(function (event) { return event.veto; }))
      ? 0
      : Math.max(0, BASE_SAFETY - safetyDeduction);
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
      safetyDeduction: safetyDeduction,
      safetySummary: { yellow: yellow, yellowTotal: yellow, red: red, deduction: safetyDeduction, score: safety, redLine: red > 0 },
      safetyStandards: A.safetyStandards || [],
      slaStandards: A.slaStandards || [],
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

  /* 季度取季度内已结算月份的均分，同时保留当前季度已发生的扣分 / 加分记录。 */
  function buildQuarter(periodArg) {
    const period = periodArg || periodOf('quarter');
    const quarterKeys = period.months || [];
    const settledKeys = quarterKeys.filter(function (key) {
      return !!(A.months && A.months[key]);
    });
    const pendingKeys = quarterKeys.filter(function (key) {
      return !(A.months && A.months[key]);
    });
    const rows = settledKeys.map(buildMonth);
    if (!rows.length) {
      const empty = buildPeriod('quarter', period, {});
      empty.isAverage = true;
      empty.monthCount = quarterKeys.length;
      empty.settledCount = 0;
      empty.pendingMonths = pendingKeys.map(function (key) { return monthPeriod(key); });
      return empty;
    }

    const deduction = sum(rows, function (row) { return row.deduction; });
    /* 季度考核：月度只提供事件，加分在季度层按项合并后再封顶。 */
    const bonusMap = {};
    rows.forEach(function (row) {
      (row.bonusRows || []).forEach(function (item) {
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
    });
    const bonusRows = Object.keys(bonusMap).map(function (key) {
      const row = bonusMap[key];
      row.capped = row.count > BONUS_CAP;
      row.used = Math.min(BONUS_CAP, row.count);
      row.awarded = row.used * row.points;
      return row;
    }).sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date)) || String(a.category).localeCompare(String(b.category), 'zh');
    });
    const bonus = bonusRows.reduce(function (total, item) { return total + int(item.awarded); }, 0);
    const sla = Math.max(0, Math.min(BASE_SLA, BASE_SLA + bonus - deduction));
    const red = sum(rows, function (row) { return row.safetySummary.red; });
    const redLine = red > 0;
    const safetyDeduction = sum(rows, function (row) { return row.safetyDeduction || 0; });
    const safety = redLine ? 0 : Math.max(0, BASE_SAFETY - safetyDeduction);
    const total = sla + safety;
    const yellow = round1(sum(rows, function (row) { return row.safetySummary.yellow; }) / rows.length);
    const yellowTotal = sum(rows, function (row) { return row.safetySummary.yellow; });
    const safetyEvents = rows.reduce(function (list, row) { return list.concat(row.safetyEvents); }, []);
    const redEvents = rows.reduce(function (list, row) { return list.concat(row.redEvents); }, []);
    const deductionRows = rows.reduce(function (list, row) {
      return list.concat(row.deductionRows.map(function (item) {
        return Object.assign({}, item, { monthKey: row.period.key, monthLabel: row.shortLabel });
      }));
    }, []).sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date)) || String(a.category).localeCompare(String(b.category), 'zh');
    });
    const tickets = rows.reduce(function (list, row) { return list.concat(row.tickets); }, []);

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
      deduction: deduction,
      bonus: bonus,
      qualified: total >= TARGET,
      statusText: statusOf(total),
      statusShort: statusShortOf(total),
      deductionRows: deductionRows,
      bonusRows: bonusRows,
      tickets: tickets,
      exams: [],
      keyNodes: [],
      safetyEvents: safetyEvents,
      redEvents: redEvents,
      safetyDeduction: safetyDeduction,
      safetySummary: { yellow: yellow, yellowTotal: yellowTotal, red: red, deduction: safetyDeduction, score: safety, redLine: redLine },
      safetyStandards: A.safetyStandards || [],
      slaStandards: A.slaStandards || [],
      trend: (A.monthTrend || []).map(function (row) { return Object.assign({}, row); }),
      monthCount: quarterKeys.length,
      settledCount: rows.length,
      pendingMonths: pendingKeys.map(function (key) { return monthPeriod(key); }),
      monthRows: rows.map(function (row) {
        return {
          key: row.period.key,
          label: row.label,
          short: row.shortLabel,
          sla: row.sla,
          safety: row.safety,
          total: row.total,
          deduction: row.deduction,
          bonus: row.bonus
        };
      }),
      taskSla: taskReference()
    };
  }

  ITO.assessmentModel = function (kind) {
    return kind === 'quarter' ? buildQuarter(periodOf('quarter')) : buildMonth(periodOf('month').key);
  };

  ITO.assessmentQuarter = function (key) {
    const period = (A.quarters || []).find(function (item) { return item.key === key; });
    return period ? buildQuarter(period) : null;
  };

  ITO.assessmentMonth = function (key) {
    const target = (A.months && A.months[key]) ? key : periodOf('month').key;
    return buildMonth(target);
  };

  ITO.assessmentPeriods = function () {
    return {
      month: periodOf('month'),
      quarter: periodOf('quarter'),
      quarters: A.quarters || []
    };
  };
})();
