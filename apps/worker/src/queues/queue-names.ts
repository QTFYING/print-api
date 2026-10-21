/** 队列命名唯一来源（server 产、worker 消）。口径对齐 plans/05 §4.1 异步任务清单 */
export const QUEUES = {
  /** 冒烟样例队列：M1 起按真实任务替换 */
  SAMPLE: 'sample',
  /** 导入：展商 Excel / 发票 / ITMA / 观众 */
  IMPORT: 'import',
  /** 导出：financial Summary→to_excel、dues、member_* 族（签名 URL 15 分钟，7 天清理） */
  EXPORT: 'export',
  /** 桥②：老库 expo_exhibitors → 新库名录展示表（每日定时） */
  BRIDGE2_DIRECTORY_SYNC: 'bridge2-directory-sync',
  /** 桥③：新库预登记观众 → 老库回流（带 member_id 映射，每日/开展前） */
  BRIDGE3_PREREG_FLOWBACK: 'bridge3-prereg-flowback',
  /** 报表生成：物化视图刷新 + 驾驶舱基线 */
  REPORT: 'report',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
