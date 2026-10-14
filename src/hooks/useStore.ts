import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { Teacher, ClassInfo, Student, Campus, Account, PermissionId, SalaryStandardData, SalaryCoefficientKey, StudentMonthlyRecord, PartTimeWeeklyRecord } from '@/types';
import { generateId, ALL_PERMISSIONS } from '@/types';
import { SEED_SALARY_STANDARD } from '@/data/salarySeed';
import {
  fetchAllCloudData, fetchCloudAccounts, cloudSync,
  flushPending, pendingOpCount, onPendingChange,
} from '@/lib/cloudSync';
import { appendLog } from '@/lib/opLog';

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

// ===== 变更摘要（写进操作日志，方便事后追溯"到底改了什么"）=====
function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return '空';
  if (typeof v === 'boolean') return v ? '是' : '否';
  return String(v);
}

function diffSummary(before: Record<string, unknown>, after: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const k of Object.keys(after)) {
    if (k === 'id' || k === 'createdAt') continue;
    const a = before[k];
    const b = after[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      // 长 id 只留后 6 位，日志更易读
      const shorten = (v: unknown) => {
        const s = fmtVal(v);
        return s.length > 10 && s.includes('-') ? s.slice(-6) : s;
      };
      parts.push(`${k}: ${shorten(a)} → ${shorten(b)}`);
    }
  }
  return parts.join('；') || '（无字段变化）';
}

/** 把一条绩效记录压成便于阅读的短文本：听力45/复述√ */
function recText(r: StudentMonthlyRecord): string {
  return `${r.hearingX ?? '空'}/复述${r.retell ? '√' : '×'}`;
}

/**
 * 对比本次保存与前一次的差异，生成「谁从多少改成了多少」的摘要。
 * 这是排查"我录的数据怎么不见了"最关键的一行信息。
 */
