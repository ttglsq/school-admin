import { supabase } from './supabaseClient';

/**
 * 操作日志：记录谁在什么时候改了什么、云端写入是否成功。
 *  - 本地缓冲：localStorage `school_op_logs`，最多保留 800 条（保证断网也能查）
 *  - 云端：写成 app_data 表里 id = `log:<ts>-<rand>` 的行，便于多设备排查
 *  - 日志本身失败绝不影响业务操作（全部 fire-and-forget 且静默）
 */

export const LOG_PREFIX = 'log:';
const LOCAL_KEY = 'school_op_logs';
const LOCAL_CAP = 800;

export type LogAction = 'add' | 'update' | 'delete' | 'save' | 'error' | 'sync';
export type LogEntity =
  | 'teacher' | 'class' | 'student' | 'campus' | 'account'
  | 'salary' | 'monthlyRecord' | 'partTimeRecord' | 'cloud' | 'system';
export type LogResult = 'ok' | 'queued' | 'failed';

export interface OperationLog {
  id: string;
  ts: string;
  actor: string;
  action: LogAction;
  entity: LogEntity;
  /** 操作对象（人看的名称，如"成龙入门2Hills"） */
  target?: string;
  /** 详情 / 变化摘要 */
  detail?: string;
  /** 云端写入结果 */
  result?: LogResult;
}

export const ACTION_LABELS: Record<LogAction, string> = {
  add: '新增',
  update: '修改',
  delete: '删除',
  save: '保存',
  error: '异常',
  sync: '同步',
};

export const ENTITY_LABELS: Record<LogEntity, string> = {
  teacher: '老师',
  class: '班级',
  student: '学生',
  campus: '校区',
  account: '账号',
  salary: '听力系数',
  monthlyRecord: '绩效数据',
  partTimeRecord: '兼职出勤',
  cloud: '云端同步',
  system: '系统',
};

export const RESULT_LABELS: Record<LogResult, string> = {
  ok: '已写入云端',
  queued: '待补传',
  failed: '写入失败',
};

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(l => l());
}

export function onLogChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function readLocal(): OperationLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OperationLog[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(list: OperationLog[]) {
  try {
    const trimmed = list.slice(-LOCAL_CAP);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(trimmed));
  } catch { /* 存储满时忽略 */ }
  notify();
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 只写本地（错误捕获等场景用，不产生云端请求） */
export function appendLocalLog(entry: Omit<OperationLog, 'id' | 'ts'>): OperationLog {
  const log: OperationLog = { ...entry, id: newId(), ts: new Date().toISOString() };
  writeLocal([...readLocal(), log]);
  return log;
}

/** 写一条日志到云端（静默失败） */
async function pushCloudLog(log: OperationLog): Promise<void> {
  try {
    await supabase
      .from('app_data')
      .upsert({ id: `${LOG_PREFIX}${log.id}`, data: log, updated_at: log.ts }, { onConflict: 'id' });
  } catch { /* 日志写不进去不影响业务 */ }
}

/**
 * 记录一条操作日志。
 * @param syncPromise 该操作对应的云端写入 Promise（可选）；有的话会等它结束再记最终结果，
 *                    这样日志里能直接看出"哪一次保存没写进云端"。
 */
export function appendLog(
  entry: Omit<OperationLog, 'id' | 'ts' | 'result'>,
  syncPromise?: Promise<boolean>,
): string {
  const log: OperationLog = { ...entry, id: newId(), ts: new Date().toISOString() };
  writeLocal([...readLocal(), log]);

  if (syncPromise) {
    void syncPromise.then(
      ok => {
        const result: LogResult = ok ? 'ok' : 'queued';
        updateLocal(log.id, { result });
        void pushCloudLog({ ...log, result });
      },
      () => {
        updateLocal(log.id, { result: 'failed' });
        void pushCloudLog({ ...log, result: 'failed' });
      },
    );
  } else {
    void pushCloudLog(log);
  }
  return log.id;
}

function updateLocal(id: string, patch: Partial<OperationLog>) {
  const list = readLocal();
  const idx = list.findIndex(x => x.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], ...patch };
  writeLocal(list);
}

/** 本机日志 */
export function getLocalLogs(): OperationLog[] {
  return readLocal();
}

/** 清空本机日志（只清本机缓存，不影响云端） */
export function clearLocalLogs() {
  writeLocal([]);
}

/** 从云端拉取最近的日志 */
export async function fetchCloudLogs(limit = 500): Promise<OperationLog[]> {
  try {
    const { data, error } = await supabase
      .from('app_data')
      .select('id, data')
      .like('id', `${LOG_PREFIX}*`)
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || [])
      .map(r => r.data as OperationLog)
      .filter(x => x && typeof x === 'object' && x.id && x.ts)
      .filter(x => (x as unknown as Record<string, unknown>).__deleted !== true); // 跳过已清理的日志
  } catch (e) {
    console.warn('[log] 拉取云端日志失败:', e);
    return [];
  }
}

/** 按 id 合并去重（云端 + 本机），按时间倒序 */
export function mergeLogs(a: OperationLog[], b: OperationLog[]): OperationLog[] {
  const map = new Map<string, OperationLog>();
  for (const x of [...a, ...b]) map.set(x.id, x);
  return [...map.values()].sort((x, y) => String(y.ts).localeCompare(String(x.ts)));
}
