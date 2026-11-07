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
    const anchorMonday = mondayOf(parseDay(cfg.anchorMonday));
    const offsetWeeks = Math.round((monday - anchorMonday) / (7 * 86400000));
    const rotation = cfg.rotation;
    const weeks = [];
    for (let i = -cfg.before; i <= cfg.after; i += 1) {
      const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i * 7);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      const idx = ((cfg.anchorIndex + offsetWeeks + i) % rotation.length + rotation.length) % rotation.length;
      weeks.push({
        key: dayKey(start),
        start: dayKey(start),
        end: dayKey(end),
        weekNo: isoWeek(start),
        person: rotation[idx],
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
  const DEMO_NOW = TODAY + ' ' + DEMO_TIME;

  const groups = [
    { id: 'app',    name: '应用组',     code: 'APP',    manager: '王主管', leader: '李工', fullStrength: 13, color: '#EB612A', desc: '业务系统、接口与版本发布' },
    { id: 'comm',   name: '通信组',     code: 'COMM',   manager: '赵主管', leader: '赵工', fullStrength: 13, color: '#0A72E8', desc: '网络、交换、防火墙与割接' },
    { id: 'online', name: '在线组',     code: 'ONLINE', manager: '李主管', leader: '孙工', fullStrength: 12, color: '#1FAE5C', desc: '在线监测、终端与数据质量' },
    { id: 'infra',  name: '基础设施组', code: 'INFRA',  manager: '刘主管', leader: '刘工', fullStrength: 12, color: '#E08A00', desc: '机房、UPS、空调与动力环境' }
  ];

  const groupHistory = {
    months: ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'],
    app: [6, 7, 7, 8, 9, 10],
    comm: [5, 6, 7, 8, 9, 10],
    online: [5, 6, 7, 8, 9, 10],
    infra: [4, 5, 6, 7, 9, 10]
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
    { uid: 'E20010', name: '赵主管', group: 'comm',   title: '通信组主管',   tags: ['管理', '割接'],   joined: '2021-09-06', phone: '13900001203' },
    { uid: 'E20011', name: '李主管', group: 'online', title: '在线组主管',   tags: ['管理', '终端'],   joined: '2022-03-14', phone: '13900001211' },
    { uid: 'E20012', name: '刘主管', group: 'infra',  title: '基础设施组主管', tags: ['管理', '机房'], joined: '2021-11-22', phone: '13900001212' },

    { uid: 'E20013', name: '林工', group: 'app', title: '高级工程师', tags: ['核心岗', 'KCC'], joined: '2024-02-19', phone: '13800001213' },
    { uid: 'E20014', name: '何工', group: 'app', title: '工程师',     tags: ['工程师'],         joined: '2024-06-03', phone: '13800001214' },
    { uid: 'E20015', name: '高工', group: 'app', title: '工程师',     tags: ['KNS'],            joined: '2024-09-12', phone: '13800001215' },
    { uid: 'E20016', name: '徐工', group: 'app', title: '助理工程师', tags: ['工程师'],         joined: '2025-01-08', phone: '13800001216' },
    { uid: 'E20017', name: '马工', group: 'app', title: '工程师',     tags: ['KCC'],            joined: '2025-04-21', phone: '13800001217' },
    { uid: 'E20018', name: '朱工', group: 'app', title: '助理工程师', tags: ['工程师'],         joined: '2025-08-15', phone: '13800001218' },
    { uid: 'E20019', name: '胡工', group: 'app', title: '工程师',     tags: ['KNS'],            joined: '2026-01-12', phone: '13800001219' },

    { uid: 'E20020', name: '郭工', group: 'comm', title: '高级工程师', tags: ['核心岗', '割接'], joined: '2024-01-15', phone: '13800001220' },
    { uid: 'E20021', name: '罗工', group: 'comm', title: '工程师',     tags: ['工程师'],         joined: '2024-05-08', phone: '13800001221' },
    { uid: 'E20022', name: '梁工', group: 'comm', title: '工程师',     tags: ['割接'],           joined: '2024-08-19', phone: '13800001222' },
    { uid: 'E20023', name: '宋工', group: 'comm', title: '助理工程师', tags: ['工程师'],         joined: '2024-12-02', phone: '13800001223' },
    { uid: 'E20024', name: '唐工', group: 'comm', title: '工程师',     tags: ['割接'],           joined: '2025-03-10', phone: '13800001224' },
    { uid: 'E20025', name: '许工', group: 'comm', title: '工程师',     tags: ['工程师'],         joined: '2025-09-23', phone: '13800001225' },
    { uid: 'E20026', name: '邓工', group: 'comm', title: '助理工程师', tags: ['割接'],           joined: '2026-01-06', phone: '13800001226' },

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
    sla: 96.2,
    slaDelta: '+2.1%',
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
      id: 'T10027', name: '核心机房季度巡检与整改', group: 'infra', owner: '刘工', initiator: '张总',
      level: '紧急', type: '巡检', due: '2026-11-04 18:00', tags: ['机房', '季度巡检'],
      desc: '覆盖核心机房环境、空调、UPS 与消防系统，输出整改闭环清单。',
      subs: [
        { id: 'T10027-01', name: '核心机房环境巡检', group: 'infra', owner: '刘工', initiator: '张总', level: '重要', type: '巡检', status: '执行中', due: '2026-10-31 18:00', hours: 8,  progress: 75, auth: '工作负责人授权', ticket: true },
        { id: 'T10027-02', name: '机房空调系统检测', group: 'infra', owner: '郑工', initiator: '张总', level: '一般', type: '维保', status: '待分发', due: '2026-11-03 17:00', hours: 4,  progress: 0,  auth: '无需授权', ticket: false },
        { id: 'T10027-03', name: 'UPS 电池组测试',    group: 'infra', owner: '郑工', initiator: '张总', level: '紧急', type: '试验', status: '审批中', due: '2026-10-27 20:00', hours: 6,  progress: 100, auth: '高风险作业授权', ticket: true, submittedAt: '2026-10-28 09:00', approval: { level: 1, approver: '刘主管', status: '待审批', submittedAt: '2026-10-28 09:00', dueAt: '2026-10-31 09:00', decidedAt: '', comment: '' } }
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
      id: 'T10025', name: '通信网络割接', group: 'comm', owner: '赵工', initiator: '张总',
      level: '紧急', type: '操作', due: '2026-11-02 23:00', tags: ['厂房通信', '割接'],
      desc: '核心链路割接与回退验证，保障生产网络零中断。',
      subs: [
        { id: 'T10025-01', name: '割接方案评审',         group: 'comm', owner: '赵工', initiator: '张总', level: '紧急', type: '操作', status: '执行中', due: '2026-10-28 12:00', hours: 4, progress: 50, auth: 'RP1 授权', ticket: true },
        { id: 'T10025-02', name: '割接实施与回退验证',   group: 'comm', owner: '周工', initiator: '张总', level: '紧急', type: '操作', status: '待分发', due: '2026-11-02 23:00', hours: 6, progress: 0,  auth: 'RP1 授权', ticket: true }
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
      id: 'T10023', name: '防火墙策略变更', group: 'comm', owner: '赵工', initiator: '张总',
      level: '紧急', type: '变更', due: '2026-11-02 22:00', tags: ['防火墙', '策略'],
      desc: '按最小权限原则收敛互联网出口策略，完成审批后实施。',
      subs: [
        { id: 'T10023-01', name: '策略评审与审批', group: 'comm', owner: '周工', initiator: '张总', level: '紧急', type: '变更', status: '审批中', due: '2026-11-02 18:00', hours: 2, progress: 100, auth: '高风险作业授权', ticket: true, submittedAt: '2026-11-01 10:00', approval: { level: 1, approver: '赵主管', status: '待审批', submittedAt: '2026-11-01 10:00', dueAt: '2026-11-04 10:00', decidedAt: '', comment: '' } }
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
      id: 'T10021', name: 'UPS 电池组半年检', group: 'infra', owner: '刘工', initiator: '张总',
      level: '一般', type: '巡检', due: '2026-11-07 10:00', tags: ['UPS', '动力环境'],
      desc: '完成电池组放电测试、内阻检测与容量评估。',
      leaderApproval: { status: '审批中', approver: '张总', submittedAt: '2026-10-31 09:00', dueAt: '2026-11-03 09:00', decidedAt: '', comment: '' },
      subs: [
        { id: 'T10021-01', name: '电池组放电测试', group: 'infra', owner: '郑工', initiator: '张总', level: '一般', type: '巡检', status: '已完成', due: '2026-11-07 10:00', hours: 6, progress: 100, auth: '无需授权', ticket: false, completedAt: '2026-10-31 08:30' }
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
      id: 'T10019', name: '核心交换机固件升级', group: 'comm', owner: '赵工', initiator: '张总',
      level: '重要', type: '变更', due: '2026-11-08 23:00', tags: ['交换机', '固件'],
      desc: '升级核心交换机固件并完成双机倒换验证。',
      subs: [
        { id: 'T10019-01', name: '固件兼容性验证', group: 'comm', owner: '赵工', initiator: '张总', level: '重要', type: '变更', status: '待分发', due: '2026-11-06 18:00', hours: 4, progress: 0, auth: '无需授权', ticket: false }
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
      id: 'T10016', name: '监测数据补录与核对', group: 'online', owner: '孙工', initiator: '张总',
      level: '一般', type: '操作', due: '2026-11-03 18:00', tags: ['监测', '数据质量'],
      desc: '补录 10 月缺失监测数据，完成跨系统一致性核对。',
      subs: [
        { id: 'T10016-01', name: '10 月缺失数据补录', group: 'online', owner: '孙工', initiator: '张总', level: '一般', type: '操作', status: '已完成', due: '2026-10-31 18:00', hours: 4, progress: 100, auth: '—', ticket: false, completedAt: '2026-10-31 17:20' },
        { id: 'T10016-02', name: '数据一致性核对',     group: 'online', owner: '吴工', initiator: '张总', level: '一般', type: '操作', status: '执行中', due: '2026-11-03 18:00', hours: 3, progress: 0,   auth: '—', ticket: false }
      ]
    },
    {
      id: 'T10029', name: '核心交换机巡检报告汇总', group: 'comm', owner: '赵工', initiator: '张总',
      level: '重要', type: '综合', due: '2026-10-30 18:00', tags: ['交换机', '巡检报告'],
      desc: '汇总核心交换机巡检结果并提交领导审批。',
      leaderApproval: { status: '审批中', approver: '张总', submittedAt: '2026-10-29 09:00', dueAt: '2026-11-01 09:00', decidedAt: '', comment: '' },
      subs: [
        { id: 'T10029-01', name: '交换机日志巡检', group: 'comm', owner: '周工', initiator: '张总', level: '重要', type: '巡检', status: '已完成', due: '2026-10-29 18:00', hours: 4, progress: 100, auth: '无需授权', ticket: false, completedAt: '2026-10-29 16:50' },
        { id: 'T10029-02', name: '端口流量核对', group: 'comm', owner: '赵工', initiator: '张总', level: '一般', type: '巡检', status: '已完成', due: '2026-10-30 18:00', hours: 3, progress: 100, auth: '无需授权', ticket: false, completedAt: '2026-10-30 17:40' }
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
    { id: 'MP-004', name: '消防系统年检', group: 'infra', cycle: '每年', owner: '刘工', executor: '刘工', hours: 4, vendor: '维保厂商 C', next: '2026-11-20 14:00', status: '停用', scope: '烟感、喷淋、联动测试' }
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
    rotation: ['李工', '陈工', '赵工', '周工', '孙工', '吴工', '刘工', '郑工'],
    currentKey: '',
    nextKey: '',
    weeks: []
  };

  const dutyRoster = [
    { post: '通信助理', code: 'TX-ZL', name: '赵主管', phone: '13900001203' },
    { post: '通信值班-应急', code: 'TX-YJ', name: '李工', phone: '13800001201' },
    { post: '通信值班-线路', code: 'TX-XL', name: '赵工', phone: '13800001203' },
    { post: '通信值班-网络', code: 'TX-WL', name: '周工', phone: '13800001205' },
    { post: '通信值班-桌面', code: 'TX-ZM', name: '孙工', phone: '13800001206' },
    { post: '工程公司项目部通讯技术助理', code: '', name: '吴工', phone: '13800001207', external: true }
  ];

  const dutyTypes = [
    { id: 'emergency', name: '值班-应急', assistant: '李工', phone: '13800001201', statuses: ['正常', '正常', '正常', '异常', '正常', '正常', '正常'] },
    { id: 'line',      name: '值班-线路', assistant: '赵工', phone: '13800001203', statuses: ['正常', '正常', '正常', '正常', '正常', '异常', '正常'] },
    { id: 'network',   name: '值班-网络', assistant: '周工', phone: '13800001205', statuses: ['正常', '异常', '正常', '正常', '正常', '正常', '正常'] },
    { id: 'desktop',   name: '值班-桌面', assistant: '孙工', phone: '13800001206', statuses: ['正常', '正常', '正常', '正常', '正常', '正常', '正常'] }
  ];

  const auths = [
    { id: 'AU-2026-0187', person: '李工',   type: '工作负责人授权',   group: 'app',    scope: '应用系统变更与发布', validTo: '2026-12-31', status: '有效' },
    { id: 'AU-2026-0186', person: '赵工',   type: '高风险作业授权',   group: 'comm',   scope: '核心网络割接与防火墙变更', validTo: '2026-11-30', status: '有效' },
    { id: 'AU-2026-0185', person: '刘工',   type: '工作负责人授权',   group: 'infra',  scope: '机房动力环境作业', validTo: '2026-12-31', status: '有效' },
    { id: 'AU-2026-0184', person: '周工',   type: '准备工程师授权',   group: 'comm',   scope: '割接前准备与验证', validTo: '2026-11-15', status: '有效' },
    { id: 'AU-2026-0183', person: '吴工',   type: '工具库授权',       group: 'online', scope: '在线监测终端作业', validTo: '2026-10-31', status: '已过期' },
    { id: 'AU-2026-0182', person: '郑工',   type: '高风险作业授权',   group: 'infra',  scope: 'UPS 电池组测试', validTo: '2026-11-20', status: '有效' },
    { id: 'AU-2026-0181', person: '陈工',   type: '工作负责人授权',   group: 'app',    scope: '业务系统升级', validTo: '2027-03-31', status: '有效' },
    { id: 'AU-2026-0180', person: '孙工',   type: '准备工程师授权',   group: 'online', scope: '监测平台巡检', validTo: '2026-12-15', status: '有效' },
    { id: 'AU-2026-0199', person: '王主管', type: '工作负责人授权',   group: 'app',    scope: '应用组变更发布统筹', validTo: '2027-06-30', status: '有效' },
    { id: 'AU-2026-0198', person: '郭工',   type: '登高车作业授权',   group: 'comm',   scope: '通信杆路与登高作业', validTo: '2026-12-31', status: '有效' },
    { id: 'AU-2026-0197', person: '林工',   type: 'RP1 授权',         group: 'app',    scope: 'RP1 业务系统操作', validTo: '2027-03-31', status: '有效' },
    { id: 'AU-2026-0196', person: '冯工',   type: '低压电工证',       group: 'online', scope: '低压配电与终端作业', validTo: '2026-11-30', status: '有效' },
    { id: 'AU-2026-0195', person: '袁工',   type: '高压电工证',       group: 'infra',  scope: '高压配电室作业', validTo: '2026-10-31', status: '已过期' },
    { id: 'AU-2026-0194', person: '罗工',   type: 'RP2 授权',         group: 'comm',   scope: 'RP2 网络设备操作', validTo: '2027-01-31', status: '有效' },
    { id: 'AU-2026-0193', person: '曹工',   type: '工具库授权',       group: 'online', scope: '在线监测工具借还', validTo: '2026-12-15', status: '有效' },
    { id: 'AU-2026-0192', person: '赵主管', type: '高风险作业授权',   group: 'comm',   scope: '通信割接高风险作业统筹', validTo: '2027-05-31', status: '有效' },
    { id: 'AU-2026-0191', person: '高工',   type: '登高车作业授权',   group: 'app',    scope: '应用现场登高作业', validTo: '2026-09-30', status: '已过期' },
    { id: 'AU-2026-0190', person: '宋工',   type: '工具库授权',       group: 'comm',   scope: '通信工具与仪表借还', validTo: '2027-02-28', status: '有效' },
    { id: 'AU-2026-0189', person: '李主管', type: '准备工程师授权',   group: 'online', scope: '在线监测变更准备', validTo: '2026-12-31', status: '有效' },
    { id: 'AU-2026-0188', person: '潘工',   type: '低压电工证',       group: 'infra',  scope: '机房低压配电作业', validTo: '2027-04-30', status: '有效' }
  ];

  const messages = [
    { id: 'MSG-001', type: '审批', title: '高风险作业授权待审批', body: 'T10027-03「UPS 电池组测试」已提交高风险作业授权，请尽快完成审批。', time: '2026-11-02 18:20', read: false },
    { id: 'MSG-002', type: '超期', title: '防火墙策略评审已超期', body: 'T10023-01「策略评审与审批」已超过截止时间近 3 小时，请关注。', time: '2026-11-02 20:00', read: false },
    { id: 'MSG-003', type: '巡检', title: '网络设备日检发现 2 项异常', body: '核心交换机 2 个端口错包增长，系统已自动生成整改任务。', time: '2026-10-31 07:40', read: false },
    { id: 'MSG-004', type: '值班', title: '每周值班交接提醒', body: '下周一 08:00 进行周值班交接，请提前完成未闭环任务、在途变更与告警确认。', time: '2026-11-01 18:00', read: true },
    { id: 'MSG-005', type: '发布', title: '业务系统 v3.6.2 发布完成', body: 'KNS 业务系统 v3.6.2 已于 22:10 完成发布，回归验证通过。', time: '2026-10-30 22:10', read: true },
    { id: 'MSG-006', type: '报表', title: '最近一期运维月报已生成', body: '最近一期个人月报已生成，可在「个人统计」中预览并导出。', time: '2026-10-31 09:00', read: true }
  ];

  const alertRules = [
    { id: 'R-01', name: '任务超期提醒', condition: '超期 > 2 小时', channel: '站内 + 短信', enabled: true },
    { id: 'R-02', name: '高风险作业审批超时', condition: '未审批 > 30 分钟', channel: '站内 + 企业微信', enabled: true },
    { id: 'R-03', name: '巡检异常', condition: '异常项 ≥ 1', channel: '站内', enabled: true },
    { id: 'R-04', name: 'SLA 达成率预警', condition: '达成率 < 97%', channel: '站内 + 邮件', enabled: true },
    { id: 'R-05', name: '值班交接超时', condition: '周一 08:15 未确认交接', channel: '站内', enabled: false }
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
    { name: '割接', stars: 2, count: 5,  group: 'comm',   desc: '核心网络割接与回退验证' },
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
    { person: '张总', name: 'KCC', type: '人员标签', stars: 1, count: 3, firstClaimed: '2025-10-21', desc: '核心业务系统变更与发布' },
    { person: '张总', name: '巡检', type: '任务标签', stars: 0, count: 5, firstClaimed: '2025-11-27', desc: '季度巡检与整改闭环' },
    { person: '张总', name: '变更', type: '任务标签', stars: 0, count: 4, firstClaimed: '2026-02-03', desc: '高风险变更与割接审批' },
    { person: '陈工', name: 'KCC', type: '人员标签', stars: 2, count: 7, firstClaimed: '2025-10-12', desc: '核心业务系统变更与发布' },
    { person: '陈工', name: '机房', type: '人员标签', stars: 1, count: 3, firstClaimed: '2026-01-08', desc: '核心机房巡检与动力环境保障' },
    { person: '赵工', name: '割接', type: '人员标签', stars: 3, count: 11, firstClaimed: '2025-07-21', desc: '核心网络割接与回退验证' },
    { person: '周工', name: '割接', type: '人员标签', stars: 2, count: 6, firstClaimed: '2025-11-15', desc: '核心网络割接与回退验证' },
    { person: '孙工', name: '终端', type: '人员标签', stars: 3, count: 9, firstClaimed: '2025-09-03', desc: '终端安全与基线核查' },
    { person: '吴工', name: '终端', type: '人员标签', stars: 2, count: 5, firstClaimed: '2026-02-17', desc: '终端安全与基线核查' },
    { person: '刘工', name: '机房', type: '人员标签', stars: 3, count: 13, firstClaimed: '2025-06-11', desc: '核心机房巡检与动力环境保障' },
    { person: '郑工', name: '机房', type: '人员标签', stars: 2, count: 7, firstClaimed: '2025-12-01', desc: '核心机房巡检与动力环境保障' }
  ];

  /* 新成员的能力标签：让个人统计 / 月报有内容 */
  const GROUP_TAG = { app: 'KCC', comm: '割接', online: '终端', infra: '机房' };
  const GROUP_TAG_DESC = {
    app: '核心业务系统变更与发布',
    comm: '核心网络割接与回退验证',
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

  const permissions = {
    leader:   { task: true,  inspect: true,  duty: true,  maintain: true,  group: true,  auth: true,  message: true,  config: false },
    manager:  { task: true,  inspect: true,  duty: true,  maintain: true,  group: true,  auth: true,  message: true,  config: false },
    employee: { task: true,  inspect: false, duty: true,  maintain: false, group: false, auth: true,  message: true,  config: false },
    admin:    { task: false, inspect: false, duty: false, maintain: false, group: true,  auth: false, message: true,  config: true  },
    super:    { task: true,  inspect: true,  duty: true,  maintain: true,  group: true,  auth: true,  message: true,  config: true  }
  };

  const roleInfo = {
    leader:   { name: '张总',       role: '领导层',     avatar: '领', title: '运营负责人', desc: '领导审批、任务编辑与个人月报' },
    manager:  { name: '王主管',     role: '主管层',     avatar: '主', title: '应用组主管', desc: '任务拆分、派发审批与日常管理' },
    employee: { name: '李工',       role: '员工层',     avatar: '员', title: '高级工程师', desc: '执行任务、提交交付与个人授权' },
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
    '机房': { star2: 5, star3: 10 },
    '割接': { star2: 5, star3: 10 }
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
    groups, groupHistory, staff, dashboard, trend, tasks, activity,
    inspectionPlans, inspectionRecords, inspectionWeek,
    maintenancePlans, maintenanceRecords,
    duty, dutyTypes, dutyRoster, auths, messages, alertRules, logs, achievements,
    personAchievements, achievementWall, taskTagMeta,
    permissions, roleInfo
    , taskTags, authTypes
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

  data.duty.weeks = buildDutyWeeks(TODAY, data.duty);
  const dutyMonday = mondayOf(parseDay(TODAY));
  data.duty.currentKey = dayKey(dutyMonday);
  const dutyNextMonday = new Date(dutyMonday.getFullYear(), dutyMonday.getMonth(), dutyMonday.getDate() + 7);
  data.duty.nextKey = dayKey(dutyNextMonday);

  const ITO = window.ITO = window.ITO || {};
  ITO.authStatus = function (validTo) {
    const date = parseDay(validTo);
    const left = date ? Math.round((date - parseDay(ITO.data.meta.today)) / 86400000) : -9999;
    return { status: left < 0 ? '已过期' : left <= 60 ? '临期' : '有效', left };
  };

  return data;
})();
window.ITO.data = window.ITO_DATA;
