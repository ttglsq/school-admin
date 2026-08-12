import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Eye, School, Users, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Teacher, ClassInfo, Student, ClassLevel, ClassDuration, Campus } from '@/types';
import { CLASS_LEVELS, CLASS_DURATIONS } from '@/types';
import { cn } from '@/lib/utils';
import ClassDetailDialog from './ClassDetailDialog';

interface ClassManagementProps {
  classes: ClassInfo[];
  teachers: Teacher[];
  students: Student[];
  campuses: Campus[];
  onAdd: (data: Omit<ClassInfo, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, data: Partial<Omit<ClassInfo, 'id' | 'createdAt'>>) => void;
  onDelete: (id: string) => void;
}

export default function ClassManagement({ classes, teachers, students, campuses, onAdd, onUpdate, onDelete }: ClassManagementProps) {
  const [search, setSearch] = useState('');
  const [campusFilter, setCampusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailClass, setDetailClass] = useState<ClassInfo | null>(null);
  const [form, setForm] = useState({
    name: '',
    level: '' as ClassLevel | '',
    duration: '' as ClassDuration | '',
    teacherId: '',
    campusId: '',
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return classes.filter(c => {
      const matchCampus =
        !campusFilter ||
        (campusFilter === '__none__' ? !c.campusId : c.campusId === campusFilter);
      if (!matchCampus) return false;
      if (!q) return true;
      const campusName = campuses.find(cp => cp.id === c.campusId)?.name.toLowerCase() ?? '';
      return (
        c.name.toLowerCase().includes(q) ||
        CLASS_LEVELS[c.level].label.toLowerCase().includes(q) ||
        CLASS_DURATIONS[c.duration].label.toLowerCase().includes(q) ||
        (teachers.find(t => t.id === c.teacherId)?.name.toLowerCase().includes(q) ?? false) ||
        campusName.includes(q)
      );
    });
  }, [classes, teachers, campuses, search, campusFilter]);

  const getStudentCount = (classId: string) => students.filter(s => s.classId === classId).length;
  const getTeacherName = (teacherId: string) => teachers.find(t => t.id === teacherId)?.name || '未分配';
  const getCampusName = (campusId: string) => campuses.find(cp => cp.id === campusId)?.name || '未分配校区';

  const openAdd = () => {
    setForm({ name: '', level: '', duration: '', teacherId: '', campusId: '' });
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (cls: ClassInfo) => {
    setForm({ name: cls.name, level: cls.level, duration: cls.duration, teacherId: cls.teacherId, campusId: cls.campusId });
    setEditingId(cls.id);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('请输入班级名称'); return; }
    if (!form.level) { toast.error('请选择班级等级'); return; }
    if (!form.duration) { toast.error('请选择上课时长'); return; }

    if (editingId) {
      onUpdate(editingId, {
        name: form.name.trim(),
        level: form.level,
        duration: form.duration,
        teacherId: form.teacherId,
        campusId: form.campusId,
      });
      toast.success('班级信息已更新');
    } else {
      onAdd({
        name: form.name.trim(),
        level: form.level,
        duration: form.duration,
        teacherId: form.teacherId,
        campusId: form.campusId,
      });
      toast.success('班级添加成功');
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      toast.success('班级已删除');
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* 工具栏 */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索班级名称、等级、老师或校区..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={openAdd} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> 添加班级
          </Button>
        </div>
        {/* 校区筛选 */}
        {campuses.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">按校区筛选：</span>
            <Button
              variant={campusFilter === '' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCampusFilter('')}
              className="h-7 px-2.5 text-xs rounded-full"
            >
              全部
            </Button>
            {campuses.map(cp => (
              <Button
                key={cp.id}
                variant={campusFilter === cp.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCampusFilter(campusFilter === cp.id ? '' : cp.id)}
                className="h-7 px-2.5 text-xs rounded-full"
              >
                {cp.name}
              </Button>
            ))}
            <Button
              variant={campusFilter === '__none__' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCampusFilter(campusFilter === '__none__' ? '' : '__none__')}
              className="h-7 px-2.5 text-xs rounded-full"
            >
              未分配
            </Button>
          </div>
        )}
      </div>

      {/* 表格 */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>班级名称</TableHead>
                <TableHead>所属校区</TableHead>
                <TableHead>班级等级</TableHead>
                <TableHead>上课时长</TableHead>
                <TableHead>任课老师</TableHead>
                <TableHead className="text-center">学生人数</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                    <School className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    {search || campusFilter ? '未找到匹配的班级' : '暂无班级数据，点击「添加班级」开始'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((cls, idx) => (
                  <TableRow key={cls.id} className="table-row-hover">
                    <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{cls.name}</TableCell>
                    <TableCell>
                      {cls.campusId ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border border-slate-200 bg-slate-50 text-slate-600">
                          <MapPin className="w-3 h-3" />
                          {getCampusName(cls.campusId)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">未分配</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border', CLASS_LEVELS[cls.level].color)}>
                        {CLASS_LEVELS[cls.level].label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border', CLASS_DURATIONS[cls.duration].color)}>
                        {CLASS_DURATIONS[cls.duration].label}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{getTeacherName(cls.teacherId)}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-sm font-medium">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        {getStudentCount(cls.id)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDetailClass(cls)} className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" title="查看班级">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(cls)} className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="编辑班级">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(cls.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10" title="删除班级">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="text-sm text-muted-foreground">
        共 {filtered.length} 个班级
      </div>

      {/* 添加/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑班级' : '添加班级'}</DialogTitle>
            <DialogDescription>
              {editingId ? '修改班级信息' : '设置班级名称、所属校区、等级、上课时长和任课老师'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="c-name">班级名称 <span className="text-destructive">*</span></Label>
              <Input
                id="c-name"
                placeholder="请输入班级名称"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>所属校区</Label>
              <Select value={form.campusId || 'none'} onValueChange={(v) => setForm({ ...form, campusId: v === 'none' ? '' : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择所属校区（可选）" />
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
            <div className="space-y-2">
              <Label>班级等级 <span className="text-destructive">*</span></Label>
              <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v as ClassLevel })}>
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
              <Label>上课时长 <span className="text-destructive">*</span></Label>
              <Select value={form.duration} onValueChange={(v) => setForm({ ...form, duration: v as ClassDuration })}>
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
              <Label>任课老师</Label>
              <Select value={form.teacherId || 'none'} onValueChange={(v) => setForm({ ...form, teacherId: v === 'none' ? '' : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择任课老师（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不分配老师</SelectItem>
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}（{TEACHER_LEVEL_LABEL(t.level)}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button type="submit">{editingId ? '保存修改' : '确认添加'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除该班级？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后不可恢复。该班级中的学生将被移出班级（学生信息保留）。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 班级详情 */}
      <ClassDetailDialog
        open={detailClass !== null}
        onOpenChange={(open) => !open && setDetailClass(null)}
        cls={detailClass}
        teacher={detailClass ? teachers.find(t => t.id === detailClass.teacherId) || null : null}
        campus={detailClass ? campuses.find(cp => cp.id === detailClass.campusId) || null : null}
        campuses={campuses}
        students={detailClass ? students.filter(s => s.classId === detailClass.id) : []}
        onUpdate={onUpdate}
      />
    </div>
  );
}

function TEACHER_LEVEL_LABEL(level: string) {
  return level === 'A' ? 'A级' : level === 'B' ? 'B级' : 'C级';
}
