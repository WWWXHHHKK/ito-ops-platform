/* ─────────────────────────────────────────────
   page · personal stats & monthly report
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const P = (window.ITO_PAGES = window.ITO_PAGES || {});
  const D = window.ITO_DATA;

  function S() { return ITO.state; }
  function U() { return ITO.ui; }

  function monthKey() {
    return String(D.meta.today || '').slice(0, 7);
  }

  function monthLabel() {
    const d = new Date(String(D.meta.today).replace(/-/g, '/'));
    if (isNaN(d.getTime())) return monthKey();
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月';
  }

  function mySubs() {
    const st = S();
    const key = monthKey();
    const out = [];
    st.tasks.forEach(function (t) {
      if (t.canceled || t.draft) return;
      t.subs.forEach(function (s) {
        if (s.owner !== st.user.name) return;
        if (String(s.due || '').slice(0, 7) !== key) return;
        if (s.status === '已取消') return;
        out.push({ task: t, sub: s });
      });
    });
    return out.sort(function (a, b) {
      return String(a.sub.due).localeCompare(String(b.sub.due));
    });
  }

  function myGroup() {
    const st = S();
    const me = st.staff.find(function (p) { return p.name === st.user.name; });
    const direct = me ? st.groups.find(function (g) { return g.id === me.group; }) : null;
    return direct || st.groups.find(function (g) { return g.manager === st.user.name; }) || null;
  }

  function scopeSubs() {
    const st = S();
    const key = monthKey();
    const group = myGroup();
    const out = [];
    st.tasks.forEach(function (t) {
      if (t.canceled || t.draft) return;
      t.subs.forEach(function (s) {
        if (String(s.due || '').slice(0, 7) !== key) return;
        if (s.status === '已取消') return;
        if (st.role === 'leader' || st.role === 'super') {
          // 领导层查看整体当月任务
        } else if (st.role === 'manager') {
          if (!group || s.group !== group.id) return;
        } else if (s.owner !== st.user.name) {
          return;
        }
        out.push({ task: t, sub: s });
      });
    });
    return out.sort(function (a, b) { return String(a.sub.due).localeCompare(String(b.sub.due)); });
  }

  function model() {
    const st = S();
    const items = scopeSubs();
    const done = items.filter(function (x) { return x.sub.status === '已完成'; });
    const overdue = items.filter(function (x) { return U().isOverdue(x.sub) || U().isLateClosed(x.sub); });
    const doing = items.filter(function (x) {
      return x.sub.status !== '已完成' && x.sub.status !== '已取消';
    });
    const allTags = (st.personAchievements || []).filter(function (a) { return a.person === st.user.name; });
    const personTags = allTags.filter(function (a) { return a.type === '人员标签'; }).map(function (a) {
      const wall = (st.wallTags || []).find(function (t) { return t.name === a.name && t.type === '人员标签'; });
      return Object.assign({}, a, { stars: a.source === '授权' ? 3 : U().starForCount(a.count, wall && wall.star2, wall && wall.star3) });
    });
    const taskTagCounts = {};
    const allowedTaskTags = {};
    (D.taskTags || []).forEach(function (name) { allowedTaskTags[name] = true; });
    items.forEach(function (x) {
      const tags = (x.sub.tags || []).concat(x.task.tags || []);
      tags.forEach(function (name) {
        if (!allowedTaskTags[name]) return;
        taskTagCounts[name] = (taskTagCounts[name] || 0) + 1;
      });
    });
    allTags.filter(function (a) { return a.type === '任务标签'; }).forEach(function (a) {
      if (!allowedTaskTags[a.name]) return;
      taskTagCounts[a.name] = Math.max(taskTagCounts[a.name] || 0, a.count || 0);
    });
    const taskTags = Object.keys(taskTagCounts).map(function (name) {
      return { person: st.user.name, name: name, type: '任务标签', count: taskTagCounts[name], source: '任务' };
    }).sort(function (a, b) { return (b.count || 0) - (a.count || 0); });
    return {
      items: items,
      total: items.length,
      done: done.length,
      doing: doing.length,
      overdue: overdue.length,
      rate: items.length ? Math.round(done.length / items.length * 1000) / 10 : 0,
      personTags: personTags,
      taskTags: taskTags
    };
  }

  function stars(n) {
    const value = Math.max(0, Math.min(3, Number(n) || 0));
    return '<span class="stars">' + '★'.repeat(value) + '<span class="star-off">' + '★'.repeat(3 - value) + '</span></span>';
  }

  function tagCard(tag) {
    const isPerson = tag.type === '人员标签';
    const mark = isPerson
      ? (tag.source === '授权' ? '<span class="auth-mark">授权</span>' : stars(tag.stars))
      : '<span class="task-tag-count">完成 ' + tag.count + ' 次</span>';
    return '<div class="personal-tag ' + (isPerson ? 'person' : 'task') + '" role="button" tabindex="0" data-tag-name="' + U().esc(tag.name) + '" data-tag-type="' + U().esc(tag.type) + '">' +
      '<b>' + U().esc(tag.name) + '</b>' + mark +
    '</div>';
  }

  function openPersonalTag(tag) {
    const st = S();
    const wall = (st.wallTags || []).find(function (t) { return t.name === tag.name && t.type === tag.type; });
    const isPerson = tag.type === '人员标签';
    const isAuth = tag.source === '授权';
    const rows = [
      ['标签名称', tag.name],
      ['标签类型', tag.type],
      ['来源', isAuth ? '授权' : (isPerson ? '能力评定' : '任务完成')]
    ];
    if (isPerson) {
      rows.push([isAuth ? '标签标识' : '星级', isAuth ? '<span class="auth-mark">授权</span>' : stars(tag.stars)]);
      if (!isAuth) {
        rows.push(['累计次数', (tag.count || 0) + ' 次']);
        rows.push(['首次领取', tag.firstClaimed || '—']);
      }
    } else {
      rows.push(['完成次数', (tag.count || 0) + ' 次']);
    }
    rows.push(['描述', tag.desc || (wall && wall.desc) || '—']);
    rows.push(['解锁条件', isAuth ? '取得对应授权后自动获得该标签' : ((wall && wall.unlock) || '—')]);
    if (isPerson && !isAuth) {
      rows.push(['升星规则', '默认 5 次升 2 星、10 次升 3 星' + (wall && wall.star2 != null ? '；当前标签：' + wall.star2 + ' / ' + wall.star3 + ' 次' : '')]);
    }
    if (isAuth) rows.push(['领取规则', '取得对应授权即默认授权，不记录次数与首次领取时间']);
    U().detailModal({
      title: tag.name,
      sub: tag.type + (isAuth ? ' · 授权' : ''),
      body: '<div class="detail-section"><div class="table-wrap"><table class="data-table"><tbody>' +
        rows.map(function (r) {
          const htmlRow = r[0] === '星级' || r[0] === '标签标识';
          return '<tr><td>' + U().esc(r[0]) + '</td><td>' + (htmlRow ? r[1] : U().esc(r[1])) + '</td></tr>';
        }).join('') +
      '</tbody></table></div></div>',
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
      onMount: function (close, root) { root.querySelector('[data-close]').addEventListener('click', close); }
    });
  }

  function kpi(label, value, unit, meta, tone, icon) {
    return '<article class="card kpi-card" data-tone="' + (tone || '') + '">' +
      '<div class="kpi-label">' + U().icon(icon) + '<span>' + label + '</span></div>' +
      '<div class="kpi-value">' + value + (unit ? '<span class="unit">' + unit + '</span>' : '') + '</div>' +
      '<div class="kpi-meta">' + meta + '</div>' +
    '</article>';
  }

  function rowsHtml(m) {
    if (!m.items.length) {
      return '<tr><td colspan="9">' + U().emptyState(
        '当前没有符合条件的当月任务',
        '调整月份或统计范围后再查看',
        'task'
      ) + '</td></tr>';
    }
    return m.items.map(function (x) {
      const s = x.sub;
      return '<tr class="personal-task-row" data-task="' + U().esc(x.task.id) + '" data-sub="' + U().esc(s.id) + '">' +
        '<td><div class="cell-task"><b>' + U().esc(s.name) + '</b><small>' + U().esc(x.task.name) + '</small></div></td>' +
        '<td>' + U().groupPill(s.group || x.task.group) + '</td>' +
        '<td>' + U().esc(s.owner || '—') + '</td>' +
        '<td class="mono">' + U().esc(s.id) + '</td>' +
        '<td>' + U().esc(s.type || x.task.type || '—') + '</td>' +
        '<td>' + U().badge(s.level || x.task.level) + '</td>' +
        '<td class="num">' + (s.hours || 0) + ' h</td>' +
        '<td class="num" style="white-space:nowrap">' + U().esc(s.due || '—') + '</td>' +
        '<td>' + U().badge(U().isOverdue(s) ? '超期' : s.status) + '</td>' +
      '</tr>';
    }).join('');
  }

  function tagsHtml(m) {
    const role = S().role;
    if (role === 'leader' || role === 'super') return '';
    const count = m.personTags.length + m.taskTags.length;
    return '<section class="card personal-tags-card">' +
      '<div class="table-head"><div><h3>我的属性勋章</h3>' +
        '<p class="table-note">人员标签按能力评定 1–3 星，任务标签按当月任务与历史完成次数聚合</p></div>' +
        '<span class="table-note">' + count + ' 项</span></div>' +
      '<div class="personal-tag-groups">' +
        '<div class="personal-tag-group">' +
          '<div class="personal-tag-head"><h2>人员标签</h2><span>' + m.personTags.length + ' 项</span></div>' +
          '<div class="personal-tag-grid">' +
            (m.personTags.length ? m.personTags.map(tagCard).join('') : '<div class="mini-empty">暂无人员标签</div>') +
          '</div>' +
        '</div>' +
        '<div class="personal-tag-group">' +
          '<div class="personal-tag-head"><h2>任务标签</h2><span>' + m.taskTags.length + ' 项</span></div>' +
          '<div class="personal-tag-grid">' +
            (m.taskTags.length ? m.taskTags.map(tagCard).join('') : '<div class="mini-empty">暂无任务标签</div>') +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function reportDocument() {
    const st = S();
    const m = model();
    const group = myGroup();
    const E = U().esc;
    const taskRows = m.items.map(function (x) {
      return '<tr><td>' + E(x.sub.name) + '</td><td>' + E(x.sub.id) + '</td><td>' + E(x.sub.type || x.task.type) +
        '</td><td>' + E(x.sub.level || x.task.level) + '</td><td>' + (x.sub.hours || 0) + ' h</td><td>' +
        E(x.sub.due) + '</td><td>' + E(U().isOverdue(x.sub) ? '超期' : x.sub.status) + '</td></tr>';
    }).join('');

    const personTags = m.personTags.map(function (a) {
      const mark = a.source === '授权'
        ? '<em class="auth-mark">授权</em>'
        : '<span class="stars">' + '★'.repeat(Math.max(0, Math.min(3, a.stars))) + '</span>';
      return '<span class="tag"><b>' + E(a.name) + '</b>' + mark + '</span>';
    }).join('');

    const taskTags = m.taskTags.map(function (a) {
      return '<span class="tag"><b>' + E(a.name) + '</b><em>完成 ' + a.count + ' 次</em></span>';
    }).join('');

    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>ITO 个人月报 · ' + E(st.user.name) + ' · ' + E(monthLabel()) + '</title>' +
      '<style>body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#1D1D1F;margin:0;padding:44px;background:#F5F4F2}' +
      '.sheet{max-width:980px;margin:0 auto;background:#fff;border-radius:18px;padding:46px 50px;box-shadow:0 20px 60px rgba(0,0,0,.08)}' +
      'h1{font-size:28px;margin:0;letter-spacing:-.02em}h2{font-size:15px;margin:32px 0 12px;padding-bottom:8px;border-bottom:1px solid #eee}' +
      '.sub{color:#8A8A8E;font-size:12px;margin-top:8px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:24px}' +
      '.kpi{background:#FFF7F2;border:1px solid #FFE2D2;border-radius:12px;padding:15px}.kpi b{display:block;font-size:25px;letter-spacing:-.03em}' +
      '.kpi span{display:block;font-size:10px;color:#8A8A8E;margin-top:4px}.tag{display:inline-flex;align-items:center;gap:6px;margin:0 8px 8px 0;padding:7px 10px;border:1px solid #eee;border-radius:999px;font-size:12px}' +
      '.tag b{font-weight:650}.tag em{font-style:normal;font-size:10px;color:#8A8A8E}.tag .stars{color:#EB612A;letter-spacing:1px}' +
      'table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;color:#8A8A8E;font-weight:600;padding:9px 10px;background:#F7F6F4;border-bottom:1px solid #eee}' +
      'td{padding:9px 10px;border-bottom:1px solid #f1f1f1;color:#4A4A4F}.foot{margin-top:36px;font-size:10px;color:#AEAEB2;display:flex;justify-content:space-between}' +
      '</style></head><body><div class="sheet">' +
      '<h1>个人运维月报</h1><div class="sub">' + E(st.user.name) + ' · ' + E(group ? group.name : '运维中心') + ' · ' + E(st.user.title) +
        ' · ' + E(monthLabel()) + ' · 生成于 ' + E(D.meta.today) + '</div>' +
      '<div class="kpis"><div class="kpi"><b>' + m.total + '</b><span>当月总任务</span></div>' +
      '<div class="kpi"><b>' + m.done + '</b><span>已完成</span></div>' +
      '<div class="kpi"><b>' + m.doing + '</b><span>执行中</span></div>' +
      '<div class="kpi"><b>' + m.overdue + '</b><span>超期</span></div></div>' +
      '<h2>个人属性勋章</h2><div>' + (personTags || '<span class="sub">暂无人员标签</span>') + '</div>' +
      (taskTags ? '<div style="margin-top:8px">' + taskTags + '</div>' : '') +
      '<h2>当月任务</h2><table><thead><tr><th>任务名称</th><th>任务UID</th><th>任务类型</th><th>任务等级</th><th>预估工时</th><th>截止时间</th><th>状态</th></tr></thead><tbody>' +
      (taskRows || '<tr><td colspan="7">本月暂无任务</td></tr>') + '</tbody></table>' +
      '<div class="foot"><span>ITO 运维中心 · 个人月报</span><span>演示数据，仅用于产品演示</span></div>' +
      '</div></body></html>';
  }

  function openReport() {
    const st = S();
    const html = reportDocument();
    U().modal({
      title: '个人月报 · ' + monthLabel(),
      sub: st.user.name + ' · ' + (myGroup() ? myGroup().name : '运维中心') + ' · ' + st.user.title,
      wide: true,
      body: '<iframe class="report-frame" title="个人月报预览"></iframe>',
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button><span class="spacer"></span>' +
        '<button class="btn btn-primary" data-export type="button">' + U().icon('download') + '导出月报</button>',
      onMount: function (close, root) {
        const frame = root.querySelector('.report-frame');
        if (frame) frame.srcdoc = html;
        root.querySelector('[data-close]').addEventListener('click', close);
        root.querySelector('[data-export]').addEventListener('click', function () {
          U().exportPreview({ title: '个人月报导出预览', html: html, filename: 'ITO个人月报-' + st.user.name + '-' + monthKey() + '.html' });
          ITO.log('导出个人月报', st.user.name + ' · ' + monthLabel(), '报表');
          U().toast('个人月报已导出');
        });
      }
    });
  }

  /* ── report center · scopes & filters ───── */
  function monthChoices() {
    const base = new Date(String(D.meta.today).replace(/-/g, '/'));
    base.setDate(1);
    const out = [];
    for (let i = 0; i < 5; i += 1) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      out.push({ key: key, label: d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月' });
    }
    return out;
  }

  function scopeDefs() {
    const role = S().role;
    if (role === 'super') {
      return [{ id: 'group', name: '专业组月报' }, { id: 'employee', name: '员工月报' }];
    }
    if (role === 'manager') {
      return [{ id: 'me', name: '我的月报' }, { id: 'group', name: '本组月报' }, { id: 'person', name: '组员月报' }];
    }
    if (role === 'leader') {
      return [{ id: 'initiated', name: '个人月报' }, { id: 'group', name: '专业组月报' }, { id: 'employee', name: '员工月报' }];
    }
    return [{ id: 'me', name: '我的月报' }];
  }

  function archiveAsItem(item) {
    return {
      task: {
        id: item.taskId || item.id,
        name: item.task,
        group: item.group,
        type: item.type,
        level: item.level,
        tags: item.tags || [],
        initiator: item.initiator || '',
        source: 'archive'
      },
      sub: {
        id: item.id,
        name: item.name,
        owner: item.owner,
        group: item.group,
        type: item.type,
        level: item.level,
        hours: item.hours || 0,
        due: item.due || item.completedAt,
        completedAt: item.completedAt,
        status: '已完成',
        tags: item.tags || [],
        progress: 100
      }
    };
  }

  function collectReport(scope, opts) {
    const st = S();
    if (scope === 'person' && st.role === 'manager') {
      const group = myGroup();
      const target = st.staff.find(function (p) { return p.name === opts.person; });
      if (!group || !target || target.group !== group.id) {
        return { items: [], total: 0, done: 0, overdue: 0, doing: 0 };
      }
    }
    const items = [];
    const groupId = opts.group || '';
    const useArchive = String(opts.month) < monthKey();
    const addArchive = function () {
      (D.personalArchive || []).forEach(function (a) {
        if (String(a.completedAt || '').slice(0, 7) !== opts.month) return;
        if (scope === 'me' && a.owner !== st.user.name) return;
        if (scope === 'person' && a.owner !== opts.person) return;
        if (scope === 'employee' && a.owner !== opts.person) return;
        if (scope === 'group' && groupId && a.group !== groupId) return;
        if (scope === 'initiated' && a.initiator !== st.user.name) return;
        items.push(archiveAsItem(a));
      });
    };
    if (useArchive) {
      addArchive();
    } else {
      st.tasks.forEach(function (t) {
        if (t.canceled || t.draft) return;
        t.subs.forEach(function (s) {
          if (String(s.due || '').slice(0, 7) !== opts.month) return;
          if (s.status === '已取消') return;
          if (scope === 'me' && s.owner !== st.user.name) return;
          if (scope === 'person' && s.owner !== opts.person) return;
          if (scope === 'employee' && s.owner !== opts.person) return;
          if (scope === 'group' && groupId && s.group !== groupId) return;
          if (scope === 'initiated' && t.initiator !== st.user.name) return;
          items.push({ task: t, sub: s });
        });
      });
      /* 当月某些员工没有任务时，用历史归档兜底，避免员工月报空白。 */
      if (!items.length) addArchive();
    }
    items.sort(function (a, b) {
      return String(a.sub.completedAt || a.sub.due).localeCompare(String(b.sub.completedAt || b.sub.due));
    });
    const done = items.filter(function (x) { return x.sub.status === '已完成'; });
    const overdue = items.filter(function (x) { return U().isOverdue(x.sub) || U().isLateClosed(x.sub); });
    return { items: items, total: items.length, done: done.length, overdue: overdue.length, doing: items.length - done.length };
  }

  function reportAiHtml(scope, opts, m, prev, medals, personName, group, month) {
    const engine = window.ITO.aiReport;
    if (!engine || !engine.build) return '';
    const overdueItems = (m.items || []).filter(function (x) {
      return U().isOverdue(x.sub) || U().isLateClosed(x.sub);
    });
    const ai = engine.build({
      scope: scope,
      month: opts.month,
      monthLabel: month,
      personName: personName,
      groupName: group ? group.name : '',
      m: m,
      prev: prev,
      overdueItems: overdueItems,
      medals: medals,
      variant: Number(opts.aiVariant) || 0
    });
    return '<section class="ai-read">' +
      '<div class="ai-head"><b>AI 月报解读</b><span class="ai-chip">AI 生成</span></div>' +
      '<div class="ai-list">' + ai.insights.map(function (item) {
        return '<div class="ai-item"><b>' + U().esc(item.label) + '</b><p>' + U().esc(item.text) + '</p></div>';
      }).join('') + '</div>' +
      '<div class="ai-note">' + U().esc(ai.basis) + ' · ' + U().esc(ai.note) + '</div>' +
      '</section>';
  }

  function reportHtml(scope, opts) {
    const st = S();
    const m = collectReport(scope, opts);
    const E = U().esc;
    const group = opts.group ? ITO.getGroup(opts.group) : null;
    const personName = (scope === 'person' || scope === 'employee') ? opts.person : (scope === 'me' ? st.user.name : '');
    const month = (monthChoices().find(function (x) { return x.key === opts.month; }) || {}).label || opts.month;
    const titleMap = { me: '个人月报', person: '组员月报', employee: '员工月报', group: '专业组月报', initiated: '个人月报' };
    const title = titleMap[scope] || '运维月报';
    const rangeLabel = (scope === 'person' || scope === 'employee') ? (personName || '—') :
      scope === 'group' ? (group ? group.name : '全部专业组') :
      scope === 'initiated' ? st.user.name + '（发起）' : st.user.name;
    const medals = (personName ? (st.personAchievements || []).filter(function (a) {
      return a.person === personName && (a.type === '人员标签' || a.type === '任务标签');
    }) : []);
    const medalStars = function (n) {
      const v = Math.max(1, Math.min(3, Number(n) || 1));
      return '<span class="st">' + '★'.repeat(v) + '<i>' + '★'.repeat(3 - v) + '</i></span>';
    };
    const medalCard = function (a) {
      const isAuth = a.source === '授权';
      const isTask = a.type === '任务标签';
      const note = isAuth ? '授权标签 · 取得授权后自动获得' : isTask
        ? '任务标签 · 累计 ' + (a.count || 0) + ' 次'
        : '累计 ' + (a.count || 0) + ' 次' + (a.firstClaimed ? ' · 首次 ' + E(a.firstClaimed) : '');
      const right = isTask ? '<span class="kind">任务标签</span>' : (isAuth ? '<span class="auth-mark">授权</span>' : medalStars(isAuth ? 3 : a.stars));
      return '<div class="medal' + (isTask ? ' t' : '') + '"><div class="mt"><b>' + E(a.name) + '</b>' + right + '</div><small>' + note + '</small></div>';
    };
    const tableRows = m.items.map(function (x) {
      return '<tr><td>' + E(x.sub.name) + '</td><td>' + E(x.sub.id) + '</td><td>' + E(x.sub.owner) + '</td><td>' + E(x.sub.type || x.task.type) +
        '</td><td>' + E(x.sub.level || x.task.level) + '</td><td>' + (x.sub.hours || 0) + ' h</td><td>' + E(x.sub.due) +
        '</td><td>' + E(U().isOverdue(x.sub) ? '超期' : x.sub.status) + '</td></tr>';
    }).join('');
    const prev = window.ITO.aiReport
      ? collectReport(scope, Object.assign({}, opts, { month: window.ITO.aiReport.shiftMonth(opts.month, -1) }))
      : null;
    const aiHtml = window.ITO.aiReport
      ? reportAiHtml(scope, opts, m, prev, medals, personName, group, month)
      : '';
    const medalsHtml = medals.length
      ? '<h2>属性勋章</h2><div class="medals">' + medals.map(medalCard).join('') + '</div>'
      : '';
    const taskHtml = '<h2>任务明细</h2><div class="detail"><table><thead><tr><th>任务</th><th>UID</th><th>执行人</th><th>类型</th><th>等级</th><th>工时</th><th>截止时间</th><th>状态</th></tr></thead><tbody>' +
      (tableRows || '<tr><td colspan="8">当前筛选暂无任务</td></tr>') + '</tbody></table></div>';
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>ITO ' + E(title) + ' · ' + E(month) + '</title>' +
      '<style>body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#1D1D1F;margin:0;padding:40px;background:#F5F4F2}' +
      '.sheet{max-width:1000px;margin:0 auto;background:#fff;border-radius:18px;padding:42px 46px;box-shadow:0 20px 60px rgba(0,0,0,.08)}' +
      'h1{font-size:26px;margin:0;letter-spacing:-.02em}h2{font-size:14px;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #eee}' +
      '.sub{color:#8A8A8E;font-size:12px;margin-top:8px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:22px}' +
      '.kpi{background:#fff;border:1px solid #F0E7DF;border-top:3px solid #EB612A;border-radius:10px;padding:14px 16px}.kpi b{display:block;font-size:22px;letter-spacing:-.01em}.kpi span{display:block;font-size:10px;color:#8A8A8E;margin-top:4px}' +
      '.kpi.g{border-top-color:#1FAE5C}.kpi.g b{color:#1FAE5C}.kpi.b{border-top-color:#0A72E8}.kpi.b b{color:#0A72E8}.kpi.r{border-top-color:#CF4B18}.kpi.r b{color:#CF4B18}' +
      '.ai-read{background:linear-gradient(135deg,#FFF8F3,#FFFDFB);border:1px solid #F3E2D6;border-left:3px solid #EB612A;border-radius:12px;padding:14px 18px 12px;margin:16px 0 2px}' +
      '.ai-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}.ai-head b{font-size:13px;letter-spacing:.01em}' +
      '.ai-chip{display:inline-flex;align-items:center;height:18px;padding:0 7px;border-radius:5px;background:#FFF0E7;color:#C2501C;font-size:9px;font-weight:650;letter-spacing:.04em}' +
      '.ai-item{display:grid;grid-template-columns:64px 1fr;gap:10px;padding:6px 0;border-top:1px dashed rgba(235,97,42,.14)}' +
      '.ai-list .ai-item:first-child{border-top:0}' +
      '.ai-item b{font-size:10px;color:#C2501C;font-weight:650;line-height:1.6;white-space:nowrap}' +
      '.ai-item p{margin:0;font-size:11px;line-height:1.7;color:#4A4A4F}' +
      '.ai-note{font-size:9.5px;color:#AEAEB2;margin-top:2px}' +
      '.medals{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}' +
      '.medal{background:linear-gradient(145deg,#FFF8F3,#FFF4EC);border:1px solid rgba(235,97,42,.14);border-radius:10px;padding:12px 14px}' +
      '.medal .mt{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.medal .mt b{font-size:12.5px}' +
      '.medal .st{color:#EB612A;font-size:10px;letter-spacing:1px;white-space:nowrap}.medal .st i{font-style:normal;color:rgba(29,29,31,.15)}' +
      '.medal small{display:block;font-size:10.5px;color:#8A8A8E;margin-top:5px}' +
      '.medal.t{background:linear-gradient(145deg,#F5F9FF,#EDF4FE);border-color:rgba(10,114,232,.14)}.medal.t .st{color:#0A72E8}.medal .kind{font-size:9px;color:#0A72E8;letter-spacing:.06em}' +
      '.medal .auth-mark,.tag .auth-mark{display:inline-flex;align-items:center;height:17px;padding:0 6px;border-radius:5px;background:#FFF0E7;color:#C2501C;font-size:9px;font-weight:650;font-style:normal;white-space:nowrap}' +
      'table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}' +
      'th{text-align:center;color:#8A8A8E;font-weight:600;padding:8px 9px;background:#F7F6F4;border-bottom:1px solid #eee}th:first-child{text-align:left}' +
      'td{padding:8px 9px;border-bottom:1px solid #f1f1f1;color:#4A4A4F;text-align:center}td:first-child{text-align:left}.foot{margin-top:30px;font-size:10px;color:#AEAEB2;display:flex;justify-content:space-between}' +
      (opts.fixed ?
        'html,body{height:100%}body{padding:0;box-sizing:border-box;overflow:hidden}' +
        '.sheet{max-width:none;width:100%;height:100%;box-sizing:border-box;padding:26px 30px 18px;display:flex;flex-direction:column;border-radius:0;box-shadow:none;overflow:hidden}' +
        '.report-body{flex:1 1 auto;min-height:0;overflow:auto;padding-right:6px}' +
        '.report-body thead th{position:sticky;top:0;z-index:2;box-shadow:inset 0 -1px 0 #eee}' +
        '.foot{flex:0 0 auto;margin-top:12px}' : '') +
      '</style></head><body><div class="sheet"><h1>' + E(title) + '</h1>' +
      '<div class="sub">' + E(rangeLabel) + ' · ' + E(month) + ' · 生成于 ' + E(D.meta.today) + '</div>' +
      '<div class="kpis">' +
        '<div class="kpi"><b>' + m.total + '</b><span>当月任务</span></div>' +
        '<div class="kpi g"><b>' + m.done + '</b><span>已完成</span></div>' +
        '<div class="kpi b"><b>' + m.doing + '</b><span>进行中</span></div>' +
        '<div class="kpi r"><b>' + m.overdue + '</b><span>超期</span></div></div>' +
      '<div class="report-body">' + aiHtml + medalsHtml + taskHtml + '</div>' +
      '<div class="foot"><span>ITO 运维中心 · ' + E(title) + '</span><span>演示数据，仅用于产品演示</span></div></div></body></html>';
  }

  function openReportCenter() {
    const st = S();
    const scopes = scopeDefs();
    const months = monthChoices();
    const view = {
      scope: scopes[0].id,
      month: months[0].key,
      group: st.role === 'manager' ? ((myGroup() || {}).id || '') : '',
      person: (st.staff[0] || {}).name || st.user.name
    };
    const scopeOptions = scopes.map(function (s) { return '<option value="' + s.id + '">' + s.name + '</option>'; }).join('');
    const monthOptions = months.map(function (m) { return '<option value="' + m.key + '">' + m.label + '</option>'; }).join('');
    const groupOptions = '<option value="">全部专业组</option>' + st.groups.map(function (g) { return '<option value="' + g.id + '">' + g.name + '</option>'; }).join('');
    const myGroupId = (myGroup() || {}).id || '';
    const personPool = st.role === 'manager'
      ? st.staff.filter(function (p) { return p.group === myGroupId; })
      : st.staff;
    const personOptions = personPool.map(function (p) { return '<option value="' + U().esc(p.name) + '">' + U().esc(p.name) + ' · ' + U().esc(p.title || '') + '</option>'; }).join('');

    U().modal({
      title: '月报中心',
      sub: '范围、月份与对象可选择，导出当前预览',
      wide: true,
      body:
        '<div class="report-filter-row">' +
          '<label>范围<select id="rpScope">' + scopeOptions + '</select></label>' +
          '<label>月份<select id="rpMonth">' + monthOptions + '</select></label>' +
          '<label id="rpGroupWrap">专业组<select id="rpGroup">' + groupOptions + '</select></label>' +
          '<label id="rpPersonWrap">人员<select id="rpPerson">' + personOptions + '</select></label>' +
        '</div>' +
        '<iframe class="report-frame" title="月报预览"></iframe>',
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button><span class="spacer"></span>' +
        '<button class="btn btn-primary" data-export type="button">' + U().icon('download') + '导出当前月报</button>',
      onMount: function (close, root) {
        const frame = root.querySelector('.report-frame');
        const scopeSel = root.querySelector('#rpScope');
        const monthSel = root.querySelector('#rpMonth');
        const groupSel = root.querySelector('#rpGroup');
        const personSel = root.querySelector('#rpPerson');
        const groupWrap = root.querySelector('#rpGroupWrap');
        const personWrap = root.querySelector('#rpPersonWrap');

        function applyVisibility() {
          const scope = scopeSel.value;
          groupWrap.hidden = scope !== 'group';
          personWrap.hidden = scope !== 'person' && scope !== 'employee';
          if (scope === 'group' && st.role === 'manager') {
            groupSel.value = (myGroup() || {}).id || groupSel.value;
            groupSel.disabled = true;
          } else {
            groupSel.disabled = false;
          }
        }

        function refresh() {
          applyVisibility();
          view.scope = scopeSel.value;
          view.month = monthSel.value;
          view.group = groupSel.value;
          view.person = personSel.value;
          frame.srcdoc = reportHtml(view.scope, view);
        }

        [scopeSel, monthSel, groupSel, personSel].forEach(function (el) {
          el.addEventListener('change', refresh);
        });
        root.querySelector('[data-close]').addEventListener('click', close);
        root.querySelector('[data-export]').addEventListener('click', function () {
          const name = 'ITO月报-' + view.scope + '-' + view.month + '.html';
          U().exportPreview({ title: '月报导出预览', html: reportHtml(view.scope, view), filename: name });
          ITO.log('预览月报', view.scope + ' · ' + view.month, '报表');
          U().toast('月报预览已打开');
        });
        refresh();
      }
    });
  }

  function personalReportState() {
    const st = S();
    st.ui = st.ui || {};
    const scopes = scopeDefs();
    if (!st.ui.reportScope || !scopes.some(function (s) { return s.id === st.ui.reportScope; })) {
      st.ui.reportScope = scopes[0].id;
    }
    if (!st.ui.reportMonth) st.ui.reportMonth = monthChoices()[0].key;
    if (st.ui.reportAiVariant == null) st.ui.reportAiVariant = 0;
    if (st.ui.reportGroup == null) st.ui.reportGroup = st.role === 'manager' ? ((myGroup() || {}).id || '') : '';
    if (st.ui.reportEmpGroup == null) st.ui.reportEmpGroup = '';
    if (!st.ui.reportPerson || !st.staff.some(function (p) { return p.name === st.ui.reportPerson; })) {
      st.ui.reportPerson = st.staff[0] ? st.staff[0].name : st.user.name;
    }
    return st.ui;
  }

  function reportPersonOptions(pool, selected) {
    const groupOrder = {};
    S().groups.forEach(function (g, i) { groupOrder[g.id] = i; });
    return pool.slice().sort(function (a, b) {
      return (groupOrder[a.group] - groupOrder[b.group]) ||
        String(a.uid || '').localeCompare(String(b.uid || '')) ||
        a.name.localeCompare(b.name, 'zh');
    }).map(function (p) {
      const group = ITO.getGroup(p.group) || {};
      const role = group.manager === p.name ? '主管' : (group.leader === p.name ? '组长' : '');
      return '<option value="' + U().esc(p.name) + '"' + (p.name === selected ? ' selected' : '') +
        ' data-label="' + U().esc(p.name) + '"' +
        ' data-meta="' + U().esc(p.title || '') + '"' +
        ' data-group="' + U().esc(group.name || '') + '"' +
        ' data-role="' + U().esc(role) + '">' +
        U().esc(p.name) + ' · ' + U().esc(p.title || '') + '</option>';
    }).join('');
  }

  function inlineReportView() {
    const st = S();
    const ui = personalReportState();
    const scopes = scopeDefs();
    const months = monthChoices();
    const myGroupId = (myGroup() || {}).id || '';
    const personPool = st.role === 'manager'
      ? st.staff.filter(function (p) { return p.group === myGroupId; })
      : st.staff;
    const empPool = ui.reportEmpGroup
      ? st.staff.filter(function (p) { return p.group === ui.reportEmpGroup; })
      : st.staff;
    const activePersonPool = ui.reportScope === 'employee' ? empPool : personPool;
    const groupOptions = '<option value="">全部专业组</option>' + st.groups.map(function (g) {
      return '<option value="' + g.id + '"' + (g.id === ui.reportGroup ? ' selected' : '') + '>' + g.name + '</option>';
    }).join('');
    const empGroupOptions = '<option value="">全部专业组</option>' + st.groups.map(function (g) {
      return '<option value="' + g.id + '"' + (g.id === ui.reportEmpGroup ? ' selected' : '') + '>' + g.name + '</option>';
    }).join('');
    const personOptions = reportPersonOptions(activePersonPool, ui.reportPerson);
    return '<section class="card report-inline-card">' +
      '<div class="report-head">' +
        '<div class="report-head-left">' +
          '<h3>月报导出与预览</h3>' +
          '<select id="prScope" aria-label="范围">' + scopes.map(function (s) {
            return '<option value="' + s.id + '"' + (s.id === ui.reportScope ? ' selected' : '') + '>' + s.name + '</option>';
          }).join('') + '</select>' +
          '<select id="prMonth" aria-label="月份">' + months.map(function (m) {
            return '<option value="' + m.key + '"' + (m.key === ui.reportMonth ? ' selected' : '') + '>' + m.label + '</option>';
          }).join('') + '</select>' +
          '<span id="prGroupWrap" hidden><select id="prGroup" aria-label="专业组"' + (st.role === 'manager' && ui.reportScope === 'group' ? ' disabled' : '') + '>' + groupOptions + '</select></span>' +
          '<span id="prEmpGroupWrap" hidden><select id="prEmpGroup" aria-label="员工范围专业组">' + empGroupOptions + '</select></span>' +
          '<span id="prPersonWrap" hidden><select id="prPerson" aria-label="人员" data-picker="1">' + personOptions + '</select></span>' +
        '</div>' +
        '<div class="report-head-actions">' +
          '<button class="btn btn-ghost ai-report-btn" id="personalAiBtn" type="button">' + U().icon('spark') + 'AI 重新解读</button>' +
          '<button class="btn btn-ghost" id="personalDownloadBtn" type="button">' + U().icon('download') + '下载月报</button>' +
        '</div>' +
      '</div>' +
      '<iframe class="report-frame report-inline-frame" id="personalReportFrame" title="月报预览"></iframe>' +
    '</section>';
  }

  function assessChip(text, tone) {
    return '<span class="assess-chip ' + (tone || '') + '">' + U().esc(text) + '</span>';
  }

  function assessTime(value) {
    return String(value || '') || '—';
  }

  function assessPoints(value) {
    const n = Number(value) || 0;
    return n > 0 ? '+' + n : String(n);
  }

  /* 记分项与季度分数均为整数。 */
  function assessNum(value) {
    const n = Number(value) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  function assessMoment(value) {
    return U().esc(assessTime(value));
  }

  function ensureAssessmentRedNotice(a) {
    if (!a || !a.safetySummary || a.safetySummary.red <= 0) return;
    const st = S();
    if (!st || !st.messages) return;
    const event = (a.redEvents || [])[0];
    if (!event) return;
    const id = 'MSG-SAFETY-' + a.period.key + '-' + (event.id || String(event.date).slice(0, 10));
    if (st.messages.some(function (msg) { return msg.id === id; })) return;
    st.messages.unshift({
      id: id,
      type: '通知',
      title: '安质环红色通报',
      body: '【' + a.label + '】' + (event.category || '安质环') + ' / ' + (event.indicator || '') +
        '：' + event.item + '，触发红线，安质环得分归零，已生成红色警告。',
      time: D.meta.demoNow,
      read: false,
      sender: '系统',
      level: 'red',
      audience: { type: 'all' }
    });
    ITO.log('安质环红色通报', event.id + ' ' + event.item, '通知');
    if (ITO.persistState) ITO.persistState();
  }

  function openAssessmentSla(a) {
    const deductionRows = a.deductionRows.map(function (row) {
      return '<tr>' +
        '<td class="mono assess-time" title="' + U().esc(assessTime(row.date)) + '">' + U().esc(assessTime(row.date)) + '</td>' +
        '<td>' + U().esc(row.category) + '</td>' +
        '<td>' + U().esc(row.item) + '</td>' +
        '<td class="num">' + row.count + '</td>' +
        '<td class="num assess-points neg">' + row.points + '</td>' +
      '</tr>';
    }).join('');
    const bonusRows = a.bonusRows.map(function (row) {
      return '<tr>' +
        '<td class="mono assess-time">' + U().esc(assessTime(row.date)) + '</td>' +
        '<td>' + U().esc(row.category) + '</td>' +
        '<td>' + U().esc(row.item) + '</td>' +
        '<td class="num">' + row.used + (row.capped ? ' <span class="assess-cap">封顶</span>' : '') + '</td>' +
        '<td class="num assess-points pos">' + assessPoints(row.awarded) + '</td>' +
      '</tr>';
    }).join('');
    const badTickets = a.tickets.filter(function (ticket) {
      return (ticket.deductions && ticket.deductions.length) || Number(ticket.points) < 0;
    });
    const ticketRows = badTickets.map(function (ticket) {
      return '<tr>' +
        '<td class="mono">' + U().esc(ticket.id) + '</td>' +
        '<td>' + U().esc(ticket.system) + '</td>' +
        '<td>' + U().esc(ticket.type) + '</td>' +
        '<td class="assess-cell-main" title="' + U().esc(ticket.item) + '">' + U().esc(ticket.item) + '</td>' +
        '<td class="mono assess-time">' + U().esc(assessTime(ticket.submitted)) + '</td>' +
        '<td class="mono assess-time">' + U().esc(assessTime(ticket.responded)) + '</td>' +
        '<td class="mono assess-time">' + U().esc(assessTime(ticket.completed)) + '</td>' +
        '<td>' + assessChip(ticket.timelyResponse ? '及时' : '迟响应', ticket.timelyResponse ? 'ok' : 'bad') + '</td>' +
        '<td>' + assessChip(ticket.overdue ? '超期' : '按时', ticket.overdue ? 'bad' : 'ok') + '</td>' +
        '<td class="num assess-points neg">' + (Number(ticket.points) || 0) + '</td>' +
      '</tr>';
    }).join('');
    U().modal({
      title: 'SLA 考核明细',
      sub: a.label + ' · ' + a.sla + ' / ' + a.baseSla + ' 分',
      xwide: true,
      body: '<div class="assess-sla-scroll">' +
        '<div class="assess-detail-equation">基础 ' + a.baseSla + ' + 加分 ' + assessPoints(a.bonus) +
          ' - 扣分 ' + a.deduction + ' = <b>' + a.sla + ' / ' + a.baseSla + '</b></div>' +
        '<div class="assess-detail-section">' +
          '<div class="assess-detail-title"><h4>扣分明细</h4></div>' +
          '<div class="table-wrap"><table class="data-table assess-detail-table"><thead><tr><th>时间</th><th>类别</th><th>事项</th><th class="num">次数</th><th class="num">扣分</th></tr></thead><tbody>' +
            (deductionRows || '<tr><td colspan="5">' + U().emptyState('本期无扣分', '当前周期没有扣分记录', 'check') + '</td></tr>') +
            '<tr class="assess-total-row"><td colspan="4">扣分合计</td><td class="num assess-points neg">-' + a.deduction + '</td></tr>' +
          '</tbody></table></div>' +
        '</div>' +
        '<div class="assess-detail-section">' +
          '<div class="assess-detail-title"><h4>加分项</h4></div>' +
          '<div class="table-wrap"><table class="data-table assess-detail-table"><thead><tr><th>时间</th><th>类别</th><th>加分项</th><th class="num">计次</th><th class="num">加分</th></tr></thead><tbody>' +
            (bonusRows || '<tr><td colspan="5">' + U().emptyState('本期无加分', '当前周期没有加分记录', 'award') + '</td></tr>') +
            '<tr class="assess-total-row"><td colspan="4">加分合计</td><td class="num assess-points pos">+' + a.bonus + '</td></tr>' +
          '</tbody></table></div>' +
        '</div>' +
        '<div class="assess-detail-section">' +
          '<div class="assess-detail-title"><h4>IT100 / SAP 扣分工单</h4></div>' +
          '<div class="table-wrap"><table class="data-table assess-sla-ticket-table"><thead><tr><th>工单号</th><th>系统</th><th>类型</th><th>事项</th><th>提交时间</th><th>响应时间</th><th>完成时间</th><th>及时响应</th><th>是否超期</th><th class="num">扣分</th></tr></thead><tbody>' +
            (ticketRows || '<tr><td colspan="10">' + U().emptyState('本期无扣分工单', '所有工单均按时完成', 'check') + '</td></tr>') +
          '</tbody></table></div>' +
        '</div>' +
      '</div>',
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
      onMount: function (close, root) {
        root.querySelector('[data-close]').addEventListener('click', close);
      }
    });
  }

  function openAssessmentMonth(key) {
    if (!window.ITO || typeof ITO.assessmentMonth !== 'function') return;
    const a = ITO.assessmentMonth(key);

    const deductionRows = a.deductionRows.map(function (row) {
      return '<tr>' +
        '<td class="mono assess-time">' + assessMoment(row.date) + '</td>' +
        '<td>' + U().esc(row.category) + '</td>' +
        '<td>' + U().esc(row.item) + '</td>' +
        '<td class="num">' + row.count + '</td>' +
        '<td class="num assess-points neg">' + row.points + '</td>' +
      '</tr>';
    }).join('');
    const bonusRows = a.bonusRows.map(function (row) {
      return '<tr>' +
        '<td class="mono assess-time">' + assessMoment(row.date) + '</td>' +
        '<td>' + U().esc(row.category) + '</td>' +
        '<td>' + U().esc(row.item) + '</td>' +
        '<td class="num">' + row.used + (row.capped ? ' <span class="assess-cap">封顶</span>' : '') + '</td>' +
        '<td class="num assess-points pos">' + assessPoints(row.awarded) + '</td>' +
      '</tr>';
    }).join('');
    const badTickets = a.tickets.filter(function (ticket) {
      return (ticket.deductions && ticket.deductions.length) || Number(ticket.points) < 0;
    });
    const ticketRows = badTickets.map(function (ticket) {
      return '<tr>' +
        '<td class="mono">' + U().esc(ticket.id) + '</td>' +
        '<td>' + U().esc(ticket.system) + '</td>' +
        '<td>' + U().esc(ticket.type) + '</td>' +
        '<td class="assess-cell-main" title="' + U().esc(ticket.item) + '">' + U().esc(ticket.item) + '</td>' +
        '<td class="mono assess-time">' + assessMoment(ticket.submitted) + '</td>' +
        '<td class="mono assess-time">' + assessMoment(ticket.responded) + '</td>' +
        '<td class="mono assess-time">' + assessMoment(ticket.completed) + '</td>' +
        '<td>' + assessChip(ticket.timelyResponse ? '及时' : '迟响应', ticket.timelyResponse ? 'ok' : 'bad') + '</td>' +
        '<td>' + assessChip(ticket.overdue ? '超期' : '按时', ticket.overdue ? 'bad' : 'ok') + '</td>' +
        '<td class="num assess-points neg">' + (Number(ticket.points) || 0) + '</td>' +
      '</tr>';
    }).join('');
    const safetyRows = a.safetyEvents.map(function (event) {
      return '<tr>' +
        '<td class="mono assess-time">' + assessMoment(event.date) + '</td>' +
        '<td>' + U().esc(event.category) + '</td>' +
        '<td>' + U().esc(event.indicator || '—') + '</td>' +
        '<td>' + U().esc(event.item) + '</td>' +
        '<td>' + U().esc(event.impact || '—') + '</td>' +
        '<td class="num assess-points neg">' + (Number(event.points) || 0) + '</td>' +
      '</tr>';
    }).join('');

    const tone = a.qualified ? 'ok' : 'bad';
    const tiles = '<div class="assess-month-summary">' +
      '<div class="assess-month-tile is-' + tone + '"><span>考核总分</span><b>' + assessNum(a.total) + '<em>/ 100</em></b><i>' + U().esc(a.statusText) + '</i></div>' +
      '<div class="assess-month-tile"><span>SLA 考核</span><b>' + assessNum(a.sla) + '<em>/ ' + a.baseSla + '</em></b><i>加分 <span class="assess-points pos">' + assessPoints(a.bonus) + '</span> · 扣分 <span class="assess-points neg">' + a.deduction + '</span></i></div>' +
      '<div class="assess-month-tile"><span>安质环</span><b>' + assessNum(a.safety) + '<em>/ ' + a.baseSafety + '</em></b><i>' + (a.safetySummary.red > 0 ? '红灯触发 · 归零' : '灯状态：黄灯 ' + a.safetySummary.yellow + ' · 扣分 ' + (a.safetyDeduction || 0)) + '</i></div>' +
      '<div class="assess-month-tile"><span>合格判定</span><b>' + (a.qualified ? '达标' : '未达标') + '</b><i>合格线 ' + a.target + ' 分</i></div>' +
    '</div>';

    U().modal({
      title: a.label + ' · 月度考核明细',
      sub: '总分 ' + assessNum(a.total) + ' / 100 · SLA ' + assessNum(a.sla) + ' / ' + a.baseSla + ' · 安质环 ' + assessNum(a.safety) + ' / ' + a.baseSafety,
      xwide: true,
      body: '<div class="assess-month-scroll">' + tiles +
        '<div class="assess-detail-section">' +
          '<div class="assess-detail-title"><h4>扣分明细</h4></div>' +
          '<div class="table-wrap"><table class="data-table assess-detail-table"><thead><tr><th>时间</th><th>类别</th><th>事项</th><th class="num">次数</th><th class="num">扣分</th></tr></thead><tbody>' +
            (deductionRows || '<tr><td colspan="5">' + U().emptyState('本期无扣分', '当前月份没有扣分记录', 'check') + '</td></tr>') +
            '<tr class="assess-total-row"><td colspan="4">扣分合计</td><td class="num assess-points neg">-' + a.deduction + '</td></tr>' +
          '</tbody></table></div>' +
        '</div>' +
        '<div class="assess-detail-section">' +
          '<div class="assess-detail-title"><h4>加分项</h4></div>' +
          '<div class="table-wrap"><table class="data-table assess-detail-table"><thead><tr><th>时间</th><th>类别</th><th>加分项</th><th class="num">计次</th><th class="num">加分</th></tr></thead><tbody>' +
            (bonusRows || '<tr><td colspan="5">' + U().emptyState('本期无加分', '当前月份没有加分记录', 'award') + '</td></tr>') +
            '<tr class="assess-total-row"><td colspan="4">加分合计</td><td class="num assess-points pos">+' + a.bonus + '</td></tr>' +
          '</tbody></table></div>' +
        '</div>' +
        '<div class="assess-detail-section">' +
          '<div class="assess-detail-title"><h4>IT100 / SAP 扣分工单</h4></div>' +
          '<div class="table-wrap"><table class="data-table assess-sla-ticket-table"><thead><tr><th>工单号</th><th>系统</th><th>类型</th><th>事项</th><th>提交时间</th><th>响应时间</th><th>完成时间</th><th>及时响应</th><th>是否超期</th><th class="num">扣分</th></tr></thead><tbody>' +
            (ticketRows || '<tr><td colspan="10">' + U().emptyState('本期无扣分工单', '所有工单均按时完成', 'check') + '</td></tr>') +
          '</tbody></table></div>' +
        '</div>' +
        '<div class="assess-detail-section">' +
          '<div class="assess-detail-title"><h4>安质环事件</h4></div>' +
          '<div class="table-wrap"><table class="data-table assess-month-safety-table"><thead><tr><th>时间</th><th>运维项</th><th>指标</th><th>事项</th><th>影响情况</th><th class="num">扣分</th></tr></thead><tbody>' +
            (safetyRows || '<tr><td colspan="6">' + U().emptyState('本期无安质环事件', '当前月份没有黄灯 / 红灯事件', 'check') + '</td></tr>') +
          '</tbody></table></div>' +
        '</div>' +
      '</div>',
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
      onMount: function (close, root) {
        root.querySelector('[data-close]').addEventListener('click', close);
      }
    });
  }

  function openAssessmentQuarter(a) {
    if (!a || !a.isQuarter) return;
    const list = a.monthRows || [];
    const count = list.length;
    const redLine = a.safetySummary.red > 0;
    const monthLabels = list.map(function (row) { return row.short || row.label; }).join(' / ');

    const tone = a.qualified ? 'ok' : 'bad';
    const tiles = '<div class="assess-month-summary">' +
      '<div class="assess-month-tile is-' + tone + '"><span>季度总分</span><b>' + assessNum(a.total) + '<em>/ 100</em></b><i>' + U().esc(a.statusText) + '</i></div>' +
      '<div class="assess-month-tile"><span>SLA 考核</span><b>' + assessNum(a.sla) + '<em>/ ' + a.baseSla + '</em></b><i>扣分 <span class="assess-points neg">' + a.deduction + '</span> · 加分 <span class="assess-points pos">' + assessPoints(a.bonus) + '</span></i></div>' +
      '<div class="assess-month-tile"><span>安质环</span><b>' + assessNum(a.safety) + '<em>/ ' + a.baseSafety + '</em></b><i>' + (redLine ? '红灯触发 · 归零' : '灯状态：黄灯 ' + a.safetySummary.yellowTotal + ' · 扣分 ' + (a.safetyDeduction || 0)) + '</i></div>' +
      '<div class="assess-month-tile"><span>已结算月份</span><b>' + count + '<em> / ' + a.monthCount + '</em></b><i>' + U().esc(monthLabels || '—') + (a.pendingMonths && a.pendingMonths.length ? ' · ' + U().esc(a.pendingMonths.map(function (m) { return m.short; }).join('、')) + '待考核' : '') + '</i></div>' +
    '</div>';

    const deductionRows = (a.deductionRows || []).map(function (row) {
      return '<tr>' +
        '<td>' + U().esc(row.monthLabel || '—') + '</td>' +
        '<td class="mono assess-time">' + assessMoment(row.date) + '</td>' +
        '<td>' + U().esc(row.category) + '</td>' +
        '<td>' + U().esc(row.item) + '</td>' +
        '<td class="num">' + row.count + '</td>' +
        '<td class="num assess-points neg">' + row.points + '</td>' +
      '</tr>';
    }).join('');
    const bonusRows = (a.bonusRows || []).map(function (row) {
      return '<tr>' +
        '<td>' + U().esc(row.category) + '</td>' +
        '<td>' + U().esc(row.item) + '</td>' +
        '<td class="num">' + row.used + (row.capped ? ' <span class="assess-cap">封顶</span>' : '') + '</td>' +
        '<td class="num assess-points pos">' + assessPoints(row.awarded) + '</td>' +
      '</tr>';
    }).join('');
    const safetyRows = (a.safetyEvents || []).map(function (event) {
      return '<tr>' +
        '<td class="mono assess-time">' + assessMoment(event.date) + '</td>' +
        '<td>' + U().esc(event.category) + '</td>' +
        '<td>' + U().esc(event.indicator || '—') + '</td>' +
        '<td>' + U().esc(event.item) + '</td>' +
        '<td>' + U().esc(event.impact || '—') + '</td>' +
        '<td class="num assess-points neg">' + (Number(event.points) || 0) + '</td>' +
      '</tr>';
    }).join('');

    U().modal({
      title: a.label + ' · 季度考核明细',
      xwide: true,
      body: '<div class="assess-month-scroll is-auto">' + tiles +
        '<p class="assess-month-hint">季度考核计分；月度仅作事件归集，不单独形成月度得分。加分按季度合并后，单项最多计 2 次。</p>' +
        '<div class="assess-detail-section">' +
          '<div class="assess-detail-title"><h4>本季度扣分记录</h4><span class="table-note">合计 <b class="assess-points neg">-' + a.deduction + '</b> 分</span><button class="btn btn-ghost btn-sm" data-sla-standards type="button">查看 SLA 标准</button></div>' +
          '<div class="table-wrap"><table class="data-table assess-detail-table"><thead><tr><th>月份</th><th>时间</th><th>类别</th><th>事项</th><th class="num">次数</th><th class="num">扣分</th></tr></thead><tbody>' +
            (deductionRows || '<tr><td colspan="6">' + U().emptyState('本季度暂无扣分', '已结算月份没有扣分记录', 'check') + '</td></tr>') +
            '<tr class="assess-total-row"><td colspan="5">季度扣分合计</td><td class="num assess-points neg">-' + a.deduction + '</td></tr>' +
          '</tbody></table></div>' +
        '</div>' +
        '<div class="assess-detail-section">' +
          '<div class="assess-detail-title"><h4>本季度加分汇总</h4><span class="table-note">合计 <b class="assess-points pos">' + assessPoints(a.bonus) + '</b> 分</span></div>' +
          '<div class="table-wrap"><table class="data-table assess-detail-table"><thead><tr><th>类别</th><th>加分项</th><th class="num">计次</th><th class="num">加分</th></tr></thead><tbody>' +
            (bonusRows || '<tr><td colspan="4">' + U().emptyState('本季度暂无加分', '已结算月份没有加分记录', 'award') + '</td></tr>') +
          '</tbody></table></div>' +
        '</div>' +
        '<div class="assess-detail-section">' +
          '<div class="assess-detail-title"><h4>本季度安质环事件</h4><button class="btn btn-ghost btn-sm" data-safety-standards type="button">查看安质环标准</button></div>' +
          '<div class="table-wrap"><table class="data-table assess-month-safety-table"><thead><tr><th>时间</th><th>运维项</th><th>指标</th><th>事项</th><th>影响情况</th><th class="num">扣分</th></tr></thead><tbody>' +
            (safetyRows || '<tr><td colspan="6">' + U().emptyState('本季度无安质环事件', '已结算月份没有黄灯 / 红灯事件', 'check') + '</td></tr>') +
          '</tbody></table></div>' +
        '</div>' +
      '</div>',
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
      onMount: function (close, root) {
        root.querySelector('[data-close]').addEventListener('click', close);
        const slaStd = root.querySelector('[data-sla-standards]');
        if (slaStd) slaStd.addEventListener('click', function () {
          openSlaStandards(a);
        });
        const std = root.querySelector('[data-safety-standards]');
        if (std) std.addEventListener('click', function () {
          openAssessmentStandards(a);
        });
      }
    });
  }

  function openAssessmentSafety(a) {
    const red = a.safetySummary.red > 0;
    const rows = a.safetyEvents.map(function (event) {
      return '<tr>' +
        '<td class="mono assess-time">' + U().esc(assessTime(event.date)) + '</td>' +
        '<td>' + U().esc(event.category) + '</td>' +
        '<td>' + U().esc(event.indicator || '—') + '</td>' +
        '<td>' + U().esc(event.item) + '</td>' +
        '<td>' + U().esc(event.impact || '—') + '</td>' +
        '<td class="num assess-points neg">' + (Number(event.points) || 0) + '</td>' +
      '</tr>';
    }).join('');
    U().modal({
      title: '安质环详情',
      sub: a.label + ' · ' + a.safety + ' / ' + a.baseSafety + ' 分',
      xwide: true,
      body: (red ? '<div class="assess-red-banner">' + U().icon('alert') +
          '<span>本期存在红灯事件，触发红线，安质环得分归零，并生成站内通报。</span></div>' : '') +
        '<div class="assess-safety-summary">' +
          '<span class="assess-safety-chip warn">黄灯 <b>' + a.safetySummary.yellow + '</b></span>' +
          '<span class="assess-safety-chip bad">红灯 <b>' + a.safetySummary.red + '</b></span>' +
          '<span class="assess-safety-chip score">得分 <b>' + a.safety + ' / ' + a.baseSafety + '</b></span>' +
        '</div>' +
        '<div class="table-wrap"><table class="data-table assess-table assess-safety-table"><thead><tr><th>时间</th><th>运维项</th><th>指标</th><th>事项</th><th>影响情况</th><th class="num">扣分</th></tr></thead><tbody>' +
          (rows || '<tr><td colspan="6">' + U().emptyState('本期无安质环事件', '当前周期没有黄灯 / 红灯事件', 'check') + '</td></tr>') +
        '</tbody></table></div>' +
        '<div class="assess-card-foot"><button class="btn btn-ghost btn-sm" data-safety-standards type="button">查看指标标准</button></div>',
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
      onMount: function (close, root) {
        root.querySelector('[data-close]').addEventListener('click', close);
        const std = root.querySelector('[data-safety-standards]');
        if (std) std.addEventListener('click', function () {
          openAssessmentStandards(a);
        });
      }
    });
  }

  function slaStandardsTable(list) {
    const rows = list.map(function (row) {
      return '<tr>' +
        '<td class="num">' + U().esc(row.seq || '—') + '</td>' +
        '<td>' + U().esc(row.category || '—') + '</td>' +
        '<td>' + U().esc(row.sub || '—') + '</td>' +
        '<td>' + U().esc(row.requirement || '—') + '</td>' +
        '<td>' + U().esc(row.indicator || '—') + '</td>' +
        '<td>' + U().esc(row.standard || '—') + '</td>' +
      '</tr>';
    }).join('');
    return '<div class="table-wrap"><table class="data-table assess-standard-table assess-sla-standard-table"><thead><tr>' +
      '<th>序号</th><th>类别</th><th>分项</th><th>衡量要求</th><th>SLA 指标</th><th>考核标准</th>' +
      '</tr></thead><tbody>' +
      (rows || '<tr><td colspan="6">' + U().emptyState('暂无标准', '请检查考核数据', 'shield') + '</td></tr>') +
      '</tbody></table></div>';
  }

  function openSlaStandards(a) {
    const list = a.slaStandards || [];
    const deductions = list.filter(function (row) { return row.kind === 'deduction'; });
    const bonuses = list.filter(function (row) { return row.kind === 'bonus'; });
    U().modal({
      title: 'SLA 季度考核标准',
      sub: '扣分项 ' + deductions.length + ' 条 · 加分项 ' + bonuses.length + ' 条 · 基础分 ' + a.baseSla,
      xxwide: true,
      body: '<p class="assess-modal-note">合计分数 = 基础 ' + a.baseSla + ' + 加分 - 扣分，封顶 ' + a.baseSla + '；加分项每项最多计 2 次。标准按季度考核文档原文录入。</p>' +
        '<div class="assess-standards-scroll">' +
          '<div class="assess-standards-section">' +
            '<div class="assess-detail-title"><h4>扣分项</h4><span class="table-note">' + deductions.length + ' 条</span></div>' +
            slaStandardsTable(deductions) +
          '</div>' +
          '<div class="assess-standards-section">' +
            '<div class="assess-detail-title"><h4>加分项</h4><span class="table-note">' + bonuses.length + ' 条 · 每项最多计 2 次</span></div>' +
            slaStandardsTable(bonuses) +
          '</div>' +
        '</div>',
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
      onMount: function (close, root) {
        root.querySelector('[data-close]').addEventListener('click', close);
      }
    });
  }

  function openAssessmentStandards(a) {
    const rows = (a.safetyStandards || []).map(function (row) {
      return '<tr' + (row.veto ? ' class="is-veto"' : '') + '>' +
        '<td class="num">' + U().esc(row.seq || '—') + '</td>' +
        '<td>' + U().esc(row.item || '—') + '</td>' +
        '<td>' + U().esc(row.standard || '—') + '</td>' +
        '<td>' + (row.veto
          ? '<span class="assess-veto-badge">一票否决</span>'
          : '<span class="is-veto-muted">按标准扣分</span>') + '</td>' +
      '</tr>';
    }).join('');
    U().modal({
      title: '安质环季度考核标准',
      sub: '共 ' + (a.safetyStandards || []).length + ' 条 · 权重 ' + a.baseSafety + ' 分 · 一票否决归零',
      xxwide: true,
      body: '<p class="assess-modal-note">一票否决项出现时安质环总分归零；其余项按次累计扣分，最高扣 ' + a.baseSafety + ' 分。标准按季度考核文档原文录入。</p>' +
        '<div class="assess-standards-scroll"><div class="table-wrap"><table class="data-table assess-standard-table assess-safety-standard-table"><thead><tr>' +
          '<th>序号</th><th>考核内容</th><th>评分标准</th><th>类型</th>' +
        '</tr></thead><tbody>' +
          (rows || '<tr><td colspan="4">' + U().emptyState('暂无标准', '请检查考核数据', 'shield') + '</td></tr>') +
        '</tbody></table></div></div>',
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
      onMount: function (close, root) {
        root.querySelector('[data-close]').addEventListener('click', close);
      }
    });
  }

  function assessmentView() {
    const st = S();
    if (!window.ITO || typeof ITO.assessmentModel !== 'function') {
      return U().emptyState('考核数据未加载', '请确认 assessment.js 已加载', 'chart');
    }
    st.ui = st.ui || {};
    const a = ITO.assessmentModel('quarter');
    ensureAssessmentRedNotice(a);
    const red = a.safetySummary.red > 0;
    const periodSpan = (function () {
      const start = String(a.period.start || '').slice(5, 7);
      const end = String(a.period.end || '').slice(5, 7);
      return Number(start) + '–' + Number(end) + ' 月';
    })();
    const passText = a.qualified ? '达标' : '未达标';
    const passClass = a.qualified ? 'is-ok' : 'is-bad';
    const slaNote = '本季度扣分 <span class="assess-points neg">' + (a.deduction || 0) + '</span> · 加分 <span class="assess-points pos">' + assessPoints(a.bonus) + '</span>';
    const safetyNote = red
      ? '红灯触发 · 安质环归零'
      : '黄灯 ' + a.safetySummary.yellowTotal + ' · 扣分 ' + (a.safetyDeduction || 0);

    const totalCard = '<article class="card kpi-card assess-kpi-total" data-tone="' + (a.qualified ? 'green' : 'amber') + '">' +
      '<div class="kpi-label">' + U().icon('award') + '<span>季度考核总分</span></div>' +
      '<div class="kpi-value">' + assessNum(a.total) + '<span class="unit">分</span></div>' +
      '<div class="kpi-meta"><span class="assess-kpi-pass ' + passClass + '">' + passText + '</span></div>' +
    '</article>';
    const slaCard = '<article class="card kpi-card assess-sla-card" data-tone="blue" data-assess-sla-card role="button" tabindex="0" title="查看季度扣分与加分明细">' +
      '<div class="kpi-label">' + U().icon('shield') + '<span>SLA 考核</span><em class="assess-card-link">查看明细</em></div>' +
      '<div class="kpi-value">' + assessNum(a.sla) + '<span class="unit"> / ' + a.baseSla + '</span></div>' +
      '<div class="kpi-meta"><span>' + slaNote + '</span></div>' +
    '</article>';
    const safetyCard = '<article class="card kpi-card assess-safety-kpi' + (red ? ' is-red' : '') + '" data-tone="amber" data-assess-safety-card role="button" tabindex="0" title="查看季度安质环明细">' +
      '<div class="kpi-label">' + U().icon('check') + '<span>安质环</span><em class="assess-card-link">查看明细</em></div>' +
      '<div class="kpi-value">' + assessNum(a.safety) + '<span class="unit"> / ' + a.baseSafety + '</span></div>' +
      '<div class="kpi-meta"><span>' + U().esc(safetyNote) + '</span>' +
        (red ? '<span class="assess-kpi-red">红色警告</span>' : '') + '</div>' +
    '</article>';

    const toolbar = '<div class="assess-toolbar">' +
      '<span class="assess-period">' + U().esc(a.label) + ' · ' + periodSpan + ' · 当前累计</span>' +
    '</div>';

    const quarterPeriods = (ITO.assessmentPeriods().quarters || []).slice().sort(function (x, y) {
      return String(y.key).localeCompare(String(x.key));
    });
    const historyRows = quarterPeriods.map(function (period) {
      const q = ITO.assessmentQuarter(period.key);
      if (!q) return '';
      const qSpan = Number(String(q.period.start).slice(5, 7)) + '–' + Number(String(q.period.end).slice(5, 7)) + ' 月';
      return '<tr class="assess-click-row" data-assess-quarter="' + U().esc(q.period.key) + '" tabindex="0" role="button" title="查看 ' + U().esc(q.label) + ' 明细">' +
        '<td>' + U().esc(q.label) + ' · ' + qSpan + '</td>' +
        '<td>' + q.settledCount + ' / ' + q.monthCount + '</td>' +
        '<td>' + assessNum(q.total) + '</td>' +
        '<td>' + assessNum(q.sla) + '</td>' +
        '<td>' + assessNum(q.safety) + '</td>' +
        '<td class="assess-points neg">' + (q.deduction ? '-' + q.deduction : '0') + '</td>' +
        '<td class="assess-points pos">' + assessPoints(q.bonus) + '</td>' +
        '<td>' + (q.qualified ? assessChip('达标', 'ok') : assessChip('未达标', 'bad')) + '</td>' +
      '</tr>';
    }).join('');

    const historyCard = '<section class="card table-card assess-history-card">' +
      '<div class="table-head"><div><h3>季度考核记录</h3><p class="table-note">Q1–Q4 季度记录 · 扣分 / 加分按季度累计 · 点击行查看明细</p></div>' +
        '<span class="table-note">' + quarterPeriods.length + ' 个季度</span></div>' +
      '<div class="table-wrap"><table class="data-table assess-history-table"><thead><tr>' +
        '<th>季度</th><th>已结算</th><th>总分</th><th>SLA</th><th>安质环</th><th>扣分</th><th>加分</th><th>判定</th>' +
      '</tr></thead><tbody>' + historyRows + '</tbody></table></div>' +
    '</section>';

    const trendCard = '<section class="card assess-trend-card">' +
      '<div class="chart-head"><div><h3 class="chart-title">季度考核趋势</h3><p class="chart-sub">Q1–Q4 总分 · 评分区间 90–100 · 合格线 95</p></div>' +
        '<span class="head-tag">QUARTER</span></div>' +
      '<div class="assess-trend-body" id="assessTrendChart" role="img" aria-label="Q1–Q4 季度考核总分趋势"></div>' +
    '</section>';

    return toolbar +
      '<div class="kpi-grid personal-kpis assess-kpis">' + totalCard + slaCard + safetyCard + '</div>' +
      trendCard +
      historyCard;
  }

  P.personal = {
    render: function () {
      const st = S();
      st.ui = st.ui || {};
      const m = model();
      const group = myGroup();
      const isLeader = st.role === 'leader' || st.role === 'super';
      const isManager = st.role === 'manager';
      const canAssess = isLeader || isManager;
      const routeTab = st.routeParams && st.routeParams.tab;
      let tab = (routeTab === 'assessment' && canAssess) ? 'assessment' : (st.ui.personalTab || 'stats');
      if (tab === 'assessment' && !canAssess) tab = 'stats';
      const title = isLeader ? '运营统计' : (isManager ? '团队统计' : '个人统计');
      const scopeText = isLeader ? '全部专业组' : (isManager ? (group ? group.name : '本组') : '本人');

      const stats = tagsHtml(m) +
        '<div class="kpi-grid personal-kpis">' +
          kpi(isLeader || isManager ? '当月团队任务' : '当月总任务', m.total, '项', '<span>截止时间在本月 · ' + U().esc(scopeText) + '</span>', '', 'task') +
          kpi('已完成', m.done, '项', '<span>完成率 ' + m.rate + '%</span>', 'green', 'check') +
          kpi('执行中', m.doing, '项', '<span>含审批中与待分发</span>', 'blue', 'clock') +
          kpi('超期', m.overdue, '项', '<span>含已完成但晚于截止</span>', 'red', 'alert') +
        '</div>' +
        '<section class="card table-card personal-task-card">' +
          '<div class="table-head"><div><h3>当月任务（' + monthLabel() + '）</h3>' +
            '<p class="table-note">' + (isLeader || isManager ? '统计范围：' + U().esc(scopeText) : '仅统计本人执行、且截止时间在本月的任务') + '；点击行查看任务详情</p></div>' +
            '<span class="table-note">' + m.total + ' 项</span></div>' +
          '<div class="table-wrap"><table class="data-table personal-task-table mine-task-table">' +
            '<thead><tr><th>任务名称</th><th>专业组</th><th>执行人</th><th>任务UID</th><th>任务类型</th><th>任务等级</th><th>预估工时</th><th>截止时间</th><th>状态</th></tr></thead>' +
            '<tbody id="personalTbody">' + rowsHtml(m) + '</tbody></table></div>' +
        '</section>';

      const tabs = '<div class="tabs personal-tabs">' +
        '<button class="tab' + (tab === 'stats' ? ' active' : '') + '" data-personal-tab="stats" type="button">统计</button>' +
        (canAssess ? '<button class="tab' + (tab === 'assessment' ? ' active' : '') + '" data-personal-tab="assessment" type="button">考核</button>' : '') +
        '<button class="tab' + (tab === 'report' ? ' active' : '') + '" data-personal-tab="report" type="button">月报</button>' +
      '</div>';

      return U().pageHead({
        title: title,
        sub: st.user.name + ' · ' + (group ? group.name : '运维中心') + ' · ' + st.user.title + ' · ' + monthLabel()
      }) +
      tabs +
      (tab === 'report' ? inlineReportView() : tab === 'assessment' ? assessmentView() : stats);
    },

    after: function () {
      const st = S();
      U().$$('[data-personal-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          st.ui.personalTab = btn.dataset.personalTab;
          if (st.routeParams && st.routeParams.tab) {
            st.routeParams = Object.assign({}, st.routeParams);
            delete st.routeParams.tab;
            if (location.hash.indexOf('?') > -1) history.replaceState(null, '', '#/personal');
          }
          ITO.refresh();
        });
      });

      const canAssess = st.role === 'leader' || st.role === 'super' || st.role === 'manager';
      const routeTab = st.routeParams && st.routeParams.tab;
      const routeDetail = st.routeParams && st.routeParams.detail;
      const effectiveTab = (routeTab === 'assessment' && canAssess) ? 'assessment' : (st.ui.personalTab || 'stats');
      if (effectiveTab === 'assessment') {
        const a = ITO.assessmentModel('quarter');
        const openSla = function () { openAssessmentSla(a); };
        const openSafety = function () { openAssessmentSafety(a); };
        const slaCard = document.querySelector('[data-assess-sla-card]');
        if (slaCard) {
          slaCard.addEventListener('click', openSla);
          slaCard.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSla(); }
          });
        }
        const safetyCard = document.querySelector('[data-assess-safety-card]');
        if (safetyCard) {
          safetyCard.addEventListener('click', openSafety);
          safetyCard.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSafety(); }
          });
        }
        U().$$('[data-assess-quarter]').forEach(function (row) {
          const open = function () {
            const q = ITO.assessmentQuarter(row.dataset.assessQuarter);
            if (q) openAssessmentQuarter(q);
          };
          row.addEventListener('click', open);
          row.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
          });
        });
        if (routeDetail === 'sla' || routeDetail === 'safety') {
          setTimeout(function () {
            if (st.route !== 'personal' || !st.routeParams || st.routeParams.detail !== routeDetail) return;
            if (routeDetail === 'sla') openAssessmentSla(a);
            else openAssessmentSafety(a);
            st.routeParams = Object.assign({}, st.routeParams);
            delete st.routeParams.detail;
            history.replaceState(null, '', '#/personal?tab=assessment');
          }, 160);
        }
        const trendPeriods = (ITO.assessmentPeriods().quarters || []).slice().sort(function (x, y) {
          return String(x.key).localeCompare(String(y.key));
        });
        const trendRows = trendPeriods.map(function (p) { return ITO.assessmentQuarter(p.key); }).filter(Boolean);
        const trendChart = U().chart('assessTrendChart', {
          animation: false,
          tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(29,29,31,.92)',
            borderWidth: 0,
            padding: [8, 12],
            textStyle: { color: '#fff', fontSize: 11 },
            formatter: function (params) {
              const p = Array.isArray(params) ? params[0] : params;
              if (!p) return '';
              return '<b>' + p.axisValue + '</b><br/>季度总分：' + p.value + ' / 100';
            }
          },
          grid: { left: 10, right: 20, top: 24, bottom: 10, containLabel: true },
          xAxis: {
            type: 'category',
            data: trendRows.map(function (r) { return r.shortLabel || r.label; }),
            axisLine: { lineStyle: { color: 'rgba(29,29,31,.12)' } },
            axisTick: { show: false },
            axisLabel: { color: '#8A8A8E', fontSize: 10 }
          },
          yAxis: {
            type: 'value',
            min: 90,
            max: 100,
            interval: 2,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: '#8A8A8E', fontSize: 10 },
            splitLine: { lineStyle: { color: 'rgba(29,29,31,.06)', type: 'dashed' } }
          },
          series: [{
            type: 'bar',
            name: '季度总分',
            barWidth: 28,
            data: trendRows.map(function (r) { return r.total; }),
            itemStyle: { color: '#EB612A', borderRadius: [4, 4, 0, 0] },
            label: { show: true, position: 'top', color: '#4A4A4F', fontSize: 10, fontWeight: 600 },
            markLine: {
              silent: true,
              symbol: 'none',
              lineStyle: { color: '#9C8F86', type: 'dashed', width: 1 },
              label: { show: true, position: 'insideEndTop', formatter: '合格线 95', color: '#8A8A8E', fontSize: 9 },
              data: [{ yAxis: 95 }]
            }
          }]
        });
        if (trendChart) {
          window.setTimeout(function () {
            try { trendChart.resize(); } catch (e) { /* noop */ }
          }, 80);
        }
        return;
      }

      const tbody = document.getElementById('personalTbody');
      if (tbody) {
        tbody.addEventListener('click', function (e) {
          const row = e.target.closest('.personal-task-row');
          if (!row) return;
          if (ITO.taskActions && ITO.taskActions.detail) ITO.taskActions.detail(row.dataset.task, row.dataset.sub);
        });
      }

      const personalTags = model().personTags.concat(model().taskTags);
      U().$$('.personal-tag').forEach(function (card) {
        const tag = personalTags.find(function (t) { return t.name === card.dataset.tagName && t.type === card.dataset.tagType; });
        if (!tag) return;
        const open = function () { openPersonalTag(tag); };
        card.addEventListener('click', open);
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
      });

      if ((st.ui.personalTab || 'stats') !== 'report') return;
      const ui = personalReportState();
      const frame = document.getElementById('personalReportFrame');
      const scopeSel = document.getElementById('prScope');
      const monthSel = document.getElementById('prMonth');
      const groupSel = document.getElementById('prGroup');
      const empGroupSel = document.getElementById('prEmpGroup');
      const personSel = document.getElementById('prPerson');
      const groupWrap = document.getElementById('prGroupWrap');
      const empGroupWrap = document.getElementById('prEmpGroupWrap');
      const personWrap = document.getElementById('prPersonWrap');
      const myGroupId = (myGroup() || {}).id || '';

      function fillEmployeePerson(groupId, keep) {
        const pool = groupId
          ? st.staff.filter(function (p) { return p.group === groupId; })
          : st.staff;
        const selected = keep && pool.some(function (p) { return p.name === keep; })
          ? keep
          : (pool[0] ? pool[0].name : '');
        personSel.innerHTML = reportPersonOptions(pool, selected);
        if (selected) personSel.value = selected;
        if (personSel.__syncPicker) personSel.__syncPicker();
      }

      function syncVisibility() {
        const scope = scopeSel.value;
        const showGroup = scope === 'group';
        const showPerson = scope === 'person' || scope === 'employee';
        groupWrap.hidden = !showGroup;
        personWrap.hidden = !showPerson;
        empGroupWrap.hidden = scope !== 'employee';
        if (scope === 'employee') fillEmployeePerson(empGroupSel.value, personSel.value);
        if (scope === 'person') {
          const pool = st.role === 'manager'
            ? st.staff.filter(function (p) { return p.group === myGroupId; })
            : st.staff;
          if (!pool.some(function (p) { return p.name === personSel.value; })) {
            personSel.value = pool[0] ? pool[0].name : '';
            if (personSel.__syncPicker) personSel.__syncPicker();
          }
        }
        if (scope === 'group' && st.role === 'manager') {
          groupSel.value = (myGroup() || {}).id || groupSel.value;
          groupSel.disabled = true;
        } else {
          groupSel.disabled = false;
        }
      }

      function currentView() {
        return {
          scope: scopeSel.value,
          month: monthSel.value,
          group: groupSel.value,
          empGroup: empGroupSel.value,
          person: personSel.value,
          aiVariant: Number(st.ui.reportAiVariant) || 0
        };
      }

      function refreshFrame() {
        syncVisibility();
        const view = currentView();
        st.ui.reportScope = view.scope;
        st.ui.reportMonth = view.month;
        st.ui.reportGroup = view.group;
        st.ui.reportEmpGroup = view.empGroup;
        st.ui.reportPerson = view.person;
        if (frame) frame.srcdoc = reportHtml(view.scope, Object.assign({}, view, { fixed: true }));
      }

      [scopeSel, monthSel, groupSel, empGroupSel, personSel].forEach(function (el) {
        el.addEventListener('change', function () {
          st.ui.reportAiVariant = 0;
          if (el === empGroupSel) fillEmployeePerson(empGroupSel.value, '');
          if (el === scopeSel) syncVisibility();
          refreshFrame();
        });
      });
      refreshFrame();

      const aiBtn = document.getElementById('personalAiBtn');
      if (aiBtn) aiBtn.addEventListener('click', function () {
        if (aiBtn.classList.contains('is-loading')) return;
        aiBtn.classList.add('is-loading');
        aiBtn.innerHTML = U().icon('spark') + 'AI 分析中…';
        window.setTimeout(function () {
          if (st.ui.personalTab !== 'report' || st.route !== 'personal') return;
          st.ui.reportAiVariant = ((Number(st.ui.reportAiVariant) || 0) + 1) % 3;
          refreshFrame();
          aiBtn.classList.remove('is-loading');
          aiBtn.innerHTML = U().icon('spark') + 'AI 重新解读';
        }, 420);
      });

      const download = document.getElementById('personalDownloadBtn');
      if (download) download.addEventListener('click', function () {
        const view = currentView();
        const html = reportHtml(view.scope, view);
        U().exportPreview({
          title: '月报导出预览',
          html: html,
          filename: 'ITO月报-' + view.scope + '-' + view.month + '.html'
        });
      });
    }
  };
})();
