/* ─────────────────────────────────────────────
   page · work authorizations
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const P = (window.ITO_PAGES = window.ITO_PAGES || {});
  const D = window.ITO_DATA;

  function S() { return ITO.state; }
  function U() { return ITO.ui; }

  const TYPES = ['工作负责人', '高风险作业', '准备工程师', '工作班成员'];

  function todayDate() { return new Date(D.meta.today.replace(/-/g, '/')); }

  function daysLeft(validTo) {
    return Math.round((new Date(validTo.replace(/-/g, '/')) - todayDate()) / 86400000);
  }

  function effective(a) {
    return a.status !== '已撤销' && daysLeft(a.validTo) >= 0;
  }

  function expiring(a) {
    const left = daysLeft(a.validTo);
    return a.status !== '已撤销' && left >= 0 && left <= 30;
  }

  function statusOf(a) {
    if (a.status === '已撤销') return '已撤销';
    return daysLeft(a.validTo) < 0 ? '已过期' : '有效';
  }

  function typeBadge(t) {
    const tone = { '工作负责人': 'blue', '高风险作业': 'red', '准备工程师': 'purple', '工作班成员': 'gray' };
    return '<span class="badge ' + (tone[t] || 'gray') + '">' + U().esc(t) + '</span>';
  }

  const AUTH = {};

  AUTH.renew = function (id) {
    const st = S();
    const a = st.auths.find(function (x) { return x.id === id; });
    if (!a) return;
    const d = new Date(a.validTo.replace(/-/g, '/'));
    d.setFullYear(d.getFullYear() + 1);
    const p = function (n) { return n < 10 ? '0' + n : n; };
    const next = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());

    U().modal({
      title: '授权续期',
      sub: a.id + ' · ' + a.person + ' · ' + a.type,
      body:
        '<div class="approve-grid">' +
          '<div class="detail-field"><label>授权类型</label><div>' + U().esc(a.type) + '</div></div>' +
          '<div class="detail-field"><label>当前有效期</label><div>' + a.validTo + '</div></div>' +
          '<div class="detail-field"><label>授权范围</label><div>' + U().esc(a.scope) + '</div></div>' +
          '<div class="detail-field"><label>状态</label><div>' + U().badge(statusOf(a)) + '</div></div>' +
        '</div>' +
        '<div class="form-grid" style="margin-top:16px">' +
          U().formRow({ label: '续期至', required: true, control: '<input id="auValid" type="date" value="' + next + '">' }) +
          U().formRow({ label: '续期说明', control: '<input id="auNote" type="text" placeholder="选填">' }) +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">确认续期</button>',
      onMount: function (close, root) {
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', function () {
          const val = root.querySelector('#auValid').value;
          if (!val) { U().toast('请选择新的有效期', 'warn'); return; }
          if (new Date(val.replace(/-/g, '/')) < todayDate()) { U().toast('有效期不能早于今天', 'warn'); return; }
          a.validTo = val;
          a.status = '有效';
          ITO.log('授权续期', a.id + ' ' + a.person + ' · 至 ' + val, '授权');
          close();
          U().toast('授权已续期至 ' + val);
          ITO.refresh();
        });
      }
    });
  };

  AUTH.revoke = function (id) {
    const st = S();
    const a = st.auths.find(function (x) { return x.id === id; });
    if (!a) return;
    U().confirm({
      title: '撤销授权',
      text: '确认撤销 ' + a.person + ' 的「' + a.type + '」授权？撤销后该人员将无法执行授权范围内的作业。',
      okText: '确认撤销',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      a.status = '已撤销';
      ITO.log('撤销授权', a.id + ' ' + a.person + ' · ' + a.type, '授权');
      U().toast('授权已撤销', 'warn');
      ITO.refresh();
    });
  };

  AUTH.restore = function (id) {
    const st = S();
    const a = st.auths.find(function (x) { return x.id === id; });
    if (!a) return;
    a.status = daysLeft(a.validTo) < 0 ? '已过期' : '有效';
    ITO.log('恢复授权', a.id + ' ' + a.person, '授权');
    U().toast('授权已恢复');
    ITO.refresh();
  };

  AUTH.create = function () {
    const st = S();
    const valid = new Date(D.meta.today.replace(/-/g, '/'));
    valid.setFullYear(valid.getFullYear() + 1);
    const validDefault = valid.getFullYear() + '-' + String(valid.getMonth() + 1).padStart(2, '0') + '-' + String(valid.getDate()).padStart(2, '0');
    U().modal({
      title: '新增作业授权',
      sub: '授权生效后将同步到任务派发与审批环节',
      wide: true,
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '授权人员', required: true, control: '<select id="auPerson">' + U().staffOptions('', '') + '</select>' }) +
          U().formRow({ label: '授权类型', required: true, control: '<select id="auType">' + U().statusOptions(TYPES, '工作负责人') + '</select>' }) +
          U().formRow({ label: '授权范围', required: true, full: true, control: '<input id="auScope" type="text" maxlength="40" placeholder="例如：应用系统变更与发布">' }) +
          U().formRow({ label: '有效期至', required: true, control: '<input id="auValidTo" type="date" value="' + validDefault + '">' }) +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">新增授权</button>',
      onMount: function (close, root) {
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', function () {
          const person = root.querySelector('#auPerson').value;
          const type = root.querySelector('#auType').value;
          const scope = root.querySelector('#auScope').value.trim();
          const validTo = root.querySelector('#auValidTo').value;
          if (!scope || !validTo) { U().toast('请补全授权范围与有效期', 'warn'); return; }
          st.authSeq = (st.authSeq || 187) + 1;
          const year = new Date(D.meta.today.replace(/-/g, '/')).getFullYear();
          const id = 'AU-' + year + '-' + String(st.authSeq).padStart(4, '0');
          const staff = st.staff.find(function (p) { return p.name === person; });
          st.auths.unshift({
            id: id, person: person, type: type, group: staff ? staff.group : 'app',
            scope: scope, validTo: validTo, status: '有效'
          });
          ITO.log('新增作业授权', id + ' ' + person + ' · ' + type, '授权');
          close();
          U().toast('授权已生效');
          ITO.refresh();
        });
      }
    });
  };

  P.auth = {
    render: function () {
      const st = S();
      const valid = st.auths.filter(effective).length;
      const soon = st.auths.filter(expiring).length;
      const expired = st.auths.filter(function (a) { return statusOf(a) === '已过期'; }).length;

      const rows = st.auths.map(function (a) {
        const status = statusOf(a);
        const left = daysLeft(a.validTo);
        return '<tr data-person="' + U().esc(a.person) + '" data-type="' + U().esc(a.type) + '" data-status="' + status + '">' +
          '<td class="mono">' + a.id + '</td>' +
          '<td><div class="person-cell">' + U().avatar(a.person, true) + '<div><b>' + U().esc(a.person) + '</b><small>' + U().esc((ITO.getGroup(a.group) || {}).name || '') + '</small></div></div></td>' +
          '<td>' + typeBadge(a.type) + '</td>' +
          '<td>' + U().esc(a.scope) + '</td>' +
          '<td class="num" style="white-space:nowrap">' + a.validTo + '</td>' +
          '<td><div class="status-inline">' + U().badge(status) +
            (status === '有效' && left <= 30 ? '<span class="text-yellow">' + left + ' 天后到期</span>' : '') + '</div></td>' +
          '<td><div class="row-actions">' +
            '<button class="btn btn-soft btn-sm" data-act="renew" data-id="' + a.id + '" type="button">续期</button>' +
            (status === '已撤销'
              ? '<button class="btn btn-ghost btn-sm" data-act="restore" data-id="' + a.id + '" type="button">恢复</button>'
              : '<button class="btn btn-danger btn-sm" data-act="revoke" data-id="' + a.id + '" type="button">撤销</button>') +
          '</div></td></tr>';
      }).join('');

      return U().pageHead({
        title: '作业授权',
        sub: '高风险作业、工作负责人与准备工程师授权台账 · 到期前 30 天自动提醒',
        actions:
          '<button class="btn btn-ghost" id="authExportBtn" type="button">' + U().icon('download') + '导出台账</button>' +
          '<button class="btn btn-primary" id="authNewBtn" type="button">' + U().icon('plus') + '新增授权</button>'
      }) +
      '<div class="summary-grid">' +
        '<div class="summary-chip"><span class="icon green">' + U().icon('check') + '</span><div><b>' + valid + '</b><span>有效授权</span></div></div>' +
        '<div class="summary-chip"><span class="icon">' + U().icon('clock') + '</span><div><b>' + soon + '</b><span>30 天内到期</span></div></div>' +
        '<div class="summary-chip"><span class="icon red">' + U().icon('alert') + '</span><div><b>' + expired + '</b><span>已过期</span></div></div>' +
        '<div class="summary-chip"><span class="icon blue">' + U().icon('shield') + '</span><div><b>' + st.auths.length + '</b><span>授权总数</span></div></div>' +
      '</div>' +

      '<div class="toolbar" style="margin-bottom:12px">' +
        '<div class="filters">' +
          '<label class="search-field">' + U().icon('search') + '<input id="authSearch" type="search" placeholder="搜索人员或授权范围"></label>' +
          '<select class="select" id="authType"><option value="">全部类型</option>' + U().statusOptions(TYPES, '') + '</select>' +
          '<select class="select" id="authStatus"><option value="">全部状态</option>' + U().statusOptions(['有效', '已过期', '已撤销'], '') + '</select>' +
        '</div>' +
        '<span class="table-note" id="authCount">' + st.auths.length + ' 条授权记录</span>' +
      '</div>' +

      '<section class="card table-card">' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>授权编号</th><th>人员</th><th>类型</th><th>授权范围</th><th>有效期至</th><th>状态</th><th style="text-align:right">操作</th></tr></thead>' +
        '<tbody id="authTbody">' + rows + '</tbody></table></div>' +
      '</section>' +

      '<div class="duty-notes">' +
        '<div class="card duty-note"><b>高风险作业</b><span>必须由具备高风险作业授权的人员担任工作负责人，并配套工作票与风险预控措施。</span></div>' +
        '<div class="card duty-note"><b>授权范围</b><span>授权仅在标注的专业组与作业范围内有效，跨组作业需重新申请。</span></div>' +
        '<div class="card duty-note"><b>到期管理</b><span>到期前 30 天进入提醒，逾期未续期将自动阻断派发与审批。</span></div>' +
      '</div>';
    },

    after: function () {
      const st = S();

      U().$$('[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.dataset.act === 'renew') AUTH.renew(btn.dataset.id);
          if (btn.dataset.act === 'revoke') AUTH.revoke(btn.dataset.id);
          if (btn.dataset.act === 'restore') AUTH.restore(btn.dataset.id);
        });
      });

      function applyFilter() {
        const q = (document.getElementById('authSearch').value || '').trim().toLowerCase();
        const type = document.getElementById('authType').value;
        const status = document.getElementById('authStatus').value;
        let n = 0;
        U().$$('#authTbody tr').forEach(function (tr) {
          const hit = (!q || (tr.dataset.person + ' ' + tr.textContent).toLowerCase().indexOf(q) > -1) &&
            (!type || tr.dataset.type === type) && (!status || tr.dataset.status === status);
          tr.hidden = !hit;
          if (hit) n += 1;
        });
        document.getElementById('authCount').textContent = n + ' 条授权记录';
      }

      ['authSearch', 'authType', 'authStatus'].forEach(function (id) {
        const node = document.getElementById(id);
        if (!node) return;
        node.addEventListener(node.tagName === 'INPUT' ? 'input' : 'change', applyFilter);
      });

      const add = document.getElementById('authNewBtn');
      if (add) add.addEventListener('click', AUTH.create);

      const exp = document.getElementById('authExportBtn');
      if (exp) exp.addEventListener('click', function () {
        const rows = [['授权编号', '人员', '类型', '专业组', '授权范围', '有效期至', '状态']];
        st.auths.forEach(function (a) {
          rows.push([a.id, a.person, a.type, (ITO.getGroup(a.group) || {}).name, a.scope, a.validTo, statusOf(a)]);
        });
        U().download('ITO作业授权台账.csv', U().csv(rows));
        ITO.log('导出授权台账', st.auths.length + ' 条', '授权');
        U().toast('授权台账已导出');
      });
    }
  };
})();
