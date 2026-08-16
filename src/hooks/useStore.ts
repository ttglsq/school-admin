import { useState, useEffect, useCallback, useRef } from 'react';
import type { Teacher, ClassInfo, Student, Campus, Account, PermissionId, SalaryStandardData, SalaryCoefficientKey, StudentMonthlyRecord, PartTimeWeeklyRecord } from '@/types';
import { generateId, ALL_PERMISSIONS } from '@/types';
import { SEED_SALARY_STANDARD } from '@/data/salarySeed';
import { fetchAllCloudData, cloudSync } from '@/lib/cloudSync';

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

export type CloudSyncStatus = 'syncing' | 'synced' | 'offline';

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

  // refs：用于在回调中读取最新状态（避免闭包陷阱）
  const teachersRef = useRef(teachers); teachersRef.current = teachers;
  const classesRef = useRef(classes); classesRef.current = classes;
  const studentsRef = useRef(students); studentsRef.current = students;
  const campusesRef = useRef(campuses); campusesRef.current = campuses;
  const accountsRef = useRef(accounts); accountsRef.current = accounts;
  const salaryStandardRef = useRef(salaryStandard); salaryStandardRef.current = salaryStandard;
  const monthlyRecordsRef = useRef(monthlyRecords); monthlyRecordsRef.current = monthlyRecords;
  const partTimeRecordsRef = useRef(partTimeRecords); partTimeRecordsRef.current = partTimeRecords;

  // 启动时：拉取云端所有逐行数据
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchAllCloudData();
      if (cancelled) return;
      if (!res.ok) {
        setCloudStatus('offline');
        return;
      }
      const cloud = res.data;
      if (!cloud) {
        setCloudStatus('synced');
        return;
      }
      setTeachers(cloud.teachers);
      setClasses(cloud.classes);
      setStudents(cloud.students);
      setCampuses(cloud.campuses);
      setAccounts(cloud.accounts);
      if (cloud.salaryStandard) setSalaryStandard(cloud.salaryStandard);
      setMonthlyRecords(cloud.monthlyRecords);
      setPartTimeRecords(cloud.partTimeRecords);
      setCloudStatus('synced');
    })();
    return () => { cancelled = true; };
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

  // ===== 老师操作 =====
  const addTeacher = useCallback((data: Omit<Teacher, 'id' | 'createdAt'>) => {
    const teacher: Teacher = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    setTeachers(prev => [...prev, teacher]);
    void cloudSync.upsertTeacher(teacher);
  }, []);

  const updateTeacher = useCallback((id: string, data: Partial<Omit<Teacher, 'id' | 'createdAt'>>) => {
    const existing = teachersRef.current.find(t => t.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    setTeachers(prev => prev.map(t => t.id === id ? updated : t));
    void cloudSync.upsertTeacher(updated);
  }, []);

  const deleteTeacher = useCallback((id: string) => {
    void cloudSync.deleteTeacher(id);
    setTeachers(prev => prev.filter(t => t.id !== id));
    setClasses(prev => prev.map(c => c.teacherId === id ? { ...c, teacherId: '' } : c));
    const affected = classesRef.current.filter(c => c.teacherId === id);
    for (const c of affected) void cloudSync.upsertClass({ ...c, teacherId: '' });
  }, []);

  // ===== 校区操作 =====
  const addCampus = useCallback((data: Omit<Campus, 'id' | 'createdAt'>) => {
    const campus: Campus = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    setCampuses(prev => [...prev, campus]);
    void cloudSync.upsertCampus(campus);
  }, []);

  const updateCampus = useCallback((id: string, data: Partial<Omit<Campus, 'id' | 'createdAt'>>) => {
    const existing = campusesRef.current.find(c => c.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    setCampuses(prev => prev.map(c => c.id === id ? updated : c));
    void cloudSync.upsertCampus(updated);
  }, []);

  const deleteCampus = useCallback((id: string) => {
    void cloudSync.deleteCampus(id);
    setCampuses(prev => prev.filter(c => c.id !== id));
    setClasses(prev => prev.map(c => c.campusId === id ? { ...c, campusId: '' } : c));
    const affected = classesRef.current.filter(c => c.campusId === id);
    for (const c of affected) void cloudSync.upsertClass({ ...c, campusId: '' });
  }, []);

  // ===== 班级操作 =====
  const addClass = useCallback((data: Omit<ClassInfo, 'id' | 'createdAt'>) => {
    const cls: ClassInfo = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    setClasses(prev => [...prev, cls]);
    void cloudSync.upsertClass(cls);
  }, []);

  const updateClass = useCallback((id: string, data: Partial<Omit<ClassInfo, 'id' | 'createdAt'>>) => {
    const existing = classesRef.current.find(c => c.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    setClasses(prev => prev.map(c => c.id === id ? updated : c));
    void cloudSync.upsertClass(updated);
  }, []);

  const deleteClass = useCallback((id: string) => {
    void cloudSync.deleteClass(id);
    setClasses(prev => prev.filter(c => c.id !== id));
    setStudents(prev => prev.map(s => s.classId === id ? { ...s, classId: '' } : s));
    const affected = studentsRef.current.filter(s => s.classId === id);
    for (const s of affected) void cloudSync.upsertStudent({ ...s, classId: '' });
  }, []);

  // ===== 学生操作 =====
  const addStudent = useCallback((data: Omit<Student, 'id' | 'createdAt'>) => {
    const student: Student = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    setStudents(prev => [...prev, student]);
    void cloudSync.upsertStudent(student);
  }, []);

  const updateStudent = useCallback((id: string, data: Partial<Omit<Student, 'id' | 'createdAt'>>) => {
    const existing = studentsRef.current.find(s => s.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    setStudents(prev => prev.map(s => s.id === id ? updated : s));
    void cloudSync.upsertStudent(updated);
  }, []);

  const deleteStudent = useCallback((id: string) => {
    void cloudSync.deleteStudent(id);
    setStudents(prev => prev.filter(s => s.id !== id));
  }, []);

  // ===== 认证 =====
  const currentUser = accounts.find(a => a.id === currentUserId) || null;
  const isLoggedIn = !!currentUser;

  const login = useCallback((username: string, password: string): boolean => {
    const found = accountsRef.current.find(a => a.username === username && a.password === password);
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
    void cloudSync.upsertAccount(acc);
  }, []);

  const updateAccount = useCallback((id: string, data: Partial<Omit<Account, 'id' | 'createdAt' | 'role'>>) => {
    const existing = accountsRef.current.find(a => a.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    setAccounts(prev => prev.map(a => a.id === id ? updated : a));
    void cloudSync.upsertAccount(updated);
  }, []);

  const deleteAccount = useCallback((id: string) => {
    void cloudSync.deleteAccount(id);
    setAccounts(prev => prev.filter(a => a.id !== id));
  }, []);

  const updateOwnAccount = useCallback((username: string, password: string) => {
    const existing = accountsRef.current.find(a => a.id === currentUserId);
    if (!existing) return;
    const updated = { ...existing, username, password };
    setAccounts(prev => prev.map(a => a.id === currentUserId ? updated : a));
    void cloudSync.upsertAccount(updated);
  }, [currentUserId]);

  const isUsernameTaken = useCallback((username: string, excludeId?: string) => {
    return accountsRef.current.some(a => a.username === username && a.id !== excludeId);
  }, []);

  // ===== 听力系数操作 =====
  const updateSalaryStandard = useCallback((key: SalaryCoefficientKey, rows: SalaryStandardData[SalaryCoefficientKey]) => {
    const updated = { ...salaryStandardRef.current, [key]: rows };
    setSalaryStandard(updated);
    void cloudSync.upsertSalaryStandard(updated);
  }, []);

  const resetSalaryStandard = useCallback((key: SalaryCoefficientKey) => {
    const updated = { ...salaryStandardRef.current, [key]: SEED_SALARY_STANDARD[key].map(r => ({ ...r })) };
    setSalaryStandard(updated);
    void cloudSync.upsertSalaryStandard(updated);
  }, []);

  // ===== 月度绩效数据操作 =====
  const getMonthlyRecords = useCallback((yearMonth: string): StudentMonthlyRecord[] => {
    return monthlyRecordsRef.current.filter(r => r.yearMonth === yearMonth);
  }, []);

  const saveWeeklyRecords = useCallback((yearMonth: string, week: number, records: StudentMonthlyRecord[]) => {
    const oldForWeek = monthlyRecordsRef.current.filter(r => r.yearMonth === yearMonth && r.week === week);
    const newIds = new Set(records.map(r => r.id));
    for (const old of oldForWeek) {
      if (!newIds.has(old.id)) void cloudSync.deleteMonthlyRecord(old.id);
    }
    for (const rec of records) {
      void cloudSync.upsertMonthlyRecord(rec);
    }
    setMonthlyRecords(prev => {
      const others = prev.filter(r => !(r.yearMonth === yearMonth && r.week === week));
      return [...others, ...records];
    });
  }, []);

  // ===== D级兼职老师出勤记录 =====
  const savePartTimeRecords = useCallback((yearMonth: string, week: number, records: PartTimeWeeklyRecord[]) => {
    const teacherIds = new Set(records.map(r => r.teacherId));
    const oldForWeek = partTimeRecordsRef.current.filter(r =>
      r.yearMonth === yearMonth && r.week === week && teacherIds.has(r.teacherId)
    );
    const newIds = new Set(records.map(r => r.id));
    for (const old of oldForWeek) {
      if (!newIds.has(old.id)) void cloudSync.deletePartTimeRecord(old.id);
    }
    for (const rec of records) {
      void cloudSync.upsertPartTimeRecord(rec);
    }
    setPartTimeRecords(prev => {
      const others = prev.filter(r => !(r.yearMonth === yearMonth && r.week === week && teacherIds.has(r.teacherId)));
      return [...others, ...records];
    });
  }, []);

  return {
    teachers, classes, students, campuses, accounts, currentUser, salaryStandard, monthlyRecords, partTimeRecords,
    cloudStatus,
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