function summarizeRecordChanges(
  oldRecs: StudentMonthlyRecord[],
  newRecs: StudentMonthlyRecord[],
  nameOf: (studentId: string) => string,
  maxItems = 10,
): string {
  const oldMap = new Map(oldRecs.map(r => [r.id, r]));
  const parts: string[] = [];
  let total = 0;
  for (const n of newRecs) {
    const o = oldMap.get(n.id);
    if (!o) {
      total++;
      if (parts.length < maxItems) parts.push(`${nameOf(n.studentId)} 新增 ${recText(n)}`);
      continue;
    }
    const before = recText(o);
    const after = recText(n);
    if (before !== after) {
      total++;
      if (parts.length < maxItems) parts.push(`${nameOf(n.studentId)} ${before}→${after}`);
    }
  }
  // 本次保存后完全没有值的记录（提醒"这次是不是录错了"）
  const blank = newRecs.filter(r => r.hearingX == null && !r.retell).length;
  const head = total === 0
    ? '内容无变化'
    : `改动 ${total} 处：${parts.join('、')}${total > parts.length ? ` …等共 ${total} 处` : ''}`;
  return newRecs.length > 0 && blank === newRecs.length
    ? `${head}｜⚠️ 本次 ${newRecs.length} 条全部为空值`
    : head;
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

  // 操作人用户名（写入操作日志）
  const actorRef = useRef('未登录');

  /** 记一条操作日志，并追踪云端写入结果 */
  const log = useCallback((
    action: Parameters<typeof appendLog>[0]['action'],
    entity: Parameters<typeof appendLog>[0]['entity'],
    target: string,
    detail?: string,
    syncPromise?: Promise<boolean>,
  ) => {
    appendLog({ actor: actorRef.current, action, entity, target, detail }, syncPromise);
  }, []);

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
        log('sync', 'cloud', '跳过云端覆盖', `本机有 ${pendingOpCount()} 条改动尚未写入云端，为避免覆盖已保留本机数据`);
        return;
      }

      // 2) 拉取云端
      const res = await fetchAllCloudData();
      if (cancelled) return;
      if (!res.ok) {
        setCloudStatus('offline');
        setCloudLoaded(true);
        log('error', 'cloud', '云端连接失败', '当前显示的是本机缓存数据，可能不是最新；此时录入的数据会暂存本机并自动补传');
        return;
      }
      const cloud = res.data;
      if (!cloud) {
        setCloudStatus('synced');
        setCloudLoaded(true);
        log('sync', 'cloud', '云端无数据', '本次未加载到任何业务数据');
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
      log('sync', 'cloud', '已从云端加载最新数据',
        `老师 ${cloud.teachers.length}｜班级 ${cloud.classes.length}｜学生 ${cloud.students.length}｜绩效 ${cloud.monthlyRecords.length}`);
    })();
    return () => { cancelled = true; };
  }, [log]);

  // 后台定时补传 + 网络恢复时立即补传
  useEffect(() => {
    const tick = async () => {
      const before = pendingOpCount();
      if (before === 0) return;
      const left = await flushPending().catch(() => -1);
      if (left < 0) return;
      setPendingCount(left);
      if (left === 0) {
        setCloudStatus('synced');
        log('sync', 'cloud', '补传完成', `${before} 条积压改动已成功写入云端`);
      } else if (left < before) {
        log('sync', 'cloud', '部分补传成功', `还剩 ${left} 条待补传`);
      }
    };
    const timer = window.setInterval(() => { void tick(); }, 30000);
    const onOnline = () => { void tick(); };
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', onOnline);
    };
  }, [log]);

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
    const p = cloudSync.upsertTeacher(teacher);
    pushCloud(p);
    log('add', 'teacher', teacher.name, `等级${teacher.level}｜电话${teacher.phone || '未填'}`, p);
  }, [pushCloud, log]);

  const updateTeacher = useCallback((id: string, data: Partial<Omit<Teacher, 'id' | 'createdAt'>>) => {
    const existing = teachersRef.current.find(t => t.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    setTeachers(prev => prev.map(t => t.id === id ? updated : t));
    const p = cloudSync.upsertTeacher(updated);
    pushCloud(p);
    log('update', 'teacher', updated.name, diffSummary(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>), p);
  }, [pushCloud, log]);

  const deleteTeacher = useCallback((id: string) => {
    const target = teachersRef.current.find(t => t.id === id);
    const p = cloudSync.deleteTeacher(id);
    pushCloud(p);
    log('delete', 'teacher', target?.name || id, `同时解除 ${classesRef.current.filter(c => c.teacherId === id).length} 个班级的任课老师`, p);
    setTeachers(prev => prev.filter(t => t.id !== id));
    setClasses(prev => prev.map(c => c.teacherId === id ? { ...c, teacherId: '' } : c));
    const affected = classesRef.current.filter(c => c.teacherId === id);
    for (const c of affected) pushCloud(cloudSync.upsertClass({ ...c, teacherId: '' }));
  }, [pushCloud, log]);

  // ===== 校区操作 =====
  const addCampus = useCallback((data: Omit<Campus, 'id' | 'createdAt'>) => {
    const campus: Campus = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    setCampuses(prev => [...prev, campus]);
    const p = cloudSync.upsertCampus(campus);
    pushCloud(p);
    log('add', 'campus', campus.name, campus.address || '', p);
  }, [pushCloud, log]);

  const updateCampus = useCallback((id: string, data: Partial<Omit<Campus, 'id' | 'createdAt'>>) => {
    const existing = campusesRef.current.find(c => c.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    setCampuses(prev => prev.map(c => c.id === id ? updated : c));
    const p = cloudSync.upsertCampus(updated);
    pushCloud(p);
    log('update', 'campus', updated.name, diffSummary(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>), p);
  }, [pushCloud, log]);

  const deleteCampus = useCallback((id: string) => {
    const target = campusesRef.current.find(c => c.id === id);
    const p = cloudSync.deleteCampus(id);
    pushCloud(p);
    log('delete', 'campus', target?.name || id, `同时解除 ${classesRef.current.filter(c => c.campusId === id).length} 个班级的校区归属`, p);
    setCampuses(prev => prev.filter(c => c.id !== id));
    setClasses(prev => prev.map(c => c.campusId === id ? { ...c, campusId: '' } : c));
    const affected = classesRef.current.filter(c => c.campusId === id);
    for (const c of affected) pushCloud(cloudSync.upsertClass({ ...c, campusId: '' }));
  }, [pushCloud, log]);

  // ===== 班级操作 =====
  const addClass = useCallback((data: Omit<ClassInfo, 'id' | 'createdAt'>) => {
    const cls: ClassInfo = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    setClasses(prev => [...prev, cls]);
    const p = cloudSync.upsertClass(cls);
    pushCloud(p);
    log('add', 'class', cls.name, `等级${cls.level}｜${cls.duration}课时｜老师 ${teachersRef.current.find(t => t.id === cls.teacherId)?.name || '未分配'}`, p);
  }, [pushCloud, log]);

  const updateClass = useCallback((id: string, data: Partial<Omit<ClassInfo, 'id' | 'createdAt'>>) => {
    const existing = classesRef.current.find(c => c.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    setClasses(prev => prev.map(c => c.id === id ? updated : c));
    const p = cloudSync.upsertClass(updated);
    pushCloud(p);
    log('update', 'class', updated.name, diffSummary(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>), p);
  }, [pushCloud, log]);

  const deleteClass = useCallback((id: string) => {
    const target = classesRef.current.find(c => c.id === id);
    const stuCount = studentsRef.current.filter(s => s.classId === id).length;
    const p = cloudSync.deleteClass(id);
    pushCloud(p);
    log('delete', 'class', target?.name || id, `同时把 ${stuCount} 名学生移出该班`, p);
    setClasses(prev => prev.filter(c => c.id !== id));
    setStudents(prev => prev.map(s => s.classId === id ? { ...s, classId: '' } : s));
    const affected = studentsRef.current.filter(s => s.classId === id);
    for (const s of affected) pushCloud(cloudSync.upsertStudent({ ...s, classId: '' }));
  }, [pushCloud, log]);

  // ===== 学生操作 =====
  const addStudent = useCallback((data: Omit<Student, 'id' | 'createdAt'>) => {
    const student: Student = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    setStudents(prev => [...prev, student]);
    const p = cloudSync.upsertStudent(student);
    pushCloud(p);
    log('add', 'student', student.name, `班级 ${classesRef.current.find(c => c.id === student.classId)?.name || '未分配'}`, p);
  }, [pushCloud, log]);

  const updateStudent = useCallback((id: string, data: Partial<Omit<Student, 'id' | 'createdAt'>>) => {
    const existing = studentsRef.current.find(s => s.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    setStudents(prev => prev.map(s => s.id === id ? updated : s));
    const p = cloudSync.upsertStudent(updated);
    pushCloud(p);
    log('update', 'student', updated.name, diffSummary(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>), p);
  }, [pushCloud, log]);

  const deleteStudent = useCallback((id: string) => {
    const target = studentsRef.current.find(s => s.id === id);
    const p = cloudSync.deleteStudent(id);
    pushCloud(p);
    log('delete', 'student', target?.name || id, `原班级 ${classesRef.current.find(c => c.id === target?.classId)?.name || '未分配'}`, p);
    setStudents(prev => prev.filter(s => s.id !== id));
  }, [pushCloud, log]);

  // ===== 认证 =====
  const currentUser = accounts.find(a => a.id === currentUserId) || null;
  const isLoggedIn = !!currentUser;
  actorRef.current = currentUser?.username ?? '未登录';

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
    const p = cloudSync.upsertAccount(acc);
    pushCloud(p);
    log('add', 'account', acc.username, `子账号｜授权 ${acc.permissions.length} 个板块`, p);
  }, [pushCloud, log]);

  const updateAccount = useCallback((id: string, data: Partial<Omit<Account, 'id' | 'createdAt' | 'role'>>) => {
    const existing = accountsRef.current.find(a => a.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    setAccounts(prev => prev.map(a => a.id === id ? updated : a));
    const p = cloudSync.upsertAccount(updated);
    pushCloud(p);
    const detail = data.password !== undefined && data.password !== existing.password
      ? diffSummary(existing as unknown as Record<string, unknown>, { ...updated, password: '已重置' } as unknown as Record<string, unknown>)
      : diffSummary(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>);
    log('update', 'account', updated.username, detail, p);
  }, [pushCloud, log]);

  const deleteAccount = useCallback((id: string) => {
    const target = accountsRef.current.find(a => a.id === id);
    const p = cloudSync.deleteAccount(id);
    pushCloud(p);
    log('delete', 'account', target?.username || id, `角色 ${target?.role === 'admin' ? '管理员' : '子账号'}`, p);
    setAccounts(prev => prev.filter(a => a.id !== id));
  }, [pushCloud, log]);

  const updateOwnAccount = useCallback((username: string, password: string) => {
    const existing = accountsRef.current.find(a => a.id === currentUserId);
    if (!existing) return;
    const updated = { ...existing, username, password };
    setAccounts(prev => prev.map(a => a.id === currentUserId ? updated : a));
    const p = cloudSync.upsertAccount(updated);
    pushCloud(p);
    log('update', 'account', username, `修改自己的登录名/密码${username !== existing.username ? `（原登录名 ${existing.username}）` : ''}`, p);
  }, [currentUserId, pushCloud, log]);

  const isUsernameTaken = useCallback((username: string, excludeId?: string) => {
    return accountsRef.current.some(a => a.username === username && a.id !== excludeId);
  }, []);

  // ===== 听力系数操作 =====
  const updateSalaryStandard = useCallback((key: SalaryCoefficientKey, rows: SalaryStandardData[SalaryCoefficientKey]) => {
    const updated = { ...salaryStandardRef.current, [key]: rows };
    setSalaryStandard(updated);
    const p = cloudSync.upsertSalaryStandard(updated);
    pushCloud(p);
    log('update', 'salary', `系数 ${key}`, `更新为 ${rows.length} 个档位`, p);
  }, [pushCloud, log]);

  const resetSalaryStandard = useCallback((key: SalaryCoefficientKey) => {
    const updated = { ...salaryStandardRef.current, [key]: SEED_SALARY_STANDARD[key].map(r => ({ ...r })) };
    setSalaryStandard(updated);
    const p = cloudSync.upsertSalaryStandard(updated);
    pushCloud(p);
    log('update', 'salary', `系数 ${key}`, '恢复为默认档位', p);
  }, [pushCloud, log]);

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
    const writes: Promise<boolean>[] = [];
    let removed = 0;
    for (const old of oldForWeek) {
      if (!newIds.has(old.id)) {
        removed++;
        const dp = cloudSync.deleteMonthlyRecord(old.id);
        pushCloud(dp);
        writes.push(dp);
      }
    }
    for (const rec of records) {
      const up = cloudSync.upsertMonthlyRecord(rec);
      pushCloud(up);
      writes.push(up);
    }
    setMonthlyRecords(prev => {
      const others = prev.filter(r => !(r.yearMonth === yearMonth && r.week === week && scopeClassIds.has(r.classId)));
      return [...others, ...records];
    });

    const teacherNames = [...involvedTeacherIds]
      .map(tid => teachersRef.current.find(t => t.id === tid)?.name)
      .filter(Boolean)
      .join('、') || '（未识别老师）';
    const filled = records.filter(r => r.hearingX != null || r.retell).length;
    const stuName = (sid: string) => studentsRef.current.find(s => s.id === sid)?.name || '（已删学生）';
    const changeText = summarizeRecordChanges(oldForWeek, records, stuName);
    const removedNames = oldForWeek
      .filter(r => !newIds.has(r.id))
      .slice(0, 5)
      .map(r => stuName(r.studentId))
      .join('、');
    const detail = [
      `写入 ${records.length} 条（有数据 ${filled} 条）`,
      changeText,
      removed > 0 ? `另移除 ${removed} 条${removedNames ? `（${removedNames}）` : ''}` : '',
    ].filter(Boolean).join('｜');

    log('save', 'monthlyRecord', `${yearMonth} 第${week}周 · ${teacherNames}`, detail,
      Promise.all(writes).then(a => a.every(Boolean)));
  }, [pushCloud, log]);

  // ===== D级兼职老师出勤记录 =====
  const savePartTimeRecords = useCallback((yearMonth: string, week: number, records: PartTimeWeeklyRecord[]) => {
    const teacherIds = new Set(records.map(r => r.teacherId));
    const oldForWeek = partTimeRecordsRef.current.filter(r =>
      r.yearMonth === yearMonth && r.week === week && teacherIds.has(r.teacherId)
    );
    const newIds = new Set(records.map(r => r.id));
    const writes: Promise<boolean>[] = [];
    let removed = 0;
    for (const old of oldForWeek) {
      if (!newIds.has(old.id)) { removed++; const dp = cloudSync.deletePartTimeRecord(old.id); pushCloud(dp); writes.push(dp); }
    }
    for (const rec of records) {
      const up = cloudSync.upsertPartTimeRecord(rec); pushCloud(up); writes.push(up);
    }
    setPartTimeRecords(prev => {
      const others = prev.filter(r => !(r.yearMonth === yearMonth && r.week === week && teacherIds.has(r.teacherId)));
      return [...others, ...records];
    });

    const teacherNames = [...teacherIds]
      .map(tid => teachersRef.current.find(t => t.id === tid)?.name)
      .filter(Boolean)
      .join('、') || '（未识别老师）';
    const attended = records.filter(r => r.attended).length;

    // 出勤变化的明细：哪个班从"未上课"变成"上课"
    const oldMap = new Map(oldForWeek.map(r => [r.id, r]));
    const clsName = (cid: string) => classesRef.current.find(c => c.id === cid)?.name || '（已删班级）';
    const changes: string[] = [];
    for (const n of records) {
      const o = oldMap.get(n.id);
      const before = o ? (o.attended ? '上课' : '未上课') : '新增';
      const after = n.attended ? '上课' : '未上课';
      if (before !== after && changes.length < 8) changes.push(`${clsName(n.classId)} ${before}→${after}`);
    }
    const detail = [
      `出勤记录 ${records.length} 条（上课 ${attended} 条）`,
      changes.length > 0 ? `改动：${changes.join('、')}` : '内容无变化',
      removed > 0 ? `另移除 ${removed} 条` : '',
    ].filter(Boolean).join('｜');

    log('save', 'partTimeRecord', `${yearMonth} 第${week}周 · ${teacherNames}`, detail,
      Promise.all(writes).then(a => a.every(Boolean)));
  }, [pushCloud, log]);

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
