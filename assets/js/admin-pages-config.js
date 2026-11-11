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
    { key: 'leader', name: '领导层', person: '张经理', tone: 'leader' },
    { key: 'manager', name: '主管层', person: '王主管', tone: 'manager' },
    { key: 'employee', name: '员工层', person: '李工', tone: 'employee' },
    { key: 'admin', name: '系统管理员', person: '平台管理员', tone: 'admin' }
  ];

  const PERMS = [
    { key: 'task', name: '任务中心', desc: '任务创建、派发、审批与闭环；员工层仅本人任务', icon: 'task' },
    { key: 'overhaul', name: '大修管理', desc: '大修行动、物资与人员矩阵', icon: 'wrench' },
    { key: 'inspect', name: '巡检管理', desc: '计划、执行记录与异常整改', icon: 'clipboard' },
    { key: 'duty', name: '值班管理', desc: '排班、交接与升级路径', icon: 'calendar' },
    { key: 'maintain', name: '维保管理', desc: '厂商计划、记录与周期顺延', icon: 'wrench' },
    { key: 'group', name: '组织架构', desc: '组织成员、负荷与档案', icon: 'users' },
    { key: 'auth', name: '作业授权', desc: '授权台账；员工层仅本人只读', icon: 'shield' },
    { key: 'message', name: '站内消息', desc: '审批、超期与值班通知', icon: 'message' },
    { key: 'dictionary', name: '字典配置', desc: '字典项与自定义字段定义', icon: 'book' },
    { key: 'config', name: '配置中心', desc: '预警规则、角色权限与系统配置', icon: 'alert' }
  ];

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
          '<div><b>' + r.name + '</b><span>' + permCount(r.key) + ' 个模块</span></div>' +
        '</div>';
      }).join('');

      const rows = PERMS.map(function (p) {
        const cells = ROLES.map(function (r) {
          const on = !!st.permissions[r.key][p.key];
          const locked = r.key === 'admin' || (r.key === 'leader' && p.key === 'config');
          return '<td><button class="check' + (on ? ' on' : '') + '" data-role="' + r.key + '" data-perm="' + p.key + '" type="button" aria-label="' + U().esc(r.name + ' · ' + p.name + '权限') + '"' +
            (locked ? ' disabled title="系统保护项，不可修改"' : ' aria-pressed="' + on + '"') + '>' +
            U().icon('check') + '</button></td>';
        }).join('');
        return '<tr><td><div class="perm-name">' + U().icon(p.icon) + '<div><b>' + p.name + '</b><span>' + p.desc + '</span></div></div></td>' + cells + '</tr>';
      }).join('');

      return U().pageHead({
        title: '角色权限',
        sub: '角色权限矩阵 · 调整后立即影响对应角色的菜单与操作范围',
        actions:
          '<button class="btn btn-ghost" id="permResetBtn" type="button">' + U().icon('refresh') + '恢复默认</button>' +
          '<span class="badge green" style="height:32px">系统管理员列受保护</span>'
      }) +
      '<div class="role-summary-grid">' + roleCards + '</div>' +

      '<section class="card table-card">' +
        '<div class="table-head"><div><h3>权限矩阵</h3><p class="table-note">勾选代表允许访问；系统管理员列与平台配置受保护</p></div>' +
          '<span class="table-note">共 ' + PERMS.length + ' 个模块</span></div>' +
        '<div class="table-wrap"><table class="data-table perm-table"><thead><tr><th>模块</th>' +
          ROLES.map(function (r) { return '<th>' + r.name + '</th>'; }).join('') +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '</section>' +

      '<div class="duty-notes">' +
        '<div class="card duty-note"><b>最小权限</b><span>员工层默认不可见巡检、维保与专业组，避免跨组数据暴露；个人统计仅可见本人数据。</span></div>' +
        '<div class="card duty-note"><b>职责分离</b><span>任务审批与平台配置分离；系统管理员不参与任务派发与审批，也不展示个人统计。</span></div>' +
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

  const WALL_PALETTE = [
    { solid: '#EB612A', soft: '#FFF0E8' },
    { solid: '#1976E8', soft: '#EAF3FF' },
    { solid: '#23A55A', soft: '#E9F8EF' },
    { solid: '#E9A400', soft: '#FFF7DE' },
    { solid: '#E5484D', soft: '#FFECEE' },
    { solid: '#5B54D9', soft: '#EEEDFF' },
    { solid: '#B43BD6', soft: '#FAEDFF' },
    { solid: '#29B6D8', soft: '#E8FAFE' },
    { solid: '#7CB305', soft: '#F3FBE4' },
    { solid: '#F0C400', soft: '#FFFAE0' },
    { solid: '#4F63E8', soft: '#EDF0FF' },
    { solid: '#12A594', soft: '#E7FAF7' }
  ];

  function wallColor(name) {
    let n = 0;
    String(name || '').split('').forEach(function (ch) { n += ch.charCodeAt(0); });
    return WALL_PALETTE[n % WALL_PALETTE.length];
  }

  function softOf(hex) {
    const m = String(hex || '').replace('#', '').match(/^([0-9a-f]{6})$/i);
    if (!m) return 'rgba(235, 97, 42, 0.12)';
    const n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',0.13)';
  }

  function tagSolid(tag) {
    return (tag && tag.color) || wallColor(tag && tag.name).solid;
  }

  function wallAbbr(name) {
    const text = String(name || '');
    if (/^DT/.test(text)) return 'DT';
    if (/^[A-Za-z]/.test(text)) return text.slice(0, 2).toUpperCase();
    return text.slice(0, 2);
  }

  function wallStars(count) {
    const n = Math.max(1, Math.min(3, Number(count) || 1));
    return '★'.repeat(n) + '<span class="wall-star-off">' + '★'.repeat(3 - n) + '</span>';
  }

  function findWallTag(name, type) {
    return S().wallTags.find(function (t) {
      return t.name === name && (!type || t.type === type);
    });
  }

  function replaceTagInList(list, oldName, newName) {
    if (!Array.isArray(list) || list.indexOf(oldName) === -1) return list;
    const out = [];
    list.forEach(function (name) {
      const next = name === oldName ? newName : name;
      if (out.indexOf(next) === -1) out.push(next);
    });
    return out;
  }

  function renameTagReferences(oldName, type, newName) {
    const st = S();
    const isTask = type === '任务标签';
    if (isTask) {
      (st.tasks || []).forEach(function (task) {
        task.tags = replaceTagInList(task.tags, oldName, newName);
        (task.subs || []).forEach(function (sub) {
          sub.tags = replaceTagInList(sub.tags, oldName, newName);
        });
      });
      if (Array.isArray(D.taskTags)) D.taskTags = replaceTagInList(D.taskTags, oldName, newName);
      if (Array.isArray(D.taskTagMeta)) {
        D.taskTagMeta.forEach(function (meta) {
          if (meta.name === oldName) meta.name = newName;
        });
      }
    }
    (st.personAchievements || []).forEach(function (item) {
      if (item.name === oldName && item.type === type) item.name = newName;
    });
  }

  function removeTagReferences(name, type) {
    const st = S();
    const isTask = type === '任务标签';
    if (isTask) {
      (st.tasks || []).forEach(function (task) {
        task.tags = (task.tags || []).filter(function (tag) { return tag !== name; });
        (task.subs || []).forEach(function (sub) {
          sub.tags = (sub.tags || []).filter(function (tag) { return tag !== name; });
        });
      });
      if (Array.isArray(D.taskTags)) D.taskTags = D.taskTags.filter(function (tag) { return tag !== name; });
      if (Array.isArray(D.taskTagMeta)) D.taskTagMeta = D.taskTagMeta.filter(function (meta) { return meta.name !== name; });
    }
    st.personAchievements = (st.personAchievements || []).filter(function (item) {
      return !(item.name === name && item.type === type);
    });
  }

  TAG.detail = function (tag) {
    if (!tag) return;
    const isPerson = tag.type === '人员标签';
    const usage = tagUsage(tag);
    const rows = [
      ['标签名称', U().esc(tag.name)],
      ['标签类型', U().esc(tag.type)],
      [isPerson ? '持有人数' : '使用任务数', '<b>' + usage.count + '</b> ' + usage.unit],
      ['最近使用', U().esc(usage.last)],
      ['解锁条件', U().esc(tag.unlock || (isPerson ? '完成对应标签任务并累计提升星级' : '完成对应任务'))],
      ['创建', U().esc((tag.createdAt || '—') + ' · ' + (tag.createdBy || '—'))],
      ['最近更新', U().esc((tag.updatedAt || '—') + ' · ' + (tag.updatedBy || '—'))]
    ];
    if (isPerson && tag.source === '授权') {
      rows.push(['勋章规则', '取得授权后自动获得，不计次数与首次领取时间']);
      rows.push(['标签标识', '<span class="auth-mark">授权</span>']);
    } else if (isPerson) {
      rows.push(['标签星级', '<span class="wall-star-range">1–3 星</span>']);
      rows.push(['升星规则', (tag.star2 || 5) + ' 次升 2 星 · ' + (tag.star3 || 10) + ' 次升 3 星']);
    }
    const canEdit = S().role !== 'employee';
    U().detailModal({
      title: '标签详情',
      body: '<div class="tag-detail-list">' + rows.map(function (row) {
        return '<div class="tag-detail-row"><span>' + row[0] + '</span><div>' + row[1] + '</div></div>';
      }).join('') + '</div>' +
        (usage.names.length
          ? '<div class="detail-section"><h4>' + (isPerson ? '持有人' : '关联任务') + '（' + usage.count + '）</h4><div>' +
            usage.names.slice(0, 8).map(function (n) { return '<span class="tag-inline">' + U().esc(n) + '</span>'; }).join('') +
            (usage.names.length > 8 ? '<span class="tag-inline">等 ' + usage.names.length + ' 个</span>' : '') +
            '</div></div>'
          : '') +
        ((tag.audit || []).length ? '<div class="detail-section"><h4>操作记录</h4><div class="timeline">' +
          tag.audit.slice().reverse().map(function (a) {
            return '<div class="timeline-item"><b>' + U().esc(a.action) + ' · ' + U().esc(a.actor) + '</b><span>' + U().esc(a.time) + '</span></div>';
          }).join('') + '</div></div>' : ''),
      foot: (canEdit
        ? '<button class="btn btn-soft" data-tag-edit type="button">编辑标签</button>' +
          '<button class="btn btn-danger" data-tag-remove type="button">删除标签</button>'
        : '') +
        '<span class="spacer"></span><button class="btn btn-ghost" data-tag-close type="button">关闭</button>',
      onMount: function (close, root) {
        root.querySelector('[data-tag-close]').addEventListener('click', close);
        const edit = root.querySelector('[data-tag-edit]');
        if (edit) edit.addEventListener('click', function () { close(); TAG.edit(tag.name, tag.type); });
        const remove = root.querySelector('[data-tag-remove]');
        if (remove) remove.addEventListener('click', function () { close(); TAG.remove(tag.name, tag.type); });
      }
    });
  };

  TAG.edit = function (name, type) {
    const st = S();
    const tag = name ? findWallTag(name, type) : null;
    const editing = !!tag;
    const currentType = tag ? tag.type : '';
    const currentColor = tag ? tagSolid(tag) : '';
    const swatches = WALL_PALETTE.map(function (c) {
      const selected = !!currentColor && c.solid.toLowerCase() === currentColor.toLowerCase();
      return '<button class="tag-color-swatch' + (selected ? ' selected' : '') + '" type="button" data-color="' + c.solid + '" style="background:' + c.solid + '" aria-label="选择颜色 ' + c.solid + '"></button>';
    }).join('');
    const star2 = tag && tag.star2 ? tag.star2 : '';
    const star3 = tag && tag.star3 ? tag.star3 : '';

    U().modal({
      title: editing ? '编辑标签' : '新增标签',
      sub: editing ? tag.name + ' · ' + tag.type : '任务标签与人员标签配置',
      wide: true,
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '标签名称', required: true, control: '<input id="tgName" type="text" maxlength="12" value="' + U().esc(tag ? tag.name : '') + '" placeholder="请输入标签名称">' }) +
          U().formRow({ label: '标签类型', required: true, control: '<select id="tgType"' + (editing ? ' disabled' : '') + '><option value="">请选择标签类型</option>' + U().statusOptions(['任务标签', '人员标签'], currentType) + '</select>' }) +
          U().formRow({ label: '标签颜色', required: true, full: true, control:
            '<div class="tag-color-field">' +
              '<input id="tgColor" type="hidden" value="' + U().esc(currentColor) + '">' +
              '<div class="tag-color-grid">' + swatches + '</div>' +
              '<label class="tag-color-custom">自定义<input id="tgColorPicker" type="color" value="' + U().esc(currentColor) + '"></label>' +
            '</div>' }) +
          U().formRow({ label: '解锁条件', required: true, full: true, control: '<input id="tgUnlock" type="text" maxlength="60" value="' + U().esc(tag ? (tag.unlock || '') : '') + '" placeholder="请输入解锁条件">' }) +
          '<div class="star-rule-fields" id="tgStarRules"' + (currentType === '人员标签' ? '' : ' hidden') + '>' +
            '<div class="form-field"><label>2 星门槛 <em>*</em></label><input id="tgStar2" type="number" min="2" max="999" value="' + star2 + '" placeholder="如 5"><span class="form-hint">完成多少次后升到 2 星</span></div>' +
            '<div class="form-field"><label>3 星门槛 <em>*</em></label><input id="tgStar3" type="number" min="3" max="999" value="' + star3 + '" placeholder="如 10"><span class="form-hint">完成多少次后升到 3 星</span></div>' +
          '</div>' +
          U().formRow({ label: '标签说明', required: true, full: true, control: '<textarea id="tgDesc" placeholder="请输入标签说明">' + U().esc(tag ? tag.desc : '') + '</textarea>' }) +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-save type="button">' + (editing ? '保存修改' : '创建标签') + '</button>',
      onMount: function (close, root) {
        const typeSel = root.querySelector('#tgType');
        const starRules = root.querySelector('#tgStarRules');
        const colorValue = root.querySelector('#tgColor');
        const picker = root.querySelector('#tgColorPicker');
        function syncType() {
          starRules.hidden = typeSel.value !== '人员标签';
        }
        function selectColor(value) {
          if (!value) return;
          colorValue.value = value;
          picker.value = value;
          U().clearFieldError(colorValue);
          U().$$('.tag-color-swatch', root).forEach(function (btn) {
            btn.classList.toggle('selected', btn.dataset.color.toLowerCase() === String(value).toLowerCase());
          });
        }
        typeSel.addEventListener('change', function () { U().clearFieldError(typeSel); syncType(); });
        syncType();
        U().$$('.tag-color-swatch', root).forEach(function (btn) {
          btn.addEventListener('click', function () { selectColor(btn.dataset.color); });
        });
        picker.addEventListener('input', function () { selectColor(picker.value); });
        U().bindFieldClear(root);
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-save]').addEventListener('click', function () {
          const nameEl = root.querySelector('#tgName');
          const typeEl = root.querySelector('#tgType');
          const unlockEl = root.querySelector('#tgUnlock');
          const descEl = root.querySelector('#tgDesc');
          const s2El = root.querySelector('#tgStar2');
          const s3El = root.querySelector('#tgStar3');
          const person = typeEl.value === '人员标签';
          const valid = U().validateRequired([
            [nameEl, '请输入标签名称'],
            [typeEl, '请选择标签类型'],
            [unlockEl, '请输入解锁条件'],
            [descEl, '请输入标签说明']
          ]);
          if (!colorValue.value) {
            U().showFieldError(colorValue, '请选择标签颜色');
            return;
          }
          if (!valid) return;
          const nameVal = nameEl.value.trim();
          const typeVal = typeEl.value;
          if (st.wallTags.some(function (item) { return item !== tag && item.type === typeVal && item.name === nameVal; })) {
            U().showFieldError(nameEl, '同类型标签名称已存在');
            return;
          }
          const s2 = person ? Math.max(2, Number(s2El.value) || 0) : 0;
          const s3 = person ? Math.max(3, Number(s3El.value) || 0) : 0;
          if (person && (!s2El.value || !s3El.value)) {
            U().showFieldError(!s2El.value ? s2El : s3El, '请填写星级门槛');
            return;
          }
          if (person && s3 <= s2) {
            U().showFieldError(s3El, '3 星门槛必须大于 2 星门槛');
            return;
          }
          const count = tag ? (tag.count || 0) : 0;
          const data = {
            name: nameVal,
            type: typeVal,
            color: colorValue.value,
            unlock: unlockEl.value.trim(),
            star2: person ? s2 : 0,
            star3: person ? s3 : 0,
            count: count,
            stars: person ? U().starForCount(count, s2, s3) : 0,
            firstClaimed: tag ? (tag.firstClaimed || '') : '',
            desc: descEl.value.trim()
          };
          if (editing) {
            const previousName = tag.name;
            if (nameVal !== previousName) renameTagReferences(previousName, tag.type, nameVal);
            Object.assign(tag, data, { updatedAt: D.meta.demoNow, updatedBy: st.user.name });
            tag.audit = tag.audit || [];
            tag.audit.push({ time: D.meta.demoNow, actor: st.user.name, action: '编辑标签' });
            ITO.log('编辑标签', tag.name + ' · ' + tag.type, '配置');
            U().toast('标签已更新');
          } else {
            data.createdAt = D.meta.demoNow;
            data.createdBy = st.user.name;
            data.updatedAt = D.meta.demoNow;
            data.updatedBy = st.user.name;
            data.audit = [{ time: D.meta.demoNow, actor: st.user.name, action: '创建标签' }];
            st.wallTags.unshift(data);
            if (typeVal === '任务标签') {
              if (Array.isArray(D.taskTags) && D.taskTags.indexOf(nameVal) === -1) D.taskTags.push(nameVal);
              if (Array.isArray(D.taskTagMeta) && !D.taskTagMeta.some(function (meta) { return meta.name === nameVal; })) {
                D.taskTagMeta.push({ name: nameVal, count: 0, firstClaimed: D.meta.today, desc: data.desc });
              }
            }
            ITO.log('新增标签', nameVal + ' · ' + typeVal, '配置');
            U().toast('标签已创建');
          }
          close();
          ITO.refresh();
        });
      }
    });
  };

  TAG.remove = function (name, type) {
    const st = S();
    const tag = findWallTag(name, type);
    if (!tag) return;
    U().confirm({
      title: '删除标签',
      text: '确认删除「' + tag.name + '」？' +
        (tag.type === '任务标签' ? '任务与人员成就上的引用会同步移除。' : '人员成就上的引用会同步移除。'),
      okText: '删除',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      removeTagReferences(name, type);
      st.wallTags = st.wallTags.filter(function (t) { return !(t.name === name && t.type === type); });
      ITO.log('删除标签', tag.name + ' · ' + tag.type, '配置');
      U().toast('标签已删除', 'warn');
      ITO.refresh();
    });
  };

  TAG.personDetail = function (personName, tagName) {
    const person = S().staff.find(function (p) { return p.name === personName; });
    const rec = (S().personAchievements || []).find(function (a) {
      return a.person === personName && a.name === tagName && a.type === '人员标签';
    });
    if (!person || !rec) return;
    const group = ITO.getGroup(person.group) || {};
    const canEdit = S().role !== 'employee';
    const isAuth = rec.source === '授权';
    U().detailModal({
      title: personName + ' · ' + tagName,
      sub: (group.name || '') + ' · ' + (person.title || ''),
      body: '<div class="tag-detail-list">' +
        '<div class="tag-detail-row"><span>人员</span><div>' + U().esc(personName) + '</div></div>' +
        '<div class="tag-detail-row"><span>专业组</span><div>' + U().esc(group.name || '—') + '</div></div>' +
        '<div class="tag-detail-row"><span>标签</span><div>' + U().esc(tagName) + '</div></div>' +
        '<div class="tag-detail-row"><span>' + (isAuth ? '标签标识' : '当前星级') + '</span><div>' + (isAuth ? '<span class="auth-mark">授权</span>' : '<span class="wall-stars">' + wallStars(rec.stars || 1) + '</span>') + '</div></div>' +
        (isAuth ? '<div class="tag-detail-row"><span>勋章规则</span><div>取得授权后自动获得，不计次数与首次领取时间</div></div>' : '<div class="tag-detail-row"><span>累计次数</span><div><b class="wall-count">' + (rec.count || 0) + '</b> 次</div></div>') +
        (isAuth ? '' : '<div class="tag-detail-row"><span>首次领取</span><div>' + U().esc(rec.firstClaimed || '—') + '</div></div>') +
        '<div class="tag-detail-row"><span>标签说明</span><div>' + U().esc(rec.desc || '—') + '</div></div>' +
      '</div>',
      foot: (canEdit ? '<button class="btn btn-soft" data-tag-edit type="button">编辑标签规则</button>' : '') +
        '<span class="spacer"></span><button class="btn btn-ghost" data-tag-close type="button">关闭</button>',
      onMount: function (close, root) {
        root.querySelector('[data-tag-close]').addEventListener('click', close);
        const edit = root.querySelector('[data-tag-edit]');
        if (edit) edit.addEventListener('click', function () { close(); TAG.edit(tagName, '人员标签'); });
      }
    });
  };

  function tagUsage(tag) {
    const st = S();
    if (tag.type === '人员标签') {
      const holders = (st.personAchievements || []).filter(function (a) {
        return a.name === tag.name && a.type === '人员标签';
      });
      const dates = holders.map(function (a) { return a.firstClaimed; }).filter(Boolean).sort();
      return {
        count: holders.length,
        unit: '人',
        last: dates.length ? dates[dates.length - 1] : '—',
        names: holders.map(function (a) { return a.person; })
      };
    }
    const tasks = (st.tasks || []).filter(function (t) {
      return (t.tags || []).indexOf(tag.name) > -1;
    });
    const dates = tasks.map(function (t) { return t.completedAt || t.due; }).filter(Boolean).sort();
    return {
      count: tasks.length,
      unit: '个任务',
      last: dates.length ? String(dates[dates.length - 1]).slice(0, 10) : '—',
      names: tasks.map(function (t) { return t.name; })
    };
  }

  function personWallCard(person) {
    const group = ITO.getGroup(person.group) || {};
    const tags = (S().personAchievements || []).filter(function (a) {
      return a.person === person.name && a.type === '人员标签';
    });
    const search = (person.name + ' ' + (group.name || '') + ' ' + tags.map(function (t) { return t.name; }).join(' ')).toLowerCase();
    return '<article class="person-wall-card" data-search="' + U().esc(search) + '">' +
      '<div class="pwc-head"><b>' + U().esc(person.name) + '</b><span>' + U().esc((group.name || '') + ' · ' + (person.title || '')) + '</span></div>' +
      '<div class="pwc-tags">' +
        (tags.length ? tags.map(function (t) {
          const def = findWallTag(t.name, '人员标签');
          const solid = def ? tagSolid(def) : wallColor(t.name).solid;
          return '<button class="pwc-tag" type="button" data-person="' + U().esc(person.name) + '" data-tag="' + U().esc(t.name) + '">' +
            '<i style="--c:' + solid + '"></i><b>' + U().esc(t.name) + '</b>' + (t.source === '授权' ? '<span class="auth-mark">授权</span>' : '<em>' + wallStars(t.stars || 1) + '</em>') +
          '</button>';
        }).join('') : '<span class="pwc-empty">暂无人员标签</span>') +
      '</div>' +
    '</article>';
  }

  function personSection(people) {
    return '<section class="wall-section wall-people" data-wall-section="人员标签" data-total="' + people.length + '" data-unit="人">' +
      '<div class="wall-section-head"><h3>人员标签</h3><span>' + people.length + ' 人</span></div>' +
      '<div class="person-wall-grid">' + people.map(personWallCard).join('') + '</div>' +
    '</section>';
  }

  function wallCard(tag) {
    const solid = tagSolid(tag);
    const soft = softOf(solid);
    const isPerson = tag.type === '人员标签';
    const usage = tagUsage(tag);
    return '<button class="wall-card" type="button" data-wall-name="' + U().esc(tag.name) + '" data-wall-type="' + U().esc(tag.type) + '" data-search="' + U().esc((tag.name + ' ' + tag.type + ' ' + (tag.desc || '')).toLowerCase()) + '">' +
      '<span class="wall-icon" style="--tag-color:' + solid + ';--tag-soft:' + soft + '"><span>' + U().esc(wallAbbr(tag.name)) + '</span></span>' +
      '<b>' + U().esc(tag.name) + '</b>' +
      (isPerson ? '<span class="wall-card-stars">' + (tag.source === '授权' ? '<span class="auth-mark">授权</span>' : '<span class="wall-star-range">1–3 星</span>') + '</span>' : '') +
      '<span class="wall-card-usage"><b>' + usage.count + '</b> ' + (isPerson ? '人持有' : '个任务使用') + '</span>' +
      '<small>' + U().esc(tag.type) + '</small>' +
    '</button>';
  }

  function wallSection(label, list) {
    return '<section class="wall-section" data-wall-section="' + label + '" data-total="' + list.length + '" data-unit="个">' +
      '<div class="wall-section-head"><h3>' + label + '</h3><span>' + list.length + ' 个</span></div>' +
      '<div class="wall-grid">' + (list.length ? list.map(wallCard).join('') : U().emptyState('暂无标签', '点击右上角新增标签', 'award')) + '</div>' +
    '</section>';
  }

  /* ── achievement wall ───────────────────── */
  P.tags = {
    render: function () {
      if (window.ITO_ENSURE_AUTH_TAGS) window.ITO_ENSURE_AUTH_TAGS();
      const st = S();
      const personTags = st.wallTags.filter(function (t) { return t.type === '人员标签'; });
      const taskTags = st.wallTags.filter(function (t) { return t.type === '任务标签'; });
      const canEdit = st.role !== 'employee';
      const staffNames = new Set((st.staff || []).map(function (p) { return p.name; }));
      const linkedPeople = new Set((st.personAchievements || []).filter(function (a) {
        return staffNames.has(a.person);
      }).map(function (a) { return a.person; })).size;
      const unusedTags = st.wallTags.filter(function (t) { return tagUsage(t).count === 0; }).length;

      return U().pageHead({
        title: '属性勋章',
        sub: '系统勋章字典 · 授权属性、人员标签与任务标签'
      }) +
      '<div class="summary-grid wall-stats">' +
        '<div class="summary-chip"><span class="icon">' + U().icon('award') + '</span><div><b>' + personTags.length + '</b><span>人员标签</span></div></div>' +
        '<div class="summary-chip"><span class="icon blue">' + U().icon('task') + '</span><div><b>' + taskTags.length + '</b><span>任务标签</span></div></div>' +
        '<div class="summary-chip"><span class="icon green">' + U().icon('users') + '</span><div><b>' + linkedPeople + '</b><span>已关联人员</span></div></div>' +
        '<div class="summary-chip"><span class="icon yellow">' + U().icon('alert') + '</span><div><b>' + unusedTags + '</b><span>当前未使用</span></div></div>' +
      '</div>' +
      '<div class="wall-toolbar">' +
        '<label class="search-field wall-search">' + U().icon('search') + '<input id="wallSearch" type="search" placeholder="搜索标签名称 / 类型..."></label>' +
        '<span class="wall-total">' + personTags.length + ' 个人标签 · ' + taskTags.length + ' 个任务标签</span>' +
        (canEdit ? '<button class="btn btn-primary" id="wallNewBtn" type="button">' + U().icon('plus') + '新增标签</button>' : '') +
      '</div>' +
      '<div class="wall-columns">' +
        wallSection('人员标签', personTags) +
        wallSection('任务标签', taskTags) +
      '</div>';
    },

    after: function () {
      const search = document.getElementById('wallSearch');
      if (search) {
        search.addEventListener('input', function () {
          const q = search.value.trim().toLowerCase();
          U().$$('.wall-section').forEach(function (section) {
            let visible = 0;
            U().$$('.wall-card, .person-wall-card', section).forEach(function (card) {
              const hit = !q || card.dataset.search.indexOf(q) > -1;
              card.hidden = !hit;
              if (hit) visible += 1;
            });
            section.hidden = visible === 0;
            const unit = section.dataset.unit || '个';
            const count = section.querySelector('.wall-section-head span');
            if (count) count.textContent = q ? visible + ' / ' + section.dataset.total + ' ' + unit : section.dataset.total + ' ' + unit;
          });
        });
      }

      U().$$('.wall-card').forEach(function (card) {
        card.addEventListener('click', function () {
          TAG.detail(findWallTag(card.dataset.wallName, card.dataset.wallType));
        });
      });

      U().$$('.pwc-tag').forEach(function (chip) {
        chip.addEventListener('click', function () {
          TAG.personDetail(chip.dataset.person, chip.dataset.tag);
        });
      });

      const add = document.getElementById('wallNewBtn');
      if (add) add.addEventListener('click', function () { TAG.edit(null, null); });
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
          '<td><div class="person-cell"><div><b>' + U().esc(l.actor) + '</b></div></div></td>' +
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
        '<div class="table-wrap"><table class="data-table config-table"><thead><tr><th>时间</th><th>操作人</th><th>操作</th><th>对象</th><th>类型</th></tr></thead>' +
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
        U().exportPreview({ title: '操作日志导出预览', rows: rows, filename: 'ITO操作日志.csv' });
        ITO.log('导出操作日志', st.logs.length + ' 条', '系统');
        U().toast('操作日志已导出');
      });
    }
  };
})();
