import { supabase } from './supabaseClient';
import type { Teacher, ClassInfo, Student, Campus, Account, SalaryStandardData, StudentMonthlyRecord, PartTimeWeeklyRecord } from '@/types';

/**
 * 按行存储方案：复用 app_data 表，每个实体一行。
 * 行 ID 前缀区分类型：teacher:t1, class:c1, student:s1, ...
 * 旧整库 blob (id=main) 保留为备份，不被读取。
 */

const TABLE = 'app_data';

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

/** 从云端拉取所有逐行数据（排除旧 blob id=main） */
export async function fetchAllCloudData(): Promise<FetchResult> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, data')
      .neq('id', 'main');
    if (error) throw error;
    if (!data || data.length === 0) return { ok: true, data: null };

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

    for (const row of data) {
      const id: string = row.id;
      const d = row.data;
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
    console.warn('[cloud] 拉取失败:', e);
    return { ok: false, error: e };
  }
}

/** upsert 单行 */
async function upsertRow(id: string, data: unknown): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ id, data, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('[cloud] upsert 失败:', id, e);
    return false;
  }
}

/** delete 单行 */
async function deleteRow(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('[cloud] delete 失败:', id, e);
    return false;
  }
}

/** 按实体类型的 CRUD 操作 */
export const cloudSync = {
  // 老师
  upsertTeacher: (t: Teacher) => upsertRow(`${PREFIX.teacher}${t.id}`, t),
  deleteTeacher: (id: string) => deleteRow(`${PREFIX.teacher}${id}`),

  // 班级
  upsertClass: (c: ClassInfo) => upsertRow(`${PREFIX.cls}${c.id}`, c),
  deleteClass: (id: string) => deleteRow(`${PREFIX.cls}${id}`),

  // 学生
  upsertStudent: (s: Student) => upsertRow(`${PREFIX.student}${s.id}`, s),
  deleteStudent: (id: string) => deleteRow(`${PREFIX.student}${id}`),

  // 校区
  upsertCampus: (c: Campus) => upsertRow(`${PREFIX.campus}${c.id}`, c),
  deleteCampus: (id: string) => deleteRow(`${PREFIX.campus}${id}`),

  // 账号
  upsertAccount: (a: Account) => upsertRow(`${PREFIX.account}${a.id}`, a),
  deleteAccount: (id: string) => deleteRow(`${PREFIX.account}${id}`),

  // 薪资配置（单行）
  upsertSalaryStandard: (s: SalaryStandardData) => upsertRow(PREFIX.salaryStandard, s),

  // 月度绩效记录
  upsertMonthlyRecord: (r: StudentMonthlyRecord) => upsertRow(`${PREFIX.monthlyRecord}${r.id}`, r),
  deleteMonthlyRecord: (id: string) => deleteRow(`${PREFIX.monthlyRecord}${id}`),

  // D级兼职出勤记录
  upsertPartTimeRecord: (r: PartTimeWeeklyRecord) => upsertRow(`${PREFIX.partTimeRecord}${r.id}`, r),
  deletePartTimeRecord: (id: string) => deleteRow(`${PREFIX.partTimeRecord}${id}`),
};
