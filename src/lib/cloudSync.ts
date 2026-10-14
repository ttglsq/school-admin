import { supabase } from './supabaseClient';
import type { Teacher, ClassInfo, Student, Campus, Account, SalaryStandardData, StudentMonthlyRecord, PartTimeWeeklyRecord } from '@/types';

/**
 * 按行存储方案：复用 app_data 表，每个实体一行。
 * 行 ID 前缀区分类型：teacher:t1, class:c1, student:s1, ...
 * 旧整库 blob (id=main) 保留为备份，不被读取。
 *
 * 可靠性设计（2026-10-14）：
 *  1. 分页拉取 —— Supabase/PostgREST 单次最多返回 1000 行，超过必须用 range 翻页；
 *  2. 超时 + 重试 —— 跨境网络抖动不再静默丢数据；
 *  3. 删除兜底 —— 若云端 RLS 未开放 DELETE（.delete() 返回 0 行），
 *     自动改用「软删除」（写 __deleted 墓碑），保证界面上删掉的东西不会复活；
 *  4. 离线队列 —— 写失败的操作落盘排队，联网后自动补传，绝不静默丢失；
 *  5. 读取时跳过墓碑行。
 */

const TABLE = 'app_data';
const PAGE_SIZE = 1000;
const QUEUE_KEY = 'school_pending_ops';
const DELETED_FLAG = '__deleted';

const PREFIX = {
  teacher: 'teacher:',
  cls: 'class:',
  student: 'student:',
  campus: 'campus:',
  account: 'account:',
  salaryStandard: 'config:salary_standard',
  monthlyRecord: 'record:monthly:',
  partTimeRecord: 'record:parttime:',
} as const;

/** 云端拉取的全量数据（按类型分组） */
export interface AllCloudData {
  teachers: Teacher[];
  classes: ClassInfo[];
  students: Student[];
  campuses: Campus[];
  accounts: Account[];
  salaryStandard: SalaryStandardData | null;
  monthlyRecords: StudentMonthlyRecord[];
  partTimeRecords: PartTimeWeeklyRecord[];
}

export type FetchResult =
  | { ok: true; data: AllCloudData | null }
  | { ok: false; error: unknown };

