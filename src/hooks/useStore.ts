import { useState, useEffect, useCallback } from 'react';
import type { Teacher, ClassInfo, Student, Campus, Account, PermissionId } from '@/types';
import { generateId, ALL_PERMISSIONS } from '@/types';

const STORAGE_KEYS = {
  teachers: 'school_teachers',
  classes: 'school_classes',
  students: 'school_students',
  campuses: 'school_campuses',
  accounts: 'school_accounts',
  currentUser: 'school_current_user',
  // 旧版本单账号存储，仅用于数据迁移
  legacyAccount: 'school_account',
  legacyAuth: 'school_auth',
};

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

// 初始种子数据
const seedTeachers: Teacher[] = [
  { id: 't1', name: '王明华', phone: '13800138001', level: 'A', createdAt: '2024-01-15T08:00:00Z' },
  { id: 't2', name: '李秀英', phone: '13800138002', level: 'B', createdAt: '2024-02-20T08:00:00Z' },
  { id: 't3', name: '张伟强', phone: '13800138003', level: 'C', createdAt: '2024-03-10T08:00:00Z' },
];

const seedCampuses: Campus[] = [
  { id: 'cp1', name: '万象城校区', address: '市中心万象城购物中心3层', createdAt: '2024-01-10T08:00:00Z' },
  { id: 'cp2', name: '高新校区', address: '高新区科技路128号', createdAt: '2024-01-12T08:00:00Z' },
];

const seedClasses: ClassInfo[] = [
  { id: 'c1', name: '一年级一班', level: 'A', duration: 'A', teacherId: 't1', campusId: 'cp1', createdAt: '2024-01-20T08:00:00Z' },
  { id: 'c2', name: '二年级三班', level: 'B', duration: 'B', teacherId: 't2', campusId: 'cp1', createdAt: '2024-02-25T08:00:00Z' },
  { id: 'c3', name: '幼小衔接班', level: 'C', duration: 'C', teacherId: 't3', campusId: 'cp2', createdAt: '2024-03-15T08:00:00Z' },
];

const seedStudents: Student[] = [
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    const id = localStorage.getItem(STORAGE_KEYS.currentUser);
    return id || null;
  });

  // 持久化
  useEffect(() => { saveToStorage(STORAGE_KEYS.teachers, teachers); }, [teachers]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.campuses, campuses); }, [campuses]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.classes, classes); }, [classes]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.students, students); }, [students]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.accounts, accounts); }, [accounts]);

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

  return {
    teachers, classes, students, campuses, accounts, currentUser,
    addTeacher, updateTeacher, deleteTeacher,
    addClass, updateClass, deleteClass,
    addStudent, updateStudent, deleteStudent,
    addCampus, updateCampus, deleteCampus,
    addAccount, updateAccount, deleteAccount, updateOwnAccount, isUsernameTaken,
    isLoggedIn, login, logout,
  };
}
