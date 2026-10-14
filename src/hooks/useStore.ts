import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { Teacher, ClassInfo, Student, Campus, Account, PermissionId, SalaryStandardData, SalaryCoefficientKey, StudentMonthlyRecord, PartTimeWeeklyRecord } from '@/types';
import { generateId, ALL_PERMISSIONS } from '@/types';
import { SEED_SALARY_STANDARD } from '@/data/salarySeed';
import {
  fetchAllCloudData, fetchCloudAccounts, cloudSync,
  flushPending, pendingOpCount, onPendingChange,
} from '@/lib/cloudSync';

const STORAGE_KEYS = {
  teachers: 'school_teachers',
  classes: 'school_classes',
  students: 'school_students',
  campuses: 'school_campuses',
  accounts: 'school_accounts',
  currentUser: 'school_current_user',
  salaryStandard: 'school_salary_standard',
  monthlyRecords: 'school_monthly_records',
  partTimeRecords: 'school_part_time_records',
  legacyAccount: 'school_account',
  legacyAuth: 'school_auth',
};

export type CloudSyncStatus = 'syncing' | 'synced' | 'offline' | 'pending';

const DEFAULT_ADMIN: Account = {
  id: 'admin',
  username: 'admin',
  password: 'admin123',
  role: 'admin',
  permissions: [...ALL_PERMISSIONS],
  createdAt: '2024-01-01T00:00:00Z',
};

function loadAccounts(): Account[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.accounts);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  try {
    const old = localStorage.getItem(STORAGE_KEYS.legacyAccount);
    if (old) {
      const { username, password } = JSON.parse(old);
      const admin: Account = {
        id: 'admin', username: username || 'admin', password: password || 'admin123',
        role: 'admin', permissions: [...ALL_PERMISSIONS], createdAt: '2024-01-01T00:00:00Z',
      };
      localStorage.removeItem(STORAGE_KEYS.legacyAccount);
      localStorage.removeItem(STORAGE_KEYS.legacyAuth);
      return [admin];
    }
  } catch { /* ignore */ }
  return [{ ...DEFAULT_ADMIN }];
}

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

function loadFromStorage<T>(key: string, seed: T): T {
  try {
    const data = localStorage.getItem(key);
    if (data) return JSON.parse(data);
  } catch { /* ignore */ }
  localStorage.setItem(key, JSON.stringify(seed));
  return seed;
}

function saveToStorage<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

// 保存失败提示（节流，避免刷屏）
let lastFailToast = 0;
function notifySaveFailed() {
  const now = Date.now();
  if (now - lastFailToast < 5000) return;
  lastFailToast = now;
  toast.error('云端保存失败，已暂存在本机，联网后会自动补传', { duration: 5000 });
}

