import { useState, useMemo, useCallback } from 'react';
import { ClipboardList, Save, ChevronDown, ChevronRight, GraduationCap, School, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { Teacher, ClassInfo, Student, StudentMonthlyRecord, PartTimeWeeklyRecord } from '@/types';
import { WEEKS_PER_MONTH, isPartTimeTeacher, getPartTimePerStudent, getPartTimeMinFee } from '@/types';

interface PerformanceEntryPageProps {
  teachers: Teacher[];
  classes: ClassInfo[];
  students: Student[];
  monthlyRecords: StudentMonthlyRecord[];
  onSaveWeeklyRecords: (yearMonth: string, week: number, records: StudentMonthlyRecord[]) => void;
  partTimeRecords: PartTimeWeeklyRecord[];
  onSavePartTimeRecords: (yearMonth: string, week: number, records: PartTimeWeeklyRecord[]) => void;
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

export default function PerformanceEntryPage(props: PerformanceEntryPageProps) {
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [week, setWeek] = useState(1);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [editMap, setEditMap] = useState<Record<string, EditRecord>>({});
  const [dirty, setDirty] = useState(false);
  // D级兼职出勤编辑状态：classId -> attended
  const [partTimeEditMap, setPartTimeEditMap] = useState<Record<string, boolean>>({});

  const { teachers, classes, students, monthlyRecords, partTimeRecords } = props;
  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);

  const teacherClasses = useMemo(
    () => classes.filter(c => c.teacherId === selectedTeacherId),
    [classes, selectedTeacherId],
  );
  const classIds = useMemo(() => new Set(teacherClasses.map(c => c.id)), [teacherClasses]);

  // 该老师某周是否已有已保存记录（用于周标签上的圆点提示）
  const weekHasData = useCallback((w: number): boolean => {
    if (!selectedTeacherId) return false;
    if (selectedTeacher && isPartTimeTeacher(selectedTeacher.level)) {
      // D级兼职：看出勤记录
      return partTimeRecords.some(r => r.yearMonth === yearMonth && r.week === w && classIds.has(r.classId));
    }
    // ABC级：看学生数据
    return monthlyRecords.some(r => r.yearMonth === yearMonth && r.week === w && classIds.has(r.classId));
  }, [selectedTeacherId, selectedTeacher, monthlyRecords, partTimeRecords, yearMonth, classIds]);

  // 加载某月某周某老师的记录到编辑区
  const loadRecords = useCallback((ym: string, wk: number, teacherId: string) => {
    const tClasses = classes.filter(c => c.teacherId === teacherId);
    const cIds = new Set(tClasses.map(c => c.id));
    const teacher = teachers.find(t => t.id === teacherId);

    if (teacher && isPartTimeTeacher(teacher.level)) {
      // D级兼职：只加载出勤记录
      const existing = partTimeRecords.filter(r => r.yearMonth === ym && r.week === wk && cIds.has(r.classId));
      const map: Record<string, boolean> = {};
      for (const cls of tClasses) {
        const rec = existing.find(r => r.classId === cls.id);
        map[cls.id] = rec?.attended ?? false;
      }
      setPartTimeEditMap(map);
      setDirty(false);
      return;
    }

    const existing = monthlyRecords.filter(r => r.yearMonth === ym && r.week === wk && cIds.has(r.classId));
    const map: Record<string, EditRecord> = {};
    for (const cls of tClasses) {
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
    setExpandedClasses(new Set(tClasses.map(c => c.id)));
  }, [classes, students, monthlyRecords, partTimeRecords, teachers]);

  // 切换年月 / 周次 / 老师（有未保存修改时先确认）
  const switchContext = (ym: string, wk: number, teacherId: string) => {
    if (dirty && !window.confirm('当前有未保存的修改，切换后将丢失，确定继续吗？')) return;
    setYearMonth(ym);
    setWeek(wk);
    setSelectedTeacherId(teacherId);
    if (teacherId) loadRecords(ym, wk, teacherId);
    else { setEditMap({}); setPartTimeEditMap({}); setDirty(false); }
  };

  // 更新编辑记录（A/B/C级）
  const updateEdit = (studentId: string, field: 'hearingX' | 'retell', value: string | boolean) => {
    setEditMap(prev => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
    setDirty(true);
  };

  // 更新兼职出勤记录（D级）
  const updatePartTimeAttendance = (classId: string, attended: boolean) => {
    setPartTimeEditMap(prev => ({ ...prev, [classId]: attended }));
    setDirty(true);
  };

  // 保存当前 月+周 的数据
  const handleSave = () => {
    if (!selectedTeacherId) return;
    const teacher = teachers.find(t => t.id === selectedTeacherId);

    if (teacher && isPartTimeTeacher(teacher.level)) {
      // D级兼职：保存出勤记录
      const records: PartTimeWeeklyRecord[] = [];
      for (const cls of teacherClasses) {
        records.push({
          id: `${yearMonth}-w${week}-${cls.id}`,
          teacherId: selectedTeacherId,
          classId: cls.id,
          yearMonth,
          week,
          attended: partTimeEditMap[cls.id] ?? false,
        });
      }
      props.onSavePartTimeRecords(yearMonth, week, records);
      setDirty(false);
      toast.success(`${yearMonth} 第${week}周兼职出勤记录已保存`);
      return;
    }

    const records: StudentMonthlyRecord[] = [];
    for (const cls of teacherClasses) {
      const classStudents = students.filter(s => s.classId === cls.id);
      for (const stu of classStudents) {
        const ed = editMap[stu.id];
        if (!ed) continue;
        const n = Number(ed.hearingX.trim());
        const hearingX = ed.hearingX.trim() === '' || isNaN(n) ? null : n;
        records.push({
          id: `${yearMonth}-w${week}-${stu.id}`,
          studentId: stu.id,
          classId: cls.id,
          yearMonth,
          week,
          hearingX,
          retell: ed.retell,
        });
      }
    }
    props.onSaveWeeklyRecords(yearMonth, week, records);
    setDirty(false);
    toast.success(`${yearMonth} 第${week}周数据已保存`);
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

  const totalStudents = teacherClasses.reduce(
    (s, c) => s + students.filter(st => st.classId === c.id).length,
    0,
  );

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* 顶部：年月 + 周次选择 */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <Input
              type="month"
              value={yearMonth}
              onChange={e => switchContext(e.target.value, week, selectedTeacherId)}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">周次</span>
            {Array.from({ length: WEEKS_PER_MONTH }, (_, i) => i + 1).map(w => (
              <button
                key={w}
                onClick={() => switchContext(yearMonth, w, selectedTeacherId)}
                className={cn(
                  'relative px-3.5 py-1.5 rounded-md text-sm font-medium border transition-colors',
                  week === w
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-background border-input hover:bg-muted',
                )}
              >
                第{w}周
                {weekHasData(w) && (
                  <span
                    className={cn(
                      'absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-background',
                      week === w ? 'bg-green-300' : 'bg-green-500',
                    )}
                  />
                )}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-1">● 已录入</span>
          </div>
        </CardContent>
      </Card>

      {/* 老师选择 + 保存 */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-muted-foreground" />
            <select
              value={selectedTeacherId}
              onChange={e => switchContext(yearMonth, week, e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="">— 选择老师 —</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {dirty && (
            <span className="text-sm text-amber-600 font-medium flex items-center gap-1">● 未保存</span>
          )}
          {selectedTeacherId && (
            <Button onClick={handleSave} disabled={!dirty} className="gap-2 ml-auto">
              <Save className="w-4 h-4" /> 保存本周数据
            </Button>
          )}
        </CardContent>
      </Card>

      {!selectedTeacherId ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>请选择老师与周次，开始录入听力数据与复述完成情况</p>
          </CardContent>
        </Card>
      ) : selectedTeacher && isPartTimeTeacher(selectedTeacher.level) ? (
        teacherClasses.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <School className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>该老师名下暂无班级</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {teacherClasses.map(cls => {
              const classStudents = students.filter(s => s.classId === cls.id);
              const studentCount = classStudents.length;
              const perStudent = getPartTimePerStudent(cls.duration);
              const minFee = getPartTimeMinFee(cls.duration);
              const perLesson = Math.max(studentCount * perStudent, minFee);
              return (
                <Card key={cls.id} className="overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <School className="w-4 h-4 text-purple-600" />
                      <span className="font-medium">{cls.name}</span>
                      <span className="text-xs text-muted-foreground">{studentCount} 名学生</span>
                      <span className="text-xs text-muted-foreground">· {perLesson}元/周</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`pt-${cls.id}`}
                        checked={partTimeEditMap[cls.id] ?? false}
                        onCheckedChange={(v) => updatePartTimeAttendance(cls.id, v === true)}
                      />
                      <label htmlFor={`pt-${cls.id}`} className="text-sm font-medium cursor-pointer select-none">
                        本周上课
                      </label>
                    </div>
                  </div>
                </Card>
              );
            })}
            <div className="text-xs text-muted-foreground text-center">
              {teacherClasses.length} 个班级 · {yearMonth} 第{week}周
            </div>
          </>
        )
      ) : teacherClasses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <School className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>该老师名下暂无班级</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {teacherClasses.map(cls => {
            const expanded = expandedClasses.has(cls.id);
            const classStudents = students.filter(s => s.classId === cls.id);
            return (
              <Card key={cls.id} className="overflow-hidden">
                {/* 班级头（仅显示班级名，不显示等级/课时等薪资相关信息） */}
                <button
                  onClick={() => toggleClass(cls.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <School className="w-4 h-4 text-purple-600" />
                    <span className="font-medium">{cls.name}</span>
                    <span className="text-xs text-muted-foreground">{classStudents.length} 名学生</span>
                  </div>
                </button>

                {/* 学生录入表格 */}
                {expanded && (
                  <div className="border-t overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-40">学生</TableHead>
                          <TableHead className="w-52">听力数据(分钟/周)</TableHead>
                          <TableHead>复述完成</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classStudents.map(stu => {
                          const ed = editMap[stu.id];
                          if (!ed) return null;
                          return (
                            <TableRow key={stu.id}>
                              <TableCell className="font-medium">{stu.name}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={ed.hearingX}
                                  onChange={e => updateEdit(stu.id, 'hearingX', e.target.value)}
                                  placeholder="未填"
                                  className="w-36 h-8"
                                  min={0}
                                />
                              </TableCell>
                              <TableCell>
                                <Checkbox
                                  checked={ed.retell}
                                  onCheckedChange={(v) => updateEdit(stu.id, 'retell', v === true)}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {classStudents.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                              该班级暂无学生
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            );
          })}

          <div className="text-xs text-muted-foreground text-center">
            共 {totalStudents} 名学生 · {yearMonth} 第{week}周
          </div>
        </>
      )}
    </div>
  );
}
