/* ─────────────────────────────────────────────
   page · dashboard
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const P = (window.ITO_PAGES = window.ITO_PAGES || {});
  const D = window.ITO_DATA;

  function spark(values, color) {
    const w = 82, h = 30, pad = 3;
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);
    const span = (max - min) || 1;
    const pts = values.map(function (v, i) {
      return [pad + i * (w - pad * 2) / (values.length - 1), h - pad - ((v - min) / span) * (h - pad * 2)];
    });
    const line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    const area = line + ' L' + (w - pad) + ' ' + h + ' L' + pad + ' ' + h + ' Z';
    return '<svg class="kpi-spark" viewBox="0 0 82 30" preserveAspectRatio="none" aria-hidden="true">' +
      '<path class="area" d="' + area + '" fill="' + color + '1f"></path>' +
      '<path class="line" d="' + line + '" stroke="' + color + '"></path></svg>';
  }

  function kpi(o) {
    return '<article class="card kpi-card" data-tone="' + (o.tone || '') + '">' +
      '<div class="kpi-label">' + ITO.ui.icon(o.icon) + '<span>' + o.label + '</span></div>' +
      '<div class="kpi-value">' + o.value + (o.unit ? '<span class="unit">' + o.unit + '</span>' : '') + '</div>' +
      '<div class="kpi-meta">' + o.meta + '</div>' +
      (o.spark || '') +
      '</article>';
  }

  function reportHtml() {
    const S = ITO.state;
    const m = S.metrics;
    const E = ITO.ui.esc;
    const rows = [];
    S.tasks.forEach(function (t) {
      t.subs.forEach(function (s) {
        rows.push('<tr><td>' + E(s.id) + '</td><td>' + E(t.name + ' / ' + s.name) + '</td><td>' +
          E((ITO.getGroup(s.group) || {}).name) + '</td><td>' + E(s.owner) + '</td><td>' + E(s.status) +
          '</td><td>' + s.progress + '%</td><td>' + E(s.due) + '</td></tr>');
      });
    });

    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>ITO 运维月报 · 2026 年 10 月</title>' +
      '<style>body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#1D1D1F;margin:0;padding:48px;background:#F5F4F2}' +
      '.sheet{max-width:980px;margin:0 auto;background:#fff;border-radius:18px;padding:48px 52px;box-shadow:0 20px 60px rgba(0,0,0,.08)}' +
      'h1{font-size:30px;margin:0;letter-spacing:-.02em}h2{font-size:16px;margin:36px 0 12px;padding-bottom:8px;border-bottom:1px solid #eee}' +
      '.sub{color:#8A8A8E;font-size:12px;margin-top:8px}table{width:100%;border-collapse:collapse;font-size:12px}' +
      'th{text-align:left;color:#8A8A8E;font-weight:600;padding:9px 10px;background:#F7F6F4;border-bottom:1px solid #eee}' +
      'td{padding:9px 10px;border-bottom:1px solid #f1f1f1;color:#4A4A4F}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:24px}' +
      '.kpi{background:#FFF7F2;border:1px solid #FFE2D2;border-radius:12px;padding:16px}.kpi b{display:block;font-size:26px;letter-spacing:-.03em}' +
      '.kpi span{display:block;font-size:10px;color:#8A8A8E;margin-top:4px}.foot{margin-top:40px;font-size:10px;color:#AEAEB2;display:flex;justify-content:space-between}' +
      '</style></head><body><div class="sheet">' +
      '<h1>ITO 运维月报</h1><div class="sub">统计周期 2026-10-01 至 2026-10-31 · 华东区 SHA-01 · 生成于 ' + S.logs[0].time + '</div>' +
      '<div class="kpis"><div class="kpi"><b>' + m.active + '</b><span>期末在办任务</span></div>' +
      '<div class="kpi"><b>' + m.closed + '</b><span>近 30 天已闭环</span></div>' +
      '<div class="kpi"><b>' + m.onTimeRate + '%</b><span>按期闭环率</span></div>' +
      '<div class="kpi"><b>' + m.sla + '%</b><span>任务 SLA 达成率</span></div></div>' +
      '<h2>任务口径</h2><table><thead><tr><th>指标</th><th>数值</th><th>说明</th></tr></thead><tbody>' +
      '<tr><td>期初积压</td><td>' + m.openingBacklog + ' 件</td><td>2026-10-01 00:00 时点在办</td></tr>' +
      '<tr><td>本月新增</td><td>' + m.newTasks + ' 件</td><td>含自动生成整改任务</td></tr>' +
      '<tr><td>本月完成</td><td>' + m.closed + ' 件</td><td>验收通过并归档</td></tr>' +
      '<tr><td>期末在办</td><td>' + m.active + ' 件</td><td>期初 + 新增 − 完成</td></tr>' +
      '<tr><td>超期任务</td><td>' + ITO.counts.overdueCount() + ' 件</td><td>当前时点已超过截止时间</td></tr>' +
      '</tbody></table>' +
      '<h2>专业组在办分布</h2><table><thead><tr><th>专业组</th><th>在办</th><th>负责人</th></tr></thead><tbody>' +
      S.groups.map(function (g) {
        return '<tr><td>' + E(g.name) + '</td><td>' + (m.groupActive[g.id] || 0) + ' 件</td><td>' + E(g.manager) + '</td></tr>';
      }).join('') +
      '</tbody></table>' +
      '<h2>任务明细</h2><table><thead><tr><th>子任务</th><th>名称</th><th>专业组</th><th>负责人</th><th>状态</th><th>进度</th><th>截止</th></tr></thead><tbody>' +
      rows.join('') + '</tbody></table>' +
      '<div class="foot"><span>ITO 运维中心 · 管理后台自动生成</span><span>演示数据，仅用于产品演示</span></div>' +
      '</div></body></html>';
  }

  P.dashboard = {
    render: function () {
      const S = ITO.state;
      const U = ITO.ui;
      const m = S.metrics;
      const overdue = ITO.counts.overdueCount();
      const highRisk = (function () {
        let n = 0;
        S.tasks.forEach(function (t) { t.subs.forEach(function (s) { if (U.isOverdue(s) && s.level === '紧急') n += 1; }); });
        return n;
      })();
      const today = S.duty.week[S.duty.todayIndex];
      const unread = S.messages.filter(function (x) { return !x.read; });
      const canCreate = ITO.can('tasks') && (S.role === 'leader' || S.role === 'manager');

      const trendSub = '期初积压 <b>' + m.openingBacklog + '</b> + 新增 <b>' + m.newTasks + '</b> − 完成 <b>' + m.closed + '</b> = 在办 <b>' + m.active + '</b>';

      const recent = D.activity.map(function (a) {
        return '<tr>' +
          '<td class="num muted" style="white-space:nowrap">' + U.shortDate(a.time) + '</td>' +
          '<td><div class="cell-task"><b>' + U.esc(a.task) + '</b><small>' + U.esc(a.sub) + '</small></div></td>' +
          '<td>' + U.groupPill(a.group) + '</td>' +
          '<td style="white-space:nowrap">' + U.avatar(a.owner, true) + U.esc(a.owner) + '</td>' +
          '<td>' + U.badge(a.status) + '</td></tr>';
      }).join('');

      const msgRows = (unread.length ? unread : S.messages.slice(0, 3)).slice(0, 3).map(function (msg) {
        return '<div class="mini-row"><span class="dot"></span><div class="txt"><b>' + U.esc(msg.title) + '</b>' +
          '<span>' + U.esc(msg.type) + ' · ' + U.shortDate(msg.time) + '</span></div>' +
          '<span class="time">' + (msg.read ? '已读' : '未读') + '</span></div>';
      }).join('');

      const dutyLine = function (label, names) {
        return '<div class="duty-line"><span>' + label + '</span><div>' +
          names.map(function (n) { return '<span class="duty-person">' + U.avatar(n, true) + U.esc(n) + '</span>'; }).join('') +
          '</div></div>';
      };

      return U.pageHead({
        title: '运维驾驶舱',
        sub: '2026 年 11 月 1 日 · 全局任务、专业组负荷与今日值班 · 数据截至 20:56',
        actions:
          '<button class="btn btn-ghost" id="exportReportBtn" type="button">' + U.icon('download') + '导出月报</button>' +
          (canCreate ? '<button class="btn btn-primary" id="newTaskBtn" type="button">' + U.icon('plus') + '新建任务</button>' : '')
      }) +

      '<div class="kpi-grid">' +
        kpi({ label: '在办任务', icon: 'task', value: m.active, unit: '件', tone: '', spark: spark(S.trend.newTasks.slice(-12), '#EB612A'),
          meta: '<span class="delta up">+12%</span><span>环比上月</span>' }) +
        kpi({ label: '近 30 天已闭环', icon: 'check', value: m.closed, unit: '件', tone: 'green', spark: spark(S.trend.completed.slice(-12), '#1FAE5C'),
          meta: '<span>按期闭环率</span><b class="meta-strong">' + m.onTimeRate.toFixed(1) + '%</b>' }) +
        kpi({ label: '超期任务', icon: 'clock', value: overdue, unit: '件', tone: 'red', spark: spark([4, 5, 4, 5, 6, 5, 6, 7, 6, 7, 7, overdue], '#E5484D'),
          meta: '<span class="delta warn">高风险 ' + highRisk + ' 项</span><span>需今日跟进</span>' }) +
        kpi({ label: '任务 SLA 达成率', icon: 'shield', value: m.sla, unit: '%', tone: 'blue', spark: spark([95.1, 95.4, 95.2, 95.8, 96.0, 95.9, 96.1, 96.2], '#0A72E8'),
          meta: '<span class="delta up">+2.1%</span><span>环比上月</span>' }) +
      '</div>' +

      '<div class="dash-grid">' +
        '<section class="card chart-card">' +
          '<div class="chart-head">' +
            '<div><h3 class="chart-title">任务趋势</h3><p class="chart-sub">' + trendSub + '</p></div>' +
            '<div class="chart-legend">' +
              '<span><i style="background:#EB612A"></i>新增</span>' +
              '<span><i style="background:#0A72E8"></i>完成</span>' +
              '<span class="tabs" style="margin-left:4px"><button class="tab active" data-range="30" type="button">30 天</button><button class="tab" data-range="7" type="button">7 天</button></span>' +
            '</div>' +
          '</div>' +
          '<div class="chart-body" id="trendChart"></div>' +
        '</section>' +

        '<section class="card chart-card">' +
          '<div class="chart-head">' +
            '<div><h3 class="chart-title">专业组在办分布</h3><p class="chart-sub">合计 ' + m.active + ' 件 · 较上月 +12%</p></div>' +
            '<span class="head-tag">LOAD</span>' +
          '</div>' +
          '<div class="donut-wrap">' +
            '<div class="chart-body donut" id="groupChart"></div>' +
            '<div class="donut-center"><b>' + m.active + '</b><span>IN PROGRESS</span></div>' +
          '</div>' +
          '<div class="group-legend">' +
            S.groups.map(function (g) {
              const v = m.groupActive[g.id] || 0;
              const pct = Math.round(v / m.active * 100);
              return '<div><i style="background:' + g.color + '"></i>' + g.name + '<b>' + v + ' <span class="legend-pct">' + pct + '%</span></b></div>';
            }).join('') +
          '</div>' +
        '</section>' +
      '</div>' +

      '<div class="dash-bottom">' +
        '<section class="card table-card">' +
          '<div class="table-head"><div><h3>实时任务动态</h3><p class="table-note">最近 6 条状态流转 · 自动刷新</p></div>' +
            '<div class="table-head-actions"><a class="btn btn-ghost btn-sm" href="#/tasks">查看全部' + U.icon('arrow') + '</a></div></div>' +
          '<table class="data-table"><thead><tr><th>时间</th><th>任务 / 子任务</th><th>专业组</th><th>执行人</th><th>状态</th></tr></thead>' +
          '<tbody>' + recent + '</tbody></table>' +
        '</section>' +

        '<div class="side-stack">' +
          '<section class="card mini-card">' +
            '<div class="mini-head"><h3>今日值班</h3><a href="#/duty">排班表' + U.icon('arrow') + '</a></div>' +
            '<div class="duty-today">' + U.avatar(today.manager) +
              '<div><b>' + U.esc(today.manager) + '</b><span>值班主管 · ' + U.esc(today.weekday) + ' ' + U.esc(today.date) + '</span></div>' +
              U.badge('在岗', 'green') + '</div>' +
            dutyLine('白班', today.day) +
            dutyLine('夜班', today.night) +
            dutyLine('备班', [today.backup]) +
          '</section>' +

          '<section class="card mini-card">' +
            '<div class="mini-head"><h3>待处理消息</h3><a href="#/messages">全部消息' + U.icon('arrow') + '</a></div>' +
            '<div class="mini-list">' + msgRows + '</div>' +
            '<div class="mini-foot"><span>未读 <b>' + unread.length + '</b> 条</span><a class="link-btn" href="#/messages">立即处理</a></div>' +
          '</section>' +
        '</div>' +
      '</div>';
    },

    after: function () {
      const S = ITO.state;
      const U = ITO.ui;

      function trendOption(days) {
        const labels = S.trend.daily.slice(-days);
        const added = S.trend.newTasks.slice(-days);
        const done = S.trend.completed.slice(-days);
        return {
          color: ['#EB612A', '#0A72E8'],
          tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(29,29,31,.92)',
            borderWidth: 0,
            padding: [9, 12],
            textStyle: { color: '#fff', fontSize: 11 },
            axisPointer: { type: 'line', lineStyle: { color: 'rgba(235,97,42,.35)', type: 'dashed' } }
          },
          grid: { left: 6, right: 14, top: 22, bottom: 4, containLabel: true },
          xAxis: {
            type: 'category',
            boundaryGap: false,
            data: labels,
            axisLine: { lineStyle: { color: 'rgba(29,29,31,.10)' } },
            axisTick: { show: false },
            axisLabel: { color: '#AEAEB2', fontSize: 9, interval: days > 10 ? 4 : 0, margin: 10 }
          },
          yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(29,29,31,.055)', type: 'dashed' } },
            axisLabel: { color: '#AEAEB2', fontSize: 9 },
            axisLine: { show: false },
            axisTick: { show: false }
          },
          series: [
            {
              name: '新增', type: 'line', smooth: 0.32, symbol: 'none', data: added,
              lineStyle: { width: 2 },
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(235,97,42,.18)' },
                  { offset: 1, color: 'rgba(235,97,42,0)' }
                ])
              }
            },
            {
              name: '完成', type: 'line', smooth: 0.32, symbol: 'none', data: done,
              lineStyle: { width: 2 }
            }
          ]
        };
      }

      const trendChart = U.chart('trendChart', trendOption(30));

      U.chart('groupChart', {
        tooltip: {
          trigger: 'item',
          backgroundColor: 'rgba(29,29,31,.92)',
          borderWidth: 0,
          padding: [8, 11],
          textStyle: { color: '#fff', fontSize: 11 },
          formatter: '{b}<br/>{c} 件 · {d}%'
        },
        series: [{
          type: 'pie',
          radius: ['60%', '80%'],
          center: ['50%', '48%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 3 },
          label: { show: false },
          emphasis: { scale: true, scaleSize: 4, label: { show: false } },
          data: S.groups.map(function (g) {
            return { name: g.name, value: S.metrics.groupActive[g.id] || 0, itemStyle: { color: g.color } };
          })
        }]
      });

      ITO.ui.$$('.tab[data-range]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          ITO.ui.$$('.tab[data-range]').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          if (trendChart) trendChart.setOption(trendOption(Number(btn.dataset.range)), true);
        });
      });

      const exportBtn = document.getElementById('exportReportBtn');
      if (exportBtn) {
        exportBtn.addEventListener('click', function () {
          ITO.ui.download('ITO运维月报-2026-10.html', reportHtml(), 'text/html;charset=utf-8');
          ITO.log('导出运维月报', '2026 年 10 月', '报表');
          ITO.ui.toast('10 月运维月报已导出');
        });
      }

      const newBtn = document.getElementById('newTaskBtn');
      if (newBtn) {
        newBtn.addEventListener('click', function () {
          if (ITO.taskActions) ITO.taskActions.newTask();
        });
      }
    }
  };
})();

