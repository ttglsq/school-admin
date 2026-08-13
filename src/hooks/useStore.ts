import { useState, useEffect, useCallback, useRef } from 'react';
import type { Teacher, ClassInfo, Student, Campus, Account, PermissionId, SalaryStandardData, SalaryCoefficientKey, StudentMonthlyRecord } from '@/types';
import { generateId, ALL_PERMISSIONS } from '@/types';
import { SEED_SALARY_STANDARD } from '@/data/salarySeed';
import { fetchCloudPackage, pushCloudPackage, isSeedPackage, type CloudDataPackage } from '@/lib/cloudSync';

const STORAGE_KEYS = {
  teachers: 'school_teachers',
  classes: 'school_classes',
  students: 'school_students',
  campuses: 'school_campuses',
  accounts: 'school_accounts',
  currentUser: 'school_current_user',
  salaryStandard: 'school_salary_standard',
  monthlyRecords: 'school_monthly_records',
  // 云端同步元信息（本地缓存与云端的时间戳）
  cloudMeta: 'school_cloud_meta',
  // 旧版本单账号存储，仅用于数据迁移
  legacyAccount: 'school_account',
  legacyAuth: 'school_auth',
};

export type CloudSyncStatus = 'syncing' | 'synced' | 'offline';

interface CloudMeta { updatedAt: number }

function loadCloudMeta(): CloudMeta | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.cloudMeta);
    return raw ? JSON.parse(raw) as CloudMeta : null;
  } catch { return null; }
}

function saveCloudMeta(meta: CloudMeta) {
  try { localStorage.setItem(STORAGE_KEYS.cloudMeta, JSON.stringify(meta)); } catch { /* ignore */ }
}

// 默认管理员账号
const DEFAULT_ADMIN: Account = {
  id: 'admin',
  username: 'admin',
  password: 'admin123',
  role: 'admin',
  permissions: [...ALL_PERMISSIONS],
  createdAt: '2024-01-01T00:00:00Z',
};

// 加载账号列表（兼容旧版单账号数据）
function loadAccounts(): Account[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.accounts);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  // 旧版：单个可修改账号 -> 迁移为管理员
  try {
    const old = localStorage.getItem(STORAGE_KEYS.legacyAccount);
    if (old) {
      const { username, password } = JSON.parse(old);
      const admin: Account = {
        id: 'admin',
        username: username || 'admin',
        password: password || 'admin123',
        role: 'admin',
        permissions: [...ALL_PERMISSIONS],
        createdAt: '2024-01-01T00:00:00Z',
      };
      localStorage.removeItem(STORAGE_KEYS.legacyAccount);
      localStorage.removeItem(STORAGE_KEYS.legacyAuth);
      return [admin];
    }
  } catch {
    // ignore
  }
  return [{ ...DEFAULT_ADMIN }];
}

// 初始种子数据（导出供云端同步判断「全新设备」使用）
export const seedTeachers: Teacher[] = [
  { id: 't1', name: '王明华', phone: '13800138001', level: 'A', createdAt: '2024-01-15T08:00:00Z' },
  { id: 't2', name: '李秀英', phone: '13800138002', level: 'B', createdAt: '2024-02-20T08:00:00Z' },
  { id: 't3', name: '张伟强', phone: '13800138003', level: 'C', createdAt: '2024-03-10T08:00:00Z' },
];

export const seedCampuses: Campus[] = [
  { id: 'cp1', name: '万象城校区', address: '市中心万象城购物中心3层', createdAt: '2024-01-10T08:00:00Z' },
  { id: 'cp2', name: '高新校区', address: '高新区科技路128号', createdAt: '2024-01-12T08:00:00Z' },
];

export const seedClasses: ClassInfo[] = [
  { id: 'c1', name: '一年级一班', level: 'A', duration: 'A', teacherId: 't1', campusId: 'cp1', createdAt: '2024-01-20T08:00:00Z' },
  { id: 'c2', name: '二年级三班', level: 'B', duration: 'B', teacherId: 't2', campusId: 'cp1', createdAt: '2024-02-25T08:00:00Z' },
  { id: 'c3', name: '幼小衔接班', level: 'C', duration: 'C', teacherId: 't3', campusId: 'cp2', createdAt: '2024-03-15T08:00:00Z' },
];

