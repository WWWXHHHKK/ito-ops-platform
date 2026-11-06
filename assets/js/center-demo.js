/* ─────────────────────────────────────────────
   cockpit center · 30-day task flow sandbox
   Replaces the professional-group twin.
   Fully conserved: opening + created = closed + active
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

  const now = parse(D.meta.demoNow);

  /* ── 30-day flow ───────────────────────────── */
  const FLOW = {
    opening: Number(D.dashboard.openingBacklog) || 86,
    created: Number(D.dashboard.newTasks) || 384,
    closed: Number(D.dashboard.closed) || 342,
    active: Number(D.dashboard.active) || 128
  };
  const FLOW_IN = FLOW.opening + FLOW.created;
  const FLOW_OUT = FLOW.closed + FLOW.active;
  const closedPct = (FLOW.closed / FLOW_OUT * 100).toFixed(1);
  const activePct = (FLOW.active / FLOW_OUT * 100).toFixed(1);

  /* ── 07 overdue aging ─────────────────────── */
  const overdueSubs = D.tasks.reduce((list, task) => list.concat(task.subs), [])
    .filter(sub => sub.status !== '已完成' && sub.status !== '已取消' && parse(sub.due) < now);
  const overdueAges = overdueSubs.map(sub => (now - parse(sub.due)) / 3600000);
  const AGE_BUCKETS = [
    { key: 'lt1', label: '<1 天', min: 0, max: 24, cls: '' },
    { key: '1to3', label: '1–3 天', min: 24, max: 72, cls: 'a-warn' },
    { key: '3to5', label: '3–5 天', min: 72, max: 120, cls: 'a-orange' },
    { key: 'gte5', label: '≥5 天', min: 120, max: Infinity, cls: 'a-crit' }
  ];
  const ageCounts = AGE_BUCKETS.map(b => overdueAges.filter(h => h >= b.min && h < b.max).length);
  const agePeak = Math.max.apply(null, ageCounts.concat([1]));
  const ageAvg = overdueAges.length ? overdueAges.reduce((a, b) => a + b, 0) / overdueAges.length / 24 : 0;
  const ageLongest = overdueAges.length ? Math.max.apply(null, overdueAges) / 24 : 0;

  /* ── 08 duty & auth ───────────────────────── */
  const dutyNow = D.duty.weeks.find(w => w.key === D.duty.currentKey) || D.duty.weeks[0];
  const dutyNext = D.duty.weeks.find(w => w.key === D.duty.nextKey) || D.duty.weeks[1];
  const shortMd = iso => iso.slice(5).replace('-', '/');

  const todayDate = parse(D.meta.today);
  const dowIndex = (todayDate.getDay() + 6) % 7;
  const weekStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - dowIndex);
  const WEEK_CN = ['一', '二', '三', '四', '五', '六', '日'];
  const AUTH_TYPES = [
    { label: '工作负责人', type: '工作负责人授权' },
    { label: '高风险作业', type: '高风险作业授权' },
    { label: '准备工程师', type: '准备工程师授权' },
    { label: 'RP1', type: 'RP1 授权' }
  ];
  const authCover = AUTH_TYPES.map(item => {
    const list = D.auths.filter(a => a.type === item.type);
    const ok = list.filter(a => a.status !== '已撤销' && ITO.authStatus(a.validTo).status !== '已过期').length;
    return { type: item.label, ok: ok, total: list.length };
  });
  const authOk = authCover.reduce((n, x) => n + x.ok, 0);
  const authTotal = authCover.reduce((n, x) => n + x.total, 0);

  /* ── demo states ──────────────────────────── */
  const STATES = [
    {
      id: 'daily', label: '日常', tone: 'ok', flow: 'ok',
      title: '任务运行平稳',
      note: '7 项超期均在处置窗口 · 新增与闭环节奏平稳',
      route: 'tasks'
    },
    {
      id: 'overdue', label: '超期', tone: 'crit', flow: 'crit',
      title: '防火墙策略评审超期',
      note: 'T10023-01 · 通信组 · 已超期 2 小时 56 分',
      route: 'dispatch'
    },
    {
      id: 'handling', label: '处置', tone: 'warn', flow: 'warn',
      title: '高风险审批升级处置',
      note: '已升级至王主管 · 高风险授权审批中',
      route: 'dispatch'
    },
    {
      id: 'recovered', label: '闭环', tone: 'ok', flow: 'good',
      title: '授权通过，任务恢复',
      note: 'T10023-01 已闭环 · 其余超期任务继续跟踪',
      route: 'tasks'
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

  function head(idx, title, en, right) {
    return '<div class="panel-head">' +
      '<div class="ph-left"><i class="ph-idx">' + pad(idx) + '</i><h2>' + title + '</h2><span class="ph-en">' + en + '</span></div>' +
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

  function flowNode(cls, label, value, sub, route, query) {
    return '<div class="flow-node ' + cls + '" data-drill="' + route + '"' +
      (query ? ' data-query="' + query + '"' : '') + ' tabindex="0" role="link">' +
      '<span>' + esc(label) + '</span><b>' + value + '</b><em>' + esc(sub) + '</em>' +
    '</div>';
  }

  function render() {
    const st = state();
    const todayData = D.dashboard.today;

    /* 04 today */
    const top = panel(4, '今日态势', 'TODAY OPS',
      '<div class="today-strip">' +
        '<div class="today-kpi" data-drill="tasks" tabindex="0" role="link"><span>今日新增</span><b>' + todayData.created + '<em>件</em></b><small>今日累计</small></div>' +
        '<div class="today-kpi" data-drill="tasks" data-query="status=已完成" tabindex="0" role="link"><span>今日闭环</span><b class="good">' + todayData.closed + '<em>件</em></b><small>占新增 ' + Math.round(todayData.closed / todayData.created * 100) + '%</small></div>' +
        '<div class="today-kpi" data-drill="tasks" tabindex="0" role="link"><span>净流入</span><b class="warn">+' + todayData.net + '<em>件</em></b><small>新增 − 闭环</small></div>' +
        '<div class="today-kpi" data-drill="dispatch" tabindex="0" role="link"><span>高风险作业</span><b class="crit">' + todayData.highRisk + '<em>项</em></b><small>重点跟踪</small></div>' +
      '</div>',
      '<span class="head-tag">TODAY</span>'
    );

    /* 05 flow sandbox */
    const flowTone = st.flow || 'ok';
    const middle = panel(5, '任务流量沙盘', 'TASK FLOW SANDBOX',
      '<div class="flow-body tone-' + flowTone + (running() ? '' : ' is-paused') + '">' +
        '<div class="flow-diagram">' +
          '<svg viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">' +
            '<path class="flow-band band-start" d="M170,76 C270,76 300,125 400,125"/>' +
            '<path class="flow-band band-new" d="M170,224 C270,224 300,175 400,175"/>' +
            '<path class="flow-band band-closed" d="M600,125 C700,125 730,69 830,69"/>' +
            '<path class="flow-band band-active" d="M600,175 C700,175 730,231 830,231"/>' +
            '<path class="flow-line line-start" d="M170,76 C270,76 300,125 400,125"/>' +
            '<path class="flow-line line-new" d="M170,224 C270,224 300,175 400,175"/>' +
            '<path class="flow-line line-closed" d="M600,125 C700,125 730,69 830,69"/>' +
            '<path class="flow-line line-active" d="M600,175 C700,175 730,231 830,231"/>' +
          '</svg>' +
          flowNode('flow-src src-open', '期初积压', FLOW.opening, 'OPENING', 'tasks') +
          flowNode('flow-src src-new', '新增任务', FLOW.created, '30 天累计', 'tasks') +
          flowNode('flow-mid', '30 天流转', FLOW_IN, '件 · 流入合计', 'tasks') +
          flowNode('flow-end end-closed', '已闭环', FLOW.closed, closedPct + '% · 已完成', 'tasks', 'status=已完成') +
          flowNode('flow-end end-active', '当前在办', FLOW.active, activePct + '% · 进行中', 'tasks') +
        '</div>' +
        '<div class="flow-focus" data-drill="' + st.route + '" tabindex="0" role="link">' +
          '<span class="ff-tag">' + esc(st.label) + '</span>' +
          '<div class="ff-copy"><b>' + esc(st.title) + '</b><span>' + esc(st.note) + '</span></div>' +
          '<span class="ff-go">查看 →</span>' +
        '</div>' +
      '</div>',
      demoControls()
    );

    /* 06 type mix · 与任务中心同一份清单数据 */
    const OTHER_TYPES = ['试验', '操作', '工单', '综合', '故障'];
    const taskPool = (window.ITO && ITO.state && ITO.state.tasks) || D.tasks || [];
    const otherCounts = OTHER_TYPES.map(function (name) {
      return { name: name, value: taskPool.filter(function (t) { return t.type === name; }).length };
    }).filter(function (x) { return x.value > 0; });
    const otherDetail = otherCounts.map(function (x) { return x.name + ' ' + x.value; }).join(' · ');
    const TYPE_BLOCKS = [
      { name: '巡检', color: '#35e0ff', match: ['巡检'] },
      { name: '变更', color: '#b57bff', match: ['变更'] },
      { name: '开发', color: '#2f8bff', match: ['开发'] },
      { name: '维保', color: '#ffcf3f', match: ['维保'] },
      { name: '其他 ' + otherCounts.length + ' 类', query: '其他', color: '#2ff0a8', match: OTHER_TYPES, detail: otherDetail }
    ];
    const mix = TYPE_BLOCKS.map(function (block) {
      return {
        name: block.name,
        query: block.query || block.name,
        detail: block.detail || '',
        color: block.color,
        value: taskPool.filter(function (t) { return block.match.indexOf(t.type) > -1; }).length
      };
    });
    const mixTotal = mix.reduce((n, x) => n + x.value, 0);
    const mixPick = names => mix.filter(x => names.indexOf(x.name) >= 0).reduce((n, x) => n + x.value, 0);
    const mixBlock = x => '<div class="tm-block" data-drill="tasks" data-query="type=' + encodeURIComponent(x.query) + '" tabindex="0" role="link"' +
      (x.detail ? ' title="' + esc(x.name + '：' + x.detail) + '"' : '') +
      ' style="--c:' + x.color + ';flex:' + x.value + '">' +
      '<b>' + esc(x.name) + '</b><em>' + x.value + '</em><span>' + Math.round(x.value / mixTotal * 100) + '%</span>' +
    '</div>';
    const mixFirst = mix.slice(0, 2);
    const mixSecond = mix.slice(2);
    const mixFirstSum = mixFirst.reduce((n, x) => n + x.value, 0);
    const mixSecondSum = mixSecond.reduce((n, x) => n + x.value, 0);

    /* 07 aging */
    const ageCols = AGE_BUCKETS.map((b, i) =>
      '<div class="aging-col ' + b.cls + '" data-drill="tasks" data-query="status=' + encodeURIComponent('超期') + '&age=' + b.key + '" tabindex="0" role="link">' +
        '<b>' + ageCounts[i] + '</b>' +
        '<div class="aging-bar"><i style="height:' + Math.max(8, Math.round(ageCounts[i] / agePeak * 100)) + '%"></i></div>' +
        '<span>' + b.label + '</span>' +
      '</div>'
    ).join('');

    /* 08 duty & auth */
    const dayCells = WEEK_CN.map((label, i) => {
      const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
      const active = d >= parse(dutyNow.start) && d <= parse(dutyNow.end);
      return '<div class="duty-day' + (i === dowIndex ? ' today' : '') + (active ? ' on' : '') + '">' +
        '<b>' + String(d.getDate()).padStart(2, '0') + '</b>' + label +
      '</div>';
    }).join('');
    const authRows = authCover.map(x =>
      '<div class="auth-row' + (x.ok < x.total ? ' miss' : '') + '" data-drill="auth" tabindex="0" role="link">' +
        '<span>' + esc(x.type) + '</span>' +
        '<div class="ar-bar"><i style="width:' + (x.total ? Math.round(x.ok / x.total * 100) : 0) + '%"></i></div>' +
        '<b>' + x.ok + '/' + x.total + '</b>' +
      '</div>'
    ).join('');

    const bottom = '<div class="center-c-bottom">' +
      panel(6, '任务类型构成', 'TYPE MIX',
        '<div class="type-wrap">' +
          '<div class="type-map">' +
            '<div class="tm-row" style="flex:' + mixFirstSum + '">' + mixFirst.map(mixBlock).join('') + '</div>' +
            '<div class="tm-row" style="flex:' + mixSecondSum + '">' + mixSecond.map(mixBlock).join('') + '</div>' +
          '</div>' +
          '<div class="type-foot" title="' + esc('其他明细：' + otherDetail) + '"><span>其他：' + esc(otherDetail) + '</span><span>变更 + 开发 <b>' + Math.round(mixPick(['变更', '开发']) / mixTotal * 100) + '%</b></span></div>' +
        '</div>',
        '<span class="head-tag">5 TYPES</span>'
      ) +
      panel(7, '超期时长分布', 'AGING',
        '<div class="aging-wrap">' +
          '<div class="aging-chart">' + ageCols + '</div>' +
          '<div class="aging-foot"><span>平均 <b>' + ageAvg.toFixed(1) + '</b> 天</span><span>最长 <b>' + ageLongest.toFixed(1) + '</b> 天</span></div>' +
        '</div>',
        '<span class="head-tag">4 BINS</span>'
      ) +
      panel(8, '值班与授权', 'DUTY & AUTH',
        '<div class="duty-board">' +
          '<div class="duty-main" data-drill="duty" tabindex="0" role="link"><b>' + esc(dutyNow.person) + '</b><span>本周值班 ' + shortMd(dutyNow.start) + '–' + shortMd(dutyNow.end) + '</span><em>7×24</em></div>' +
          '<div class="duty-week" data-drill="duty" tabindex="0" role="link">' + dayCells + '</div>' +
          '<div class="duty-next" data-drill="duty" tabindex="0" role="link"><span>下周值班</span><b>' + esc(dutyNext.person) + '</b><em>' + shortMd(dutyNext.start) + ' 08:00 交接</em></div>' +
          '<div class="auth-cover">' +
            '<div class="auth-head" data-drill="auth" tabindex="0" role="link"><span>重点授权覆盖</span><b>' + authOk + ' / ' + authTotal + '</b></div>' +
            authRows +
          '</div>' +
        '</div>',
        '<span class="head-tag">7×24</span>'
      ) +
    '</div>';

    center.innerHTML = top + middle + bottom;
    center.classList.toggle('is-paused', !running());
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
    center.classList.toggle('is-paused', !running());
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
