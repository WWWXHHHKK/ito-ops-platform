/* ─────────────────────────────────────────────
   pages · messages & alert rules
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const P = (window.ITO_PAGES = window.ITO_PAGES || {});
  const D = window.ITO_DATA;

  function S() { return ITO.state; }
  function U() { return ITO.ui; }

  function configTabs(active) {
    const tabs = [
      { id: 'alerts', name: '预警规则', icon: 'alert', show: ITO.can('alerts') },
      { id: 'roles', name: '角色权限', icon: 'key', show: ITO.can('roles') },
      { id: 'tags', name: '成就标签', icon: 'award', show: ITO.can('tags') }
    ].filter(function (t) { return t.show; });
    return '<div class="config-tabs">' + tabs.map(function (t) {
      return '<a class="config-tab' + (t.id === active ? ' active' : '') + '" href="#/' + t.id + '">' + U().icon(t.icon) + t.name + '</a>';
    }).join('') + '</div>';
  }

  ITO.configTabs = configTabs;

  /* ── messages ────────────────────────────── */
  const MSG = {};

  const TYPE_ICON = { '审批': 'shield', '超期': 'alert', '巡检': 'clipboard', '值班': 'calendar', '发布': 'send', '报表': 'chart' };
  const TYPE_TONE = { '审批': 'blue', '超期': 'yellow', '巡检': 'green', '值班': '', '发布': 'blue', '报表': '' };
  const TYPE_LINK = { '审批': '#/dispatch', '超期': '#/tasks', '巡检': '#/inspection', '值班': '#/duty', '发布': '#/tasks', '报表': '#/dashboard' };

  function iconBox(msg) {
    return '<div class="msg-icon ' + (TYPE_TONE[msg.type] || '') + '">' + U().icon(TYPE_ICON[msg.type] || 'message') + '</div>';
  }

  MSG.open = function (id) {
    const st = S();
    const msg = st.messages.find(function (m) { return m.id === id; });
    if (!msg) return;
    msg.read = true;
    ITO.refresh();

    U().drawer({
      title: msg.title,
      sub: msg.id + ' · ' + msg.type + ' · ' + msg.time,
      body:
        '<div class="msg-detail-head">' + iconBox(msg) +
          '<div><b>' + U().esc(msg.type) + '</b><span>' + (msg.read ? '已读' : '未读') + ' · 系统通知</span></div></div>' +
        '<p class="msg-detail-body">' + U().esc(msg.body) + '</p>' +
        '<div class="detail-section"><h4>处理建议</h4><p class="msg-detail-tip">' + U().esc(
          msg.type === '审批' ? '进入「派发与审批」核对授权范围与工作票，完成通过或驳回。' :
          msg.type === '超期' ? '进入「任务中心」按超期筛选，联系负责人确认新的交付时间。' :
          msg.type === '巡检' ? '进入「巡检管理」查看异常项，并跟踪系统生成的整改任务。' :
          msg.type === '值班' ? '进入「值班管理」确认交接班人员与未闭环事项。' :
          msg.type === '发布' ? '进入「任务中心」核对发布任务的回归验证与归档状态。' :
          '进入「运维驾驶舱」查看月度指标并导出月报。'
        ) + '</p></div>',
      foot: '<button class="btn btn-ghost" data-unread type="button">标为未读</button><span class="spacer"></span>' +
        '<button class="btn btn-ghost" data-close type="button">关闭</button>' +
        '<a class="btn btn-primary" href="' + (TYPE_LINK[msg.type] || '#/dashboard') + '">前往处理' + U().icon('arrow') + '</a>',
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

  P.messages = {
    render: function () {
      const st = S();
      st.ui = st.ui || {};
      const tab = st.ui.msgTab || 'all';
      const type = st.ui.msgType || '';
      const unread = st.messages.filter(function (m) { return !m.read; }).length;
      const today = st.messages.filter(function (m) { return m.time.indexOf('2026-11-02') === 0; }).length;
      const types = Array.from(new Set(st.messages.map(function (m) { return m.type; })));

      const rows = st.messages.map(function (m) {
        return '<article class="msg-item' + (m.read ? '' : ' unread') + '" data-msg="' + m.id + '" data-type="' + U().esc(m.type) + '" data-read="' + (m.read ? '1' : '0') + '" tabindex="0" role="button">' +
          iconBox(m) +
          '<div class="msg-body">' +
            '<div class="msg-title-row"><b>' + U().esc(m.title) + '</b>' + (m.read ? '' : '<span class="msg-unread-dot"></span>') + '</div>' +
            '<p>' + U().esc(m.body) + '</p>' +
            '<div class="msg-meta"><span class="tag-inline">' + U().esc(m.type) + '</span><span>' + m.id + '</span></div>' +
          '</div>' +
          '<span class="msg-time">' + U().shortDate(m.time) + '</span>' +
        '</article>';
      }).join('');

      return U().pageHead({
        title: '消息中心',
        sub: '审批、超期、巡检与值班通知统一收口 · 未读 ' + unread + ' 条',
        actions:
          '<button class="btn btn-ghost" id="msgReadAll" type="button"' + (unread ? '' : ' disabled') + '>' + U().icon('check') + '全部标为已读</button>'
      }) +
      '<div class="summary-grid">' +
        '<div class="summary-chip"><span class="icon">' + U().icon('message') + '</span><div><b>' + unread + '</b><span>未读消息</span></div></div>' +
        '<div class="summary-chip"><span class="icon blue">' + U().icon('calendar') + '</span><div><b>' + today + '</b><span>今日新增</span></div></div>' +
        '<div class="summary-chip"><span class="icon yellow">' + U().icon('clock') + '</span><div><b>' + st.messages.filter(function (m) { return m.type === '审批' && !m.read; }).length + '</b><span>待审批提醒</span></div></div>' +
        '<div class="summary-chip"><span class="icon green">' + U().icon('check') + '</span><div><b>' + (st.messages.length - unread) + '</b><span>已读消息</span></div></div>' +
      '</div>' +

      '<div class="msg-toolbar">' +
        '<div class="tabs">' +
          '<button class="tab' + (tab === 'all' ? ' active' : '') + '" data-msg-tab="all" type="button">全部</button>' +
          '<button class="tab' + (tab === 'unread' ? ' active' : '') + '" data-msg-tab="unread" type="button">未读</button>' +
        '</div>' +
        '<div class="filters">' +
          '<select class="select" id="msgType"><option value="">全部类型</option>' + U().statusOptions(types, type) + '</select>' +
          '<span class="table-note" id="msgCount">' + st.messages.length + ' 条消息</span>' +
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
        st.messages.forEach(function (m) { m.read = true; });
        ITO.log('全部消息标为已读', st.messages.length + ' 条', '消息');
        U().toast('全部消息已标为已读');
        ITO.refresh();
      });
    }
  };

  /* ── alert rules ─────────────────────────── */
  const RULE = {};

  RULE.edit = function (ruleId) {
    const st = S();
    const rule = ruleId ? st.alertRules.find(function (r) { return r.id === ruleId; }) : null;
    const editing = !!rule;
    const channels = ['站内', '站内 + 短信', '站内 + 企业微信', '站内 + 邮件', '短信', '企业微信'];

    U().modal({
      title: editing ? '编辑预警规则' : '新建预警规则',
      sub: editing ? rule.id : '规则启用后立即生效，可在列表中随时停用',
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '规则名称', required: true, full: true, control: '<input id="arName" type="text" maxlength="24" value="' + U().esc(rule ? rule.name : '') + '" placeholder="例如：任务超期提醒">' }) +
          U().formRow({ label: '触发条件', required: true, full: true, control: '<input id="arCond" type="text" maxlength="40" value="' + U().esc(rule ? rule.condition : '') + '" placeholder="例如：超期 > 2 小时">' }) +
          U().formRow({ label: '通知渠道', control: '<select id="arChannel">' + U().statusOptions(channels, rule ? rule.channel : '站内') + '</select>' }) +
          U().formRow({ label: '启用状态', control: '<select id="arEnabled">' + U().statusOptions(['启用', '停用'], rule && !rule.enabled ? '停用' : '启用') + '</select>' }) +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-save type="button">' + (editing ? '保存修改' : '创建规则') + '</button>',
      onMount: function (close, root) {
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-save]').addEventListener('click', function () {
          const name = root.querySelector('#arName').value.trim();
          const cond = root.querySelector('#arCond').value.trim();
          if (!name || !cond) { U().toast('请补全规则名称与触发条件', 'warn'); return; }
          const data = {
            name: name,
            condition: cond,
            channel: root.querySelector('#arChannel').value,
            enabled: root.querySelector('#arEnabled').value === '启用'
          };
          if (editing) {
            Object.assign(rule, data);
            ITO.log('编辑预警规则', rule.id + ' ' + rule.name, '配置');
            U().toast('预警规则已更新');
          } else {
            st.ruleSeq = (st.ruleSeq || 5) + 1;
            const id = 'R-' + String(st.ruleSeq).padStart(2, '0');
            st.alertRules.push(Object.assign({ id: id }, data));
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
    const rule = S().alertRules.find(function (r) { return r.id === id; });
    if (!rule) return;
    rule.enabled = !rule.enabled;
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

  P.alerts = {
    render: function () {
      const st = S();
      const enabled = st.alertRules.filter(function (r) { return r.enabled; }).length;
      const channels = Array.from(new Set(st.alertRules.map(function (r) { return r.channel; }))).length;

      const rows = st.alertRules.map(function (r) {
        return '<tr>' +
          '<td class="mono">' + r.id + '</td>' +
          '<td><b class="strong">' + U().esc(r.name) + '</b></td>' +
          '<td class="muted">' + U().esc(r.condition) + '</td>' +
          '<td>' + U().esc(r.channel) + '</td>' +
          '<td><button class="switch' + (r.enabled ? ' on' : '') + '" data-act="toggle" data-id="' + r.id + '" type="button" aria-label="启用或停用" aria-pressed="' + r.enabled + '"></button></td>' +
          '<td class="muted">' + (r.enabled ? '规则生效中' : '已停用') + '</td>' +
          '<td><div class="row-actions">' +
            '<button class="btn btn-ghost btn-sm" data-act="edit" data-id="' + r.id + '" type="button">编辑</button>' +
            '<button class="btn btn-danger btn-sm" data-act="remove" data-id="' + r.id + '" type="button">删除</button>' +
          '</div></td></tr>';
      }).join('');

      return U().pageHead({
        title: '平台配置',
        sub: '预警规则、角色权限与成就标签 · 所有变更写入操作日志',
        actions: '<button class="btn btn-primary" id="ruleNewBtn" type="button">' + U().icon('plus') + '新建规则</button>'
      }) +
      configTabs('alerts') +
      '<div class="summary-grid">' +
        '<div class="summary-chip"><span class="icon">' + U().icon('alert') + '</span><div><b>' + enabled + ' / ' + st.alertRules.length + '</b><span>启用规则</span></div></div>' +
        '<div class="summary-chip"><span class="icon blue">' + U().icon('message') + '</span><div><b>' + channels + '</b><span>通知渠道组合</span></div></div>' +
        '<div class="summary-chip"><span class="icon green">' + U().icon('check') + '</span><div><b>2 分钟</b><span>平均触达延迟</span></div></div>' +
        '<div class="summary-chip"><span class="icon yellow">' + U().icon('clock') + '</span><div><b>7 × 24</b><span>规则运行</span></div></div>' +
      '</div>' +

      '<section class="card table-card">' +
        '<div class="table-head"><div><h3>预警规则</h3><p class="table-note">规则变更立即生效，停用后保留历史配置</p></div>' +
          '<span class="table-note">' + st.alertRules.length + ' 条规则</span></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>编号</th><th>规则名称</th><th>触发条件</th><th>通知渠道</th><th>状态</th><th>运行情况</th><th style="text-align:right">操作</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' +
      '</section>' +

      '<div class="duty-notes">' +
        '<div class="card duty-note"><b>触达策略</b><span>P1 与高风险作业审批同时走站内、短信与企业微信，避免单通道遗漏。</span></div>' +
        '<div class="card duty-note"><b>去重规则</b><span>同一对象 30 分钟内相同规则只通知一次，升级通知不受去重限制。</span></div>' +
        '<div class="card duty-note"><b>审计要求</b><span>规则的新增、修改、启停与删除全部写入操作日志，保留 180 天。</span></div>' +
      '</div>';
    },

    after: function () {
      U().$$('[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.dataset.act === 'toggle') RULE.toggle(btn.dataset.id);
          if (btn.dataset.act === 'edit') RULE.edit(btn.dataset.id);
          if (btn.dataset.act === 'remove') RULE.remove(btn.dataset.id);
        });
      });
      const add = document.getElementById('ruleNewBtn');
      if (add) add.addEventListener('click', function () { RULE.edit(null); });
    }
  };
})();