export const seedStudents: Student[] = [
  { id: 's1', name: '陈小明', contact: '13900139001', classId: 'c1', createdAt: '2024-01-25T08:00:00Z' },
  { id: 's2', name: '刘小红', contact: '13900139002', classId: 'c1', createdAt: '2024-01-26T08:00:00Z' },
  { id: 's3', name: '赵小刚', contact: '13900139003', classId: 'c2', createdAt: '2024-02-28T08:00:00Z' },
  { id: 's4', name: '孙小丽', contact: '13900139004', classId: 'c3', createdAt: '2024-03-18T08:00:00Z' },
  { id: 's5', name: '周小军', contact: '13900139005', classId: '', createdAt: '2024-03-19T08:00:00Z' },
];

const SEEDS = { seedTeachers, seedClasses, seedStudents, seedCampuses };

function loadFromStorage<T>(key: string, seed: T): T {
  try {
    const data = localStorage.getItem(key);
    if (data) return JSON.parse(data);
  } catch {
    // ignore
  }
  // 首次加载写入种子数据
  localStorage.setItem(key, JSON.stringify(seed));
  return seed;
}

function saveToStorage<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function useStore() {
  const [teachers, setTeachers] = useState<Teacher[]>(() => loadFromStorage(STORAGE_KEYS.teachers, seedTeachers));
  const [campuses, setCampuses] = useState<Campus[]>(() => loadFromStorage(STORAGE_KEYS.campuses, seedCampuses));
  const [classes, setClasses] = useState<ClassInfo[]>(() => {
    // 兼容旧数据：缺少 campusId 字段时补空值
    const stored = loadFromStorage(STORAGE_KEYS.classes, seedClasses);
    return stored.map(c => (c.campusId === undefined ? { ...c, campusId: '' } : c));
  });
  const [students, setStudents] = useState<Student[]>(() => loadFromStorage(STORAGE_KEYS.students, seedStudents));
  const [accounts, setAccounts] = useState<Account[]>(() => loadAccounts());
  const [salaryStandard, setSalaryStandard] = useState<SalaryStandardData>(() => loadFromStorage(STORAGE_KEYS.salaryStandard, SEED_SALARY_STANDARD));
  const [monthlyRecords, setMonthlyRecords] = useState<StudentMonthlyRecord[]>(() => {
    const stored = loadFromStorage<StudentMonthlyRecord[]>(STORAGE_KEYS.monthlyRecords, []);
    // 兼容旧数据：没有 week 字段的记录视为第 1 周
    return stored.map(r => (r.week == null ? { ...r, week: 1 } : r));
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    const id = localStorage.getItem(STORAGE_KEYS.currentUser);
    return id || null;
  });

  // ===== 云端同步 =====
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('syncing');
  const bootedRef = useRef(false); // 云同步完成前，不向上传云端（避免覆盖）

  // 组装整库快照
  const buildPackage = useCallback((): CloudDataPackage => ({
    updatedAt: Date.now(),
    teachers, classes, students, campuses, accounts, salaryStandard, monthlyRecords,
  }), [teachers, classes, students, campuses, accounts, salaryStandard, monthlyRecords]);

  // 用云端数据覆盖本地（写 state + 本地缓存 + 同步 meta）
  const applyCloud = useCallback((pkg: CloudDataPackage) => {
    setTeachers(pkg.teachers);
    setClasses(pkg.classes);
    setStudents(pkg.students);
    setCampuses(pkg.campuses);
    setAccounts(pkg.accounts);
    setSalaryStandard(pkg.salaryStandard);
    setMonthlyRecords(pkg.monthlyRecords);
    saveCloudMeta({ updatedAt: pkg.updatedAt });
  }, []);

  // 上传本地快照（成功后记录 meta）
  const uploadLocal = useCallback(async (localPkg: CloudDataPackage) => {
    const ok = await pushCloudPackage(localPkg);
    if (ok) saveCloudMeta({ updatedAt: localPkg.updatedAt });
    return ok;
  }, []);

  // 启动时：拉取云端并合并（只执行一次）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchCloudPackage();
      if (cancelled) return;
      const local = buildPackage();
      if (!res.ok) {
        // 网络/配置失败：继续用本地缓存，提示离线
        setCloudStatus('offline');
        bootedRef.current = true;
        return;
      }
      const remote = res.data;
      const localMeta = loadCloudMeta();
      const localIsSeed = isSeedPackage(local, SEEDS);

      if (!remote) {
        // 云端还没有数据：把本地数据上传作为初始库（保留现有录入）
        const ok = await uploadLocal(local);
        setCloudStatus(ok ? 'synced' : 'offline');
      } else {
        const remoteIsSeed = isSeedPackage(remote, SEEDS);
        if (remoteIsSeed && !localIsSeed) {
          // 云端是空库种子、本地有真实数据 → 本地上传
          const ok = await uploadLocal(local);
          setCloudStatus(ok ? 'synced' : 'offline');
        } else if (localIsSeed && !remoteIsSeed) {
          // 本地是全新种子、云端有真实数据 → 使用云端
          applyCloud(remote);
          setCloudStatus('synced');
        } else {
          // 两边都有数据（或都是种子）：按时间戳，新的覆盖
          if (!localMeta || remote.updatedAt >= localMeta.updatedAt) {
            applyCloud(remote);
            setCloudStatus('synced');
          } else {
            const ok = await uploadLocal(local);
            setCloudStatus(ok ? 'synced' : 'offline');
          }
        }
      }
      bootedRef.current = true;
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 数据变化：防抖 1.5s 上传云端（保留本地缓存兜底）
  const dataRef = useRef<CloudDataPackage>(buildPackage());
  dataRef.current = buildPackage();
  useEffect(() => {
    if (!bootedRef.current) return;
    const t = setTimeout(() => {
      void (async () => {
        const ok = await pushCloudPackage(dataRef.current);
        if (ok) {
          saveCloudMeta({ updatedAt: dataRef.current.updatedAt });
          setCloudStatus('synced');
        } else {
          setCloudStatus('offline');
        }
      })();
    }, 1500);
    return () => clearTimeout(t);
  }, [teachers, classes, students, campuses, accounts, salaryStandard, monthlyRecords]);

  // 持久化
  useEffect(() => { saveToStorage(STORAGE_KEYS.teachers, teachers); }, [teachers]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.campuses, campuses); }, [campuses]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.classes, classes); }, [classes]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.students, students); }, [students]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.accounts, accounts); }, [accounts]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.salaryStandard, salaryStandard); }, [salaryStandard]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.monthlyRecords, monthlyRecords); }, [monthlyRecords]);

  // 老师操作
  const addTeacher = useCallback((data: Omit<Teacher, 'id' | 'createdAt'>) => {
    const teacher: Teacher = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    setTeachers(prev => [...prev, teacher]);
  }, []);

  const updateTeacher = useCallback((id: string, data: Partial<Omit<Teacher, 'id' | 'createdAt'>>) => {
    setTeachers(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
  }, []);

  const deleteTeacher = useCallback((id: string) => {
    setTeachers(prev => prev.filter(t => t.id !== id));
    // 解除班级关联
    setClasses(prev => prev.map(c => c.teacherId === id ? { ...c, teacherId: '' } : c));
  }, []);

  // 校区操作
  const addCampus = useCallback((data: Omit<Campus, 'id' | 'createdAt'>) => {
    const campus: Campus = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    setCampuses(prev => [...prev, campus]);
  }, []);

  const updateCampus = useCallback((id: string, data: Partial<Omit<Campus, 'id' | 'createdAt'>>) => {
    setCampuses(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, []);

  const deleteCampus = useCallback((id: string) => {
    setCampuses(prev => prev.filter(c => c.id !== id));
    // 解除班级关联
    setClasses(prev => prev.map(c => c.campusId === id ? { ...c, campusId: '' } : c));
  }, []);

  // 班级操作
  const addClass = useCallback((data: Omit<ClassInfo, 'id' | 'createdAt'>) => {
    const cls: ClassInfo = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    setClasses(prev => [...prev, cls]);
  }, []);

  const updateClass = useCallback((id: string, data: Partial<Omit<ClassInfo, 'id' | 'createdAt'>>) => {
    setClasses(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, []);

  const deleteClass = useCallback((id: string) => {
    setClasses(prev => prev.filter(c => c.id !== id));
    // 解除学生关联
    setStudents(prev => prev.map(s => s.classId === id ? { ...s, classId: '' } : s));
  }, []);

  // 学生操作
  const addStudent = useCallback((data: Omit<Student, 'id' | 'createdAt'>) => {
    const student: Student = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    setStudents(prev => [...prev, student]);
  }, []);

  const updateStudent = useCallback((id: string, data: Partial<Omit<Student, 'id' | 'createdAt'>>) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  }, []);

  const deleteStudent = useCallback((id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
  }, []);

  // 认证：当前登录用户
  const currentUser = accounts.find(a => a.id === currentUserId) || null;
  const isLoggedIn = !!currentUser;

  const login = useCallback((username: string, password: string): boolean => {
    const found = accounts.find(a => a.username === username && a.password === password);
    if (!found) return false;
    localStorage.setItem(STORAGE_KEYS.currentUser, found.id);
    setCurrentUserId(found.id);
    return true;
  }, [accounts]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    setCurrentUserId(null);
  }, []);

  // ===== 账号管理（管理员操作）=====

  // 添加子账号（角色固定为子账号）
  const addAccount = useCallback((data: { username: string; password: string; permissions: PermissionId[] }) => {
    const acc: Account = {
      ...data,
      id: generateId(),
      role: 'sub',
      createdAt: new Date().toISOString(),
    };
    setAccounts(prev => [...prev, acc]);
  }, []);

  // 更新账号（权限 / 用户名 / 重置密码）
  const updateAccount = useCallback((id: string, data: Partial<Omit<Account, 'id' | 'createdAt' | 'role'>>) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
  }, []);

  // 删除子账号
  const deleteAccount = useCallback((id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id));
  }, []);

  // 当前账号修改自己的用户名 / 密码
  const updateOwnAccount = useCallback((username: string, password: string) => {
    setAccounts(prev => prev.map(a => a.id === currentUserId ? { ...a, username, password } : a));
  }, [currentUserId]);

  // 用户名是否可用（用于新建/改名校验；excludeId 排除自己）
  const isUsernameTaken = useCallback((username: string, excludeId?: string) => {
    return accounts.some(a => a.username === username && a.id !== excludeId);
  }, [accounts]);

  // ===== 听力系数操作 =====

  // 更新某个系数表的全部档位
  const updateSalaryStandard = useCallback((key: SalaryCoefficientKey, rows: SalaryStandardData[SalaryCoefficientKey]) => {
    setSalaryStandard(prev => ({ ...prev, [key]: rows }));
  }, []);

  // 恢复指定系数表为初始值
  const resetSalaryStandard = useCallback((key: SalaryCoefficientKey) => {
    setSalaryStandard(prev => ({ ...prev, [key]: SEED_SALARY_STANDARD[key].map(r => ({ ...r })) }));
  }, []);

  // ===== 月度绩效数据操作 =====

  // 获取某月的全部记录
  const getMonthlyRecords = useCallback((yearMonth: string): StudentMonthlyRecord[] => {
    return monthlyRecords.filter(r => r.yearMonth === yearMonth);
  }, [monthlyRecords]);

  // 批量保存某月某一周的全部记录（覆盖该月该周）
  const saveWeeklyRecords = useCallback((yearMonth: string, week: number, records: StudentMonthlyRecord[]) => {
    setMonthlyRecords(prev => {
      // 删除该月该周旧记录，写入新记录
      const others = prev.filter(r => !(r.yearMonth === yearMonth && r.week === week));
      return [...others, ...records];
    });
  }, []);

  return {
    teachers, classes, students, campuses, accounts, currentUser, salaryStandard, monthlyRecords,
    cloudStatus,
    addTeacher, updateTeacher, deleteTeacher,
    addClass, updateClass, deleteClass,
    addStudent, updateStudent, deleteStudent,
    addCampus, updateCampus, deleteCampus,
    addAccount, updateAccount, deleteAccount, updateOwnAccount, isUsernameTaken,
    updateSalaryStandard, resetSalaryStandard,
    getMonthlyRecords, saveWeeklyRecords,
    isLoggedIn, login, logout,
  };
}
