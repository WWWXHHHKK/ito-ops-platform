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

  function model() {
    const st = S();
    const items = mySubs();
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
    const taskTags = allTags.filter(function (a) { return a.type === '任务标签'; }).map(function (a) {
      const completed = done.filter(function (x) {
        return (x.sub.tags || []).indexOf(a.name) > -1 || (x.task.tags || []).indexOf(a.name) > -1;
      }).length;
      return Object.assign({}, a, { count: Math.max(a.count || 0, completed) });
    });
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
    return '<article class="personal-tag ' + (isPerson ? 'person' : 'task') + '" role="button" tabindex="0" data-tag-name="' + U().esc(tag.name) + '" data-tag-type="' + U().esc(tag.type) + '">' +
      '<b>' + U().esc(tag.name) + '</b>' + mark +
    '</article>';
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
      return '<tr><td colspan="7">' + U().emptyState(
        '当前没有以你为执行人的当月任务',
        '个人统计只统计执行人是你、且截止时间在本月的任务',
        'task'
      ) + '</td></tr>';
    }
    return m.items.map(function (x) {
      const s = x.sub;
      return '<tr class="personal-task-row" data-task="' + U().esc(x.task.id) + '" data-sub="' + U().esc(s.id) + '">' +
        '<td><div class="cell-task"><b>' + U().esc(s.name) + '</b><small>' + U().esc(x.task.name) + '</small></div></td>' +
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
    return '<section class="card personal-tags-card">' +
      '<div class="table-head"><div><h3>我的属性勋章</h3>' +
        '<p class="table-note">人员标签按能力评定 1–3 星，任务标签按完成次数累计</p></div>' +
        '<span class="table-note">' + (m.personTags.length + m.taskTags.length) + ' 项</span></div>' +
      '<div class="personal-tag-groups">' +
        '<div class="personal-tag-group">' +
          '<div class="personal-tag-head"><h4>人员标签</h4><span>' + m.personTags.length + ' 项</span></div>' +
          '<div class="personal-tag-grid">' +
            (m.personTags.length ? m.personTags.map(tagCard).join('') : '<div class="mini-empty">暂无人员标签</div>') +
          '</div>' +
        '</div>' +
        '<div class="personal-tag-group">' +
          '<div class="personal-tag-head"><h4>任务标签</h4><span>' + m.taskTags.length + ' 项</span></div>' +
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
    for (let i = 0; i < 3; i += 1) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      out.push({ key: key, label: d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月' });
    }
    return out;
  }

  function scopeDefs() {
    const role = S().role;
    if (role === 'super') {
      return [{ id: 'team', name: '团队月报' }, { id: 'group', name: '专业组月报' }, { id: 'employee', name: '员工月报' }];
    }
    if (role === 'manager') {
      return [{ id: 'me', name: '我的月报' }, { id: 'group', name: '专业组月报' }, { id: 'person', name: '组员月报' }];
    }
    if (role === 'leader') {
      return [{ id: 'initiated', name: '我的月报（我发起）' }, { id: 'team', name: '团队月报' }, { id: 'employee', name: '员工月报' }];
    }
    return [{ id: 'me', name: '我的月报' }];
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
    st.tasks.forEach(function (t) {
      if (t.canceled || t.draft) return;
      t.subs.forEach(function (s) {
        if (String(s.due || '').slice(0, 7) !== opts.month) return;
        if (s.status === '已取消') return;
        if (scope === 'me' && s.owner !== st.user.name) return;
        if (scope === 'person' && s.owner !== opts.person) return;
        if (scope === 'employee' && s.owner !== opts.person) return;
        if (scope === 'group' && s.group !== groupId) return;
        if (scope === 'team' && groupId && s.group !== groupId) return;
        if (scope === 'initiated' && t.initiator !== st.user.name) return;
        items.push({ task: t, sub: s });
      });
    });
    const done = items.filter(function (x) { return x.sub.status === '已完成'; });
    const overdue = items.filter(function (x) { return U().isOverdue(x.sub) || U().isLateClosed(x.sub); });
    return { items: items, total: items.length, done: done.length, overdue: overdue.length, doing: items.length - done.length };
  }

  function reportHtml(scope, opts) {
    const st = S();
    const m = collectReport(scope, opts);
    const E = U().esc;
    const group = opts.group ? ITO.getGroup(opts.group) : null;
    const personName = (scope === 'person' || scope === 'employee') ? opts.person : (scope === 'me' ? st.user.name : '');
    const month = (monthChoices().find(function (x) { return x.key === opts.month; }) || {}).label || opts.month;
    const titleMap = { me: '个人运维月报', person: '个人运维月报', employee: '员工月报', group: '专业组月报', team: '团队月报', initiated: '我发起的任务月报' };
    const title = titleMap[scope] || '运维月报';
    const rangeLabel = (scope === 'person' || scope === 'employee') ? (personName || '—') :
      scope === 'group' ? ((group ? group.name : '—')) :
      scope === 'team' ? (group ? group.name : '全部专业组') :
      scope === 'initiated' ? st.user.name : st.user.name;
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
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>ITO ' + E(title) + ' · ' + E(month) + '</title>' +
      '<style>body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#1D1D1F;margin:0;padding:40px;background:#F5F4F2}' +
      '.sheet{max-width:1000px;margin:0 auto;background:#fff;border-radius:18px;padding:42px 46px;box-shadow:0 20px 60px rgba(0,0,0,.08)}' +
      'h1{font-size:26px;margin:0;letter-spacing:-.02em}h2{font-size:14px;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #eee}' +
      '.sub{color:#8A8A8E;font-size:12px;margin-top:8px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:22px}' +
      '.kpi{background:#fff;border:1px solid #F0E7DF;border-top:3px solid #EB612A;border-radius:10px;padding:14px 16px}.kpi b{display:block;font-size:22px;letter-spacing:-.01em}.kpi span{display:block;font-size:10px;color:#8A8A8E;margin-top:4px}' +
      '.kpi.g{border-top-color:#1FAE5C}.kpi.g b{color:#1FAE5C}.kpi.b{border-top-color:#0A72E8}.kpi.b b{color:#0A72E8}.kpi.r{border-top-color:#CF4B18}.kpi.r b{color:#CF4B18}' +
      '.medals{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}' +
      '.medal{background:linear-gradient(145deg,#FFF8F3,#FFF4EC);border:1px solid rgba(235,97,42,.14);border-radius:10px;padding:12px 14px}' +
      '.medal .mt{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.medal .mt b{font-size:12.5px}' +
      '.medal .st{color:#EB612A;font-size:10px;letter-spacing:1px;white-space:nowrap}.medal .st i{font-style:normal;color:rgba(29,29,31,.15)}' +
      '.medal small{display:block;font-size:10.5px;color:#8A8A8E;margin-top:5px}' +
      '.medal.t{background:linear-gradient(145deg,#F5F9FF,#EDF4FE);border-color:rgba(10,114,232,.14)}.medal.t .st{color:#0A72E8}.medal .kind{font-size:9px;color:#0A72E8;letter-spacing:.06em}' +
      '.medal .auth-mark,.tag .auth-mark{display:inline-flex;align-items:center;height:17px;padding:0 6px;border-radius:5px;background:#FFF0E7;color:#C2501C;font-size:9px;font-weight:650;font-style:normal;white-space:nowrap}' +
      'table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}' +
      'th{text-align:left;color:#8A8A8E;font-weight:600;padding:8px 9px;background:#F7F6F4;border-bottom:1px solid #eee}' +
      'td{padding:8px 9px;border-bottom:1px solid #f1f1f1;color:#4A4A4F}.foot{margin-top:30px;font-size:10px;color:#AEAEB2;display:flex;justify-content:space-between}' +
      (opts.fixed ?
        'html,body{height:100%}body{padding:0;box-sizing:border-box;overflow:hidden}' +
        '.sheet{max-width:none;width:100%;height:100%;box-sizing:border-box;padding:26px 30px 18px;display:flex;flex-direction:column;border-radius:0;box-shadow:none}' +
        '.detail{flex:1;min-height:0;overflow:auto}.foot{flex:0 0 auto;margin-top:12px}' : '') +
      '</style></head><body><div class="sheet"><h1>' + E(title) + '</h1>' +
      '<div class="sub">' + E(rangeLabel) + ' · ' + E(month) + ' · 生成于 ' + E(D.meta.today) + '</div>' +
      '<div class="kpis">' +
        '<div class="kpi"><b>' + m.total + '</b><span>当月任务</span></div>' +
        '<div class="kpi g"><b>' + m.done + '</b><span>已完成</span></div>' +
        '<div class="kpi b"><b>' + m.doing + '</b><span>进行中</span></div>' +
        '<div class="kpi r"><b>' + m.overdue + '</b><span>超期</span></div></div>' +
      (medals.length ? '<h2>属性勋章</h2><div class="medals">' + medals.map(medalCard).join('') + '</div>' : '') +
      '<h2>任务明细</h2><div class="detail"><table><thead><tr><th>任务</th><th>UID</th><th>执行人</th><th>类型</th><th>等级</th><th>工时</th><th>截止</th><th>状态</th></tr></thead><tbody>' +
      (tableRows || '<tr><td colspan="8">当前筛选暂无任务</td></tr>') + '</tbody></table></div>' +
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
      person: st.user.name
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
          groupWrap.hidden = scope !== 'group' && scope !== 'team';
          personWrap.hidden = scope !== 'person';
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
    if (st.ui.reportGroup == null) st.ui.reportGroup = st.role === 'manager' ? ((myGroup() || {}).id || '') : '';
    if (st.ui.reportEmpGroup == null) st.ui.reportEmpGroup = '';
    if (!st.ui.reportPerson) st.ui.reportPerson = st.user.name;
    return st.ui;
  }

  function reportPersonOptions(pool, selected) {
    const groupOrder = {};
    S().groups.forEach(function (g, i) { groupOrder[g.id] = i; });
    return pool.slice().sort(function (a, b) {
      return (groupOrder[a.group] - groupOrder[b.group]) || a.name.localeCompare(b.name, 'zh');
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
        '<button class="btn btn-ghost" id="personalDownloadBtn" type="button">' + U().icon('download') + '下载月报</button>' +
      '</div>' +
      '<iframe class="report-frame report-inline-frame" id="personalReportFrame" title="月报预览"></iframe>' +
    '</section>';
  }

  P.personal = {
    render: function () {
      const st = S();
      st.ui = st.ui || {};
      const m = model();
      const group = myGroup();
      const tab = st.ui.personalTab || 'stats';

      const stats = tagsHtml(m) +
        '<div class="kpi-grid personal-kpis">' +
          kpi('当月总任务', m.total, '项', '<span>截止时间在本月</span>', '', 'task') +
          kpi('已完成', m.done, '项', '<span>完成率 ' + m.rate + '%</span>', 'green', 'check') +
          kpi('执行中', m.doing, '项', '<span>含审批中与待分发</span>', 'blue', 'clock') +
          kpi('超期', m.overdue, '项', '<span>含已完成但晚于截止</span>', 'red', 'alert') +
        '</div>' +
        '<section class="card table-card personal-task-card">' +
          '<div class="table-head"><div><h3>当月任务（' + monthLabel() + '）</h3>' +
            '<p class="table-note">仅统计执行人是你、且截止时间在本月的任务；点击行查看任务详情</p></div>' +
            '<span class="table-note">' + m.total + ' 项</span></div>' +
          '<div class="table-wrap"><table class="data-table personal-task-table">' +
            '<thead><tr><th>任务名称</th><th>任务UID</th><th>任务类型</th><th>任务等级</th><th>预估工时</th><th>截止时间</th><th>状态</th></tr></thead>' +
            '<tbody id="personalTbody">' + rowsHtml(m) + '</tbody></table></div>' +
        '</section>';

      const tabs = '<div class="tabs personal-tabs">' +
        '<button class="tab' + (tab === 'stats' ? ' active' : '') + '" data-personal-tab="stats" type="button">统计</button>' +
        '<button class="tab' + (tab === 'report' ? ' active' : '') + '" data-personal-tab="report" type="button">月报</button>' +
      '</div>';

      return U().pageHead({
        title: '个人统计',
        sub: st.user.name + ' · ' + (group ? group.name : '运维中心') + ' · ' + st.user.title + ' · ' + monthLabel()
      }) +
      tabs +
      (tab === 'report' ? inlineReportView() : stats);
    },

    after: function () {
      const st = S();
      U().$$('[data-personal-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          st.ui.personalTab = btn.dataset.personalTab;
          ITO.refresh();
        });
      });

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
        const showGroup = scope === 'group' || scope === 'team';
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
          person: personSel.value
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
          if (el === empGroupSel) fillEmployeePerson(empGroupSel.value, '');
          if (el === scopeSel) syncVisibility();
          refreshFrame();
        });
      });
      refreshFrame();

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
