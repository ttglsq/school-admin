import { useEffect, useState } from 'react';
import { Save, User, Phone, Users, GraduationCap, School, UserX, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Teacher, ClassInfo, Student, ClassLevel, ClassDuration, Campus } from '@/types';
import { CLASS_LEVELS, CLASS_DURATIONS, TEACHER_LEVELS } from '@/types';
import { cn } from '@/lib/utils';

interface ClassDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cls: ClassInfo | null;
  teacher: Teacher | null;
  campus: Campus | null;
  campuses: Campus[];
  students: Student[];
  onUpdate: (id: string, data: Partial<Omit<ClassInfo, 'id' | 'createdAt'>>) => void;
}

export default function ClassDetailDialog({ open, onOpenChange, cls, teacher, campus, campuses, students, onUpdate }: ClassDetailDialogProps) {
  const [level, setLevel] = useState<ClassLevel | ''>('');
  const [duration, setDuration] = useState<ClassDuration | ''>('');
  const [campusId, setCampusId] = useState('');

  // 打开时同步表单状态
  useEffect(() => {
    if (cls) {
      setLevel(cls.level);
      setDuration(cls.duration);
      setCampusId(cls.campusId || 'none');
    }
  }, [cls]);

  if (!cls) return null;

  const handleSaveSettings = () => {
    if (!level || !duration) {
      toast.error('请选择班级等级和上课时长');
      return;
    }
    onUpdate(cls.id, { level, duration, campusId: campusId === 'none' ? '' : campusId });
    toast.success('班级设置已更新');
  };

  const settingsChanged =
    level !== cls.level || duration !== cls.duration || (campusId === 'none' ? '' : campusId) !== cls.campusId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shrink-0">
              <School className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl flex items-center gap-2 flex-wrap">
                {cls.name}
                <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border', CLASS_LEVELS[cls.level].color)}>
                  {CLASS_LEVELS[cls.level].label}
                </span>
                <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border', CLASS_DURATIONS[cls.duration].color)}>
                  {CLASS_DURATIONS[cls.duration].label}
                </span>
              </DialogTitle>
              <DialogDescription>查看班级详情，管理班级设置</DialogDescription>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{campus ? campus.name : '未分配校区'}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* 班级设置 */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <GraduationCap className="w-4.5 h-4.5 text-blue-600" />
              班级设置
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>班级等级</Label>
                <Select value={level} onValueChange={(v) => setLevel(v as ClassLevel)}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择班级等级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A 初级</SelectItem>
                    <SelectItem value="B">B 入门级</SelectItem>
                    <SelectItem value="C">C 启蒙</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>上课时长</Label>
                <Select value={duration} onValueChange={(v) => setDuration(v as ClassDuration)}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择上课时长" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A 2课时</SelectItem>
                    <SelectItem value="B">B 3课时</SelectItem>
                    <SelectItem value="C">C 4课时</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>所属校区</Label>
                <Select value={campusId} onValueChange={setCampusId}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择所属校区" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不分配校区</SelectItem>
                    {campuses.map(cp => (
                      <SelectItem key={cp.id} value={cp.id}>
                        {cp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button
                onClick={handleSaveSettings}
                className="gap-2"
                disabled={!settingsChanged}
              >
                <Save className="w-4 h-4" /> 保存设置
              </Button>
            </div>
          </div>

          {/* 任课老师 */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <User className="w-4.5 h-4.5 text-purple-600" />
              任课老师
            </h3>
            {teacher ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/60">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-semibold shrink-0">
                  {teacher.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{teacher.name}</span>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', TEACHER_LEVELS[teacher.level].color)}>
                      {TEACHER_LEVELS[teacher.level].label}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3.5 h-3.5" />
                    {teacher.phone}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-dashed">
                <UserX className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">该班级暂未分配任课老师</span>
              </div>
            )}
          </div>

          {/* 班级学生 */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Users className="w-4.5 h-4.5 text-teal-600" />
              班级学生
              <span className="ml-auto text-sm font-normal text-muted-foreground">
                共 {students.length} 人
              </span>
            </h3>
            {students.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-muted-foreground">
                <Users className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">该班级暂无学生，可在「学生管理」中分配</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {students.map(student => (
                  <div key={student.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 border border-border/60">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-teal-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {student.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{student.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {student.contact}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
