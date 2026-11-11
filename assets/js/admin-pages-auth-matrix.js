/* ─────────────────────────────────────────────
   page · authorization matrix (read-only)
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const P = (window.ITO_PAGES = window.ITO_PAGES || {});
  const D = window.ITO_DATA;

  function S() { return ITO.state; }
  function U() { return ITO.ui; }

  const BASE_TYPES = ['入厂授权', '基本安全培训', '值班授权'];

  // 基础资格只读查询（我的任务·授权详情弹窗复用作业授权页口径）
  ITO.baseQualifications = function (personName) {
    const staff = S().staff || [];
    const idx = staff.findIndex(function (p) { return p.name === personName; });
    if (idx < 0) return [];
    return BASE_TYPES.map(function (type) {
      const fact = baseFact(staff[idx], type, idx);
      if (!fact) return { type: type, held: false };
      const stt = ITO.authStatus(fact.validTo);
      return { type: type, held: true, validTo: fact.validTo, status: stt.status, left: stt.left };
    });
  };
  const WORK_TYPES = [
    '工作负责人授权', '准备工程师授权', '高风险作业授权',
    'RP1 授权', 'RP2 授权', '登高车作业授权',
    '低压电工证', '高压电工证', '工具库授权'
  ];
  const COLUMNS = BASE_TYPES.concat(WORK_TYPES);
  const ELIGIBLE = {
    app: ['工作负责人授权', '准备工程师授权', '工具库授权'],
    comm: ['高风险作业授权', 'RP1 授权', 'RP2 授权', '登高车作业授权', '工具库授权'],
    online: ['工具库授权', '低压电工证', 'RP2 授权'],
    infra: ['低压电工证', '高压电工证', '登高车作业授权', '工具库授权']
  };

  function baseFact(person, type, index) {
    if (type === '值班授权') {
      // 值班授权按人发放：通信组 10 人（含值班主管），其他组不持有
      const pool = (D.duty && D.duty.authPool) || [];
      if (pool.indexOf(person.name) === -1) return null;
      return { validTo: '2026-12-31', base: true, source: '基础资格' };
    }
    // 入厂授权 / 基本安全培训：准入基础，全员持有；少数已过期 / 临期用于演示补办提醒
    let validTo = type === '入厂授权' ? '2027-10-28' : '2027-06-30';
    const sample = person.name !== '赵工';
    if (sample && index % 14 === 2) validTo = type === '入厂授权' ? '2026-10-15' : '2026-09-30';
    if (sample && index % 11 === 3) validTo = '2026-12-20';
    return { validTo: validTo, base: true, source: '基础资格' };
  }

  function actualOf(person, type) {
    return (S().auths || []).find(function (a) {
      return a.person === person.name && a.type === type && a.status !== '已撤销';
    });
  }

  function isEligible(person, type, index) {
    const list = ELIGIBLE[person.group] || [];
    return list.indexOf(type) > -1 && index % 5 !== 0;
  }

  function cellOf(person, type, index) {
    const base = BASE_TYPES.indexOf(type) > -1 ? baseFact(person, type, index) : null;
    if (base) {
      const { status, left } = ITO.authStatus(base.validTo);
      return {
        kind: 'actual',
        status,
        left,
        validTo: base.validTo,
        source: '基础资格'
      };
    }
    const auth = actualOf(person, type);
    if (auth) {
      const { status, left } = ITO.authStatus(auth.validTo);
      return {
        kind: 'actual',
        status,
        left,
        validTo: auth.validTo,
        source: '授权台账',
        record: auth
      };
    }
    if (isEligible(person, type, index)) return { kind: 'can', status: '可拿', left: 0, source: '培训 / 体检通过' };
    return { kind: 'none', status: '—', left: 0 };
  }

  function buildRows() {
    return S().staff.map(function (person, index) {
      return {
        person: person,
        index: index,
        cells: COLUMNS.map(function (type) { return { type: type, cell: cellOf(person, type, index) }; })
      };
    });
  }

  function cellTone(cell) {
    if (cell.kind === 'can') return 'can';
    if (cell.status === '临期') return 'soon';
    if (cell.status === '已过期') return 'expired';
    if (cell.kind === 'actual') return 'ok';
    return 'none';
  }

  function cellHtml(cell) {
    if (cell.kind === 'none') return '<span class="auth-empty">—</span>';
    if (cell.kind === 'can') return '<span class="auth-pill can">可拿</span><small>培训 / 体检通过</small>';
    return '<span class="auth-pill ' + cellTone(cell) + '">' + U().esc(cell.status) + '</span>' +
      '<small>至 ' + U().esc(cell.validTo) + (cell.status === '临期' ? ' · 剩余 ' + cell.left + ' 天' : '') + '</small>';
  }

  function ensureTags() {
    const st = S();
    const rows = buildRows();
    const types = {};
    WORK_TYPES.forEach(function (type) { types[type] = true; });
    Object.keys(types).forEach(function (type) {
      if (!(st.wallTags || []).some(function (tag) { return tag.name === type && tag.type === '人员标签'; })) {
        st.wallTags.push({
          name: type, type: '人员标签', count: 0, stars: 3, star2: 5, star3: 10, source: '授权',
          firstClaimed: '', desc: '取得' + type + '后自动关联', unlock: '取得对应授权后自动获得该标签',
          color: '#EB612A', createdAt: D.meta.demoNow, createdBy: '系统',
          updatedAt: D.meta.demoNow, updatedBy: '系统',
          audit: [{ time: D.meta.demoNow, actor: '系统', action: '创建授权属性勋章' }]
        });
      }
    });
    rows.forEach(function (row) {
      row.cells.forEach(function (item) {
        if (item.cell.kind !== 'actual' || item.cell.status === '已过期') return;
        if (BASE_TYPES.indexOf(item.type) > -1) return;
        const exists = (st.personAchievements || []).some(function (a) {
          return a.person === row.person.name && a.name === item.type && a.type === '人员标签';
        });
        if (!exists) {
          st.personAchievements.push({
            person: row.person.name, name: item.type, type: '人员标签', stars: 3, count: 1, source: '授权',
            firstClaimed: '', desc: '取得' + item.type + '后自动关联'
          });
        }
      });
    });
    const validAuthKeys = {};
    rows.forEach(function (row) {
      row.cells.forEach(function (item) {
        if (item.cell.kind !== 'actual' || item.cell.status === '已过期') return;
        validAuthKeys[row.person.name + '|' + item.type] = true;
      });
    });
    st.personAchievements = (st.personAchievements || []).filter(function (tag) {
      if (tag.type !== '人员标签' || COLUMNS.indexOf(tag.name) === -1) return true;
      return !!validAuthKeys[tag.person + '|' + tag.name];
    });
    // 基础资格（值班 / 入厂 / 安全培训）不生成属性勋章：清理历史定义与人员勋章
    st.wallTags = (st.wallTags || []).filter(function (tag) {
      return !(tag.type === '人员标签' && BASE_TYPES.indexOf(tag.name) > -1);
    });
    st.personAchievements = (st.personAchievements || []).filter(function (tag) {
      return !(tag.type === '人员标签' && BASE_TYPES.indexOf(tag.name) > -1);
    });
    (st.wallTags || []).forEach(function (tag) {
      if (tag.type === '人员标签' && COLUMNS.indexOf(tag.name) > -1) {
        tag.stars = 3;
        tag.source = '授权';
      }
    });
    (st.personAchievements || []).forEach(function (tag) {
      if (tag.type === '人员标签' && COLUMNS.indexOf(tag.name) > -1) {
        tag.stars = 3;
        tag.source = '授权';
        tag.count = tag.count || 1;
        tag.firstClaimed = '';
      }
    });
  }
  window.ITO_ENSURE_AUTH_TAGS = ensureTags;

  function detail(personName) {
    const row = buildRows().find(function (x) { return x.person.name === personName; });
    if (!row) return;
    const person = row.person;
    const group = ITO.getGroup(person.group) || {};
    const actualCount = row.cells.filter(function (x) { return x.cell.kind === 'actual' && x.cell.status !== '已过期'; }).length;
    const canCount = row.cells.filter(function (x) { return x.cell.kind === 'can'; }).length;
    const tags = (S().personAchievements || []).filter(function (a) {
      return a.person === person.name && a.type === '人员标签';
    }).map(function (a) { return '<span class="tag-inline">' + U().esc(a.name) + '</span>'; }).join('');
    const authRows = (S().auths || []).filter(function (a) { return a.person === person.name; }).map(function (a) {
      return '<tr><td>' + U().esc(a.type) + '</td><td class="num">' + U().esc(a.validTo) + '</td><td>' +
        U().badge(a.status === '已撤销' ? a.status : ITO.authStatus(a.validTo).status) + '</td></tr>';
    }).join('');
    const grid = function (types) {
      return '<div class="auth-detail-grid">' + types.map(function (type) {
        const item = row.cells.find(function (x) { return x.type === type; });
        return '<div class="auth-detail-cell">' +
          '<div class="auth-detail-name">' + U().esc(type) + '</div>' +
          '<div class="auth-detail-state">' + cellHtml(item.cell) + '</div>' +
        '</div>';
      }).join('') + '</div>';
    };
    U().detailModal({
      title: person.name,
      sub: person.uid + ' · ' + (group.name || '—') + ' · ' + (person.title || ''),
      body:
        '<div class="summary-grid" style="margin-bottom:16px">' +
          '<div class="summary-chip"><span class="icon green">' + U().icon('check') + '</span><div><b>' + actualCount + '</b><span>实际授权</span></div></div>' +
          '<div class="summary-chip"><span class="icon blue">' + U().icon('shield') + '</span><div><b>' + canCount + '</b><span>可拿未拿</span></div></div>' +
          '<div class="summary-chip"><span class="icon">' + U().icon('award') + '</span><div><b>' + (tags ? tags.split('</span>').length - 1 : 0) + '</b><span>属性勋章</span></div></div>' +
        '</div>' +
        '<div class="detail-section"><h4>基础资格</h4>' + grid(BASE_TYPES) + '</div>' +
        '<div class="detail-section"><h4>作业授权</h4>' + grid(WORK_TYPES) + '</div>' +
        '<div class="detail-section"><h4>属性勋章</h4><div>' + (tags || '<span class="muted">暂无</span>') + '</div></div>' +
        (authRows ? '<div class="detail-section"><h4>授权记录</h4><div class="table-wrap"><table class="data-table"><thead><tr><th>类型</th><th>有效期至</th><th>状态</th></tr></thead><tbody>' + authRows + '</tbody></table></div></div>' : ''),
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
      onMount: function (close, root) {
        root.querySelector('[data-close]').addEventListener('click', close);
      }
    });
  }

  P.auth = {
    render: function () {
      ensureTags();
      const st = S();
      const rows = buildRows();
      const isEmployee = st.role === 'employee' && !ITO.isSuper();
      const scoped = isEmployee
        ? rows.filter(function (row) { return row.person.name === st.user.name; })
        : rows;
      const summaryRows = isEmployee ? scoped : rows;
      const allActual = summaryRows.filter(function (row) {
        return row.cells.some(function (x) { return x.cell.kind === 'actual' && x.cell.status !== '已过期'; });
      }).length;
      const allCan = summaryRows.filter(function (row) {
        return row.cells.some(function (x) { return x.cell.kind === 'can'; });
      }).length;
      const expiring = summaryRows.reduce(function (n, row) {
        return n + row.cells.filter(function (x) { return x.cell.status === '临期'; }).length;
      }, 0);
      const expiredCells = summaryRows.reduce(function (n, row) {
        return n + row.cells.filter(function (x) { return x.cell.kind === 'actual' && x.cell.status === '已过期'; }).length;
      }, 0);
      const actualByType = {};
      COLUMNS.forEach(function (type) {
        actualByType[type] = summaryRows.reduce(function (n, row) {
          const item = row.cells.find(function (x) { return x.type === type; });
          return n + (item.cell.kind === 'actual' && item.cell.status !== '已过期' ? 1 : 0);
        }, 0);
      });
      const employeeCells = isEmployee ? scoped.flatMap(function (row) { return row.cells; }) : [];
      const employeeActual = employeeCells.filter(function (x) {
        return x.cell.kind === 'actual' && x.cell.status !== '已过期';
      }).length;
      const employeeCan = employeeCells.filter(function (x) { return x.cell.kind === 'can'; }).length;
      const employeeExpired = employeeCells.filter(function (x) {
        return x.cell.kind === 'actual' && x.cell.status === '已过期';
      }).length;
      const body = scoped.map(function (row) {
        return '<tr data-auth-person="' + U().esc(row.person.name) + '" data-auth-group="' + U().esc(row.person.group) + '" style="cursor:pointer">' +
          '<td class="auth-person-cell"><b>' + U().esc(row.person.name) + '</b></td>' +
          '<td class="auth-uid-cell mono">' + U().esc(row.person.uid) + '</td>' +
          '<td class="auth-group-cell">' + U().groupPill(row.person.group) + '</td>' +
          row.cells.map(function (item) {
            return '<td class="auth-status-cell ' + cellTone(item.cell) + '">' + cellHtml(item.cell) + '</td>';
          }).join('') +
        '</tr>';
      }).join('');
      const total = st.staff.length;
      const summaryHtml = isEmployee
        ? '<div class="summary-grid auth-summary">' +
            '<div class="summary-chip"><span class="icon green">' + U().icon('check') + '</span><div><b>' + employeeActual + ' 项</b><span>持证</span></div></div>' +
            '<div class="summary-chip"><span class="icon blue">' + U().icon('award') + '</span><div><b>' + employeeCan + ' 项</b><span>可拿未拿</span></div></div>' +
            '<div class="summary-chip"><span class="icon red">' + U().icon('clock') + '</span><div><b>' + expiring + ' 项</b><span>60 天内到期</span></div></div>' +
            '<div class="summary-chip"><span class="icon red">' + U().icon('alert') + '</span><div><b>' + employeeExpired + ' 项</b><span>已过期</span></div></div>' +
          '</div>'
        : '<div class="summary-grid auth-summary auth-summary-6">' +
            '<div class="summary-chip"><span class="icon">' + U().icon('users') + '</span><div><b>50</b><span>满编</span></div></div>' +
            '<div class="summary-chip"><span class="icon">' + U().icon('users') + '</span><div><b>' + total + '</b><span>当前在册</span></div></div>' +
            '<div class="summary-chip"><span class="icon blue">' + U().icon('shield') + '</span><div><b>' + total + '</b><span>计划持证</span></div></div>' +
            '<div class="summary-chip"><span class="icon green">' + U().icon('check') + '</span><div><b>' + allActual + '</b><span>实际持证</span></div></div>' +
            '<div class="summary-chip"><span class="icon">' + U().icon('award') + '</span><div><b>' + allCan + '</b><span>可拿未拿</span></div></div>' +
            '<div class="summary-chip"><span class="icon red">' + U().icon('clock') + '</span><div><b>' + expiring + '</b><span>60 天内到期</span></div></div>' +
            '<div class="summary-chip"><span class="icon red">' + U().icon('alert') + '</span><div><b>' + expiredCells + '</b><span>已过期</span></div></div>' +
          '</div>';
      return U().pageHead({
        title: isEmployee ? '我的授权' : '作业授权',
        sub: '12 类授权矩阵 · 只看有效期、临期与可拿授权 · 60 天内到期提醒',
        actions: '<button class="btn btn-ghost" id="authExportBtn" type="button">' + U().icon('download') + '导出矩阵</button>'
      }) +
      summaryHtml +
      '<div class="toolbar" style="margin-bottom:12px"><div class="filters">' +
        '<label class="search-field">' + U().icon('search') + '<input id="authSearch" type="search" placeholder="搜索姓名 / UID / 专业组"></label>' +
        '<select class="select" id="authGroup"><option value="">全部专业组</option>' + U().groupOptions('') + '</select>' +
      '</div>' + (isEmployee ? '' : '<span class="table-note" id="authCount">' + scoped.length + ' 人</span>') + '</div>' +
      '<section class="card table-card"><div class="table-wrap auth-table-wrap">' +
        '<table class="data-table auth-matrix"><thead><tr><th class="auth-person-cell"><span>员工姓名</span></th><th class="auth-uid-cell"><span>UID</span></th><th class="auth-group-cell"><span>专业组</span></th>' +
          COLUMNS.map(function (type) {
            return '<th><span>' + U().esc(type) + '</span>' +
              (isEmployee ? '' : '<small>实际 ' + actualByType[type] + '</small>') + '</th>';
          }).join('') +
        '</tr></thead><tbody>' + (body || '<tr><td colspan="15" class="muted" style="padding:24px;text-align:center">暂无授权数据</td></tr>') + '</tbody></table>' +
      '</div></section>' +
      '<div class="duty-notes">' +
        '<div class="card duty-note"><b>可拿授权</b><span>培训、体检已通过但尚未取得实际授权的，显示「可拿」。</span></div>' +
        '<div class="card duty-note"><b>提醒口径</b><span>有效授权在 60 天内到期进入临期提醒；过期授权只保留历史记录。</span></div>' +
        '<div class="card duty-note"><b>属性勋章</b><span>实际授权自动关联同名人员标签，授权过期后从勋章中隐藏。</span></div>' +
      '</div>';
    },

    after: function () {
      const st = S();
      const search = document.getElementById('authSearch');
      const group = document.getElementById('authGroup');
      const count = document.getElementById('authCount');
      function filter() {
        const q = (search ? search.value : '').trim().toLowerCase();
        let n = 0;
        U().$$('tr[data-auth-person]').forEach(function (row) {
          const hit = (!q || row.textContent.toLowerCase().indexOf(q) > -1) &&
            (!group || !group.value || row.dataset.authGroup === group.value);
          row.hidden = !hit;
          if (hit) n += 1;
        });
        if (count) count.textContent = n + ' 人';
      }
      if (search) search.addEventListener('input', filter);
      if (group) group.addEventListener('change', filter);
      U().$$('tr[data-auth-person]').forEach(function (row) {
        row.addEventListener('click', function () { detail(row.dataset.authPerson); });
      });
      const exp = document.getElementById('authExportBtn');
      if (exp) exp.addEventListener('click', function () {
        const rows = [['员工', 'UID', '专业组'].concat(COLUMNS)];
        buildRows().forEach(function (row) {
          rows.push([row.person.name, row.person.uid, (ITO.getGroup(row.person.group) || {}).name].concat(
            row.cells.map(function (x) { return x.cell.kind === 'none' ? '—' : x.cell.status + (x.cell.validTo ? ' 至 ' + x.cell.validTo : ''); })
          ));
        });
        U().exportPreview({ title: '授权矩阵导出预览', rows: rows, filename: 'ITO授权矩阵.csv' });
      });
    }
  };
})();
