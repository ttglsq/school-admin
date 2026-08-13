import { supabase } from './supabaseClient';
import type { Teacher, ClassInfo, Student, Campus, Account, SalaryStandardData, StudentMonthlyRecord } from '@/types';

/** 云端数据包：整库快照（所有业务数据打成一个 JSON） */
export interface CloudDataPackage {
  updatedAt: number; // 上次修改时间戳（ms）
  teachers: Teacher[];
  classes: ClassInfo[];
  students: Student[];
  campuses: Campus[];
  accounts: Account[];
  salaryStandard: SalaryStandardData;
  monthlyRecords: StudentMonthlyRecord[];
}

const TABLE = 'app_data';
const ROW_ID = 'main';

export type FetchResult =
  | { ok: true; data: CloudDataPackage | null } // null = 云端还没有数据
  | { ok: false; error: unknown };              // 网络/权限等失败

/** 从云端拉取整库快照（失败与「无数据」严格区分） */
export async function fetchCloudPackage(): Promise<FetchResult> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('data')
      .eq('id', ROW_ID)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.data) return { ok: true, data: null };
    return { ok: true, data: data.data as CloudDataPackage };
  } catch (e) {
    console.warn('[cloud] 拉取失败:', e);
    return { ok: false, error: e };
  }
}

/** 上传整库快照到云端（upsert id=main） */
export async function pushCloudPackage(pkg: CloudDataPackage): Promise<boolean> {
  try {
    const { error } = await supabase.from(TABLE).upsert(
      { id: ROW_ID, data: pkg, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('[cloud] 上传失败:', e);
    return false;
  }
}

/** 判断某包是否等于「内置种子数据」（全新设备首次打开的状态） */
export function isSeedPackage(pkg: {
  teachers: Teacher[]; classes: ClassInfo[]; students: Student[]; campuses: Campus[];
  accounts: Account[]; salaryStandard: SalaryStandardData; monthlyRecords: StudentMonthlyRecord[];
}, seeds: {
  seedTeachers: Teacher[]; seedClasses: ClassInfo[]; seedStudents: Student[]; seedCampuses: Campus[];
}): boolean {
  if (pkg.monthlyRecords.length > 0) return false;
  if (pkg.accounts.length !== 1 || pkg.accounts[0]?.username !== 'admin') return false;
  return (
    JSON.stringify(pkg.teachers) === JSON.stringify(seeds.seedTeachers) &&
    JSON.stringify(pkg.classes) === JSON.stringify(seeds.seedClasses) &&
    JSON.stringify(pkg.students) === JSON.stringify(seeds.seedStudents) &&
    JSON.stringify(pkg.campuses) === JSON.stringify(seeds.seedCampuses)
  );
}
