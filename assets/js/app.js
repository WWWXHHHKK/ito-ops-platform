/* ─────────────────────────────────────────────
   ITO OPS COMMAND CENTER · runtime
   ───────────────────────────────────────────── */

(() => {
  'use strict';

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const pad = n => String(n).padStart(2, '0');
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const stage = $('#stage');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STILL = new URLSearchParams(window.location.search).has('still');
  if (STILL) document.documentElement.classList.add('still');

  /* ── 1920 × 1080 stage fit ─────────────────── */
  function fitStage() {
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
  window.addEventListener('resize', fitStage);
  fitStage();

  /* ── clock ─────────────────────────────────── */
  const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const clockEl = $('#clock');
  const dateEl = $('#date');

  function tickClock() {
    const demoNow = window.ITO_DATA && ITO_DATA.meta && ITO_DATA.meta.demoOverride
      ? String(ITO_DATA.meta.demoNow || '').replace(/-/g, '/')
      : '';
    const now = demoNow ? new Date(demoNow) : new Date();
    clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    dateEl.textContent = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${WEEK[now.getDay()]}`;
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ── number count-up ───────────────────────── */
  function countUp(el) {
    const raw = el.dataset.count;
    const target = parseFloat(raw);
    if (Number.isNaN(target)) return;
    const decimals = (raw.split('.')[1] || '').length;
    const useComma = el.dataset.format === 'comma';
    const format = value => useComma
      ? value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : value.toFixed(decimals);
    if (STILL) {
      el.textContent = format(target);
      return;
    }
    const duration = reduceMotion ? 1 : 1300;
    const start = performance.now();

    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = format(target * eased);
      if (progress < 1) requestAnimationFrame(frame);
      else el.textContent = format(target);
    }
    requestAnimationFrame(frame);
  }
  $$('[data-count]').forEach(countUp);

  /* ── SLA gauge ticks ───────────────────────── */
  const gaugeTicks = $('#gaugeTicks');
  if (gaugeTicks) {
    const cx = 75, cy = 75;
    const total = 44;
    for (let i = 0; i <= total; i++) {
      const angle = (135 + (270 * i) / total) * Math.PI / 180;
      const major = i % 11 === 0;
      const inner = major ? 59.5 : 61;
      const outer = 64;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', (cx + Math.cos(angle) * inner).toFixed(2));
      line.setAttribute('y1', (cy + Math.sin(angle) * inner).toFixed(2));
      line.setAttribute('x2', (cx + Math.cos(angle) * outer).toFixed(2));
      line.setAttribute('y2', (cy + Math.sin(angle) * outer).toFixed(2));
      if (major) line.setAttribute('class', 'major');
      gaugeTicks.appendChild(line);
    }
  }

  /* ── 01 health triage ──────────────────────── */
  const HEALTH = (window.ITO_DATA.dashboard.health) || { normal: 109, dueSoon: 12, overdue: 7 };
  const healthTotal = HEALTH.normal + HEALTH.dueSoon + HEALTH.overdue;
  const setHealth = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setHealth('healthDue', HEALTH.dueSoon);
  setHealth('healthDueLegend', HEALTH.dueSoon);
  setHealth('healthNormal', HEALTH.normal);
  setHealth('healthOverdue', HEALTH.overdue);
  setHealth('healthRate', (HEALTH.normal / healthTotal * 100).toFixed(1) + '%');
  const hbOk = document.getElementById('hbOk');
  const hbWarn = document.getElementById('hbWarn');
  const hbBad = document.getElementById('hbBad');
  if (hbOk) hbOk.style.flex = HEALTH.normal;
  if (hbWarn) hbWarn.style.flex = HEALTH.dueSoon;
  if (hbBad) hbBad.style.flex = HEALTH.overdue;

  /* ── ticket trend chart ────────────────────── */
  const chartEl = $('#ticketChart');
  let ticketChart = null;

  const TREND = (() => {
    const D = window.ITO_DATA;
    const sum = list => list.reduce((n, v) => n + v, 0);
    const last7New = D.trend.newTasks.slice(-7);
    const last7Done = D.trend.completed.slice(-7);
    return {
      '30': {
        labels: D.trend.daily,
        created: D.trend.newTasks,
        resolved: D.trend.completed,
        newTotal: D.dashboard.newTasks,
        doneTotal: D.dashboard.closed,
        backlog: D.dashboard.active,
        newDelta: '+12.4%', doneDelta: '-4.1%', backlogNote: '当前'
      },
      '7': {
        labels: D.trend.daily.slice(-7),
        created: last7New,
        resolved: last7Done,
        newTotal: sum(last7New),
        doneTotal: sum(last7Done),
        backlog: D.dashboard.active,
        newDelta: '+8.2%', doneDelta: '+6.4%', backlogNote: '当前'
      }
    };
  })();

  function trendOption(key) {
    const d = TREND[key];
    const axisColor = 'rgba(88, 178, 235, 0.18)';
    return {
      animationDuration: reduceMotion ? 0 : 900,
      animationEasing: 'cubicOut',
      grid: { left: 40, right: 10, top: 20, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(3, 18, 36, 0.98)',
        borderColor: 'rgba(53, 224, 255, 0.45)',
        borderWidth: 1,
        padding: [8, 11],
        textStyle: { color: '#e9f8ff', fontSize: 11, fontFamily: 'Bahnschrift, "Microsoft YaHei UI", sans-serif' },
        extraCssText: 'box-shadow: 0 10px 26px rgba(0,0,0,.55), 0 0 18px rgba(53,224,255,.12); border-radius: 0;',
        axisPointer: { type: 'line', lineStyle: { color: 'rgba(53, 224, 255, 0.45)', type: 'dashed' } },
        formatter(params) {
          const rows = params.map(p => `<div style="display:flex;justify-content:space-between;gap:22px;line-height:1.8">
            <span style="color:#7b9fbc">${p.marker}${p.seriesName}</span>
            <b style="font-weight:500;color:#e9f8ff">${p.value} 件</b></div>`).join('');
          return `<div style="padding-bottom:4px;margin-bottom:3px;border-bottom:1px solid rgba(64,178,255,.18);color:#a9cbe2;letter-spacing:.06em">${params[0].axisValue}</div>${rows}`;
        }
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: d.labels,
        axisLine: { lineStyle: { color: axisColor } },
        axisTick: { show: false },
        axisLabel: {
          color: '#6f9cba',
          fontSize: 11,
          fontFamily: 'Bahnschrift, "Microsoft YaHei UI", sans-serif',
          margin: 8,
          interval: key === '30' ? 4 : 0,
          showMinLabel: true,
          showMaxLabel: true
        }
      },
      yAxis: {
        type: 'value',
        splitNumber: 3,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#6f9cba', fontSize: 11, fontFamily: 'Bahnschrift, sans-serif', margin: 8 },
        splitLine: { lineStyle: { color: 'rgba(64, 178, 255, 0.08)', type: 'dashed' } }
      },
      series: [
        {
          name: '新增任务',
          type: 'line',
          smooth: 0.32,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 5,
          data: d.created,
          lineStyle: { width: 1.7, color: '#ffcf3f', shadowBlur: 10, shadowColor: 'rgba(255, 207, 63, .35)' },
          itemStyle: { color: '#ffcf3f', borderColor: '#031225', borderWidth: 1 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(255, 207, 63, 0.20)' },
              { offset: 1, color: 'rgba(255, 207, 63, 0)' }
            ])
          },
          emphasis: { focus: 'series', scale: 1.4 }
        },
        {
          name: '闭环任务',
          type: 'line',
          smooth: 0.32,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 5,
          data: d.resolved,
          lineStyle: { width: 1.7, color: '#35e0ff', shadowBlur: 10, shadowColor: 'rgba(53, 224, 255, .38)' },
          itemStyle: { color: '#35e0ff', borderColor: '#031225', borderWidth: 1 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(53, 224, 255, 0.14)' },
              { offset: 1, color: 'rgba(53, 224, 255, 0)' }
            ])
          },
          emphasis: { focus: 'series', scale: 1.4 }
        }
      ]
    };
  }

  function renderTrend(key) {
    const d = TREND[key];
    const days = key === '30' ? 30 : 7;
    const net = (d.newTotal - d.doneTotal) / days;
    $('#trendNew').textContent = (d.newTotal / days).toFixed(1);
    $('#trendDone').textContent = (d.doneTotal / days).toFixed(1);
    const netEl = document.getElementById('trendNet');
    if (netEl) netEl.textContent = (net >= 0 ? '+' : '') + net.toFixed(1);

    const summary = $('.trend-summary');
    const cells = $$('div', summary);
    cells[0].querySelector('em').textContent = d.newDelta;
    cells[1].querySelector('em').textContent = d.doneDelta;

    if (ticketChart) {
      ticketChart.setOption(trendOption(key), { notMerge: true });
    }
  }

  /* ── event stream ──────────────────────────── */
  const eventList = $('#eventList');
  let eventFilter = 'all';
  let live = true;

  const atMinutesAgo = minutes => {
    const d = new Date(Date.now() - minutes * 60000);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const events = [
    { time: atMinutesAgo(2), level: 'P2', svc: '工单中心', desc: 'API 响应时间超过阈值，已自动扩容', status: '处理中', cls: 'processing' },
    { time: atMinutesAgo(5), level: 'P3', svc: '知识库', desc: '索引重建任务延迟 4 分钟', status: '已恢复', cls: 'resolved' },
    { time: atMinutesAgo(9), level: 'P2', svc: '数据中台', desc: '查询队列积压，限流策略已生效', status: '监控中', cls: 'watching' },
    { time: atMinutesAgo(14), level: 'P2', svc: '统一认证', desc: '单点登录平均耗时升至 320ms', status: '处理中', cls: 'processing' },
    { time: atMinutesAgo(22), level: 'P3', svc: '报表服务', desc: '离线任务重试成功，数据已补齐', status: '已恢复', cls: 'resolved' },
    { time: atMinutesAgo(32), level: 'P2', svc: '网络出口', desc: '华东出口丢包率 0.8%，路由已切换', status: '已恢复', cls: 'resolved' }
  ];

  const eventPool = [
    { level: 'P2', svc: '工单中心', desc: '批量工单同步延迟，重试队列已接管', status: '处理中', cls: 'processing' },
    { level: 'P3', svc: 'CMDB', desc: '配置项差异扫描完成，修正 12 条', status: '已恢复', cls: 'resolved' },
    { level: 'P2', svc: '监控告警', desc: '指标写入抖动，已切换备用通道', status: '监控中', cls: 'watching' },
    { level: 'P3', svc: '自动化平台', desc: '巡检脚本执行超时，自动重试成功', status: '已恢复', cls: 'resolved' },
    { level: 'P2', svc: '数据中台', desc: '慢查询占比升至 4.2%，已临时扩容', status: '处理中', cls: 'processing' },
    { level: 'P3', svc: '知识库', desc: '附件检索耗时升高，缓存已预热', status: '已恢复', cls: 'resolved' },
    { level: 'P2', svc: '服务台', desc: '会话排队数超过 20，已增派坐席', status: '待响应', cls: 'waiting' }
  ];

  function renderEvents() {
    if (!eventList) return;
    const filtered = eventFilter === 'all'
      ? events
      : events.filter(e => e.level.toLowerCase() === eventFilter);
    const visible = filtered.slice(0, 6);

    if (!visible.length) {
      eventList.innerHTML = '<div class="ev-empty"><i></i>当前筛选下暂无事件 · 运行平稳</div>';
      return;
    }

    eventList.innerHTML = visible.map(e => `
      <div class="ev-row${e.fresh ? ' is-new' : ''}">
        <span class="ev-time">${e.time}</span>
        <span class="pill ${e.level.toLowerCase()}">${e.level}</span>
        <span class="ev-svc">${e.svc}</span>
        <span class="ev-desc">${e.desc}</span>
        <span class="ev-status ${e.cls}">${e.status}</span>
      </div>`).join('');
  }
  renderEvents();

  const eventTabs = $('#eventTabs');
  if (eventTabs) {
    eventTabs.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      $$('button', eventTabs).forEach(b => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      eventFilter = btn.dataset.filter;
      renderEvents();
    });
  }

  let lastPoolIndex = -1;
  function addEvent() {
    let idx = Math.floor(Math.random() * eventPool.length);
    if (eventPool.length > 1 && idx === lastPoolIndex) idx = (idx + 1) % eventPool.length;
    lastPoolIndex = idx;
    const pick = eventPool[idx];
    const now = new Date();
    events.forEach(e => { delete e.fresh; });
    events.unshift({ ...pick, time: `${pad(now.getHours())}:${pad(now.getMinutes())}`, fresh: true });
    if (events.length > 14) events.length = 14;
    renderEvents();
  }

  /* ── resource load jitter ──────────────────── */
  const RES_BASE = { cpu: 42.6, mem: 68.2, disk: 74.1, net: 31.8 };
  const resState = { ...RES_BASE };

  function paintResources() {
    Object.entries(resState).forEach(([key, value]) => {
      const row = $(`.res-row[data-res="${key}"]`);
      if (!row) return;
      const bar = $('.res-track i', row);
      const num = $('.res-top b em', row);
      const pct = value.toFixed(1);
      bar.style.width = `${value}%`;
      num.textContent = pct;
      row.classList.toggle('is-warn', value >= 70 && value < 85);
      row.classList.toggle('is-crit', value >= 85);
    });
  }

  function jitterResources() {
    Object.keys(RES_BASE).forEach(key => {
      const base = RES_BASE[key];
      const range = key === 'disk' ? 1.4 : 3.2;
      const drift = (Math.random() - 0.48) * range;
      const floor = key === 'disk' ? 66 : 22;
      const ceil = key === 'disk' ? 86 : 82;
      resState[key] = clamp(resState[key] + drift, floor, ceil);
      if (Math.random() < 0.25) resState[key] = clamp(resState[key] + (base - resState[key]) * 0.35, floor, ceil);
    });
    paintResources();
  }
  paintResources();

  /* ── live / pause toggle ───────────────────── */
  const liveToggle = $('#liveToggle');
  const liveChip = $('#liveChip');
  const liveLabel = $('#liveLabel');
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="6" width="3.2" height="12"/><rect x="13.8" y="6" width="3.2" height="12"/></svg>';
  const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="play" d="M9 6.2v11.6L18 12z"/></svg>';

  function paintLiveControl() {
    if (!liveToggle) return;
    liveToggle.innerHTML = live ? ICON_PAUSE : ICON_PLAY;
    liveToggle.title = live ? '暂停实时数据' : '恢复实时数据';
    liveToggle.setAttribute('aria-label', live ? '暂停实时数据' : '恢复实时数据');
    liveToggle.classList.toggle('is-paused', !live);
    liveToggle.setAttribute('aria-pressed', String(!live));
    liveChip.classList.toggle('is-paused', !live);
    liveLabel.textContent = live ? '任务态势' : '任务态势已暂停';
    stage.classList.toggle('is-paused', !live);
    document.dispatchEvent(new CustomEvent('ito:livechange', { detail: { live } }));
  }

  if (liveToggle) {
    liveToggle.addEventListener('click', () => {
      live = !live;
      paintLiveControl();
      if (live) {
        jitterResources();
      }
    });
  }
  paintLiveControl();

  /* ── fullscreen ────────────────────────────── */
  const fsBtn = $('#fsBtn');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    });
    document.addEventListener('fullscreenchange', fitStage);
  }

  /* ── topology tooltip ──────────────────────── */
  const tip = $('#topoTip');
  function positionTip(ev) {
    if (!tip) return;
    const pad = 16;
    const rect = tip.getBoundingClientRect();
    let x = ev.clientX + pad;
    let y = ev.clientY + pad;
    if (x + rect.width > window.innerWidth - 8) x = ev.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - 8) y = ev.clientY - rect.height - pad;
    tip.style.left = `${Math.max(8, x)}px`;
    tip.style.top = `${Math.max(8, y)}px`;
  }

  $$('.node').forEach(node => {
    const data = node.dataset;
    const isWarn = node.classList.contains('status-warn');
    const isCrit = node.classList.contains('status-crit');
    const stateCls = isCrit ? 'crit' : isWarn ? 'warn' : '';

    node.addEventListener('pointerenter', ev => {
      tip.innerHTML = `
        <div class="tt-top">
          <span class="tt-name">${data.name}</span>
          <span class="tt-state ${stateCls}">${data.status}</span>
        </div>
        <div class="tt-row"><span>请求量</span><b>${data.req}</b></div>
        <div class="tt-row"><span>P95 时延</span><b>${data.lat}</b></div>
        <div class="tt-row"><span>责任团队</span><b>${data.owner}</b></div>`;
      tip.classList.add('is-visible');
      tip.setAttribute('aria-hidden', 'false');
      positionTip(ev);
    });
    node.addEventListener('pointermove', positionTip);
    node.addEventListener('pointerleave', () => {
      tip.classList.remove('is-visible');
      tip.setAttribute('aria-hidden', 'true');
    });
  });

  /* ── ticker seamless loop ──────────────────── */
  const tickerTrack = $('#tickerTrack');
  if (tickerTrack) {
    const speed = 46; // px / second
    tickerTrack.innerHTML += tickerTrack.innerHTML;
    const distance = tickerTrack.scrollWidth / 2;
    tickerTrack.style.animationDuration = `${Math.max(28, distance / speed)}s`;
    tickerTrack.style.animationPlayState = 'running';
  }

  /* ── timers ────────────────────────────────── */
  setInterval(() => { if (live) addEvent(); }, 9000);
  setInterval(() => { if (live) jitterResources(); }, 6000);

  /* ── boot charts ───────────────────────────── */
  function initChart() {
    if (!chartEl || typeof echarts === 'undefined') return;
    ticketChart = echarts.init(chartEl, null, { renderer: 'canvas' });
    renderTrend('30');

    const tabs = $('#trendTabs');
    tabs?.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      $$('button', tabs).forEach(b => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      renderTrend(btn.dataset.range);
    });

    window.addEventListener('resize', () => ticketChart?.resize());
    setTimeout(() => ticketChart?.resize(), 350);
  }

  /* ── drill-down ────────────────────────────── */
  function drillFrom(el) {
    const route = el && el.getAttribute('data-drill');
    if (!route) return;
    const query = el.getAttribute('data-query');
    location.href = 'admin.html#/' + route + (query ? '?' + query : '');
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-drill]');
    if (!el) return;
    drillFrom(el);
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest && e.target.closest('[data-drill]');
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    drillFrom(el);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChart);
  } else {
    initChart();
  }
})();
