import { useState, useMemo } from 'react';
import { Calculator, GraduationCap, School, FileSpreadsheet, Info, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { Teacher, ClassInfo, Student, SalaryStandardData, StudentMonthlyRecord } from '@/types';
import { TEACHER_LEVELS, CLASS_LEVELS, CLASS_DURATIONS, WEEKS_PER_MONTH, BC_HEARING_DIVISOR } from '@/types';
import {
  calculateTeacherPerformance,
  teacherLevelToCoeffKey,
  isBCClass,
  getMinThreshold,
  type TeacherPerformanceResult,
} from '@/utils/performanceCalc';

interface PerformancePageProps {
  teachers: Teacher[];
  classes: ClassInfo[];
  students: Student[];
  salaryStandard: SalaryStandardData;
  monthlyRecords: StudentMonthlyRecord[];
}

// 当前年月字符串 "YYYY-MM"
function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function PerformancePage(props: PerformancePageProps) {
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [tab, setTab] = useState<'view' | 'summary'>('view');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  const { teachers, classes, students, salaryStandard, monthlyRecords } = props;

  const monthRecords = useMemo(
    () => monthlyRecords.filter(r => r.yearMonth === yearMonth),
    [monthlyRecords, yearMonth],
  );

  // ===== 数据展示 Tab：所选老师的月度明细 =====
  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);
  const teacherPerf = useMemo(() => {
    if (!selectedTeacher) return null;
    return calculateTeacherPerformance(selectedTeacher, classes, students, monthRecords, salaryStandard);
  }, [selectedTeacher, classes, students, monthRecords, salaryStandard]);

  // ===== 绩效汇总 Tab =====
  const allTeacherPerfs = useMemo<TeacherPerformanceResult[]>(() => {
    return teachers.map(t => calculateTeacherPerformance(t, classes, students, monthRecords, salaryStandard));
  }, [teachers, classes, students, monthRecords, salaryStandard]);

  const summaryTotal = allTeacherPerfs.reduce((s, t) => s + t.total, 0);

  // 听力系数表最低挡位（分钟/周），低于该值按最低挡计薪
  const minHearingX = useMemo(() => {
    const keys = Object.keys(salaryStandard || {}) as (keyof SalaryStandardData)[];
    for (const k of keys) {
      const t = salaryStandard[k];
      if (t && t.length) return getMinThreshold(t);
    }
    return 210;
  }, [salaryStandard]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* 顶部控制栏 */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <Input
              type="month"
              value={yearMonth}
              onChange={e => setYearMonth(e.target.value)}
              className="w-40"
            />
          </div>
          {/* Tab 切换 */}
          <div className="flex gap-1 p-1 rounded-lg bg-muted">
            <button
              onClick={() => setTab('view')}
              className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                tab === 'view' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              数据展示
            </button>
            <button
              onClick={() => setTab('summary')}
              className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                tab === 'summary' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              绩效汇总
            </button>
          </div>
        </CardContent>
      </Card>

      {tab === 'view' ? (
        <>
          {/* 老师选择 */}
          <Card>
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-muted-foreground" />
                <select
                  value={selectedTeacherId}
                  onChange={e => setSelectedTeacherId(e.target.value)}
                  className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">— 选择老师 —</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}（{TEACHER_LEVELS[t.level].label}）
                    </option>
                  ))}
                </select>
              </div>
              {selectedTeacher && (
                <Badge variant="outline" className={cn('border', TEACHER_LEVELS[selectedTeacher.level].color)}>
                  {TEACHER_LEVELS[selectedTeacher.level].label} · 系数 {teacherLevelToCoeffKey(selectedTeacher.level)}
                </Badge>
              )}
              {selectedTeacher && (
                <span className="ml-auto text-sm text-muted-foreground">
                  {yearMonth} 月 · 已按 {WEEKS_PER_MONTH} 周录入数据展示
                </span>
              )}
            </CardContent>
          </Card>

          {!selectedTeacher ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Calculator className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>请在上方选择一位老师，查看月度绩效明细</p>
              </CardContent>
            </Card>
          ) : teacherPerf === null || teacherPerf.classes.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <School className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>该老师名下暂无班级</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 班级列表 */}
              {teacherPerf.classes.map(clsPerf => (
                <Card key={clsPerf.classId} className="overflow-hidden">
                  {/* 班级头 */}
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                    <div className="flex items-center gap-3">
                      <School className="w-4 h-4 text-purple-600" />
                      <span className="font-medium">{clsPerf.className}</span>
                      <Badge variant="outline" className={cn('border', CLASS_LEVELS[clsPerf.classLevel].color)}>
                        {CLASS_LEVELS[clsPerf.classLevel].shortLabel}
                      </Badge>
                      <Badge variant="outline" className={cn('border', CLASS_DURATIONS[clsPerf.duration].color)}>
                        {CLASS_DURATIONS[clsPerf.duration].shortLabel}
                      </Badge>
                      {isBCClass(clsPerf.classLevel) && (
                        <span className="text-xs text-orange-600">听力÷{BC_HEARING_DIVISOR}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">听力 <span className="font-semibold text-foreground">¥{clsPerf.hearingWage.toFixed(2)}</span></span>
                      <span className="text-muted-foreground">复述 <span className="font-semibold text-foreground">¥{clsPerf.retellWage.toFixed(2)}</span></span>
                      <span className="text-muted-foreground">管理费 <span className="font-semibold text-foreground">¥{clsPerf.managementFee}</span></span>
                      <span className="text-muted-foreground">合计 <span className="font-bold text-blue-600">¥{clsPerf.total.toFixed(2)}</span></span>
                    </div>
                  </div>

                  {/* 班级学生表格（每周明细） */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-24">学生</TableHead>
                          {Array.from({ length: WEEKS_PER_MONTH }, (_, i) => i + 1).map(w => (
                            <TableHead key={w} className="w-20 text-center">第{w}周</TableHead>
                          ))}
                          <TableHead className="w-40">查表y(元/周)</TableHead>
                          <TableHead className="w-28">时长系数</TableHead>
                          <TableHead className="w-24">复述完成</TableHead>
                          <TableHead className="text-right w-28">听力工资(月)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clsPerf.hearingDetails.map(d => (
                          <TableRow key={d.studentId}>
                            <TableCell className="font-medium">{d.studentName}</TableCell>
                            {d.weeks.map(w => (
                              <TableCell key={w.week} className="text-center tabular-nums">
                                {w.hearingX != null ? (
                                  <span className={cn(w.y == null && 'text-red-600 font-medium')}>
                                    {w.hearingX}
                                    {w.y == null && (
                                      <span className="ml-1 text-[10px] text-red-500">0</span>
                                    )}
                                    {w.belowMin && (
                                      <span className="ml-1 text-[10px] text-blue-500">↓最低档</span>
                                    )}
                                  </span>
                                ) : '—'}
                              </TableCell>
                            ))}
                            <TableCell className="text-muted-foreground tabular-nums text-xs">
                              {d.weeks.map(w =>
                                w.y != null ? `¥${w.y.toFixed(2)}` : w.hearingX != null ? '¥0.00' : '—',
                              ).join(' / ')}
                            </TableCell>
                            <TableCell className="text-muted-foreground tabular-nums">
                              ×{d.multiplier.toFixed(4)}
                              {d.isBC && <span className="text-orange-600"> ÷{BC_HEARING_DIVISOR}</span>}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              <span className={cn(d.retellCount > 0 ? 'font-medium' : 'text-muted-foreground')}>
                                {d.retellCount}/{WEEKS_PER_MONTH}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {d.monthlyWage > 0
                                ? `¥${d.monthlyWage.toFixed(2)}`
                                : d.weeks.some(w => w.hearingX != null)
                                  ? '¥0.00'
                                  : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                        {clsPerf.hearingDetails.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={1 + WEEKS_PER_MONTH + 4} className="text-center text-muted-foreground py-6">
                              该班级暂无学生
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {/* 班级小计 */}
                  <div className="flex items-center justify-end gap-6 px-4 py-2.5 bg-muted/20 border-t text-sm">
                    <span>复述: {clsPerf.retellCount}人次 × ¥{clsPerf.retellUnitPrice} = <span className="font-semibold">¥{clsPerf.retellWage.toFixed(2)}</span></span>
                    <span>管理费: <span className="font-semibold">¥{clsPerf.managementFee}</span></span>
                    <span>班级合计: <span className="font-bold text-blue-600">¥{clsPerf.total.toFixed(2)}</span></span>
                  </div>
                </Card>
              ))}

              {/* 老师合计 */}
              <Card className="border-blue-300 bg-blue-50/50">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-blue-900">{selectedTeacher.name} 月度绩效合计</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-blue-800">听力工资 <span className="font-bold">¥{teacherPerf.hearingWage.toFixed(2)}</span></span>
                    <span className="text-blue-800">复述工资 <span className="font-bold">¥{teacherPerf.retellWage.toFixed(2)}</span></span>
                    <span className="text-blue-800">管理费 <span className="font-bold">¥{teacherPerf.managementFee.toFixed(2)}</span></span>
                    <span className="text-blue-900 text-base">总计 <span className="font-bold">¥{teacherPerf.total.toFixed(2)}</span></span>
                  </div>
                </CardContent>
              </Card>

              {/* 计算说明 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p>听力工资 = 每周 查表y(元/周) × 时长系数 之和（每月按 {WEEKS_PER_MONTH} 周录入）｜ A初级班: 2课时÷3×2, 3课时÷3×4, 4课时÷3×4 ｜ B/C班: 2课时÷3×2, 3课时÷3×4, 4课时÷3×4, 得出数据再÷{BC_HEARING_DIVISOR}（先除再乘）</p>
                      <p>任一单周听力数据低于最低档位（{minHearingX} 分钟/周）时，按最低档位计薪（查表y 取最小挡位值，标注「↓最低档」）；未录入听力数据的周不计薪</p>
                      <p>复述工资: 3课时 ¥3/人次, 4课时 ¥4/人次, 2课时无 ｜ 班级管理费: A级老师 2课时¥160/3课时¥200/4课时¥220, B/C级老师 2课时¥140/3课时¥180/4课时¥200</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      ) : (
        /* ===== 绩效汇总 Tab ===== */
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">{yearMonth} 月 · 全部老师绩效汇总</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>等级</TableHead>
                <TableHead>老师</TableHead>
                <TableHead className="text-center">班级数</TableHead>
                <TableHead className="text-right">听力工资</TableHead>
                <TableHead className="text-right">复述工资</TableHead>
                <TableHead className="text-right">管理费</TableHead>
                <TableHead className="text-right">合计</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allTeacherPerfs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    暂无老师数据
                  </TableCell>
                </TableRow>
              ) : (
                allTeacherPerfs.map(tp => (
                  <TableRow key={tp.teacherId}>
                    <TableCell>
                      <Badge variant="outline" className={cn('border', TEACHER_LEVELS[tp.teacherLevel].color)}>
                        {TEACHER_LEVELS[tp.teacherLevel].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{tp.teacherName}</TableCell>
                    <TableCell className="text-center tabular-nums">{tp.classCount}</TableCell>
                    <TableCell className="text-right tabular-nums">¥{tp.hearingWage.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">¥{tp.retellWage.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">¥{tp.managementFee.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-blue-600">¥{tp.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {allTeacherPerfs.length > 0 && (
            <div className="flex items-center justify-end gap-4 px-4 py-3 bg-muted/20 border-t">
              <span className="text-sm text-muted-foreground">全部合计</span>
              <span className="text-lg font-bold text-blue-600">¥{summaryTotal.toFixed(2)}</span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
