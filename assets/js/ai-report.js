/* ─────────────────────────────────────────────
   ITO OPS · AI monthly report insights
   local deterministic engine · replace build() with a real model later
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  window.ITO = window.ITO || {};

  const VERSION = '20261118z65';

  function pct(part, total) {
    const base = Number(total) || 0;
    return base ? Math.round((Number(part) || 0) / base * 1000) / 10 : 0;
  }

  function fmtPct(value) {
    const n = Math.round((Number(value) || 0) * 10) / 10;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  function shiftMonth(key, delta) {
    const parts = String(key || '').split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    if (!year || !month) return key;
    const d = new Date(year, month - 1 + (Number(delta) || 0), 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function groupNameOf(item) {
    const gid = item && item.sub ? (item.sub.group || (item.task && item.task.group)) : '';
    const group = window.ITO.getGroup ? window.ITO.getGroup(gid) : null;
    return group && group.name ? group.name : (gid || '');
  }

  function countBy(items, pick) {
    const map = {};
    (items || []).forEach(function (item) {
      const key = pick(item);
      if (!key) return;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }

  function sortedEntries(map) {
    return Object.keys(map).map(function (name) {
      return { name: name, count: map[name] };
    }).sort(function (a, b) {
      return b.count - a.count || a.name.localeCompare(b.name, 'zh');
    });
  }

  function topEntry(map) {
    return sortedEntries(map)[0] || null;
  }

  function uniqueTags(items) {
    const map = {};
    (items || []).forEach(function (item) {
      const list = (item.sub && item.sub.tags ? item.sub.tags : [])
        .concat(item.task && item.task.tags ? item.task.tags : []);
      list.forEach(function (name) {
        if (name) map[name] = (map[name] || 0) + 1;
      });
    });
    return sortedEntries(map);
  }

  function hoursOf(items) {
    return Math.round((items || []).reduce(function (sum, item) {
      return sum + (Number(item.sub && item.sub.hours) || 0);
    }, 0) * 10) / 10;
  }

  function listNames(entries, limit) {
    return entries.slice(0, limit).map(function (x) { return x.name; }).join('、');
  }

  function build(ctx) {
    const context = ctx || {};
    const m = context.m || { items: [], total: 0, done: 0, doing: 0, overdue: 0 };
    const prev = context.prev || { items: [], total: 0, done: 0, doing: 0, overdue: 0 };
    const items = m.items || [];
    const scope = context.scope || 'me';
    const personName = context.personName || '';
    const groupName = context.groupName || '';
    const subject = scope === 'group' ? (groupName || '全部专业组') :
      scope === 'initiated' ? '你发起的任务' :
        (scope === 'person' || scope === 'employee') ? (personName || '该员工') : '你';
    const variant = Math.abs(Number(context.variant) || 0) % 3;
    const rate = pct(m.done, m.total);
    const prevRate = pct(prev.done, prev.total);
    const tagEntries = uniqueTags(items);
    const medalCount = (context.medals || []).length;
    const hours = hoursOf(items);
    const todayMonth = String((window.ITO_DATA && window.ITO_DATA.meta && window.ITO_DATA.meta.today) || '').slice(0, 7);
    const inProgress = String(context.month || '') === todayMonth;

    if (!m.total) {
      return {
        version: VERSION,
        insights: [
          { key: 'progress', label: '完成态势', text: '本月暂无可分析任务，建议调整月份、范围或人员后再查看。' },
          { key: 'risk', label: '风险聚焦', text: '本月暂无任务，暂不生成风险判断。' },
          { key: 'capability', label: '能力与负荷', text: '本月暂无任务，暂不生成能力与负荷分析。' }
        ],
        basis: '本月暂无任务数据',
        note: 'AI 辅助生成，仅供参考'
      };
    }

    const totalPhrase = scope === 'initiated' ? (m.total + ' 条') : (m.total + ' 条任务');
    const progressLead = [
      subject + '本月共 ' + totalPhrase + '，完成 ' + m.done + ' 条，完成率 ' + fmtPct(rate) + '%。',
      '本月' + subject + '共承接 ' + m.total + ' 条' + (scope === 'initiated' ? '' : '任务') + '，已完成 ' + m.done + ' 条，完成率 ' + fmtPct(rate) + '%。',
      '从完成情况看，' + subject + '本月 ' + m.total + ' 条' + (scope === 'initiated' ? '中' : '任务中') + '已完成 ' + m.done + ' 条，完成率 ' + fmtPct(rate) + '%。'
    ];
    let progress = progressLead[variant];
    if (m.doing) progress += '当前仍有 ' + m.doing + ' 条在执行中。';
    if (prev.total && !inProgress) {
      const totalDelta = m.total - prev.total;
      const rateDelta = Math.round((rate - prevRate) * 10) / 10;
      const compare = [];
      if (totalDelta) compare.push('任务量较上月' + (totalDelta > 0 ? '增加 ' : '减少 ') + Math.abs(totalDelta) + ' 条');
      if (rateDelta) compare.push('完成率较上月' + (rateDelta > 0 ? '提升 ' : '下降 ') + fmtPct(Math.abs(rateDelta)) + ' 个百分点');
      if (compare.length) progress += compare.join('，') + '。';
      else progress += '任务量与完成率与上月基本持平。';
    } else if (inProgress) {
      progress += '当前月份尚未结束，以上为截至今日快照。';
    } else {
      progress += '上月暂无可比数据。';
    }
    const topType = topEntry(countBy(items, function (x) { return x.sub.type || x.task.type; }));
    const topGroup = topEntry(countBy(items, groupNameOf));
    if (topType && topType.count > 1) {
      if (scope === 'group') progress += '任务主要集中在' + topType.name + '类（' + topType.count + ' 条）。';
      else if (topGroup) progress += '任务主要集中在' + topGroup.name + '的' + topType.name + '类（' + topType.count + ' 条）。';
      else progress += '任务主要集中在' + topType.name + '类（' + topType.count + ' 条）。';
    }

    let risk;
    const overdueItems = context.overdueItems || [];
    if (!m.overdue) {
      risk = '本月没有超期任务，风险可控。建议保持当前的派发与跟进节奏。';
    } else {
      const riskLead = [
        '本月超期 ' + m.overdue + ' 条，占本月任务 ' + fmtPct(pct(m.overdue, m.total)) + '%。',
        '需要关注的是，本月有 ' + m.overdue + ' 条任务超期，占比 ' + fmtPct(pct(m.overdue, m.total)) + '%。',
        '风险方面，本月超期 ' + m.overdue + ' 条，超期率 ' + fmtPct(pct(m.overdue, m.total)) + '%。'
      ];
      risk = riskLead[variant];
      const late = overdueItems.filter(function (x) { return x.sub.status === '已完成'; }).length;
      if (late) risk += '其中 ' + late + ' 条为完成后晚于截止。';
      const riskGroup = topEntry(countBy(overdueItems, groupNameOf));
      const riskType = topEntry(countBy(overdueItems, function (x) { return x.sub.type || x.task.type; }));
      const riskGroupCount = riskGroup ? riskGroup.count : 0;
      const riskTypeCount = riskType ? riskType.count : 0;
      if (m.overdue === 1 && riskGroup && riskType) {
        risk += '超期任务为' + riskGroup.name + '的' + riskType.name + '类任务。';
      } else if (riskGroup && riskType && riskGroupCount === m.overdue && riskTypeCount === m.overdue) {
        risk += '超期全部集中在' + riskGroup.name + '的' + riskType.name + '类任务。';
      } else if (riskGroup && riskType && riskGroupCount >= 2 && riskTypeCount >= 2) {
        risk += '超期主要集中在' + riskGroup.name + '的' + riskType.name + '类任务（' + riskTypeCount + ' 条）。';
      } else if (riskGroup && riskGroupCount >= 2) {
        risk += '超期主要集中在' + riskGroup.name + '。';
      } else if (riskType && riskTypeCount >= 2) {
        risk += '超期主要集中在' + riskType.name + '类任务。';
      } else {
        risk += '超期任务分布较分散。';
      }
      const riskAdvice = [
        '建议下月第一周安排专项清理，优先确认依赖与截止时间。',
        '下月可优先清理超期任务，并在派发时提前确认依赖关系。',
        '下一步建议逐条确认阻塞原因，优先处理影响面较大的任务。'
      ];
      risk += riskAdvice[variant];
    }

    const tagNames = listNames(tagEntries, 2);
    let capability;
    if (scope === 'group' || scope === 'initiated') {
      const personHours = {};
      items.forEach(function (x) {
        const name = x.sub.owner;
        if (!name) return;
        personHours[name] = (personHours[name] || 0) + (Number(x.sub.hours) || 0);
      });
      const people = Object.keys(personHours).map(function (name) {
        return { name: name, hours: Math.round(personHours[name] * 10) / 10 };
      }).filter(function (x) { return x.hours > 0; }).sort(function (a, b) {
        return b.hours - a.hours || a.name.localeCompare(b.name, 'zh');
      });
      const avg = people.length ? Math.round(hours / people.length * 10) / 10 : 0;
      const capLead = [
        '本月任务预估工时合计 ' + hours + ' h',
        '从能力与负荷看，本月任务预估工时合计 ' + hours + ' h',
        '本月能力画像：任务预估工时合计 ' + hours + ' h'
      ];
      capability = capLead[variant];
      if (people.length === 1) {
        capability += '，全部由 ' + people[0].name + ' 承担（' + people[0].hours + ' h）';
      } else if (people.length > 1) {
        const maxHours = people[0].hours;
        const minHours = people[people.length - 1].hours;
        capability += '，人均 ' + avg + ' h；';
        if (maxHours === minHours) {
          capability += '成员负荷较为均衡';
        } else {
          const topNames = people.filter(function (x) { return x.hours === maxHours; }).map(function (x) { return x.name; }).slice(0, 2);
          const lowNames = people.filter(function (x) { return x.hours === minHours; }).map(function (x) { return x.name; }).slice(0, 2);
          capability += topNames.join('、') + ' 负荷最高（' + maxHours + ' h），' + lowNames.join('、') + ' 相对较低（' + minHours + ' h）';
        }
      }
      capability += '。';
      if (tagNames) capability += '高频任务标签为 ' + tagNames + '。';
      else capability += '本月任务标签较少，建议补充标签以便沉淀能力画像。';
      capability += variant === 1
        ? '下月可结合负荷分布调整派发，并把高频任务沉淀为标准作业。'
        : '建议下月结合负荷分布调整派发，并把高频任务沉淀为标准作业。';
    } else {
      const capLead = [
        '本月任务预估工时合计 ' + hours + ' h',
        '从能力与负荷看，本月任务预估工时合计 ' + hours + ' h',
        '本月能力画像：任务预估工时合计 ' + hours + ' h'
      ];
      capability = capLead[variant];
      if (medalCount) capability += '，已获得 ' + medalCount + ' 项属性勋章';
      capability += '。';
      if (tagNames) capability += '高频任务标签为 ' + tagNames + '。';
      else capability += '本月任务标签较少，建议补充标签以便沉淀能力画像。';
      capability += variant === 1
        ? '下月可把高频任务经验沉淀为个人作业模板，并安排一次复盘。'
        : '建议把高频任务经验沉淀为个人作业模板，并安排一次复盘。';
    }

    const basisParts = ['本月 ' + m.total + ' 条任务'];
    if (m.overdue) basisParts.push(m.overdue + ' 条超期');
    if (tagEntries.length) basisParts.push(tagEntries.length + ' 个任务标签');
    if (medalCount) basisParts.push(medalCount + ' 项勋章');

    return {
      version: VERSION,
      insights: [
        { key: 'progress', label: '完成态势', text: progress },
        { key: 'risk', label: '风险聚焦', text: risk },
        { key: 'capability', label: '能力与负荷', text: capability }
      ],
      basis: '依据' + basisParts.join('、') + '生成',
      note: 'AI 辅助生成，仅供参考'
    };
  }

  window.ITO.aiReport = {
    version: VERSION,
    build: build,
    shiftMonth: shiftMonth
  };
})();
