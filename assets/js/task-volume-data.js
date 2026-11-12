/* ─────────────────────────────────────────────
   ITO OPS · task volume demo data
   Adds 2026-07 .. 2026-11 monthly task volume,
   renumbers task IDs, and derives the November
   cockpit dashboard from the generated tasks.
   Names and sites are simulated; no source PII.
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const D = window.ITO_DATA;
  if (!D || !Array.isArray(D.tasks) || !Array.isArray(D.staff)) return;

  const MONTHS = [
    { key: '2026-07', count: 682 },
    { key: '2026-08', count: 718 },
    { key: '2026-09', count: 704 },
    { key: '2026-10', count: 722, existing: true },
    { key: '2026-11', count: 698, current: true }
  ];

  const pad2 = n => String(n).padStart(2, '0');
  const pad4 = n => String(n).padStart(4, '0');
  const parse = s => new Date(String(s || '').replace(/-/g, '/'));
  const dayKey = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const dateTime = d => dayKey(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  const demoNow = parse(D.meta.demoNow);
  const todayKey = D.meta.today;

  function mulberry32(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pick(rng, list) {
    return list[Math.floor(rng() * list.length) % list.length];
  }

  function weighted(rng, list) {
    const total = list.reduce((n, x) => n + x[1], 0);
    let r = rng() * total;
    for (let i = 0; i < list.length; i += 1) {
      r -= list[i][1];
      if (r <= 0) return list[i][0];
    }
    return list[list.length - 1][0];
  }

  const groupIds = ['app', 'comm', 'online', 'infra'];
  const staffByGroup = {};
  groupIds.forEach(id => { staffByGroup[id] = []; });
  D.staff.forEach(p => {
    if (!staffByGroup[p.group]) staffByGroup[p.group] = [];
    staffByGroup[p.group].push(p);
  });
  const managers = {};
  groupIds.forEach(id => {
    const g = (D.groups || []).find(x => x.id === id);
    managers[id] = (g && g.manager) || (staffByGroup[id][0] || {}).name || '赵主管';
  });
  const meetingPeople = (staffByGroup.comm || []).filter(p => p.name.indexOf('主管') === -1);
  const meetingPool = meetingPeople.length ? meetingPeople : D.staff.filter(p => p.name.indexOf('主管') === -1);

  const SYSTEMS = ['KCC', 'KNS', 'DTW', 'DTP', 'KSM', 'DKM', 'KDN', '核心交换机', '防火墙', 'UPS', '空调', '语音网关', '数据库', '监控平台', '办公终端', '存储阵列'];
  const AREAS = ['A基地', 'B基地', 'C基地', '核心机房', '一区', '二区', '办公区', '生产区'];

  const SOURCES = ['会议行动', '专业任务', '程序升版', '质量自查', '安全检查', '应急演练', '年度重点工作', '变更管理', '任务督办', '外部反馈'];

  const MEETING_NAMES = [
    '生产早会', '大修早会', '周例会', '专项协调会', '技术评审会', '安全质量会',
    '项目推进会', '应急演练准备会', '网络安全专题会', '设备缺陷分析会',
    '变更评审会', '月度经营分析会', '运行分析会', '承包商协调会',
    '系统接口评审会', '数据质量会', '机房改造协调会', '通信保障会',
    '监控告警复盘会', '年度计划会', '预算评审会', '采购协调会',
    '培训宣贯会', '事故复盘会', '检查组反馈会', '领导小组会',
    '专业组周会', '生产管理周会', '大修管理周会', '信息安全例会'
  ];

  const MEETING_NOTES = [
    '投影切换延迟 5 分钟，已切换备用通道',
    '远程终端音频异常，已切换备用终端',
    '会议材料临时更新，已重新投屏',
    '网络抖动约 2 分钟，已恢复',
    '录播设备未启动，已人工补录'
  ];

  const TASK_TEMPLATES = [
    { type: '巡检', name: '完成{area}{system}巡检与隐患整改', standard: '按巡检标准完成现场检查，异常项登记并闭环。', progress: '已完成现场巡检，异常项已登记并转整改。' },
    { type: '巡检', name: '完成{system}运行状态与告警核查', standard: '核查设备运行状态、告警记录和备份有效性。', progress: '已完成运行状态核查，告警记录已复核。' },
    { type: '巡检', name: '完成{area}终端与网络抽检', standard: '抽检终端安全基线、网络端口和接入规范。', progress: '已完成终端与网络抽检，问题终端已登记。' },
    { type: '巡检', name: '完成{system}日志巡检与异常分析', standard: '检查近 7 天日志，异常事件逐条确认。', progress: '已完成日志巡检，异常事件已确认。' },
    { type: '巡检', name: '完成{area}消防与动环设施巡检', standard: '检查消防、温湿度、漏水与门禁状态。', progress: '已完成动环设施巡检，读数正常。' },
    { type: '巡检', name: '完成{system}账号权限抽检', standard: '核对账号归属、权限范围和离岗清理情况。', progress: '已完成权限抽检，异常账号已登记。' },

    { type: '变更', name: '完成{system}版本升级与回退验证', standard: '完成方案评审、实施、回退验证并提交报告。', progress: '已完成升级，回退验证通过。' },
    { type: '变更', name: '完成{area}链路割接方案编制', standard: '明确割接路径、窗口、回退步骤和责任人。', progress: '割接方案已评审，等待实施窗口。' },
    { type: '变更', name: '完成{system}防火墙策略调整', standard: '策略变更经审批，实施后完成连通性验证。', progress: '策略已调整，关键业务验证通过。' },
    { type: '变更', name: '完成{system}配置参数优化', standard: '按优化方案调整参数并观察 24 小时。', progress: '参数已调整，运行指标平稳。' },
    { type: '变更', name: '完成{area}网络设备替换', standard: '完成备件检查、替换、配置恢复与业务验证。', progress: '设备已替换，业务验证通过。' },
    { type: '变更', name: '完成{system}存储扩容', standard: '扩容前完成容量评估，扩容后验证冗余。', progress: '扩容已完成，容量与冗余正常。' },

    { type: '开发', name: '完成{system}接口性能优化', standard: '完成瓶颈分析、优化、压测和上线验证。', progress: '接口优化已完成，压测指标达标。' },
    { type: '开发', name: '完成{area}监测数据补录工具', standard: '工具支持批量补录、校验和失败重试。', progress: '工具已上线，补录任务完成。' },
    { type: '开发', name: '完成{system}报表需求开发', standard: '按需求完成开发、测试和用户验收。', progress: '报表已发布，用户验收通过。' },
    { type: '开发', name: '完成{system}告警规则配置', standard: '规则覆盖关键指标，误报率控制在目标内。', progress: '规则已上线，误报率持续观察。' },
    { type: '开发', name: '完成{system}数据质量核查脚本', standard: '脚本覆盖完整性、唯一性和时效性检查。', progress: '脚本已运行，异常数据已输出。' },
    { type: '开发', name: '完成{area}巡检移动端功能', standard: '支持扫码、拍照、异常上报和离线缓存。', progress: '功能已发布，试点班组反馈正常。' },

    { type: '维保', name: '完成{area}{system}季度维保', standard: '按厂商手册完成保养、测试和记录归档。', progress: '季度维保完成，记录已归档。' },
    { type: '维保', name: '完成{system}电池组放电测试', standard: '完成放电、内阻检测和容量评估。', progress: '放电测试完成，容量满足要求。' },
    { type: '维保', name: '完成{area}空调滤网清洗', standard: '完成滤网清洗、排水检查和运行观察。', progress: '滤网已清洗，运行参数正常。' },
    { type: '维保', name: '完成{system}固件评估与升级', standard: '评估固件风险，升级后完成倒换验证。', progress: '固件已升级，倒换验证通过。' },
    { type: '维保', name: '完成{area}UPS 巡检与保养', standard: '检查输入输出、旁路、电池和告警状态。', progress: 'UPS 巡检完成，告警已清零。' },
    { type: '维保', name: '完成{system}备份有效性验证', standard: '抽取备份集完成恢复验证并记录结果。', progress: '备份恢复验证通过。' },

    { type: '操作', name: '完成{system}权限与账号核对', standard: '核对账号、角色、权限和离岗状态。', progress: '账号权限核对完成，异常项已处理。' },
    { type: '操作', name: '完成{area}会议保障与技术支持', standard: '会前联调、会中保障、会后复位并记录。', progress: '会议保障完成，音视频与网络正常。' },
    { type: '操作', name: '完成{system}配置备份与恢复验证', standard: '完成配置导出、归档和抽样恢复。', progress: '配置备份完成，抽样恢复通过。' },
    { type: '操作', name: '完成{system}告警处置与闭环', standard: '按告警等级响应，处置结果记录闭环。', progress: '告警已处置，业务恢复正常。' },
    { type: '操作', name: '完成{area}终端安全基线整改', standard: '完成补丁、杀毒、外设和账号基线整改。', progress: '基线整改完成，复测通过。' },
    { type: '操作', name: '完成{system}巡检数据补录', standard: '补齐缺失记录，完成系统与台账核对。', progress: '数据补录完成，账实一致。' },

    { type: '综合', name: '完成{area}运维台账季度核对', standard: '核对任务、巡检、维保和值班台账。', progress: '台账核对完成，差异项已修正。' },
    { type: '综合', name: '完成{system}需求评审与上线', standard: '完成需求评审、测试、上线和回退准备。', progress: '需求已上线，回退包已留存。' },
    { type: '综合', name: '完成{area}应急演练组织', standard: '完成演练方案、脚本、实施和总结。', progress: '演练完成，问题项已登记。' },
    { type: '综合', name: '完成{system}安全检查整改', standard: '按检查问题清单完成整改和复核。', progress: '整改完成，复核通过。' },
    { type: '综合', name: '完成{area}运维数据质量提升', standard: '完成数据清理、校验和责任人确认。', progress: '数据质量提升完成，指标达标。' },
    { type: '综合', name: '完成{system}运行分析报告', standard: '汇总可用性、容量、告警和变更情况。', progress: '运行分析报告已提交。' }
  ];

  const TASK_TYPES = ['巡检', '变更', '开发', '维保', '操作', '其他'];
  const TYPE_WEIGHTS = [['巡检', 30], ['变更', 22], ['开发', 18], ['维保', 14], ['操作', 10], ['综合', 6]];
  const TYPE_GROUP = {
    '巡检': ['infra', 'comm', 'online'],
    '变更': ['app', 'comm', 'infra'],
    '开发': ['app'],
    '维保': ['infra', 'comm'],
    '操作': ['online', 'comm', 'app'],
    '综合': ['app', 'comm', 'online', 'infra']
  };
  const TAG_BY_GROUP = {
    app: ['KCC', 'KNS', '移动终端设备'],
    comm: ['KNS', '机房'],
    online: ['移动终端设备', '机房'],
    infra: ['机房']
  };

  function monthInfo(key) {
    const parts = key.split('-');
    return { year: Number(parts[0]), month: Number(parts[1]) };
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function randDay(rng, year, month) {
    return 1 + Math.floor(rng() * daysInMonth(year, month));
  }

  function at(year, month, day, hour, minute) {
    return new Date(year, month - 1, day, hour, minute, 0, 0);
  }

  function makeOwner(rng, group) {
    const list = staffByGroup[group] || D.staff;
    return pick(rng, list).name;
  }

  function makeTask(monthKey, rng, forcedType, forcedStatus) {
    const info = monthInfo(monthKey);
    const type = forcedType || weighted(rng, TYPE_WEIGHTS);
    const templates = TASK_TEMPLATES.filter(x => x.type === type);
    const tpl = pick(rng, templates.length ? templates : TASK_TEMPLATES);
    const system = pick(rng, SYSTEMS);
    const area = pick(rng, AREAS);
    const group = pick(rng, TYPE_GROUP[type] || groupIds);
    const owner = makeOwner(rng, group);
    const initiator = managers[group] || owner;
    const createdDay = randDay(rng, info.year, info.month);
    const createdHour = 8 + Math.floor(rng() * 10);
    const createdMinute = Math.floor(rng() * 60);
    const createdAt = at(info.year, info.month, createdDay, createdHour, createdMinute);
    const status = forcedStatus || weighted(rng, [['已完成', 80], ['执行中', 15], ['需关注', 5]]);
    const level = status === '需关注' ? '紧急' : weighted(rng, [['紧急', 10], ['重要', 35], ['一般', 55]]);
    const due = new Date(createdAt.getTime() + (2 + Math.floor(rng() * 14)) * 86400000);
    const progress = status === '已完成' ? 100 : 20 + Math.floor(rng() * 65);
    const name = tpl.name.replace(/\{system\}/g, system).replace(/\{area\}/g, area);
    const source = pick(rng, SOURCES);
    const tags = TAG_BY_GROUP[group] ? [pick(rng, TAG_BY_GROUP[group])] : [];
    const desc = tpl.standard + ' 来源：' + source + '。' + tpl.progress;
    return {
      id: '',
      name: name,
      group: group,
      owner: owner,
      initiator: initiator,
      level: level,
      type: type,
      due: dateTime(due),
      tags: tags,
      source: 'self',
      mode: 'single',
      desc: desc,
      subs: [],
      extra: {},
      draft: false,
      canceled: null,
      summaryRework: false,
      leaderApproval: null,
      status: status === '需关注' ? '执行中' : status,
      progress: progress,
      hours: 4 + Math.floor(rng() * 12),
      completedAt: status === '已完成' ? dateTime(new Date(due.getTime() - (1 + Math.floor(rng() * 8)) * 3600000)) : '',
      createdAt: dateTime(createdAt),
      createdBy: initiator,
      updatedAt: dateTime(createdAt),
      updatedBy: initiator,
      audit: [{ time: dateTime(createdAt), actor: initiator, action: '创建任务' }]
    };
  }

  function makeMeeting(monthKey, rng, forcedStatus) {
    const info = monthInfo(monthKey);
    const day = randDay(rng, info.year, info.month);
    const startHour = 8 + Math.floor(rng() * 9);
    const startMinute = pick(rng, [0, 15, 30, 45]);
    const duration = pick(rng, [0.5, 0.5, 1, 1, 1.5, 2, 2, 2.5, 3, 4]);
    const start = at(info.year, info.month, day, startHour, startMinute);
    const end = new Date(start.getTime() + duration * 3600000);
    const level = weighted(rng, [['一类会议', 16], ['二类会议', 38], ['三类会议', 46]]);
    const effect = rng() < 0.02 ? '异常' : '正常';
    const status = forcedStatus || (effect === '异常' ? '执行中' : '已完成');
    const owner = pick(rng, meetingPool).name;
    const initiator = pick(rng, Object.keys(managers).map(k => managers[k]));
    const created = new Date(end.getTime() + (0.2 + rng() * 1.5) * 3600000);
    const note = effect === '异常' ? pick(rng, MEETING_NOTES) : '';
    const taskLevel = level === '一类会议' ? '紧急' : level === '二类会议' ? '重要' : '一般';
    const meetingName = pick(rng, MEETING_NAMES);
    return {
      id: '',
      name: '会议保障｜' + meetingName,
      group: 'comm',
      owner: owner,
      initiator: initiator,
      level: taskLevel,
      type: '操作',
      due: dateTime(end),
      tags: [],
      source: 'self',
      mode: 'single',
      desc: level + ' · ' + dateTime(start) + ' 至 ' + dateTime(end).slice(11) + ' · ' + duration + 'h · ' + effect + (note ? '（' + note + '）' : ''),
      subs: [],
      extra: {},
      draft: false,
      canceled: null,
      summaryRework: false,
      leaderApproval: null,
      status: status,
      progress: status === '已完成' ? 100 : 60,
      hours: duration,
      completedAt: status === '已完成' ? dateTime(new Date(end.getTime() + (effect === '异常' ? 2 : 0) * 3600000)) : '',
      createdAt: dateTime(created),
      createdBy: initiator,
      updatedAt: dateTime(created),
      updatedBy: initiator,
      audit: [{ time: dateTime(created), actor: initiator, action: '创建任务' }]
    };
  }

  function buildMonth(monthKey, count, existing) {
    const rng = mulberry32(hash(monthKey));
    const info = monthInfo(monthKey);
    const items = existing ? existing.slice() : [];
    if (existing) {
      items.forEach(function (t, i) {
        if (!t.createdAt) t.createdAt = '2026-10-20 09:' + pad2(10 + (i % 40));
        t.updatedAt = t.updatedAt || t.createdAt;
      });
    }
    const newCount = existing ? count - items.length : count;
    const meetingCount = Math.round(newCount * 0.4);
    const taskCount = newCount - meetingCount;

    if (monthKey === '2026-11') {
      // November is the cockpit month: 279 meetings + 419 task records.
      // 9 meetings active; 229 task records active in the target type mix.
      for (let i = 0; i < 279; i += 1) items.push(makeMeeting(monthKey, rng, i < 9 ? '执行中' : '已完成'));
      const activeTypes = [
        ['巡检', 80], ['变更', 55], ['开发', 40], ['维保', 30], ['综合', 24]
      ];
      activeTypes.forEach(function (pair) {
        for (let i = 0; i < pair[1]; i += 1) items.push(makeTask(monthKey, rng, pair[0], '执行中'));
      });
      const completedTypes = [
        ['巡检', 57], ['变更', 42], ['开发', 34], ['维保', 29], ['操作', 18], ['综合', 10]
      ];
      completedTypes.forEach(function (pair) {
        for (let i = 0; i < pair[1]; i += 1) items.push(makeTask(monthKey, rng, pair[0], '已完成'));
      });
    } else {
      for (let i = 0; i < meetingCount; i += 1) items.push(makeMeeting(monthKey, rng));
      for (let i = 0; i < taskCount; i += 1) items.push(makeTask(monthKey, rng));
    }

    // Normalize November dates so the cockpit counters, aging buckets and SLA sample are stable.
    if (monthKey === '2026-11') {
      const active = items.filter(t => t.status === '执行中');
      const completed = items.filter(t => t.status === '已完成');
      const novStart = at(info.year, info.month, 1, 8, 30);

      function setCreated(t, d) {
        t.createdAt = dateTime(d);
        t.updatedAt = t.createdAt;
        t.audit[0].time = t.createdAt;
      }

      function createdBefore(due) {
        let d = new Date(due.getTime() - 50 * 3600000);
        if (d < novStart) d = new Date(due.getTime() - 30 * 60000);
        if (d < novStart) d = new Date(novStart.getTime());
        while (dayKey(d) === todayKey) d = new Date(d.getTime() - 86400000);
        return d;
      }

      function retimeMeeting(t) {
        if (t.name.indexOf('会议保障') !== 0) return;
        const duration = Number(t.hours) || 1;
        const end = parse(t.due);
        const start = new Date(end.getTime() - duration * 3600000);
        t.desc = String(t.desc || '').replace(
          /\d{4}-\d{2}-\d{2} \d{2}:\d{2} 至 \d{2}:\d{2}/,
          dateTime(start) + ' 至 ' + dateTime(end).slice(11)
        );
      }

      // Active: 13 overdue / 8 due within 24h / 217 normal.
      const overdueHours = [6, 14, 22, 36, 48, 60, 70, 80, 96, 110, 130, 150, 180];
      const dueSoonHours = [1, 3, 5, 7, 9, 11, 13, 15];
      active.forEach(function (t, i) {
        let due;
        if (i < overdueHours.length) {
          due = new Date(demoNow.getTime() - overdueHours[i] * 3600000);
        } else if (i < overdueHours.length + dueSoonHours.length) {
          due = new Date(demoNow.getTime() + dueSoonHours[i - overdueHours.length] * 3600000);
        } else {
          due = new Date(novStart.getTime() + (14 + (i % 15)) * 86400000 + (8 + (i % 9)) * 3600000);
        }
        t.due = dateTime(due);
        if (!t.createdAt || parse(t.createdAt) >= due || String(t.createdAt).slice(0, 10) === todayKey) {
          setCreated(t, createdBefore(due));
        }
        retimeMeeting(t);
      });

      // Exactly three active urgent tasks; keep the flow stages populated.
      active.forEach(function (t, i) {
        t.level = i < 3 ? '紧急' : (i % 3 === 0 ? '重要' : '一般');
      });
      const activeHandling = active.filter(t => t.name.indexOf('会议保障') !== 0);
      activeHandling.forEach(function (t, i) {
        t.status = i < 3 ? '待分发' : (i < 9 ? '审批中' : '执行中');
      });

      // Completed: 409 on time + 51 late; 9 of the on-time tasks close today.
      completed.forEach(function (t, i) {
        const due = new Date(novStart.getTime() + (2 + (i % 24)) * 86400000 + (8 + (i % 8)) * 3600000);
        t.due = dateTime(due);
        t.completedAt = dateTime(new Date(due.getTime() + (i < 409 ? -2 : 3) * 3600000));
        if (!t.createdAt || parse(t.createdAt) >= due || String(t.createdAt).slice(0, 10) === todayKey) {
          setCreated(t, createdBefore(due));
        }
        retimeMeeting(t);
      });

      // 12 records created today, 9 closed today; keep every timestamp inside today.
      const dayStart = new Date(demoNow.getFullYear(), demoNow.getMonth(), demoNow.getDate(), 0, 1);
      const todaySlot = function (index, count) {
        const start = Math.max(dayStart.getTime(), demoNow.getTime() - 20 * 60000);
        const end = Math.max(start, demoNow.getTime() - 60000);
        const span = count > 1 ? (end - start) / (count - 1) : 0;
        return new Date(start + span * index);
      };
      const createdToday = active
        .filter(t => parse(t.due) > new Date(demoNow.getTime() + 24 * 3600000))
        .slice(0, 12);
      createdToday.forEach(function (t, i) {
        setCreated(t, todaySlot(i, 12));
      });

      const closedToday = completed
        .slice(0, 409)
        .filter(t => parse(t.due) > new Date(demoNow.getTime() + 4 * 3600000))
        .slice(0, 9);
      closedToday.forEach(function (t, i) {
        t.completedAt = dateTime(todaySlot(i, 9));
      });

      // Keep every other completion off today's date without changing its on-time/late class.
      completed.forEach(function (t, i) {
        if (closedToday.indexOf(t) > -1) return;
        if (String(t.completedAt).slice(0, 10) !== todayKey) return;
        const due = parse(t.due);
        const completedAt = parse(t.completedAt);
        t.completedAt = dateTime(new Date(completedAt.getTime() + (i < 409 ? -24 : 24) * 3600000));
        if (i < 409 && parse(t.completedAt) > due) t.completedAt = dateTime(new Date(due.getTime() - 3600000));
      });
    }

    return items;
  }

  const monthItems = {};
  MONTHS.forEach(function (m) {
    monthItems[m.key] = buildMonth(m.key, m.count, m.existing ? D.tasks.slice() : null);
  });

  const idMap = {};
  const allTasks = [];

  MONTHS.forEach(function (m) {
    const info = monthInfo(m.key);
    const monthCode = info.year + pad2(info.month);
    const list = monthItems[m.key].slice().sort(function (a, b) {
      return String(a.createdAt).localeCompare(String(b.createdAt)) ||
        String(a.due).localeCompare(String(b.due)) ||
        String(a.name).localeCompare(String(b.name), 'zh');
    });
    list.forEach(function (task, index) {
      const newId = 'TS-' + monthCode + '-' + pad4(index + 1);
      if (task.id && task.id !== newId) idMap[task.id] = newId;
      task.id = newId;
      (task.subs || []).forEach(function (sub, subIndex) {
        const newSubId = newId + '-' + pad2(subIndex + 1);
        if (sub.id && sub.id !== newSubId) idMap[sub.id] = newSubId;
        sub.id = newSubId;
      });
      allTasks.push(task);
    });
  });

  allTasks.sort(function (a, b) { return String(b.id).localeCompare(String(a.id)); });
  D.tasks = allTasks;

  /* 团队 / 主管 / 员工趋势图：按任务所属月份统计已完成主任务。 */
  const trendMonths = MONTHS.map(function (m) { return m.key; });
  const trendTeam = {};
  groupIds.forEach(function (g) { trendTeam[g] = []; });
  trendMonths.forEach(function (monthKey) {
    const code = monthKey.replace('-', '');
    groupIds.forEach(function (g) {
      trendTeam[g].push(allTasks.filter(function (t) {
        return t.status === '已完成' && t.group === g && t.id.slice(3, 9) === code;
      }).length);
    });
  });
  D.teamTrend = trendTeam;

  const orderedIds = Object.keys(idMap).sort(function (a, b) { return b.length - a.length; });

  function replaceString(value) {
    let out = String(value);
    orderedIds.forEach(function (oldId) {
      if (out.indexOf(oldId) > -1) out = out.split(oldId).join(idMap[oldId]);
    });
    return out;
  }

  function replaceDeep(value) {
    if (typeof value === 'string') return replaceString(value);
    if (Array.isArray(value)) return value.map(replaceDeep);
    if (value && typeof value === 'object') {
      const out = {};
      Object.keys(value).forEach(function (key) {
        out[replaceString(key)] = replaceDeep(value[key]);
      });
      return out;
    }
    return value;
  }

  ['messages', 'logs', 'personalArchive', 'activity', 'alertRules'].forEach(function (key) {
    if (D[key]) D[key] = replaceDeep(D[key]);
  });

  window.ITO_TASK_ID_MAP = idMap;

  const novTasks = monthItems['2026-11'];
  const activeTasks = novTasks.filter(t => t.status !== '已完成' && t.status !== '已取消');
  const completedTasks = novTasks.filter(t => t.status === '已完成');
  const overdueTasks = activeTasks.filter(t => parse(t.due) < demoNow);
  const dueSoonTasks = activeTasks.filter(function (t) {
    const due = parse(t.due);
    return due >= demoNow && due <= new Date(demoNow.getTime() + 24 * 3600000);
  });
  const normalTasks = activeTasks.filter(function (t) {
    return overdueTasks.indexOf(t) === -1 && dueSoonTasks.indexOf(t) === -1;
  });

  const typeColors = {
    '巡检': '#35e0ff', '变更': '#b57bff', '开发': '#2f8bff', '维保': '#ffcf3f', '其他': '#2ff0a8'
  };
  const cockpitType = type => ['巡检', '变更', '开发', '维保'].indexOf(type) > -1 ? type : '其他';
  const typeMix = ['巡检', '变更', '开发', '维保', '其他'].map(function (name) {
    return {
      name: name,
      value: activeTasks.filter(t => cockpitType(t.type) === name).length,
      color: typeColors[name]
    };
  });

  const groupActive = {};
  groupIds.forEach(function (g) { groupActive[g] = activeTasks.filter(t => t.group === g).length; });

  const agingHours = overdueTasks.map(t => (demoNow - parse(t.due)) / 3600000);
  const agingCounts = [
    agingHours.filter(h => h < 24).length,
    agingHours.filter(h => h >= 24 && h < 72).length,
    agingHours.filter(h => h >= 72 && h < 120).length,
    agingHours.filter(h => h >= 120).length
  ];
  const agingAvg = agingHours.length ? agingHours.reduce((a, b) => a + b, 0) / agingHours.length / 24 : 0;
  const agingLongest = agingHours.length ? Math.max.apply(null, agingHours) / 24 : 0;

  const onTimeClosed = completedTasks.filter(t => t.completedAt && parse(t.completedAt) <= parse(t.due)).length;
  const lateClosed = completedTasks.length - onTimeClosed;
  const onTimeRate = completedTasks.length ? Math.round(onTimeClosed / completedTasks.length * 1000) / 10 : 0;
  const overdueRate = activeTasks.length ? Math.round(overdueTasks.length / activeTasks.length * 1000) / 10 : 0;
  const avgClosureHours = 6.2;
  const timeScore = Math.max(0, Math.min(100, 100 - Math.max(0, avgClosureHours - 8) * 5));
  const slaScore = Math.round((onTimeRate * 0.6 + (100 - overdueRate) * 0.25 + timeScore * 0.15) * 10) / 10;
  const grade = slaScore >= 95 ? 'S' : slaScore >= 90 ? 'A' : slaScore >= 80 ? 'B' : slaScore >= 70 ? 'C' : 'D';

  const createdToday = novTasks.filter(t => String(t.createdAt).slice(0, 10) === todayKey).length;
  const closedToday = completedTasks.filter(t => String(t.completedAt).slice(0, 10) === todayKey).length;
  const highRisk = activeTasks.filter(t => t.level === '紧急').length;

  const dailyLabels = [];
  const dailyNew = [];
  const dailyDone = [];
  for (let day = 1; day <= 30; day += 1) {
    const key = '2026-11-' + pad2(day);
    dailyLabels.push('11/' + pad2(day));
    dailyNew.push(novTasks.filter(t => String(t.createdAt).slice(0, 10) === key).length);
    dailyDone.push(completedTasks.filter(t => String(t.completedAt).slice(0, 10) === key).length);
  }

  D.trend = {
    labels: ['11/01', '11/06', '11/11', '11/16', '11/21', '11/26', '11/30'],
    newTasks: dailyNew,
    completed: dailyDone,
    daily: dailyLabels
  };

  D.dashboard = Object.assign({}, D.dashboard, {
    active: activeTasks.length,
    closed: completedTasks.length,
    onTimeRate: onTimeRate,
    overdue: overdueTasks.length,
    sla: slaScore,
    openingBacklog: 0,
    newTasks: novTasks.length,
    groupActive: groupActive,
    health: {
      normal: normalTasks.length,
      dueSoon: dueSoonTasks.length,
      overdue: overdueTasks.length
    },
    today: {
      created: createdToday,
      closed: closedToday,
      net: createdToday - closedToday,
      highRisk: highRisk
    },
    typeMix: typeMix,
    aging: {
      counts: agingCounts,
      avg: Math.round(agingAvg * 10) / 10,
      longest: Math.round(agingLongest * 10) / 10
    },
    slaMetrics: {
      score: slaScore,
      grade: grade,
      onTimeRate: onTimeRate,
      onTimeClosed: onTimeClosed,
      lateClosed: lateClosed,
      avgClosureHours: avgClosureHours,
      avgClosureText: '6h 12m',
      overdueRate: overdueRate,
      overdue: overdueTasks.length,
      active: activeTasks.length,
      closed: completedTasks.length,
      target: 90,
      delta: Math.round((slaScore - 90) * 10) / 10
    }
  });
})();
