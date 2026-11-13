/* ─────────────────────────────────────────────
   ITO OPS · shared demo data
   Single source for the light management console.
   The cockpit keeps its own live simulation; this file
   is the contract for task / staff / duty modules.
   ───────────────────────────────────────────── */

window.ITO_DATA = (() => {
  'use strict';

  const BASE_YEAR = 2026;
  const BASE_DAY = '2026-11-02';
  const DEMO_TIME = '20:56';

  const pad2 = (n) => (n < 10 ? '0' + n : String(n));
  const dayKey = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());

  function parseDay(str) {
    const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function mondayOf(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d;
  }

  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  function buildDutyWeeks(todayStr, cfg) {
    const monday = mondayOf(parseDay(todayStr));
    const pool = cfg.pool || cfg.rotation || [];
    const externalPool = cfg.externalPool || [];
    const weeks = [];
    for (let i = -cfg.before; i <= cfg.after; i += 1) {
      const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i * 7);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      const team = pool.length ? [0, 1, 2, 3].map(function (k) {
        const idx = ((i * 4 + k) % pool.length + pool.length) % pool.length;
        return pool[idx];
      }) : [];
      const external = externalPool.length
        ? externalPool[((i % externalPool.length) + externalPool.length) % externalPool.length]
        : null;
      weeks.push({
        key: dayKey(start),
        start: dayKey(start),
        end: dayKey(end),
        weekNo: isoWeek(start),
        team: team,
        external: external,
        note: ''
      });
    }
    return weeks;
  }

  function readDemoOverride() {
    try {
      if (typeof location === 'undefined' || !location.search) return null;
      const value = new URLSearchParams(location.search).get('demo');
      return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDay(value) : null;
    } catch (e) {
      return null;
    }
  }

  const overrideDay = readDemoOverride();
  const realNow = new Date();
  const anchorDay = overrideDay || new Date(realNow.getFullYear(), realNow.getMonth(), realNow.getDate());
  const baseAnchor = parseDay(BASE_DAY);
  const OFFSET_DAYS = Math.round((anchorDay.getTime() - baseAnchor.getTime()) / 86400000);
  const IS_OVERRIDE = !!overrideDay;
  const TODAY = dayKey(anchorDay);
  /* 自动演示跟随系统时钟；?demo= 固定日期时保留 20:56，便于回归截图。 */
  const DEMO_NOW = TODAY + ' ' + (IS_OVERRIDE
    ? DEMO_TIME
    : pad2(realNow.getHours()) + ':' + pad2(realNow.getMinutes()));

  const groups = [
    { id: 'app',    name: '应用组',     code: 'APP',    manager: '王主管', leader: '李工', fullStrength: 13, color: '#9F2936', desc: '业务系统、接口与版本发布' },
    { id: 'comm',   name: '通信组',     code: 'COMM',   manager: '赵主管', leader: '赵工', fullStrength: 13, color: '#0A72E8', desc: '网络、交换、防火墙与割接' },
    { id: 'online', name: '在线组',     code: 'ONLINE', manager: '李主管', leader: '孙工', fullStrength: 12, color: '#1FAE5C', desc: '在线监测、终端与数据质量' },
    { id: 'infra',  name: '基础设施组', code: 'INFRA',  manager: '刘主管', leader: '刘工', fullStrength: 12, color: '#E08A00', desc: '机房、UPS、空调与动力环境' }
  ];

  const groupHistory = {
    months: ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'],
    app: [6, 7, 8, 9, 9, 10],
    comm: [4, 5, 6, 7, 8, 10],
    online: [5, 6, 7, 8, 8, 10],
    infra: [3, 4, 5, 6, 7, 10]
  };

  const staff = [
    { uid: 'E20001', name: '李工',   group: 'app',    title: '高级工程师',   tags: ['核心岗', 'KCC'], joined: '2023-02-15', phone: '13800001201' },
    { uid: 'E20002', name: '陈工',   group: 'app',    title: '工程师',       tags: ['工程师'],         joined: '2023-06-20', phone: '13800001202' },
    { uid: 'E20003', name: '赵工',   group: 'comm',   title: '高级工程师',   tags: ['核心岗'],         joined: '2022-11-10', phone: '13800001203' },
    { uid: 'E20005', name: '周工',   group: 'comm',   title: '工程师',       tags: ['工程师'],         joined: '2023-03-08', phone: '13800001205' },
    { uid: 'E20006', name: '孙工',   group: 'online', title: '高级工程师',   tags: ['核心岗', 'DTT'],  joined: '2023-01-12', phone: '13800001206' },
    { uid: 'E20007', name: '吴工',   group: 'online', title: '工程师',       tags: ['工程师'],         joined: '2023-07-25', phone: '13800001207' },
    { uid: 'E20004', name: '刘工',   group: 'infra',  title: '高级工程师',   tags: ['核心岗'],         joined: '2023-01-05', phone: '13800001204' },
    { uid: 'E20008', name: '郑工',   group: 'infra',  title: '工程师',       tags: ['工程师'],         joined: '2023-04-18', phone: '13800001208' },

    { uid: 'E20009', name: '王主管', group: 'app',    title: '应用组主管',   tags: ['管理', 'KCC'],    joined: '2022-05-10', phone: '13900001210' },
    { uid: 'E20010', name: '赵主管', group: 'comm',   title: '通信组主管',   tags: ['管理', '通信线路'], joined: '2021-09-06', phone: '13900001203' },
    { uid: 'E20011', name: '李主管', group: 'online', title: '在线组主管',   tags: ['管理', '终端'],   joined: '2022-03-14', phone: '13900001211' },
    { uid: 'E20012', name: '刘主管', group: 'infra',  title: '基础设施组主管', tags: ['管理', '机房'], joined: '2021-11-22', phone: '13900001212' },

    { uid: 'E20013', name: '林工', group: 'app', title: '高级工程师', tags: ['核心岗', 'KCC'], joined: '2024-02-19', phone: '13800001213' },
    { uid: 'E20014', name: '何工', group: 'app', title: '工程师',     tags: ['工程师'],         joined: '2024-06-03', phone: '13800001214' },
    { uid: 'E20015', name: '高工', group: 'app', title: '工程师',     tags: ['KNS'],            joined: '2024-09-12', phone: '13800001215' },
    { uid: 'E20016', name: '徐工', group: 'app', title: '助理工程师', tags: ['工程师'],         joined: '2025-01-08', phone: '13800001216' },
    { uid: 'E20017', name: '马工', group: 'app', title: '工程师',     tags: ['KCC'],            joined: '2025-04-21', phone: '13800001217' },
    { uid: 'E20018', name: '朱工', group: 'app', title: '助理工程师', tags: ['工程师'],         joined: '2025-08-15', phone: '13800001218' },
    { uid: 'E20019', name: '胡工', group: 'app', title: '工程师',     tags: ['KNS'],            joined: '2026-01-12', phone: '13800001219' },

    { uid: 'E20020', name: '郭工', group: 'comm', title: '高级工程师', tags: ['核心岗', '通信线路'], joined: '2024-01-15', phone: '13800001220' },
    { uid: 'E20021', name: '罗工', group: 'comm', title: '工程师',     tags: ['工程师'],         joined: '2024-05-08', phone: '13800001221' },
    { uid: 'E20022', name: '梁工', group: 'comm', title: '工程师',     tags: ['通信线路'],       joined: '2024-08-19', phone: '13800001222' },
    { uid: 'E20023', name: '宋工', group: 'comm', title: '助理工程师', tags: ['工程师'],         joined: '2024-12-02', phone: '13800001223' },
    { uid: 'E20024', name: '唐工', group: 'comm', title: '工程师',     tags: ['通信网络'],       joined: '2025-03-10', phone: '13800001224' },
    { uid: 'E20025', name: '许工', group: 'comm', title: '工程师',     tags: ['工程师'],         joined: '2025-09-23', phone: '13800001225' },
    { uid: 'E20026', name: '邓工', group: 'comm', title: '助理工程师', tags: ['通信传输'],       joined: '2026-01-06', phone: '13800001226' },

    { uid: 'E20027', name: '冯工', group: 'online', title: '高级工程师', tags: ['核心岗', '终端'], joined: '2024-03-05', phone: '13800001227' },
    { uid: 'E20028', name: '曹工', group: 'online', title: '工程师',     tags: ['工程师'],         joined: '2024-07-17', phone: '13800001228' },
    { uid: 'E20029', name: '彭工', group: 'online', title: '工程师',     tags: ['DTT'],            joined: '2024-10-28', phone: '13800001229' },
    { uid: 'E20030', name: '曾工', group: 'online', title: '助理工程师', tags: ['终端'],           joined: '2025-02-11', phone: '13800001230' },
    { uid: 'E20031', name: '肖工', group: 'online', title: '工程师',     tags: ['工程师'],         joined: '2025-06-09', phone: '13800001231' },
    { uid: 'E20032', name: '田工', group: 'online', title: '助理工程师', tags: ['DTT'],            joined: '2025-11-03', phone: '13800001232' },
    { uid: 'E20033', name: '董工', group: 'online', title: '工程师',     tags: ['终端'],           joined: '2026-02-24', phone: '13800001233' },

    { uid: 'E20034', name: '袁工', group: 'infra', title: '高级工程师', tags: ['核心岗', '机房'], joined: '2024-02-01', phone: '13800001234' },
    { uid: 'E20035', name: '潘工', group: 'infra', title: '工程师',     tags: ['工程师'],         joined: '2024-04-16', phone: '13800001235' },
    { uid: 'E20036', name: '蒋工', group: 'infra', title: '工程师',     tags: ['机房'],           joined: '2024-08-27', phone: '13800001236' },
    { uid: 'E20037', name: '蔡工', group: 'infra', title: '助理工程师', tags: ['工程师'],         joined: '2025-01-20', phone: '13800001237' },
    { uid: 'E20038', name: '余工', group: 'infra', title: '工程师',     tags: ['机房'],           joined: '2025-05-06', phone: '13800001238' },
    { uid: 'E20039', name: '杜工', group: 'infra', title: '助理工程师', tags: ['工程师'],         joined: '2025-10-13', phone: '13800001239' },
    { uid: 'E20040', name: '叶工', group: 'infra', title: '工程师',     tags: ['机房'],           joined: '2026-03-02', phone: '13800001240' }
  ];

  const dashboard = {
    active: 128,
    activeDelta: '+12%',
    closed: 342,
    onTimeRate: 89.0,
    overdue: 7,
    sla: 92.0,
    slaDelta: '+1.8',
    openingBacklog: 86,
    newTasks: 384,
    groupActive: { app: 42, comm: 33, online: 29, infra: 24 },
    health: { normal: 109, dueSoon: 12, overdue: 7 },
    today: { created: 10, closed: 8, net: 2, highRisk: 3 },
    typeMix: [
      { name: '巡检', value: 38, color: '#35e0ff' },
      { name: '变更', value: 31, color: '#b57bff' },
      { name: '开发', value: 27, color: '#2f8bff' },
      { name: '维保', value: 19, color: '#ffcf3f' },
      { name: '其他', value: 13, color: '#2ff0a8' }
    ]
  };

  const trend = {
    labels: ['10/04', '10/09', '10/14', '10/19', '10/24', '10/29', '11/02'],
    newTasks: [12, 9, 13, 14, 7, 6, 11, 13, 10, 14, 15, 9, 8, 13, 15, 14, 17, 18, 10, 9, 14, 16, 15, 18, 19, 11, 10, 16, 18, 10],
    completed: [10, 8, 11, 13, 7, 6, 10, 12, 10, 13, 14, 8, 7, 11, 13, 12, 15, 16, 9, 8, 12, 14, 13, 16, 17, 10, 9, 14, 16, 8],
    daily: [
      '10/04', '10/05', '10/06', '10/07', '10/08', '10/09', '10/10', '10/11', '10/12', '10/13',
      '10/14', '10/15', '10/16', '10/17', '10/18', '10/19', '10/20', '10/21', '10/22', '10/23',
      '10/24', '10/25', '10/26', '10/27', '10/28', '10/29', '10/30', '10/31', '11/01', '11/02'
    ]
  };

  const tasks = [
    {
      id: 'T10027', name: '核心机房季度巡检与整改', group: 'infra', owner: '刘工', initiator: '张经理',
      level: '紧急', type: '巡检', due: '2026-11-04 18:00', tags: ['机房', '季度巡检'],
      desc: '覆盖核心机房环境、空调、UPS 与消防系统，输出整改闭环清单。',
      subs: [
        { id: 'T10027-01', name: '核心机房环境巡检', group: 'infra', owner: '刘工', initiator: '张经理', level: '重要', type: '巡检', status: '执行中', due: '2026-10-31 18:00', hours: 8,  progress: 75, auth: '工作负责人授权', ticket: true },
        { id: 'T10027-02', name: '机房空调系统检测', group: 'infra', owner: '郑工', initiator: '张经理', level: '一般', type: '维保', status: '待分发', due: '2026-11-03 17:00', hours: 4,  progress: 0,  auth: '无需授权', ticket: false },
        { id: 'T10027-03', name: 'UPS 电池组测试',    group: 'infra', owner: '郑工', initiator: '张经理', level: '紧急', type: '试验', status: '审批中', due: '2026-10-27 20:00', hours: 6,  progress: 100, auth: '高风险作业授权', ticket: true, submittedAt: '2026-10-28 09:00', approval: { level: 1, approver: '刘主管', status: '待审批', submittedAt: '2026-10-28 09:00', dueAt: '2026-10-31 09:00', decidedAt: '', comment: '' } }
      ]
    },
    {
      id: 'T10026', name: '业务系统版本升级', group: 'app', owner: '陈工', initiator: '王主管',
      level: '重要', type: '变更', due: '2026-11-05 20:00', tags: ['KNS', '版本发布'],
      desc: '完成 KNS 业务系统 v3.6.2 版本升级、回归验证与发布窗口保障。',
      subs: [
        { id: 'T10026-01', name: '需求评审与方案制定', group: 'app', owner: '陈工', initiator: '王主管', level: '重要', type: '变更', status: '已完成', due: '2026-10-26 18:00', hours: 12, progress: 100, auth: '—', ticket: false, completedAt: '2026-10-26 16:40' },
        { id: 'T10026-02', name: '开发与测试',         group: 'app', owner: '李工', initiator: '王主管', level: '重要', type: '开发', status: '执行中', due: '2026-11-03 18:00', hours: 40, progress: 60,  auth: '—', ticket: false }
      ]
    },
    {
      id: 'T10025', name: '通信网络割接', group: 'comm', owner: '赵工', initiator: '张经理',
      level: '紧急', type: '操作', due: '2026-11-02 23:00', tags: ['厂房通信', '割接'],
      desc: '核心链路割接与回退验证，保障生产网络零中断。',
      subs: [
        { id: 'T10025-01', name: '割接方案评审',         group: 'comm', owner: '赵工', initiator: '张经理', level: '紧急', type: '操作', status: '执行中', due: '2026-10-28 12:00', hours: 4, progress: 50, auth: 'RP1 授权', ticket: true },
        { id: 'T10025-02', name: '割接实施与回退验证',   group: 'comm', owner: '周工', initiator: '张经理', level: '紧急', type: '操作', status: '待分发', due: '2026-11-02 23:00', hours: 6, progress: 0,  auth: 'RP1 授权', ticket: true }
      ]
    },
    {
      id: 'T10024', name: '在线监测平台告警治理', group: 'online', owner: '孙工', initiator: '王主管',
      level: '重要', type: '工单', due: '2026-11-03 18:00', tags: ['监测', '告警收敛'],
      desc: '梳理在线监测告警规则，压降重复告警与误报率。',
      subs: [
        { id: 'T10024-01', name: '告警规则梳理', group: 'online', owner: '孙工', initiator: '王主管', level: '重要', type: '工单', status: '已完成', due: '2026-10-29 18:00', hours: 8,  progress: 100, auth: '—', ticket: false, completedAt: '2026-10-29 17:05' },
        { id: 'T10024-02', name: '误报规则收敛', group: 'online', owner: '吴工', initiator: '王主管', level: '重要', type: '工单', status: '执行中', due: '2026-10-31 17:00', hours: 12, progress: 45,  auth: '—', ticket: false }
      ]
    },
    {
      id: 'T10023', name: '防火墙策略变更', group: 'comm', owner: '赵工', initiator: '张经理',
      level: '紧急', type: '变更', due: '2026-11-02 22:00', tags: ['防火墙', '策略'],
      desc: '按最小权限原则收敛互联网出口策略，完成审批后实施。',
      subs: [
        { id: 'T10023-01', name: '策略评审与审批', group: 'comm', owner: '周工', initiator: '张经理', level: '紧急', type: '变更', status: '审批中', due: '2026-11-02 18:00', hours: 2, progress: 100, auth: '高风险作业授权', ticket: true, submittedAt: '2026-11-01 10:00', approval: { level: 1, approver: '赵主管', status: '待审批', submittedAt: '2026-11-01 10:00', dueAt: '2026-11-04 10:00', decidedAt: '', comment: '' } }
      ]
    },
    {
      id: 'T10022', name: '数据库容量扩容', group: 'app', owner: '陈工', initiator: '王主管',
      level: '重要', type: '变更', due: '2026-11-06 20:00', tags: ['数据库', '容量'],
      desc: '根据容量预测扩容生产库存储与连接池，完成压测验证。',
      subs: [
        { id: 'T10022-01', name: '容量评估',   group: 'app', owner: '李工', initiator: '王主管', level: '重要', type: '变更', status: '已完成', due: '2026-10-30 16:00', hours: 6, progress: 100, auth: '—', ticket: false, completedAt: '2026-10-31 11:20' },
        { id: 'T10022-02', name: '扩容实施',   group: 'app', owner: '李工', initiator: '王主管', level: '重要', type: '变更', status: '审批中', due: '2026-11-04 20:00', hours: 8, progress: 100,   auth: '准备工程师授权', ticket: true, submittedAt: '2026-10-29 10:00', approval: { level: 1, approver: '陈工', status: '待审批', submittedAt: '2026-10-29 10:00', dueAt: '2026-11-01 10:00', decidedAt: '', comment: '' } }
      ]
    },
    {
      id: 'T10021', name: 'UPS 电池组半年检', group: 'infra', owner: '刘工', initiator: '张经理',
      level: '一般', type: '巡检', due: '2026-11-07 10:00', tags: ['UPS', '动力环境'],
      desc: '完成电池组放电测试、内阻检测与容量评估。',
      leaderApproval: { status: '审批中', approver: '张经理', submittedAt: '2026-10-31 09:00', dueAt: '2026-11-03 09:00', decidedAt: '', comment: '' },
      subs: [
        { id: 'T10021-01', name: '电池组放电测试', group: 'infra', owner: '郑工', initiator: '张经理', level: '一般', type: '巡检', status: '已完成', due: '2026-11-07 10:00', hours: 6, progress: 100, auth: '无需授权', ticket: false, completedAt: '2026-10-31 08:30' }
      ]
    },
    {
      id: 'T10020', name: '终端安全基线核查', group: 'online', owner: '孙工', initiator: '王主管',
      level: '一般', type: '巡检', due: '2026-11-05 18:00', tags: ['终端', '安全基线'],
      desc: '抽查办公终端补丁、杀毒与外设管控策略执行情况。',
      subs: [
        { id: 'T10020-01', name: '办公终端抽查', group: 'online', owner: '吴工', initiator: '王主管', level: '一般', type: '巡检', status: '执行中', due: '2026-10-30 12:00', hours: 10, progress: 40, auth: '—', ticket: false }
      ]
    },
    {
      id: 'T10019', name: '核心交换机固件升级', group: 'comm', owner: '赵工', initiator: '张经理',
      level: '重要', type: '变更', due: '2026-11-08 23:00', tags: ['交换机', '固件'],
      desc: '升级核心交换机固件并完成双机倒换验证。',
      subs: [
        { id: 'T10019-01', name: '固件兼容性验证', group: 'comm', owner: '赵工', initiator: '张经理', level: '重要', type: '变更', status: '待分发', due: '2026-11-06 18:00', hours: 4, progress: 0, auth: '无需授权', ticket: false }
      ]
    },
    {
      id: 'T10018', name: 'KNS 接口性能优化', group: 'app', owner: '李工', initiator: '王主管',
      level: '重要', type: '开发', due: '2026-11-04 18:00', tags: ['KNS', '性能'],
      desc: '定位 KNS 接口慢查询，优化缓存策略与响应时延。',
      subs: [
        { id: 'T10018-01', name: '慢查询分析',   group: 'app', owner: '李工', initiator: '王主管', level: '重要', type: '开发', status: '执行中', due: '2026-10-29 16:00', hours: 8,  progress: 55, auth: '—', ticket: false },
        { id: 'T10018-02', name: '缓存策略调整', group: 'app', owner: '陈工', initiator: '王主管', level: '重要', type: '开发', status: '审批中', due: '2026-11-03 18:00', hours: 12, progress: 100, auth: '工作负责人授权', ticket: true, submittedAt: '2026-11-02 10:00', approval: { level: 1, approver: '王主管', status: '待审批', submittedAt: '2026-11-02 10:00', dueAt: '2026-11-05 10:00', decidedAt: '', comment: '' } }
      ]
    },
    {
      id: 'T10017', name: '机房空调系统维保', group: 'infra', owner: '刘工', initiator: '王主管',
      level: '一般', type: '维保', due: '2026-11-06 17:00', tags: ['空调', '维保'],
      desc: '完成滤网清洗、冷媒压力检测与排水系统检查。',
      subs: [
        { id: 'T10017-01', name: '滤网清洗与冷媒检测', group: 'infra', owner: '郑工', initiator: '王主管', level: '一般', type: '维保', status: '已完成', due: '2026-10-31 17:00', hours: 6, progress: 100, auth: '—', ticket: false, completedAt: '2026-11-01 10:15' }
      ]
    },
    {
      id: 'T10016', name: '监测数据补录与核对', group: 'online', owner: '孙工', initiator: '张经理',
      level: '一般', type: '操作', due: '2026-11-03 18:00', tags: ['监测', '数据质量'],
      desc: '补录 10 月缺失监测数据，完成跨系统一致性核对。',
      subs: [
        { id: 'T10016-01', name: '10 月缺失数据补录', group: 'online', owner: '孙工', initiator: '张经理', level: '一般', type: '操作', status: '已完成', due: '2026-10-31 18:00', hours: 4, progress: 100, auth: '—', ticket: false, completedAt: '2026-10-31 17:20' },
        { id: 'T10016-02', name: '数据一致性核对',     group: 'online', owner: '吴工', initiator: '张经理', level: '一般', type: '操作', status: '执行中', due: '2026-11-03 18:00', hours: 3, progress: 0,   auth: '—', ticket: false }
      ]
    },
    {
      id: 'T10029', name: '核心交换机巡检报告汇总', group: 'comm', owner: '赵工', initiator: '张经理',
      level: '重要', type: '综合', due: '2026-10-30 18:00', tags: ['交换机', '巡检报告'],
      desc: '汇总核心交换机巡检结果并提交领导审批。',
      leaderApproval: { status: '审批中', approver: '张经理', submittedAt: '2026-10-29 09:00', dueAt: '2026-11-01 09:00', decidedAt: '', comment: '' },
      subs: [
        { id: 'T10029-01', name: '交换机日志巡检', group: 'comm', owner: '周工', initiator: '张经理', level: '重要', type: '巡检', status: '已完成', due: '2026-10-29 18:00', hours: 4, progress: 100, auth: '无需授权', ticket: false, completedAt: '2026-10-29 16:50' },
        { id: 'T10029-02', name: '端口流量核对', group: 'comm', owner: '赵工', initiator: '张经理', level: '一般', type: '巡检', status: '已完成', due: '2026-10-30 18:00', hours: 3, progress: 100, auth: '无需授权', ticket: false, completedAt: '2026-10-30 17:40' }
      ]
    },
    {
      id: 'T10030', name: '临时终端补装', group: 'online', owner: '孙工', initiator: '王主管',
      level: '一般', type: '操作', due: '2026-11-09 18:00', tags: ['终端'],
      desc: '因业务需求取消，不再执行。',
      canceled: { reason: '业务需求取消', by: '王主管', at: '2026-11-01 10:00' },
      subs: [
        { id: 'T10030-01', name: '临时终端补装', group: 'online', owner: '吴工', initiator: '王主管', level: '一般', type: '操作', status: '已取消', due: '2026-11-09 18:00', hours: 4, progress: 0, auth: '无需授权', ticket: false }
      ]
    }
  ];

  /* ── 生成的演示任务：补齐 128 条主任务 ───── */
  const GEN_GROUP_CONF = {
    app:    { services: ['KNS 接口', '业务系统', '数据库', '缓存', '报表服务'], tag: 'KNS', manager: '王主管' },
    comm:   { services: ['核心交换机', '防火墙', '专线链路', 'VPN', '无线网络'], tag: '割接', manager: '赵主管' },
    online: { services: ['监测平台', '办公终端', '数据质量', '告警中心', '采集服务'], tag: '终端', manager: '李主管' },
    infra:  { services: ['核心机房', 'UPS 电池组', '精密空调', '消防系统', '动力环境'], tag: '机房', manager: '刘主管' }
  };
  const GEN_PLAN = {
    app:    { '巡检': 12, '变更': 10, '开发': 10, '维保': 5, '其他': 2 },
    comm:   { '巡检': 9,  '变更': 8,  '开发': 6,  '维保': 4, '其他': 2 },
    online: { '巡检': 8,  '变更': 5,  '开发': 5,  '维保': 4, '其他': 3 },
    infra:  { '巡检': 6,  '变更': 4,  '开发': 5,  '维保': 5, '其他': 1 }
  };
  const GEN_OTHER_TYPES = ['试验', '操作', '工单', '综合'];
  let genTaskNo = 10031;
  let genOtherIndex = 0;
  const genDueCount = {};

  Object.keys(GEN_PLAN).forEach(function (gid) {
    const conf = GEN_GROUP_CONF[gid];
    const people = staff.filter(function (p) { return p.group === gid; }).map(function (p) { return p.name; });
    if (!people.length) return;
    const personIndex = {};
    people.forEach(function (name, idx) { personIndex[name] = idx; });
    Object.keys(GEN_PLAN[gid]).forEach(function (bucket) {
      const count = GEN_PLAN[gid][bucket];
      for (let i = 0; i < count; i += 1) {
        const actualType = bucket === '其他'
          ? GEN_OTHER_TYPES[genOtherIndex++ % GEN_OTHER_TYPES.length]
          : bucket;
        const owner = people[i % people.length];
        const seen = genDueCount[owner] || 0;
        genDueCount[owner] = seen + 1;
        const month = seen === 0 ? '11' : '12';
        const day = seen === 0 ? 10 + personIndex[owner] : 5 + (seen - 1) * 3;
        const due = '2026-' + month + '-' + pad2(day) + ' ' + pad2(9 + (i % 8)) + ':00';
        const id = 'T' + (genTaskNo++);
        const service = conf.services[i % conf.services.length];
        const name = service + actualType + ' ' + pad2(i + 1);
        const level = i % 5 === 0 ? '紧急' : (i % 2 === 0 ? '重要' : '一般');
        const auth = (actualType === '变更' || actualType === '开发') ? '工作负责人授权' : '无需授权';
        const tags = [conf.tag];
        tasks.push({
          id: id, name: name, group: gid, owner: conf.manager, initiator: conf.manager,
          level: level, type: actualType, due: due, tags: tags, source: 'self', mode: 'single',
          desc: '演示数据：' + service + actualType + '任务，执行人 ' + owner + '，计划 ' + due + ' 前完成。',
          subs: [{
            id: id + '-01', name: name + ' · 执行', group: gid, owner: owner, initiator: conf.manager,
            level: level, type: actualType, status: '执行中', due: due,
            hours: [4, 6, 8, 12][i % 4], progress: 20 + (i * 9) % 70,
            auth: auth, ticket: false, tags: tags.slice()
          }]
        });
      }
    });
  });

  /* 负责人统一为主管 / 组长；子任务执行人保持全员 */
  tasks.forEach(function (task) {
    const group = groups.find(function (g) { return g.id === task.group; });
    if (!group) return;
    task.owner = group.manager || group.leader || task.owner;
    (task.subs || []).forEach(function (sub) {
      if (sub.approval && Number(sub.approval.level) === 1) sub.approval.approver = task.owner;
    });
  });

  const activity = [
    { time: '2026-11-02 20:12', task: '防火墙策略变更', sub: '策略评审与审批', group: 'comm', owner: '周工', status: '审批中' },
    { time: '2026-11-02 19:40', task: '通信网络割接', sub: '割接实施与回退验证', group: 'comm', owner: '周工', status: '执行中' },
    { time: '2026-11-02 18:25', task: '核心机房季度巡检与整改', sub: 'UPS 电池组测试', group: 'infra', owner: '郑工', status: '审批中' },
    { time: '2026-11-02 16:10', task: '业务系统版本升级', sub: '开发与测试', group: 'app', owner: '李工', status: '执行中' },
    { time: '2026-10-31 17:40', task: '在线监测平台告警治理', sub: '误报规则收敛', group: 'online', owner: '吴工', status: '执行中' },
    { time: '2026-10-31 15:10', task: '机房空调系统维保', sub: '滤网清洗与冷媒检测', group: 'infra', owner: '郑工', status: '已完成' }
  ];

  const inspectionPlans = [
    { id: 'IP-001', name: '核心机房周检', group: 'infra',  cycle: '每周', owner: '刘工', executor: '刘工', hours: 4, next: '2026-11-03 08:00', status: '启用', content: '机房温度、湿度、UPS、空调系统、消防设备', standard: '温度 20–26℃，湿度 40–60%，UPS 电池电压正常' },
    { id: 'IP-002', name: '网络设备日检', group: 'comm',   cycle: '每日', owner: '赵工', executor: '周工', hours: 2, next: '2026-11-03 07:30', status: '启用', content: '交换机、路由器、防火墙运行状态', standard: 'CPU < 70%，内存 < 80%，无端口错包' },
    { id: 'IP-003', name: '应用系统月检', group: 'app',    cycle: '每月', owner: '陈工', executor: '李工', hours: 3, next: '2026-11-05 15:00', status: '启用', content: '应用服务器、数据库、中间件', standard: '服务正常运行，无 error 日志' },
    { id: 'IP-004', name: '在线监测平台巡检', group: 'online', cycle: '每日', owner: '孙工', executor: '孙工', hours: 2, next: '2026-11-03 09:00', status: '启用', content: '采集通道、数据完整率、告警推送', standard: '数据完整率 ≥ 99%，告警延迟 < 30s' },
    { id: 'IP-005', name: 'UPS 电池组月检', group: 'infra', cycle: '每月', owner: '郑工', executor: '郑工', hours: 3, next: '2026-11-06 10:00', status: '停用', content: '电池组电压、内阻、外观', standard: '单体电压偏差 < 0.05V' }
  ];

  const inspectionWeek = {
    patterns: [
      { plan: '核心机房周检', cycle: '每周', cells: ['off', 'off', 'off', 'off', 'ok', 'off', 'off'] },
      { plan: '网络设备日检', cycle: '每日', cells: ['ok', 'ok', 'bad', 'ok', 'ok', 'ok', 'ok'] },
      { plan: '应用系统月检', cycle: '每月', cells: ['off', 'off', 'off', 'ok', 'off', 'off', 'off'] },
      { plan: '在线监测平台巡检', cycle: '每日', cells: ['ok', 'ok', 'ok', 'ok', 'bad', 'ok', 'ok'] }
    ]
  };

  const inspectionRecords = [
    { id: 'IR-1027', plan: '核心机房周检', group: 'infra',  owner: '刘工', hours: 4, time: '2026-10-31 08:10', result: '正常', items: 12, abnormal: 0, note: '温湿度、UPS、消防均正常' },
    { id: 'IR-1026', plan: '网络设备日检', group: 'comm',   owner: '赵工', hours: 2, time: '2026-10-31 07:35', result: '异常', items: 18, abnormal: 2, note: '核心交换机 2 个端口错包增长，已转整改任务' },
    { id: 'IR-1025', plan: '在线监测平台巡检', group: 'online', owner: '孙工', hours: 2, time: '2026-10-30 09:05', result: '正常', items: 9,  abnormal: 0, note: '采集通道与告警推送正常' },
    { id: 'IR-1024', plan: '应用系统月检', group: 'app',    owner: '陈工', hours: 3, time: '2026-10-28 15:20', result: '正常', items: 14, abnormal: 0, note: '应用与数据库无 error 日志' },
    { id: 'IR-1023', plan: '核心机房周检', group: 'infra',  owner: '刘工', hours: 4, time: '2026-10-24 08:05', result: '正常', items: 12, abnormal: 0, note: '完成空调滤网初检' }
  ];

  const maintenancePlans = [
    { id: 'MP-001', name: '机房空调季度维保', group: 'infra', cycle: '每季度', owner: '刘工', executor: '郑工', hours: 8, vendor: '维保厂商 A', next: '2026-11-06 09:00', status: '启用', scope: '滤网、冷媒、排水、压缩机' },
    { id: 'MP-002', name: 'UPS 电池组半年检', group: 'infra', cycle: '每半年', owner: '郑工', executor: '郑工', hours: 6, vendor: '维保厂商 B', next: '2026-11-12 10:00', status: '启用', scope: '放电测试、内阻检测、容量评估' },
    { id: 'MP-003', name: '核心交换机固件维保', group: 'comm', cycle: '每年', owner: '赵工', executor: '周工', hours: 10, vendor: '原厂服务', next: '2026-12-01 22:00', status: '启用', scope: '固件评估、升级、倒换验证' },
    { id: 'MP-004', name: '消防系统年检', group: 'infra', cycle: '每年', owner: '刘工', executor: '刘工', hours: 4, vendor: '维保厂商 C', next: '2026-11-20 14:00', status: '停用', scope: '烟感、喷淋、联动测试' },
    { id: 'MP-005', name: '应用服务器季度维保', group: 'app', cycle: '每季度', owner: '王主管', executor: '李工', hours: 6, vendor: '原厂服务', next: '2026-11-19 10:00', status: '启用', scope: '主机健康检查、补丁评估、日志清理' },
    { id: 'MP-006', name: '中间件与数据库巡检', group: 'app', cycle: '每月', owner: '王主管', executor: '陈工', hours: 5, vendor: '维保厂商 B', next: '2026-11-24 09:00', status: '启用', scope: '连接池、慢查询、备份有效性' }
  ];

  [inspectionPlans, maintenancePlans].forEach(function (list) {
    list.forEach(function (plan) {
      const group = groups.find(function (g) { return g.id === plan.group; });
      if (group && group.manager) plan.owner = group.manager;
    });
  });

  const maintenanceRecords = [
    { id: 'MR-301', plan: '机房空调季度维保', group: 'infra', owner: '郑工', hours: 8, time: '2026-10-31 16:20', result: '完成', vendor: '维保厂商 A', note: '滤网清洗完成，冷媒压力正常' },
    { id: 'MR-300', plan: 'UPS 电池组半年检', group: 'infra', owner: '刘工', hours: 6, time: '2026-10-29 11:05', result: '完成', vendor: '维保厂商 B', note: '放电测试通过，容量 96%' },
    { id: 'MR-299', plan: '核心交换机固件维保', group: 'comm', owner: '周工', hours: 10, time: '2026-10-25 22:40', result: '完成', vendor: '原厂服务', note: '风扇模块更换，运行正常' },
    { id: 'MR-298', plan: '消防系统年检', group: 'infra', owner: '刘工', hours: 4, time: '2026-10-20 14:30', result: '完成', vendor: '维保厂商 C', note: '联动测试通过，待年度复审' }
  ];

  const duty = {
    handover: '08:00',
    anchorMonday: '2026-11-02',
    anchorIndex: 0,
    before: 6,
    after: 6,
    /* 值班授权池：通信组 10 人（含值班主管赵主管） */
    authPool: ['赵主管', '郭工', '赵工', '周工', '罗工', '梁工', '宋工', '唐工', '许工', '邓工'],
    /* 值班轮换池：通信组除赵主管外的 9 人 */
    pool: ['郭工', '赵工', '周工', '罗工', '梁工', '宋工', '唐工', '许工', '邓工'],
    rotation: ['郭工', '赵工', '周工', '罗工', '梁工', '宋工', '唐工', '许工', '邓工'],
    externalPool: [
      { name: '吴工（工程公司）', phone: '13800001209' },
      { name: '沈工（工程公司）', phone: '13800001210' },
      { name: '韩工（工程公司）', phone: '13800001211' }
    ],
    currentKey: '',
    nextKey: '',
    calls: [],
    weeks: []
  };

  const dutyRoster = [
    { post: '通信助理', code: 'TX-ZL', name: '赵主管', phone: '13900001203' },
    { post: '通信值班-应急', code: 'TX-YJ', name: '郭工', phone: '13800001220' },
    { post: '通信值班-线路', code: 'TX-XL', name: '赵工', phone: '13800001203' },
    { post: '通信值班-网络', code: 'TX-WL', name: '周工', phone: '13800001205' },
    { post: '通信值班-桌面', code: 'TX-ZM', name: '罗工', phone: '13800001221' },
    { post: '工程公司项目部通讯技术助理', code: '', name: '吴工（工程公司）', phone: '13800001209', external: true }
  ];

  const dutyTypes = [
    { id: 'emergency', name: '值班-应急', assistant: '郭工', phone: '13800001220', statuses: ['正常', '正常', '正常', '异常', '正常', '正常', '正常'] },
    { id: 'line',      name: '值班-线路', assistant: '赵工', phone: '13800001203', statuses: ['正常', '正常', '正常', '正常', '正常', '异常', '正常'] },
    { id: 'network',   name: '值班-网络', assistant: '周工', phone: '13800001205', statuses: ['正常', '异常', '正常', '正常', '正常', '正常', '正常'] },
    { id: 'desktop',   name: '值班-桌面', assistant: '罗工', phone: '13800001221', statuses: ['正常', '正常', '正常', '正常', '正常', '正常', '正常'] }
  ];

  const auths = [
    { id: 'AU-2026-0187', person: '李工',   type: '工作负责人授权',   group: 'app',    scope: '应用系统变更与发布', validTo: '2027-01-01', status: '有效' },
    { id: 'AU-2026-0186', person: '赵工',   type: '高风险作业授权',   group: 'comm',   scope: '核心网络割接与防火墙变更', validTo: '2026-12-31', status: '有效' },
    { id: 'AU-2026-0185', person: '刘工',   type: '工作负责人授权',   group: 'infra',  scope: '机房动力环境作业', validTo: '2027-01-01', status: '有效' },
    { id: 'AU-2026-0184', person: '周工',   type: '准备工程师授权',   group: 'comm',   scope: '割接前准备与验证', validTo: '2026-12-31', status: '有效' },
    { id: 'AU-2026-0183', person: '吴工',   type: '工具库授权',       group: 'online', scope: '在线监测终端作业', validTo: '2026-10-31', status: '已过期' },
    { id: 'AU-2026-0182', person: '郑工',   type: '高风险作业授权',   group: 'infra',  scope: 'UPS 电池组测试', validTo: '2026-12-31', status: '有效' },
    { id: 'AU-2026-0181', person: '陈工',   type: '工作负责人授权',   group: 'app',    scope: '业务系统升级', validTo: '2027-03-31', status: '有效' },
    { id: 'AU-2026-0180', person: '孙工',   type: '准备工程师授权',   group: 'online', scope: '监测平台巡检', validTo: '2027-01-01', status: '有效' },
    { id: 'AU-2026-0199', person: '王主管', type: '工作负责人授权',   group: 'app',    scope: '应用组变更发布统筹', validTo: '2027-06-30', status: '有效' },
    { id: 'AU-2026-0198', person: '郭工',   type: '登高车作业授权',   group: 'comm',   scope: '通信杆路与登高作业', validTo: '2027-01-01', status: '有效' },
    { id: 'AU-2026-0197', person: '林工',   type: 'RP1 授权',         group: 'app',    scope: 'RP1 业务系统操作', validTo: '2027-03-31', status: '有效' },
    { id: 'AU-2026-0196', person: '冯工',   type: '低压电工证',       group: 'online', scope: '低压配电与终端作业', validTo: '2026-12-31', status: '有效' },
    { id: 'AU-2026-0195', person: '袁工',   type: '高压电工证',       group: 'infra',  scope: '高压配电室作业', validTo: '2026-10-31', status: '已过期' },
    { id: 'AU-2026-0194', person: '罗工',   type: 'RP2 授权',         group: 'comm',   scope: 'RP2 网络设备操作', validTo: '2027-01-31', status: '有效' },
    { id: 'AU-2026-0193', person: '曹工',   type: '工具库授权',       group: 'online', scope: '在线监测工具借还', validTo: '2027-01-01', status: '有效' },
    { id: 'AU-2026-0192', person: '赵主管', type: '高风险作业授权',   group: 'comm',   scope: '通信割接高风险作业统筹', validTo: '2027-05-31', status: '有效' },
    { id: 'AU-2026-0191', person: '高工',   type: '登高车作业授权',   group: 'app',    scope: '应用现场登高作业', validTo: '2026-09-30', status: '已过期' },
    { id: 'AU-2026-0190', person: '宋工',   type: '工具库授权',       group: 'comm',   scope: '通信工具与仪表借还', validTo: '2027-02-28', status: '有效' },
    { id: 'AU-2026-0189', person: '李主管', type: '准备工程师授权',   group: 'online', scope: '在线监测变更准备', validTo: '2026-12-31', status: '有效' },
    { id: 'AU-2026-0188', person: '潘工',   type: '低压电工证',       group: 'infra',  scope: '机房低压配电作业', validTo: '2027-04-30', status: '有效' }
  ];

  /* 模拟作业授权补全：按专业组资格分配，目标为有效持有人数（含临期，不含已过期）。 */
  (function seedWorkAuthorizations() {
    const TARGETS = [
      { type: '工作负责人授权',   target: 8, groups: ['app'],                        scope: '作业组织、安全交底与现场管控' },
      { type: '准备工程师授权',   target: 8, groups: ['app'],                        scope: '作业准备、隔离验证与风险识别' },
      { type: '高风险作业授权',   target: 6, groups: ['comm'],                       scope: '高风险作业现场管控与监护' },
      { type: 'RP1 授权',         target: 5, groups: ['comm'],                       scope: 'RP1 系统操作与隔离验证' },
      { type: 'RP2 授权',         target: 5, groups: ['comm', 'online'],             scope: 'RP2 系统操作与设备隔离' },
      { type: '登高车作业授权',   target: 6, groups: ['comm', 'infra'],              scope: '登高车作业与防坠落措施' },
      { type: '低压电工证',       target: 6, groups: ['online', 'infra'],            scope: '低压配电与电气作业' },
      { type: '高压电工证',       target: 3, groups: ['infra'],                      scope: '高压配电与倒闸操作' },
      { type: '工具库授权',       target: 8, groups: ['app', 'comm', 'online', 'infra'], scope: '工具库借还、校验与盘点' }
    ];
    const VALID_TO = ['2027-03-31', '2027-06-30', '2027-09-30'];
    const workCount = {};
    let seq = 200;
    let added = 0;
    auths.forEach(function (a) {
      workCount[a.person] = (workCount[a.person] || 0) + 1;
    });
    TARGETS.forEach(function (cfg) {
      const held = {};
      let current = 0;
      auths.forEach(function (a) {
        if (a.type !== cfg.type) return;
        held[a.person] = true;
        if (a.status !== '已过期') current += 1;
      });
      let guard = 0;
      while (current < cfg.target && guard < 200) {
        guard += 1;
        let best = null;
        let bestCount = 99;
        staff.forEach(function (p) {
          if (cfg.groups.indexOf(p.group) === -1 || held[p.name]) return;
          const count = workCount[p.name] || 0;
          if (count >= 3) return;
          if (count < bestCount) {
            best = p;
            bestCount = count;
          }
        });
        if (!best) break;
        auths.push({
          id: 'AU-2026-' + ('000' + seq).slice(-4),
          person: best.name,
          type: cfg.type,
          group: best.group,
          scope: cfg.scope,
          validTo: VALID_TO[added % VALID_TO.length],
          status: '有效'
        });
        held[best.name] = true;
        workCount[best.name] = bestCount + 1;
        seq += 1;
        added += 1;
        current += 1;
      }
    });
  })();

  const messages = [
    { id: 'MSG-001', type: '审批', title: '高风险作业授权待审批', body: 'T10027-03「UPS 电池组测试」已提交高风险作业授权，请尽快完成审批。', time: '2026-11-02 18:20', read: false },
    { id: 'MSG-002', type: '超期', title: 'UPS 电池组测试已超期', body: 'T10027-03「UPS 电池组测试」已超过截止时间 5 天，请优先处置。', time: '2026-11-02 20:00', read: false },
    { id: 'MSG-003', type: '巡检', title: '网络设备日检发现 2 项异常', body: '核心交换机 2 个端口错包增长，系统已自动生成整改任务。', time: '2026-10-31 07:40', read: false },
    { id: 'MSG-004', type: '值班', title: '每周值班交接提醒', body: '下周一 08:00 进行周值班交接，请提前完成未闭环任务、在途变更与告警确认。', time: '2026-11-01 18:00', read: true },
    { id: 'MSG-005', type: '发布', title: '业务系统 v3.6.2 发布完成', body: 'KNS 业务系统 v3.6.2 已于 22:10 完成发布，回归验证通过。', time: '2026-10-30 22:10', read: true },
    { id: 'MSG-006', type: '报表', title: '最近一期运维月报已生成', body: '最近一期个人月报已生成，可在「个人统计」中预览并导出。', time: '2026-10-31 09:00', read: true }
  ];

  /* 预警规则：condition 由 type + threshold 生成，引擎按 type 真实判定。 */
  const alertRules = [
    {
      id: 'R-01', name: '任务超期提醒', type: 'taskOverdue', threshold: 2, unit: '小时',
      scope: 'all', severity: '警告', condition: '未完成且超期 > 2 小时', channel: '站内',
      dedupeMinutes: 30, enabled: true,
      createdAt: '2026-09-01 09:00', createdBy: '系统',
      updatedAt: '2026-09-01 09:00', updatedBy: '系统',
      lastFiredAt: '', fireCount: 0, lastSignature: ''
    },
    {
      id: 'R-02', name: '高风险作业审批超时', type: 'approvalTimeout', threshold: 30, unit: '分钟',
      scope: 'all', severity: '严重', condition: '高风险审批未处理 > 30 分钟', channel: '站内',
      dedupeMinutes: 30, enabled: true,
      createdAt: '2026-09-02 09:00', createdBy: '系统',
      updatedAt: '2026-09-02 09:00', updatedBy: '系统',
      lastFiredAt: '', fireCount: 0, lastSignature: ''
    },
    {
      id: 'R-03', name: '巡检异常', type: 'inspectionException', threshold: 1, unit: '项',
      scope: 'all', severity: '警告', condition: '近 7 天巡检异常项 ≥ 1', channel: '站内',
      dedupeMinutes: 30, enabled: true,
      createdAt: '2026-09-03 09:00', createdBy: '系统',
      updatedAt: '2026-09-03 09:00', updatedBy: '系统',
      lastFiredAt: '', fireCount: 0, lastSignature: ''
    },
    {
      id: 'R-04', name: 'SLA 达成率预警', type: 'slaThreshold', threshold: 97, unit: '%',
      scope: 'all', severity: '严重', condition: 'SLA 达成率 < 97%', channel: '站内',
      dedupeMinutes: 30, enabled: true,
      createdAt: '2026-09-04 09:00', createdBy: '系统',
      updatedAt: '2026-09-04 09:00', updatedBy: '系统',
      lastFiredAt: '', fireCount: 0, lastSignature: ''
    },
    {
      id: 'R-05', name: '值班交接超时', type: 'dutyHandover', threshold: 15, unit: '分钟',
      scope: 'all', severity: '警告', condition: '周一 08:15 未确认交接', channel: '站内',
      dedupeMinutes: 30, enabled: true,
      createdAt: '2026-09-05 09:00', createdBy: '系统',
      updatedAt: '2026-09-05 09:00', updatedBy: '系统',
      lastFiredAt: '', fireCount: 0, lastSignature: ''
    }
  ];

  const logs = [
    { time: '2026-11-02 20:12', actor: '郑工',   action: '提交高风险审批', target: 'T10027-03 UPS 电池组测试', type: '审批' },
    { time: '2026-11-02 19:40', actor: '赵工',   action: '派发任务', target: 'T10025-02 割接实施与回退验证', type: '任务' },
    { time: '2026-11-02 18:25', actor: '系统',   action: '发送超期提醒', target: 'T10023-01 策略评审与审批', type: '系统' },
    { time: '2026-11-02 16:10', actor: '李工',   action: '更新任务状态', target: 'T10026-02 开发与测试', type: '任务' },
    { time: '2026-11-01 18:00', actor: '系统',   action: '生成值班交接提醒', target: '下周值班人', type: '系统' },
    { time: '2026-10-31 15:20', actor: '刘工',   action: '完成维保记录', target: 'MR-301 机房空调季度维保', type: '维保' },
    { time: '2026-10-31 09:00', actor: '系统',   action: '生成月度报表', target: '最近一期运维月报', type: '系统' },
    { time: '2026-10-30 22:10', actor: '陈工',   action: '发布版本', target: 'KNS v3.6.2', type: '变更' },
    { time: '2026-10-30 14:05', actor: '孙工',   action: '新增预警规则', target: 'R-03 巡检异常', type: '配置' },
    { time: '2026-10-29 11:30', actor: '系统',   action: '同步组织架构', target: '4 个专业组 / 8 人', type: '系统' }
  ];

  const achievements = [
    { name: '机房', stars: 3, count: 12, group: 'infra',  desc: '核心机房巡检与动力环境保障' },
    { name: 'KCC',  stars: 2, count: 8,  group: 'app',    desc: '核心业务系统变更与发布' },
    { name: 'KNS',  stars: 2, count: 6,  group: 'app',    desc: 'KNS 接口与性能优化' },
    { name: '通信线路', stars: 2, count: 5, group: 'comm', desc: '通信线路维护与应急保障' },
    { name: '终端', stars: 1, count: 3,  group: 'online', desc: '终端安全与基线核查' },
    { name: 'DTT',  stars: 1, count: 2,  group: 'online', desc: '监测数据质量专项' }
  ];

  /* 个人成就：人员标签带 1–3 星，任务标签只累计完成次数 */
  const personAchievements = [
    { person: '李工', name: 'KCC', type: '人员标签', stars: 3, count: 12, firstClaimed: '2025-08-12', desc: '核心业务系统变更与发布' },
    { person: '李工', name: 'KNS', type: '人员标签', stars: 2, count: 8,  firstClaimed: '2025-11-03', desc: 'KNS 接口与性能优化' },
    { person: '李工', name: '终端', type: '人员标签', stars: 1, count: 4,  firstClaimed: '2026-01-18', desc: '终端安全与基线核查' },
    { person: '李工', name: '机房', type: '任务标签', stars: 0, count: 8,  firstClaimed: '2025-09-06', desc: '核心机房巡检与动力环境保障' },
    { person: '李工', name: 'DTT',  type: '任务标签', stars: 0, count: 2,  firstClaimed: '2026-02-11', desc: '监测数据质量专项' },
    { person: '王主管', name: 'KCC', type: '人员标签', stars: 2, count: 9,  firstClaimed: '2025-09-02', desc: '核心业务系统变更与发布' },
    { person: '张经理', name: 'KCC', type: '人员标签', stars: 1, count: 3, firstClaimed: '2025-10-21', desc: '核心业务系统变更与发布' },
    { person: '张经理', name: '巡检', type: '任务标签', stars: 0, count: 5, firstClaimed: '2025-11-27', desc: '季度巡检与整改闭环' },
    { person: '张经理', name: '变更', type: '任务标签', stars: 0, count: 4, firstClaimed: '2026-02-03', desc: '高风险变更与割接审批' },
    { person: '陈工', name: 'KCC', type: '人员标签', stars: 2, count: 7, firstClaimed: '2025-10-12', desc: '核心业务系统变更与发布' },
    { person: '陈工', name: '机房', type: '人员标签', stars: 1, count: 3, firstClaimed: '2026-01-08', desc: '核心机房巡检与动力环境保障' },
    { person: '赵工', name: '通信线路', type: '人员标签', stars: 3, count: 11, firstClaimed: '2025-07-21', desc: '通信线路维护与应急保障' },
    { person: '周工', name: '通信网络', type: '人员标签', stars: 2, count: 6, firstClaimed: '2025-11-15', desc: '通信网络配置与故障处置' },
    { person: '孙工', name: '终端', type: '人员标签', stars: 3, count: 9, firstClaimed: '2025-09-03', desc: '终端安全与基线核查' },
    { person: '吴工', name: '终端', type: '人员标签', stars: 2, count: 5, firstClaimed: '2026-02-17', desc: '终端安全与基线核查' },
    { person: '刘工', name: '机房', type: '人员标签', stars: 3, count: 13, firstClaimed: '2025-06-11', desc: '核心机房巡检与动力环境保障' },
    { person: '郑工', name: '机房', type: '人员标签', stars: 2, count: 7, firstClaimed: '2025-12-01', desc: '核心机房巡检与动力环境保障' }
  ];

  /* 新成员的能力标签：让个人统计 / 月报有内容 */
  const GROUP_TAG = { app: 'KCC', comm: '通信线路', online: '终端', infra: '机房' };
  const GROUP_TAG_DESC = {
    app: '核心业务系统变更与发布',
    comm: '通信线路维护与应急保障',
    online: '终端安全与基线核查',
    infra: '核心机房巡检与动力环境保障'
  };
  staff.filter(function (p) { return Number(String(p.uid).slice(1)) > 20008; }).forEach(function (p, i) {
    const tag = GROUP_TAG[p.group];
    const exists = personAchievements.some(function (a) {
      return a.person === p.name && a.type === '人员标签';
    });
    if (!tag || exists) return;
    personAchievements.push({
      person: p.name,
      name: tag,
      type: '人员标签',
      stars: (i % 3) + 1,
      count: 3 + (i % 8),
      firstClaimed: '2025-' + pad2((i % 9) + 1) + '-' + pad2((i % 20) + 1),
      desc: GROUP_TAG_DESC[p.group]
    });
  });

  /* 能力标签补充：每人至少保留 2 个非授权类人员标签，避免个人详情过空。 */
  const GROUP_EXTRA_TAGS = {
    app: ['接口平台', '应用系统', '数据库', '报表平台'],
    comm: ['通信线路', '通信网络', '通信传输', '应急通信', '通信值班'],
    online: ['监测平台', '采集终端', '桌面运维', '网络安全'],
    infra: ['动力环境', '供配电', '暖通空调', '消防安防']
  };
  const EXTRA_TAG_DESC = {
    '接口平台': '接口联调与平台接入保障',
    '应用系统': '业务系统运行维护与发布',
    '数据库': '数据库运维、备份与性能优化',
    '报表平台': '报表开发与数据质量保障',
    '通信线路': '通信线路维护与应急保障',
    '通信网络': '通信网络配置与故障处置',
    '通信传输': '传输链路维护与切换验证',
    '应急通信': '应急通信保障与现场处置',
    '通信值班': '通信值班调度与交接',
    '监测平台': '监测平台运行维护与告警处置',
    '采集终端': '采集终端配置与数据核对',
    '桌面运维': '桌面终端与办公设备维护',
    '网络安全': '网络安全策略与基线核查',
    '动力环境': '机房动力环境巡检与保障',
    '供配电': '供配电系统维护与倒换验证',
    '暖通空调': '暖通空调运行维护',
    '消防安防': '消防安防设施巡检与联动'
  };
  staff.forEach(function (p, i) {
    p.tags = (p.tags || []).slice();
    const domainTags = ['KCC', 'KNS', '终端', '机房', '通信线路', '通信网络', '通信传输', '应急通信', '通信值班'];
    const hasDomain = domainTags.some(function (name) { return p.tags.indexOf(name) > -1; });
    if (!hasDomain && GROUP_TAG[p.group]) p.tags.push(GROUP_TAG[p.group]);
    const staffPool = (GROUP_EXTRA_TAGS[p.group] || []).filter(function (name) { return p.tags.indexOf(name) === -1; });
    if (staffPool.length) p.tags.push(staffPool[i % staffPool.length]);
    p.tags = p.tags.filter(function (tag, idx, list) { return list.indexOf(tag) === idx; });
  });

  staff.forEach(function (p, i) {
    const own = personAchievements.filter(function (a) {
      return a.person === p.name && a.type === '人员标签';
    }).map(function (a) { return a.name; });
    const need = 2 - own.length;
    if (need <= 0) return;
    const pool = (GROUP_EXTRA_TAGS[p.group] || []).filter(function (name) {
      return own.indexOf(name) === -1;
    });
    if (!pool.length) return;
    for (let n = 0; n < need && n < pool.length; n += 1) {
      const name = pool[(i + n) % pool.length];
      if (own.indexOf(name) > -1) continue;
      own.push(name);
      personAchievements.push({
        person: p.name,
        name: name,
        type: '人员标签',
        stars: (i % 3) + 1,
        count: 3 + ((i + n) % 8),
        firstClaimed: '2025-' + pad2((i % 9) + 1) + '-' + pad2((i % 20) + 1),
        desc: EXTRA_TAG_DESC[name] || '专业能力标签'
      });
    }
  });

  const permissions = {
    leader:   { task: true,  inspect: true,  duty: true,  maintain: true,  overhaul: true, group: true,  auth: true,  message: true,  dictionary: false, config: false },
    manager:  { task: true,  inspect: true,  duty: true,  maintain: true,  overhaul: true, group: true,  auth: true,  message: true,  dictionary: false, config: false },
    employee: { task: true,  inspect: false, duty: true,  maintain: false, overhaul: true, group: false, auth: true,  message: true,  dictionary: false, config: false },
    admin:    { task: false, inspect: false, duty: false, maintain: false, overhaul: false, group: true,  auth: false, message: false, dictionary: true,  config: true  },
    super:    { task: true,  inspect: true,  duty: true,  maintain: true,  overhaul: true, group: true,  auth: true,  message: true,  dictionary: true,  config: true  }
  };

  const roleInfo = {
    leader:   { name: '张经理',       role: '领导层',     avatar: '领', title: '运营负责人', desc: '领导审批、任务编辑与个人月报' },
    manager:  { name: '王主管',     role: '主管层',     avatar: '主', title: '应用组主管', desc: '任务拆分、派发审批与日常管理' },
    employee: { name: '赵工',       role: '员工层',     avatar: '赵', title: '高级工程师', desc: '通信组值班、任务执行与个人授权' },
    admin:    { name: '系统管理员', role: '系统管理员', avatar: '管', title: '平台管理员', desc: '平台配置、组织架构与审计' },
    super:    { name: '全局管理员', role: '超级管理员', avatar: '全', title: '全部模块与操作', desc: '开发调试：全模块可见、全操作可用' }
  };

  const taskTags = [
    '机房', '终端', 'KCC', 'KNS', 'KDN', 'KSM', 'DTT', 'DKM', 'DTD', 'DTC', 'DTW',
    'DTP', 'DTG', 'DTA', 'DTS', 'DTI', 'DTV', '视频会议系统', '卫星电话系统',
    '无线对讲系统', '厂房通信系统'
  ];

  const taskTagMeta = [
    { name: '机房', count: 12, firstClaimed: '2025-09-18', desc: '核心机房巡检与动力环境保障' },
    { name: '终端', count: 3,  firstClaimed: '2026-01-12', desc: '终端安全与基线核查' },
    { name: 'KCC',  count: 8,  firstClaimed: '2025-08-26', desc: '核心业务系统变更与发布' },
    { name: 'KNS',  count: 6,  firstClaimed: '2025-10-09', desc: 'KNS 接口与性能优化' },
    { name: 'KDN',  count: 4,  firstClaimed: '2025-12-16', desc: 'KDN 网络配置与维护' },
    { name: 'KSM',  count: 3,  firstClaimed: '2026-01-22', desc: 'KSM 服务管理与巡检' },
    { name: 'DTT',  count: 2,  firstClaimed: '2026-02-08', desc: '监测数据质量专项' },
    { name: 'DKM',  count: 1,  firstClaimed: '2026-02-19', desc: 'DKM 数据接口维护' },
    { name: 'DTD',  count: 2,  firstClaimed: '2026-03-04', desc: 'DTD 数据链路排查' },
    { name: 'DTC',  count: 2,  firstClaimed: '2026-03-12', desc: 'DTC 采集终端配置' },
    { name: 'DTW',  count: 1,  firstClaimed: '2026-03-21', desc: 'DTW 无线链路维护' },
    { name: 'DTP',  count: 1,  firstClaimed: '2026-04-02', desc: 'DTP 平台参数调整' },
    { name: 'DTG',  count: 1,  firstClaimed: '2026-04-13', desc: 'DTG 网关配置维护' },
    { name: 'DTA',  count: 1,  firstClaimed: '2026-04-24', desc: 'DTA 应用接入调试' },
    { name: 'DTS',  count: 1,  firstClaimed: '2026-05-07', desc: 'DTS 服务状态核查' },
    { name: 'DTI',  count: 1,  firstClaimed: '2026-05-15', desc: 'DTI 接口联调验证' },
    { name: 'DTV',  count: 1,  firstClaimed: '2026-05-26', desc: 'DTV 视频链路维护' },
    { name: '视频会议系统', count: 2, firstClaimed: '2025-11-11', desc: '视频会议终端与链路保障' },
    { name: '卫星电话系统', count: 1, firstClaimed: '2025-12-23', desc: '卫星电话终端测试' },
    { name: '无线对讲系统', count: 2, firstClaimed: '2026-01-28', desc: '无线对讲覆盖优化' },
    { name: '厂房通信系统', count: 3, firstClaimed: '2025-10-30', desc: '厂房通信线路巡检' }
  ];

  function wallStars(count, star2, star3) {
    const two = Number(star2) || 5;
    const three = Number(star3) || 10;
    if (count >= three) return 3;
    if (count >= two) return 2;
    return 1;
  }

  const personStarRules = {
    KCC: { star2: 5, star3: 10 },
    KNS: { star2: 5, star3: 10 },
    '终端': { star2: 3, star3: 8 },
    '机房': { star2: 5, star3: 10 }
  };

  const achievementWall = (function () {
    const personMap = {};
    personAchievements.filter(function (a) { return a.type === '人员标签'; }).forEach(function (a) {
      if (!personMap[a.name]) {
        const rules = personStarRules[a.name] || { star2: 5, star3: 10 };
        personMap[a.name] = {
          name: a.name, type: '人员标签', count: 0, stars: 0,
          star2: rules.star2, star3: rules.star3,
          firstClaimed: a.firstClaimed || '', desc: a.desc || '',
          unlock: '完成对应标签任务并累计提升星级'
        };
      }
      personMap[a.name].count += a.count;
      if (!personMap[a.name].firstClaimed || a.firstClaimed < personMap[a.name].firstClaimed) {
        personMap[a.name].firstClaimed = a.firstClaimed;
      }
    });
    const personTags = Object.keys(personMap).map(function (name) {
      const tag = personMap[name];
      tag.stars = wallStars(tag.count, tag.star2, tag.star3);
      return tag;
    });
    const taskWall = taskTags.map(function (name) {
      const meta = taskTagMeta.find(function (m) { return m.name === name; }) || {};
      return {
        name: name, type: '任务标签', count: meta.count || 0, stars: 0, star2: 0, star3: 0,
        desc: meta.desc || '完成对应任务后累计',
        unlock: '完成对应任务'
      };
    });
    return personTags.concat(taskWall);
  })();

  const authTypes = [
    '无需授权', '工作负责人授权', '准备工程师授权', '高风险作业授权',
    'RP1 授权', 'RP2 授权', '登高车作业授权', '低压电工证', '高压电工证', '工具库授权'
  ];


  function shiftSnapshot(value, offset, key) {
    if (Array.isArray(value)) {
      return value.map(function (item) { return shiftSnapshot(item, offset, null); });
    }
    if (value && typeof value === 'object') {
      Object.keys(value).forEach(function (k) {
        if (k === 'joined' || k === 'duty') return;
        value[k] = shiftSnapshot(value[k], k === 'validTo' ? authDateOffset : offset, k);
      });
      return value;
    }
    if (typeof value === 'string' && key !== 'joined') {
      const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})( \d{2}:\d{2})?$/);
      if (iso) {
        const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
        d.setDate(d.getDate() + offset);
        return dayKey(d) + (iso[4] || '');
      }
      const md = value.match(/^(\d{2})\/(\d{2})$/);
      if (md) {
        const d = new Date(BASE_YEAR, Number(md[1]) - 1, Number(md[2]));
        d.setDate(d.getDate() + offset);
        return pad2(d.getMonth() + 1) + '/' + pad2(d.getDate());
      }
    }
    return value;
  }

  // 大修管理种子数据（来源：HZ101 大修任务内容.xlsx，2026-11-08 导入）
  const overhaul = {"project": "HZ101 大修专项行动", "items": [{"seq": 1, "name": "大修方案编写", "cat": "文件支持", "group": "comm", "phase": "大修前", "desc": "信息文档部大修方案编写，编制大修信息文档部工作方案编制HZ101大修信息文档部工作方案。升版《信息文档部HZ101大修工作方案》。；信息文档部大修方案编写，编制大修信息文档部工作方案编制HZ101大修信息文档部工作方案。升版《信息文档部HZ101大修工作方案》。；信息文档部大修方案编写，编制大修信息文档部工作方案编制HZ101大修信息文档部工作方案。升版《信息文档部HZ101大修工作方案》。", "output": "大修方案", "prio": "高", "owner": "赵工、郭工", "start": "2026-09-04", "due": "2026-11-30", "days": "87", "status": "进行中", "progress": ["", "正在编写中", "DTW应急处置标准作业卡编写中", "编写中", "编写中", ""], "risk": ""}, {"seq": 2, "name": "通信机房空调需求反馈", "cat": "物资保障", "group": "comm", "phase": "大修前", "desc": "核岛通信机房空调需求反馈", "output": "", "prio": "低", "owner": "郭工", "start": "2026-09-10", "due": "2026-09-30", "days": "20", "status": "已完成", "progress": ["已完成", "", "", "", "", ""], "risk": ""}, {"seq": 3, "name": "技术科大修工作动员会组织", "cat": "人员保障", "group": "comm", "phase": "大修前", "desc": "信息文档部信息技术科大修工作动员会组织，召开大修启动会，确定大修期间职责及要求。；信息文档部信息技术科大修工作动员会组织，召开大修启动会，确定大修期间职责及要求。", "output": "1、会议签到表", "prio": "低", "owner": "赵工、郭工", "start": "2026-09-10", "due": "2026-09-30", "days": "20", "status": "已完成", "progress": ["已完成", "", "", "", "", ""], "risk": ""}, {"seq": 4, "name": "语音配线架阻断端子采购", "cat": "物资保障", "group": "comm", "phase": "大修前", "desc": "CTT打压保障：语音配线架阻断端子采购", "output": "1、阻断端子验收清单", "prio": "高", "owner": "周工、罗工", "start": "2026-09-10", "due": "2026-10-30", "days": "50", "status": "已完成", "progress": ["已完成采购流程发起，待到货。", "", "正在采购中，预计月底到货。", "已到货", "", ""], "risk": ""}, {"seq": 5, "name": "通信文件支持", "cat": "文件支持", "group": "comm", "phase": "大修前", "desc": "配合CCT安全壳打压1）根据CTT安全壳打压专项工作组的通知，配合断开、恢复BRA内DTV系统信号；2）拆除、重新安装BRA内临时监控设备、临时电话等；；1、反应堆厂房DTT/DTI电话隔离线位清单；2、反应堆厂房时钟信号隔离清单（机柜侧）；3、反应堆厂房广播信号隔离清单（机柜侧）；4、反应堆厂房声警报信号隔离清单（机柜侧）；5、反应堆厂房无线通信信号隔离清单（机柜侧）；6、反应堆厂房DTL信号隔离清单（机柜侧）", "output": "1、通信系统隔离清单", "prio": "中等", "owner": "梁工", "start": "2026-09-10", "due": "2026-10-15", "days": "35", "status": "已完成", "progress": ["广播信号已提供", "已完成提供", "", "", "", ""], "risk": ""}, {"seq": 6, "name": "通信监控线路资源统计", "cat": "文件支持", "group": "comm", "phase": "大修前", "desc": "临时监控线路资源统计；1、反应堆厂房贯穿件电话线缆清册；2、反应堆厂房贯穿件广播线缆清册；3、反应堆厂房贯穿件时钟线缆清册；4、反应堆厂房贯穿件声警报线缆清册；5、反应堆厂房贯穿件DTL线缆清册；6、贯穿件冗余光缆资源清单", "output": "1、通信系统贯穿件光/电缆清单", "prio": "中等", "owner": "梁工", "start": "2026-09-10", "due": "2026-09-30", "days": "20", "status": "已完成", "progress": ["广播贯穿件清单已提供", "已完成提供", "", "", "", ""], "risk": ""}, {"seq": 7, "name": "人员学习与梳理", "cat": "人员保障", "group": "comm", "phase": "大修前", "desc": "1、外派人员学习外基地大修，组织团队技能实操提升；；2、全面梳理前后台人员情况，落实前后台技术人员支持人员名单及其支援职责；", "output": "1、外基地参修总结报告", "prio": "中等", "owner": "唐工、许工、宋工", "start": "2026-10-14", "due": "2026-11-10", "days": "27", "status": "进行中", "progress": ["", "许工+周工、郭工+周皓", "周工、肖工", "周工、邓工，周工10.20日已赴防城港学习", "周工10.20日已赴防城港学习并开展重点项目对标，计划11月1日返回惠州基地", "已赴防城港学习并开展重点项目对标并完成对标总结报告，待分享"], "risk": ""}, {"seq": 8, "name": "需求收集", "cat": "物资保障", "group": "comm", "phase": "大修前", "desc": "大修综合布线需求收集（网络、打印机）", "output": "1、信息化办公设备需求清单", "prio": "高", "owner": "梁工、周工", "start": "2026-09-10", "due": "2026-09-30", "days": "20", "status": "已完成", "progress": ["已与指挥部沟通，正在收集各专业需求", "计划邮件收集指挥部集装箱用途需求，同步开展大修集装箱网络设施正式实施方案编写", "已完成", "", "", ""], "risk": ""}, {"seq": 9, "name": "方案确定", "cat": "文件支持", "group": "comm", "phase": "大修前", "desc": "大修综合布线方案确定", "output": "1、大修集装箱布线方案", "prio": "高", "owner": "梁工、周工", "start": "2026-10-15", "due": "2026-10-30", "days": "15", "status": "进行中", "progress": ["", "", "完成初稿方案编写，待根据需求优化方案", "大修计划科已邮件回复确认网络布置点，待大修指挥部召开集装箱分布会议后，进行最终确认。现在已完成出版方案编写，待汇报", "现场方案已确定，待下周与中核检修确认现场", "以确定现场，待综合检修反馈具体施工量及耗材。"], "risk": "风险"}, {"seq": 10, "name": "实施与调试", "cat": "现场实施", "group": "comm", "phase": "大修前", "desc": "大修综合布线实施与调试（含室外光交箱）", "output": "", "prio": "高", "owner": "梁工、周工", "start": "2026-11-01", "due": "2027-02-01", "days": "", "status": "尚未开始", "progress": ["", "", "", "已与大修指挥部核实现场，确定集装箱功能及网络保障区域", "已申请采购室外光交箱和光缆，待采购到货后实施。", "已申请采购室外光交箱和光缆，待采购到货后实施。"], "risk": ""}, {"seq": 11, "name": "收集信息化需求", "cat": "物资保障", "group": "comm", "phase": "大修前", "desc": "联系大修指挥部，收集信息化需求联系大修指挥部，收集用户大修期间信息化需求。；1、会议室、电脑、打印机、电话等办公需求。；2、临时运营商信号覆盖需求收集", "output": "1、信息化办公设备需求清单", "prio": "高", "owner": "赵工、郭工", "start": "2026-09-10", "due": "2026-11-15", "days": "66", "status": "进行中", "progress": ["已与指挥部沟通，正在收集各专业需求", "已与指挥部沟通，已收集各专业初步需求，计划开展筛选", "1、网络、电话、电脑、打印机、投影仪、DTW手机、平板需求已向指挥部收集", "1、网络、电话、电脑、打印机、投影仪、DTW手机、平板需求已向指挥部收集", "1、网络、电话、电脑、打印机、投影仪、DTW手机、平板需求已向指挥部收集，其中投影仪需求41台，财务审核仅能满足10台，已邮件通知各专业。", "1、网络、电话、电脑、打印机、投影仪、DTW手机、平板需求已向指挥部收集，其中投影仪需求41台，财务审核仅能满足10台，已邮件通知各专业。"], "risk": ""}, {"seq": 12, "name": "视频监控需求确定", "cat": "物资保障", "group": "comm", "phase": "大修前", "desc": "临时视频监控需求确定；1、收集大修视频监控需求、运营商信号室内覆盖需求1）联系各参修部门，收集视频监控需求；；2、确定一级高风险作业的视频监控需求与工业安全科/大修指挥部确定一级高风险作业的视频监控需求，制定安装计划、并按计划进行安装；；向大修指挥部提出需求；1、临时视频监控电源盘借用；（具体数量）；2、临时视频监控、集装箱布线临时过桥资源；（具体数量）", "output": "1、监控需求清单定稿", "prio": "高", "owner": "邓工", "start": "2026-10-15", "due": "2026-11-15", "days": "31", "status": "进行中", "progress": ["", "", "指挥部已提供监控需求，需进一步确认。", "指挥部已提供监控需求，需进一步确认。", "待与大修指挥部组织会议沟通，开会前先针对需求进行点位探勘。", "待与大修指挥部组织会议沟通，开会前先针对需求进行点位探勘。"], "risk": "风险"}, {"seq": 13, "name": "备件清单", "cat": "物资保障", "group": "comm", "phase": "大修前", "desc": "大修备件清单，生成已有备件清单（包含A/B类备件，广播、电话、警报、DTWAP、天线等终端）、包含工程移交备件清单。", "output": "1、备件清单", "prio": "中等", "owner": "梁工", "start": "2026-09-10", "due": "2026-09-30", "days": "20", "status": "已完成", "progress": ["暂无进展", "", "正在梳理，10月22日前提供", "已完成全部备件清单梳理，待进一步筛选。", "已完成", ""], "risk": ""}, {"seq": 14, "name": "授权办理与统计", "cat": "人员保障", "group": "comm", "phase": "大修前", "desc": "1、大修所需授权办理流程核实跟踪（工业安全、辐射防护二级、安全员、监火员、防异物授权）；2、大修信息化人员授权统计及培训完成团队内工作负责人、安全员、RP2等授权统计，及时根据需求开展相关培训；3、大修安全质量相关要求培训宣贯根据大修指挥部要求完成HZ101大修安全质量等要求培训宣贯，大修前对现场主要作业人员至少开展一次宣贯、大修前开展不少于三次的防人因、防异物等安全质量培训、编制每日施工计划，每日碰头会跟踪施工进展，对于高风险作业做到提前识别并安排专人现场监护；；4、隔离区授权考试；", "output": "1、考试成绩单", "prio": "高", "owner": "赵工、唐工、孙工", "start": "2026-09-10", "due": "2027-01-31", "days": "143", "status": "进行中", "progress": ["梳理要求：", "", "详见《大修人员专项跟踪》", "详见《大修人员专项跟踪》", "详见《大修人员专项跟踪》", "详见《大修人员专项跟踪》"], "risk": "风险"}, {"seq": 15, "name": "工单跟踪", "cat": "现场实施", "group": "comm", "phase": "大修前", "desc": "大修预防性工单、大修支持工单准备跟踪，预防性维修工作执行DTA、DTP系统预防性维修工作票执行：；1、RX区域DTT、DTI、DTG系统终端设备检查对RX区域DTT、DTI、DTG系统终端设备检查。；2、RX区域应急通信系统终端检查对RX区域广播、声警报、DTW系统终端设备检查及关注广播声音大小影响。；3、RX 17.5米防异物检查对RX 17.5米DTV设备进行安装紧固性检查；4、拆装摄像头总票；拆装电话总票；；并在宜搭《惠州核电大修质量监督平台》完成HZ101工作票质量审/读包及风险识别。", "output": "1、工单进展跟踪表", "prio": "高", "owner": "郭工、赵主管", "start": "2026-09-10", "due": "2026-10-31", "days": "51", "status": "进行中", "progress": ["1号机PTS项目全部完成准备；", "1号机PTS项目全部完成准备；", "1号机4张PTS工作票已全部完成准备；", "HZ101 4张PTS工作票已全部完成准备；", "HZ101 4张PTS工作票已全部完成准备；", "HZ101 4张PTS工作票已全部完成准备；"], "risk": ""}, {"seq": 16, "name": "广播操作台建设", "cat": "现场实施", "group": "comm", "phase": "大修前", "desc": "大修广播操作台建设，大修广播呼叫站使用培训联系大修指挥部，确定大修广播呼叫站的操作人员，并对其进行使用方法的培训", "output": "1、广播使用培训记录", "prio": "中等", "owner": "郭工", "start": "2026-09-10", "due": "2026-11-30", "days": "81", "status": "进行中", "progress": ["已确定BUA消控室广播操作台作为大修广播操作台使用。", "已确定BUA消控室广播操作台作为大修广播操作台使用", "已确定BUA消控室广播操作台作为大修广播操作台使用", "大修指挥部已确定BUA消控室广播操作台作为大修广播操作台使用，待与安防沟通；", "大修指挥部已确定BUA消控室广播操作台作为大修广播操作台使用，待与安防沟通；", "UA消控室初步与消防负责人韩洪波沟通，因消控室非相关人员免入，不建议作为大修广播间使用，需与邓仕浩科长沟通确定。"], "risk": ""}, {"seq": 17, "name": "指挥中心进度跟踪", "cat": "物资保障", "group": "app", "phase": "大修前", "desc": "大修指挥中心进度跟踪（12月底投用）", "output": "", "prio": "高", "owner": "冯工、吴工", "start": "2026-09-10", "due": "2026-11-30", "days": "81", "status": "进行中", "progress": ["已提票", "", "", "计划表已提供", "计划表已提供", ""], "risk": "风险"}, {"seq": 18, "name": "值班轮岗", "cat": "人员保障", "group": "comm", "phase": "大修前", "desc": "大修值班岗（应急值班与技术值班）；在日常应急值班组织基础上增设大修值班岗，轮换时间与应急值班组织一致；每日召开15分钟保障晨会，各组长汇报前24小时运行情况、当日重点保障任务；关键作业期间（CTT打压、机房切电等），不论班次，相关保障组必须安排专人现场伴随保障。", "output": "1、大修值班表人员清单", "prio": "中等", "owner": "宋工、赵工", "start": "2026-09-10", "due": "2026-12-30", "days": "111", "status": "进行中", "progress": ["暂无进展，待确认人员", "暂无进展，待确认人员", "已梳理值班人员清单。10.20完成最新人员名单确认", "已完成应急值班人员，拟加入具备基本安全授权与RP授权技术值班人员清单并动态更新。", "已梳理值班人员清单，根据人员授权变化持续动态更新。待27年应急值班人员排班确定后插入技术值班岗，清单共享地址：", "已梳理值班人员清单，根据人员授权变化持续动态更新。待27年应急值班人员排班确定后插入技术值班岗，清单共享地址："], "risk": ""}, {"seq": 19, "name": "设备清点与采购", "cat": "物资保障", "group": "comm", "phase": "大修前", "desc": "信息化IT设备等资源准备统计电脑、打印机会议室设备库存，确认设备是否满足需求，库存不足则启动采购；1、大修48口交换机备件跟踪；2、大修模拟电话，IP电话备件跟踪，外线号码开通；；3、执法记录仪使用需求及备件采购；4、大修DTW手机备件准备；5、综合布线光缆、网线备件采购跟踪；6、打印机备件准备；7、笔记本电脑备件准备；8、便携式投影仪准备；9、执法记录仪及摄像头（布控球）、平板（赵工立项）", "output": "1、大修信息化物资入库清单", "prio": "高", "owner": "罗工、赵工、郭工", "start": "2026-09-10", "due": "2026-12-31", "days": "112", "status": "进行中", "progress": ["已提交第三季度采购需求，待发起。", "已提交第三、四季度采购需求，待发起。", "见《大修物资专项跟踪》", "见《大修物资专项跟踪》", "单独立项：平板执法记录仪立项材料已经交育杭，正在走立项流程、摄像头的正在上架（赵工）", ""], "risk": "风险"}, {"seq": 23, "name": "智能柜使用流程", "cat": "物资保障", "group": "app", "phase": "大修前", "desc": "智能柜的使用（DTW、平板等应急取用）", "output": "1、临时应急物资取用流程", "prio": "中等", "owner": "曹工", "start": "2026-09-10", "due": "2027-01-27", "days": "139", "status": "进行中", "progress": ["", "", "初步考虑采用“责任到部门”模式，即设备分配给机械部等业务部门，由部门代表管理并分发给承包商/供应商使用，充电柜仅作为物理存储和充电设施。计划下周联系供应商确认已部署基地智能柜使用方案，确认后联系机械部沟通最终方案。", "", "已调研阳江、宁德智能柜管理现状，待与用户沟通确认最终结果", "信息文档部内部倾向与项目部管理，包含巡检、盘点、授权等工作。"], "risk": ""}, {"seq": 24, "name": "U盘查杀流程", "cat": "文件支持", "group": "online", "phase": "大修前", "desc": "U盘查杀流程准备；U盘查杀流程准备", "output": "1、U盘查杀记录单", "prio": "中等", "owner": "彭工", "start": "2026-09-10", "due": "2027-01-27", "days": "139", "status": "进行中", "progress": ["", "", "正在编写指引与查杀记录单", "", "已完成编写", ""], "risk": ""}, {"seq": 25, "name": "联通5G实施计划", "cat": "文件支持", "group": "infra", "phase": "大修前/中", "desc": "1、联通公网信号开通与电信共享；2、联通5G专网大修施工计划", "output": "1、5G专网大修施工计划", "prio": "高", "owner": "肖工", "start": "2026-09-10", "due": "2027-01-27", "days": "139", "status": "进行中", "progress": ["", "", "5G专网正在进行核心网和1号机厂房的设备安装，完成专网建设开通联通公网，并共享给电信。", "5G专网正在进行核心网和1号机厂房的设备安装，完成专网建设开通联通公网，并共享给电信。", "5G专网核心网调试中预计11月中旬完成。1号机厂房无线设备正在安装，待安装完成后，通过专网设备开通联通公网并共享给电信。", "5G专网核心网调试中预计11月中旬完成。1号机厂房无线设备正在安装，待安装完成后，通过专网设备开通联通公网并共享给电信。"], "risk": "风险"}, {"seq": 26, "name": "应用需求收集", "cat": "文件支持", "group": "comm", "phase": "大修前", "desc": "大修期间搭载DTW网络传输的应用需求收集", "output": "1、网络传输需求收集单", "prio": "中等", "owner": "郭工", "start": "2026-09-10", "due": "2027-01-30", "days": "142", "status": "进行中", "progress": ["", "", "待与指挥部沟通", "待与指挥部沟通", "已按指挥部要求在大修物资收集群发起需求收集，暂无专业反馈", "技术支持科陈帅反馈，有业务传输需求，待提供技术对接人。"], "risk": ""}, {"seq": 27, "name": "准备检查清单", "cat": "现场实施", "group": "comm", "phase": "大修前", "desc": "《大修领域安全质量改进汇编（2019-2026）V5汇编》增加：幽闭空间通讯手段可靠性检查，固定电话、DTW信号等，准备检查清单；", "output": "1、幽闭空间检查单", "prio": "中等", "owner": "周工", "start": "2026-09-10", "due": "2027-01-31", "days": "143", "status": "进行中", "progress": ["", "", "已有幽闭空间清单，正在编写检查表。", "已有幽闭空间清单，正在编写检查表。", "已完成", ""], "risk": ""}, {"seq": 28, "name": "运营商部署方案", "cat": "现场实施", "group": "infra", "phase": "大修前", "desc": "运营商信号补盲设备安装及调试根据运营商信号覆盖设备安装调试计划，完成现场设备安装。（5G方案、运营商临时方案）", "output": "1、运营商信号部署方案", "prio": "高", "owner": "吴工、肖工", "start": "2026-11-15", "due": "2027-02-01", "days": "78", "status": "尚未开始", "progress": ["专项", "", "", "", "", ""], "risk": ""}, {"seq": 29, "name": "设备的安装与调试", "cat": "现场实施", "group": "online", "phase": "大修前", "desc": "1、大修电脑、打印机安装调试安装、调试大修电脑、打印机；2、大修会议室设备安装调试安装、调试大修会议室设备。", "output": "", "prio": "高", "owner": "许工、彭工", "start": "2027-01-01", "due": "2027-02-01", "days": "31", "status": "尚未开始", "progress": ["", "", "", "", "", ""], "risk": ""}, {"seq": 30, "name": "监控平台管理", "cat": "现场实施", "group": "infra", "phase": "大修前", "desc": "信息机房动环监控纳入集团后台24小时统一监控平台纳管", "output": "", "prio": "中等", "owner": "董工、曾工", "start": "2026-10-15", "due": "2026-11-30", "days": "46", "status": "进行中", "progress": ["", "", "正在与运行监控中心沟通，纳入集团动环管理平台", "正在与运行监控中心沟通，纳入集团动环管理平台", "正在与运行监控中心沟通，纳入集团动环管理平台", ""], "risk": ""}, {"seq": 31, "name": "变更", "cat": "物资保障", "group": "infra", "phase": "大修前", "desc": "1、大修期间广域网链路扩容（800M）；2、流控策略匹配调整", "output": "", "prio": "高", "owner": "赵工、董工", "start": "2027-01-01", "due": "2027-02-15", "days": "45", "status": "尚未开始", "progress": ["", "", "", "", "现场设备已具备条件，届时根据需求进行带宽扩容", "现场设备已具备条件，届时根据需求进行带宽扩容"], "risk": ""}, {"seq": 32, "name": "状态修改", "cat": "现场实施", "group": "app", "phase": "大修前", "desc": "Hui主页发电状态修改发电状态改为大修。", "output": "", "prio": "低", "owner": "曹工", "start": "2027-02-26", "due": "2027-02-27", "days": "1", "status": "尚未开始", "progress": ["", "", "", "", "", ""], "risk": ""}, {"seq": 33, "name": "电脑未关机备案", "cat": "文件支持", "group": "online", "phase": "大修前", "desc": "大修前未关机电脑收集统一长期备案制作收集二维码，及时收集新增现场人员统一未关机电脑备案，避免因现场工作加班未备案被通报", "output": "1、电脑备案白名单", "prio": "低", "owner": "田工、彭工", "start": "2026-09-10", "due": "2027-02-27", "days": "170", "status": "已完成", "progress": ["", "", "利用集团现有报备二维码", "利用集团现有报备二维码", "利用集团现有报备二维码", ""], "risk": ""}, {"seq": 34, "name": "准备工作单", "cat": "现场实施", "group": "comm", "phase": "大修中", "desc": "《安全壳试验质量大纲》程序跟踪落实，8号准备工作单", "output": "1、工作准备单执行记录", "prio": "中等", "owner": "郭工", "start": "2027-02-20", "due": "2027-03-20", "days": "28", "status": "尚未开始", "progress": ["", "", "", "", "", ""], "risk": ""}, {"seq": 35, "name": "防异物检查清单", "cat": "现场实施", "group": "comm", "phase": "大修中", "desc": "每轮大修防异物检查，FX/RX防异物清单。", "output": "1、防异物检查结果清单", "prio": "中等", "owner": "梁工", "start": "2027-02-20", "due": "2027-03-20", "days": "28", "status": "尚未开始", "progress": ["", "", "", "", "", ""], "risk": ""}, {"seq": 36, "name": "人员驻厂保障", "cat": "人员保障", "group": "app", "phase": "大修前", "desc": "大修期间电子工单需后台保障人员数量，需驻厂（2—4人）。", "output": "", "prio": "高", "owner": "董工、曹工", "start": "2027-02-15", "due": "2027-04-30", "days": "74", "status": "尚未开始", "progress": ["", "", "", "", "", "尚未开始"], "risk": ""}, {"seq": 37, "name": "设备需求准备", "cat": "现场实施", "group": "online", "phase": "大修前/中", "desc": "大修手机、对讲机、移动视频监控等配置准备根据大修需求，组织梳理DTW手机、对讲机、移动监控、执法记录仪及发放准备。", "output": "1、大修信息化物资出库记录", "prio": "中等", "owner": "许工", "start": "2026-11-01", "due": "2027-04-30", "days": "180", "status": "尚未开始", "progress": ["", "", "分解任务阶段跟踪", "", "", ""], "risk": ""}, {"seq": 38, "name": "信号补盲", "cat": "现场实施", "group": "comm", "phase": "大修前/中", "desc": "DTW信号补盲，根据需要布置临时AP补盲电子工单专网信号盲区；DTW信号补盲，根据需要布置临时AP补盲电子工单专网信号盲区", "output": "1、补盲方案", "prio": "高", "owner": "梁工、董工", "start": "2026-09-10", "due": "2027-04-30", "days": "232", "status": "进行中", "progress": ["", "", "现已开始推动app部署，可采用离线工单方式进行工单操作，也同步对台山临时补盲设备进行申请，作为备用方案进行测试。", "现IMPAPP已开始投入测试、网桥已联系相关厂家提供方案；", "待IMPAPP离线工单功能上线后，大批量投入测试", ""], "risk": ""}, {"seq": 39, "name": "切点影响分析", "cat": "现场实施", "group": "comm", "phase": "大修前/中", "desc": "1、大修期间1BSC主机房检查及温湿度跟踪大修前完成1BSC主机房检查跟踪飞行空调降温效果及机房切电影响等；2、大修前停盘切电风险分析", "output": "", "prio": "低", "owner": "孙工", "start": "2026-02-15", "due": "2027-04-30", "days": "439", "status": "尚未开始", "progress": ["", "", "", "", "", ""], "risk": ""}, {"seq": 40, "name": "指挥部需求收集", "cat": "现场实施", "group": "infra", "phase": "大修中", "desc": "OID/智科直接接收大修指挥部信息；大修值班点、大修协调会上各方提出的要求。；1、大修指挥部保障大修指挥部会议室、大修应用系统显示，视频监控，电脑，打印机终端等保障工作。；2、处理大修期间应急系统设备故障处理广播、声警报、无线通信、运营商信号等故障。；3、处理电脑、打印机及会议室设备故障处理大修办公电脑、打印机及会议室设备故障；4、处理大修期间临电话及网络安装、改号等相关事宜大修期间临时电话及网络安装、拆除、回收（含IT100服务申请）。；5、响应大修临时（紧急）任务根据大修各专业需求，修改电话号码、功能等。", "output": "", "prio": "高", "owner": "刘主管", "start": "2026-02-15", "due": "2027-04-30", "days": "439", "status": "尚未开始", "progress": ["", "", "", "", "", ""], "risk": ""}, {"seq": 41, "name": "设备回收清单", "cat": "现场实施", "group": "comm", "phase": "大修后", "desc": "1、信息化设备回收DTW手机、对讲机、移动视频监控、执法记录仪回收；2、大修电脑、打印机、会议室设备拆除回收拆除回收大修临时增加的电脑、打印机、会议室设备；3、大修临时通信设施拆除大修临时电话、网络设施拆除。", "output": "", "prio": "高", "owner": "周工、许工", "start": "2027-05-01", "due": "2027-05-30", "days": "29", "status": "尚未开始", "progress": ["", "", "", "", "", "尚未开始"], "risk": ""}, {"seq": 42, "name": "状态修改", "cat": "现场实施", "group": "app", "phase": "大修后", "desc": "Hui主页发电状态修改发电状态大修改为日常。", "output": "", "prio": "中等", "owner": "曹工", "start": "2027-04-30", "due": "2027-05-01", "days": "1", "status": "尚未开始", "progress": ["", "", "", "", "", ""], "risk": ""}, {"seq": 43, "name": "大修宣传", "cat": "文件支持", "group": "comm", "phase": "大修中", "desc": "大修宣传及工作典型事迹挖掘根据公司宣传方案及大修信息化保障工作，挖掘突出工作及典型人物，事迹，做好宣传工作", "output": "", "prio": "中等", "owner": "赵工、郭工", "start": "2027-05-01", "due": "2027-05-30", "days": "29", "status": "尚未开始", "progress": ["", "", "", "", "", ""], "risk": ""}, {"seq": 44, "name": "工作包归档", "cat": "文件支持", "group": "comm", "phase": "大修后", "desc": "大修工作包专项归档根据归档范围，按期开展大修工作包专项归档", "output": "", "prio": "低", "owner": "郭工", "start": "2027-05-01", "due": "2027-05-30", "days": "29", "status": "尚未开始", "progress": ["", "", "", "", "", ""], "risk": ""}, {"seq": 45, "name": "会议纪要", "cat": "文件支持", "group": "comm", "phase": "大修后", "desc": "大修总结会根据要求召开大修总结会，固化经验制定提升行动。；大修总结会根据要求召开大修总结会，固化经验制定提升行动。", "output": "1、会议签到表", "prio": "高", "owner": "赵工、郭工", "start": "2027-05-01", "due": "2027-05-30", "days": "29", "status": "尚未开始", "progress": ["", "", "", "", "", ""], "risk": ""}, {"seq": 46, "name": "运营整改", "cat": "物资保障", "group": "infra", "phase": "大修前", "desc": "三大运营商架空光缆易被刮蹭点清理；三大运营商架空光缆易被刮蹭点清理", "output": "1、整改报告", "prio": "中", "owner": "肖工", "start": "2026-09-22", "due": "2026-11-30", "days": "69", "status": "进行中", "progress": ["", "联通和电信传输光缆已走地下管道，移动光缆走地下管道正在施工中。电信已提交路径图，联通和移动未提交。", "", "三大运营商已现场巡查厂区附近架空光缆易被刮蹭点。联通、电信反馈无易剐蹭点，移动在村口有易剐蹭点正在进行光缆下地施工，预计11月初完成。", "移动光缆下地施工的地下管沟已建设完成。目前正在协调作业窗口准备进行光缆割接，预计11月初完成全部工作。", "移动光缆下地已完成施工和割接正在整理报告；"], "risk": ""}, {"seq": 47, "name": "软件推广", "cat": "文件支持", "group": "app", "phase": "大修前", "desc": "IMP专用APP软件推广。（账号验证）", "output": "", "prio": "高", "owner": "曹工、刘工、袁工", "start": "2026-10-14", "due": "2026-11-30", "days": "47", "status": "进行中", "progress": ["", "", "2026.10.13联系后台推送IMP独立APP安装包至130台设备。同步联系用户开展小范围试用工作，计划下周协助用户组织独立APP使用宣讲工作。", "2026.10.13联系后台推送IMP独立APP安装包至130台设备。同步联系用户开展小范围试用工作，计划下周协助用户组织独立APP使用宣讲工作。", "已和运维人员初步沟通，初步定于11月初组织线上使用培训宣贯会，具体时间还在进一步确认中。", "培训材料已完成，已发邮件通知接口用户协调事宜"], "risk": ""}, {"seq": 48, "name": "软件测试", "cat": "文件支持", "group": "app", "phase": "大修前", "desc": "IMP专用APP软件内部测试。（外网手机、DTW手机、平板测试）", "output": "", "prio": "高", "owner": "梁工", "start": "2026-10-15", "due": "2026-11-30", "days": "46", "status": "进行中", "progress": ["", "", "本次周会新增", "三人以开始进行现场测试，正在申请我方全部做票人员授权，待授权申请完成正式进行大批量试用", "IMP专用APP软件离线工单功能已上线，待进行大批量测试", "以进行初步测试，现有问题：后台无人员信息，无法选择人员，已反馈，待正式上线后完成人员录入"], "risk": ""}, {"seq": 49, "name": "设备运行准备", "cat": "", "group": "", "phase": "大修前", "desc": "做好无纸化电子工单的保障，重点关注DTW网络带宽容量。考虑广域网链路扩容带宽，以及DTW系统的并发设备数（PAD、手机、执法记录仪、无线摄像头），确保不影响IMP电子工单使用。", "output": "待补充", "prio": "高", "owner": "郑工、潘工", "start": "2026-11-05", "due": "", "days": "", "status": "进行中", "progress": ["", "", "", "", "", "总经理部面谈任务，11月5日新增"], "risk": ""}, {"seq": 50, "name": "信号补盲", "cat": "", "group": "", "phase": "大修前", "desc": "关于大修期间DTW信号补盲工作，参考台山成熟方案，借鉴DTW信号补盲移动WIFI设备，重点考虑在无电源及无DTW信号区域的补盲部署方案，制定明确DTW信号补盲方案，11月30日前完成。", "output": "待补充", "prio": "高", "owner": "梁工", "start": "2026-11-05", "due": "2026-11-30", "days": "", "status": "进行中", "progress": ["", "", "", "", "", "总经理部面谈任务，11月5日新增"], "risk": ""}, {"seq": 51, "name": "制定方案", "cat": "", "group": "", "phase": "大修前", "desc": "请信息文档部关注大修期间开展相关作业存在的安全风险，制定安全管控方案，大修安全队支持评估，避免风险评估不到位，12月30日前完成。", "output": "待补充", "prio": "", "owner": "郭工", "start": "2026-11-05", "due": "2026-12-30", "days": "", "status": "进行中", "progress": ["", "", "", "", "", "总经理部面谈任务，11月5日新增"], "risk": ""}, {"seq": 52, "name": "制作使用手册", "cat": "", "group": "", "phase": "大修前", "desc": "请信息文档部制作DTW手机、PAD、执法记录仪的使用手册，便于现场人员操作使用，11月30日前完成。", "output": "待补充", "prio": "", "owner": "蒋工、彭工", "start": "2026-11-05", "due": "2026-11-30", "days": "", "status": "进行中", "progress": ["", "", "", "", "", "总经理部面谈任务，11月5日新增"], "risk": ""}, {"seq": 53, "name": "设备可用性检查", "cat": "", "group": "", "phase": "大修前", "desc": "请信息文档部关注，大修开岛后，需第一时间开展DTW信号、通信设备可用性检测工作，保障现场通信畅通", "output": "待补充", "prio": "", "owner": "梁工", "start": "2027-03-03", "due": "2027-04-03", "days": "", "status": "尚未开始", "progress": ["", "", "", "", "", "总经理部面谈任务，11月5日新增"], "risk": ""}, {"seq": 54, "name": "响应需求", "cat": "", "group": "", "phase": "大修前", "desc": "请信息文档部关注，现场大修保障人员（IMP系统、通信、网络、客服），需将保障点前移至大修一线，如气闸门口，随时响应需求", "output": "", "prio": "", "owner": "许工", "start": "", "due": "", "days": "", "status": "尚未开始", "progress": ["", "", "", "", "", "总经理部面谈任务，11月5日新增"], "risk": ""}, {"seq": 55, "name": "资源配置", "cat": "", "group": "", "phase": "大修前", "desc": "关于大修资源配置，参考台山首次大修的准备进行，做好调研工作", "output": "", "prio": "", "owner": "宋工", "start": "2027-03-03", "due": "", "days": "", "status": "进行中", "progress": ["", "", "", "", "", "总经理部面谈任务，11月5日新增"], "risk": ""}, {"seq": 56, "name": "工作票审查", "cat": "", "group": "", "phase": "大修前", "desc": "请信息文档部关注，涉及配合工作的票，均需要主票专业进行审查", "output": "", "prio": "", "owner": "宋工", "start": "2027-03-03", "due": "", "days": "", "status": "进行中", "progress": ["", "", "", "", "", "总经理部面谈任务，11月5日新增"], "risk": ""}, {"seq": 57, "name": "制定方案", "cat": "", "group": "", "phase": "大修前", "desc": "针对大修期间，外部设备接入DTW网络的需求，请信息文档部重点关注网络安全问题，制定网络安全接入管控方案，明确外来人员接口部门的责任，以及技防措施", "output": "待补充", "prio": "", "owner": "余工", "start": "2027-03-03", "due": "2026-12-30", "days": "", "status": "进行中", "progress": ["", "", "", "", "", "总经理部面谈任务，11月5日新增"], "risk": ""}, {"seq": 58, "name": "授权审查", "cat": "", "group": "", "phase": "大修前", "desc": "请信息文档部核实承包商人员钉钉授权的人数、授权控制事宜", "output": "", "prio": "", "owner": "曹工", "start": "2027-03-03", "due": "2026-11-30", "days": "", "status": "进行中", "progress": ["", "", "", "", "", "总经理部面谈任务，11月5日新增"], "risk": ""}, {"seq": 59, "name": "监控审查", "cat": "", "group": "", "phase": "大修前", "desc": "请信息文档部完善平板、执法记录仪使用监控，形成监控方法，定期开展使用监控，避免设备长时间不上线，可能引发防异物风险，对未上线设备进行提示", "output": "", "prio": "", "owner": "曹工、董工、蔡工", "start": "2027-03-03", "due": "", "days": "", "status": "进行中", "progress": ["", "", "", "", "", "总经理部面谈任务，11月5日新增"], "risk": ""}, {"seq": 60, "name": "管理方案生效", "cat": "", "group": "", "phase": "大修前", "desc": "各单位安全管理方案生效；，按照模板编写；", "output": "", "prio": "", "owner": "", "start": "", "due": "2026-11-23", "days": "", "status": "进行中", "progress": ["", "", "", "", "", "大修安全组月会任务"], "risk": ""}, {"seq": 62, "name": "培训考核授权", "cat": "", "group": "", "phase": "大修前", "desc": "兼职安全员培训考核授权；，培训考核材料提交安全组备案；", "output": "", "prio": "", "owner": "", "start": "", "due": "2027-01-20", "days": "", "status": "尚未开始", "progress": ["", "", "", "", "", "大修安全组月会任务"], "risk": ""}, {"seq": 64, "name": "安全培训", "cat": "", "group": "", "phase": "大修前", "desc": "全员安全培训；，培训记录提交安全组备案；", "output": "", "prio": "", "owner": "", "start": "", "due": "2027-01-20", "days": "", "status": "尚未开始", "progress": ["", "", "", "", "", "大修安全组月会任务"], "risk": ""}, {"seq": 66, "name": "程序研读培训", "cat": "", "group": "", "phase": "大修前", "desc": "安全管理程序研读培训；，培训记录提交安全组备案；", "output": "", "prio": "", "owner": "", "start": "", "due": "2027-01-13", "days": "", "status": "尚未开始", "progress": ["", "", "", "", "", "大修安全组月会任务"], "risk": ""}], "materials": [{"name": "DTW平板", "spec": "荣耀 HONOR 平板电脑 Z7 8+128", "use": "大修电子工单使用，参考台山一期1100台，目前有350台，采购700台（含生产服务部4台）；大修电子工单使用，参考台山一期1100台，目前有350台，采购700台（含生产服务部4台）", "qty": "700", "total": 1930600, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "USB无线网卡", "spec": "H3C新华三 WA900E USB无线网卡 WiFi接收器 5G双频 台式机笔记本通用 无限WiFi发射器 有天线/个", "use": "现场不具备有线网络台式电脑使用；现场不具备有线网络台式电脑使用", "qty": "50", "total": 2580, "req": "杜工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "电视机", "spec": "（海信）85A5QH英寸电视机", "use": "会议室运维使用,及临时场所搭建使用；会议室运维使用,及临时场所搭建使用", "qty": "4", "total": 21018, "req": "叶工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "电视机", "spec": "65寸，康佳（KONKA）LED65G300E-65英寸电视机", "use": "会议室运维备件、临时会议搭建或活动需求、大修备用。；会议室运维备件、临时会议搭建或活动需求、大修备用。", "qty": "5", "total": 10950, "req": "叶工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "电视机", "spec": "100寸，（TCL）100GA2-100英寸电视机", "use": "会议室运维备件、临时会议搭建或活动、大修备用。；会议室运维备件、临时会议搭建或活动、大修备用。", "qty": "1", "total": 7731.96, "req": "叶工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "华为智慧屏65寸", "spec": "华为（HUAWEI）华为ES2大屏 IHE2-65SU", "use": "大修备用。；大修备用。", "qty": "3", "total": 84375, "req": "叶工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "华为智慧屏86寸", "spec": "华为（HUAWEI）华为ES2大屏 IHE2-86SU", "use": "大修备用。；大修备用。", "qty": "2", "total": 118750, "req": "叶工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "华为智慧屏落地支架（65寸）", "spec": "65寸华为智慧屏使用", "use": "会议室运维备件、临时会议搭建或活动、大修备用。；会议室运维备件、临时会议搭建或活动、大修备用。", "qty": "3", "total": 0, "req": "叶工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "华为智慧屏落地支架（86寸）", "spec": "86寸华为智慧屏使用", "use": "会议室运维备件、临时会议搭建或活动、大修备用。；会议室运维备件、临时会议搭建或活动、大修备用。", "qty": "2", "total": 0, "req": "叶工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.20完成到货验收。"}, {"name": "电视机移动推车", "spec": "ProPre电视移动支架55-100英寸电视大屏落地挂架一体机电视架子电视推车适配海信创维华为等视频会议架", "use": "会议室运维备件、临时会议搭建或活动、大修备用。；会议室运维备件、临时会议搭建或活动、大修备用。", "qty": "4", "total": 1628.8, "req": "叶工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "便携式投影仪", "spec": "EPSON 爱普生 CB-W53 便携式灯泡投影机", "use": "大修临时会议使用；大修临时会议使用", "qty": "15", "total": 50700, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.20完成到货验收。"}, {"name": "无线投屏器", "spec": "UGREEN/绿联 HDMI无线投屏器 60200-中广核", "use": "临时会议搭建或活动、大修备用。；临时会议搭建或活动、大修备用。", "qty": "5", "total": 3961.1, "req": "叶工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "48口POE交换机", "spec": "华为 HUAWEI POE供电交换机 S5735-L48P4X-A1", "use": "DTW大修集装箱网络使用；DTW大修集装箱网络使用", "qty": "14", "total": 65975.84, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "24口POE交换机", "spec": "华为 HUAWEI 三层千兆POE供电交换机 S5735-L24P4S-A1", "use": "DTW系统备件交换机，全厂300多台，近期停产，采购备件20台；DTW系统备件交换机，全厂300多台，近期停产，采购备件20台", "qty": "20", "total": 55693.8, "req": "董工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "网络打印机（彩色）", "spec": "", "use": "大修现场400多集装箱打印材料使用；大修现场400多集装箱打印材料使用", "qty": "6", "total": 0, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.20完成到货验收。"}, {"name": "打印机（黑白）", "spec": "惠普 HP A4黑白激光打印机 Laser 1008w", "use": "大修现场400多集装箱打印材料使用；大修现场400多集装箱打印材料使用", "qty": "50", "total": 39560, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "Sandisk闪迪256GB SD内存卡", "spec": "4K V30 U3 C10 相机存储卡 读速200MB/s 写速140MB/s 微单/单反相机内存卡", "use": "大修现场临时监控使用；大修现场临时监控使用", "qty": "20", "total": 5600, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.20完成到货验收。"}, {"name": "普联（TP-LINK）800万4K全彩监控摄像头", "spec": "家用监控器360度无死角带夜视全景追踪无线室外户外网络手机远程IPC682F-A4", "use": "大修现场临时监控使用；含自管区域2台", "qty": "20", "total": 2300, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.20完成到货验收。"}, {"name": "无线摄像头", "spec": "海康威视WIFI款筒形网络摄像机", "use": "大修现场临时监控使用，参考台山340多个；大修现场临时监控使用，参考台山340多个", "qty": "260", "total": 208000, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.20完成到货验收。"}, {"name": "执法记录仪", "spec": "海康威视5G安卓执法记录仪", "use": "大修执法记录仪,计划需求预算400；大修执法记录仪,计划需求预算400", "qty": "400", "total": 1390400, "req": "邓工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "布控球（移动监控）", "spec": "5G智能移动布控球（40倍变倍，安全帽识别，三摄像头）iDS-MCD40X", "use": "大修现场临时监控使用；大修现场临时监控使用", "qty": "20", "total": 440000, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "模拟电话", "spec": "步步高HCD007(6101)TSD", "use": "大修现场临时通信使用；大修现场临时通信使用", "qty": "50", "total": 4265, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "IP电话（有线）", "spec": "亿联 Yealink SIP-T33G IP电话", "use": "大修现场400多集装箱通信使用；大修现场400多集装箱通信使用", "qty": "50", "total": 27289.5, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "IP电话（无线）", "spec": "YEALINK/亿联网络 IP电话机 AX83H", "use": "大修现场400多集装箱通信使用；大修现场400多集装箱通信使用", "qty": "100", "total": 67900, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "光缆（48芯）", "spec": "48芯单模室外光缆", "use": "大修现场400多集装箱布线；大修现场400多集装箱布线", "qty": "5000", "total": 31650, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "网线", "spec": "普联 TP-LINK 六类千兆网线 EC6-305 工程级无氧铜箱线305米", "use": "大修现场400多集装箱布线；大修现场400多集装箱布线", "qty": "17", "total": 13394.47, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.20完成到货验收。"}, {"name": "软电缆25mm²/20米", "spec": "桂林国际 多股铜芯线 25mm2 20米", "use": "现场通信蓄电池放电使用；现场通信蓄电池放电使用", "qty": "2", "total": 0, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "软电缆25mm²/10米", "spec": "桂林国际 多股铜芯线 25mm2 10米", "use": "现场通信蓄电池放电使用；现场通信蓄电池放电使用", "qty": "2", "total": 0, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "寻线仪", "spec": "杉木林 SML-8618T 多功能寻线仪寻线器套装", "use": "大修集装箱项目使用；大修集装箱项目使用", "qty": "5", "total": 1436, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "网线钳", "spec": "杉木林 SML-8618T 多功能寻线仪寻线器套装", "use": "大修集装箱项目使用；大修集装箱项目使用", "qty": "5", "total": 1436, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "红光笔", "spec": "HAILE海乐 红光笔20mw光纤测试笔HJ-650H-20", "use": "大修集装箱项目使用；大修集装箱项目使用", "qty": "5", "total": 836.55, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "TF内存卡256G", "spec": "闪迪（SanDisk）红灰卡-高速扩容 TF卡系列 256GB TF（MicroSD）内存卡 A1 U1 C10 至尊高速移动版存储卡 读速150MB/s", "use": "大修现场临时监控使用；大修现场临时监控使用", "qty": "280", "total": 96600, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "监控三角支架", "spec": "监控摄像头支架4.5米高球机款(手摇重型架）", "use": "大修现场临时监控使用；大修现场临时监控使用", "qty": "100", "total": 63858, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "无线10A三角插头", "spec": "公牛三脚插头10A", "use": "大修现场临时监控使用；大修现场临时监控使用", "qty": "330", "total": 1914, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "RVV3*2.5m²电源线", "spec": "金龙羽多芯电缆RVV/3×2.5mm2", "use": "大修现场临时监控使用；大修现场临时监控使用", "qty": "4000", "total": 32960, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "24口数据配线架", "spec": "绿联 UGREEN 超五类48口配线架 CAT5E网线配线架 镀金1U机架式机柜工程网络跳线理线槽 NW126", "use": "大修集装箱项目使用；大修集装箱项目使用", "qty": "28", "total": 6692, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "12V电气开关电源", "spec": "德力西电气开关电源CDKU-S150W/12V/12.5A", "use": "大修现场临时监控使用；大修现场临时监控使用", "qty": "50", "total": 3634.5, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "六类RJ45水晶头", "spec": "绿联 UGREEN RJ45六类非屏蔽网络水晶头 50961 NW120 10个/袋", "use": "大修集装箱项目使用；大修集装箱项目使用", "qty": "200", "total": 638, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "RJ11水晶头", "spec": "山泽 SAMZHE 电话水晶头 6P4C语音电话线接头 DHT350 RJ11电话语音水晶头 50个", "use": "大修集装箱项目使用；大修集装箱项目使用", "qty": "20", "total": 174.2, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "RJ45网络模块", "spec": "山泽（SAMZHE） WAN-06 六类网络模块 CAT6 RJ45 镀金 五个装 单位:盒", "use": "大修集装箱项目使用；大修集装箱项目使用", "qty": "400", "total": 14360, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "网络双孔信息面板", "spec": "山泽 SAMZHE 电脑插座网口面板 WAN-02 加厚86型面板 双口", "use": "大修集装箱项目使用；大修集装箱项目使用", "qty": "200", "total": 1420, "req": "宋工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.6完成到货验收。"}, {"name": "室外光交箱", "spec": "落地式96芯（SC满配）", "use": "大修集装箱项目固定点办公内网；大修集装箱项目固定点办公内网；大修集装箱项目；大修集装箱项目；大修集装箱项目；大修集装箱项目；大修集装箱项目；大修集装箱项目", "qty": "4", "total": 8584, "req": "周工", "progress": "10.14：正在准备立项材料；10.22：立项材料财务预审中；10.14：正在准备立项材料；10.22：立项材料财务预审中；10.14：正在准备立项材料；10.22：立项材料财务预审中；10.14：正在准备立项材料；10.22：立项材料财务预审中", "plan": "10.23完成立项下单，11.20完成到货验收。"}], "materialBudget": 4818866.72, "personnelHeader": ["", "基本安全", "工作负责人", "准备工程师", "辐射防护一级", "辐射防护二级", "QC授权", "电工证", "基地", "备注"], "personnel": [["通信组", "21（技术工人）", "17", "10", "7", "8人已办理，剩余4人（@梁工@郭工@刘泓希@李斌）满足办理条件", "4", "13", "惠州", "惠州人数包含业主"], ["通信组", "1（辅助工人）", "20", "20", "3", "16", "13", "7", "防城港", "防城港人数不包含业主"], ["通信组", "20（技术工人）", "20", "20", "3", "16", "13", "7", "防城港", ""], ["基础组", "7（技术工人）", "2", "0", "0", "0", "0", "0", "惠州", ""], ["基础组", "1（辅助工人）", "3", "3", "2", "0", "0", "0", "防城港", ""], ["基础组", "3（技术工人）", "3", "3", "2", "0", "0", "0", "防城港", ""], ["应用组", "4（辅助工人）", "0", "0", "0", "0", "0", "0", "惠州", ""], ["应用组", "0", "0", "0", "0", "0", "0", "0", "防城港", ""], ["在线组", "4（辅助工人）", "1", "0", "3", "0", "0", "0", "惠州", ""], ["在线组", "9（技术工人）", "1", "0", "3", "0", "0", "0", "惠州", ""], ["在线组", "7（辅助工人）", "2", "2", "4", "1", "0", "0", "防城港", ""], ["在线组", "4（技术工人）", "2", "2", "4", "1", "0", "0", "防城港", ""], ["通信缺口主要准备工程师、QC、与RP2授权、与防城港对比相差5人，11月待部门培训教师拿到RP2培训授课授权开展一期，将3人RP1已有工作负责人升至RP2，达到15人可将近持平防城港", "", "", "", "", "", "", "", "", ""]]};

  /* 大修矩阵与作业授权口径对齐：矩阵按参与大修的团队 + 业主统计，作业授权只维护团队 40 人。 */
  overhaul.personnel = [
    ['通信组', '13（技术工人）', '12', '10', '7', '8', '4', '11', '惠州', '含业主 5 人'],
    ['应用组', '4（辅助工人）', '0', '0', '0', '0', '0', '0', '惠州', '团队参与 4 人'],
    ['在线组', '5（技术工人）', '1', '0', '3', '0', '0', '0', '惠州', '团队参与 8 人'],
    ['在线组', '3（辅助工人）', '', '', '', '', '', '', '惠州', ''],
    ['基础设施组', '7（技术工人）', '2', '0', '0', '0', '0', '0', '惠州', '团队参与 7 人']
  ];
  delete overhaul.personnelGap;
  overhaul.qcHolders = [
    { name: '赵工', group: 'comm', base: 'A地区', affiliation: '团队' },
    { name: '赵主管', group: 'comm', base: 'A地区', affiliation: '团队' },
    { name: '周建国', group: 'comm', base: 'A地区', affiliation: '业主' },
    { name: '吴志强', group: 'comm', base: 'A地区', affiliation: '业主' }
  ];

  /* 作业授权按大修矩阵对齐：应用组清空管理类授权，通信/在线/基础设施按矩阵补缺。 */
  (function alignOverhaulAuths() {
    const drop = {
      app: ['工作负责人授权', '准备工程师授权', 'RP1 授权'],
      online: ['准备工程师授权', 'RP2 授权', '低压电工证', '高压电工证'],
      infra: ['低压电工证', '高压电工证']
    };
    for (let i = auths.length - 1; i >= 0; i -= 1) {
      const a = auths[i];
      if (a.status === '已过期') continue;
      if (drop[a.group] && drop[a.group].indexOf(a.type) > -1) auths.splice(i, 1);
    }
    let seq = 238;
    const nextId = function () { return 'AU-2026-' + ('000' + (seq++)).slice(-4); };
    const active = function (a) { return a.status !== '已撤销' && a.status !== '已过期'; };
    const has = function (name, type) {
      return auths.some(function (a) { return a.person === name && a.type === type && active(a); });
    };
    const add = function (person, type, group, scope, validTo) {
      if (has(person, type)) return;
      auths.push({ id: nextId(), person: person, type: type, group: group, scope: scope, validTo: validTo, status: '有效' });
    };
    const choose = function (list, type, target, scope, dateOffset) {
      let need = target - list.filter(function (p) { return has(p.name, type); }).length;
      const pool = list.filter(function (p) { return !has(p.name, type); }).sort(function (a, b) {
        const ca = auths.filter(function (x) { return x.person === a.name && active(x); }).length;
        const cb = auths.filter(function (x) { return x.person === b.name && active(x); }).length;
        return ca - cb || a.name.localeCompare(b.name, 'zh');
      });
      let i = 0;
      while (need > 0 && i < pool.length) {
        const p = pool[i];
        add(p.name, type, p.group, scope, ['2027-03-31', '2027-06-30', '2027-09-30'][(dateOffset + i) % 3]);
        need -= 1;
        i += 1;
      }
    };
    const comm = staff.filter(function (p) { return p.group === 'comm'; });
    const online = staff.filter(function (p) { return p.group === 'online'; });
    const infra = staff.filter(function (p) { return p.group === 'infra'; });
    choose(comm, '工作负责人授权', 10, '通信专业作业组织与现场管控', 0);
    choose(comm, '准备工程师授权', 10, '通信作业准备、隔离验证与风险识别', 1);
    choose(comm, 'RP1 授权', 7, 'RP1 系统操作与隔离验证', 2);
    choose(comm, 'RP2 授权', 8, 'RP2 系统操作与设备隔离', 0);
    choose(comm, '低压电工证', 10, '通信低压配电与电气作业', 1);
    choose(online, '工作负责人授权', 1, '在线监测作业组织与现场管控', 2);
    choose(online, 'RP1 授权', 3, 'RP1 系统操作与隔离验证', 0);
    choose(infra, '工作负责人授权', 2, '基础设施作业组织与现场管控', 1);
    /* 保留 12 月初可见的 10 条临期作业授权样例。 */
    ['郭工', '梁工', '宋工', '唐工', '许工'].forEach(function (name) {
      const a = auths.find(function (x) {
        return x.person === name && x.type === '工作负责人授权' && x.status !== '已过期';
      });
      if (a) a.validTo = '2026-12-20';
    });
    [['罗工', 'RP2 授权'], ['邓工', 'RP1 授权']].forEach(function (pair) {
      const a = auths.find(function (x) {
        return x.person === pair[0] && x.type === pair[1] && x.status !== '已过期';
      });
      if (a) a.validTo = '2026-12-20';
    });
  })();

  /* ── 字典配置 ───────────────────────────────
     系统枚举只读；业务字典可由系统管理员维护。
     大修基地 / 大修任务分类等新增后立即进入对应表单与筛选。 */
  const dictionaries = [
    {
      id: 'overhaulBase', name: '大修基地', group: '大修专项', code: 'OVERHAUL_BASE', builtin: true,
      desc: '配置完成后，大修人员的新增 / 编辑与基地筛选会立即读取这里的启用项。',
      values: [
        { name: 'A地区', code: 'A', sort: 1, enabled: true },
        { name: 'B地区', code: 'B', sort: 2, enabled: true }
      ]
    },
    {
      id: 'overhaulCat', name: '大修任务分类', group: '大修专项', code: 'OVERHAUL_CAT', builtin: true,
      desc: '用于大修行动项的分类筛选与新增 / 编辑表单。',
      values: [
        { name: '文件支持', code: 'DOC', sort: 1, enabled: true },
        { name: '物资保障', code: 'MAT', sort: 2, enabled: true },
        { name: '人员保障', code: 'PER', sort: 3, enabled: true },
        { name: '现场实施', code: 'SITE', sort: 4, enabled: true }
      ]
    },
    {
      id: 'overhaulPhase', name: '大修阶段', group: '大修专项', code: 'OVERHAUL_PHASE', builtin: true,
      desc: '大修行动项所处阶段，用于清单筛选与阶段分布统计。',
      values: [
        { name: '大修前', code: 'PRE', sort: 1, enabled: true },
        { name: '大修中', code: 'MID', sort: 2, enabled: true },
        { name: '大修后', code: 'POST', sort: 3, enabled: true },
        { name: '大修前/中', code: 'PRE_MID', sort: 4, enabled: true }
      ]
    },
    {
      id: 'overhaulPrio', name: '大修优先级', group: '大修专项', code: 'OVERHAUL_PRIO', builtin: true,
      desc: '行动项优先级枚举。',
      values: [
        { name: '高', code: 'H', sort: 1, enabled: true },
        { name: '中', code: 'M', sort: 2, enabled: true },
        { name: '低', code: 'L', sort: 3, enabled: true }
      ]
    },
    {
      id: 'personType', name: '人员类型', group: '人员与组织', code: 'PERSON_TYPE', builtin: true,
      desc: '大修人员构成中的工种分类。',
      values: [
        { name: '技术工人', code: 'TECH', sort: 1, enabled: true },
        { name: '辅助工人', code: 'AUX', sort: 2, enabled: true }
      ]
    },
    {
      id: 'personTitle', name: '岗位 / 职称', group: '人员与组织', code: 'PERSON_TITLE', builtin: false,
      desc: '组织成员岗位与职称候选值。',
      values: [
        { name: '高级工程师', code: 'SENIOR', sort: 1, enabled: true },
        { name: '工程师', code: 'ENG', sort: 2, enabled: true },
        { name: '助理工程师', code: 'ASSIST', sort: 3, enabled: true },
        { name: '技术员', code: 'TECHNICIAN', sort: 4, enabled: true }
      ]
    },
    {
      id: 'group', name: '专业组', group: '人员与组织', code: 'GROUP', builtin: true, readOnly: true,
      desc: '专业组由组织架构维护，字典页只读。',
      readOnlyHint: '组织架构 · 成员管理', sourceRoute: 'groups',
      values: []
    },
    {
      id: 'inspectionCycle', name: '巡检周期', group: '运维计划', code: 'INSPECTION_CYCLE', builtin: true,
      desc: '巡检计划周期候选值。',
      values: [
        { name: '每日', code: 'D', sort: 1, enabled: true },
        { name: '每周', code: 'W', sort: 2, enabled: true },
        { name: '每月', code: 'M', sort: 3, enabled: true },
        { name: '每季度', code: 'Q', sort: 4, enabled: true }
      ]
    },
    {
      id: 'maintenanceCycle', name: '维保周期', group: '运维计划', code: 'MAINT_CYCLE', builtin: true,
      desc: '维保计划周期候选值。',
      values: [
        { name: '每月', code: 'M', sort: 1, enabled: true },
        { name: '每季度', code: 'Q', sort: 2, enabled: true },
        { name: '每半年', code: 'H', sort: 3, enabled: true },
        { name: '每年', code: 'Y', sort: 4, enabled: true }
      ]
    },
    {
      id: 'maintenanceVendor', name: '维保厂商', group: '运维计划', code: 'MAINT_VENDOR', builtin: true,
      desc: '维保执行厂商候选值。',
      values: [
        { name: '维保厂商 A', code: 'VENDOR_A', sort: 1, enabled: true },
        { name: '维保厂商 B', code: 'VENDOR_B', sort: 2, enabled: true },
        { name: '维保厂商 C', code: 'VENDOR_C', sort: 3, enabled: true },
        { name: '原厂服务', code: 'OEM', sort: 4, enabled: true }
      ]
    },
    {
      id: 'taskStatus', name: '任务状态', group: '系统枚举', code: 'TASK_STATUS', builtin: true, readOnly: true,
      desc: '任务流转状态由系统控制，字典页只读。',
      readOnlyHint: '任务流转引擎固定，不开放配置',
      values: ['草稿', '待分发', '执行中', '审批中', '已挂起', '已完成', '已取消'].map(function (v, i) {
        return { name: v, code: 'S' + (i + 1), sort: i + 1, enabled: true };
      })
    },
    {
      id: 'authType', name: '授权类型', group: '系统枚举', code: 'AUTH_TYPE', builtin: true, readOnly: true,
      desc: '授权类型由作业授权矩阵维护，字典页只读。',
      readOnlyHint: '作业授权矩阵 · 授权口径', sourceRoute: 'auth',
      values: authTypes.map(function (v, i) { return { name: v, code: 'A' + (i + 1), sort: i + 1, enabled: true }; })
    },
    {
      id: 'dutyStatus', name: '值班状态', group: '系统枚举', code: 'DUTY_STATUS', builtin: true, readOnly: true,
      desc: '值班运行状态由排班记录维护，字典页只读。',
      readOnlyHint: '值班管理 · 排班状态', sourceRoute: 'duty',
      values: ['正常', '异常'].map(function (v, i) { return { name: v, code: 'D' + (i + 1), sort: i + 1, enabled: true }; })
    },
    {
      id: 'messageType', name: '消息类型', group: '系统枚举', code: 'MESSAGE_TYPE', builtin: true, readOnly: true,
      desc: '站内消息类型由站内消息模块维护，字典页只读。',
      readOnlyHint: '站内消息 · 消息类型', sourceRoute: 'messages',
      values: ['审批', '超期', '巡检', '值班', '发布', '报表', '任务'].map(function (v, i) { return { name: v, code: 'M' + (i + 1), sort: i + 1, enabled: true }; })
    }
  ];

  const groupDict = dictionaries.find(function (d) { return d.id === 'group'; });
  if (groupDict) {
    groupDict.values = groups.map(function (g, i) {
      return { name: g.name, code: g.id.toUpperCase(), sort: i + 1, enabled: true };
    });
  }

  /* 自定义字段定义：全部模块已开放。
     key 保存后不可修改，字段值存放在业务记录的 extra 对象。 */
  const fieldDefs = [
    {
      id: 'CF-ACT-DEVICE', module: 'overhaulAction', label: '设备位号', key: 'deviceNo',
      type: 'text', source: 'none', required: false, placeholder: '例如：DTV-001',
      group: '扩展信息', sort: 1, width: 1, list: true, filter: true, export: true,
      editableRoles: ['employee', 'manager', 'leader', 'admin'], enabled: true
    },
    {
      id: 'CF-ACT-SAFETY', module: 'overhaulAction', label: '安全措施确认', key: 'safetyCheck',
      type: 'select', source: 'options', options: '已确认\n待确认', required: false,
      group: '扩展信息', sort: 2, width: 1, list: false, filter: true, export: false,
      editableRoles: ['employee', 'manager', 'leader', 'admin'], enabled: true
    },
    {
      id: 'CF-MAT-CONTRACT', module: 'overhaulMaterial', label: '合同编号', key: 'contractNo',
      type: 'text', source: 'none', required: false, placeholder: '例如：HT-2026-001',
      group: '采购信息', sort: 1, width: 1, list: true, filter: true, export: true,
      editableRoles: ['employee', 'manager', 'leader', 'admin'], enabled: true
    },
    {
      id: 'CF-MAT-BATCH', module: 'overhaulMaterial', label: '到货批次', key: 'batchNo',
      type: 'text', source: 'none', required: false,
      group: '采购信息', sort: 2, width: 1, list: false, filter: false, export: false,
      editableRoles: ['employee', 'manager', 'leader', 'admin'], enabled: true
    },
    {
      id: 'CF-PER-BADGE', module: 'overhaulPerson', label: '入场证号', key: 'badgeNo',
      type: 'text', source: 'none', required: false, placeholder: '例如：ICU-2026-001',
      group: '人员信息', sort: 1, width: 1, list: false, filter: false, export: false,
      editableRoles: ['employee', 'manager', 'leader', 'admin'], enabled: true
    },
    {
      id: 'CF-TASK-CHANGE', module: 'task', label: '变更单号', key: 'changeNo',
      type: 'text', source: 'none', required: false, placeholder: '例如：BG-2026-001',
      group: '扩展信息', sort: 1, width: 1, list: false, filter: false, export: true,
      editableRoles: ['employee', 'manager', 'leader', 'admin'], enabled: false
    },
    {
      id: 'CF-TASK-CHANGE-TYPE', module: 'task', label: '变更类型', key: 'changeType',
      type: 'select', source: 'options', options: '常规变更\n紧急变更', required: false,
      scope: 'main', group: '扩展信息', sort: 3, width: 1, list: false, filter: false, export: true,
      editableRoles: ['employee', 'manager', 'leader', 'admin'], enabled: false
    },
    {
      id: 'CF-TASK-EMERGENCY', module: 'task', label: '紧急审批人', key: 'emergencyApprover',
      type: 'person', source: 'none', required: false,
      scope: 'main', dependsOn: 'changeType', dependsValue: '紧急变更',
      group: '扩展信息', sort: 4, width: 1, list: false, filter: false, export: true,
      editableRoles: ['employee', 'manager', 'leader', 'admin'], enabled: false
    },
    {
      id: 'CF-SUB-RESULT', module: 'task', label: '执行结果', key: 'execResult',
      type: 'select', source: 'options', options: '正常\n异常\n待复核', required: false,
      scope: 'sub', group: '交付信息', sort: 1, width: 1, list: false, filter: false, export: true,
      editableRoles: ['employee', 'manager', 'leader', 'admin'], enabled: true
    },
    {
      id: 'CF-IP-POINT', module: 'inspectionPlan', label: '点位编号', key: 'pointNo',
      type: 'text', source: 'none', required: false, placeholder: '例如：IP-A-01',
      group: '计划信息', sort: 1, width: 1, list: true, filter: true, export: true,
      editableRoles: ['employee', 'manager', 'leader', 'admin'], enabled: true
    },
    {
      id: 'CF-IR-TEMP', module: 'inspectionRecord', label: '实测温度', key: 'measuredTemp',
      type: 'number', source: 'none', required: false, unit: '℃',
      group: '记录信息', sort: 1, width: 1, list: true, filter: true, export: true,
      editableRoles: ['employee', 'manager', 'leader', 'admin'], enabled: true
    },
    {
      id: 'CF-IR-HUMIDITY', module: 'inspectionRecord', label: '环境湿度', key: 'humidity',
      type: 'number', source: 'none', required: false, unit: '%',
      group: '记录信息', sort: 2, width: 1, list: false, filter: false, export: false,
      editableRoles: ['employee', 'manager', 'leader', 'admin'], enabled: true
    },
    {
      id: 'CF-MP-CONTRACT', module: 'maintenancePlan', label: '合同编号', key: 'contractNo',
      type: 'text', source: 'none', required: false,
      group: '计划信息', sort: 1, width: 1, list: true, filter: true, export: true,
      editableRoles: ['employee', 'manager', 'leader', 'admin'], enabled: false
    },
    {
      id: 'CF-MR-PART', module: 'maintenanceRecord', label: '更换部件', key: 'replacedPart',
      type: 'text', source: 'none', required: false,
      group: '记录信息', sort: 1, width: 1, list: true, filter: true, export: true,
      editableRoles: ['employee', 'manager', 'leader', 'admin'], enabled: true
    },
    {
      id: 'CF-MR-RECHECK', module: 'maintenanceRecord', label: '下次复检日期', key: 'recheckDate',
      type: 'date', source: 'none', required: false,
      group: '记录信息', sort: 2, width: 1, list: false, filter: true, export: true,
      editableRoles: ['employee', 'manager', 'leader', 'admin'], enabled: true
    },
    {
      id: 'CF-DUTY-NOTE', module: 'duty', label: '值班备注', key: 'dutyNote',
      type: 'textarea', source: 'none', required: false,
      group: '值班信息', sort: 2, width: 3, list: false, filter: false, export: false,
      editableRoles: ['employee', 'manager', 'leader', 'admin'], enabled: true
    }
  ];

  /* 业务系统分组：任务标签即业务系统，筛选项按系统组展示。 */
  const systemGroups = [
    { key: 'ics', name: '工控系统', systems: ['KNS', 'KCC', 'KDN', 'KSM'] },
    { key: 'voice', name: '语音通信系统', systems: ['DTT', 'DTI', 'DTS', 'DTH'] },
    { key: 'grid', name: '电网通信系统', systems: ['DTK', 'DTD'] },
    { key: 'emergency', name: '应急通信及授时系统', systems: ['DTA', 'DTP', 'DTC'] },
    { key: 'video', name: '视频监控系统', systems: ['DTL', 'DTM'] },
    { key: 'facility', name: '机房及电源', systems: ['DTJ', '机房', '机房动环', '通信电源', '弱电日常', '门禁'] },
    { key: 'line', name: '线路通信系统', systems: ['DTX', 'DTG', 'DTW', '卫星电话', '桌面电话', '厂房通信', 'AP'] },
    { key: 'meeting', name: '会议系统', systems: ['视频会议'] },
    { key: 'network', name: '网络系统', systems: ['DTF网络设备', 'DTW系统网络设备', 'AC'] },
    { key: 'mobile', name: '移动终端', systems: ['移动终端设备'] },
    { key: 'appsys', name: '应用系统', systems: ['宜搭平台', 'RPA', 'AI智能体'] },
    { key: 'publish', name: '信息发布系统', systems: ['信息发布LED屏系统'] }
  ];

  const systemAliases = {
    '移动终端设备': ['终端'],
    '视频会议': ['视频会议系统'],
    '卫星电话': ['卫星电话系统'],
    '厂房通信': ['厂房通信系统'],
    'DTF网络设备': ['DTF']
  };

  /* 业务系统统一纳入任务标签字典；已有别名时不再重复生成同义标签。 */
  (function extendTaskTagRegistry() {
    systemGroups.forEach(function (group) {
      (group.systems || []).forEach(function (name) {
        if (taskTags.indexOf(name) > -1) return;
        const aliases = systemAliases[name] || [];
        if (aliases.some(function (alias) { return taskTags.indexOf(alias) > -1; })) return;
        taskTags.push(name);
        if (!taskTagMeta.some(function (meta) { return meta.name === name; })) {
          taskTagMeta.push({ name: name, count: 0, firstClaimed: '', desc: group.name + '业务系统' });
        }
      });
    });
    taskTags.forEach(function (name) {
      if (achievementWall.some(function (tag) { return tag.type === '任务标签' && tag.name === name; })) return;
      const meta = taskTagMeta.find(function (m) { return m.name === name; }) || {};
      achievementWall.push({
        name: name, type: '任务标签', count: meta.count || 0,
        stars: 0, star2: 0, star3: 0,
        desc: meta.desc || '完成对应任务后累计',
        unlock: '完成对应任务'
      });
    });
  })();

  /* 近 5 个月团队闭环趋势，按专业组存放，用于领导 / 主管视图。 */
  const teamTrend = {
    app: [36, 42, 39, 46, 44],
    comm: [28, 32, 31, 35, 33],
    online: [20, 24, 22, 27, 26],
    infra: [17, 19, 18, 22, 21]
  };

  const roleTrend = {
    '张经理': [2, 3, 2, 4, 3],
    '王主管': [3, 4, 3, 5, 4]
  };

  /* 个人闭环趋势的历史归档演示数据，仅用于趋势与月份下钻，不进入当前任务台账。 */
  const personalArchive = [
    ['2026-07-12 16:20', 'KNS 接口巡检 03', '巡检', '一般', 4],
    ['2026-07-26 11:10', '机房空调巡检 02', '巡检', '一般', 3],
    ['2026-08-08 17:40', 'KNS 接口优化 05', '开发', '重要', 6],
    ['2026-08-17 15:00', '数据库容量评估 02', '变更', '重要', 5],
    ['2026-08-28 10:30', '核心机房环境巡检 04', '巡检', '重要', 4],
    ['2026-09-09 18:10', '业务系统操作 03', '操作', '一般', 3],
    ['2026-09-23 14:50', 'KNS 接口巡检 06', '巡检', '一般', 4],
    ['2026-10-06 16:30', '防火墙策略评审 02', '变更', '紧急', 2],
    ['2026-10-15 11:20', '办公终端抽查 05', '巡检', '一般', 3],
    ['2026-10-22 19:10', '数据库扩容实施 02', '变更', '重要', 8],
    ['2026-10-30 17:00', 'KNS 接口巡检 07', '巡检', '一般', 4],
    ['2026-10-31 16:40', '缓存策略调整 02', '开发', '重要', 6]
  ].map(function (row, i) {
    return {
      id: 'AR-' + String(i + 1).padStart(3, '0'),
      taskId: '',
      task: row[1].replace(/ \d+$/, ''),
      name: row[1],
      owner: '李工',
      group: 'app',
      type: row[2],
      level: row[3],
      hours: row[4],
      status: '已完成',
      completedAt: row[0]
    };
  });

  const data = {
    meta: {
      org: 'ITO 运维中心',
      site: 'SHA-01',
      region: '华东区',
      version: 'v3.6.2',
      baseDay: BASE_DAY,
      demoNow: DEMO_NOW,
      today: TODAY
    },
    groups, groupHistory, staff, dashboard, trend, tasks, personalArchive, activity, systemGroups, systemAliases, teamTrend, roleTrend,
    inspectionPlans, inspectionRecords, inspectionWeek,
    maintenancePlans, maintenanceRecords,
    duty, dutyTypes, dutyRoster, auths, messages, alertRules, logs, achievements,
    personAchievements, achievementWall, taskTagMeta,
    permissions, roleInfo
    , taskTags, authTypes
    , overhaul
    , dictionaries, fieldDefs
  };

  // A fixed demo date tests expiration against the normal snapshot deadlines.
  const authDateOffset = Math.round((parseDay(dayKey(new Date())) - parseDay(BASE_DAY)) / 86400000);
  shiftSnapshot(data, OFFSET_DAYS);
  data.meta.baseDay = BASE_DAY;
  data.meta.demoNow = DEMO_NOW;
  data.meta.today = TODAY;
  data.meta.offsetDays = OFFSET_DAYS;
  data.meta.autoDate = !IS_OVERRIDE;
  data.meta.demoOverride = IS_OVERRIDE;

  /* 11 月巡检 / 维保补录：让展示时近 7 天与本月记录不为空。 */
  (function seedNovemberRecords() {
    const day = function (n) {
      const d = parseDay(TODAY);
      d.setDate(d.getDate() + n);
      return dayKey(d);
    };
    [
      ['IR-1101', '核心机房周检', 'infra', '刘工', 4, -9, '正常', 12, 0, '温湿度、UPS、消防均正常'],
      ['IR-1102', '网络设备日检', 'comm', '赵工', 2, -7, '异常', 18, 1, '核心交换机 1 个端口错包增长，已转整改'],
      ['IR-1103', '应用系统月检', 'app', '陈工', 3, -5, '正常', 14, 0, '应用与数据库日志正常'],
      ['IR-1104', '在线监测平台巡检', 'online', '孙工', 2, -3, '正常', 9, 0, '采集通道与告警推送正常'],
      ['IR-1105', '核心机房周检', 'infra', '郑工', 4, -1, '正常', 12, 0, '空调与 UPS 运行正常']
    ].forEach(function (r) {
      data.inspectionRecords.push({
        id: r[0], plan: r[1], group: r[2], owner: r[3], hours: r[4],
        time: day(r[5]) + ' 09:00', result: r[6], items: r[7], abnormal: r[8], note: r[9]
      });
    });
    data.maintenanceRecords.push(
      { id: 'MR-302', plan: '机房空调季度维保', group: 'infra', owner: '郑工', hours: 8, time: day(-6) + ' 15:20', result: '完成', vendor: '维保厂商 A', note: '滤网清洗，冷媒压力正常' },
      { id: 'MR-303', plan: '核心交换机固件维保', group: 'comm', owner: '周工', hours: 10, time: day(-2) + ' 22:40', result: '完成', vendor: '原厂服务', note: '固件升级与倒换验证通过' }
    );
  })();

  /* 预置规则触发历史：近 10 天，按规则错峰，供详情时间线展示。 */
  (function seedAlertTriggers() {
    const base = parseDay(DEMO_NOW.slice(0, 10));
    const now = new Date(String(DEMO_NOW).replace(/-/g, '/').replace('T', ' '));
    const sampleHits = function (rule) {
      if (rule.type === 'taskOverdue') {
        const out = [];
        data.tasks.forEach(function (task) {
          if (task.canceled || task.draft) return;
          (task.subs || []).forEach(function (sub) {
            if (!sub.due || ['已完成', '已取消', '草稿', '待分发'].indexOf(sub.status) > -1) return;
            if (new Date(String(sub.due).replace(/-/g, '/')) >= now) return;
            out.push({ key: sub.id, name: sub.name });
          });
        });
        return out.slice(0, 6);
      }
      if (rule.type === 'approvalTimeout') {
        const out = [];
        data.tasks.forEach(function (task) {
          if (task.canceled || task.draft) return;
          (task.subs || []).forEach(function (sub) {
            if (sub.approval && sub.approval.status === '待审批') out.push({ key: sub.id, name: sub.name });
          });
        });
        return out.slice(0, 6);
      }
      if (rule.type === 'inspectionException') {
        return data.inspectionRecords.filter(function (r) { return (Number(r.abnormal) || 0) > 0; })
          .slice(0, 6).map(function (r) { return { key: r.id, name: r.plan }; });
      }
      if (rule.type === 'slaThreshold') {
        return [{ key: 'SLA', name: 'SLA 达成率 ' + data.dashboard.sla + '%' }];
      }
      if (rule.type === 'dutyHandover') {
        const wk = isoWeek(parseDay(DEMO_NOW.slice(0, 10)));
        return [{ key: '第 ' + wk + ' 周', name: '通信值班组 · 第 ' + wk + ' 周' }];
      }
      return [];
    };
    alertRules.forEach(function (rule) {
      const rng = seededRandom(hashSeed(rule.id + '|' + rule.type));
      const hits = sampleHits(rule);
      const maxCount = Math.max(1, hits.length);
      const count = 3 + Math.floor(rng() * 3);
      const list = [];
      for (let i = count; i >= 1; i -= 1) {
        const daysAgo = i * 2 + Math.floor(rng() * 2);
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - daysAgo);
        const hh = 8 + Math.floor(rng() * 11);
        const mm = Math.floor(rng() * 60);
        list.push({ time: dayKey(d) + ' ' + pad2(hh) + ':' + pad2(mm), count: 1 + Math.floor(rng() * maxCount) });
      }
      list.sort(function (a, b) { return b.time.localeCompare(a.time); });
      rule.triggers = list;
      rule.fireCount = (rule.fireCount || 0) + list.length;
      rule.lastFiredAt = list[0].time;
      rule.lastHitCount = list[0].count;
      rule.lastHits = hits.slice(0, list[0].count);
      rule.dedupeUntil = '';
      list.forEach(function (t) {
        const top = hits.slice(0, Math.min(3, t.count)).map(function (h) { return h.key; }).join('、');
        const more = t.count > 3 ? ' 等' : '';
        data.logs.push({
          time: t.time,
          actor: '系统',
          action: '触发预警规则',
          target: rule.id + ' ' + rule.name + ' · ' + t.count + ' 项' + (top ? '（' + top + more + '）' : ''),
          type: '预警'
        });
      });
    });
    data.logs.sort(function (a, b) { return String(b.time).localeCompare(String(a.time)); });
  })();

  /* 任务标签只保留属性勋章中已注册的标签，避免出现系统里不存在的临时词。 */
  (function normalizeTaskTags() {
    const allowed = {};
    taskTags.forEach(function (name) { allowed[name] = true; });
    const clean = function (list) {
      const out = [];
      (list || []).forEach(function (name) {
        if (!allowed[name] || out.indexOf(name) > -1) return;
        out.push(name);
      });
      return out;
    };
    data.tasks.forEach(function (task) {
      task.tags = clean(task.tags);
      (task.subs || []).forEach(function (sub) { sub.tags = clean(sub.tags); });
      if ((task.id === 'T10026' || task.id === 'T10022') && task.tags.indexOf('KCC') === -1) {
        task.tags.unshift('KCC');
      }
    });
  })();

  /* 值班历史归档：7 月至本周之前，每周 4 个角色进入闭环趋势与个人统计。 */
  (function seedDutyArchive() {
    const pool = data.duty.pool || [];
    const roles = ['应急', '线路', '网络', '桌面'];
    if (!pool.length) return;
    const today = parseDay(TODAY);
    const currentMonday = mondayOf(today);
    for (let w = 18; w >= 1; w -= 1) {
      const monday = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() - w * 7);
      const friday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4);
      if (friday > today) continue;
      const offset = -w;
      roles.forEach(function (role, k) {
        const idx = ((offset * 4 + k) % pool.length + pool.length) % pool.length;
        const person = pool[idx];
        data.personalArchive.push({
          id: 'AR-DUTY-' + dayKey(monday) + '-' + k,
          taskId: '',
          task: '通信值班',
          name: '通信值班 · 第' + isoWeek(monday) + '周 · ' + role,
          owner: person,
          group: 'comm',
          type: '值班',
          level: '一般',
          hours: 8,
          status: '已完成',
          completedAt: dayKey(friday) + ' 18:00',
          due: dayKey(friday) + ' 20:00',
          initiator: '赵主管',
          source: '历史归档'
        });
      });
    }
  })();

  /* 员工层赵工的历史闭环补充：让 5 个月趋势有起伏，不是一条平线。 */
  (function seedEmployeeArchive() {
    const today = parseDay(TODAY);
    const pool = [
      ['核心交换机巡检', '巡检', '一般', 4],
      ['通信链路优化', '变更', '重要', 6],
      ['语音网关版本核对', '操作', '一般', 3],
      ['端口流量核对', '巡检', '一般', 2],
      ['路由策略收敛', '变更', '重要', 5]
    ];
    for (let i = 0; i < 4; i += 1) {
      const month = new Date(today.getFullYear(), today.getMonth() - (4 - i), 1);
      const count = [4, 2, 5, 3][i];
      for (let k = 0; k < count; k += 1) {
        const tpl = pool[(i * 2 + k) % pool.length];
        const day = 4 + k * 6 + (i % 3);
        const hh = 10 + ((i + k) % 7);
        const mm = (k * 17 + i * 11) % 60;
        data.personalArchive.push({
          id: 'AR-EMP-' + dayKey(month).slice(0, 7) + '-' + k,
          taskId: '',
          task: tpl[0],
          name: tpl[0] + ' ' + pad2(k + 1),
          owner: '赵工',
          group: 'comm',
          type: tpl[1],
          level: tpl[2],
          hours: tpl[3],
          status: '已完成',
          completedAt: dayKey(new Date(month.getFullYear(), month.getMonth(), day)) + ' ' + pad2(hh) + ':' + pad2(mm),
          due: dayKey(new Date(month.getFullYear(), month.getMonth(), day)) + ' ' + pad2(Math.min(23, hh + 2)) + ':' + pad2(mm),
          initiator: '赵主管',
          source: '历史归档'
        });
      }
    }
  })();

  /* 历史闭环归档：按 teamTrend 生成近 5 个月归档，保证趋势下钻、专业组月报和员工月报都有数据。
     归档只进入趋势 / 月报 / 下钻，不进入当前任务台账，因此不会改变在办与超期口径。 */
  (function seedTrendArchive() {
    const monthKeys = [];
    const base = parseDay(TODAY);
    for (let i = 4; i >= 0; i -= 1) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      monthKeys.push(d.getFullYear() + '-' + pad2(d.getMonth() + 1));
    }
    const templates = {
      app: [
        ['业务系统版本发布', '变更', '重要'],
        ['核心接口联调验证', '开发', '重要'],
        ['应用服务健康巡检', '巡检', '一般'],
        ['数据库慢查询治理', '变更', '重要'],
        ['生产环境补丁验证', '变更', '一般'],
        ['日志平台索引维护', '操作', '一般'],
        ['缓存策略调整', '开发', '重要'],
        ['批量任务异常处理', '操作', '一般']
      ],
      comm: [
        ['核心交换机巡检', '巡检', '重要'],
        ['防火墙策略变更', '变更', '紧急'],
        ['网络链路割接', '操作', '重要'],
        ['端口流量核对', '操作', '一般'],
        ['语音网关版本升级', '变更', '一般'],
        ['无线覆盖优化', '操作', '一般'],
        ['通信机房环境巡检', '巡检', '一般'],
        ['路由策略收敛', '变更', '重要']
      ],
      online: [
        ['在线监测平台巡检', '巡检', '一般'],
        ['终端设备抽检', '巡检', '一般'],
        ['监测数据补录', '操作', '一般'],
        ['误报规则收敛', '变更', '重要'],
        ['数据一致性核对', '操作', '一般'],
        ['采集链路健康检查', '巡检', '一般'],
        ['终端策略下发', '变更', '重要'],
        ['在线率异常处置', '操作', '重要']
      ],
      infra: [
        ['核心机房环境巡检', '巡检', '重要'],
        ['UPS 电池组测试', '巡检', '重要'],
        ['机房空调系统检测', '维保', '一般'],
        ['配电柜巡检', '巡检', '一般'],
        ['消防联动测试', '维保', '重要'],
        ['门禁与监控检查', '巡检', '一般'],
        ['蓄电池内阻检测', '维保', '一般'],
        ['动力环境告警处置', '操作', '紧急']
      ]
    };
    const actualByGroup = {};
    const actualByOwner = {};
    data.tasks.forEach(function (task) {
      if (task.canceled || task.draft) return;
      (task.subs || []).forEach(function (sub) {
        if (sub.status !== '已完成' || !sub.completedAt) return;
        const groupId = sub.group || task.group;
        const key = String(sub.completedAt).slice(0, 7) + '|' + groupId;
        actualByGroup[key] = (actualByGroup[key] || 0) + 1;
        actualByOwner[key + '|' + (sub.owner || '')] = (actualByOwner[key + '|' + (sub.owner || '')] || 0) + 1;
      });
    });
    const archiveByGroup = {};
    const archiveByOwner = {};
    data.personalArchive.forEach(function (item) {
      const key = String(item.completedAt || '').slice(0, 7) + '|' + item.group;
      archiveByGroup[key] = (archiveByGroup[key] || 0) + 1;
      archiveByOwner[key + '|' + (item.owner || '')] = (archiveByOwner[key + '|' + (item.owner || '')] || 0) + 1;
    });

    data.groups.forEach(function (group, groupIndex) {
      const pool = data.staff.filter(function (p) { return p.group === group.id; });
      if (!pool.length) return;
      const manager = group.manager;
      const managerTrend = roleTrend[manager] || [];
      const hasManagerTrend = managerTrend.length > 0;
      const others = pool.filter(function (p) { return p.name !== manager; });
      const fallback = hasManagerTrend && others.length ? others : pool;
      const list = templates[group.id] || templates.app;

      monthKeys.forEach(function (monthKey, monthIndex) {
        const target = (teamTrend[group.id] || [])[monthIndex] || 0;
        const actualKey = monthKey + '|' + group.id;
        const need = Math.max(0, target - (actualByGroup[actualKey] || 0) - (archiveByGroup[actualKey] || 0));
        const managerActual = actualByOwner[actualKey + '|' + manager] || 0;
        const managerArchived = archiveByOwner[actualKey + '|' + manager] || 0;
        const managerNeed = Math.max(0, Math.min(need, (managerTrend[monthIndex] || 0) - managerActual - managerArchived));

        for (let i = 0; i < need; i += 1) {
          const seq = (archiveByGroup[actualKey] || 0) + i + 1;
          const template = list[(seq + monthIndex * 3 + groupIndex) % list.length];
          const day = 1 + ((seq * 5 + monthIndex * 7 + groupIndex * 3) % 27);
          const hour = 9 + ((seq * 3 + groupIndex) % 9);
          const minute = (seq * 17 + monthIndex * 11) % 60;
          const owner = i < managerNeed
            ? manager
            : fallback[(i - managerNeed) % fallback.length].name;
          const completedAt = monthKey + '-' + pad2(day) + ' ' + pad2(hour) + ':' + pad2(minute);
          const due = monthKey + '-' + pad2(day) + ' ' + pad2(Math.min(23, hour + 2)) + ':' + pad2(minute);
          data.personalArchive.push({
            id: 'ARH-' + monthKey.replace('-', '') + '-' + group.code + '-' + String(seq).padStart(3, '0'),
            taskId: '',
            task: template[0],
            name: template[0] + ' ' + pad2(seq),
            owner: owner,
            group: group.id,
            type: template[1],
            level: template[2],
            hours: 2 + ((seq * 3 + monthIndex) % 6),
            status: '已完成',
            completedAt: completedAt,
            due: due,
            initiator: seq % 4 === 0 ? '张经理' : manager,
            source: '历史归档'
          });
        }
      });
    });
  })();

  /* 演示时钟跟随系统后，避免出现“未来消息”：晚于当前演示时间的消息回拨到当前时间之前。 */
  (function clampFutureMessages() {
    const now = parseDay(DEMO_NOW.slice(0, 10));
    const parts = DEMO_NOW.slice(11, 16).split(':');
    now.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
    let changed = false;
    data.messages.forEach(function (message, index) {
      const time = String(message.time || '');
      if (!time || time <= DEMO_NOW) return;
      const d = new Date(now.getTime() - (8 + index * 9) * 60000);
      message.time = dayKey(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
      changed = true;
    });
    if (changed) {
      data.messages.sort(function (a, b) { return String(b.time).localeCompare(String(a.time)); });
    }
  })();

  /* 演示时钟跟随系统后，避免出现“未来日志”：晚于当前演示时间的日志回拨到当前时间之前。 */
  (function clampFutureLogs() {
    const now = parseDay(DEMO_NOW.slice(0, 10));
    const parts = DEMO_NOW.slice(11, 16).split(':');
    now.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
    data.logs.forEach(function (log, index) {
      const time = String(log.time || '');
      if (!time || time <= DEMO_NOW) return;
      const d = new Date(now.getTime() - (3 + index * 4) * 60000);
      log.time = dayKey(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    });
    data.logs.sort(function (a, b) { return String(b.time).localeCompare(String(a.time)); });
  })();

  /* 驾驶舱当前超期按演示时间实时计算；SLA 仍保留近 30 天口径。 */
  (function syncCurrentOverdue() {
    const now = parseDay(DEMO_NOW.slice(0, 10));
    const clock = DEMO_NOW.slice(11, 16).split(':');
    now.setHours(Number(clock[0]), Number(clock[1]), 0, 0);
    let overdue = 0;
    data.tasks.forEach(function (task) {
      if (task.canceled || task.draft) return;
      (task.subs || []).forEach(function (sub) {
        if (['已完成', '已取消', '草稿'].indexOf(sub.status) > -1) return;
        const due = new Date(String(sub.due || '').replace(/-/g, '/'));
        if (!isNaN(due.getTime()) && due < now) overdue += 1;
      });
    });
    data.dashboard.overdue = overdue;
    data.dashboard.health.overdue = overdue;
    data.dashboard.health.normal = Math.max(0, data.dashboard.active - data.dashboard.health.dueSoon - overdue);
  })();

  data.duty.weeks = buildDutyWeeks(TODAY, data.duty);
  const dutyMonday = mondayOf(parseDay(TODAY));
  data.duty.currentKey = dayKey(dutyMonday);
  const dutyNextMonday = new Date(dutyMonday.getFullYear(), dutyMonday.getMonth(), dutyMonday.getDate() + 7);
  data.duty.nextKey = dayKey(dutyNextMonday);

  /* 值班表：通信组一套人员，4 个角色按周轮换，外协 3 人轮换。 */
  (function seedDutyRosters() {
    const META = [
      { key: '应急', post: '通信值班-应急', code: 'TX-YJ' },
      { key: '线路', post: '通信值班-线路', code: 'TX-XL' },
      { key: '网络', post: '通信值班-网络', code: 'TX-WL' },
      { key: '桌面', post: '通信值班-桌面', code: 'TX-ZM' }
    ];
    const commManager = (data.groups.find(function (g) { return g.id === 'comm'; }) || {}).manager;
    const assistant = data.staff.find(function (p) { return p.name === commManager; }) || {};
    data.duty.weeks.forEach(function (w) {
      const roster = [{ post: '通信助理', code: 'TX-ZL', name: commManager || '—', phone: assistant.phone || '' }];
      META.forEach(function (meta, k) {
        const name = (w.team || [])[k];
        if (!name) return;
        const person = data.staff.find(function (p) { return p.name === name; }) || {};
        roster.push({ post: meta.post, code: meta.code, name: name, phone: person.phone || '' });
      });
      if (w.external) {
        roster.push({
          post: '工程公司项目部通讯技术助理', code: '',
          name: w.external.name, phone: w.external.phone, external: true
        });
      }
      w.dutyRoster = roster;
      delete w.team;
      delete w.external;
    });
  })();

  /* 值班出勤：待命不计，出勤按天 8h；本周只生成今天及以前。 */
  (function seedDutyCalls() {
    const currentIdx = data.duty.weeks.findIndex(function (w) { return w.key === data.duty.currentKey; });
    const roles = ['应急', '线路', '网络', '桌面'];
    const reasons = [
      '核心交换机端口异常，现场处置',
      '主干链路告警，现场排查',
      '机房空调告警，现场复位',
      '视频会议终端故障，现场支持',
      'UPS 电池组告警，现场确认',
      '无线覆盖异常，现场优化'
    ];
    const today = parseDay(TODAY);
    let seq = 0;
    data.duty.weeks.forEach(function (w, wi) {
      if (wi > currentIdx) return;
      const isCurrent = wi === currentIdx;
      const maxDay = isCurrent ? Math.max(0, Math.round((today - parseDay(w.start)) / 86400000)) : 6;
      const dayPool = [0, 1, 2, 3, 4, 5, 6].filter(function (d) { return d <= maxDay; });
      const count = isCurrent ? Math.min(2, dayPool.length) : 4 + ((wi % 3 + 3) % 3);
      dayPool.slice(0, count).forEach(function (d, k) {
        const role = roles[(k + ((wi % 4) + 4) % 4) % 4];
        const row = (w.dutyRoster || []).find(function (r) { return r.post.indexOf('通信值班-' + role) > -1; });
        if (!row) return;
        const base = parseDay(w.start);
        const date = dayKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + d));
        seq += 1;
        data.duty.calls.push({
          id: 'DC-' + String(seq).padStart(3, '0'),
          weekKey: w.key,
          date: date,
          person: row.name,
          role: role,
          reason: reasons[(seq + wi) % reasons.length],
          hours: 8
        });
      });
    });
  })();

  /* 值班交接按 R-05 口径默认已完成；页面不再提供交接区块。 */
  (function seedDutyHandover() {
    data.duty.weeks.forEach(function (w) {
      w.handover = {
        status: '已完成', note: '', tasks: [],
        submittedAt: w.start + ' 08:00', submittedBy: '赵主管',
        confirmedAt: w.start + ' 08:06', confirmedBy: '赵主管'
      };
    });
  })();

  /* 自定义字段演示值：列表型字段全部填满，详情型字段保留部分填写。 */
  (function seedFieldDemo() {
    const addDays = function (days) {
      const d = parseDay(TODAY);
      d.setDate(d.getDate() + days);
      return dayKey(d);
    };
    (data.overhaul.items || []).forEach(function (item, i) {
      item.extra = Object.assign({}, item.extra, { deviceNo: 'DTV-' + String(item.seq || i + 1).padStart(3, '0') });
    });
    (data.overhaul.items || []).slice(0, 8).forEach(function (item, i) {
      item.extra = Object.assign({}, item.extra, { safetyCheck: i % 3 === 0 ? '待确认' : '已确认' });
    });
    (data.overhaul.materials || []).forEach(function (m, i) {
      m.extra = Object.assign({}, m.extra, { contractNo: 'HT-2026-' + String(101 + i).padStart(3, '0') });
    });
    (data.overhaul.materials || []).slice(0, 6).forEach(function (m, i) {
      m.extra = Object.assign({}, m.extra, { batchNo: 'B' + ((i % 3) + 1) });
    });
    data.overhaul.demoPersonnelExtras = {
      'comm|A地区': { badgeNo: 'ICU-2026-001' },
      'comm|B地区': { badgeNo: 'ICU-2026-002' },
      'app|A地区': { badgeNo: 'ICU-2026-003' },
      'app|B地区': { badgeNo: 'ICU-2026-004' },
      'online|A地区': { badgeNo: 'ICU-2026-005' },
      'online|B地区': { badgeNo: 'ICU-2026-006' },
      'infra|A地区': { badgeNo: 'ICU-2026-007' },
      'infra|B地区': { badgeNo: 'ICU-2026-008' }
    };
    (data.tasks || []).forEach(function (task, i) {
      const urgent = task.level === '紧急' || i % 5 === 0;
      task.extra = Object.assign({}, task.extra, {
        changeNo: 'BG-2026-' + String(101 + i).padStart(3, '0'),
        changeType: urgent ? '紧急变更' : '常规变更'
      });
      if (urgent) task.extra.emergencyApprover = '王主管';
      (task.subs || []).forEach(function (sub) {
        sub.extra = Object.assign({}, sub.extra, {
          execResult: sub.status === '已完成' ? '正常' : (sub.status === '已挂起' ? '异常' : '待复核')
        });
      });
    });
    (data.inspectionPlans || []).forEach(function (plan, i) {
      plan.extra = Object.assign({}, plan.extra, { pointNo: 'IP-A-' + String(i + 1).padStart(2, '0') });
    });
    (data.inspectionRecords || []).forEach(function (record, i) {
      record.extra = Object.assign({}, record.extra, { measuredTemp: Number((22.5 + i * 0.8).toFixed(1)) });
    });
    (data.inspectionRecords || []).slice(0, 3).forEach(function (record, i) {
      record.extra = Object.assign({}, record.extra, { humidity: 45 + i * 2 });
    });
    (data.maintenancePlans || []).forEach(function (plan, i) {
      plan.extra = Object.assign({}, plan.extra, { contractNo: 'WB-2026-' + String(i + 1).padStart(3, '0') });
    });
    (data.maintenanceRecords || []).forEach(function (record, i) {
      record.extra = Object.assign({}, record.extra, { replacedPart: ['滤网', '风扇模块', '电池组', '温控模块'][i] || '常规耗材' });
    });
    (data.maintenanceRecords || []).slice(0, 3).forEach(function (record, i) {
      record.extra = Object.assign({}, record.extra, { recheckDate: addDays(30 + i * 15) });
    });
    (data.duty.weeks || []).slice(0, 3).forEach(function (week, i) {
      week.extra = Object.assign({}, week.extra, {
        dutyNote: ['重点跟进机房空调运行状态', '交接未闭环告警与在途变更', '关注 UPS 电池组巡检结果'][i]
      });
    });
  })();

  /* ── 模拟实际工时 ─────────────────────────────
     使用固定种子按任务生成工时流水，刷新 / 切日期不随机变化。
     已完成任务实际工时约为预算的 90%–115%；
     进行中任务按当前进度折算；审批中且进度 100% 的任务按预算计。
     工时落在截止日 / 完成日之前的 2–4 个工作日，自动避开未来日期。 */
  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < String(str).length; i += 1) {
      h ^= String(str).charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seededRandom(seed) {
    let a = seed >>> 0;
    return function () {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedWorkLogs(sub) {
    if (!sub || !sub.id) return;
    const budget = Number(sub.hours) || 0;
    if (!budget || sub.status === '已取消') { sub.workLogs = []; return; }
    if (Array.isArray(sub.workLogs) && sub.workLogs.length) {
      sub.actualHours = Math.round(sub.workLogs.reduce(function (n, l) { return n + (Number(l.hours) || 0); }, 0) * 2) / 2;
      return;
    }
    const rng = seededRandom(hashSeed(sub.id + '|' + (sub.owner || '')));
    const progress = Math.min(100, Math.max(0, Number(sub.progress) || 0));
    const done = sub.status === '已完成';
    let actual = done ? budget * (0.9 + rng() * 0.25) : budget * progress / 100;
    actual = Math.round(actual * 2) / 2;
    if (actual <= 0) { sub.workLogs = []; sub.actualHours = 0; return; }

    const today = parseDay(TODAY);
    let end = today;
    const doneDay = sub.completedAt ? parseDay(String(sub.completedAt).slice(0, 10)) : null;
    if (done && doneDay && doneDay <= today) end = doneDay;
    const span = done ? 9 : 16;
    let start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - span);
    if (start > end) start = new Date(end);

    const count = 2 + Math.floor(rng() * 3);
    const weights = [];
    let weightSum = 0;
    for (let i = 0; i < count; i += 1) {
      const w = 0.6 + rng() * 0.8;
      weights.push(w);
      weightSum += w;
    }
    const logs = [];
    let assigned = 0;
    for (let i = 0; i < count; i += 1) {
      const isLast = i === count - 1;
      let hours = isLast ? Math.round((actual - assigned) * 2) / 2 : Math.round(actual * weights[i] / weightSum * 2) / 2;
      if (hours <= 0) continue;
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() +
        Math.round((count === 1 ? 0 : i * (end - start) / (count - 1)) / 86400000));
      logs.push({ date: dayKey(day), hours: hours });
      assigned = Math.round((assigned + hours) * 2) / 2;
    }
    if (!logs.length) {
      logs.push({ date: dayKey(end), hours: actual });
    } else if (assigned !== actual) {
      logs[logs.length - 1].hours = Math.round((logs[logs.length - 1].hours + (actual - assigned)) * 2) / 2;
    }
    sub.workLogs = logs.filter(function (l) { return l.hours > 0; });
    sub.actualHours = Math.round(sub.workLogs.reduce(function (n, l) { return n + l.hours; }, 0) * 2) / 2;
  }

  /* 工时补齐：给当前没有任务的实际执行人补一条组内任务子项，避免工时表整行为 0。 */
  (function seedIdleStaffTasks() {
    const plan = [
      { taskId: 'T10024', id: 'T10024-03', name: '在线监测终端抽检', group: 'online', owner: '田工', hours: 6, progress: 60, days: 2 },
      { taskId: 'T10024', id: 'T10024-04', name: '采集链路健康检查', group: 'online', owner: '董工', hours: 6, progress: 70, days: 2 },
      { taskId: 'T10027', id: 'T10027-04', name: '机房环境巡检记录补录', group: 'infra', owner: '蔡工', hours: 5, progress: 80, days: 3 },
      { taskId: 'T10027', id: 'T10027-05', name: 'UPS 电池组内阻检测协助', group: 'infra', owner: '余工', hours: 8, progress: 50, days: 3 },
      { taskId: 'T10027', id: 'T10027-06', name: '配电柜标识核对与整改', group: 'infra', owner: '杜工', hours: 4, progress: 100, days: 4 },
      { taskId: 'T10027', id: 'T10027-07', name: '消防联动测试记录复核', group: 'infra', owner: '叶工', hours: 6, progress: 40, days: 4 }
    ];
    const today = parseDay(TODAY);
    plan.forEach(function (p) {
      const task = data.tasks.find(function (t) { return t.id === p.taskId; });
      if (!task || (task.subs || []).some(function (s) { return s.id === p.id; })) return;
      const dueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + p.days);
      const sub = {
        id: p.id, name: p.name, group: p.group, owner: p.owner, initiator: task.initiator,
        level: '一般', type: '操作', status: p.progress >= 100 ? '已完成' : '执行中',
        due: dayKey(dueDate) + ' 18:00', hours: p.hours, progress: p.progress,
        auth: '无需授权', ticket: false
      };
      const total = Math.round(p.hours * p.progress / 100 * 2) / 2;
      if (total > 0) {
        const logs = [];
        const parts = total > 4 ? 2 : 1;
        for (let i = 0; i < parts; i += 1) {
          const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (i + 1));
          logs.push({ date: dayKey(d), hours: Math.round(total / parts * 2) / 2 });
        }
        sub.workLogs = logs;
        sub.actualHours = Math.round(logs.reduce(function (n, l) { return n + l.hours; }, 0) * 2) / 2;
        if (sub.status === '已完成') sub.completedAt = logs[0].date + ' 17:30';
      }
      task.subs.push(sub);
    });
  })();

  data.tasks.forEach(function (task) {
    (task.subs || []).forEach(seedWorkLogs);
  });

  /* 工时重排：按人补齐任务子项，把周 / 月负载拉到可展示区间。 */
  (function rebalanceWorkload() {
    const today = parseDay(TODAY);
    const dow = (today.getDay() + 6) % 7;
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow);
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const ws = dayKey(weekStart), we = dayKey(weekEnd);
    const inWeek = function (d) { return d && d >= ws && d <= we; };
    const inMonth = function (d) { return d && String(d).slice(0, 7) === TODAY.slice(0, 7); };
    const templates = {
      app: ['应用系统巡检', '接口联调验证', '版本回归测试', '权限与账号核对'],
      comm: ['通信链路巡检', '设备配置备份', '割接前准备', '语音网关检查'],
      online: ['监测终端抽检', '采集链路检查', '告警规则核对', '监测数据补录'],
      infra: ['机房环境巡检', 'UPS 电池组检查', '空调系统维护', '配电柜核对']
    };
    const loadOf = function (person) {
      let week = 0, month = 0;
      data.tasks.forEach(function (task) {
        (task.subs || []).forEach(function (sub) {
          if (sub.owner !== person.name) return;
          const logs = sub.workLogs || [];
          logs.forEach(function (log) {
            if (inWeek(log.date)) week += Number(log.hours) || 0;
            if (inMonth(log.date)) month += Number(log.hours) || 0;
          });
          if (sub.status !== '已完成') {
            const rem = Math.max(0, (Number(sub.hours) || 0) - logs.reduce(function (n, l) { return n + (Number(l.hours) || 0); }, 0));
            if (inWeek(sub.due)) week += rem;
            if (inMonth(sub.due)) month += rem;
          }
        });
      });
      return { week: week, month: month };
    };
    const addSub = function (person, templateIndex, hours, dueDate, logDates) {
      const candidates = data.tasks.filter(function (t) {
        return !t.canceled && !t.draft && t.group === person.group;
      });
      if (!candidates.length) return;
      const task = candidates[(templateIndex + person.uid.length) % candidates.length];
      const tpl = templates[person.group] || templates.app;
      const seq = task.subs.filter(function (s) { return s.id.indexOf('AUTO-' + person.uid) === 0; }).length + 1;
      const total = Math.max(1, Math.round(hours));
      const logs = [];
      const parts = logDates.length;
      if (parts) {
        const per = Math.round(total * 0.55 / parts * 2) / 2;
        logDates.forEach(function (d) { logs.push({ date: dayKey(d), hours: per }); });
        const diff = Math.round((total - per * parts) * 2) / 2;
        if (diff > 0) logs[logs.length - 1].hours = Math.round((logs[logs.length - 1].hours + diff) * 2) / 2;
      }
      const actual = logs.reduce(function (n, l) { return n + l.hours; }, 0);
      const sub = {
        id: 'AUTO-' + person.uid + '-' + seq,
        name: tpl[(templateIndex + seq) % tpl.length] + ' ' + pad2(seq),
        group: person.group,
        owner: person.name,
        initiator: task.initiator || '赵主管',
        level: '一般',
        type: '操作',
        status: '执行中',
        due: dayKey(dueDate) + ' 18:00',
        hours: total,
        progress: Math.round(actual / total * 100),
        auth: '无需授权',
        ticket: false,
        workLogs: logs,
        actualHours: actual
      };
      task.subs.push(sub);
    };

    data.staff.forEach(function (person, index) {
      let cur = loadOf(person);
      const targetWeek = 22 + (index % 3) * 3;
      const targetMonth = (index % 17 === 0) ? 158 : 95 + (index % 5) * 5;

      /* 本周补齐：due 落在本周，工时流水也落在本周。 */
      const weekNeed = Math.max(0, targetWeek - cur.week);
      if (weekNeed >= 4) {
        const logDates = [];
        const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        const day1 = y >= weekStart ? y : today;
        logDates.push(day1);
        if (dayKey(day1) !== dayKey(today)) logDates.push(today);
        addSub(person, index, weekNeed, weekEnd, logDates);
        cur = loadOf(person);
      }

      /* 月度补齐：due 放在下周或本月内，工时流水放在本月、尽量避开本周。 */
      const monthNeed = Math.max(0, targetMonth - cur.month);
      if (monthNeed >= 6) {
        const due = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate() + 7);
        const finalDue = due <= monthEnd ? due : monthEnd;
        const latest = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 1);
        const logDates = [];
        if (latest >= monthStart) {
          const span = Math.max(1, Math.round((latest - monthStart) / 86400000));
          logDates.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate() + Math.floor(span * 0.3)));
          logDates.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate() + Math.floor(span * 0.7)));
        } else {
          const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
          if (y >= monthStart) logDates.push(y);
        }
        addSub(person, index + 1, monthNeed, finalDue, logDates);
      }
    });
  })();

  /* 全量模拟姓名映射：人员、授权、值班、任务、日志、大修与外部人员统一替换。 */
  const NAME_MAP = {
    '李工': '李承远',
    '陈工': '陈启航',
    '赵工': '赵明川',
    '周工': '周文博',
    '孙工': '孙立恒',
    '吴工': '吴承宇',
    '刘工': '刘景行',
    '郑工': '郑云舟',
    '王主管': '王振邦',
    '赵主管': '赵宏毅',
    '李主管': '李国维',
    '刘主管': '刘建安',
    '林工': '林书言',
    '何工': '何俊驰',
    '高工': '高远航',
    '徐工': '徐嘉宁',
    '马工': '马骁然',
    '朱工': '朱明哲',
    '胡工': '胡启元',
    '郭工': '郭远山',
    '罗工': '罗子谦',
    '梁工': '梁思远',
    '宋工': '宋云开',
    '唐工': '唐正阳',
    '许工': '许星河',
    '邓工': '邓嘉树',
    '冯工': '冯亦辰',
    '曹工': '曹景明',
    '彭工': '彭泽宇',
    '曾工': '曾令仪',
    '肖工': '肖承泽',
    '田工': '田雨辰',
    '董工': '董书恒',
    '袁工': '袁浩然',
    '潘工': '潘立新',
    '蒋工': '蒋云帆',
    '蔡工': '蔡明轩',
    '余工': '余嘉禾',
    '杜工': '杜文清',
    '叶工': '叶青云',
    '张经理': '张维远',
    '吴工（工程公司）': '吴立诚（工程公司）',
    '沈工（工程公司）': '沈望舒（工程公司）',
    '韩工（工程公司）': '韩立言（工程公司）',
    '周皓': '周允成'
  };
  const NAME_KEYS = Object.keys(NAME_MAP).sort(function (a, b) { return b.length - a.length; });
  const NAME_BOUNDARY = '[\\s、，,。；;：:（）()\\[\\]【】《》@+\\/|·\\-]';
  const NAME_ALT = NAME_KEYS.map(function (name) {
    return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('|');
  const NAME_RE = new RegExp('(^|' + NAME_BOUNDARY + ')(' + NAME_ALT + ')(?=$|' + NAME_BOUNDARY + '|[0-9])', 'g');
  const PAREN_NAME_RE = new RegExp('([（(])(' + NAME_ALT + ')(?=[\\u4e00-\\u9fa5])', 'g');

  function renameText(value) {
    return String(value)
      .replace(NAME_RE, function (_, lead, name) { return lead + (NAME_MAP[name] || name); })
      .replace(PAREN_NAME_RE, function (_, lead, name) { return lead + (NAME_MAP[name] || name); });
  }

  const renamedSeen = new WeakSet();
  function renameNames(value) {
    if (typeof value === 'string') return renameText(value);
    if (!value || typeof value !== 'object') return value;
    if (renamedSeen.has(value)) return value;
    renamedSeen.add(value);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) value[i] = renameNames(value[i]);
      return value;
    }
    Object.keys(value).forEach(function (key) {
      const renamedKey = NAME_MAP[key] || key;
      const next = renameNames(value[key]);
      if (renamedKey !== key) delete value[key];
      value[renamedKey] = next;
    });
    return value;
  }
  renameNames(data);

  const ITO = window.ITO = window.ITO || {};
  ITO.authStatus = function (validTo) {
    const date = parseDay(validTo);
    const left = date ? Math.round((date - parseDay(ITO.data.meta.today)) / 86400000) : -9999;
    return { status: left < 0 ? '已过期' : left <= 60 ? '临期' : '有效', left };
  };

  return data;
})();
window.ITO.data = window.ITO_DATA;
