/* ─────────────────────────────────────────────
   page · work authorizations
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const P = (window.ITO_PAGES = window.ITO_PAGES || {});
  const D = window.ITO_DATA;

  function S() { return ITO.state; }
  function U() { return ITO.ui; }

  const TYPES = [
    '工作负责人授权', '准备工程师授权', '高风险作业授权',
    'RP1 授权', 'RP2 授权', '登高车作业授权',
    '低压电工证', '高压电工证', '工具库授权'
  ];

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
    const tone = {
      '工作负责人授权': 'blue',
      '准备工程师授权': 'purple',
      '高风险作业授权': 'red',
      'RP1 授权': 'green',
      'RP2 授权': 'green',
      '登高车作业授权': 'yellow',
      '低压电工证': 'yellow',
      '高压电工证': 'red',
      '工具库授权': 'gray'
    };
    return '<span class="badge ' + (tone[t] || 'gray') + '">' + U().esc(t) + '</span>';
  }

  const AUTH = {};

  AUTH.renew = function (id) {
    const st = S();
    const a = st.auths.find(function (x) { return x.id === id; });
    if (!a) return;

    function fmt(d) {
      const p = function (n) { return n < 10 ? '0' + n : n; };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
    function baseDate() {
      const d = new Date(a.validTo.replace(/-/g, '/'));
      return isNaN(d.getTime()) ? new Date(D.meta.today.replace(/-/g, '/')) : d;
    }
    function addDays(days) {
      const d = baseDate();
      d.setDate(d.getDate() + Number(days || 0));
      return fmt(d);
    }
    const years = [];
    const baseYear = baseDate().getFullYear();
    for (let y = baseYear; y <= baseYear + 10; y += 1) years.push(y);
    const yearOptions = '<option value="">年份</option>' + years.map(function (y) {
      return '<option value="' + y + '">' + y + ' 年</option>';
    }).join('');
    const quick = [30, 60, 90, 180, 365].map(function (n) {
      return '<button class="btn btn-ghost btn-sm" data-days="' + n + '" type="button">' + n + ' 天</button>';
    }).join('');

    U().modal({
      title: '授权续期',
      sub: a.id + ' · ' + a.person + ' · ' + a.type,
      wide: true,
      body:
        '<div class="approve-grid">' +
          '<div class="detail-field"><label>授权类型</label><div>' + U().esc(a.type) + '</div></div>' +
          '<div class="detail-field"><label>当前有效期</label><div>' + a.validTo + '</div></div>' +
          '<div class="detail-field"><label>授权说明</label><div>' + U().esc(a.scope || '—') + '</div></div>' +
          '<div class="detail-field"><label>状态</label><div>' + U().badge(statusOf(a)) + '</div></div>' +
        '</div>' +
        '<div class="form-grid" style="margin-top:16px">' +
          U().formRow({ label: '续期天数', control: '<input id="auDays" type="number" min="1" max="3650" placeholder="例如：60"><div class="quick-days">' + quick + '</div><span class="form-hint">从当前有效期往后计算，可直接改下方日期</span>' }) +
          U().formRow({ label: '续期至', required: true, control: '<div class="date-with-year"><input id="auValid" type="date"><select id="auYear">' + yearOptions + '</select></div>' }) +
          U().formRow({ label: '续期说明', full: true, control: '<input id="auNote" type="text" placeholder="选填">' }) +
        '</div>' +
        '<p class="renew-preview" id="auPreview">填写续期天数或直接选择日期</p>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">确认续期</button>',
      onMount: function (close, root) {
        const daysEl = root.querySelector('#auDays');
        const validEl = root.querySelector('#auValid');
        const yearEl = root.querySelector('#auYear');
        const preview = root.querySelector('#auPreview');
        const noteEl = root.querySelector('#auNote');

        function paintPreview() {
          yearEl.value = validEl.value ? validEl.value.slice(0, 4) : '';
          if (yearEl.__syncPicker) yearEl.__syncPicker();
          if (!validEl.value) { preview.textContent = '填写续期天数或直接选择日期'; return; }
          preview.innerHTML = '续期至 <b>' + validEl.value + '</b>';
        }
        function setDate(value) {
          validEl.value = value || '';
          validEl.dispatchEvent(new Event('input', { bubbles: true }));
          paintPreview();
        }
        daysEl.addEventListener('input', function () {
          if (!daysEl.value) { setDate(''); return; }
          setDate(addDays(daysEl.value));
        });
        root.querySelectorAll('[data-days]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            daysEl.value = btn.dataset.days;
            setDate(addDays(btn.dataset.days));
          });
        });
        validEl.addEventListener('change', paintPreview);
        yearEl.addEventListener('change', function () {
          const monthDay = validEl.value ? validEl.value.slice(4) : a.validTo.slice(4);
          setDate(String(yearEl.value) + monthDay);
        });
        U().bindFieldClear(root);
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', function () {
          const ok = U().validateRequired([[validEl, '请选择新的有效期']]);
          if (!ok) return;
          const val = validEl.value;
          if (new Date(val.replace(/-/g, '/')) < todayDate()) {
            U().showFieldError(validEl, '有效期不能早于今天');
            return;
          }
          const old = a.validTo;
          a.renewals = a.renewals || [];
          a.renewals.push({ at: D.meta.today, from: old, to: val });
          a.validTo = val;
          a.status = '有效';
          a.updatedAt = D.meta.demoNow;
          a.updatedBy = st.user.name;
          a.audit = a.audit || [];
          a.audit.push({ time: D.meta.demoNow, actor: st.user.name, action: '续期至 ' + val });
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
      a.updatedAt = D.meta.demoNow;
      a.updatedBy = st.user.name;
      a.audit = a.audit || [];
      a.audit.push({ time: D.meta.demoNow, actor: st.user.name, action: '撤销授权' });
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
    a.updatedAt = D.meta.demoNow;
    a.updatedBy = st.user.name;
    a.audit = a.audit || [];
    a.audit.push({ time: D.meta.demoNow, actor: st.user.name, action: '恢复授权' });
    ITO.log('恢复授权', a.id + ' ' + a.person, '授权');
    U().toast('授权已恢复');
    ITO.refresh();
  };

  AUTH.create = function () {
    const st = S();
    U().modal({
      title: '新增作业授权',
      sub: '授权生效后将同步到任务派发与审批环节',
      wide: true,
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '授权人员', required: true, control: '<select id="auPerson"><option value="">请选择授权人员</option>' + U().staffOptions('', '') + '</select>' }) +
          U().formRow({ label: '授权类型', required: true, control: '<select id="auType"><option value="">请选择授权类型</option>' + U().statusOptions(TYPES, '') + '</select>' }) +
          U().formRow({ label: '授权说明', full: true, control: '<input id="auScope" type="text" maxlength="40" placeholder="选填，例如：应用系统变更与发布">' }) +
          U().formRow({ label: '有效期至', required: true, control: '<div class="date-with-year"><input id="auValidTo" type="date"><select id="auYear">' + (function () {
            const y = new Date(D.meta.today.replace(/-/g, '/')).getFullYear();
            const out = ['<option value="">年份</option>'];
            for (let i = y; i <= y + 10; i += 1) out.push('<option value="' + i + '">' + i + ' 年</option>');
            return out.join('');
          })() + '</select></div>' }) +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-ok type="button">新增授权</button>',
      onMount: function (close, root) {
        const personEl = root.querySelector('#auPerson');
        const typeEl = root.querySelector('#auType');
        const validEl = root.querySelector('#auValidTo');
        const yearEl = root.querySelector('#auYear');
        const scopeEl = root.querySelector('#auScope');
        U().bindFieldClear(root);
        yearEl.addEventListener('change', function () {
          if (!yearEl.value) return;
          const monthDay = validEl.value ? validEl.value.slice(4) : '-' + D.meta.today.slice(5);
          validEl.value = String(yearEl.value) + monthDay;
          validEl.dispatchEvent(new Event('input', { bubbles: true }));
        });
        validEl.addEventListener('change', function () {
          yearEl.value = validEl.value ? validEl.value.slice(0, 4) : '';
          if (yearEl.__syncPicker) yearEl.__syncPicker();
        });
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-ok]').addEventListener('click', function () {
          const ok = U().validateRequired([
            [personEl, '请选择授权人员'],
            [typeEl, '请选择授权类型'],
            [validEl, '请选择有效期']
          ]);
          if (!ok) return;
          const person = personEl.value;
          const type = typeEl.value;
          const scope = scopeEl.value.trim();
          const validTo = validEl.value;
          st.authSeq = (st.authSeq || 187) + 1;
          const year = new Date(D.meta.today.replace(/-/g, '/')).getFullYear();
          const id = 'AU-' + year + '-' + String(st.authSeq).padStart(4, '0');
          const staff = st.staff.find(function (p) { return p.name === person; });
          const now = D.meta.demoNow;
          st.auths.unshift({
            id: id, person: person, type: type, group: staff ? staff.group : 'app',
            scope: scope, validTo: validTo, status: '有效',
            createdAt: now, createdBy: st.user.name, updatedAt: now, updatedBy: st.user.name,
            audit: [{ time: now, actor: st.user.name, action: '创建授权' }]
          });
          ITO.log('新增作业授权', id + ' ' + person + ' · ' + type, '授权');
          close();
          U().toast('授权已生效');
          ITO.refresh();
        });
      }
    });
  };

  AUTH.detail = function (id) {
    const st = S();
    const a = st.auths.find(function (x) { return x.id === id; });
    if (!a) return;
    const group = ITO.getGroup(a.group) || {};
    const renewals = a.renewals || [];
    const audit = (a.audit && a.audit.length ? a.audit.slice() : [{
      time: a.createdAt || '—',
      actor: a.createdBy || '—',
      action: '创建授权'
    }]).reverse();
    U().detailModal({
      title: a.person + ' · ' + a.type,
      sub: a.id + ' · ' + (group.name || '—'),
      body:
        '<div class="detail-grid">' +
          '<div class="detail-field"><label>授权人员</label><div>' + U().esc(a.person) + '</div></div>' +
          '<div class="detail-field"><label>专业组</label><div>' + U().esc(group.name || '—') + '</div></div>' +
          '<div class="detail-field"><label>授权类型</label><div>' + U().esc(a.type) + '</div></div>' +
          '<div class="detail-field"><label>状态</label><div>' + U().badge(statusOf(a)) + '</div></div>' +
          '<div class="detail-field"><label>当前有效期</label><div>' + U().esc(a.validTo) + '</div></div>' +
          '<div class="detail-field"><label>续期次数</label><div>' + renewals.length + ' 次</div></div>' +
          '<div class="detail-field"><label>授权说明</label><div>' + U().esc(a.scope || '—') + '</div></div>' +
          '<div class="detail-field"><label>创建</label><div>' + U().esc((a.createdAt || '—') + ' · ' + (a.createdBy || '—')) + '</div></div>' +
        '</div>' +
        (renewals.length ? '<div class="detail-section"><h4>续期记录</h4><div class="mini-list">' + renewals.slice().reverse().map(function (r) {
          return '<div class="mini-row"><span class="dot" style="background:var(--brand)"></span>' +
            '<div class="txt"><b>' + U().esc(r.from) + ' → ' + U().esc(r.to) + '</b><span>' + U().esc(r.at) + '</span></div></div>';
        }).join('') + '</div></div>' : '') +
        '<div class="detail-section"><h4>操作记录</h4><div class="timeline">' + audit.map(function (entry) {
          return '<div class="timeline-item"><b>' + U().esc(entry.action) + ' · ' + U().esc(entry.actor) + '</b><span>' + U().esc(entry.time) + '</span></div>';
        }).join('') + '</div></div>',
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
      onMount: function (close, root) {
        root.querySelector('[data-close]').addEventListener('click', close);
      }
    });
  };

  P.authLegacy = {
    render: function () {
      const st = S();
      const isEmployee = st.role === 'employee' && !ITO.isSuper();
      const isLeader = ITO.roleIs('leader');
      const canManageAuth = ITO.roleIs('manager', 'leader');
      const canCreateAuth = ITO.roleIs('manager');
      const scopedAuths = isEmployee ? st.auths.filter(function (a) { return a.person === st.user.name; }) : st.auths;
      const valid = scopedAuths.filter(effective).length;
      const soon = scopedAuths.filter(expiring).length;
      const expired = scopedAuths.filter(function (a) { return statusOf(a) === '已过期'; }).length;

      const rows = scopedAuths.map(function (a) {
        const status = statusOf(a);
        const left = daysLeft(a.validTo);
        return '<tr data-person="' + U().esc(a.person) + '" data-type="' + U().esc(a.type) + '" data-status="' + status + '">' +
          '<td class="mono">' + a.id +
            '<small class="table-note" style="display:block">' + U().esc((a.createdAt || '—') + ' · ' + (a.createdBy || '—')) + '</small></td>' +
          '<td><div class="person-cell"><div><b>' + U().esc(a.person) + '</b><small>' + U().esc((ITO.getGroup(a.group) || {}).name || '') + '</small></div></div></td>' +
          '<td>' + typeBadge(a.type) + '</td>' +
          '<td>' + U().esc(a.scope || '—') + '</td>' +
          '<td class="num" style="white-space:nowrap">' + a.validTo +
            ((a.renewals && a.renewals.length) ? '<small class="table-note" style="display:block">已续期 ' + a.renewals.length + ' 次</small>' : '') + '</td>' +
          '<td><div class="status-inline">' + U().badge(status) +
            (status === '有效' && left <= 30 ? '<span class="text-yellow">' + left + ' 天后到期</span>' : '') + '</div>' +
            (a.updatedAt ? '<small class="table-note" style="display:block">' + U().esc(a.updatedAt + ' · ' + (a.updatedBy || '—')) + '</small>' : '') + '</td>' +
          '<td><div class="row-actions">' +
            '<button class="btn btn-ghost btn-sm" data-act="view" data-id="' + a.id + '" type="button">记录</button>' +
            (canManageAuth
              ? '<button class="btn btn-soft btn-sm" data-act="renew" data-id="' + a.id + '" type="button">续期</button>' +
                (status === '已撤销'
                  ? '<button class="btn btn-ghost btn-sm" data-act="restore" data-id="' + a.id + '" type="button">恢复</button>'
                  : '<button class="btn btn-danger btn-sm" data-act="revoke" data-id="' + a.id + '" type="button">撤销</button>')
              : '') +
          '</div></td></tr>';
      }).join('') || '<tr><td colspan="7"><p class="muted" style="padding:24px;text-align:center">暂无授权记录</p></td></tr>';

      return U().pageHead({
        title: isEmployee ? '我的授权' : '作业授权',
        sub: isEmployee ? '本人作业授权与到期提醒 · 只读' : '工作负责人、高风险作业、准备工程师等 9 类授权台账 · 到期前 30 天自动提醒',
        actions:
          (canManageAuth ? '<button class="btn btn-ghost" id="authExportBtn" type="button">' + U().icon('download') + '导出台账</button>' : '') +
          (canCreateAuth ? '<button class="btn btn-primary" id="authNewBtn" type="button">' + U().icon('plus') + '新增授权</button>' : '')
      }) +
      '<div class="summary-grid">' +
        '<div class="summary-chip"><span class="icon green">' + U().icon('check') + '</span><div><b>' + valid + '</b><span>有效授权</span></div></div>' +
        '<div class="summary-chip"><span class="icon">' + U().icon('clock') + '</span><div><b>' + soon + '</b><span>30 天内到期</span></div></div>' +
        '<div class="summary-chip"><span class="icon red">' + U().icon('alert') + '</span><div><b>' + expired + '</b><span>已过期</span></div></div>' +
        '<div class="summary-chip"><span class="icon blue">' + U().icon('shield') + '</span><div><b>' + scopedAuths.length + '</b><span>授权总数</span></div></div>' +
      '</div>' +

      '<div class="toolbar" style="margin-bottom:12px">' +
        '<div class="filters">' +
          '<label class="search-field">' + U().icon('search') + '<input id="authSearch" type="search" placeholder="搜索人员或授权说明"></label>' +
          '<select class="select" id="authType"><option value="">全部类型</option>' + U().statusOptions(TYPES, '') + '</select>' +
          '<select class="select" id="authStatus"><option value="">全部状态</option>' + U().statusOptions(['有效', '已过期', '已撤销'], '') + '</select>' +
        '</div>' +
        '<span class="table-note" id="authCount">' + scopedAuths.length + ' 条授权记录</span>' +
      '</div>' +

      '<section class="card table-card">' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>授权编号</th><th>人员</th><th>类型</th><th>授权说明</th><th>有效期至</th><th>状态</th><th style="text-align:right">操作</th></tr></thead>' +
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
          if (btn.dataset.act === 'view') AUTH.detail(btn.dataset.id);
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
        const rows = [['授权编号', '人员', '类型', '专业组', '授权说明', '有效期至', '状态']];
        st.auths.forEach(function (a) {
          rows.push([a.id, a.person, a.type, (ITO.getGroup(a.group) || {}).name, a.scope, a.validTo, statusOf(a)]);
        });
        U().exportPreview({ title: '作业授权台账导出预览', rows: rows, filename: 'ITO作业授权台账.csv' });
        ITO.log('预览授权台账', st.auths.length + ' 条', '授权');
        U().toast('授权台账预览已打开');
      });
    }
  };
})();
