/* ─────────────────────────────────────────────
   pages · duty & professional groups
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const P = (window.ITO_PAGES = window.ITO_PAGES || {});
  const D = window.ITO_DATA;

  function S() { return ITO.state; }
  function U() { return ITO.ui; }

  function summary(items) {
    return '<div class="summary-grid">' + items.map(function (x) {
      return '<div class="summary-chip"><span class="icon ' + (x.tone || '') + '">' + U().icon(x.icon) + '</span>' +
        '<div><b>' + x.value + '</b><span>' + x.label + '</span></div></div>';
    }).join('') + '</div>';
  }

  /* ── duty · weekly rotation ─────────────── */
  const DUTY = {};

  function md(iso) { return iso ? iso.slice(5).replace('-', '/') : '—'; }
  function weekRange(w) { return md(w.start) + ' – ' + md(w.end); }
  function memberOf(name) { return S().staff.find(function (p) { return p.name === name; }) || null; }
  function groupNameOf(name) {
    const p = memberOf(name);
    const g = p ? ITO.getGroup(p.group) : null;
    return g ? g.name : '—';
  }
  function weekByKey(key) {
    return S().duty.weeks.find(function (w) { return w.key === key; }) || null;
  }
  function currentWeek() {
    return weekByKey(S().duty.currentKey) || S().duty.weeks[0];
  }
  function nextWeek() {
    return weekByKey(S().duty.nextKey) || S().duty.weeks[1];
  }
  function weekStatus(w) {
    const st = S();
    if (w.key === st.duty.currentKey) return { label: '值班中', tone: 'green' };
    if (w.key === st.duty.nextKey) return { label: '下周', tone: 'blue' };
    return w.key < st.duty.currentKey ? { label: '已结束', tone: 'gray' } : { label: '待开始', tone: 'gray' };
  }
  function canEditDuty() {
    return ITO.roleIs('manager', 'leader');
  }
  function openTasksOf(name) {
    const out = [];
    S().tasks.forEach(function (t) {
      if (t.canceled || t.draft) return;
      t.subs.forEach(function (s) {
        if (s.owner === name && ['已完成', '已取消', '草稿', '待分发'].indexOf(s.status) === -1) {
          out.push({ task: t, sub: s });
        }
      });
    });
    return out;
  }
  function closedThisWeek(name, w) {
    let n = 0;
    S().tasks.forEach(function (t) {
      t.subs.forEach(function (s) {
        if (s.owner !== name || s.status !== '已完成' || !s.completedAt) return;
        const day = s.completedAt.slice(0, 10);
        if (day >= w.start && day <= w.end) n += 1;
      });
    });
    return n;
  }
  function activeAuthsOf(name) {
    return S().auths.filter(function (a) {
      if (a.person !== name || a.status === '已撤销') return false;
      return ITO.authStatus(a.validTo).status !== '已过期';
    });
  }
  function remainText(target) {
    const now = new Date(D.meta.demoNow.replace(/-/g, '/').replace('T', ' '));
    const t = new Date(String(target).replace(/-/g, '/').replace('T', ' '));
    const mins = Math.round((t - now) / 60000);
    if (mins <= 0) return '已到交接时间';
    const days = Math.floor(mins / 1440);
    const hours = Math.floor((mins % 1440) / 60);
    if (days) return '剩 ' + days + ' 天 ' + hours + ' 小时';
    if (hours) return '剩 ' + hours + ' 小时 ' + (mins % 60) + ' 分';
    return '剩 ' + mins + ' 分钟';
  }

  DUTY.detail = function (key) {
    const w = weekByKey(key);
    if (!w) return;
    const person = memberOf(w.person);
    const status = weekStatus(w);
    const g = person ? ITO.getGroup(person.group) : null;
    const tasks = openTasksOf(w.person);
    const auths = activeAuthsOf(w.person);
    const weekIdx = S().duty.weeks.indexOf(w);
    const after = S().duty.weeks[weekIdx + 1];
    const canEdit = canEditDuty() && w.key >= S().duty.currentKey;

    const list = tasks.slice(0, 6).map(function (x) {
      return '<div class="mini-row"><span class="dot" style="background:' +
        (U().isOverdue(x.sub) ? 'var(--red)' : 'var(--brand)') + '"></span>' +
        '<div class="txt"><b>' + U().esc(x.sub.name) + '</b><span>' + x.sub.id + ' · ' + U().esc(x.sub.due) + '</span></div>' +
        U().badge(x.sub.status) + '</div>';
    }).join('');

    U().modal({
      title: '值班详情 · ' + weekRange(w),
      sub: '第 ' + w.weekNo + ' 周 · ' + (g ? g.name : '—') + ' · ' + status.label,
      wide: true,
      body:
        '<div class="duty-detail-top">' +
          '<div><b>' + U().esc(w.person) + '</b><span>' + U().esc(person ? person.title : '') + ' · ' + U().esc(person ? person.phone : '—') + '</span></div>' +
          U().badge(status.label, status.tone) + '</div>' +
        '<div class="detail-grid" style="margin-top:16px">' +
          '<div class="detail-field"><label>值班周期</label><div>' + weekRange(w) + ' · 周一 08:00 交接</div></div>' +
          '<div class="detail-field"><label>所属专业组</label><div>' + U().esc(g ? g.name : '—') + '</div></div>' +
          '<div class="detail-field"><label>名下在办</label><div>' + tasks.length + ' 项</div></div>' +
          '<div class="detail-field"><label>本周闭环</label><div>' + closedThisWeek(w.person, w) + ' 项</div></div>' +
          '<div class="detail-field"><label>有效授权</label><div>' + auths.length + ' 项</div></div>' +
          '<div class="detail-field"><label>下周值班</label><div>' + U().esc(after ? after.person : '—') + '</div></div>' +
        '</div>' +
        '<div class="detail-section"><h4>名下在办任务（' + tasks.length + '）</h4>' +
          (tasks.length ? '<div class="mini-list">' + list + '</div>' : '<p class="muted">当前没有在办任务</p>') +
        '</div>' +
        '<div class="detail-section"><h4>交接备注</h4><p class="duty-note-text">' +
          U().esc(w.note || '暂无特别交接事项，按常规完成未闭环任务、在途变更与告警确认。') + '</p></div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">关闭</button>' +
        (canEdit ? '<span class="spacer"></span><button class="btn btn-primary" data-edit type="button">调整值班</button>' : ''),
      onMount: function (close, root) {
        root.querySelector('[data-cancel]').addEventListener('click', close);
        const edit = root.querySelector('[data-edit]');
        if (edit) edit.addEventListener('click', function () { close(); DUTY.editWeek(key); });
      }
    });
  };

  DUTY.editWeek = function (key) {
    const st = S();
    const w = weekByKey(key);
    if (!w) return;
    if (!canEditDuty()) { U().toast('当前身份不可调整值班', 'warn'); return; }
    if (w.key < st.duty.currentKey) { U().toast('已结束的周不可调整', 'warn'); return; }

    const idx = st.duty.weeks.indexOf(w);
    const prev = st.duty.weeks[idx - 1];
    const next = st.duty.weeks[idx + 1];
    const names = st.staff.map(function (p) { return p.name; });
    const current = memberOf(w.person);
    const reason = w.edited ? w.edited.reason : '';

    U().modal({
      title: '调整值班 · 第 ' + w.weekNo + ' 周',
      sub: weekRange(w) + ' · 周一 08:00 交接',
      wide: true,
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '值班人', required: true, control: '<select id="duPerson">' + names.map(function (n) {
            return '<option value="' + U().esc(n) + '"' + (n === w.person ? ' selected' : '') + '>' + U().esc(n) + '</option>';
          }).join('') + '</select>' }) +
          U().formRow({ label: '所属专业组', control: '<div class="static-field" id="duGroup">' + U().esc(groupNameOf(w.person)) + '</div>' }) +
          U().formRow({ label: '联系电话', control: '<div class="static-field" id="duPhone">' + U().esc(current ? current.phone : '—') + '</div>' }) +
          U().formRow({ label: '交接时间', control: '<div class="static-field">' + md(w.start) + ' 周一 ' + st.duty.handover + '</div>' }) +
          U().formRow({ label: '调整原因', required: true, full: true, control: '<textarea id="duReason" placeholder="说明换班原因，例如人员出差、临时支援">' + U().esc(reason) + '</textarea>' }) +
          U().formRow({ label: '交接备注', full: true, control: '<textarea id="duNote" placeholder="未闭环任务、在途变更、告警与授权到期事项">' + U().esc(w.note || '') + '</textarea>' }) +
        '</div>' +
        '<div class="form-hint" style="margin-top:10px">一周只安排一名值班人，7×24 负责；调整后立即生效并写入操作日志。</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-save type="button">保存调整</button>',
      onMount: function (close, root) {
        const sel = root.querySelector('#duPerson');
        const reasonEl = root.querySelector('#duReason');
        function paintMember() {
          const p = memberOf(sel.value);
          root.querySelector('#duGroup').textContent = groupNameOf(sel.value);
          root.querySelector('#duPhone').textContent = p ? p.phone : '—';
        }
        sel.addEventListener('change', paintMember);
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-save]').addEventListener('click', function () {
          const name = sel.value;
          if (!name) { U().toast('请选择值班人', 'warn'); return; }
          if (!reasonEl.value.trim()) { U().toast('请填写调整原因', 'warn'); reasonEl.focus(); return; }
          if (prev && prev.person === name) { U().toast('不能与上一周值班人重复', 'warn'); return; }
          if (next && next.person === name) { U().toast('不能与下一周值班人重复', 'warn'); return; }
          const old = w.person;
          w.person = name;
          w.note = root.querySelector('#duNote').value.trim();
          w.edited = { by: st.user.name, at: D.meta.demoNow, reason: reasonEl.value.trim() };
          ITO.log('调整值班', '第 ' + w.weekNo + ' 周 ' + weekRange(w) + ' · ' + old + ' → ' + name + ' · ' + w.edited.reason, '值班');
          close();
          U().toast('值班已调整为 ' + name);
          ITO.refresh();
        });
      }
    });
  };

  P.duty = {
    render: function () {
      const st = S();
      const weeks = st.duty.weeks;
      const current = currentWeek();
      const next = nextWeek();
      const cur = memberOf(current.person);
      const nxt = memberOf(next.person);
      const curGroup = cur ? ITO.getGroup(cur.group) : null;
      const nxtGroup = nxt ? ITO.getGroup(nxt.group) : null;
      const canEdit = canEditDuty();
      const handover = next.start + ' ' + st.duty.handover;

      const rows = weeks.map(function (w) {
        const p = memberOf(w.person);
        const g = p ? ITO.getGroup(p.group) : null;
        const status = weekStatus(w);
        const open = openTasksOf(w.person).length;
        const isCurrent = w.key === st.duty.currentKey;
        const isPast = w.key < st.duty.currentKey;
        return '<tr class="duty-week-row' + (isCurrent ? ' is-current' : '') + (isPast ? ' is-past' : '') + '" data-week="' + w.key + '" tabindex="0" role="button" aria-label="查看第 ' + w.weekNo + ' 周值班表">' +
          '<td><div class="week-no"><b>第 ' + w.weekNo + ' 周</b><small>' + w.start.slice(0, 4) + '</small></div></td>' +
          '<td><div class="week-range"><b>' + weekRange(w) + '</b><small>' + (isCurrent ? '本周 · 周一 08:00 交接' : '周一 08:00 交接') + '</small></div></td>' +
          '<td><div class="duty-person-cell"><b>' + U().esc(w.person) + '</b></div></td>' +
          '<td>' + (g ? U().groupPill(g.id) : '<span class="muted">—</span>') + '</td>' +
          '<td class="duty-phone">' + U().esc(p ? p.phone : '—') + '</td>' +
          '<td class="duty-open"><b>' + open + '</b> 项</td>' +
          '<td>' + U().badge(status.label, status.tone) + '</td>' +
          '<td><div class="row-actions">' +
            (canEdit && !isPast ? '<button class="btn btn-soft btn-sm" data-duty-edit="' + w.key + '" type="button">调整</button>' : '<span class="muted">—</span>') +
          '</div></td></tr>';
      }).join('');

      return U().pageHead({
        title: '值班管理',
        sub: '一人一周 7×24 值守 · 每周一 08:00 交接 · 当前第 ' + current.weekNo + ' 周',
        actions:
          '<button class="btn btn-ghost" id="dutyExportBtn" type="button">' + U().icon('download') + '导出轮班表</button>' +
          (canEdit ? '<button class="btn btn-primary" id="dutyEditBtn" type="button">' + U().icon('calendar') + '调整本周值班</button>' : '')
      }) +
      summary([
        { icon: 'users', value: U().esc(current.person), label: '本周值班 · ' + U().esc(curGroup ? curGroup.name : '—') },
        { icon: 'calendar', value: U().esc(next.person), label: '下周值班 · ' + U().esc(nxtGroup ? nxtGroup.name : '—'), tone: 'blue' },
        { icon: 'clock', value: weekRange(current), label: '本周周期 · 第 ' + current.weekNo + ' 周' },
        { icon: 'shield', value: md(next.start) + ' 08:00', label: '下次交接 · ' + remainText(handover), tone: 'green' }
      ]) +

      '<section class="card duty-board">' +
        '<div class="duty-board-head"><h3>周轮班表</h3><span>近 6 周 + 未来 6 周 · 共 ' + weeks.length + ' 周 · ' + st.duty.rotation.length + ' 人固定循环</span></div>' +
        '<div class="table-wrap duty-week-wrap"><table class="data-table duty-week-table">' +
          '<thead><tr><th>周次</th><th>日期范围</th><th>值班人</th><th>专业组</th><th>联系电话</th><th>名下在办</th><th>状态</th><th style="text-align:right">操作</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table></div>' +
        '<div class="duty-week-foot"><span>表格内滚动查看完整 ' + weeks.length + ' 周</span><span>固定 ' + st.duty.rotation.length + ' 人循环 · 每周一 08:00 交接</span></div>' +
      '</section>' +

      '<div class="duty-notes">' +
        '<div class="card duty-note"><b>交接时间</b><span>每周一 08:00 由上一周值班人与下一周值班人完成交接；系统提前 30 分钟提醒，08:15 未确认将升级通知。</span></div>' +
        '<div class="card duty-note"><b>交接内容</b><span>未闭环任务、在途变更、未处理告警、授权到期与高风险作业，逐项确认责任人与下一步动作。</span></div>' +
        '<div class="card duty-note"><b>升级路径</b><span>值班人 15 分钟未响应 → 专业组主管；30 分钟未恢复 → 部门负责人；P1 事件直接上报张总。</span></div>' +
      '</div>';
    },

    after: function () {
      const st = S();
      const weeks = st.duty.weeks;
      const tbody = document.querySelector('.duty-week-table tbody');
      if (tbody) {
        tbody.addEventListener('click', function (e) {
          const edit = e.target.closest('[data-duty-edit]');
          if (edit) { e.stopPropagation(); DUTY.editWeek(edit.dataset.dutyEdit); return; }
          const detail = e.target.closest('[data-duty-detail]');
          if (detail) { e.stopPropagation(); DUTY.detail(detail.dataset.dutyDetail); return; }
          const row = e.target.closest('tr[data-week]');
          if (row) DUTY.detail(row.dataset.week);
        });
        tbody.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          if (e.target.closest('button, a, input, select, textarea')) return;
          const row = e.target.closest('tr[data-week]');
          if (!row) return;
          e.preventDefault();
          DUTY.detail(row.dataset.week);
        });
      }

      const editBtn = document.getElementById('dutyEditBtn');
      if (editBtn) editBtn.addEventListener('click', function () { DUTY.editWeek(st.duty.currentKey); });

      const exp = document.getElementById('dutyExportBtn');
      if (exp) exp.addEventListener('click', function () {
        const rows = [['周次', '开始日期', '结束日期', '值班人', '专业组', '联系电话', '名下在办', '状态', '交接时间', '备注']];
        weeks.forEach(function (w) {
          const p = memberOf(w.person);
          const g = p ? ITO.getGroup(p.group) : null;
          const status = weekStatus(w);
          rows.push([
            '第 ' + w.weekNo + ' 周', w.start, w.end, w.person, g ? g.name : '—',
            p ? p.phone : '—', openTasksOf(w.person).length, status.label,
            w.start + ' ' + st.duty.handover, w.note || ''
          ]);
        });
        U().exportPreview({ title: '值班轮班导出预览', rows: rows, filename: 'ITO值班轮班-' + D.meta.today + '.csv' });
        ITO.log('导出值班轮班表', weeks.length + ' 周', '值班');
        U().toast('值班轮班表已导出');
      });
    }
  };

  /* ── groups ──────────────────────────────── */
  const GROUP = {};

  function canEditGroup() {
    return ITO.roleIs('manager', 'leader', 'admin');
  }

  function groupStats(g) {
    const st = S();
    const members = st.staff.filter(function (p) { return p.group === g.id; });
    let overdue = 0, open = 0;
    st.tasks.forEach(function (t) {
      t.subs.forEach(function (s) {
        if (s.group !== g.id) return;
        if (s.status !== '已完成') open += 1;
        if (U().isOverdue(s)) overdue += 1;
      });
    });
    return { members: members.length, overdue: overdue, open: open };
  }

  function memberTasks(name) {
    const st = S();
    const out = [];
    st.tasks.forEach(function (t) {
      t.subs.forEach(function (s) {
        if (s.owner === name) out.push({ task: t, sub: s });
      });
    });
    return out;
  }

  GROUP.editMember = function (uid) {
    const st = S();
    const member = uid ? st.staff.find(function (p) { return p.uid === uid; }) : null;
    const editing = !!member;

    U().modal({
      title: editing ? '编辑成员资料' : '新增专业组成员',
      sub: editing ? member.uid : '成员加入后即可被派发任务',
      wide: true,
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '姓名', required: true, control: '<input id="gmName" type="text" maxlength="10" value="' + U().esc(member ? member.name : '') + '" placeholder="请输入姓名">' }) +
          U().formRow({ label: '岗位', required: true, control: '<select id="gmTitle"><option value="">请选择岗位</option>' + U().statusOptions((ITO.dictValues ? ITO.dictValues('personTitle', true) : ['高级工程师', '工程师', '助理工程师']), member ? member.title : '') + '</select>' }) +
          U().formRow({ label: '专业组', required: true, control: '<select id="gmGroup"><option value="">请选择专业组</option>' + U().groupOptions(member ? member.group : '') + '</select>' }) +
          U().formRow({ label: '联系电话', required: true, control: '<input id="gmPhone" type="text" value="' + U().esc(member ? member.phone : '') + '" placeholder="请输入联系电话">' }) +
          U().formRow({ label: '能力标签', full: true, control: '<input id="gmTags" type="text" value="' + U().esc(member ? member.tags.join('、') : '') + '" placeholder="选填，例如：核心岗、KCC">' }) +
          U().formRow({ label: '入组时间', required: true, control: '<input id="gmJoined" type="date" value="' + (member ? member.joined : '') + '">' }) +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-save type="button">' + (editing ? '保存修改' : '添加成员') + '</button>',
      onMount: function (close, root) {
        root.querySelector('[data-cancel]').addEventListener('click', close);
        U().bindFieldClear(root);
        root.querySelector('[data-save]').addEventListener('click', function () {
          const nameEl = root.querySelector('#gmName');
          const titleEl = root.querySelector('#gmTitle');
          const groupEl = root.querySelector('#gmGroup');
          const phoneEl = root.querySelector('#gmPhone');
          const joinedEl = root.querySelector('#gmJoined');
          const valid = U().validateRequired([
            [nameEl, '请输入姓名'],
            [titleEl, '请选择岗位'],
            [groupEl, '请选择专业组'],
            [phoneEl, '请输入联系电话'],
            [joinedEl, '请选择入组时间']
          ]);
          if (!valid) return;
          const name = nameEl.value.trim();
          const tags = root.querySelector('#gmTags').value.split(/[、,，]/).map(function (x) { return x.trim(); }).filter(Boolean);
          const now = D.meta.demoNow;
          if (editing) {
            member.name = name;
            member.title = titleEl.value;
            member.group = groupEl.value;
            member.phone = phoneEl.value.trim();
            member.tags = tags.length ? tags : ['工程师'];
            member.joined = joinedEl.value;
            member.updatedAt = now;
            member.updatedBy = st.user.name;
            member.audit = member.audit || [];
            member.audit.push({ time: now, actor: st.user.name, action: '编辑成员资料' });
            ITO.log('编辑成员资料', member.uid + ' ' + member.name, '组织');
            U().toast('成员资料已更新');
          } else {
            st.staffSeq = (st.staffSeq || 20008) + 1;
            const uid = 'E' + String(st.staffSeq).padStart(5, '0');
            st.staff.push({
              uid: uid, name: name,
              group: groupEl.value,
              title: titleEl.value,
              tags: tags.length ? tags : ['工程师'],
              joined: joinedEl.value,
              phone: phoneEl.value.trim(),
              createdAt: now,
              createdBy: st.user.name,
              updatedAt: now,
              updatedBy: st.user.name,
              audit: [{ time: now, actor: st.user.name, action: '加入组织' }]
            });
            ITO.log('新增专业组成员', uid + ' ' + name, '组织');
            U().toast('成员已加入专业组');
          }
          close();
          ITO.refresh();
        });
      }
    });
  };

  GROUP.profile = function (uid) {
    const st = S();
    const member = st.staff.find(function (p) { return p.uid === uid; });
    if (!member) return;
    const g = ITO.getGroup(member.group);
    const auths = st.auths.filter(function (a) { return a.person === member.name; });

    U().detailModal({
      title: member.name,
      sub: member.uid + ' · ' + g.name,
      body:
        '<div class="profile-head">' +
          '<div><b>' + U().esc(member.title) + '</b><span>入组 ' + member.joined + ' · ' + U().esc(member.phone) + '</span></div></div>' +
        '<div class="detail-grid" style="margin-top:20px">' +
          '<div class="detail-field"><label>专业组</label><div>' + U().esc(g.name) + '</div></div>' +
          '<div class="detail-field"><label>组主管</label><div>' + U().esc(g.manager) + '</div></div>' +
          '<div class="detail-field"><label>组长</label><div>' + U().esc(g.leader || '—') + '</div></div>' +
          '<div class="detail-field"><label>角色</label><div>' + (g.manager === member.name ? '主管' : (g.leader === member.name ? '组长' : '成员')) + '</div></div>' +
          '<div class="detail-field"><label>创建</label><div>' + U().esc((member.createdAt || '—') + ' · ' + (member.createdBy || '—')) + '</div></div>' +
          '<div class="detail-field"><label>最近更新</label><div>' + U().esc((member.updatedAt || '—') + ' · ' + (member.updatedBy || '—')) + '</div></div>' +
        '</div>' +
        '<div class="detail-section"><h4>能力标签</h4><div>' + member.tags.map(function (t) {
          return '<span class="tag-inline">' + U().esc(t) + '</span>';
        }).join('') + '</div></div>' +
        '<div class="detail-section"><h4>属性勋章</h4><div class="member-medal-grid">' +
          ((st.personAchievements || []).filter(function (a) { return a.person === member.name && a.type === '人员标签'; }).map(function (a) {
            const def = (st.wallTags || []).find(function (t) { return t.name === a.name && t.type === '人员标签'; });
            const color = (def && def.color) || '#EB612A';
            const stars = Math.max(1, Math.min(3, a.stars || 1));
            const mark = a.source === '授权' ? '<span class="auth-mark">授权</span>' : '<em>' + '★'.repeat(stars) + '</em>';
            return '<div class="member-medal-card">' +
              '<span class="member-medal-icon" style="background:' + U().esc(color) + '">' + U().esc(String(a.name || '').slice(0, 2)) + '</span>' +
              '<div class="member-medal-main"><b>' + U().esc(a.name) + '</b><span>' + U().esc(a.type) + ' · ' + mark + '</span></div>' +
            '</div>';
          }).join('') || '<span class="muted">暂无属性勋章</span>') +
        '</div></div>' +
        '<div class="detail-section"><h4>作业授权</h4>' +
          (auths.length ? '<div class="mini-list">' + auths.map(function (a) {
            const { status, left } = a.status === '已撤销' ? a : ITO.authStatus(a.validTo);
            const dot = status === '有效' ? 'var(--green)' : status === '临期' ? 'var(--yellow)' : 'var(--red)';
            const remaining = status === '临期' ? ' · 剩余 ' + left + ' 天' : '';
            return '<div class="mini-row"><span class="dot" style="background:' + dot + '"></span>' +
              '<div class="txt"><b>' + U().esc(a.type) + '</b><span>' + U().esc(a.scope) + ' · 至 ' + a.validTo + remaining + '</span></div>' +
              U().badge(status) + '</div>';
          }).join('') + '</div>' : '<p class="muted">暂无授权记录</p>') +
        '</div>' +
        ((member.audit || []).length ? '<div class="detail-section"><h4>操作记录</h4><div class="timeline">' +
          member.audit.slice().reverse().map(function (a) {
            return '<div class="timeline-item"><b>' + U().esc(a.action) + ' · ' + U().esc(a.actor) + '</b><span>' + U().esc(a.time) + '</span></div>';
          }).join('') + '</div></div>' : ''),
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button><span class="spacer"></span>' +
        (canEditGroup() ? '<button class="btn btn-soft" data-edit type="button">' + U().icon('edit') + '编辑资料</button>' : ''),
      onMount: function (close, root) {
        root.querySelector('[data-close]').addEventListener('click', close);
        const edit = root.querySelector('[data-edit]');
        if (edit) edit.addEventListener('click', function () {
          close();
          GROUP.editMember(member.uid);
        });
      }
    });
  };

  P.groups = {
    render: function () {
      const st = S();
      st.ui = st.ui || {};
      const filter = st.ui.groupFilter || '';
      const staff = st.staff.filter(function (p) { return !filter || p.group === filter; });
      const groupOrder = {};
      st.groups.forEach(function (g, i) { groupOrder[g.id] = i; });
      function memberRank(p) {
        const g = ITO.getGroup(p.group);
        if (g && g.manager === p.name) return 0;
        if (g && g.leader === p.name) return 1;
        return 2;
      }
      staff.sort(function (a, b) {
        return (groupOrder[a.group] - groupOrder[b.group]) ||
          (memberRank(a) - memberRank(b)) ||
          String(a.joined || '').localeCompare(String(b.joined || '')) ||
          a.name.localeCompare(b.name, 'zh');
      });

      const cards = st.groups.map(function (g) {
        const members = st.staff.filter(function (p) { return p.group === g.id; }).length;
        const pct = Math.round(members / (g.fullStrength || members) * 100);
        return '<div class="group-card' + (filter === g.id ? ' active' : '') + '" data-group="' + g.id + '" role="button" tabindex="0" style="--gcolor:' + g.color + '">' +
          '<div class="group-card-top"><span class="group-code">' + g.code + '</span>' +
            '<div><h3>' + g.name + '</h3></div></div>' +
          '<div class="group-lead-row"><span>主管 <b>' + g.manager + '</b></span><span>组长 <b>' + (g.leader || '—') + '</b></span></div>' +
          '<div class="group-desc">' + g.desc + '</div>' +
          '<div class="group-stats group-stats-2">' +
            '<div><b>' + members + ' / ' + (g.fullStrength || members) + '</b><span>目前 / 满配</span></div>' +
            '<div><b>' + pct + '%</b><span>满编率</span></div>' +
          '</div>' +
          '<div class="group-meter"><i style="width:' + pct + '%"></i></div>' +
        '</div>';
      }).join('');

      const rows = staff.map(function (p) {
        const g = ITO.getGroup(p.group);
        const role = g && g.manager === p.name ? '主管' : (g && g.leader === p.name ? '组长' : '成员');
        const roleCls = role === '主管' ? 'manager' : role === '组长' ? 'leader' : 'member';
        return '<tr data-member="' + p.uid + '" style="cursor:pointer">' +
          '<td><div class="person-cell"><div><b>' + U().esc(p.name) + '</b><small>' + p.uid + '</small></div></div></td>' +
          '<td>' + U().groupPill(p.group) + '</td>' +
          '<td><span class="role-chip ' + roleCls + '">' + role + '</span></td>' +
          '<td>' + p.tags.map(function (t) { return '<span class="tag-inline">' + U().esc(t) + '</span>'; }).join('') + '</td>' +
          '<td class="num">' + p.joined + '</td>' +
        '</tr>';
      }).join('');

      const activeGroup = filter ? ITO.getGroup(filter) : null;
      const totalFull = st.groups.reduce(function (n, g) { return n + (g.fullStrength || 0); }, 0);
      const scopeNow = activeGroup ? staff.length : st.staff.length;
      const scopeFull = activeGroup ? (activeGroup.fullStrength || scopeNow) : totalFull;
      const scopePct = scopeFull ? Math.round(scopeNow / scopeFull * 100) : 0;
      const scopeBar = Math.min(100, scopePct);

      return U().pageHead({
        title: '组织架构',
        sub: '4 个专业组 · 满配 ' + st.groups.reduce(function (n, g) { return n + (g.fullStrength || 0); }, 0) + ' / 目前 ' + st.staff.length + ' 人',
        actions:
          (filter ? '<button class="btn btn-ghost" id="clearGroupBtn" type="button">' + U().icon('close') + '取消筛选</button>' : '') +
          (canEditGroup() ? '<button class="btn btn-primary" id="addMemberBtn" type="button">' + U().icon('plus') + '新增成员</button>' : '')
      }) +
      '<div class="group-grid">' + cards + '</div>' +

      '<div class="groups-layout">' +
        '<section class="card chart-card">' +
          '<div class="chart-head"><div><h3 class="chart-title">' + (activeGroup ? activeGroup.name + '人员变动' : '人员变动情况') + '</h3><p class="chart-sub">近 6 个月' + (activeGroup ? activeGroup.name : '各组') + '人数变化</p></div>' +
            '<span class="head-tag">HEADCOUNT</span></div>' +
          '<div class="chart-body" id="groupLoadChart"></div>' +
          '<div class="group-chart-foot">' +
            '<span>当前 <b>' + scopeNow + '</b> / 满配 <b>' + scopeFull + '</b></span>' +
            '<div class="group-chart-bar"><i style="width:' + scopeBar + '%;background:' + (activeGroup ? activeGroup.color : 'linear-gradient(90deg, var(--brand), #F59A6B)') + '"></i></div>' +
            '<b class="pct" style="color:' + (activeGroup ? activeGroup.color : 'var(--brand)') + '">' + scopePct + '%</b>' +
          '</div>' +
        '</section>' +
        '<section class="card staff-panel">' +
          '<div class="staff-head"><div class="staff-head-left"><h3>成员名录</h3><span class="count">' + staff.length + ' 人</span></div>' +
            '<span class="table-note">' + (activeGroup ? activeGroup.name : '全部专业组') + '</span></div>' +
          '<div class="table-wrap"><table class="data-table"><thead><tr><th>成员</th><th>专业组</th><th>角色</th><th>标签</th><th>入组</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>' +
        '</section>' +
      '</div>';
    },

    after: function () {
      const st = S();
      const filter = st.ui.groupFilter || '';

      const hist = D.groupHistory || { months: [], app: [], comm: [], online: [], infra: [] };
      // 当前月点位实时联动：成员数量变化后，折线末点跟随 st.staff 在册数（过去 5 个月保持快照）
      const currentMonthKey = D.meta.today.slice(0, 7);
      const isCurrentMonth = hist.months.length > 0 && hist.months[hist.months.length - 1] === currentMonthKey;
      const liveCount = {};
      st.groups.forEach(function (g) {
        liveCount[g.id] = st.staff.filter(function (p) { return p.group === g.id; }).length;
      });
      const seriesData = function (gid) {
        const base = (hist[gid] || []).slice();
        if (isCurrentMonth && base.length) base[base.length - 1] = liveCount[gid];
        return base;
      };
      const histValues = st.groups.reduce(function (list, g) { return list.concat(seriesData(g.id)); }, []);
      const histMax = Math.max(3, Math.max.apply(null, histValues.concat([0])));
      const seriesGroups = filter ? st.groups.filter(function (g) { return g.id === filter; }) : st.groups;
      U().chart('groupLoadChart', {
        tooltip: {
          trigger: 'axis', backgroundColor: 'rgba(29,29,31,.92)',
          borderWidth: 0, padding: [9, 12], textStyle: { color: '#fff', fontSize: 12 },
          formatter: function (params) {
            const list = Array.isArray(params) ? params : [params];
            if (!list.length) return '';
            return '<b>' + list[0].axisValue + '</b><br/>' + list.map(function (p) {
              return p.marker + p.seriesName + '：' + p.value + ' 人';
            }).join('<br/>');
          }
        },
        legend: { show: true, right: 4, top: 0, itemWidth: 12, itemHeight: 8, itemGap: 14, textStyle: { color: '#6E6E73', fontSize: 10 } },
        grid: { left: 8, right: 16, top: 34, bottom: 6, containLabel: true },
        xAxis: {
          type: 'category', boundaryGap: false, data: hist.months.map(function (m) { return Number(m.slice(5)) + ' 月'; }),
          axisLine: { lineStyle: { color: 'rgba(29,29,31,.12)' } }, axisTick: { show: false },
          axisLabel: { color: '#8A8A8E', fontSize: 10 }
        },
        yAxis: {
          type: 'value', min: 0, max: histMax, interval: histMax > 6 ? 2 : 1,
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: '#8A8A8E', fontSize: 10, formatter: '{value} 人' },
          splitLine: { lineStyle: { color: 'rgba(29,29,31,.06)', type: 'dashed' } }
        },
        series: seriesGroups.map(function (g) {
          return {
            name: g.name, type: 'line', smooth: 0.35, symbol: 'circle', symbolSize: 6,
            data: seriesData(g.id),
            lineStyle: { width: 2, color: g.color },
            itemStyle: { color: g.color, borderColor: '#fff', borderWidth: 1 },
            emphasis: { focus: 'series' }
          };
        })
      });

      U().$$('.group-card').forEach(function (card) {
        function select() {
          st.ui.groupFilter = st.ui.groupFilter === card.dataset.group ? '' : card.dataset.group;
          ITO.refresh();
        }
        card.addEventListener('click', select);
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
        });
      });

      U().$$('.staff-panel tbody tr[data-member]').forEach(function (tr) {
        tr.addEventListener('click', function () { GROUP.profile(tr.dataset.member); });
      });

      const add = document.getElementById('addMemberBtn');
      if (add) add.addEventListener('click', function () { GROUP.editMember(null); });

      const clear = document.getElementById('clearGroupBtn');
      if (clear) clear.addEventListener('click', function () {
        st.ui.groupFilter = '';
        ITO.refresh();
      });
    }
  };

  /* ── duty · 四类值班视图 ─────────────────── */
  function dutyWeekStart() {
    const d = new Date(String(D.meta.today).replace(/-/g, '/'));
    const dow = (d.getDay() + 6) % 7;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
  }

  function dutyWeekMeta() {
    const start = dutyWeekStart();
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      days.push({
        date: String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0'),
        week: ['一', '二', '三', '四', '五', '六', '日'][i],
        index: i
      });
    }
    return { start: start, days: days, dow: (new Date(String(D.meta.today).replace(/-/g, '/')).getDay() + 6) % 7 };
  }

  function dutyEditDay(typeId, index) {
    const st = S();
    const type = (st.dutyTypes || []).find(function (t) { return t.id === typeId; });
    if (!type) return;
    const meta = dutyWeekMeta();
    U().modal({
      title: '调整值班',
      sub: type.name + ' · ' + meta.days[index].date + ' 周' + meta.days[index].week,
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '通信助理', required: true, control: '<input id="duAssistant" type="text" value="' + U().esc(type.assistant) + '">' }) +
          U().formRow({ label: '值班手机', required: true, control: '<input id="duPhone" type="text" value="' + U().esc(type.phone) + '">' }) +
          U().formRow({ label: '状态', full: true, control: '<select id="duStatus">' + U().statusOptions(['正常', '异常'], type.statuses[index]) + '</select>' }) +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-save type="button">保存</button>',
      onMount: function (close, root) {
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-save]').addEventListener('click', function () {
          const assistant = root.querySelector('#duAssistant').value.trim();
          const phone = root.querySelector('#duPhone').value.trim();
          if (!assistant || !phone) { U().toast('请填写通信助理与值班手机', 'warn'); return; }
          type.assistant = assistant;
          type.phone = phone;
          type.statuses[index] = root.querySelector('#duStatus').value;
          ITO.log('调整值班', type.name + ' · ' + meta.days[index].date + ' · ' + assistant, '值班');
          U().toast('值班信息已更新');
          close();
          ITO.refresh();
        });
      }
    });
  }

  P.duty = {
    render: function () {
      const st = S();
      st.ui = st.ui || {};
      const types = (st.dutyTypes && st.dutyTypes.length) ? st.dutyTypes : (D.dutyTypes || []);
      const activeId = st.ui.dutyType || (types[0] && types[0].id);
      const type = types.find(function (t) { return t.id === activeId; }) || types[0];
      if (!type) return U().pageHead({ title: '值班管理', sub: '暂无值班配置' });
      const meta = dutyWeekMeta();
      const todayStatus = type.statuses[meta.dow] || '正常';
      const elapsed = meta.dow + 1;
      const percent = Math.round(elapsed / 7 * 100);
      const canEdit = ITO.roleIs('manager', 'leader', 'admin');
      const statusTone = function (s) { return s === '正常' ? 'green' : 'red'; };

      const tabs = types.map(function (t) {
        return '<button class="tab' + (t.id === activeId ? ' active' : '') + '" data-duty-type="' + t.id + '" type="button">' + U().esc(t.name) + '</button>';
      }).join('');

      const segments = meta.days.map(function (d) {
        const done = d.index < meta.dow;
        const today = d.index === meta.dow;
        const bad = (type.statuses[d.index] || '正常') === '异常';
        return '<div class="duty-seg' + (done ? ' done' : '') + (today ? ' today' : '') + (bad ? ' bad' : '') + '">' +
          '<b>' + d.date + '</b><span>周' + d.week + '</span><i></i></div>';
      }).join('');

      const rows = meta.days.map(function (d) {
        const s = type.statuses[d.index] || '正常';
        return '<tr class="' + (d.index === meta.dow ? 'is-today' : '') + '">' +
          '<td class="mono">' + d.date + '</td>' +
          '<td>周' + d.week + '</td>' +
          '<td><b>' + U().esc(type.assistant) + '</b></td>' +
          '<td class="mono">' + U().esc(type.phone) + '</td>' +
          '<td>' + U().badge(s, statusTone(s)) + '</td>' +
          '<td><div class="row-actions">' + (canEdit ? '<button class="btn btn-ghost btn-sm" data-duty-edit="' + type.id + ':' + d.index + '" type="button">调整</button>' : '') + '</div></td>' +
        '</tr>';
      }).join('');

      return U().pageHead({
        title: '值班管理',
        sub: '四类值班 · 每周一 08:00 交接 · ' + type.name,
        actions: '<button class="btn btn-ghost" id="dutyExportBtn" type="button">' + U().icon('download') + '导出排班</button>'
      }) +
      '<div class="tabs duty-type-tabs">' + tabs + '</div>' +
      '<div class="duty-overview">' +
        '<article class="card duty-assist-card">' +
          '<span class="duty-card-label">通信助理</span>' +
          '<div class="duty-card-main"><b>' + U().esc(type.assistant) + '</b><em>' + U().esc(type.phone) + '</em></div>' +
          '<span class="badge ' + statusTone(todayStatus) + '">' + U().esc(todayStatus) + '</span>' +
        '</article>' +
        '<article class="card duty-week-card">' +
          '<div class="duty-week-head"><span class="duty-card-label">本周值班时间</span><b>' + meta.days[0].date + ' – ' + meta.days[6].date + '</b></div>' +
          '<div class="duty-week-progress">' + segments + '</div>' +
          '<div class="duty-progress-meta"><span>已值守 <b>' + elapsed + ' / 7</b> 天</span><b>' + percent + '%</b></div>' +
        '</article>' +
      '</div>' +
      '<section class="card table-card duty-day-card">' +
        '<div class="table-head"><div><h3>' + U().esc(type.name) + ' · 本周排班</h3><p class="table-note">通信助理与值班手机按周配置，状态按日记录</p></div><span class="table-note">7 天</span></div>' +
        '<div class="table-wrap"><table class="data-table duty-day-table"><thead><tr><th>日期</th><th>星期</th><th>通信助理</th><th>值班手机</th><th>状态</th><th style="text-align:right">操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '</section>' +
      '<div class="duty-notes">' +
        '<div class="card duty-note"><b>交接</b><span>每周一 08:00 完成交接，异常状态需在 15 分钟内上报专业组主管。</span></div>' +
        '<div class="card duty-note"><b>口径</b><span>状态为运行情况，正常 / 异常；值班手机与通信助理按值班类型配置。</span></div>' +
      '</div>';
    },

    after: function () {
      const st = S();
      U().$$('[data-duty-type]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          st.ui.dutyType = btn.dataset.dutyType;
          ITO.refresh();
        });
      });

      U().$$('[data-duty-edit]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const parts = btn.dataset.dutyEdit.split(':');
          dutyEditDay(parts[0], Number(parts[1]));
        });
      });

      const exp = document.getElementById('dutyExportBtn');
      if (exp) exp.addEventListener('click', function () {
        const w = st.duty.weeks.find(function (x) { return x.key === st.duty.currentKey; });
        if (!w) return;
        const roster = w.dutyRoster || D.dutyRoster || [];
        previewDutyExport(w, roster);
        ITO.log('导出值班表', '第 ' + w.weekNo + ' 周 · ' + roster.length + ' 行', '值班');
      });
    }
  };

  /* ── duty · 周表 + 在线值班表 ─────────────── */
  function cnDate(iso) {
    const p = String(iso || '').split('-');
    return p.length === 3 ? (p[0] + '年' + Number(p[1]) + '月' + Number(p[2]) + '日') : iso;
  }

  function dutySheetRowsHtml(rows, editable) {
    return rows.map(function (r, i) {
      const cell = function (field, cls) {
        if (!editable) return '<td class="' + (cls || '') + '">' + U().esc(r[field] || '') + '</td>';
        return '<td class="' + (cls || '') + '"><input data-dr="' + i + '" data-df="' + field + '" value="' + U().esc(r[field] || '') + '"></td>';
      };
      return '<tr><td class="duty-post">' + U().esc(r.post || '') + '</td>' +
        cell('code', 'mono') + cell('name') + cell('phone', 'mono') + '</tr>';
    }).join('');
  }

  function dutySheetSubtitle(w) {
    return '【值班】' + w.start.slice(0, 4) + ' 年第 ' + w.weekNo + ' 周（' + cnDate(w.start) + '-' + cnDate(w.end) + '）值班表';
  }

  function dutyCustomHeaders(template) {
    return template || !ITO.customFieldExportHeaders ? [] : ITO.customFieldExportHeaders('duty');
  }

  function dutyCustomValues(w, template) {
    return template || !ITO.customFieldExport ? [] : ITO.customFieldExport('duty', w);
  }

  function buildDutyAoa(w, roster, template) {
    const customHeaders = dutyCustomHeaders(template);
    const customValues = dutyCustomValues(w, template);
    const width = 4 + customHeaders.length;
    const aoa = [
      ['ITO 运维中心 值班表' + (template ? '（模板）' : '')].concat(new Array(width - 1).fill('')),
      [template ? '请填写姓名与值班手机；外部人员代码留空' : dutySheetSubtitle(w)].concat(new Array(width - 1).fill('')),
      ['岗位', '代码', '姓名', '值班手机'].concat(customHeaders)
    ];
    roster.forEach(function (r, i) {
      aoa.push([r.post || '', r.code || '', r.name || '', r.phone || ''].concat(i === 0 ? customValues : customHeaders.map(function () { return ''; })));
    });
    return aoa;
  }

  function downloadDutyXlsx(w, roster, template) {
    const aoa = buildDutyAoa(w, roster, template);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const width = 4 + dutyCustomHeaders(template).length;
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: width - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: width - 1 } }
    ];
    ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 20 }].concat(new Array(width - 4).fill({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '第' + w.weekNo + '周');
    XLSX.writeFile(wb, (template ? 'ITO值班表模板-' : 'ITO值班表-') + w.weekNo + '周.xlsx');
  }

  function previewDutyExport(w, roster) {
    const customHeaders = dutyCustomHeaders(false);
    const customValues = dutyCustomValues(w, false);
    const rows = [['岗位', '代码', '姓名', '值班手机'].concat(customHeaders)].concat(roster.map(function (r, i) {
      return [r.post || '', r.code || '', r.name || '', r.phone || ''].concat(i === 0 ? customValues : customHeaders.map(function () { return ''; }));
    }));
    U().exportPreview({
      title: '值班表导出预览',
      sub: '第 ' + w.weekNo + ' 周 · ' + roster.length + ' 行 · 导出文件含大标题与周次',
      rows: rows,
      filename: 'ITO值班表-' + w.weekNo + '周.xlsx',
      onDownload: function () { downloadDutyXlsx(w, roster, false); }
    });
  }

  function parseDutyAoa(aoa) {
    const hi = aoa.findIndex(function (row) {
      return (row || []).some(function (cell) { return String(cell || '').trim() === '岗位'; });
    });
    const header = hi >= 0 ? aoa[hi] : ['岗位', '代码', '姓名', '值班手机'];
    const indexOf = function (label, fallback) {
      const idx = header.findIndex(function (cell) { return String(cell || '').trim() === label; });
      return idx >= 0 ? idx : fallback;
    };
    const pi = indexOf('岗位', 0);
    const ci = indexOf('代码', 1);
    const ni = indexOf('姓名', 2);
    const mi = indexOf('值班手机', 3);
    return aoa.slice(hi + 1).filter(function (row) {
      return row && (row[pi] || row[ni]);
    }).map(function (row) {
      const post = String(row[pi] || '').trim();
      return {
        post: post,
        code: String(row[ci] || '').trim(),
        name: String(row[ni] || '').trim(),
        phone: String(row[mi] || '').trim(),
        external: post.indexOf('工程公司') > -1
      };
    });
  }

  function openDutySheetOld(weekKey) {
    const st = S();
    const w = st.duty.weeks.find(function (x) { return x.key === weekKey; });
    if (!w) return;
    const canEdit = ITO.roleIs('manager', 'leader', 'admin');
    let roster = (w.dutyRoster || D.dutyRoster || []).map(function (r) { return Object.assign({}, r); });
    let status = w.dutyStatus || '正常';

    U().modal({
      title: '值班表',
      sub: '第 ' + w.weekNo + ' 周 · ' + w.start + ' 至 ' + w.end,
      wide: true,
      body:
        '<div class="duty-sheet">' +
          '<div class="duty-sheet-title"><b>ITO 运维中心</b><span>【值班】' + w.start.slice(0, 4) + ' 年第 ' + w.weekNo + ' 周（' + cnDate(w.start) + '-' + cnDate(w.end) + '）值班表</span></div>' +
          '<div class="duty-sheet-tools">' +
            '<button class="btn btn-ghost btn-sm" id="dutyTemplateBtn" type="button">下载模板</button>' +
            (canEdit ? '<label class="btn btn-ghost btn-sm">导入表格<input id="dutyImport" type="file" accept=".csv,.xlsx,.xls" hidden></label>' : '') +
            '<button class="btn btn-ghost btn-sm" id="dutySheetExport" type="button">导出当前表</button>' +
            '<label class="duty-sheet-status">状态<select id="dutySheetStatus"' + (canEdit ? '' : ' disabled') + '>' +
              '<option value="正常"' + (status === '正常' ? ' selected' : '') + '>正常</option>' +
              '<option value="异常"' + (status === '异常' ? ' selected' : '') + '>异常</option>' +
            '</select></label>' +
          '</div>' +
          '<div class="table-wrap"><table class="duty-sheet-table"><thead><tr><th>岗位</th><th>代码</th><th>姓名</th><th>值班手机</th></tr></thead>' +
          '<tbody id="dutySheetBody">' + dutySheetRowsHtml(roster, canEdit) + '</tbody></table></div>' +
          '<div class="duty-import-preview" id="dutyImportPreview" hidden>' +
            '<div class="duty-import-head"><b>导入预览</b><span id="dutyImportCount"></span></div>' +
            '<div class="table-wrap"><table class="duty-sheet-table"><thead><tr><th>岗位</th><th>代码</th><th>姓名</th><th>值班手机</th></tr></thead><tbody id="dutyImportBody"></tbody></table></div>' +
            '<div class="duty-import-actions"><button class="btn btn-ghost btn-sm" data-import-cancel type="button">取消预览</button><button class="btn btn-primary btn-sm" data-import-apply type="button">确认导入</button></div>' +
          '</div>' +
          '<div class="duty-import-preview" id="dutyExportPreview" hidden>' +
            '<div class="duty-import-head"><b>导出预览</b><span>导出文件包含大标题与周次</span></div>' +
            '<div class="table-wrap"><table class="duty-sheet-table"><thead><tr><th>岗位</th><th>代码</th><th>姓名</th><th>值班手机</th></tr></thead><tbody id="dutyExportBody"></tbody></table></div>' +
            '<div class="duty-import-actions"><button class="btn btn-ghost btn-sm" data-export-cancel type="button">取消</button><button class="btn btn-primary btn-sm" data-export-download type="button">下载 XLSX</button></div>' +
          '</div>' +
        '</div>',
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button><span class="spacer"></span>' +
        (canEdit ? '<button class="btn btn-primary" data-save type="button">保存值班表</button>' : ''),
      onMount: function (close, root) {
        const body = root.querySelector('#dutySheetBody');
        const importInput = root.querySelector('#dutyImport');
        const statusSel = root.querySelector('#dutySheetStatus');

        function readRoster() {
          if (!canEdit) return roster;
          const next = roster.map(function (r, i) {
            const tr = body.querySelectorAll('tr')[i];
            if (!tr) return r;
            const get = function (f) {
              const input = tr.querySelector('[data-df="' + f + '"]');
              return input ? input.value.trim() : r[f];
            };
            return { post: r.post, code: get('code'), name: get('name'), phone: get('phone') };
          });
          roster = next;
          return next;
        }

        const previewBox = root.querySelector('#dutyImportPreview');
        const previewBody = root.querySelector('#dutyImportBody');
        const previewCount = root.querySelector('#dutyImportCount');
        const exportBox = root.querySelector('#dutyExportPreview');
        const exportBody = root.querySelector('#dutyExportBody');
        let pendingRoster = null;

        function exportSheet() {
          const current = readRoster();
          exportBody.innerHTML = dutySheetRowsHtml(current, false);
          exportBox.hidden = false;
        }

        function downloadTemplate() {
          const template = (D.dutyRoster || []).map(function (r) {
            return { post: r.post, code: r.code || '', name: '', phone: '', external: !!r.external };
          });
          downloadDutyXlsx(w, template, true);
          ITO.log('下载值班表模板', '第 ' + w.weekNo + ' 周', '值班');
          U().toast('值班表模板已下载');
        }

        function renderPreview(parsed) {
          pendingRoster = parsed;
          previewBody.innerHTML = dutySheetRowsHtml(parsed, false);
          previewCount.textContent = '识别到 ' + parsed.length + ' 行 · 确认后应用到值班表';
          previewBox.hidden = false;
        }

        root.querySelector('[data-close]').addEventListener('click', close);
        root.querySelector('#dutySheetExport').addEventListener('click', exportSheet);
        root.querySelector('#dutyTemplateBtn').addEventListener('click', downloadTemplate);

        const exportCancel = root.querySelector('[data-export-cancel]');
        if (exportCancel) exportCancel.addEventListener('click', function () { exportBox.hidden = true; });
        const exportDownload = root.querySelector('[data-export-download]');
        if (exportDownload) exportDownload.addEventListener('click', function () {
          readRoster();
          downloadDutyXlsx(w, roster, false);
          exportBox.hidden = true;
          ITO.log('导出值班表', '第 ' + w.weekNo + ' 周 · ' + roster.length + ' 行', '值班');
          U().toast('值班表已开始下载');
        });

        if (importInput) {
          importInput.addEventListener('change', function () {
            const file = importInput.files && importInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function () {
              try {
                const wb = XLSX.read(new Uint8Array(reader.result), { type: 'array', codepage: 65001 });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
                const parsed = parseDutyAoa(aoa);
                if (!parsed.length) { U().toast('未识别到值班表数据', 'warn'); return; }
                renderPreview(parsed);
                U().toast('已解析 ' + parsed.length + ' 行，请先预览');
              } catch (err) {
                U().toast('表格解析失败，请使用 CSV 或 XLSX', 'warn');
              }
            };
            reader.readAsArrayBuffer(file);
          });
        }

        const importCancel = root.querySelector('[data-import-cancel]');
        if (importCancel) importCancel.addEventListener('click', function () {
          pendingRoster = null;
          previewBox.hidden = true;
          if (importInput) importInput.value = '';
        });

        const importApply = root.querySelector('[data-import-apply]');
        if (importApply) importApply.addEventListener('click', function () {
          if (!pendingRoster || !pendingRoster.length) return;
          roster = pendingRoster.map(function (r) { return Object.assign({}, r); });
          body.innerHTML = dutySheetRowsHtml(roster, canEdit);
          previewBox.hidden = true;
          pendingRoster = null;
          if (importInput) importInput.value = '';
          U().toast('已导入 ' + roster.length + ' 行，请确认后保存');
        });

        const save = root.querySelector('[data-save]');
        if (save) save.addEventListener('click', function () {
          readRoster();
          w.dutyRoster = roster;
          w.dutyStatus = statusSel.value;
          ITO.log('保存值班表', '第 ' + w.weekNo + ' 周 · ' + roster.length + ' 行', '值班');
          U().toast('值班表已保存');
          close();
          ITO.refresh();
        });
      }
    });
  }

  function openDutySheet(weekKey) {
    const st = S();
    const w = st.duty.weeks.find(function (x) { return x.key === weekKey; });
    if (!w) return;
    const canEdit = ITO.roleIs('manager', 'leader', 'admin');
    let roster = (w.dutyRoster || D.dutyRoster || []).map(function (r) { return Object.assign({}, r); });
    let status = w.dutyStatus || '正常';
    let detailBody = null;
    let detailSub = null;
    let changed = false;

    function openEdit(initialRows) {
      const draft = (initialRows || roster).map(function (r) { return Object.assign({}, r); });
      U().modal({
        title: '编辑值班表',
        sub: '第 ' + w.weekNo + ' 周 · ' + w.start + ' 至 ' + w.end,
        inset: true,
        body:
          '<div class="duty-sheet-tools">' +
            '<label class="duty-sheet-status">状态<select id="dutyEditStatus">' +
              '<option value="正常"' + (status === '正常' ? ' selected' : '') + '>正常</option>' +
              '<option value="异常"' + (status === '异常' ? ' selected' : '') + '>异常</option>' +
            '</select></label>' +
          '</div>' +
          (ITO.customFieldForm ? ITO.customFieldForm('duty', w) : '') +
          '<div class="table-wrap"><table class="duty-sheet-table"><thead><tr><th>岗位</th><th>代码</th><th>姓名</th><th>值班手机</th></tr></thead>' +
          '<tbody id="dutyEditBody">' + dutySheetRowsHtml(draft, true) + '</tbody></table></div>',
        foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button>' +
          '<span class="spacer"></span><button class="btn btn-primary" data-save type="button">保存值班表</button>',
        onMount: function (closeEdit, root) {
          const body = root.querySelector('#dutyEditBody');
          const statusSel = root.querySelector('#dutyEditStatus');
          root.querySelector('[data-cancel]').addEventListener('click', closeEdit);
          root.querySelector('[data-save]').addEventListener('click', function () {
            let invalid = false;
            const next = draft.map(function (r, i) {
              const tr = body.querySelectorAll('tr')[i];
              const get = function (f) {
                const input = tr.querySelector('[data-df="' + f + '"]');
                if (!input) return r[f] || '';
                if ((f === 'name' || f === 'phone') && !input.value.trim()) {
                  input.style.borderColor = '#C5372C';
                  invalid = true;
                } else {
                  input.style.borderColor = '';
                }
                return input.value.trim();
              };
              return { post: r.post, code: get('code'), name: get('name'), phone: get('phone'), external: !!r.external };
            });
            if (invalid) {
              U().toast('请填写所有姓名与值班手机', 'warn');
              return;
            }
            const cf = ITO.readCustomFields ? ITO.readCustomFields(root, 'duty', w.extra) : { values: {}, errors: [] };
            if (cf.errors.length) { U().toast(cf.errors[0], 'warn'); return; }
            roster = next;
            status = statusSel.value;
            changed = true;
            w.dutyRoster = roster;
            w.dutyStatus = status;
            w.extra = cf.values;
            const customDetail = document.getElementById('dutyCustomDetail');
            if (customDetail) {
              customDetail.innerHTML = '<h4>扩展信息</h4><div class="table-wrap"><table class="data-table"><tbody>' + ITO.customFieldRows('duty', w) + '</tbody></table></div>';
            }
            ITO.log('保存值班表', '第 ' + w.weekNo + ' 周 · ' + roster.length + ' 行', '值班');
            if (detailBody) detailBody.innerHTML = dutySheetRowsHtml(roster, false);
            if (detailSub) detailSub.textContent = '第 ' + w.weekNo + ' 周 · ' + w.start + ' 至 ' + w.end + ' · ' + status;
            U().toast('值班表已保存');
            closeEdit();
          });
        }
      });
    }

    function openImportPreview(parsed) {
      U().modal({
        title: '导入预览',
        sub: '识别到 ' + parsed.length + ' 行 · 确认后进入编辑，再保存',
        wide: true,
        body: '<div class="table-wrap"><table class="duty-sheet-table"><thead><tr><th>岗位</th><th>代码</th><th>姓名</th><th>值班手机</th></tr></thead>' +
          '<tbody>' + dutySheetRowsHtml(parsed, false) + '</tbody></table></div>' +
          '<p class="table-note" style="margin-top:10px">确认导入后将打开编辑层，可继续修改并保存。</p>',
        foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button>' +
          '<span class="spacer"></span><button class="btn btn-primary" data-apply type="button">确认导入</button>',
        onMount: function (closePreview, root) {
          root.querySelector('[data-cancel]').addEventListener('click', closePreview);
          root.querySelector('[data-apply]').addEventListener('click', function () {
            closePreview();
            openEdit(parsed);
          });
        }
      });
    }

    U().modal({
      title: '值班表',
      sub: '第 ' + w.weekNo + ' 周 · ' + w.start + ' 至 ' + w.end + ' · ' + status,
      wide: true,
      body:
        '<div class="duty-sheet">' +
          '<div class="duty-sheet-title"><b>ITO 运维中心</b><span>' + dutySheetSubtitle(w) + '</span></div>' +
          '<div class="duty-sheet-tools">' +
            '<button class="btn btn-ghost btn-sm" id="dutyTemplateBtn" type="button">下载模板</button>' +
            (canEdit ? '<label class="btn btn-ghost btn-sm">导入表格<input id="dutyImport" type="file" accept=".csv,.xlsx,.xls" hidden></label>' : '') +
            '<button class="btn btn-ghost btn-sm" id="dutySheetExport" type="button">导出</button>' +
            (canEdit ? '<button class="btn btn-primary btn-sm" id="dutySheetEdit" type="button">编辑</button>' : '') +
          '</div>' +
          '<div class="table-wrap"><table class="duty-sheet-table"><thead><tr><th>岗位</th><th>代码</th><th>姓名</th><th>值班手机</th></tr></thead>' +
          '<tbody id="dutyDetailBody">' + dutySheetRowsHtml(roster, false) + '</tbody></table></div>' +
          (ITO.fieldDefsFor && ITO.fieldDefsFor('duty').length
            ? '<div class="detail-section" id="dutyCustomDetail"><h4>扩展信息</h4><div class="table-wrap"><table class="data-table"><tbody>' + ITO.customFieldRows('duty', w) + '</tbody></table></div></div>'
            : '') +
        '</div>',
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
      onClose: function () { if (changed) ITO.refresh(); },
      onMount: function (closeDetail, root) {
        detailBody = root.querySelector('#dutyDetailBody');
        detailSub = root.querySelector('.modal-head p');
        root.querySelector('[data-close]').addEventListener('click', closeDetail);
        root.querySelector('#dutyTemplateBtn').addEventListener('click', function () {
          const template = (D.dutyRoster || []).map(function (r) {
            return { post: r.post, code: r.code || '', name: '', phone: '', external: !!r.external };
          });
          downloadDutyXlsx(w, template, true);
          ITO.log('下载值班表模板', '第 ' + w.weekNo + ' 周', '值班');
          U().toast('值班表模板已下载');
        });
        const exportBtn = root.querySelector('#dutySheetExport');
        if (exportBtn) exportBtn.addEventListener('click', function () {
          previewDutyExport(w, roster);
          ITO.log('导出值班表', '第 ' + w.weekNo + ' 周 · ' + roster.length + ' 行', '值班');
        });
        const editBtn = root.querySelector('#dutySheetEdit');
        if (editBtn) editBtn.addEventListener('click', function () { openEdit(roster); });
        const importInput = root.querySelector('#dutyImport');
        if (importInput) {
          importInput.addEventListener('change', function () {
            const file = importInput.files && importInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function () {
              try {
                const wb = XLSX.read(new Uint8Array(reader.result), { type: 'array', codepage: 65001 });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
                const parsed = parseDutyAoa(aoa);
                if (!parsed.length) { U().toast('未识别到值班表数据', 'warn'); return; }
                openImportPreview(parsed);
              } catch (err) {
                U().toast('表格解析失败，请使用 CSV 或 XLSX', 'warn');
              }
            };
            reader.readAsArrayBuffer(file);
            importInput.value = '';
          });
        }
      }
    });
  }

  ITO.openDutySheet = openDutySheet;

  P.duty = {
    render: function () {
      const st = S();
      st.ui = st.ui || {};
      const weeks = st.duty.weeks;
      const ci = weeks.findIndex(function (w) { return w.key === st.duty.currentKey; });
      const list = weeks;
      const current = list[0];
      const base = D.dutyRoster || [];

      const rows = list.map(function (w) {
        const roster = w.dutyRoster || base;
        const head = roster[0] || { name: '—', phone: '—' };
        const status = w.dutyStatus || '正常';
        return '<tr data-duty-week="' + w.key + '"' + (w.key === st.duty.currentKey ? ' class="is-current"' : '') + ' style="cursor:pointer">' +
          '<td><b>第 ' + w.weekNo + ' 周</b>' + (w.key === st.duty.currentKey ? '<small class="table-note" style="display:block">本周</small>' : '') + '</td>' +
          '<td>' + w.start.slice(5).replace('-', '/') + ' – ' + w.end.slice(5).replace('-', '/') + '</td>' +
          '<td>' + U().esc(head.name) + '</td>' +
          '<td class="mono">' + U().esc(head.phone) + '</td>' +
          '<td>' + U().badge(status, status === '正常' ? 'green' : 'red') + '</td>' +
        '</tr>';
      }).join('');

      return U().pageHead({
        title: '值班管理',
        sub: current ? '第 ' + current.weekNo + ' 周 · ' + current.start + ' 至 ' + current.end + ' · 点击行查看值班表' : '暂无值班周',
        actions: '<button class="btn btn-ghost" id="dutyExportBtn" type="button">' + U().icon('download') + '导出本周排班</button>'
      }) +
      '<section class="card table-card">' +
        '<div class="table-head"><div><h3>周值班表</h3><p class="table-note">通信助理 = 专业组主管；点击任意一周查看完整值班表</p></div>' +
          '<span class="table-note">' + list.length + ' 周</span></div>' +
        '<div class="table-wrap"><table class="data-table duty-week-table"><thead><tr><th>周次</th><th>日期范围</th><th>通信助理</th><th>值班电话</th><th>状态</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '</section>' +
      '<div class="duty-notes">' +
        '<div class="card duty-note"><b>值班表</b><span>点击周次打开 Excel 式值班表，可查看通信助理、应急、线路、网络、桌面与技术助理。</span></div>' +
        '<div class="card duty-note"><b>模板与导入</b><span>可先下载 XLSX 模板；主管 / 领导 / 管理员导入后先预览，再应用到值班表并保存。</span></div>' +
      '</div>';
    },

    after: function () {
      const st = S();
      U().$$('[data-duty-week]').forEach(function (tr) {
        tr.addEventListener('click', function () { openDutySheet(tr.dataset.dutyWeek); });
      });
      const exp = document.getElementById('dutyExportBtn');
      if (exp) exp.addEventListener('click', function () {
        const w = st.duty.weeks.find(function (x) { return x.key === st.duty.currentKey; });
        if (!w) return;
        const roster = w.dutyRoster || D.dutyRoster || [];
        previewDutyExport(w, roster);
        ITO.log('导出值班表', '第 ' + w.weekNo + ' 周 · ' + roster.length + ' 行', '值班');
      });
    }
  };
})();
