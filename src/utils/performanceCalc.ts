import type {
  Teacher, ClassInfo, Student, SalaryStandardData, SalaryCoefficientKey,
  ClassLevel, ClassDuration, TeacherLevel, StudentMonthlyRecord,
} from '@/types';
import {
  SALARY_LEVELS, HEARING_DURATION_MULTIPLIER, BC_HEARING_DIVISOR,
  RETELL_UNIT_PRICE, MANAGEMENT_FEE, WEEKS_PER_MONTH,
} from '@/types';

/** 老师等级 → 听力系数表 key */
export function teacherLevelToCoeffKey(level: TeacherLevel): SalaryCoefficientKey {
  const found = SALARY_LEVELS.find(l => l.level === level);
  return found ? found.key : '0.3';
}

/**
 * 查听力系数表：根据 x(分钟/周) 查 y(元/周/人)
 * 向下取整到最近挡位（不超过 x 的最大挡位）；
 * x 小于最低挡位（未达到最低数据要求）→ 返回 null（听力工资为 0）
 */
export function lookupSalaryY(table: { x: number; y: number }[], x: number): number | null {
  if (!table || table.length === 0) return null;
  // 表是降序排列（x 从大到小），找第一个 x <= 输入值 的挡位
  for (const row of table) {
    if (x >= row.x) return row.y;
  }
  // x 小于最低挡位：未达到最低数据要求，无对应 y 值
  return null;
}

/** 表中最低数据要求（最小挡位的 x 分钟/周），用于判断是否达标 */
export function getMinThreshold(table: { x: number; y: number }[]): number | null {
  if (!table || table.length === 0) return null;
  return table[table.length - 1].x;
}

/** 时长系数（乘数） */
export function getDurationMultiplier(classLevel: ClassLevel, duration: ClassDuration): number {
  return HEARING_DURATION_MULTIPLIER[classLevel][duration];
}

/** 复述单价 */
export function getRetellUnitPrice(duration: ClassDuration): number {
  return RETELL_UNIT_PRICE[duration];
}

/** 班级管理费 */
export function getManagementFee(teacherLevel: TeacherLevel, duration: ClassDuration): number {
  return MANAGEMENT_FEE[teacherLevel][duration];
}

/** 判断班级等级是否为 B/C 班（需 ÷0.9） */
export function isBCClass(classLevel: ClassLevel): boolean {
  return classLevel === 'B' || classLevel === 'C';
}

/** 课时数（2/3/4） */
export function durationToHours(d: ClassDuration): number {
  return d === 'A' ? 2 : d === 'B' ? 3 : 4;
}

// ===== 班级绩效计算 =====

export interface StudentHearingDetail {
  studentId: string;
  studentName: string;
  hearingX: number | null;
  y: number | null;          // 查表得到的元/周/人
  multiplier: number;        // 时长系数
  monthlyWage: number;        // 该学生月度听力工资
  isBC: boolean;             // 是否 B/C 班（÷0.9）
}

export interface ClassPerformanceResult {
  classId: string;
  className: string;
  classLevel: ClassLevel;
  duration: ClassDuration;
  teacherLevel: TeacherLevel;
  coeffKey: SalaryCoefficientKey;
  // 听力数据工资
  hearingDetails: StudentHearingDetail[];
  hearingWage: number;
  // 复述数据工资
  retellCount: number;
  retellUnitPrice: number;
  retellWage: number;
  // 班级管理费
  managementFee: number;
  // 合计
  total: number;
}

export function calculateClassPerformance(
  cls: ClassInfo,
  teacher: Teacher | undefined,
  students: Student[],
  records: StudentMonthlyRecord[],
  salaryData: SalaryStandardData,
): ClassPerformanceResult {
  const teacherLevel = teacher?.level ?? 'C';
  const coeffKey = teacherLevelToCoeffKey(teacherLevel);
  const table = salaryData[coeffKey] || [];
  const multiplier = getDurationMultiplier(cls.level, cls.duration);
  const isBC = isBCClass(cls.level);
  const retellPrice = getRetellUnitPrice(cls.duration);
  const mgmtFee = getManagementFee(teacherLevel, cls.duration);

  const classStudents = students.filter(s => s.classId === cls.id);
  const recordMap = new Map(records.filter(r => r.classId === cls.id).map(r => [r.studentId, r]));

  const hearingDetails: StudentHearingDetail[] = [];
  let hearingWage = 0;
  let retellCount = 0;

  for (const stu of classStudents) {
    const rec = recordMap.get(stu.id);
    const hearingX = rec?.hearingX ?? null;
    let y: number | null = null;
    let monthlyWage = 0;

    if (hearingX != null && hearingX > 0) {
      y = lookupSalaryY(table, hearingX);
      if (y != null) {
        monthlyWage = y * multiplier * WEEKS_PER_MONTH;
        if (isBC) monthlyWage /= BC_HEARING_DIVISOR;
      }
    }

    hearingWage += monthlyWage;
    hearingDetails.push({
      studentId: stu.id,
      studentName: stu.name,
      hearingX,
      y,
      multiplier,
      monthlyWage,
      isBC,
    });

    if (rec?.retell) retellCount++;
  }

  const retellWage = retellCount * retellPrice;
  const total = hearingWage + retellWage + mgmtFee;

  return {
    classId: cls.id,
    className: cls.name,
    classLevel: cls.level,
    duration: cls.duration,
    teacherLevel,
    coeffKey,
    hearingDetails,
    hearingWage,
    retellCount,
    retellUnitPrice: retellPrice,
    retellWage,
    managementFee: mgmtFee,
    total,
  };
}

// ===== 老师月度绩效汇总 =====

export interface TeacherPerformanceResult {
  teacherId: string;
  teacherName: string;
  teacherLevel: TeacherLevel;
  classCount: number;
  hearingWage: number;
  retellWage: number;
  managementFee: number;
  total: number;
  classes: ClassPerformanceResult[];
}

export function calculateTeacherPerformance(
  teacher: Teacher,
  classes: ClassInfo[],
  students: Student[],
  records: StudentMonthlyRecord[],
  salaryData: SalaryStandardData,
): TeacherPerformanceResult {
  const teacherClasses = classes.filter(c => c.teacherId === teacher.id);
  const classResults = teacherClasses.map(cls =>
    calculateClassPerformance(cls, teacher, students, records, salaryData),
  );

  const hearingWage = classResults.reduce((s, c) => s + c.hearingWage, 0);
  const retellWage = classResults.reduce((s, c) => s + c.retellWage, 0);
  const managementFee = classResults.reduce((s, c) => s + c.managementFee, 0);

  return {
    teacherId: teacher.id,
    teacherName: teacher.name,
    teacherLevel: teacher.level,
    classCount: teacherClasses.length,
    hearingWage,
    retellWage,
    managementFee,
    total: hearingWage + retellWage + managementFee,
    classes: classResults,
  };
}
