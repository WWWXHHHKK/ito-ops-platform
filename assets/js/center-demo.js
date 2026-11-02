/* ─────────────────────────────────────────────
   cockpit center · professional group twin
   C variant selected for the exhibition cockpit.
   Uses the shared demo data from ito-data.js.
   ───────────────────────────────────────────── */

(() => {
  'use strict';

  const D = window.ITO_DATA;
  const center = document.getElementById('centerColumn');
  const stage = document.getElementById('stage');
  if (!D || !center) return;

  const STILL = new URLSearchParams(window.location.search).has('still');
  const pad = n => String(n).padStart(2, '0');
  const parse = str => new Date(String(str).replace(/-/g, '/'));

  const today = parse(D.meta.today);
  const now = parse(D.meta.demoNow);

  function groupIndex(id) {
    return D.groups.findIndex(g => g.id === id);
  }

  const overdueByGroup = D.groups.map(() => 0);
  D.tasks.forEach(task => {
    task.subs.forEach(sub => {
      if (sub.status === '已完成') return;
      if (parse(sub.due) >= now) return;
      const idx = groupIndex(sub.group);
      if (idx >= 0) overdueByGroup[idx] += 1;
    });
  });

  const baseGroups = D.groups.map((g, i) => ({
    id: g.id,
    name: g.name,
    manager: g.manager,
    active: D.dashboard.groupActive[g.id] || 0,
    members: D.staff.filter(p => p.group === g.id).length,
    overdue: overdueByGroup[i]
  }));

  const baseActive = D.dashboard.active;
  const baseClosed = D.dashboard.closed;
  const baseOverdue = overdueByGroup.reduce((a, b) => a + b, 0);
  const baseSla = Number(D.dashboard.sla);
  const baseOnTime = Number(D.dashboard.onTimeRate);

  const recoveredGroups = baseGroups.map(g => {
    if (g.name !== '通信组') return { ...g };
    return {
      ...g,
      active: Math.max(0, g.active - 1),
      overdue: Math.max(0, g.overdue - 1)
    };
  });

  const validAuths = D.auths.filter(a => {
    if (a.status === '已撤销') return false;
    return parse(a.validTo) >= today;
  }).length;

  const duty = D.duty.week[D.duty.todayIndex];
  const dutyCount = 1 + duty.day.length + duty.night.length + 1;

  const STATES = [
    {
      id: 'daily', label: '日常', tone: 'ok',
      active: baseActive, closed: baseClosed, overdue: baseOverdue, sla: baseSla,
      ontime: baseOnTime, groups: baseGroups, highRisk: 3,
      title: '任务运行平稳', note: '7 项超期均在处置窗口 · 今日新增 24 · 今日闭环 21'
    },
    {
      id: 'overdue', label: '超期', tone: 'crit',
      active: baseActive, closed: baseClosed, overdue: baseOverdue, sla: baseSla,
      ontime: baseOnTime, groups: baseGroups, highRisk: 3,
      title: '防火墙策略评审超期', note: 'T10023-01 · 通信组 · 高风险作业授权 · 已超期 2 小时 56 分'
    },
    {
      id: 'handling', label: '处置', tone: 'warn',
      active: baseActive, closed: baseClosed, overdue: baseOverdue, sla: Number((baseSla - 0.3).toFixed(1)),
      ontime: 88.7, groups: baseGroups, highRisk: 2,
      title: '高风险审批升级处置', note: '已升级至王主管 · 高风险授权审批中 · 关联割接任务等待执行'
    },
    {
      id: 'recovered', label: '闭环', tone: 'ok',
      active: Math.max(0, baseActive - 1), closed: baseClosed + 1,
      overdue: Math.max(0, baseOverdue - 1), sla: Number((baseSla + 0.2).toFixed(1)),
      ontime: 89.1, groups: recoveredGroups, highRisk: 2,
      title: '授权通过，任务恢复', note: 'T10023-01 已闭环 · 割接进入执行 · 当前超期降至 6 项'
    }
  ];

  let stateIndex = 1;
  let manualPaused = STILL;
  let globalPaused = !!(stage && stage.classList.contains('is-paused'));
  let progress = 0;

  const state = () => STATES[stateIndex];

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function running() {
    return !manualPaused && !globalPaused;
  }

  function groupTone(st, group) {
    if (st.id !== 'overdue' && st.id !== 'handling') return 'ok';
    if (group.name !== '通信组') return 'ok';
    return st.id === 'overdue' ? 'crit' : 'warn';
  }

  function overdueTone(st, group) {
    if (!group.overdue) return 'ok';
    if (group.name === '通信组' && (st.id === 'overdue' || st.id === 'handling')) {
      return st.id === 'overdue' ? 'crit' : 'warn';
    }
    return 'warn';
  }

  function head(idx, title, en, right) {
    return '<div class="panel-head">' +
      '<div class="ph-left"><i class="ph-idx">' + String(idx).padStart(2, '0') + '</i><h2>' + title + '</h2><span class="ph-en">' + en + '</span></div>' +
      (right || '<span class="head-tag">LIVE</span>') +
    '</div>';
  }

  function panel(idx, title, en, body, right, cls) {
    return '<section class="panel ' + (cls || '') + '">' +
      head(idx, title, en, right) +
      '<div class="panel-body">' + body + '</div>' +
    '</section>';
  }

  function demoControls() {
    const st = state();
    const mode = globalPaused ? '全局暂停' : running() ? '自动演示' : '已暂停';
    const modeSub = globalPaused ? 'LIVE PAUSED' : running() ? '10s' : '手动';
    return '<div class="demo-controls">' +
      '<span class="demo-mode"><i class="' + (running() ? '' : 'paused') + '"></i>' + mode + '<em>' + modeSub + '</em></span>' +
      '<span class="demo-progress"><i style="width:' + (progress * 10) + '%"></i></span>' +
      '<button class="demo-btn" type="button" data-demo="prev" aria-label="上一步">‹</button>' +
      '<button class="demo-btn" type="button" data-demo="play">' + (manualPaused ? '播放' : '暂停') + '</button>' +
      '<button class="demo-btn" type="button" data-demo="next" aria-label="下一步">›</button>' +
      '<span class="demo-states">' + STATES.map((x, i) =>
        '<button class="demo-state' + (i === stateIndex ? ' active' : '') + '" type="button" data-demo-state="' + i + '" data-tone="' + x.tone + '"><i></i>' + esc(x.label) + '</button>'
      ).join('') + '</span>' +
    '</div>';
  }

  function render() {
    const st = state();
    const groups = st.groups;
    const maxActive = Math.max.apply(null, groups.map(g => g.active)) || 1;
    const totalActive = st.active || 1;

    const layerHtml = groups.map((g, i) => {
      const tone = groupTone(st, g);
      const oTone = overdueTone(st, g);
      const chips = [
        { name: '在办任务', value: g.active + ' 项', meter: Math.round(g.active / maxActive * 100), cls: tone },
        { name: '成员', value: g.members + ' 人', meter: 78, cls: 'ok' },
        { name: '超期', value: g.overdue + ' 项', meter: g.overdue ? 68 : 8, cls: oTone }
      ].map(c =>
        '<div class="twin-chip s-' + c.cls + '">' +
          '<div class="tw-top"><i></i><b>' + c.name + '</b></div>' +
          '<div class="tw-meta"><span>' + esc(g.manager) + '</span><em>' + c.value + '</em></div>' +
          '<div class="tw-meter"><i style="width:' + c.meter + '%"></i></div>' +
        '</div>'
      ).join('');
      return '<div class="twin-layer l' + (i + 1) + ' s-' + tone + '">' +
        '<div class="twin-layer-label"><b>' + g.name + '</b><span>' + D.groups[i].code + ' · ' + g.manager + '</span></div>' +
        '<div class="twin-items">' + chips + '</div>' +
      '</div>';
    }).join('');

    const loadRows = groups.map(g => {
      const width = Math.round(g.active / maxActive * 100);
      return '<div class="capacity-row s-' + groupTone(st, g) + '">' +
        '<span>' + g.name + '</span>' +
        '<div class="capacity-bar"><i style="width:' + width + '%"></i></div>' +
        '<b>' + g.active + '</b>' +
      '</div>';
    }).join('');

    const overdueRows = groups.map(g => {
      const tone = overdueTone(st, g);
      return '<div class="twin-risk-row s-' + tone + '">' +
        '<i></i><b>' + g.name + '</b><em>' + g.overdue + ' 项</em>' +
      '</div>';
    }).join('');

    const top = panel(4, '专业组运行总览', 'GROUP TELEMETRY',
      '<div class="twin-summary">' +
        '<div class="twin-kpi"><span>在办任务</span><b>' + st.active + '<em>件</em></b><small>4 个组 · ' + D.staff.length + ' 名成员</small></div>' +
        '<div class="twin-kpi"><span>近 30 天闭环</span><b>' + st.closed + '<em>件</em></b><small>按期率 ' + st.ontime + '%</small></div>' +
        '<div class="twin-kpi"><span>超期任务</span><b class="' + (st.overdue ? 'crit' : '') + '">' + st.overdue + '<em>项</em></b><small>高风险 ' + st.highRisk + ' 项 · 重点任务 1</small></div>' +
        '<div class="twin-kpi"><span>任务 SLA</span><b>' + st.sla + '<em>%</em></b><small>目标 95.0% · ' + (st.sla >= 95 ? '达标' : '关注') + '</small></div>' +
      '</div>',
      demoControls()
    );

    const middle = panel(5, '专业组数字孪生', 'GROUP DIGITAL TWIN',
      '<div class="twin-stage">' + layerHtml + '</div>',
      '<span class="head-tag">' + st.active + ' ACTIVE</span>'
    );

    const bottom = '<div class="center-c-bottom">' +
      panel(6, '专业组负荷', 'GROUP LOAD',
        '<div class="twin-bottom-panel">' +
          loadRows +
          '<div class="capacity-foot"><span>平均负荷 ' + (st.active / groups.length).toFixed(1) + ' 项 / 组</span><b>最高 ' + maxActive + '</b></div>' +
        '</div>',
        '<span class="head-tag">4 GROUPS</span>'
      ) +
      panel(7, '超期分布', 'OVERDUE',
        '<div class="twin-bottom-panel twin-risk">' +
          overdueRows +
          '<div class="capacity-foot"><span>超期合计</span><b>' + st.overdue + ' 项</b></div>' +
        '</div>',
        '<span class="head-tag">' + st.overdue + ' OVERDUE</span>'
      ) +
      panel(8, '值班与授权', 'DUTY & AUTH',
        '<div class="twin-bottom-panel twin-risk">' +
          '<div class="twin-risk-row s-ok"><i></i><b>值班主管</b><em>' + esc(duty.manager) + '</em></div>' +
          '<div class="twin-risk-row s-ok"><i></i><b>白班</b><em>' + esc(duty.day.join(' / ')) + '</em></div>' +
          '<div class="twin-risk-row s-ok"><i></i><b>夜班</b><em>' + esc(duty.night.join(' / ')) + '</em></div>' +
          '<div class="twin-risk-row s-ok"><i></i><b>授权覆盖</b><em>' + validAuths + ' / ' + D.auths.length + '</em></div>' +
          '<div class="capacity-foot"><span>今日在岗 ' + dutyCount + ' 人</span><b>08:00 交接</b></div>' +
        '</div>',
        '<span class="head-tag">ON DUTY</span>'
      ) +
    '</div>';

    center.innerHTML = top + middle + bottom;
    updateProgress();
  }

  function updateProgress() {
    const bar = center.querySelector('.demo-progress i');
    if (bar) bar.style.width = (progress * 10) + '%';
  }

  function updateMode() {
    const mode = center.querySelector('.demo-mode');
    if (!mode) return;
    const text = globalPaused ? '全局暂停' : running() ? '自动演示' : '已暂停';
    const sub = globalPaused ? 'LIVE PAUSED' : running() ? '10s' : '手动';
    mode.innerHTML = '<i class="' + (running() ? '' : 'paused') + '"></i>' + text + '<em>' + sub + '</em>';
    const play = center.querySelector('[data-demo="play"]');
    if (play) play.textContent = manualPaused ? '播放' : '暂停';
    Array.prototype.forEach.call(center.querySelectorAll('.demo-state'), b => {
      b.classList.toggle('active', Number(b.dataset.demoState) === stateIndex);
    });
    updateProgress();
  }

  function setState(index, manual) {
    stateIndex = (index + STATES.length) % STATES.length;
    progress = 0;
    if (manual) manualPaused = true;
    render();
  }

  function togglePlay() {
    manualPaused = !manualPaused;
    if (!manualPaused) progress = 0;
    render();
  }

  center.addEventListener('click', e => {
    const stateBtn = e.target.closest('[data-demo-state]');
    if (stateBtn) {
      setState(Number(stateBtn.dataset.demoState), true);
      return;
    }
    const btn = e.target.closest('[data-demo]');
    if (!btn) return;
    if (btn.dataset.demo === 'play') togglePlay();
    if (btn.dataset.demo === 'prev') setState(stateIndex - 1, true);
    if (btn.dataset.demo === 'next') setState(stateIndex + 1, true);
  });

  document.addEventListener('ito:livechange', e => {
    globalPaused = !e.detail.live;
    updateMode();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') setState(stateIndex - 1, true);
    if (e.key === 'ArrowRight') setState(stateIndex + 1, true);
    if (e.code === 'Space' && (e.target === document.body || !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) {
      e.preventDefault();
      togglePlay();
    }
  });

  setInterval(() => {
    if (!running()) return;
    progress += 0.1;
    if (progress >= 10) {
      progress = 0;
      stateIndex = (stateIndex + 1) % STATES.length;
      render();
    } else {
      updateProgress();
    }
  }, 100);

  render();
})();

