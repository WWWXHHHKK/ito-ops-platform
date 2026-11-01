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

  /* ── duty ────────────────────────────────── */
  const DUTY = {};

  function managerNames() {
    const names = S().groups.map(function (g) { return g.manager; });
    return Array.from(new Set(names));
  }

  function peopleOptions(list, selected) {
    return list.map(function (n) {
      return '<option value="' + U().esc(n) + '"' + (n === selected ? ' selected' : '') + '>' + U().esc(n) + '</option>';
    }).join('');
  }

  DUTY.editDay = function (index) {
    const st = S();
    const day = st.duty.week[index];
    const staffNames = st.staff.map(function (p) { return p.name; });

    U().modal({
      title: '调整值班 · ' + day.date + ' ' + day.weekday,
      sub: '值班主管负责升级决策，白班与夜班执行一线值守',
      wide: true,
      body:
        '<div class="form-grid">' +
          U().formRow({ label: '值班主管', control: '<select id="duManager">' + peopleOptions(managerNames(), day.manager) + '</select>' }) +
          U().formRow({ label: '备班', control: '<select id="duBackup">' + peopleOptions(staffNames, day.backup) + '</select>' }) +
          U().formRow({ label: '白班 · 主班', control: '<select id="duDay1">' + peopleOptions(staffNames, day.day[0] || '') + '</select>' }) +
          U().formRow({ label: '白班 · 副班', control: '<select id="duDay2"><option value="">不安排</option>' + peopleOptions(staffNames, day.day[1] || '') + '</select>' }) +
          U().formRow({ label: '夜班', control: '<select id="duNight">' + peopleOptions(staffNames, day.night[0] || '') + '</select>' }) +
        '</div>' +
        '<div class="form-hint" style="margin-top:10px">白班 08:00–20:00，夜班 20:00–次日 08:00；交接超时 15 分钟将触发提醒。</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-save type="button">保存排班</button>',
      onMount: function (close, root) {
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-save]').addEventListener('click', function () {
          day.manager = root.querySelector('#duManager').value;
          day.backup = root.querySelector('#duBackup').value;
          const d1 = root.querySelector('#duDay1').value;
          const d2 = root.querySelector('#duDay2').value;
          day.day = d2 && d2 !== d1 ? [d1, d2] : [d1];
          day.night = [root.querySelector('#duNight').value];
          ITO.log('调整值班排班', day.date + ' ' + day.weekday, '值班');
          close();
          U().toast(day.date + ' 排班已更新');
          ITO.refresh();
        });
      }
    });
  };

  P.duty = {
    render: function () {
      const st = S();
      const week = st.duty.week;
      const today = week[st.duty.todayIndex];
      const shifts = week.reduce(function (n, d) { return n + 1 + d.day.length + d.night.length + 1; }, 0);

      const head = '<div class="duty-corner"><b>班次</b><span>SHIFT</span></div>' + week.map(function (d, i) {
        return '<div class="duty-day-head' + (i === st.duty.todayIndex ? ' today' : '') + '"><b>' + d.weekday + '</b><span>' + d.date + (i === st.duty.todayIndex ? ' · 今日' : '') + '</span></div>';
      }).join('');

      function row(label, sub, valueFn, slot) {
        return '<div class="duty-shift-label"><b>' + label + '</b><span>' + sub + '</span></div>' +
          week.map(function (d, i) {
            const people = valueFn(d);
            return '<div class="duty-cell' + (i === st.duty.todayIndex ? ' today' : '') + '" data-day="' + i + '" data-slot="' + slot + '" role="button" tabindex="0" title="点击调整排班">' +
              (people.length ? people.map(function (n) {
                return '<span class="duty-person"><i></i>' + U().esc(n) + '</span>';
              }).join('') : '<span class="empty">待安排</span>') +
            '</div>';
          }).join('');
      }

      return U().pageHead({
        title: '值班管理',
        sub: '7 × 24 值守排班 · 今日 ' + today.date + ' ' + today.weekday + ' · 点击任意班次可调整',
        actions:
          '<button class="btn btn-ghost" id="dutyExportBtn" type="button">' + U().icon('download') + '导出排班</button>' +
          '<button class="btn btn-primary" id="dutyEditBtn" type="button">' + U().icon('calendar') + '调整今日</button>'
      }) +
      summary([
        { icon: 'users', value: (1 + today.day.length + today.night.length + 1), label: '今日在岗' },
        { icon: 'calendar', value: shifts, label: '本周班次', tone: 'blue' },
        { icon: 'shield', value: new Set(week.map(function (d) { return d.manager; })).size, label: '值班主管', tone: 'green' },
        { icon: 'clock', value: '08:00', label: '下次交接', tone: '' }
      ]) +

      '<section class="card duty-board">' +
        '<div class="duty-board-head"><h3>本周排班表</h3><span>2026-10-26 至 2026-11-01 · 华东区 SHA-01</span></div>' +
        '<div class="table-wrap"><div class="duty-grid">' +
          head +
          row('值班主管', 'ON CALL', function (d) { return [d.manager]; }, 'manager') +
          row('白班', '08:00–20:00', function (d) { return d.day; }, 'day') +
          row('夜班', '20:00–08:00', function (d) { return d.night; }, 'night') +
          row('备班', 'BACKUP', function (d) { return [d.backup]; }, 'backup') +
        '</div></div>' +
      '</section>' +

      '<div class="duty-notes">' +
        '<div class="card duty-note"><b>交接要求</b><span>每日 08:00 / 20:00 完成口头与书面交接，未闭环事项必须标注责任人与下一步动作。</span></div>' +
        '<div class="card duty-note"><b>升级路径</b><span>一线 15 分钟未响应 → 值班主管；30 分钟未恢复 → 专业组主管；P1 事件直接升级至张总。</span></div>' +
        '<div class="card duty-note"><b>排班规则</b><span>夜班次日安排调休；连续夜班不超过 2 天；备班需保持 30 分钟内可达。</span></div>' +
      '</div>';
    },

    after: function () {
      const st = S();

      U().$$('.duty-cell').forEach(function (cell) {
        function edit() { DUTY.editDay(Number(cell.dataset.day)); }
        cell.addEventListener('click', edit);
        cell.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); edit(); }
        });
      });

      const editBtn = document.getElementById('dutyEditBtn');
      if (editBtn) editBtn.addEventListener('click', function () { DUTY.editDay(st.duty.todayIndex); });

      const exp = document.getElementById('dutyExportBtn');
      if (exp) exp.addEventListener('click', function () {
        const rows = [['日期', '星期', '值班主管', '白班', '夜班', '备班']];
        st.duty.week.forEach(function (d) {
          rows.push([d.date, d.weekday, d.manager, d.day.join(' / '), d.night.join(' / '), d.backup]);
        });
        U().download('ITO值班排班-2026-W44.csv', U().csv(rows));
        ITO.log('导出值班排班', '2026-W44', '值班');
        U().toast('值班排班已导出');
      });
    }
  };

  /* ── groups ──────────────────────────────── */
  const GROUP = {};

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
          U().formRow({ label: '姓名', required: true, control: '<input id="gmName" type="text" maxlength="10" value="' + U().esc(member ? member.name : '') + '" placeholder="例如：王工">' }) +
          U().formRow({ label: '岗位', control: '<select id="gmTitle">' + U().statusOptions(['高级工程师', '工程师', '助理工程师'], member ? member.title : '工程师') + '</select>' }) +
          U().formRow({ label: '专业组', control: '<select id="gmGroup">' + U().groupOptions(member ? member.group : 'app') + '</select>' }) +
          U().formRow({ label: '联系电话', control: '<input id="gmPhone" type="text" value="' + U().esc(member ? member.phone : '138****0000') + '">' }) +
          U().formRow({ label: '能力标签', full: true, control: '<input id="gmTags" type="text" value="' + U().esc(member ? member.tags.join('、') : '工程师') + '" placeholder="用、或逗号分隔，例如：核心岗、KCC">' }) +
          U().formRow({ label: '入组时间', control: '<input id="gmJoined" type="date" value="' + (member ? member.joined : '2026-11-01') + '">' }) +
        '</div>',
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-save type="button">' + (editing ? '保存修改' : '添加成员') + '</button>',
      onMount: function (close, root) {
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-save]').addEventListener('click', function () {
          const name = root.querySelector('#gmName').value.trim();
          if (!name) { U().toast('请填写成员姓名', 'warn'); return; }
          const tags = root.querySelector('#gmTags').value.split(/[、,，]/).map(function (x) { return x.trim(); }).filter(Boolean);
          if (editing) {
            member.name = name;
            member.title = root.querySelector('#gmTitle').value;
            member.group = root.querySelector('#gmGroup').value;
            member.phone = root.querySelector('#gmPhone').value.trim();
            member.tags = tags.length ? tags : ['工程师'];
            member.joined = root.querySelector('#gmJoined').value;
            ITO.log('编辑成员资料', member.uid + ' ' + member.name, '组织');
            U().toast('成员资料已更新');
          } else {
            st.staffSeq = (st.staffSeq || 20008) + 1;
            const uid = 'E' + String(st.staffSeq).padStart(5, '0');
            st.staff.push({
              uid: uid, name: name,
              group: root.querySelector('#gmGroup').value,
              title: root.querySelector('#gmTitle').value,
              tags: tags.length ? tags : ['工程师'],
              joined: root.querySelector('#gmJoined').value,
              phone: root.querySelector('#gmPhone').value.trim()
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
    const tasks = memberTasks(member.name);
    const auths = st.auths.filter(function (a) { return a.person === member.name; });
    const open = tasks.filter(function (x) { return x.sub.status !== '已完成'; });

    U().drawer({
      title: member.name,
      sub: member.uid + ' · ' + g.name,
      body:
        '<div class="profile-head">' + U().avatar(member.name) +
          '<div><b>' + U().esc(member.title) + '</b><span>入组 ' + member.joined + ' · ' + U().esc(member.phone) + '</span></div></div>' +
        '<div class="detail-grid" style="margin-top:20px">' +
          '<div class="detail-field"><label>专业组</label><div>' + U().esc(g.name) + '</div></div>' +
          '<div class="detail-field"><label>组主管</label><div>' + U().esc(g.manager) + '</div></div>' +
          '<div class="detail-field"><label>在办任务</label><div>' + open.length + ' 项</div></div>' +
          '<div class="detail-field"><label>超期任务</label><div class="' + (tasks.some(function (x) { return U().isOverdue(x.sub); }) ? 'text-red' : '') + '">' +
            tasks.filter(function (x) { return U().isOverdue(x.sub); }).length + ' 项</div></div>' +
        '</div>' +
        '<div class="detail-section"><h4>能力标签</h4><div>' + member.tags.map(function (t) {
          return '<span class="tag-inline">' + U().esc(t) + '</span>';
        }).join('') + '</div></div>' +
        '<div class="detail-section"><h4>当前任务（' + tasks.length + '）</h4>' +
          (tasks.length ? '<div class="mini-list">' + tasks.map(function (x) {
            return '<div class="mini-row"><span class="dot" style="background:' + (x.sub.status === '已完成' ? 'var(--green)' : 'var(--brand)') + '"></span>' +
              '<div class="txt"><b>' + U().esc(x.sub.name) + '</b><span>' + x.sub.id + ' · ' + U().esc(x.sub.due) + '</span></div>' +
              U().badge(x.sub.status) + '</div>';
          }).join('') + '</div>' : '<p class="muted">暂无任务</p>') +
        '</div>' +
        '<div class="detail-section"><h4>作业授权</h4>' +
          (auths.length ? '<div class="mini-list">' + auths.map(function (a) {
            return '<div class="mini-row"><span class="dot" style="background:' + (a.status === '有效' ? 'var(--green)' : 'var(--red)') + '"></span>' +
              '<div class="txt"><b>' + U().esc(a.type) + '</b><span>' + U().esc(a.scope) + ' · 至 ' + a.validTo + '</span></div>' +
              U().badge(a.status) + '</div>';
          }).join('') + '</div>' : '<p class="muted">暂无授权记录</p>') +
        '</div>',
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button><span class="spacer"></span>' +
        '<button class="btn btn-soft" data-edit type="button">' + U().icon('edit') + '编辑资料</button>',
      onMount: function (close, root) {
        root.querySelector('[data-close]').addEventListener('click', close);
        root.querySelector('[data-edit]').addEventListener('click', function () {
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
      const maxActive = Math.max.apply(null, st.groups.map(function (g) { return st.metrics.groupActive[g.id] || 0; }));

      const cards = st.groups.map(function (g) {
        const s = groupStats(g);
        const active = st.metrics.groupActive[g.id] || 0;
        return '<div class="group-card' + (filter === g.id ? ' active' : '') + '" data-group="' + g.id + '" role="button" tabindex="0" style="--gcolor:' + g.color + '">' +
          '<div class="group-card-top"><span class="group-code">' + g.code + '</span>' +
            '<div><h3>' + g.name + '</h3><div class="group-mgr">' + g.manager + ' · ' + g.desc + '</div></div></div>' +
          '<div class="group-stats">' +
            '<div><b>' + active + '</b><span>在办</span></div>' +
            '<div><b>' + s.members + '</b><span>成员</span></div>' +
            '<div><b class="' + (s.overdue ? 'text-red' : '') + '">' + s.overdue + '</b><span>超期</span></div>' +
          '</div>' +
          '<div class="group-meter"><i style="width:' + Math.round(active / maxActive * 100) + '%"></i></div>' +
        '</div>';
      }).join('');

      const rows = staff.map(function (p) {
        const g = ITO.getGroup(p.group);
        const mine = memberTasks(p.name);
        const open = mine.filter(function (x) { return x.sub.status !== '已完成'; }).length;
        const over = mine.filter(function (x) { return U().isOverdue(x.sub); }).length;
        return '<tr>' +
          '<td><div class="person-cell">' + U().avatar(p.name, true) + '<div><b>' + U().esc(p.name) + '</b><small>' + p.uid + '</small></div></div></td>' +
          '<td>' + U().groupPill(p.group) + '</td>' +
          '<td>' + U().esc(p.title) + '</td>' +
          '<td>' + p.tags.map(function (t) { return '<span class="tag-inline">' + U().esc(t) + '</span>'; }).join('') + '</td>' +
          '<td class="num">' + p.joined + '</td>' +
          '<td class="num">' + open + '</td>' +
          '<td class="num' + (over ? ' text-red' : '') + '">' + over + '</td>' +
          '<td><div class="row-actions"><button class="btn btn-ghost btn-sm" data-member="' + p.uid + '" type="button">档案</button></div></td>' +
        '</tr>';
      }).join('');

      const activeGroup = filter ? ITO.getGroup(filter) : null;

      return U().pageHead({
        title: '专业组',
        sub: activeGroup ? '当前筛选：' + activeGroup.name + ' · ' + activeGroup.desc : '4 个专业组 · ' + st.staff.length + ' 名成员 · 按组查看负荷与人员',
        actions:
          (filter ? '<button class="btn btn-ghost" id="clearGroupBtn" type="button">' + U().icon('close') + '取消筛选</button>' : '') +
          '<button class="btn btn-primary" id="addMemberBtn" type="button">' + U().icon('plus') + '新增成员</button>'
      }) +
      '<div class="group-grid">' + cards + '</div>' +

      '<div class="groups-layout">' +
        '<section class="card chart-card">' +
          '<div class="chart-head"><div><h3 class="chart-title">专业组负荷</h3><p class="chart-sub">在办与超期子任务对比 · 合计 ' + st.metrics.active + ' 件在办</p></div>' +
            '<span class="head-tag">LOAD</span></div>' +
          '<div class="chart-body" id="groupLoadChart"></div>' +
        '</section>' +
        '<section class="card staff-panel">' +
          '<div class="staff-head"><div class="staff-head-left"><h3>成员名录</h3><span class="count">' + staff.length + ' 人</span></div>' +
            '<span class="table-note">' + (activeGroup ? activeGroup.name : '全部专业组') + '</span></div>' +
          '<div class="table-wrap"><table class="data-table"><thead><tr><th>成员</th><th>专业组</th><th>岗位</th><th>标签</th><th>入组</th><th>在办</th><th>超期</th><th style="text-align:right">操作</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>' +
        '</section>' +
      '</div>';
    },

    after: function () {
      const st = S();
      const filter = st.ui.groupFilter || '';

      U().chart('groupLoadChart', {
        tooltip: {
          trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(29,29,31,.92)',
          borderWidth: 0, padding: [9, 12], textStyle: { color: '#fff', fontSize: 11 }
        },
        legend: { show: true, right: 4, top: 0, itemWidth: 8, itemHeight: 8, textStyle: { color: '#8A8A8E', fontSize: 9 } },
        grid: { left: 6, right: 12, top: 26, bottom: 4, containLabel: true },
        xAxis: {
          type: 'value', splitLine: { lineStyle: { color: 'rgba(29,29,31,.055)', type: 'dashed' } },
          axisLabel: { color: '#AEAEB2', fontSize: 9 }, axisLine: { show: false }, axisTick: { show: false }
        },
        yAxis: {
          type: 'category', data: st.groups.map(function (g) { return g.name; }),
          axisLine: { lineStyle: { color: 'rgba(29,29,31,.10)' } }, axisTick: { show: false },
          axisLabel: { color: '#4A4A4F', fontSize: 10 }
        },
        series: [
          {
            name: '在办', type: 'bar', barWidth: 9, data: st.groups.map(function (g) {
              return { value: st.metrics.groupActive[g.id] || 0, itemStyle: { color: g.color, borderRadius: [0, 4, 4, 0], opacity: filter && filter !== g.id ? 0.28 : 1 } };
            })
          },
          {
            name: '超期', type: 'bar', barWidth: 5,
            data: st.groups.map(function (g) { return groupStats(g).overdue; }),
            itemStyle: { color: '#E5484D', borderRadius: [0, 3, 3, 0], opacity: filter ? 0.9 : 0.75 }
          }
        ]
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

      U().$$('[data-member]').forEach(function (btn) {
        btn.addEventListener('click', function () { GROUP.profile(btn.dataset.member); });
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
})();
