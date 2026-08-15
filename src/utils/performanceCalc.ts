import type {
  Teacher, ClassInfo, Student, SalaryStandardData, SalaryCoefficientKey,
  ClassLevel, ClassDuration, TeacherLevel, StudentMonthlyRecord,
  PartTimeWeeklyRecord,
} from '@/types';
import {
  SALARY_LEVELS, HEARING_DURATION_MULTIPLIER, BC_HEARING_DIVISOR,
  RETELL_UNIT_PRICE, MANAGEMENT_FEE, WEEKS_PER_MONTH,
  getPartTimePerStudent, getPartTimeMinFee, isPartTimeTeacher,
} from '@/types';

/** 老师等级 → 听力系数表 key */
export function teacherLevelToCoeffKey(level: TeacherLevel): SalaryCoefficientKey {
  const found = SALARY_LEVELS.find(l => l.level === level);
  return found ? found.key : '0.3';
}

/**
 * 查听力系数表：根据 x(分钟/周) 查 y(元/周/人)
 * 向下取整到最近挡位（不超过 x 的最大挡位）；
 * x 低于最低挡位 → 按最低挡位计薪（取最小的 y 值）
 */
export function lookupSalaryY(table: { x: number; y: number }[], x: number): number | null {
  if (!table || table.length === 0) return null;
  // 表是降序排列（x 从大到小），找第一个 x <= 输入值 的挡位
  for (const row of table) {
    if (x >= row.x) return row.y;
  }
  // x 低于最低挡位：按最低挡位计薪（取最小的 y 值）
  return table[table.length - 1].y;
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

/** 课时数（1/2/3/4） */
export function durationToHours(d: ClassDuration): number {
  return d === 'D' ? 1 : d === 'A' ? 2 : d === 'B' ? 3 : 4;
}

// ===== 班级绩效计算 =====

export interface StudentWeekDetail {
  week: number;          // 第几周（1~5）
  hearingX: number | null;
  y: number | null;      // 查表得到的元/周/人（该周）
  belowMin: boolean;     // 该周听力时长是否低于最低挡位（按最低挡计薪）
  weeklyWage: number;    // 该周听力工资
}

export interface StudentHearingDetail {
  studentId: string;
  studentName: string;
  weeks: StudentWeekDetail[];  // 每周明细（1~4 周）
  multiplier: number;          // 时长系数
  monthlyWage: number;         // 该学生月度听力工资 = 每周工资之和
  isBC: boolean;               // 是否 B/C 班（÷0.9）
  retellCount: number;         // 该月完成复述的周数
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
  // D级兼职工资（非D级为0）
  partTimeWage: number;
  // 班级学生数
  studentCount: number;
  // 合计
  total: number;
}

export function calculateClassPerformance(
  cls: ClassInfo,
  teacher: Teacher | undefined,
  students: Student[],
  records: StudentMonthlyRecord[],
  salaryData: SalaryStandardData,
  partTimeRecords: PartTimeWeeklyRecord[],
  yearMonth: string,
): ClassPerformanceResult {
  const teacherLevel = teacher?.level ?? 'C';
  const classStudents = students.filter(s => s.classId === cls.id);
  const studentCount = classStudents.length;

  // D级兼职老师：按学生人次计费，与课时挂钩，无听力/复述/管理费
  if (isPartTimeTeacher(teacherLevel)) {
    const perStudent = getPartTimePerStudent(cls.duration);
    const minFee = getPartTimeMinFee(cls.duration);
    const perLesson = Math.max(studentCount * perStudent, minFee);
    // 按实际出勤周数计算（只有打勾的周数才计入）
    const attendedWeeks = partTimeRecords.filter(
      r => r.classId === cls.id && r.yearMonth === yearMonth && r.attended
    ).length;
    const partTimeWage = perLesson * attendedWeeks;
    return {
      classId: cls.id,
      className: cls.name,
      classLevel: cls.level,
      duration: cls.duration,
      teacherLevel,
      coeffKey: '0.3', // 占位，D级不查表
      hearingDetails: [],
      hearingWage: 0,
      retellCount: 0,
      retellUnitPrice: 0,
      retellWage: 0,
      managementFee: 0,
      partTimeWage,
      studentCount,
      total: partTimeWage,
    };
  }

  const coeffKey = teacherLevelToCoeffKey(teacherLevel);
  const table = salaryData[coeffKey] || [];
  const multiplier = getDurationMultiplier(cls.level, cls.duration);
  const isBC = isBCClass(cls.level);
  const retellPrice = getRetellUnitPrice(cls.duration);
  // 班级管理费：按月固定发放（不按出勤周数计算）
  const mgmtFee = getManagementFee(teacherLevel, cls.duration);

  // 学生 -> (周 -> 记录)
  const recordMap = new Map<string, Map<number, StudentMonthlyRecord>>();
  for (const r of records.filter(r => r.classId === cls.id)) {
    const week = r.week ?? 1;
    let m = recordMap.get(r.studentId);
    if (!m) { m = new Map(); recordMap.set(r.studentId, m); }
    m.set(week, r);
  }

  const hearingDetails: StudentHearingDetail[] = [];
  let hearingWage = 0;
  let retellCount = 0;

  for (const stu of classStudents) {
    const recs = recordMap.get(stu.id);
    const weeks: StudentWeekDetail[] = [];
    let monthlyWage = 0;
    let stuRetell = 0;

    for (let w = 1; w <= WEEKS_PER_MONTH; w++) {
      const rec = recs?.get(w);
      const hearingX = rec?.hearingX ?? null;
      let y: number | null = null;
      let weeklyWage = 0;
      let belowMin = false;

      if (hearingX != null && hearingX > 0) {
        const minX = getMinThreshold(table);
        belowMin = minX != null && hearingX < minX;
        y = lookupSalaryY(table, hearingX);
        if (y != null) {
          weeklyWage = y * multiplier;
          if (isBC) weeklyWage /= BC_HEARING_DIVISOR;
        }
      }

      monthlyWage += weeklyWage;
      weeks.push({ week: w, hearingX, y, belowMin, weeklyWage });
      if (rec?.retell) stuRetell++;
    }

    hearingWage += monthlyWage;
    retellCount += stuRetell;
    hearingDetails.push({
      studentId: stu.id,
      studentName: stu.name,
      weeks,
      multiplier,
      monthlyWage,
      isBC,
      retellCount: stuRetell,
    });
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
    partTimeWage: 0,
    studentCount,
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
  partTimeWage: number;
  total: number;
  classes: ClassPerformanceResult[];
}

export function calculateTeacherPerformance(
  teacher: Teacher,
  classes: ClassInfo[],
  students: Student[],
  records: StudentMonthlyRecord[],
  salaryData: SalaryStandardData,
  partTimeRecords: PartTimeWeeklyRecord[],
  yearMonth: string,
): TeacherPerformanceResult {
  const teacherClasses = classes.filter(c => c.teacherId === teacher.id);
  const classResults = teacherClasses.map(cls =>
    calculateClassPerformance(cls, teacher, students, records, salaryData, partTimeRecords, yearMonth),
  );

  const hearingWage = classResults.reduce((s, c) => s + c.hearingWage, 0);
  const retellWage = classResults.reduce((s, c) => s + c.retellWage, 0);
  const managementFee = classResults.reduce((s, c) => s + c.managementFee, 0);
  const partTimeWage = classResults.reduce((s, c) => s + c.partTimeWage, 0);

  return {
    teacherId: teacher.id,
    teacherName: teacher.name,
    teacherLevel: teacher.level,
    classCount: teacherClasses.length,
    hearingWage,
    retellWage,
    managementFee,
    partTimeWage,
    total: hearingWage + retellWage + managementFee + partTimeWage,
    classes: classResults,
  };
}