// ============ 基础工具 ============

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/** 给任意 Promise 加超时，避免请求悬挂导致界面一直卡在"同步中" */
function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label}超时(${ms}ms)`)), ms)),
  ]);
}

// ============ 离线队列 ============

interface PendingOp {
  id: string;
  type: 'upsert' | 'delete';
  data?: unknown;
  ts: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function readQueue(): PendingOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingOp[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(q: PendingOp[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch { /* 存储满时忽略 */ }
  listeners.forEach(l => l());
}

function enqueue(op: PendingOp) {
  const q = readQueue().filter(x => x.id !== op.id);
  q.push(op);
  writeQueue(q);
}

function dequeue(id: string) {
  const q = readQueue();
  if (!q.some(x => x.id === id)) return;
  writeQueue(q.filter(x => x.id !== id));
}

/** 当前积压的未同步操作数 */
export function pendingOpCount(): number {
  return readQueue().length;
}

/** 订阅"待同步数量"变化 */
export function onPendingChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** 把离线期间积压的操作补传到云端；返回仍失败的条数 */
export async function flushPending(): Promise<number> {
  const q = readQueue();
  let failed = 0;
  for (const op of q) {
    let ok = false;
    if (op.type === 'upsert') ok = await upsertRow(op.id, op.data);
    else ok = await hardDeleteFallbackSoft(op.id);
    if (ok) dequeue(op.id);
    else failed++;
  }
  return failed;
}

// ============ 读 ============

/** 分页拉取除旧备份(id=main)之外的全部行 */
async function fetchAllRows(): Promise<{ id: string; data: unknown }[]> {
  const out: { id: string; data: unknown }[] = [];
  for (let pass = 0; pass < 60; pass++) {
    const from = pass * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const res = await withTimeout(
      supabase
        .from(TABLE)
        .select('id, data')
        .neq('id', 'main')
        .order('id', { ascending: true })
        .range(from, to),
      25000,
      '拉取云端数据',
    );
    const { data, error } = res as { data: { id: string; data: unknown }[] | null; error: unknown };
    if (error) throw error;
    const batch = data || [];
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return out;
}

/** 从云端拉取所有逐行数据（排除旧 blob id=main 与已删除墓碑） */
export async function fetchAllCloudData(): Promise<FetchResult> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const rows = await fetchAllRows();
      if (rows.length === 0) return { ok: true, data: null };

      const result: AllCloudData = {
        teachers: [],
        classes: [],
        students: [],
        campuses: [],
        accounts: [],
        salaryStandard: null,
        monthlyRecords: [],
        partTimeRecords: [],
      };

      for (const row of rows) {
        const id = row.id;
        const d = row.data;
        if (!d || typeof d !== 'object') continue;
        if ((d as Record<string, unknown>)[DELETED_FLAG] === true) continue; // 墓碑，跳过

        if (id.startsWith(PREFIX.teacher)) result.teachers.push(d as Teacher);
        else if (id.startsWith(PREFIX.cls)) result.classes.push(d as ClassInfo);
        else if (id.startsWith(PREFIX.student)) result.students.push(d as Student);
        else if (id.startsWith(PREFIX.campus)) result.campuses.push(d as Campus);
        else if (id.startsWith(PREFIX.account)) result.accounts.push(d as Account);
        else if (id === PREFIX.salaryStandard) result.salaryStandard = d as SalaryStandardData;
        else if (id.startsWith(PREFIX.monthlyRecord)) result.monthlyRecords.push(d as StudentMonthlyRecord);
        else if (id.startsWith(PREFIX.partTimeRecord)) result.partTimeRecords.push(d as PartTimeWeeklyRecord);
      }

      return { ok: true, data: result };
    } catch (e) {
      lastErr = e;
      console.warn(`[cloud] 拉取失败(第${attempt + 1}次):`, e);
      if (attempt < 2) await sleep(1200 * (attempt + 1));
    }
  }
  return { ok: false, error: lastErr };
}

/** 登录时拉取云端最新账号列表（失败返回 null，调用方回退本地数据） */
export async function fetchCloudAccounts(): Promise<Account[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await withTimeout(
        supabase.from(TABLE).select('id, data').like('id', 'account:*'),
        12000,
        '拉取账号',
      );
      const { data, error } = res as { data: { data: Account }[] | null; error: unknown };
      if (error) throw error;
      return (data || [])
        .map(r => r.data)
        .filter(a => a && (a as unknown as Record<string, unknown>)[DELETED_FLAG] !== true);
    } catch (e) {
      console.warn(`[cloud] 拉取账号失败(第${attempt + 1}次):`, e);
      if (attempt === 0) await sleep(1500);
    }
  }
  return null;
}

// ============ 写 ============

/** upsert 单行（带 3 次重试与超时） */
async function upsertRow(id: string, data: unknown): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { error } = await withTimeout(
        supabase
          .from(TABLE)
          .upsert({ id, data, updated_at: new Date().toISOString() }, { onConflict: 'id' }),
        15000,
        '写入云端',
      );
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn(`[cloud] upsert 失败(第${attempt + 1}次): ${id}`, e);
      if (attempt < 2) await sleep(800 * (attempt + 1));
    }
  }
  return false;
}

/**
 * 删除：优先真删；若云端 RLS 未开放 DELETE（返回 0 行受影响），
 * 退化为软删除（写 __deleted 墓碑），保证界面上删掉的不会复活。
 */
async function hardDeleteFallbackSoft(id: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await withTimeout(
        supabase.from(TABLE).delete().eq('id', id).select('id'),
        15000,
        '删除云端行',
      );
      const { data, error } = res as { data: { id: string }[] | null; error: unknown };
      if (error) throw error;
      if (Array.isArray(data) && data.length > 0) return true; // 真删成功
      break; // 0 行受影响 → 权限不足，转软删除
    } catch (e) {
      console.warn(`[cloud] 硬删除失败(第${attempt + 1}次): ${id}`, e);
      if (attempt === 0) { await sleep(800); continue; }
      return false;
    }
  }

  // 软删除：读取原行 → 打上墓碑标记 → upsert 回去（UPDATE 权限即可）
  try {
    const res = await withTimeout(
      supabase.from(TABLE).select('data').eq('id', id).maybeSingle(),
      15000,
      '读取待删行',
    );
    const { data, error } = res as { data: { data: unknown } | null; error: unknown };
    if (error) throw error;
    if (!data) return true; // 云端本来就没有这一行
    const base = (typeof data.data === 'object' && data.data !== null) ? data.data as Record<string, unknown> : {};
    const tombstone = { ...base, [DELETED_FLAG]: true, __deletedAt: new Date().toISOString() };
    return await upsertRow(id, tombstone);
  } catch (e) {
    console.warn('[cloud] 软删除失败:', id, e);
    return false;
  }
}

/** 写入入口：失败则落盘排队，联网后自动补传 */
async function push(id: string, data: unknown): Promise<boolean> {
  const ok = await upsertRow(id, data);
  if (ok) dequeue(id);
  else enqueue({ id, type: 'upsert', data, ts: Date.now() });
  return ok;
}

/** 删除入口：失败则落盘排队 */
async function remove(id: string): Promise<boolean> {
  const ok = await hardDeleteFallbackSoft(id);
  if (ok) dequeue(id);
  else enqueue({ id, type: 'delete', ts: Date.now() });
  return ok;
}

/** 按实体类型的 CRUD 操作 */
export const cloudSync = {
  // 老师
  upsertTeacher: (t: Teacher) => push(`${PREFIX.teacher}${t.id}`, t),
  deleteTeacher: (id: string) => remove(`${PREFIX.teacher}${id}`),

  // 班级
  upsertClass: (c: ClassInfo) => push(`${PREFIX.cls}${c.id}`, c),
  deleteClass: (id: string) => remove(`${PREFIX.cls}${id}`),

  // 学生
  upsertStudent: (s: Student) => push(`${PREFIX.student}${s.id}`, s),
  deleteStudent: (id: string) => remove(`${PREFIX.student}${id}`),

  // 校区
  upsertCampus: (c: Campus) => push(`${PREFIX.campus}${c.id}`, c),
  deleteCampus: (id: string) => remove(`${PREFIX.campus}${id}`),

  // 账号
  upsertAccount: (a: Account) => push(`${PREFIX.account}${a.id}`, a),
  deleteAccount: (id: string) => remove(`${PREFIX.account}${id}`),

  // 薪资配置（单行）
  upsertSalaryStandard: (s: SalaryStandardData) => push(PREFIX.salaryStandard, s),

  // 月度绩效记录
  upsertMonthlyRecord: (r: StudentMonthlyRecord) => push(`${PREFIX.monthlyRecord}${r.id}`, r),
  deleteMonthlyRecord: (id: string) => remove(`${PREFIX.monthlyRecord}${id}`),

  // D级兼职出勤记录
  upsertPartTimeRecord: (r: PartTimeWeeklyRecord) => push(`${PREFIX.partTimeRecord}${r.id}`, r),
  deletePartTimeRecord: (id: string) => remove(`${PREFIX.partTimeRecord}${id}`),
};
