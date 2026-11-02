/* ─────────────────────────────────────────────
   pages · roles, achievement tags, audit logs
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const P = (window.ITO_PAGES = window.ITO_PAGES || {});
  const D = window.ITO_DATA;

  function S() { return ITO.state; }
  function U() { return ITO.ui; }

  const ROLES = [
    { key: 'leader', name: '领导层', person: '张总', tone: 'leader' },
    { key: 'manager', name: '主管层', person: '王主管', tone: 'manager' },
    { key: 'employee', name: '员工层', person: '李工', tone: 'employee' },
    { key: 'admin', name: '系统管理员', person: '平台管理员', tone: 'admin' }
  ];

  const PERMS = [
    { key: 'dashboard', name: '运维驾驶舱', desc: '全局指标、趋势与实时动态', icon: 'dashboard' },
    { key: 'task', name: '任务中心', desc: '任务创建、派发、审批与闭环', icon: 'task' },
    { key: 'inspect', name: '巡检管理', desc: '计划、执行记录与异常整改', icon: 'clipboard' },
    { key: 'duty', name: '值班管理', desc: '排班、交接与升级路径', icon: 'calendar' },
    { key: 'maintain', name: '维保管理', desc: '厂商计划、记录与周期顺延', icon: 'wrench' },
    { key: 'group', name: '专业组', desc: '组织成员、负荷与档案', icon: 'users' },
    { key: 'auth', name: '作业授权', desc: '授权台账、续期与撤销', icon: 'shield' },
    { key: 'message', name: '消息中心', desc: '审批、超期与值班通知', icon: 'message' },
    { key: 'config', name: '平台配置', desc: '预警规则、角色权限与标签', icon: 'alert' }
  ];

  function configTabs(active) {
    return ITO.configTabs ? ITO.configTabs(active) : '';
  }

  function permCount(role) {
    return PERMS.filter(function (p) { return S().permissions[role][p.key]; }).length;
  }

  /* ── roles ───────────────────────────────── */
  P.roles = {
    render: function () {
      const st = S();

      const roleCards = ROLES.map(function (r) {
        return '<div class="role-mini ' + r.tone + '">' +
          '<span class="role-mini-icon">' + U().icon(r.key === 'leader' ? 'chart' : r.key === 'manager' ? 'users' : r.key === 'employee' ? 'user' : 'shield') + '</span>' +
          '<div><b>' + r.name + '</b><span>' + r.person + ' · ' + permCount(r.key) + ' 个模块</span></div>' +
        '</div>';
      }).join('');

      const rows = PERMS.map(function (p) {
        const cells = ROLES.map(function (r) {
          const on = !!st.permissions[r.key][p.key];
          const locked = r.key === 'admin' || p.key === 'dashboard';
          return '<td><button class="check' + (on ? ' on' : '') + '" data-role="' + r.key + '" data-perm="' + p.key + '" type="button"' +
            (locked ? ' disabled title="系统保护项，不可修改"' : ' aria-pressed="' + on + '"') + '>' +
            U().icon('check') + '</button></td>';
        }).join('');
        return '<tr><td><div class="perm-name">' + U().icon(p.icon) + '<div><b>' + p.name + '</b><span>' + p.desc + '</span></div></div></td>' + cells + '</tr>';
      }).join('');

      return U().pageHead({
        title: '平台配置',
        sub: '角色权限矩阵 · 调整后立即影响对应角色的菜单与操作范围',
        actions:
          '<button class="btn btn-ghost" id="permResetBtn" type="button">' + U().icon('refresh') + '恢复默认</button>' +
          '<span class="badge green" style="height:32px">系统管理员列受保护</span>'
      }) +
      configTabs('roles') +
      '<div class="role-summary-grid">' + roleCards + '</div>' +

      '<section class="card table-card">' +
        '<div class="table-head"><div><h3>权限矩阵</h3><p class="table-note">勾选代表允许访问；驾驶舱与系统管理员列不可关闭</p></div>' +
          '<span class="table-note">共 ' + PERMS.length + ' 个模块</span></div>' +
        '<div class="table-wrap"><table class="data-table perm-table"><thead><tr><th>模块</th>' +
          ROLES.map(function (r) { return '<th>' + r.name + '</th>'; }).join('') +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '</section>' +

      '<div class="duty-notes">' +
        '<div class="card duty-note"><b>最小权限</b><span>员工层默认不可见巡检、维保与专业组，避免跨组数据暴露。</span></div>' +
        '<div class="card duty-note"><b>职责分离</b><span>任务审批与平台配置分离；系统管理员不参与任务派发与审批。</span></div>' +
        '<div class="card duty-note"><b>变更留痕</b><span>每次权限调整记录操作人、角色与模块，可在操作日志中追溯。</span></div>' +
      '</div>';
    },

    after: function () {
      const st = S();

      U().$$('.perm-table .check').forEach(function (btn) {
        if (btn.disabled) return;
        btn.addEventListener('click', function () {
          const role = btn.dataset.role;
          const perm = btn.dataset.perm;
          const on = !st.permissions[role][perm];
          st.permissions[role][perm] = on;
          btn.classList.toggle('on', on);
          btn.setAttribute('aria-pressed', String(on));
          const roleName = (ROLES.find(function (r) { return r.key === role; }) || {}).name;
          const permName = (PERMS.find(function (p) { return p.key === perm; }) || {}).name;
          ITO.log(on ? '开放角色权限' : '收回角色权限', roleName + ' · ' + permName, '配置');
          ITO.renderShell();
          U().toast(roleName + ' 的「' + permName + '」已' + (on ? '开放' : '收回'));
          ITO.refresh();
        });
      });

      const reset = document.getElementById('permResetBtn');
      if (reset) reset.addEventListener('click', function () {
        U().confirm({
          title: '恢复默认权限',
          text: '将四个角色的权限恢复为初始配置，当前调整会被覆盖。',
          okText: '恢复默认'
        }).then(function (ok) {
          if (!ok) return;
          st.permissions = JSON.parse(JSON.stringify(D.permissions));
          ITO.log('恢复默认角色权限', '4 个角色', '配置');
          ITO.renderShell();
          U().toast('角色权限已恢复默认');
          ITO.refresh();
        });
      });
    }
  };

  /* ── achievement tags ────────────────────── */
  const TAG = {};

  TAG.edit = function (name) {
    const st = S();
    const tag = name ? st.achievements.find(function (a) { return a.name === name; }) : null;
    const editing = !!tag;

    U().modal({
      title: editing ? '编辑成就标签' : '新增成就标签',
      sub: editing ? tag.name : '标签用于任务归档与个人成就展示',
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '标签名称', required: true, control: '<input id="tgName" type="text" maxlength="8" value="' + U().esc(tag ? tag.name : '') + '" placeholder="例如：核心岗">' }) +
          U().formRow({ label: '所属专业组', control: '<select id="tgGroup">' + U().groupOptions(tag ? tag.group : 'app') + '</select>' }) +
          U().formRow({ label: '星级', control: '<select id="tgStars">' + U().statusOptions(['1', '2', '3'], tag ? String(tag.stars) : '1') + '</select>' }) +
          U().formRow({ label: '累计次数', control: '<input id="tgCount" type="number" min="0" max="999" value="' + (tag ? tag.count : 1) + '">' }) +
          U().formRow({ label: '标签说明', full: true, control: '<textarea id="tgDesc" placeholder="说明该标签代表的贡献场景">' + U().esc(tag ? tag.desc : '') + '</textarea>' }) +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-save type="button">' + (editing ? '保存修改' : '创建标签') + '</button>',
      onMount: function (close, root) {
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-save]').addEventListener('click', function () {
          const nameVal = root.querySelector('#tgName').value.trim();
          if (!nameVal) { U().toast('请填写标签名称', 'warn'); return; }
          const data = {
            name: nameVal,
            group: root.querySelector('#tgGroup').value,
            stars: Number(root.querySelector('#tgStars').value),
            count: Math.max(0, Number(root.querySelector('#tgCount').value) || 0),
            desc: root.querySelector('#tgDesc').value.trim() || '待补充标签说明'
          };
          if (editing) {
            Object.assign(tag, data);
            ITO.log('编辑成就标签', tag.name, '配置');
            U().toast('成就标签已更新');
          } else {
            st.achievements.push(data);
            ITO.log('新增成就标签', nameVal, '配置');
            U().toast('成就标签已创建');
          }
          close();
          ITO.refresh();
        });
      }
    });
  };

  TAG.remove = function (name) {
    const st = S();
    const tag = st.achievements.find(function (a) { return a.name === name; });
    if (!tag) return;
    U().confirm({
      title: '删除成就标签',
      text: '确认删除「' + tag.name + '」？已归档任务上的展示会同步移除。',
      okText: '删除',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      st.achievements = st.achievements.filter(function (a) { return a.name !== name; });
      ITO.log('删除成就标签', tag.name, '配置');
      U().toast('标签已删除', 'warn');
      ITO.refresh();
    });
  };

  P.tags = {
    render: function () {
      const st = S();
      const totalCount = st.achievements.reduce(function (n, a) { return n + a.count; }, 0);
      const groups = new Set(st.achievements.map(function (a) { return a.group; })).size;

      const cards = st.achievements.map(function (a) {
        return '<article class="tag-card">' +
          '<div class="tag-card-head"><div><b>' + U().esc(a.name) + '</b>' +
            '<div class="stars">' + '★'.repeat(a.stars) + '<span class="star-off">' + '★'.repeat(3 - a.stars) + '</span></div></div>' +
            U().groupPill(a.group) + '</div>' +
          '<p>' + U().esc(a.desc) + '</p>' +
          '<div class="tag-meta"><span>累计 <b>' + a.count + '</b> 次</span>' +
            '<div class="row-actions">' +
              '<button class="btn btn-ghost btn-sm" data-act="edit" data-name="' + U().esc(a.name) + '" type="button">编辑</button>' +
              '<button class="btn btn-danger btn-sm" data-act="remove" data-name="' + U().esc(a.name) + '" type="button">删除</button>' +
            '</div></div>' +
        '</article>';
      }).join('');

      return U().pageHead({
        title: '平台配置',
        sub: '成就标签用于沉淀专业能力与贡献场景 · 共 ' + st.achievements.length + ' 个标签',
        actions: '<button class="btn btn-primary" id="tagNewBtn" type="button">' + U().icon('plus') + '新增标签</button>'
      }) +
      configTabs('tags') +
      '<div class="summary-grid">' +
        '<div class="summary-chip"><span class="icon">' + U().icon('award') + '</span><div><b>' + st.achievements.length + '</b><span>标签总数</span></div></div>' +
        '<div class="summary-chip"><span class="icon green">' + U().icon('chart') + '</span><div><b>' + totalCount + '</b><span>累计发放</span></div></div>' +
        '<div class="summary-chip"><span class="icon blue">' + U().icon('users') + '</span><div><b>' + groups + '</b><span>覆盖专业组</span></div></div>' +
        '<div class="summary-chip"><span class="icon yellow">' + U().icon('award') + '</span><div><b>' + st.achievements.filter(function (a) { return a.stars === 3; }).length + '</b><span>三星标签</span></div></div>' +
      '</div>' +

      '<div class="tag-grid">' + cards + '</div>' +

      '<div class="duty-notes">' +
        '<div class="card duty-note"><b>标签获取</b><span>任务验收通过后，由主管在归档时为参与人员发放对应能力标签。</span></div>' +
        '<div class="card duty-note"><b>星级规则</b><span>一星为参与、二星为主导、三星为独立负责并形成可复用方案。</span></div>' +
        '<div class="card duty-note"><b>展示范围</b><span>标签在个人任务页与专业组档案中展示，不纳入绩效强制排名。</span></div>' +
      '</div>';
    },

    after: function () {
      U().$$('[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.dataset.act === 'edit') TAG.edit(btn.dataset.name);
          if (btn.dataset.act === 'remove') TAG.remove(btn.dataset.name);
        });
      });
      const add = document.getElementById('tagNewBtn');
      if (add) add.addEventListener('click', function () { TAG.edit(null); });
    }
  };

  /* ── logs ────────────────────────────────── */
  function logTone(type) {
    return ({ '任务': 'blue', '审批': 'yellow', '系统': 'gray', '巡检': 'green', '维保': 'purple', '配置': 'gray', '授权': 'red', '消息': 'blue', '报表': 'yellow', '组织': 'purple' })[type] || 'gray';
  }

  P.logs = {
    render: function () {
      const st = S();
      const today = st.logs.filter(function (l) { return l.time.indexOf(D.meta.today) === 0; }).length;
      const system = st.logs.filter(function (l) { return l.actor === '系统'; }).length;
      const actors = new Set(st.logs.map(function (l) { return l.actor; })).size;
      const types = Array.from(new Set(st.logs.map(function (l) { return l.type; })));

      const rows = st.logs.map(function (l) {
        return '<tr data-type="' + U().esc(l.type) + '" data-search="' + U().esc((l.actor + ' ' + l.action + ' ' + l.target + ' ' + l.type).toLowerCase()) + '">' +
          '<td class="num muted" style="white-space:nowrap">' + l.time + '</td>' +
          '<td><div class="person-cell">' + (l.actor === '系统' ? '<span class="avatar avatar-sm" style="background:#6E6E73">系</span>' : U().avatar(l.actor, true)) +
            '<div><b>' + U().esc(l.actor) + '</b></div></div></td>' +
          '<td><b class="strong">' + U().esc(l.action) + '</b></td>' +
          '<td class="muted">' + U().esc(l.target) + '</td>' +
          '<td>' + U().badge(l.type, logTone(l.type)) + '</td>' +
        '</tr>';
      }).join('');

      return U().pageHead({
        title: '操作日志',
        sub: '平台关键操作审计 · 覆盖任务、审批、配置、授权与组织变更',
        actions: '<button class="btn btn-ghost" id="logExportBtn" type="button">' + U().icon('download') + '导出日志</button>'
      }) +
      '<div class="summary-grid">' +
        '<div class="summary-chip"><span class="icon">' + U().icon('history') + '</span><div><b>' + st.logs.length + '</b><span>日志总数</span></div></div>' +
        '<div class="summary-chip"><span class="icon blue">' + U().icon('calendar') + '</span><div><b>' + today + '</b><span>今日操作</span></div></div>' +
        '<div class="summary-chip"><span class="icon green">' + U().icon('refresh') + '</span><div><b>' + system + '</b><span>系统自动记录</span></div></div>' +
        '<div class="summary-chip"><span class="icon yellow">' + U().icon('users') + '</span><div><b>' + actors + '</b><span>涉及操作人</span></div></div>' +
      '</div>' +

      '<div class="toolbar">' +
        '<div class="filters">' +
          '<label class="search-field">' + U().icon('search') + '<input id="logSearch" type="search" placeholder="搜索操作人、动作或对象"></label>' +
          '<select class="select" id="logType"><option value="">全部类型</option>' + U().statusOptions(types, '') + '</select>' +
          '<button class="btn btn-ghost btn-sm" id="logClear" type="button">' + U().icon('refresh') + '重置</button>' +
        '</div>' +
        '<span class="table-note" id="logCount">' + st.logs.length + ' 条日志</span>' +
      '</div>' +

      '<section class="card table-card">' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>时间</th><th>操作人</th><th>操作</th><th>对象</th><th>类型</th></tr></thead>' +
        '<tbody id="logTbody">' + rows + '</tbody></table></div>' +
      '</section>';
    },

    after: function () {
      const st = S();

      function apply() {
        const q = (document.getElementById('logSearch').value || '').trim().toLowerCase();
        const type = document.getElementById('logType').value;
        let n = 0;
        U().$$('#logTbody tr').forEach(function (tr) {
          const hit = (!q || tr.dataset.search.indexOf(q) > -1) && (!type || tr.dataset.type === type);
          tr.hidden = !hit;
          if (hit) n += 1;
        });
        document.getElementById('logCount').textContent = n + ' 条日志';
      }

      const search = document.getElementById('logSearch');
      search.addEventListener('input', apply);
      const type = document.getElementById('logType');
      type.addEventListener('change', apply);

      const clear = document.getElementById('logClear');
      clear.addEventListener('click', function () {
        search.value = '';
        type.value = '';
        apply();
      });

      const exp = document.getElementById('logExportBtn');
      exp.addEventListener('click', function () {
        const rows = [['时间', '操作人', '操作', '对象', '类型']];
        st.logs.forEach(function (l) { rows.push([l.time, l.actor, l.action, l.target, l.type]); });
        U().download('ITO操作日志.csv', U().csv(rows));
        ITO.log('导出操作日志', st.logs.length + ' 条', '系统');
        U().toast('操作日志已导出');
      });
    }
  };
})();
