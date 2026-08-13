// 数据类型定义

export type TeacherLevel = 'A' | 'B' | 'C';

export type ClassLevel = 'A' | 'B' | 'C';

export type ClassDuration = 'A' | 'B' | 'C';

export interface Teacher {
  id: string;
  name: string;
  phone: string;
  level: TeacherLevel;
  createdAt: string;
}

export interface Campus {
  id: string;
  name: string;
  address: string;
  createdAt: string;
}

export interface ClassInfo {
  id: string;
  name: string;
  level: ClassLevel;
  duration: ClassDuration;
  teacherId: string;
  campusId: string;
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  contact: string;
  classId: string;
  createdAt: string;
}

// ===== 账号与权限 =====

// 可授权的页面板块（导航模块）
export const PERMISSION_MODULES = [
  { id: 'overview', label: '首页概览' },
  { id: 'campuses', label: '校区管理' },
  { id: 'teachers', label: '老师管理' },
  { id: 'classes', label: '班级管理' },
  { id: 'students', label: '学生管理' },
  { id: 'salary', label: '听力系数' },
  { id: 'performance', label: '绩效考核' },
] as const;

export type PermissionId = (typeof PERMISSION_MODULES)[number]['id'];

export const ALL_PERMISSIONS: PermissionId[] = PERMISSION_MODULES.map(m => m.id);

// 账号角色
export type UserRole = 'admin' | 'sub';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理员',
  sub: '子账号',
};

export interface Account {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  /** 子账号可访问的板块；管理员始终拥有全部板块 */
  permissions: PermissionId[];
  createdAt: string;
}

// ===== 听力系数表（听力数据薪资）=====

/** 单个档位：x 分钟/周 → y 元/周/人 */
export interface SalaryStandardRow {
  x: number;
  y: number;
}

/** 薪资系数对应的老师等级 */
export const SALARY_LEVELS = [
  { key: '0.38', coefficient: 0.38, level: 'A', levelLabel: 'A级', levelDesc: '高级' },
  { key: '0.35', coefficient: 0.35, level: 'B', levelLabel: 'B级', levelDesc: '中级' },
  { key: '0.3', coefficient: 0.3, level: 'C', levelLabel: 'C级', levelDesc: '初级' },
] as const;

export type SalaryCoefficientKey = (typeof SALARY_LEVELS)[number]['key'];

/** 三个系数对应的完整薪资表 */
export type SalaryStandardData = Record<SalaryCoefficientKey, SalaryStandardRow[]>;

// 老师等级配置
export const TEACHER_LEVELS: Record<TeacherLevel, { label: string; color: string }> = {
  A: { label: 'A级', color: 'bg-red-100 text-red-700 border-red-200' },
  B: { label: 'B级', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  C: { label: 'C级', color: 'bg-green-100 text-green-700 border-green-200' },
};

// 班级等级配置
export const CLASS_LEVELS: Record<ClassLevel, { label: string; shortLabel: string; color: string }> = {
  A: { label: 'A 初级', shortLabel: '初级', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  B: { label: 'B 入门级', shortLabel: '入门级', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  C: { label: 'C 启蒙', shortLabel: '启蒙', color: 'bg-teal-100 text-teal-700 border-teal-200' },
};

// 上课时长配置
export const CLASS_DURATIONS: Record<ClassDuration, { label: string; shortLabel: string; color: string }> = {
  A: { label: 'A 2课时', shortLabel: '2课时', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  B: { label: 'B 3课时', shortLabel: '3课时', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  C: { label: 'C 4课时', shortLabel: '4课时', color: 'bg-orange-100 text-orange-700 border-orange-200' },
};

// ===== 月度绩效考核 =====

/** 学生月度绩效数据（每月每个学生一条） */
export interface StudentMonthlyRecord {
  id: string;
  studentId: string;
  classId: string;
  yearMonth: string;       // "2026-08"
  hearingX: number | null; // 听力数据(分钟/周)，null=未填
  retell: boolean;         // 是否完成复述
}

/** 每月按多少周计算（听力系数表 y 是"元/周/人"） */
export const WEEKS_PER_MONTH = 4;

/**
 * 听力数据工资 — 时长系数
 * key = 班级等级(A初级/B入门/C启蒙)，value 按课时时长(2/3/4)给出乘数
 * 乘数含义：系数(查表y) × 乘数
 */
export const HEARING_DURATION_MULTIPLIER: Record<ClassLevel, Record<ClassDuration, number>> = {
  // A初级班：2课时×2/3，3课时×4/3，4课时×4/3
  A: { A: 2 / 3, B: 4 / 3, C: 4 / 3 },
  // B入门/C启蒙班：2课时×2/3，3课时×4/3，4课时×2/3
  B: { A: 2 / 3, B: 4 / 3, C: 2 / 3 },
  C: { A: 2 / 3, B: 4 / 3, C: 2 / 3 },
};

/** B/C 班听力工资需额外 ÷0.9 */
export const BC_HEARING_DIVISOR = 0.9;

/** 复述工资单价（按课时时长，元/人） */
export const RETELL_UNIT_PRICE: Record<ClassDuration, number> = {
  A: 0, // 2课时无复述工资
  B: 3, // 3课时 3元/人
  C: 4, // 4课时 4元/人
};

/** 班级管理费（元/月），按老师等级 × 课时时长 */
export const MANAGEMENT_FEE: Record<TeacherLevel, Record<ClassDuration, number>> = {
  // 老师A级
  A: { A: 140, B: 180, C: 200 },
  // 老师B级、C级
  B: { A: 160, B: 200, C: 220 },
  C: { A: 160, B: 200, C: 220 },
};

// 生成唯一ID
export const generateId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
