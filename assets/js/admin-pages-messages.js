/* ─────────────────────────────────────────────
   pages · messages & alert rules
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const P = (window.ITO_PAGES = window.ITO_PAGES || {});
  const D = window.ITO_DATA;

  function S() { return ITO.state; }
  function U() { return ITO.ui; }

  /* ── messages ────────────────────────────── */
  const MSG = {};

  const TYPE_ICON = { '审批': 'shield', '超期': 'alert', '巡检': 'clipboard', '值班': 'calendar', '发布': 'send', '报表': 'chart', '通知': 'send' };
  const TYPE_TONE = { '审批': 'blue', '超期': 'yellow', '巡检': 'green', '值班': '', '发布': 'blue', '报表': '', '通知': 'blue' };
  const TYPE_LINK = { '审批': '#/dispatch', '超期': '#/tasks', '巡检': '#/inspection', '值班': '#/duty', '发布': '#/tasks', '报表': '#/personal', '通知': '#/messages' };

  function visibleMessages() {
    const st = S();
    return st.messages.filter(function (m) {
      if (!m.audience) return true;
      if (st.role === 'admin' || st.role === 'leader' || ITO.isSuper()) return true;
      const me = st.staff.find(function (p) { return p.name === st.user.name; });
      const groupId = me ? me.group : (st.groups.find(function (g) { return g.manager === st.user.name; }) || {}).id;
      if (m.audience.type === 'person') return m.audience.value === st.user.name;
      if (m.audience.type === 'group') return groupId === m.audience.value;
      const groups = m.audience.groups || [];
      const people = m.audience.people || [];
      if (!groups.length && !people.length) return true;
      return people.indexOf(st.user.name) > -1 || groups.indexOf(groupId) > -1;
    });
  }

  function hashId() {
    const raw = (location.hash.split('?')[1] || '');
    const hit = raw.split('&').find(function (p) { return p.indexOf('id=') === 0; });
    return hit ? decodeURIComponent(hit.slice(3)) : '';
  }

  function iconBox(msg) {
    return '<div class="msg-icon ' + (TYPE_TONE[msg.type] || '') + '">' + U().icon(TYPE_ICON[msg.type] || 'message') + '</div>';
  }

  MSG.open = function (id) {
    const st = S();
    const msg = st.messages.find(function (m) { return m.id === id; });
    if (!msg) return;
    msg.read = true;
    ITO.refresh();

    const link = TYPE_LINK[msg.type] || '#/messages';
    const isNotice = msg.type === '通知';
    const canOpen = !isNotice && ITO.can(link.replace(/^#\//, ''));

    U().detailModal({
      title: msg.title,
      sub: msg.id + ' · ' + msg.type + ' · ' + msg.time,
      body:
        '<div class="msg-detail-head">' + iconBox(msg) +
          '<div><b>' + U().esc(msg.type) + '</b><span>' + (msg.read ? '已读' : '未读') + ' · ' + (msg.sender ? '由 ' + U().esc(msg.sender) + ' 发送' : '系统通知') + '</span></div></div>' +
        '<p class="msg-detail-body">' + U().esc(msg.body) + '</p>' +
        (canOpen ? '<div class="detail-section"><h4>处理建议</h4><p class="msg-detail-tip">' + U().esc(
          msg.type === '审批' ? '进入「派发与审批」核对授权范围与工作票，完成通过或驳回。' :
          msg.type === '超期' ? '进入「任务管理」按超期筛选，联系负责人确认新的交付时间。' :
          msg.type === '巡检' ? '进入「巡检管理」查看异常项，并跟踪系统生成的整改任务。' :
          msg.type === '值班' ? '进入「值班管理」确认交接班人员与未闭环事项。' :
          msg.type === '发布' ? '进入「任务管理」核对发布任务的回归验证与归档状态。' :
          '进入「个人统计」查看当月任务与属性勋章，并导出个人月报。'
        ) + '</p></div>' : ''),
      foot: '<button class="btn btn-ghost" data-unread type="button">标为未读</button><span class="spacer"></span>' +
        '<button class="btn btn-ghost" data-close type="button">关闭</button>' +
        (canOpen ? '<a class="btn btn-primary" href="' + link + '">前往处理' + U().icon('arrow') + '</a>' : ''),
      onMount: function (close, root) {
        root.querySelector('[data-close]').addEventListener('click', close);
        root.querySelector('[data-unread]').addEventListener('click', function () {
          msg.read = false;
          ITO.log('标记消息未读', msg.id + ' ' + msg.title, '消息');
          close();
          ITO.refresh();
        });
      }
    });
  };

  MSG.send = function () {
    const st = S();
    if (st.role === 'employee' && !ITO.isSuper()) return;
    const myGroupId = (st.staff.find(function (p) { return p.name === st.user.name; }) || {}).group ||
      (st.groups.find(function (g) { return g.manager === st.user.name; }) || {}).id;
    const managerScope = st.role === 'manager' && !ITO.isSuper();
    const groupPool = managerScope
      ? st.groups.filter(function (g) { return g.id === myGroupId; })
      : st.groups;
    const personPool = managerScope
      ? st.staff.filter(function (p) { return p.group === myGroupId; })
      : st.staff;
    const groupRows = groupPool.map(function (g) {
      const count = st.staff.filter(function (p) { return p.group === g.id; }).length;
      return '<label class="msg-recipient-item" data-search="' + U().esc((g.name + ' ' + g.code + ' 分组').toLowerCase()) + '">' +
        '<input type="checkbox" data-kind="group" value="' + g.id + '">' +
        '<span class="ri-main"><b>' + U().esc(g.name) + '</b><small>' + U().esc(g.code) + ' · ' + count + ' 人</small></span>' +
        '</label>';
    }).join('');
    const personRows = personPool.map(function (p) {
      const g = ITO.getGroup(p.group) || {};
      return '<label class="msg-recipient-item" data-search="' + U().esc((p.name + ' ' + (g.name || '') + ' ' + (p.title || '')).toLowerCase()) + '">' +
        '<input type="checkbox" data-kind="person" value="' + U().esc(p.name) + '">' +
        '<span class="ri-main"><b>' + U().esc(p.name) + '</b><small>' + U().esc((g.name || '') + ' · ' + (p.title || '') + '') + '</small></span>' +
        '</label>';
    }).join('');

    U().modal({
      title: '发送消息',
      sub: '标题、正文与接收范围',
      wide: true,
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '标题', required: true, full: true, control: '<input id="msgSendTitle" type="text" maxlength="40" placeholder="例如：本周值班调整通知">' }) +
          U().formRow({ label: '正文', required: true, full: true, control: '<textarea id="msgSendBody" placeholder="填写要发送的内容"></textarea>' }) +
        '</div>' +
        '<div class="msg-recipient">' +
          '<div class="msg-recipient-head"><div><b>接收范围</b><span id="msgSelectedCount">已选 0 个分组 / 0 人</span></div>' +
            '<div class="msg-recipient-actions"><button class="btn btn-ghost btn-sm" data-recipient-all type="button">全选当前</button>' +
              '<button class="btn btn-ghost btn-sm" data-recipient-clear type="button">清空</button></div></div>' +
          '<div class="msg-recipient-search"><label class="search-field">' + U().icon('search') + '<input id="msgRecipientSearch" type="search" placeholder="搜索分组或人员"></label></div>' +
          '<div class="tabs msg-recipient-tabs"><button class="tab active" data-recipient-tab="group" type="button">分组</button><button class="tab" data-recipient-tab="person" type="button">人员</button></div>' +
          '<div class="msg-recipient-list" id="msgGroupList">' + groupRows + '</div>' +
          '<div class="msg-recipient-list" id="msgPersonList" hidden>' + personRows + '</div>' +
          '<div class="msg-selected-chips" id="msgSelectedChips"><span class="muted">尚未选择接收人</span></div>' +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-send type="button">发送</button>',
      onMount: function (close, root) {
        const groupList = root.querySelector('#msgGroupList');
        const personList = root.querySelector('#msgPersonList');
        const search = root.querySelector('#msgRecipientSearch');
        const chips = root.querySelector('#msgSelectedChips');
        const countLabel = root.querySelector('#msgSelectedCount');
        let activeTab = 'group';

        function checked(kind) {
          return Array.prototype.map.call(root.querySelectorAll('input[data-kind="' + kind + '"]:checked'), function (input) { return input.value; });
        }

        function labelFor(input) {
          const item = input.closest('.msg-recipient-item');
          return item ? item.querySelector('.ri-main b').textContent : input.value;
        }

        function updateSelection() {
          const groups = checked('group');
          const people = checked('person');
          countLabel.textContent = '已选 ' + groups.length + ' 个分组 / ' + people.length + ' 人';
          root.querySelectorAll('.msg-recipient-item').forEach(function (item) {
            item.classList.toggle('selected', !!item.querySelector('input').checked);
          });
          const picked = Array.prototype.map.call(root.querySelectorAll('input:checked'), function (input) {
            return { kind: input.dataset.kind, value: input.value, label: labelFor(input) };
          });
          chips.innerHTML = picked.length ? picked.map(function (p) {
            return '<button class="msg-chip" type="button" data-chip-kind="' + p.kind + '" data-chip-value="' + U().esc(p.value) + '">' +
              U().esc(p.label) + '<span>×</span></button>';
          }).join('') : '<span class="muted">尚未选择接收人</span>';
        }

        function filterList() {
          const q = search.value.trim().toLowerCase();
          root.querySelectorAll('.msg-recipient-item').forEach(function (item) {
            item.hidden = !!q && item.dataset.search.indexOf(q) === -1;
          });
        }

        root.addEventListener('change', function (e) {
          if (e.target.matches('input[data-kind]')) updateSelection();
        });

        root.querySelectorAll('[data-recipient-tab]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            activeTab = btn.dataset.recipientTab;
            root.querySelectorAll('[data-recipient-tab]').forEach(function (b) { b.classList.toggle('active', b === btn); });
            groupList.hidden = activeTab !== 'group';
            personList.hidden = activeTab !== 'person';
          });
        });

        search.addEventListener('input', filterList);

        root.querySelector('[data-recipient-all]').addEventListener('click', function () {
          const target = activeTab === 'group' ? groupList : personList;
          target.querySelectorAll('input[data-kind]').forEach(function (input) {
            if (!input.closest('.msg-recipient-item').hidden) input.checked = true;
          });
          updateSelection();
        });

        root.querySelector('[data-recipient-clear]').addEventListener('click', function () {
          root.querySelectorAll('input[data-kind]').forEach(function (input) { input.checked = false; });
          updateSelection();
        });

        chips.addEventListener('click', function (e) {
          const chip = e.target.closest('[data-chip-kind]');
          if (!chip) return;
          const input = root.querySelector('input[data-kind="' + chip.dataset.chipKind + '"][value="' + chip.dataset.chipValue.replace(/"/g, '\\"') + '"]');
          if (input) input.checked = false;
          updateSelection();
        });

        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-send]').addEventListener('click', function () {
          const title = root.querySelector('#msgSendTitle').value.trim();
          const body = root.querySelector('#msgSendBody').value.trim();
          const groups = checked('group');
          const people = checked('person');
          if (!title || !body) { U().toast('请填写标题与正文', 'warn'); return; }
          if (!groups.length && !people.length) { U().toast('请选择分组或人员', 'warn'); return; }
          st.msgSeq = (st.msgSeq || 0) + 1;
          st.messages.unshift({
            id: 'MSG-S' + String(st.msgSeq).padStart(2, '0'),
            type: '通知',
            title: title,
            body: body,
            time: D.meta.demoNow,
            read: false,
            audience: { groups: groups, people: people },
            sender: st.user.name
          });
          const groupNames = groupPool.filter(function (g) { return groups.indexOf(g.id) > -1; }).map(function (g) { return g.name; });
          ITO.log('发送消息', title + ' · ' + groupNames.concat(people).join(' / '), '消息');
          U().toast('消息已发送');
          close();
          ITO.refresh();
        });
      }
    });
  };

  P.messages = {
    render: function () {
      const st = S();
      st.ui = st.ui || {};
      const tab = st.ui.msgTab || 'all';
      const type = st.ui.msgType || '';
      const list = visibleMessages();
      const unread = list.filter(function (m) { return !m.read; }).length;
      const today = list.filter(function (m) { return m.time.indexOf(D.meta.today) === 0; }).length;
      const types = Array.from(new Set(list.map(function (m) { return m.type; })));

      const rows = list.map(function (m) {
        return '<div class="msg-item' + (m.read ? '' : ' unread') + '" data-msg="' + m.id + '" data-type="' + U().esc(m.type) + '" data-read="' + (m.read ? '1' : '0') + '" tabindex="0" role="button">' +
          iconBox(m) +
          '<div class="msg-body">' +
            '<div class="msg-title-row"><b>' + U().esc(m.title) + '</b>' + (m.read ? '' : '<span class="msg-unread-dot"></span>') + '</div>' +
            '<p>' + U().esc(m.body) + '</p>' +
            '<div class="msg-meta"><span class="tag-inline">' + U().esc(m.type) + '</span><span>' + m.id + '</span></div>' +
          '</div>' +
          '<span class="msg-time">' + U().shortDate(m.time) + '</span>' +
        '</div>';
      }).join('');

      return U().pageHead({
        title: '站内消息',
        sub: '审批、超期、巡检与值班通知统一收口 · 未读 ' + unread + ' 条',
        actions:
          '<button class="btn btn-ghost" id="msgReadAll" type="button"' + (unread ? '' : ' disabled') + '>' + U().icon('check') + '全部标为已读</button>' +
          (st.role !== 'employee' ? '<button class="btn btn-primary" id="msgSendBtn" type="button">' + U().icon('plus') + '发送消息</button>' : '')
      }) +
      '<div class="summary-grid">' +
        '<div class="summary-chip"><span class="icon">' + U().icon('message') + '</span><div><b>' + unread + '</b><span>未读消息</span></div></div>' +
        '<div class="summary-chip"><span class="icon blue">' + U().icon('calendar') + '</span><div><b>' + today + '</b><span>今日新增</span></div></div>' +
        '<div class="summary-chip"><span class="icon yellow">' + U().icon('clock') + '</span><div><b>' + list.filter(function (m) { return m.type === '审批' && !m.read; }).length + '</b><span>待审批提醒</span></div></div>' +
        '<div class="summary-chip"><span class="icon green">' + U().icon('check') + '</span><div><b>' + (list.length - unread) + '</b><span>已读消息</span></div></div>' +
      '</div>' +

      '<div class="msg-toolbar">' +
        '<div class="tabs">' +
          '<button class="tab' + (tab === 'all' ? ' active' : '') + '" data-msg-tab="all" type="button">全部</button>' +
          '<button class="tab' + (tab === 'unread' ? ' active' : '') + '" data-msg-tab="unread" type="button">未读</button>' +
        '</div>' +
        '<div class="filters">' +
          '<select class="select" id="msgType"><option value="">全部类型</option>' + U().statusOptions(types, type) + '</select>' +
          '<span class="table-note" id="msgCount">' + list.length + ' 条消息</span>' +
        '</div>' +
      '</div>' +

      '<section class="card msg-list" id="msgList">' + rows + '</section>' +
      '<div id="msgEmpty" hidden>' + U().emptyState('没有匹配的消息', '切换筛选条件试试', 'message') + '</div>';
    },

    after: function () {
      const st = S();

      function apply() {
        const tab = st.ui.msgTab || 'all';
        const type = document.getElementById('msgType').value;
        let n = 0;
        U().$$('#msgList .msg-item').forEach(function (item) {
          const hit = (tab !== 'unread' || item.dataset.read === '0') &&
            (!type || item.dataset.type === type);
          item.hidden = !hit;
          if (hit) n += 1;
        });
        document.getElementById('msgCount').textContent = n + ' 条消息';
        document.getElementById('msgList').hidden = n === 0;
        document.getElementById('msgEmpty').hidden = n !== 0;
      }

      U().$$('[data-msg-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          st.ui.msgTab = btn.dataset.msgTab;
          U().$$('[data-msg-tab]').forEach(function (b) { b.classList.toggle('active', b === btn); });
          apply();
        });
      });

      const typeSel = document.getElementById('msgType');
      typeSel.addEventListener('change', function () {
        st.ui.msgType = typeSel.value;
        apply();
      });
      apply();

      U().$$('#msgList .msg-item').forEach(function (item) {
        function open() { MSG.open(item.dataset.msg); }
        item.addEventListener('click', open);
        item.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
      });

      const readAll = document.getElementById('msgReadAll');
      if (readAll) readAll.addEventListener('click', function () {
        const list = visibleMessages();
        list.forEach(function (m) { m.read = true; });
        ITO.log('全部消息标为已读', list.length + ' 条', '消息');
        U().toast('全部消息已标为已读');
        ITO.refresh();
      });

      const send = document.getElementById('msgSendBtn');
      if (send) send.addEventListener('click', MSG.send);

      const openId = hashId();
      if (openId) {
        if (st.ui.msgOpenId !== openId) {
          st.ui.msgOpenId = openId;
          setTimeout(function () { MSG.open(openId); }, 60);
        }
      } else {
        st.ui.msgOpenId = '';
      }
    }
  };

  /* ── alert rules ─────────────────────────── */
  const RULE = {};

  RULE.edit = function (ruleId) {
    const st = S();
    const rule = ruleId ? st.alertRules.find(function (r) { return r.id === ruleId; }) : null;
    const editing = !!rule;
    const types = (window.ITO && ITO.ALERT_TYPES) || [];
    const initialType = (rule && rule.type) || (types[0] && types[0].key) || '';
    const initialThreshold = rule ? rule.threshold : (types[0] ? types[0].threshold : 1);

    U().modal({
      title: editing ? '编辑预警规则' : '新建预警规则',
      sub: editing ? rule.id : '规则启用后立即生效，可在列表中随时停用',
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '规则名称', required: true, full: true, control: '<input id="arName" type="text" maxlength="24" value="' + U().esc(rule ? rule.name : '') + '" placeholder="请输入规则名称">' }) +
          U().formRow({ label: '规则类型', required: true, control: '<select id="arType">' + types.map(function (t) {
            return '<option value="' + t.key + '"' + (t.key === initialType ? ' selected' : '') + '>' + U().esc(t.label) + '</option>';
          }).join('') + '</select>' }) +
          U().formRow({ label: '触发阈值', required: true, control: '<input id="arThreshold" type="number" min="1" max="999" step="1" value="' + U().esc(String(initialThreshold)) + '">', hint: '单位：' + U().esc((types.find(function (t) { return t.key === initialType; }) || types[0] || {}).unit || '') }) +
          U().formRow({ label: '触发条件', full: true, control: '<input id="arCond" type="text" value="' + U().esc(rule ? rule.condition : (types[0] ? types[0].condition(types[0].threshold) : '')) + '" readonly>' }) +
          U().formRow({ label: '通知范围', required: true, control: '<select id="arScope">' + Object.keys(ITO_ALERT_ENGINE.groupScope).map(function (key) {
            return '<option value="' + key + '"' + ((rule ? rule.scope : 'all') === key ? ' selected' : '') + '>' + U().esc(ITO_ALERT_ENGINE.groupScope[key]) + '</option>';
          }).join('') + '</select>' }) +
          U().formRow({ label: '状态', required: true, control: '<select id="arEnabled"><option value="">请选择状态</option>' + U().statusOptions(['启用', '停用'], rule ? (rule.enabled ? '启用' : '停用') : '') + '</select>' }) +
          (editing
            ? U().formRow({ label: '创建时间', control: '<input type="text" value="' + U().esc((rule.createdAt || '—') + ' · ' + (rule.createdBy || '—')) + '" readonly>' }) +
              U().formRow({ label: '更新时间', control: '<input type="text" value="' + U().esc((rule.updatedAt || '—') + ' · ' + (rule.updatedBy || '—')) + '" readonly>' })
            : '') +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-save type="button">' + (editing ? '保存修改' : '创建规则') + '</button>',
      onMount: function (close, root) {
        const nameEl = root.querySelector('#arName');
        const typeEl = root.querySelector('#arType');
        const thresholdEl = root.querySelector('#arThreshold');
        const condEl = root.querySelector('#arCond');
        const scopeEl = root.querySelector('#arScope');
        const statusEl = root.querySelector('#arEnabled');
        const hintEl = thresholdEl.closest('.form-field').querySelector('.form-hint');

        function paintCondition() {
          const type = types.find(function (t) { return t.key === typeEl.value; }) || types[0];
          if (!type) return;
          const value = Number(thresholdEl.value) || type.threshold;
          condEl.value = type.condition(value);
          if (hintEl) hintEl.textContent = '单位：' + type.unit;
        }
        typeEl.addEventListener('change', function () {
          const type = types.find(function (t) { return t.key === typeEl.value; });
          if (type) thresholdEl.value = type.threshold;
          paintCondition();
        });
        thresholdEl.addEventListener('input', paintCondition);

        root.querySelector('[data-cancel]').addEventListener('click', close);
        U().bindFieldClear(root);
        root.querySelector('[data-save]').addEventListener('click', function () {
          const valid = U().validateRequired([
            [nameEl, '请输入规则名称'],
            [thresholdEl, '请输入触发阈值'],
            [statusEl, '请选择状态']
          ]);
          if (!valid) return;
          const name = nameEl.value.trim();
          const type = types.find(function (t) { return t.key === typeEl.value; }) || types[0];
          const threshold = Number(thresholdEl.value);
          if (!type || !(threshold > 0)) { U().toast('请填写有效的触发阈值', 'warn'); return; }
          const enabled = statusEl.value === '启用';
          const now = D.meta.demoNow;
          const data = {
            name: name,
            type: type.key,
            threshold: threshold,
            unit: type.unit,
            scope: scopeEl.value,
            severity: type.severity || '警告',
            condition: type.condition(threshold),
            channel: '站内',
            dedupeMinutes: 30,
            enabled: enabled
          };
          if (editing) {
            const changedStatus = rule.enabled !== enabled;
            Object.assign(rule, data, { updatedAt: now, updatedBy: st.user.name });
            if (rule.type !== type.key) {
              rule.lastSignature = '';
              rule.lastFiredAt = '';
            }
            if (changedStatus) {
              rule.statusChangedAt = now;
              rule.statusChangedBy = st.user.name;
            }
            rule.audit = rule.audit || [];
            rule.audit.push({ time: now, actor: st.user.name, action: '编辑预警规则' });
            ITO.log('编辑预警规则', rule.id + ' ' + rule.name, '配置');
            U().toast('预警规则已更新');
          } else {
            st.ruleSeq = (st.ruleSeq || 5) + 1;
            const id = 'R-' + String(st.ruleSeq).padStart(2, '0');
            st.alertRules.push(Object.assign({
              id: id,
              createdAt: now,
              createdBy: st.user.name,
              updatedAt: now,
              updatedBy: st.user.name,
              statusChangedAt: now,
              statusChangedBy: st.user.name,
              lastFiredAt: '',
              fireCount: 0,
              lastSignature: '',
              audit: [{ time: now, actor: st.user.name, action: '创建预警规则' }]
            }, data));
            ITO.log('新增预警规则', id + ' ' + name, '配置');
            U().toast('预警规则已创建');
          }
          close();
          ITO.refresh();
        });
      }
    });
  };

  RULE.toggle = function (id) {
    const st = S();
    const rule = st.alertRules.find(function (r) { return r.id === id; });
    if (!rule) return;
    rule.enabled = !rule.enabled;
    rule.statusChangedAt = D.meta.demoNow;
    rule.statusChangedBy = st.user.name;
    rule.updatedAt = D.meta.demoNow;
    rule.updatedBy = st.user.name;
    rule.audit = rule.audit || [];
    rule.audit.push({ time: D.meta.demoNow, actor: st.user.name, action: rule.enabled ? '启用规则' : '停用规则' });
    ITO.log(rule.enabled ? '启用预警规则' : '停用预警规则', rule.id + ' ' + rule.name, '配置');
    U().toast('规则已' + (rule.enabled ? '启用' : '停用'));
    ITO.refresh();
  };

  RULE.remove = function (id) {
    const st = S();
    const rule = st.alertRules.find(function (r) { return r.id === id; });
    if (!rule) return;
    U().confirm({
      title: '删除预警规则',
      text: '确认删除「' + rule.name + '」？删除后将不再触发对应通知。',
      okText: '删除',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      st.alertRules = st.alertRules.filter(function (r) { return r.id !== id; });
      ITO.log('删除预警规则', rule.id + ' ' + rule.name, '配置');
      U().toast('规则已删除', 'warn');
      ITO.refresh();
    });
  };

  RULE.detail = function (id) {
    const st = S();
    const rule = st.alertRules.find(function (r) { return r.id === id; });
    if (!rule) return;
    const types = (window.ITO && ITO.ALERT_TYPES) || [];
    const type = types.find(function (t) { return t.key === rule.type; });
    const scope = (window.ITO_ALERT_ENGINE && ITO_ALERT_ENGINE.groupScope) || {};
    const hits = (rule.lastHits || []).slice(0, 6);
    const hitRows = hits.map(function (h) {
      return '<div class="mini-row"><span class="dot" style="background:var(--brand)"></span>' +
        '<div class="txt"><b>' + U().esc(h.name || h.key) + '</b><span>' + U().esc(h.key) + '</span></div></div>';
    }).join('');
    U().detailModal({
      title: rule.name,
      sub: rule.id + ' · ' + (type ? type.label : '规则') + ' · ' + (rule.enabled ? '启用' : '停用'),
      body:
        '<div class="detail-grid">' +
          '<div class="detail-field"><label>规则类型</label><div>' + U().esc(type ? type.label : '—') + '</div></div>' +
          '<div class="detail-field"><label>触发阈值</label><div>' + U().esc(rule.threshold + ' ' + (rule.unit || '')) + '</div></div>' +
          '<div class="detail-field"><label>触发条件</label><div>' + U().esc(rule.condition) + '</div></div>' +
          '<div class="detail-field"><label>通知范围</label><div>' + U().esc(scope[rule.scope] || '全部专业组') + '</div></div>' +
          '<div class="detail-field"><label>通知渠道</label><div>' + U().esc(rule.channel || '站内') + '</div></div>' +
          '<div class="detail-field"><label>去重窗口</label><div>' + U().esc((rule.dedupeMinutes || 30) + ' 分钟') + '</div></div>' +
          '<div class="detail-field"><label>状态</label><div>' + U().badge(rule.enabled ? '启用' : '停用', rule.enabled ? 'green' : 'gray') + '</div></div>' +
          '<div class="detail-field"><label>创建时间</label><div>' + U().esc((rule.createdAt || '—') + ' · ' + (rule.createdBy || '—')) + '</div></div>' +
          '<div class="detail-field"><label>更新时间</label><div>' + U().esc((rule.updatedAt || '—') + ' · ' + (rule.updatedBy || '—')) + '</div></div>' +
          '<div class="detail-field"><label>累计触发</label><div>' + (Number(rule.fireCount) || 0) + ' 次</div></div>' +
          '<div class="detail-field"><label>最近触发</label><div>' + U().esc(rule.lastFiredAt || '未触发') + '</div></div>' +
          '<div class="detail-field"><label>最近命中</label><div>' + (Number(rule.lastHitCount) || 0) + ' 项</div></div>' +
        '</div>' +
        '<div class="detail-section"><h4>最近命中明细（' + hits.length + '）</h4>' +
          (hits.length ? '<div class="mini-list">' + hitRows + '</div>' : '<p class="muted">暂无命中明细</p>') +
        '</div>',
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button><span class="spacer"></span><button class="btn btn-primary" data-edit type="button">编辑规则</button>',
      onMount: function (close, root) {
        root.querySelector('[data-close]').addEventListener('click', close);
        root.querySelector('[data-edit]').addEventListener('click', function () {
          close();
          RULE.edit(rule.id);
        });
      }
    });
  };

  P.alerts = {
    render: function () {
      const st = S();
      const enabled = st.alertRules.filter(function (r) { return r.enabled; }).length;
      const firedToday = st.alertRules.filter(function (r) {
        return r.lastFiredAt && r.lastFiredAt.slice(0, 10) === D.meta.today;
      }).length;
      const totalFires = st.alertRules.reduce(function (n, r) { return n + (Number(r.fireCount) || 0); }, 0);
      const lastCheck = (st.alertEngine && st.alertEngine.lastCheckAt) || '—';

      const rows = st.alertRules.map(function (r) {
        return '<tr data-rule="' + r.id + '" style="cursor:pointer">' +
          '<td class="mono">' + r.id + '</td>' +
          '<td class="rule-name-cell"><b>' + U().esc(r.name) + '</b></td>' +
          '<td class="muted">' + U().esc(r.condition) + '</td>' +
          '<td><div class="rule-state"><button class="switch' + (r.enabled ? ' on' : '') + '" data-act="toggle" data-id="' + r.id + '" type="button" aria-label="启用或停用" aria-pressed="' + r.enabled + '"></button><span>' + (r.enabled ? '启用' : '停用') + '</span></div></td>' +
          '<td class="rule-time">' + U().esc(r.createdAt || '—') + '</td>' +
          '<td class="rule-time">' + U().esc(r.updatedAt || '—') + '</td>' +
          '<td><div class="row-actions">' +
            '<button class="btn btn-ghost btn-sm" data-act="edit" data-id="' + r.id + '" type="button">编辑</button>' +
            '<button class="btn btn-danger btn-sm" data-act="remove" data-id="' + r.id + '" type="button">删除</button>' +
          '</div></td></tr>';
      }).join('');

      return U().pageHead({
        title: '预警规则',
        sub: '规则启用后自动检测 · 命中写入站内消息与操作日志',
        actions: '<button class="btn btn-soft" id="ruleCheckBtn" type="button">' + U().icon('refresh') + '立即检测</button><button class="btn btn-primary" id="ruleNewBtn" type="button">' + U().icon('plus') + '新建规则</button>'
      }) +
      '<div class="summary-grid alert-summary">' +
        '<div class="summary-chip"><span class="icon">' + U().icon('alert') + '</span><div><b>' + enabled + ' / ' + st.alertRules.length + '</b><span>启用规则</span></div></div>' +
        '<div class="summary-chip"><span class="icon warn">' + U().icon('clock') + '</span><div><b>' + firedToday + '</b><span>今日触发规则</span></div></div>' +
        '<div class="summary-chip"><span class="icon">' + U().icon('history') + '</span><div><b>' + totalFires + '</b><span>累计触发次数</span></div></div>' +
        '<div class="summary-chip"><span class="icon">' + U().icon('shield') + '</span><div><b class="is-small">' + U().esc(lastCheck) + '</b><span>最近检测时间</span></div></div>' +
      '</div>' +

      '<section class="card table-card">' +
        '<div class="table-head"><div><h3>预警规则</h3><p class="table-note">按类型识别并对任务、审批、巡检、SLA、值班交接实时判定</p></div>' +
          '<span class="table-note">' + st.alertRules.length + ' 条规则 · 同对象 30 分钟内去重</span></div>' +
        '<div class="table-wrap"><table class="data-table config-table alert-rule-table"><thead><tr><th>编号</th><th class="rule-name-cell">规则名称</th><th>触发条件</th><th>状态</th><th>创建时间</th><th>更新时间</th><th style="text-align:right">操作</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' +
      '</section>' +

      '<div class="duty-notes">' +
        '<div class="card duty-note"><b>生效方式</b><span>规则启用后自动执行：业务动作完成后触发检测，页面打开时检测一次，此后每 60 秒轮询。</span></div>' +
        '<div class="card duty-note"><b>去重规则</b><span>同一对象在 30 分钟内命中相同规则只通知一次；命中对象集合发生变化时重新通知。</span></div>' +
        '<div class="card duty-note"><b>演示边界</b><span>当前为前端演示环境，命中只生成站内消息与操作日志，不发送短信、邮件或企业微信。</span></div>' +
      '</div>';
    },

    after: function () {
      U().$$('[data-rule]').forEach(function (tr) {
        tr.addEventListener('click', function (e) {
          if (e.target.closest('button')) return;
          RULE.detail(tr.dataset.rule);
        });
      });
      U().$$('[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.dataset.act === 'toggle') RULE.toggle(btn.dataset.id);
          if (btn.dataset.act === 'edit') RULE.edit(btn.dataset.id);
          if (btn.dataset.act === 'remove') RULE.remove(btn.dataset.id);
        });
      });
      const add = document.getElementById('ruleNewBtn');
      if (add) add.addEventListener('click', function () { RULE.edit(null); });
      const check = document.getElementById('ruleCheckBtn');
      if (check) check.addEventListener('click', function () {
        const engine = window.ITO_ALERT_ENGINE;
        if (!engine) { U().toast('预警引擎未加载', 'warn'); return; }
        const result = engine.check({ manual: true });
        if (result.fired) {
          U().toast('检测完成：命中 ' + result.fired + ' 条规则，已生成站内消息');
          ITO.log('手动检测预警规则', '命中 ' + result.fired + ' 条规则', '预警');
          ITO.refresh();
        } else {
          U().toast('检测完成：当前没有新增命中');
          ITO.refresh();
        }
      });
    }
  };
})();
