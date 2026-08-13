import { useState, useMemo, useCallback } from 'react';
import { Calculator, Save, ChevronDown, ChevronRight, GraduationCap, School, FileSpreadsheet, Info, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
  type TeacherPerformanceResult,
} from '@/utils/performanceCalc';

interface PerformancePageProps {
  teachers: Teacher[];
  classes: ClassInfo[];
  students: Student[];
  salaryStandard: SalaryStandardData;
  monthlyRecords: StudentMonthlyRecord[];
  onSaveMonthlyRecords: (yearMonth: string, records: StudentMonthlyRecord[]) => void;
}

// 当前年月字符串 "YYYY-MM"
function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 编辑中的单条记录
interface EditRecord {
  hearingX: string; // 输入框文本，空字符串=未填
  retell: boolean;
}

export default function PerformancePage(props: PerformancePageProps) {
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [tab, setTab] = useState<'entry' | 'summary'>('entry');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [editMap, setEditMap] = useState<Record<string, EditRecord>>({});
  const [dirty, setDirty] = useState(false);

  const { teachers, classes, students, salaryStandard, monthlyRecords } = props;

  // 加载某月某老师的记录到编辑区
  const loadRecords = useCallback((ym: string, teacherId: string) => {
    const teacherClasses = classes.filter(c => c.teacherId === teacherId);
    const classIds = new Set(teacherClasses.map(c => c.id));
    const existing = monthlyRecords.filter(r => r.yearMonth === ym && classIds.has(r.classId));
    const map: Record<string, EditRecord> = {};
    // 为该老师名下所有学生初始化编辑记录
    for (const cls of teacherClasses) {
      const classStudents = students.filter(s => s.classId === cls.id);
      for (const stu of classStudents) {
        const rec = existing.find(r => r.studentId === stu.id);
        map[stu.id] = {
          hearingX: rec?.hearingX != null ? String(rec.hearingX) : '',
          retell: rec?.retell ?? false,
        };
      }
    }
    setEditMap(map);
    setDirty(false);
    // 默认展开所有班级
    setExpandedClasses(new Set(teacherClasses.map(c => c.id)));
  }, [classes, students, monthlyRecords]);

  // 切换老师时加载记录
  const handleSelectTeacher = (id: string) => {
    setSelectedTeacherId(id);
    if (id) loadRecords(yearMonth, id);
    else { setEditMap({}); setDirty(false); }
  };

  // 切换年月时重新加载
  const handleYearMonthChange = (ym: string) => {
    setYearMonth(ym);
    if (selectedTeacherId) loadRecords(ym, selectedTeacherId);
  };

  // 更新编辑记录
  const updateEdit = (studentId: string, field: 'hearingX' | 'retell', value: string | boolean) => {
    setEditMap(prev => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
    setDirty(true);
  };

  // 保存
  const handleSave = () => {
    if (!selectedTeacherId) return;
    const teacherClasses = classes.filter(c => c.teacherId === selectedTeacherId);
    const records: StudentMonthlyRecord[] = [];
    for (const cls of teacherClasses) {
      const classStudents = students.filter(s => s.classId === cls.id);
      for (const stu of classStudents) {
        const ed = editMap[stu.id];
        if (!ed) continue;
        const hearingX = ed.hearingX.trim() === '' ? null : Number(ed.hearingX);
        records.push({
          id: `${yearMonth}-${stu.id}`,
          studentId: stu.id,
          classId: cls.id,
          yearMonth,
          hearingX: hearingX != null && !isNaN(hearingX) ? hearingX : null,
          retell: ed.retell,
        });
      }
    }
    props.onSaveMonthlyRecords(yearMonth, records);
    setDirty(false);
    toast.success(`${yearMonth} 月数据已保存`);
  };

  // 切换班级展开
  const toggleClass = (classId: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  // ===== 数据录入 Tab =====
  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);
  const teacherClasses = useMemo(() =>
    classes.filter(c => c.teacherId === selectedTeacherId),
    [classes, selectedTeacherId],
  );

  // 实时计算当前老师的绩效
  const teacherPerf = useMemo(() => {
    if (!selectedTeacher) return null;
    // 构建临时 records 供计算
    const tempRecords: StudentMonthlyRecord[] = [];
    for (const cls of teacherClasses) {
      const classStudents = students.filter(s => s.classId === cls.id);
      for (const stu of classStudents) {
        const ed = editMap[stu.id];
        if (!ed) continue;
        const hearingX = ed.hearingX.trim() === '' ? null : Number(ed.hearingX);
        tempRecords.push({
          id: `temp-${stu.id}`,
          studentId: stu.id,
          classId: cls.id,
          yearMonth,
          hearingX: hearingX != null && !isNaN(hearingX) ? hearingX : null,
          retell: ed.retell,
        });
      }
    }
    return calculateTeacherPerformance(selectedTeacher, classes, students, tempRecords, salaryStandard);
  }, [selectedTeacher, teacherClasses, students, editMap, yearMonth, classes, salaryStandard]);

  // ===== 绩效汇总 Tab =====
  const allTeacherPerfs = useMemo<TeacherPerformanceResult[]>(() => {
    const monthRecords = monthlyRecords.filter(r => r.yearMonth === yearMonth);
    return teachers.map(t => calculateTeacherPerformance(t, classes, students, monthRecords, salaryStandard));
  }, [teachers, classes, students, monthlyRecords, yearMonth, salaryStandard]);

  const summaryTotal = allTeacherPerfs.reduce((s, t) => s + t.total, 0);

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
              onChange={e => handleYearMonthChange(e.target.value)}
              className="w-40"
            />
          </div>
          {/* Tab 切换 */}
          <div className="flex gap-1 p-1 rounded-lg bg-muted">
            <button
              onClick={() => setTab('entry')}
              className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                tab === 'entry' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              数据录入
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

      {tab === 'entry' ? (
        <>
          {/* 老师选择 */}
          <Card>
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-muted-foreground" />
                <select
                  value={selectedTeacherId}
                  onChange={e => handleSelectTeacher(e.target.value)}
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
              {dirty && (
                <span className="text-sm text-amber-600 font-medium flex items-center gap-1">
                  ● 未保存
                </span>
              )}
              {selectedTeacher && (
                <Button onClick={handleSave} disabled={!dirty} className="gap-2 ml-auto">
                  <Save className="w-4 h-4" /> 保存
                </Button>
              )}
            </CardContent>
          </Card>

          {!selectedTeacher ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Calculator className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>请在上方选择一位老师，开始录入月度绩效数据</p>
              </CardContent>
            </Card>
          ) : teacherClasses.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <School className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>该老师名下暂无班级</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 班级列表 */}
              {teacherPerf?.classes.map(clsPerf => {
                const expanded = expandedClasses.has(clsPerf.classId);
                return (
                  <Card key={clsPerf.classId} className="overflow-hidden">
                    {/* 班级头 */}
                    <button
                      onClick={() => toggleClass(clsPerf.classId)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
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
                    </button>

                    {/* 班级学生表格 */}
                    {expanded && (
                      <div className="border-t">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="w-32">学生</TableHead>
                              <TableHead className="w-40">听力数据(分钟/周)</TableHead>
                              <TableHead className="w-32">查表y(元/周)</TableHead>
                              <TableHead className="w-28">时长系数</TableHead>
                              <TableHead className="w-28">复述完成</TableHead>
                              <TableHead className="text-right">听力工资(月)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {clsPerf.hearingDetails.map(d => {
                              const ed = editMap[d.studentId];
                              if (!ed) return null;
                              return (
                                <TableRow key={d.studentId}>
                                  <TableCell className="font-medium">{d.studentName}</TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      value={ed.hearingX}
                                      onChange={e => updateEdit(d.studentId, 'hearingX', e.target.value)}
                                      placeholder="未填"
                                      className="w-32 h-8"
                                      min={0}
                                    />
                                  </TableCell>
                                  <TableCell className="text-muted-foreground tabular-nums">
                                    {d.y != null ? `¥${d.y.toFixed(2)}` : d.hearingX != null ? '¥0.00' : '—'}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground tabular-nums">
                                    ×{d.multiplier.toFixed(4)}
                                    {d.isBC && <span className="text-orange-600"> ÷{BC_HEARING_DIVISOR}</span>}
                                  </TableCell>
                                  <TableCell>
                                    <Checkbox
                                      checked={ed.retell}
                                      onCheckedChange={(v) => updateEdit(d.studentId, 'retell', v === true)}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right font-semibold tabular-nums">
                                    {d.monthlyWage > 0 ? `¥${d.monthlyWage.toFixed(2)}` : d.hearingX != null ? '¥0.00' : '—'}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {clsPerf.hearingDetails.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                                  该班级暂无学生
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                        {/* 班级小计 */}
                        <div className="flex items-center justify-end gap-6 px-4 py-2.5 bg-muted/20 border-t text-sm">
                          <span>复述: {clsPerf.retellCount}人 × ¥{clsPerf.retellUnitPrice} = <span className="font-semibold">¥{clsPerf.retellWage.toFixed(2)}</span></span>
                          <span>管理费: <span className="font-semibold">¥{clsPerf.managementFee}</span></span>
                          <span>班级合计: <span className="font-bold text-blue-600">¥{clsPerf.total.toFixed(2)}</span></span>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}

              {/* 老师合计 */}
              {teacherPerf && (
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
              )}

              {/* 计算说明 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p>听力工资 = 查表y(元/周) × 时长系数 × {WEEKS_PER_MONTH}周 ｜ A初级班: 2课时×2/3, 3课时×4/3, 4课时×4/3 ｜ B/C班: 2课时×2/3, 3课时×4/3, 4课时×2/3, 再÷{BC_HEARING_DIVISOR}</p>
                      <p>听力数据未达到最低档位要求时，该学生听力工资按 0 计算（查表y 与 听力工资均显示 ¥0.00）</p>
                      <p>复述工资: 3课时 ¥3/人, 4课时 ¥4/人, 2课时无 ｜ 班级管理费: A级老师 2课时¥140/3课时¥180/4课时¥200, B/C级老师 2课时¥160/3课时¥200/4课时¥220</p>
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
                <TableHead>老师</TableHead>
                <TableHead>等级</TableHead>
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
                    <TableCell className="font-medium">{tp.teacherName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('border', TEACHER_LEVELS[tp.teacherLevel].color)}>
                        {TEACHER_LEVELS[tp.teacherLevel].label}
                      </Badge>
                    </TableCell>
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