export function useStore() {
  const [teachers, setTeachers] = useState<Teacher[]>(() => loadFromStorage(STORAGE_KEYS.teachers, seedTeachers));
  const [campuses, setCampuses] = useState<Campus[]>(() => loadFromStorage(STORAGE_KEYS.campuses, seedCampuses));
  const [classes, setClasses] = useState<ClassInfo[]>(() => {
    const stored = loadFromStorage(STORAGE_KEYS.classes, seedClasses);
    return stored.map(c => (c.campusId === undefined ? { ...c, campusId: '' } : c));
  });
  const [students, setStudents] = useState<Student[]>(() => loadFromStorage(STORAGE_KEYS.students, seedStudents));
  const [accounts, setAccounts] = useState<Account[]>(() => loadAccounts());
  const [salaryStandard, setSalaryStandard] = useState<SalaryStandardData>(() => loadFromStorage(STORAGE_KEYS.salaryStandard, SEED_SALARY_STANDARD));
  const [monthlyRecords, setMonthlyRecords] = useState<StudentMonthlyRecord[]>(() => {
    const stored = loadFromStorage<StudentMonthlyRecord[]>(STORAGE_KEYS.monthlyRecords, []);
    return stored.map(r => (r.week == null ? { ...r, week: 1 } : r));
  });
  const [partTimeRecords, setPartTimeRecords] = useState<PartTimeWeeklyRecord[]>(() =>
    loadFromStorage<PartTimeWeeklyRecord[]>(STORAGE_KEYS.partTimeRecords, [])
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    const id = localStorage.getItem(STORAGE_KEYS.currentUser);
    return id || null;
  });

  // ===== 云端同步 =====
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('syncing');
  const [pendingCount, setPendingCount] = useState<number>(() => pendingOpCount());
  // 云端数据是否已经加载完成（未加载完成前不要录入，否则会基于不完整的数据保存）
  const [cloudLoaded, setCloudLoaded] = useState(false);

  // refs：用于在回调中读取最新状态（避免闭包陷阱）
  const teachersRef = useRef(teachers); teachersRef.current = teachers;
  const classesRef = useRef(classes); classesRef.current = classes;
  const studentsRef = useRef(students); studentsRef.current = students;
  const campusesRef = useRef(campuses); campusesRef.current = campuses;
  const accountsRef = useRef(accounts); accountsRef.current = accounts;
  const salaryStandardRef = useRef(salaryStandard); salaryStandardRef.current = salaryStandard;
  const monthlyRecordsRef = useRef(monthlyRecords); monthlyRecordsRef.current = monthlyRecords;
  const partTimeRecordsRef = useRef(partTimeRecords); partTimeRecordsRef.current = partTimeRecords;

  // 订阅"待同步数量"变化
  useEffect(() => {
    const unsub = onPendingChange(() => setPendingCount(pendingOpCount()));
    return () => { unsub(); };
  }, []);

  // 启动时：先补传离线期间积压的写操作，再拉取云端全量数据
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1) 补传队列
      const stillPending = await flushPending().catch(() => -1);
      if (cancelled) return;
      if (stillPending !== 0) {
        // 本机还有没同步出去的编辑（或补传状态未知）—— 绝不能用云端数据覆盖本地，
        // 否则就会出现"昨天录的数据今天不见了"
        setPendingCount(stillPending > 0 ? stillPending : pendingOpCount());
        setCloudStatus('pending');
        setCloudLoaded(true);
        return;
      }

      // 2) 拉取云端
      const res = await fetchAllCloudData();
      if (cancelled) return;
      if (!res.ok) {
        setCloudStatus('offline');
        setCloudLoaded(true);
        return;
      }
      const cloud = res.data;
      if (!cloud) {
        setCloudStatus('synced');
        setCloudLoaded(true);
        return;
      }
      setTeachers(cloud.teachers);
      setClasses(cloud.classes);
      setStudents(cloud.students);
      setCampuses(cloud.campuses);
      // 账号：云端为空时不要覆盖本地，避免把自己锁在门外
      if (cloud.accounts.length > 0) setAccounts(cloud.accounts);
      if (cloud.salaryStandard) setSalaryStandard(cloud.salaryStandard);
      setMonthlyRecords(cloud.monthlyRecords);
      setPartTimeRecords(cloud.partTimeRecords);
      setCloudStatus('synced');
      setCloudLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // 后台定时补传 + 网络恢复时立即补传
  useEffect(() => {
    const tick = async () => {
      if (pendingOpCount() === 0) return;
      const left = await flushPending().catch(() => -1);
      if (left < 0) return;
      setPendingCount(left);
      if (left === 0) setCloudStatus('synced');
    };
    const timer = window.setInterval(() => { void tick(); }, 30000);
    const onOnline = () => { void tick(); };
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  // localStorage 持久化
  useEffect(() => { saveToStorage(STORAGE_KEYS.teachers, teachers); }, [teachers]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.campuses, campuses); }, [campuses]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.classes, classes); }, [classes]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.students, students); }, [students]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.accounts, accounts); }, [accounts]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.salaryStandard, salaryStandard); }, [salaryStandard]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.monthlyRecords, monthlyRecords); }, [monthlyRecords]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.partTimeRecords, partTimeRecords); }, [partTimeRecords]);

  /** 统一的云端写入：失败会提示，并已自动入离线队列 */
  const pushCloud = useCallback((p: Promise<boolean>) => {
    void p.then(ok => { if (!ok) notifySaveFailed(); }).catch(() => notifySaveFailed());
  }, []);

  // ===== 老师操作 =====
  const addTeacher = useCallback((data: Omit<Teacher, 'id' | 'createdAt'>) => {
    const teacher: Teacher = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    setTeachers(prev => [...prev, teacher]);
    pushCloud(cloudSync.upsertTeacher(teacher));
  }, [pushCloud]);

  const updateTeacher = useCallback((id: string, data: Partial<Omit<Teacher, 'id' | 'createdAt'>>) => {
    const existing = teachersRef.current.find(t => t.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    setTeachers(prev => prev.map(t => t.id === id ? updated : t));
    pushCloud(cloudSync.upsertTeacher(updated));
  }, [pushCloud]);

  const deleteTeacher = useCallback((id: string) => {
    pushCloud(cloudSync.deleteTeacher(id));
    setTeachers(prev => prev.filter(t => t.id !== id));
    setClasses(prev => prev.map(c => c.teacherId === id ? { ...c, teacherId: '' } : c));
    const affected = classesRef.current.filter(c => c.teacherId === id);
    for (const c of affected) pushCloud(cloudSync.upsertClass({ ...c, teacherId: '' }));
  }, [pushCloud]);

  // ===== 校区操作 =====
  const addCampus = useCallback((data: Omit<Campus, 'id' | 'createdAt'>) => {
    const campus: Campus = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    setCampuses(prev => [...prev, campus]);
    pushCloud(cloudSync.upsertCampus(campus));
  }, [pushCloud]);

  const updateCampus = useCallback((id: string, data: Partial<Omit<Campus, 'id' | 'createdAt'>>) => {
    const existing = campusesRef.current.find(c => c.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    setCampuses(prev => prev.map(c => c.id === id ? updated : c));
    pushCloud(cloudSync.upsertCampus(updated));
  }, [pushCloud]);

  const deleteCampus = useCallback((id: string) => {
    pushCloud(cloudSync.deleteCampus(id));
    setCampuses(prev => prev.filter(c => c.id !== id));
    setClasses(prev => prev.map(c => c.campusId === id ? { ...c, campusId: '' } : c));
    const affected = classesRef.current.filter(c => c.campusId === id);
    for (const c of affected) pushCloud(cloudSync.upsertClass({ ...c, campusId: '' }));
  }, [pushCloud]);

  // ===== 班级操作 =====
  const addClass = useCallback((data: Omit<ClassInfo, 'id' | 'createdAt'>) => {
    const cls: ClassInfo = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    setClasses(prev => [...prev, cls]);
    pushCloud(cloudSync.upsertClass(cls));
  }, [pushCloud]);

  const updateClass = useCallback((id: string, data: Partial<Omit<ClassInfo, 'id' | 'createdAt'>>) => {
    const existing = classesRef.current.find(c => c.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    setClasses(prev => prev.map(c => c.id === id ? updated : c));
    pushCloud(cloudSync.upsertClass(updated));
  }, [pushCloud]);

  const deleteClass = useCallback((id: string) => {
    pushCloud(cloudSync.deleteClass(id));
    setClasses(prev => prev.filter(c => c.id !== id));
    setStudents(prev => prev.map(s => s.classId === id ? { ...s, classId: '' } : s));
    const affected = studentsRef.current.filter(s => s.classId === id);
    for (const s of affected) pushCloud(cloudSync.upsertStudent({ ...s, classId: '' }));
  }, [pushCloud]);

  // ===== 学生操作 =====
  const addStudent = useCallback((data: Omit<Student, 'id' | 'createdAt'>) => {
    const student: Student = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    setStudents(prev => [...prev, student]);
    pushCloud(cloudSync.upsertStudent(student));
  }, [pushCloud]);

  const updateStudent = useCallback((id: string, data: Partial<Omit<Student, 'id' | 'createdAt'>>) => {
    const existing = studentsRef.current.find(s => s.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    setStudents(prev => prev.map(s => s.id === id ? updated : s));
    pushCloud(cloudSync.upsertStudent(updated));
  }, [pushCloud]);

  const deleteStudent = useCallback((id: string) => {
    pushCloud(cloudSync.deleteStudent(id));
    setStudents(prev => prev.filter(s => s.id !== id));
  }, [pushCloud]);

  // ===== 认证 =====
  const currentUser = accounts.find(a => a.id === currentUserId) || null;
  const isLoggedIn = !!currentUser;

  // 登录：优先用云端最新账号校验（防止本地陈旧数据导致正确密码登不上），失败回退本地
  // 返回 true=成功；'cloud-unreachable'=云端连不上且本地账号也不匹配；false=账号密码错误
  const login = useCallback(async (username: string, password: string): Promise<boolean | 'cloud-unreachable'> => {
    let list = accountsRef.current;
    const cloudAccounts = await fetchCloudAccounts();
    if (cloudAccounts && cloudAccounts.length > 0) {
      list = cloudAccounts;
      setAccounts(cloudAccounts);
    } else if (cloudAccounts === null) {
      // 云端不可达，用本地缓存校验
      const found = list.find(a => a.username === username && a.password === password);
      if (!found) return 'cloud-unreachable';
      localStorage.setItem(STORAGE_KEYS.currentUser, found.id);
      setCurrentUserId(found.id);
      return true;
    }
    const found = list.find(a => a.username === username && a.password === password);
    if (!found) return false;
    localStorage.setItem(STORAGE_KEYS.currentUser, found.id);
    setCurrentUserId(found.id);
    return true;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    setCurrentUserId(null);
  }, []);

  // ===== 账号管理 =====
  const addAccount = useCallback((data: { username: string; password: string; permissions: PermissionId[] }) => {
    const acc: Account = { ...data, id: generateId(), role: 'sub', createdAt: new Date().toISOString() };
    setAccounts(prev => [...prev, acc]);
    pushCloud(cloudSync.upsertAccount(acc));
  }, [pushCloud]);

  const updateAccount = useCallback((id: string, data: Partial<Omit<Account, 'id' | 'createdAt' | 'role'>>) => {
    const existing = accountsRef.current.find(a => a.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    setAccounts(prev => prev.map(a => a.id === id ? updated : a));
    pushCloud(cloudSync.upsertAccount(updated));
  }, [pushCloud]);

  const deleteAccount = useCallback((id: string) => {
    pushCloud(cloudSync.deleteAccount(id));
    setAccounts(prev => prev.filter(a => a.id !== id));
  }, [pushCloud]);

  const updateOwnAccount = useCallback((username: string, password: string) => {
    const existing = accountsRef.current.find(a => a.id === currentUserId);
    if (!existing) return;
    const updated = { ...existing, username, password };
    setAccounts(prev => prev.map(a => a.id === currentUserId ? updated : a));
    pushCloud(cloudSync.upsertAccount(updated));
  }, [currentUserId, pushCloud]);

  const isUsernameTaken = useCallback((username: string, excludeId?: string) => {
    return accountsRef.current.some(a => a.username === username && a.id !== excludeId);
  }, []);

  // ===== 听力系数操作 =====
  const updateSalaryStandard = useCallback((key: SalaryCoefficientKey, rows: SalaryStandardData[SalaryCoefficientKey]) => {
    const updated = { ...salaryStandardRef.current, [key]: rows };
    setSalaryStandard(updated);
    pushCloud(cloudSync.upsertSalaryStandard(updated));
  }, [pushCloud]);

  const resetSalaryStandard = useCallback((key: SalaryCoefficientKey) => {
    const updated = { ...salaryStandardRef.current, [key]: SEED_SALARY_STANDARD[key].map(r => ({ ...r })) };
    setSalaryStandard(updated);
    pushCloud(cloudSync.upsertSalaryStandard(updated));
  }, [pushCloud]);

  // ===== 月度绩效数据操作 =====
  const getMonthlyRecords = useCallback((yearMonth: string): StudentMonthlyRecord[] => {
    return monthlyRecordsRef.current.filter(r => r.yearMonth === yearMonth);
  }, []);

  /**
   * 保存某老师某周的数据。
   * ⚠️ 重要：清理旧记录时，必须限定在「本次涉及的老师名下班级」的范围内，
   * 否则会把其他老师同一周的数据一并删掉（历史 bug，会导致"昨天的数据不见了"）。
   */
  const saveWeeklyRecords = useCallback((yearMonth: string, week: number, records: StudentMonthlyRecord[]) => {
    const touchedClassIds = new Set(records.map(r => r.classId));
    const involvedTeacherIds = new Set(
      classesRef.current
        .filter(c => touchedClassIds.has(c.id))
        .map(c => c.teacherId)
        .filter((t): t is string => !!t)
    );
    const scopeClassIds = new Set(
      classesRef.current
        .filter(c => c.teacherId && involvedTeacherIds.has(c.teacherId))
        .map(c => c.id)
    );

    const oldForWeek = monthlyRecordsRef.current.filter(r =>
      r.yearMonth === yearMonth && r.week === week && scopeClassIds.has(r.classId)
    );
    const newIds = new Set(records.map(r => r.id));
    for (const old of oldForWeek) {
      if (!newIds.has(old.id)) pushCloud(cloudSync.deleteMonthlyRecord(old.id));
    }
    for (const rec of records) {
      pushCloud(cloudSync.upsertMonthlyRecord(rec));
    }
    setMonthlyRecords(prev => {
      const others = prev.filter(r => !(r.yearMonth === yearMonth && r.week === week && scopeClassIds.has(r.classId)));
      return [...others, ...records];
    });
  }, [pushCloud]);

  // ===== D级兼职老师出勤记录 =====
  const savePartTimeRecords = useCallback((yearMonth: string, week: number, records: PartTimeWeeklyRecord[]) => {
    const teacherIds = new Set(records.map(r => r.teacherId));
    const oldForWeek = partTimeRecordsRef.current.filter(r =>
      r.yearMonth === yearMonth && r.week === week && teacherIds.has(r.teacherId)
    );
    const newIds = new Set(records.map(r => r.id));
    for (const old of oldForWeek) {
      if (!newIds.has(old.id)) pushCloud(cloudSync.deletePartTimeRecord(old.id));
    }
    for (const rec of records) {
      pushCloud(cloudSync.upsertPartTimeRecord(rec));
    }
    setPartTimeRecords(prev => {
      const others = prev.filter(r => !(r.yearMonth === yearMonth && r.week === week && teacherIds.has(r.teacherId)));
      return [...others, ...records];
    });
  }, [pushCloud]);

  return {
    teachers, classes, students, campuses, accounts, currentUser, salaryStandard, monthlyRecords, partTimeRecords,
    cloudStatus, cloudLoaded, pendingCount,
    addTeacher, updateTeacher, deleteTeacher,
    addClass, updateClass, deleteClass,
    addStudent, updateStudent, deleteStudent,
    addCampus, updateCampus, deleteCampus,
    addAccount, updateAccount, deleteAccount, updateOwnAccount, isUsernameTaken,
    updateSalaryStandard, resetSalaryStandard,
    getMonthlyRecords, saveWeeklyRecords,
    savePartTimeRecords,
    isLoggedIn, login, logout,
  };
}
