/* ─────────────────────────────────────────────
   assignment · overhaul conflict hints
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const D = window.ITO_DATA;

  function S() { return window.ITO.state || {}; }
  function U() { return window.ITO.ui; }
  function today() { return (D.meta && D.meta.today) || ''; }
  function noAuth(auth) {
    return !auth || auth === '无需授权' || auth === '—' || auth === '-';
  }

  function dateOnly(value) {
    const text = String(value == null ? '' : value);
    const m = text.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }

  function utc(key) {
    const parts = String(key || '').slice(0, 10).split('-').map(Number);
    if (parts.length !== 3 || !parts[0]) return NaN;
    return Date.UTC(parts[0], parts[1] - 1, parts[2]);
  }

  function addDays(key, n) {
    const base = utc(key);
    if (!base) return '';
    const date = new Date(base + n * 86400000);
    return date.toISOString().slice(0, 10);
  }

  function diffDays(a, b) {
    const ua = utc(a);
    const ub = utc(b);
    if (!ua || !ub) return 0;
    return Math.round((ua - ub) / 86400000);
  }

  function mmdd(key) {
    return key ? key.slice(5).replace('-', '/') : '待定';
  }

  function ownersOf(value) {
    return String(value || '').split(/[、,，/]/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function isHighRisk(item) {
    return item.prio === '高' || item.risk === '风险';
  }

  function itemPeriod(item) {
    const start = dateOnly(item.start);
    const due = dateOnly(item.due);
    const node = due || start;
    return {
      item: item,
      start: start || (due ? addDays(due, -7) : ''),
      end: due || start,
      due: due,
      node: node,
      unknown: !node,
      highRisk: isHighRisk(item),
      overdue: !!(due && due < today())
    };
  }

  function itemsOf(name) {
    return (D.overhaul && D.overhaul.items ? D.overhaul.items : [])
      .filter(function (item) {
        return item.status !== '已完成' && ownersOf(item.owner).indexOf(name) > -1;
      })
      .map(itemPeriod)
      .sort(function (a, b) {
        if (a.unknown !== b.unknown) return a.unknown ? 1 : -1;
        if (a.node !== b.node) return String(a.node).localeCompare(String(b.node));
        return (b.highRisk ? 1 : 0) - (a.highRisk ? 1 : 0);
      });
  }

  function summaryOf(name) {
    const items = itemsOf(name);
    const staff = (S().staff || []).find(function (p) { return p.name === name; });
    const core = !!(staff && (staff.tags || []).indexOf('核心岗') > -1);
    const highRisk = items.filter(function (x) { return x.highRisk; });
    const future = items.filter(function (x) { return x.node && x.node >= today(); });
    const future60High = highRisk.filter(function (x) {
      return x.node && x.node >= today() && x.node <= addDays(today(), 60);
    }).length;
    const future90Count = future.filter(function (x) {
      return x.node <= addDays(today(), 90);
    }).length;
    const overdueCount = items.filter(function (x) { return x.overdue; }).length;
    const nearest = future[0] || items[0] || null;
    const isKey = items.length > 0 && (core || future60High > 0 || future90Count >= 3);
    const parts = [];
    if (core) parts.push('核心岗');
    parts.push('大修 ' + items.length + ' 项');
    if (future60High) parts.push('未来60天高优/风险 ' + future60High + ' 项');
    if (overdueCount) parts.push('已超期 ' + overdueCount + ' 项');
    if (nearest && nearest.node) parts.push('最近节点 ' + mmdd(nearest.node));
    return {
      name: name,
      items: items,
      count: items.length,
      highRiskCount: highRisk.length,
      future60High: future60High,
      future90Count: future90Count,
      overdueCount: overdueCount,
      nearest: nearest,
      isKey: isKey,
      chip: isKey ? '大修关键 · ' + items.length + ' 项' : '大修 ' + items.length + ' 项',
      basis: parts.join(' · ')
    };
  }

  function analyze(options, skipAlternatives) {
    const opts = options || {};
    const summary = summaryOf(opts.name);
    const due = dateOnly(opts.due);
    const currentStart = today();
    const currentEnd = due && due > currentStart ? due : currentStart;
    const conflicts = [];
    const seen = {};
    let red = false;
    let yellow = false;

    summary.items.forEach(function (p) {
      if (p.unknown) return;
      let kind = '';
      if (p.due && p.due < currentStart) {
        kind = 'overdue';
        red = true;
      } else if (p.start && p.end && p.start <= currentEnd && p.end >= currentStart) {
        kind = p.highRisk ? 'overlap-high' : 'overlap-normal';
        if (p.highRisk) red = true;
        else yellow = true;
      } else if (p.highRisk && p.due && p.due >= currentEnd && diffDays(p.due, currentEnd) <= 7) {
        kind = 'near-high';
        red = true;
      }
      if (!kind) return;
      const key = p.item.seq + '|' + kind;
      if (seen[key]) return;
      seen[key] = true;
      conflicts.push({
        item: p.item,
        node: p.node,
        due: p.due,
        highRisk: p.highRisk,
        kind: kind
      });
    });

    const level = red ? 'red' : yellow ? 'yellow' : 'none';
    const dated = conflicts.filter(function (c) { return c.node; });
    const priority = dated.filter(function (c) { return c.highRisk; });
    const pickPool = priority.length ? priority : dated;
    const latest = pickPool.slice().sort(function (a, b) { return String(a.node).localeCompare(String(b.node)); }).pop();
    let suggestedDate = latest ? addDays(latest.node, 1) : '';
    if (suggestedDate && suggestedDate < addDays(today(), 1)) suggestedDate = addDays(today(), 1);

    const load = window.ITO.assigneeInfo
      ? window.ITO.assigneeInfo(opts.name, opts.auth, opts.hours, opts.due)
      : null;

    const fit = {
      level: level,
      summary: summary,
      conflicts: conflicts,
      conflictCount: conflicts.length,
      currentStart: currentStart,
      currentEnd: currentEnd,
      load: load,
      authOk: load ? load.authOk : true,
      suggestedDate: suggestedDate,
      suggestedItem: latest ? latest.item : null,
      alternatives: { list: [], noAlt: false, allBusy: false }
    };

    if (!skipAlternatives) {
      fit.alternatives = alternativesOf(opts, fit);
    }
    return fit;
  }

  function alternativesOf(options, fit) {
    const st = S();
    const groupId = options.group;
    const group = (st.groups || []).find(function (g) { return g.id === groupId; }) || {};
    const manager = group.manager;
    const seen = {};
    const candidates = [];
    (st.staff || []).forEach(function (p) {
      if (p.group !== groupId || p.name === options.name) return;
      if (seen[p.name]) return;
      seen[p.name] = true;
      candidates.push(p);
    });
    if (manager && manager !== options.name && !seen[manager]) {
      const mp = (st.staff || []).find(function (p) { return p.name === manager; });
      if (mp) candidates.push(mp);
    }
    const auth = options.auth || '无需授权';
    const eligible = candidates.filter(function (p) {
      return noAuth(auth) || !window.ITO.hasAuth || window.ITO.hasAuth(p.name, auth);
    });
    const ranked = eligible.map(function (p) {
      const cand = analyze({
        name: p.name,
        group: groupId,
        auth: auth,
        hours: options.hours,
        due: options.due
      }, true);
      return { person: p, fit: cand, weekRate: cand.load ? cand.load.weekRate : 0 };
    }).sort(function (a, b) {
      if (a.fit.conflictCount !== b.fit.conflictCount) return a.fit.conflictCount - b.fit.conflictCount;
      if (a.weekRate !== b.weekRate) return a.weekRate - b.weekRate;
      return a.person.name.localeCompare(b.person.name, 'zh');
    });
    const list = ranked.slice(0, 2).map(function (entry) {
      const fit2 = entry.fit;
      const near = fit2.summary.nearest;
      const oh = fit2.summary.count
        ? '大修 ' + fit2.summary.count + ' 项' + (near && near.node ? '（' + mmdd(near.node) + (near.highRisk ? ' 高优' : ' 普通') + '）' : '')
        : '无大修任务';
      return {
        name: entry.person.name,
        relation: entry.person.name === manager ? '组主管' : '同组',
        auth: noAuth(auth) ? '无需授权' : '持' + auth,
        overhaul: oh,
        conflictCount: fit2.conflictCount
      };
    });
    return {
      list: list,
      noAlt: !eligible.length,
      allBusy: !!(eligible.length && list.length && list.every(function (x) { return x.conflictCount > 0; }))
    };
  }

  function conflictLine(fit) {
    if (!fit.conflicts.length) return '';
    const first = fit.conflicts[0];
    const range = fit.currentStart + '–' + fit.currentEnd;
    if (first.kind === 'overdue') {
      return '该人员有大修任务已超期，当前任务 ' + range + ' 可能进一步挤占大修处置时间。';
    }
    if (first.kind === 'near-high') {
      return '当前任务截止 ' + mmdd(fit.currentEnd) + '，距「' + first.item.name + '」高优节点 ' + mmdd(first.node) + ' 不足 7 天。';
    }
    return '当前任务 ' + range + ' 与「' + first.item.name + '」' + mmdd(first.node) + ' 节点重叠。';
  }

  function panelHtml(fit, options) {
    const opts = options || {};
    if (!fit || fit.level === 'none') return '';
    const allowPick = opts.allowPick !== false;
    const red = fit.level === 'red';
    const list = fit.summary.items.slice(0, 3).map(function (p) {
      const tags = [];
      if (p.highRisk) tags.push('高优');
      if (p.item.risk === '风险') tags.push('风险');
      if (p.overdue) tags.push('已超期');
      return '<li><b>' + U().esc(mmdd(p.node)) + '</b><span>' + U().esc(p.item.name) + '</span>' +
        (tags.length ? '<em>' + U().esc(tags.join(' / ')) + '</em>' : '') + '</li>';
    }).join('');
    const alts = allowPick ? fit.alternatives.list.map(function (alt) {
      return '<button class="btn btn-soft btn-sm" type="button" data-assign-pick="' + U().esc(alt.name) + '">' +
        U().esc(alt.name) + ' · ' + U().esc(alt.relation) + ' · ' + U().esc(alt.auth) + ' · ' + U().esc(alt.overhaul) + '</button>';
    }).join('') : '';
    const altNote = allowPick
      ? (fit.alternatives.noAlt
        ? '<div class="assign-fit-note">本组无同资质替代人，建议调整截止时间或协调支援。</div>'
        : fit.alternatives.allBusy
          ? '<div class="assign-fit-note">本组同资质人员均承担大修任务，改派空间有限。</div>'
          : '')
      : '';
    const currentDue = fit.currentEnd ? String(fit.currentEnd).slice(0, 10) : '';
    const dueBtn = fit.suggestedDate && opts.allowDue !== false && (!currentDue || fit.suggestedDate > currentDue)
      ? '<button class="btn btn-ghost btn-sm" type="button" data-assign-due="' + U().esc(fit.suggestedDate) + '">' +
        '建议截止 ' + U().esc(mmdd(fit.suggestedDate)) + (fit.suggestedItem ? '（避开「' + U().esc(fit.suggestedItem.name) + '」）' : '') + '</button>'
      : '';
    const load = fit.load
      ? '<div class="assign-fit-load">参考负荷：本周 ' + fit.load.weekRate + '% → ' + fit.load.weekAfter + '% · 本月 ' +
        fit.load.monthRate + '% → ' + fit.load.monthAfter + '% · ' + (fit.authOk ? '授权匹配' : '缺少授权') + '</div>'
      : '';
    return '<div class="assign-fit ' + (red ? 'is-danger' : 'is-warn') + '">' +
      '<div class="assign-fit-head"><span class="assign-fit-badge">' + (red ? '冲突' : '需关注') + '</span>' +
        '<b>后续大修专项</b><span class="assign-fit-key">' + (fit.summary.isKey ? '大修关键人员' : '大修参与人') + '</span></div>' +
      '<div class="assign-fit-basis">' + U().esc(fit.summary.basis) + '</div>' +
      '<div class="assign-fit-desc">' + U().esc(conflictLine(fit)) + '</div>' +
      (list ? '<ul class="assign-fit-list">' + list + '</ul>' : '') +
      load +
      ((alts || altNote) ? '<div class="assign-fit-actions">' + alts + altNote + '</div>' : '') +
      (dueBtn ? '<div class="assign-fit-actions">' + dueBtn + '</div>' : '') +
    '</div>';
  }

  function bindAssignPanel(root, getFit, handlers) {
    if (!root) return;
    const h = handlers || {};
    Array.prototype.forEach.call(root.querySelectorAll('[data-assign-pick]'), function (btn) {
      btn.addEventListener('click', function () {
        if (h.onPick) h.onPick(btn.dataset.assignPick);
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-assign-due]'), function (btn) {
      btn.addEventListener('click', function () {
        if (h.onDue) h.onDue(btn.dataset.assignDue);
      });
    });
  }

  function confirmAssignment(fits, options) {
    const opts = options || {};
    const list = (Array.isArray(fits) ? fits : [fits]).filter(function (f) { return f && f.level === 'red'; });
    if (!list.length) {
      if (opts.onConfirm) opts.onConfirm();
      return;
    }
    const body = list.map(function (fit) {
      const items = fit.summary.items.slice(0, 4).map(function (p) {
        const tags = [];
        if (p.highRisk) tags.push('高优');
        if (p.item.risk === '风险') tags.push('风险');
        if (p.overdue) tags.push('已超期');
        return '<li><b>' + U().esc(mmdd(p.node)) + '</b> ' + U().esc(p.item.name) +
          (tags.length ? ' · ' + U().esc(tags.join(' / ')) : '') + '</li>';
      }).join('');
      const load = fit.load
        ? '<div class="assign-fit-load">参考负荷：本周 ' + fit.load.weekRate + '% → ' + fit.load.weekAfter + '% · 本月 ' +
          fit.load.monthRate + '% → ' + fit.load.monthAfter + '% · ' + (fit.authOk ? '授权匹配' : '缺少授权') + '</div>'
        : '';
      return '<div class="detail-section"><h4>' + U().esc(fit.summary.name) + ' · ' + U().esc(fit.summary.basis) + '</h4>' +
        '<p style="margin:0 0 8px">' + U().esc(conflictLine(fit)) + '</p>' +
        '<ul style="margin:0 0 8px;padding-left:18px">' + items + '</ul>' + load +
        '</div>';
    }).join('');
    U().modal({
      title: list.length > 1 ? list.length + ' 名执行人存在大修冲突' : '大修冲突确认',
      sub: opts.sub || '仍可继续派发，确认后进入后续流程',
      body: body,
      foot: '<button class="btn btn-ghost" data-close type="button">返回调整</button>' +
        '<button class="btn btn-primary" data-ok type="button">' + U().esc(opts.okText || '仍要派发') + '</button>',
      onMount: function (close, root) {
        root.querySelector('[data-close]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', function () {
          close();
          if (opts.onConfirm) opts.onConfirm();
        });
      }
    });
  }

  window.ITO.overhaulSummaryOf = summaryOf;
  window.ITO.overhaulSummaryMap = function () {
    const map = {};
    (S().staff || []).forEach(function (p) { map[p.name] = summaryOf(p.name); });
    return map;
  };
  window.ITO.assignmentFit = function (options) { return analyze(options, false); };
  window.ITO.assignPanelHtml = panelHtml;
  window.ITO.bindAssignPanel = bindAssignPanel;
  window.ITO.confirmAssignment = confirmAssignment;
})();
