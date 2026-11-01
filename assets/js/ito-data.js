/* ─────────────────────────────────────────────
   ITO OPS · shared demo data
   Single source for the light management console.
   The cockpit keeps its own live simulation; this file
   is the contract for task / staff / duty modules.
   ───────────────────────────────────────────── */

window.ITO_DATA = (() => {
  'use strict';

  const DEMO_NOW = '2026-11-01 20:56';
  const TODAY = '2026-11-01';

  const groups = [
    { id: 'app',    name: '应用组',     code: 'APP',    manager: '王主管', color: '#EB612A', desc: '业务系统、接口与版本发布' },
    { id: 'comm',   name: '通信组',     code: 'COMM',   manager: '赵主管', color: '#0A72E8', desc: '网络、交换、防火墙与割接' },
    { id: 'online', name: '在线组',     code: 'ONLINE', manager: '李主管', color: '#1FAE5C', desc: '在线监测、终端与数据质量' },
    { id: 'infra',  name: '基础设施组', code: 'INFRA',  manager: '刘主管', color: '#E08A00', desc: '机房、UPS、空调与动力环境' }
  ];

  const staff = [
    { uid: 'E20001', name: '李工', group: 'app',    title: '高级工程师', tags: ['核心岗', 'KCC'],  joined: '2023-02-15', phone: '138****1201' },
    { uid: 'E20002', name: '陈工', group: 'app',    title: '工程师',     tags: ['工程师'],          joined: '2023-06-20', phone: '138****1202' },
    { uid: 'E20003', name: '赵工', group: 'comm',   title: '高级工程师', tags: ['核心岗'],          joined: '2022-11-10', phone: '138****1203' },
    { uid: 'E20005', name: '周工', group: 'comm',   title: '工程师',     tags: ['工程师'],          joined: '2023-03-08', phone: '138****1205' },
    { uid: 'E20006', name: '孙工', group: 'online', title: '高级工程师', tags: ['核心岗', 'DTT'],   joined: '2023-01-12', phone: '138****1206' },
    { uid: 'E20007', name: '吴工', group: 'online', title: '工程师',     tags: ['工程师'],          joined: '2023-07-25', phone: '138****1207' },
    { uid: 'E20004', name: '刘工', group: 'infra',  title: '高级工程师', tags: ['核心岗'],          joined: '2023-01-05', phone: '138****1204' },
    { uid: 'E20008', name: '郑工', group: 'infra',  title: '工程师',     tags: ['工程师'],          joined: '2023-04-18', phone: '138****1208' }
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
    groupActive: { app: 42, comm: 33, online: 29, infra: 24 }
  };

  const trend = {
    labels: ['10/03', '10/08', '10/13', '10/18', '10/23', '10/28', '11/01'],
    newTasks: [10, 12, 9, 13, 14, 7, 6, 11, 13, 10, 14, 15, 9, 8, 13, 15, 14, 17, 18, 10, 9, 14, 16, 15, 18, 19, 11, 10, 16, 18],
    completed: [8, 10, 8, 11, 13, 7, 6, 10, 12, 10, 13, 14, 8, 7, 11, 13, 12, 15, 16, 9, 8, 12, 14, 13, 16, 17, 10, 9, 14, 16],
    daily: [
      '10/03', '10/04', '10/05', '10/06', '10/07', '10/08', '10/09', '10/10', '10/11', '10/12',
      '10/13', '10/14', '10/15', '10/16', '10/17', '10/18', '10/19', '10/20', '10/21', '10/22',
      '10/23', '10/24', '10/25', '10/26', '10/27', '10/28', '10/29', '10/30', '10/31', '11/01'
    ]
  };

  const tasks = [
    {
      id: 'T10027', name: '核心机房季度巡检与整改', group: 'infra', owner: '刘工', initiator: '张总',
      level: '重要', type: '巡检', due: '2026-11-04 18:00', tags: ['机房', '季度巡检'],
      desc: '覆盖核心机房环境、空调、UPS 与消防系统，输出整改闭环清单。',
      subs: [
        { id: 'T10027-01', name: '核心机房环境巡检', group: 'infra', owner: '刘工', initiator: '张总', level: '重要', type: '巡检', status: '执行中', due: '2026-10-31 18:00', hours: 8,  progress: 75, auth: '工作负责人授权', ticket: true },
        { id: 'T10027-02', name: '机房空调系统检测', group: 'infra', owner: '郑工', initiator: '张总', level: '一般', type: '维保', status: '待派发', due: '2026-11-02 17:00', hours: 4,  progress: 0,  auth: '准备工程师授权', ticket: false },
        { id: 'T10027-03', name: 'UPS 电池组测试',    group: 'infra', owner: '郑工', initiator: '张总', level: '紧急', type: '试验', status: '待审批', due: '2026-10-27 20:00', hours: 6,  progress: 0,  auth: '高风险作业授权', ticket: true }
      ]
    },
    {
      id: 'T10026', name: '业务系统版本升级', group: 'app', owner: '陈工', initiator: '王主管',
      level: '重要', type: '变更', due: '2026-11-05 20:00', tags: ['KNS', '版本发布'],
      desc: '完成 KNS 业务系统 v3.6.2 版本升级、回归验证与发布窗口保障。',
      subs: [
        { id: 'T10026-01', name: '需求评审与方案制定', group: 'app', owner: '陈工', initiator: '王主管', level: '重要', type: '变更', status: '已完成', due: '2026-10-26 18:00', hours: 12, progress: 100, auth: '—', ticket: false },
        { id: 'T10026-02', name: '开发与测试',         group: 'app', owner: '李工', initiator: '王主管', level: '重要', type: '开发', status: '执行中', due: '2026-11-03 18:00', hours: 40, progress: 60,  auth: '—', ticket: false }
      ]
    },
    {
      id: 'T10025', name: '通信网络割接', group: 'comm', owner: '赵工', initiator: '张总',
      level: '紧急', type: '操作', due: '2026-11-02 23:00', tags: ['厂房通信', '割接'],
      desc: '核心链路割接与回退验证，保障生产网络零中断。',
      subs: [
        { id: 'T10025-01', name: '割接方案评审',         group: 'comm', owner: '赵工', initiator: '张总', level: '紧急', type: '操作', status: '执行中', due: '2026-10-28 12:00', hours: 4, progress: 50, auth: 'RP1 授权', ticket: true },
        { id: 'T10025-02', name: '割接实施与回退验证',   group: 'comm', owner: '周工', initiator: '张总', level: '紧急', type: '操作', status: '待接收', due: '2026-11-02 23:00', hours: 6, progress: 0,  auth: 'RP1 授权', ticket: true }
      ]
    },
    {
      id: 'T10024', name: '在线监测平台告警治理', group: 'online', owner: '孙工', initiator: '王主管',
      level: '重要', type: '工单', due: '2026-11-03 18:00', tags: ['监测', '告警收敛'],
      desc: '梳理在线监测告警规则，压降重复告警与误报率。',
      subs: [
        { id: 'T10024-01', name: '告警规则梳理', group: 'online', owner: '孙工', initiator: '王主管', level: '重要', type: '工单', status: '已完成', due: '2026-10-29 18:00', hours: 8,  progress: 100, auth: '—', ticket: false },
        { id: 'T10024-02', name: '误报规则收敛', group: 'online', owner: '吴工', initiator: '王主管', level: '重要', type: '工单', status: '执行中', due: '2026-10-31 17:00', hours: 12, progress: 45,  auth: '—', ticket: false }
      ]
    },
    {
      id: 'T10023', name: '防火墙策略变更', group: 'comm', owner: '赵工', initiator: '张总',
      level: '紧急', type: '变更', due: '2026-11-01 22:00', tags: ['防火墙', '策略'],
      desc: '按最小权限原则收敛互联网出口策略，完成审批后实施。',
      subs: [
        { id: 'T10023-01', name: '策略评审与审批', group: 'comm', owner: '周工', initiator: '张总', level: '紧急', type: '变更', status: '待审批', due: '2026-11-01 18:00', hours: 2, progress: 0, auth: '高风险作业授权', ticket: true }
      ]
    },
    {
      id: 'T10022', name: '数据库容量扩容', group: 'app', owner: '陈工', initiator: '王主管',
      level: '重要', type: '变更', due: '2026-11-06 20:00', tags: ['数据库', '容量'],
      desc: '根据容量预测扩容生产库存储与连接池，完成压测验证。',
      subs: [
        { id: 'T10022-01', name: '容量评估',   group: 'app', owner: '李工', initiator: '王主管', level: '重要', type: '变更', status: '已完成', due: '2026-10-30 16:00', hours: 6, progress: 100, auth: '—', ticket: false },
        { id: 'T10022-02', name: '扩容实施',   group: 'app', owner: '陈工', initiator: '王主管', level: '重要', type: '变更', status: '待派发', due: '2026-11-04 20:00', hours: 8, progress: 0,   auth: '准备工程师授权', ticket: true }
      ]
    },
    {
      id: 'T10021', name: 'UPS 电池组半年检', group: 'infra', owner: '刘工', initiator: '张总',
      level: '一般', type: '巡检', due: '2026-11-07 10:00', tags: ['UPS', '动力环境'],
      desc: '完成电池组放电测试、内阻检测与容量评估。',
      subs: [
        { id: 'T10021-01', name: '电池组放电测试', group: 'infra', owner: '郑工', initiator: '张总', level: '一般', type: '巡检', status: '待接收', due: '2026-11-07 10:00', hours: 6, progress: 0, auth: '工作负责人授权', ticket: false }
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
        { id: 'T10019-01', name: '固件兼容性验证', group: 'comm', owner: '赵工', initiator: '张总', level: '重要', type: '变更', status: '待派发', due: '2026-11-06 18:00', hours: 4, progress: 0, auth: '准备工程师授权', ticket: false }
      ]
    },
    {
      id: 'T10018', name: 'KNS 接口性能优化', group: 'app', owner: '李工', initiator: '王主管',
      level: '重要', type: '开发', due: '2026-11-04 18:00', tags: ['KNS', '性能'],
      desc: '定位 KNS 接口慢查询，优化缓存策略与响应时延。',
      subs: [
        { id: 'T10018-01', name: '慢查询分析',   group: 'app', owner: '李工', initiator: '王主管', level: '重要', type: '开发', status: '执行中', due: '2026-10-29 16:00', hours: 8,  progress: 55, auth: '—', ticket: false },
        { id: 'T10018-02', name: '缓存策略调整', group: 'app', owner: '陈工', initiator: '王主管', level: '重要', type: '开发', status: '待审批', due: '2026-11-03 18:00', hours: 12, progress: 0,  auth: '—', ticket: true }
      ]
    },
    {
      id: 'T10017', name: '机房空调系统维保', group: 'infra', owner: '刘工', initiator: '王主管',
      level: '一般', type: '维保', due: '2026-11-06 17:00', tags: ['空调', '维保'],
      desc: '完成滤网清洗、冷媒压力检测与排水系统检查。',
      subs: [
        { id: 'T10017-01', name: '滤网清洗与冷媒检测', group: 'infra', owner: '郑工', initiator: '王主管', level: '一般', type: '维保', status: '已完成', due: '2026-10-31 17:00', hours: 6, progress: 100, auth: '—', ticket: false }
      ]
    },
    {
      id: 'T10016', name: '监测数据补录与核对', group: 'online', owner: '孙工', initiator: '张总',
      level: '一般', type: '操作', due: '2026-11-02 18:00', tags: ['监测', '数据质量'],
      desc: '补录 10 月缺失监测数据，完成跨系统一致性核对。',
      subs: [
        { id: 'T10016-01', name: '10 月缺失数据补录', group: 'online', owner: '孙工', initiator: '张总', level: '一般', type: '操作', status: '已完成', due: '2026-10-31 18:00', hours: 4, progress: 100, auth: '—', ticket: false },
        { id: 'T10016-02', name: '数据一致性核对',     group: 'online', owner: '吴工', initiator: '张总', level: '一般', type: '操作', status: '待接收', due: '2026-11-02 18:00', hours: 3, progress: 0,   auth: '—', ticket: false }
      ]
    }
  ];

  const activity = [
    { time: '2026-11-01 20:12', task: '防火墙策略变更', sub: '策略评审与审批', group: 'comm', owner: '周工', status: '待审批' },
    { time: '2026-11-01 19:40', task: '通信网络割接', sub: '割接实施与回退验证', group: 'comm', owner: '周工', status: '待接收' },
    { time: '2026-11-01 18:25', task: '核心机房季度巡检与整改', sub: 'UPS 电池组测试', group: 'infra', owner: '郑工', status: '待审批' },
    { time: '2026-11-01 16:10', task: '业务系统版本升级', sub: '开发与测试', group: 'app', owner: '李工', status: '执行中' },
    { time: '2026-10-31 17:40', task: '在线监测平台告警治理', sub: '误报规则收敛', group: 'online', owner: '吴工', status: '执行中' },
    { time: '2026-10-31 15:10', task: '机房空调系统维保', sub: '滤网清洗与冷媒检测', group: 'infra', owner: '郑工', status: '已完成' }
  ];

  const inspectionPlans = [
    { id: 'IP-001', name: '核心机房周检', group: 'infra',  cycle: '每周', owner: '刘工', next: '2026-11-02 08:00', status: '启用', content: '机房温度、湿度、UPS、空调系统、消防设备', standard: '温度 20–26℃，湿度 40–60%，UPS 电池电压正常' },
    { id: 'IP-002', name: '网络设备日检', group: 'comm',   cycle: '每日', owner: '赵工', next: '2026-11-02 07:30', status: '启用', content: '交换机、路由器、防火墙运行状态', standard: 'CPU < 70%，内存 < 80%，无端口错包' },
    { id: 'IP-003', name: '应用系统月检', group: 'app',    cycle: '每月', owner: '陈工', next: '2026-11-05 15:00', status: '启用', content: '应用服务器、数据库、中间件', standard: '服务正常运行，无 error 日志' },
    { id: 'IP-004', name: '在线监测平台巡检', group: 'online', cycle: '每日', owner: '孙工', next: '2026-11-02 09:00', status: '启用', content: '采集通道、数据完整率、告警推送', standard: '数据完整率 ≥ 99%，告警延迟 < 30s' },
    { id: 'IP-005', name: 'UPS 电池组月检', group: 'infra', cycle: '每月', owner: '郑工', next: '2026-11-06 10:00', status: '停用', content: '电池组电压、内阻、外观', standard: '单体电压偏差 < 0.05V' }
  ];

  const inspectionRecords = [
    { id: 'IR-1027', plan: '核心机房周检', group: 'infra',  owner: '刘工', time: '2026-10-31 08:10', result: '正常', items: 12, abnormal: 0, note: '温湿度、UPS、消防均正常' },
    { id: 'IR-1026', plan: '网络设备日检', group: 'comm',   owner: '赵工', time: '2026-10-31 07:35', result: '异常', items: 18, abnormal: 2, note: '核心交换机 2 个端口错包增长，已转整改任务' },
    { id: 'IR-1025', plan: '在线监测平台巡检', group: 'online', owner: '孙工', time: '2026-10-30 09:05', result: '正常', items: 9,  abnormal: 0, note: '采集通道与告警推送正常' },
    { id: 'IR-1024', plan: '应用系统月检', group: 'app',    owner: '陈工', time: '2026-10-28 15:20', result: '正常', items: 14, abnormal: 0, note: '应用与数据库无 error 日志' },
    { id: 'IR-1023', plan: '核心机房周检', group: 'infra',  owner: '刘工', time: '2026-10-24 08:05', result: '正常', items: 12, abnormal: 0, note: '完成空调滤网初检' }
  ];

  const maintenancePlans = [
    { id: 'MP-001', name: '机房空调季度维保', group: 'infra', cycle: '每季度', owner: '刘工', vendor: '维保厂商 A', next: '2026-11-06 09:00', status: '启用', scope: '滤网、冷媒、排水、压缩机' },
    { id: 'MP-002', name: 'UPS 电池组半年检', group: 'infra', cycle: '每半年', owner: '郑工', vendor: '维保厂商 B', next: '2026-11-12 10:00', status: '启用', scope: '放电测试、内阻检测、容量评估' },
    { id: 'MP-003', name: '核心交换机固件维保', group: 'comm', cycle: '每年', owner: '赵工', vendor: '原厂服务', next: '2026-12-01 22:00', status: '启用', scope: '固件评估、升级、倒换验证' },
    { id: 'MP-004', name: '消防系统年检', group: 'infra', cycle: '每年', owner: '刘工', vendor: '维保厂商 C', next: '2026-11-20 14:00', status: '停用', scope: '烟感、喷淋、联动测试' }
  ];

  const maintenanceRecords = [
    { id: 'MR-301', plan: '机房空调季度维保', group: 'infra', owner: '郑工', time: '2026-10-31 16:20', result: '完成', vendor: '维保厂商 A', note: '滤网清洗完成，冷媒压力正常' },
    { id: 'MR-300', plan: 'UPS 电池组半年检', group: 'infra', owner: '刘工', time: '2026-10-29 11:05', result: '完成', vendor: '维保厂商 B', note: '放电测试通过，容量 96%' },
    { id: 'MR-299', plan: '核心交换机固件维保', group: 'comm', owner: '周工', time: '2026-10-25 22:40', result: '完成', vendor: '原厂服务', note: '风扇模块更换，运行正常' },
    { id: 'MR-298', plan: '消防系统年检', group: 'infra', owner: '刘工', time: '2026-10-20 14:30', result: '完成', vendor: '维保厂商 C', note: '联动测试通过，待年度复审' }
  ];

  const duty = {
    todayIndex: 6,
    week: [
      { date: '10/26', weekday: '周一', manager: '王主管', day: ['李工', '陈工'], night: ['赵工'], backup: '孙工' },
      { date: '10/27', weekday: '周二', manager: '赵主管', day: ['陈工', '李工'], night: ['周工'], backup: '吴工' },
      { date: '10/28', weekday: '周三', manager: '李主管', day: ['李工', '赵工'], night: ['刘工'], backup: '陈工' },
      { date: '10/29', weekday: '周四', manager: '刘主管', day: ['陈工', '周工'], night: ['郑工'], backup: '李工' },
      { date: '10/30', weekday: '周五', manager: '王主管', day: ['李工', '赵工'], night: ['孙工'], backup: '吴工' },
      { date: '10/31', weekday: '周六', manager: '赵主管', day: ['孙工'], night: ['吴工'], backup: '刘工' },
      { date: '11/01', weekday: '周日', manager: '李主管', day: ['刘工', '郑工'], night: ['陈工'], backup: '吴工' }
    ]
  };

  const auths = [
    { id: 'AU-2026-0187', person: '李工', type: '工作负责人',   group: 'app',    scope: '应用系统变更与发布', validTo: '2026-12-31', status: '有效' },
    { id: 'AU-2026-0186', person: '赵工', type: '高风险作业',   group: 'comm',   scope: '核心网络割接与防火墙变更', validTo: '2026-11-30', status: '有效' },
    { id: 'AU-2026-0185', person: '刘工', type: '工作负责人',   group: 'infra',  scope: '机房动力环境作业', validTo: '2026-12-31', status: '有效' },
    { id: 'AU-2026-0184', person: '周工', type: '准备工程师',   group: 'comm',   scope: '割接前准备与验证', validTo: '2026-11-15', status: '有效' },
    { id: 'AU-2026-0183', person: '吴工', type: '工作班成员',   group: 'online', scope: '在线监测终端作业', validTo: '2026-10-31', status: '已过期' },
    { id: 'AU-2026-0182', person: '郑工', type: '高风险作业',   group: 'infra',  scope: 'UPS 电池组测试', validTo: '2026-11-20', status: '有效' },
    { id: 'AU-2026-0181', person: '陈工', type: '工作负责人',   group: 'app',    scope: '业务系统升级', validTo: '2027-03-31', status: '有效' },
    { id: 'AU-2026-0180', person: '孙工', type: '准备工程师',   group: 'online', scope: '监测平台巡检', validTo: '2026-12-15', status: '有效' }
  ];

  const messages = [
    { id: 'MSG-001', type: '审批', title: '高风险作业授权待审批', body: 'T10027-03「UPS 电池组测试」已提交高风险作业授权，请尽快完成审批。', time: '2026-11-01 18:20', read: false },
    { id: 'MSG-002', type: '超期', title: '防火墙策略评审已超期', body: 'T10023-01「策略评审与审批」已超过截止时间 2 小时，请关注。', time: '2026-11-01 20:00', read: false },
    { id: 'MSG-003', type: '巡检', title: '网络设备日检发现 2 项异常', body: '核心交换机 2 个端口错包增长，系统已自动生成整改任务。', time: '2026-10-31 07:40', read: false },
    { id: 'MSG-004', type: '值班', title: '明日白班交接提醒', body: '11 月 2 日白班：刘工、郑工；夜班：陈工。请提前完成交接。', time: '2026-10-31 18:00', read: true },
    { id: 'MSG-005', type: '发布', title: '业务系统 v3.6.2 发布完成', body: 'KNS 业务系统 v3.6.2 已于 22:10 完成发布，回归验证通过。', time: '2026-10-30 22:10', read: true },
    { id: 'MSG-006', type: '报表', title: '10 月运维月报已生成', body: '10 月运维月报已生成，可在驾驶舱「导出月报」中下载。', time: '2026-10-31 09:00', read: true }
  ];

  const alertRules = [
    { id: 'R-01', name: '任务超期提醒', condition: '超期 > 2 小时', channel: '站内 + 短信', enabled: true },
    { id: 'R-02', name: '高风险作业审批超时', condition: '未审批 > 30 分钟', channel: '站内 + 企业微信', enabled: true },
    { id: 'R-03', name: '巡检异常', condition: '异常项 ≥ 1', channel: '站内', enabled: true },
    { id: 'R-04', name: 'SLA 达成率预警', condition: '达成率 < 97%', channel: '站内 + 邮件', enabled: true },
    { id: 'R-05', name: '值班交接超时', condition: '交接超时 > 15 分钟', channel: '站内', enabled: false }
  ];

  const logs = [
    { time: '2026-11-01 20:12', actor: '王主管', action: '审批通过', target: 'T10027-03 UPS 电池组测试', type: '审批' },
    { time: '2026-11-01 19:40', actor: '周工',   action: '接收任务', target: 'T10025-02 割接实施与回退验证', type: '任务' },
    { time: '2026-11-01 18:25', actor: '系统',   action: '发送超期提醒', target: 'T10023-01 策略评审与审批', type: '系统' },
    { time: '2026-11-01 16:10', actor: '李工',   action: '提交交付物', target: 'T10026-02 开发与测试', type: '任务' },
    { time: '2026-10-31 18:00', actor: '系统',   action: '生成值班交接提醒', target: '11/01 值班班次', type: '系统' },
    { time: '2026-10-31 15:20', actor: '刘工',   action: '完成维保记录', target: 'MR-301 机房空调季度维保', type: '维保' },
    { time: '2026-10-31 09:00', actor: '系统',   action: '生成月度报表', target: '2026 年 10 月运维月报', type: '系统' },
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

  const permissions = {
    leader:   { dashboard: true,  task: true,  inspect: true,  duty: true,  maintain: true,  group: true,  auth: true,  message: true,  config: true  },
    manager:  { dashboard: true,  task: true,  inspect: true,  duty: true,  maintain: true,  group: true,  auth: true,  message: true,  config: false },
    employee: { dashboard: true,  task: true,  inspect: false, duty: true,  maintain: false, group: false, auth: true,  message: true,  config: false },
    admin:    { dashboard: true,  task: false, inspect: false, duty: false, maintain: false, group: true,  auth: true,  message: true,  config: true  }
  };

  const roleInfo = {
    leader:   { name: '张总',       role: '领导层',     avatar: '领', title: '运营负责人', desc: '总览全局、专业组执行与月报' },
    manager:  { name: '王主管',     role: '主管层',     avatar: '主', title: '应用组主管', desc: '任务拆分、派发审批与日常管理' },
    employee: { name: '李工',       role: '员工层',     avatar: '员', title: '高级工程师', desc: '执行任务、提交交付与个人绩效' },
    admin:    { name: '系统管理员', role: '系统管理员', avatar: '管', title: '平台管理员', desc: '账号权限、组织架构与审计' }
  };

  return {
    meta: {
      org: 'ITO 运维中心',
      site: 'SHA-01',
      region: '华东区',
      version: 'v3.6.2',
      demoNow: DEMO_NOW,
      today: TODAY
    },
    groups, staff, dashboard, trend, tasks, activity,
    inspectionPlans, inspectionRecords,
    maintenancePlans, maintenanceRecords,
    duty, auths, messages, alertRules, logs, achievements,
    permissions, roleInfo
  };
})();
