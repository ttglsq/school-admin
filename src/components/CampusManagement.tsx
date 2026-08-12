import { useState } from 'react';
import { Plus, Pencil, Trash2, MapPin, Building2, School, Eye, Users, GraduationCap, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Campus, ClassInfo, Teacher, Student } from '@/types';
import { CLASS_LEVELS, CLASS_DURATIONS, TEACHER_LEVELS } from '@/types';
import { cn } from '@/lib/utils';

interface CampusManagementProps {
  campuses: Campus[];
  classes: ClassInfo[];
  teachers: Teacher[];
  students: Student[];
  onAdd: (data: Omit<Campus, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, data: Partial<Omit<Campus, 'id' | 'createdAt'>>) => void;
  onDelete: (id: string) => void;
}

const CAMPUS_COLORS = [
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-fuchsia-600',
  'from-teal-500 to-emerald-600',
  'from-orange-500 to-amber-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-sky-600',
];

export default function CampusManagement({ campuses, classes, teachers, students, onAdd, onUpdate, onDelete }: CampusManagementProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewCampus, setViewCampus] = useState<Campus | null>(null);
  const [form, setForm] = useState({ name: '', address: '' });

  const getClassCount = (campusId: string) => classes.filter(c => c.campusId === campusId).length;
  const getCampusClasses = (campusId: string) => classes.filter(c => c.campusId === campusId);
  const getStudentCount = (classId: string) => students.filter(s => s.classId === classId).length;

  const viewClasses = viewCampus ? getCampusClasses(viewCampus.id) : [];

  const openAdd = () => {
    setForm({ name: '', address: '' });
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (campus: Campus) => {
    setForm({ name: campus.name, address: campus.address });
    setEditingId(campus.id);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('请输入校区名称'); return; }

    if (editingId) {
      onUpdate(editingId, { name: form.name.trim(), address: form.address.trim() });
      toast.success('校区信息已更新');
    } else {
      onAdd({ name: form.name.trim(), address: form.address.trim() });
      toast.success('校区添加成功');
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      toast.success('校区已删除，该校区下的班级已解除关联');
      setDeleteId(null);
    }
  };

  const deletingCampus = campuses.find(c => c.id === deleteId);
  const classCount = deletingCampus ? getClassCount(deletingCampus.id) : 0;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* 工具栏 */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          管理学校下属校区，班级可分配到对应校区
        </p>
        <Button onClick={openAdd} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> 添加校区
        </Button>
      </div>

      {/* 校区卡片 */}
      {campuses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <Building2 className="w-12 h-12 mb-3 opacity-30" />
            <p>暂无校区数据，点击「添加校区」创建第一个校区</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campuses.map((campus, idx) => {
            const count = getClassCount(campus.id);
            const gradient = CAMPUS_COLORS[idx % CAMPUS_COLORS.length];
            return (
              <Card key={campus.id} className="hover:shadow-md transition-shadow overflow-hidden">
                <CardContent className="p-0">
                  {/* 顶部横幅 */}
                  <div className={cn('h-1.5 bg-gradient-to-r', gradient)} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm shrink-0', gradient)}>
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(campus)} className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="编辑校区">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(campus.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10" title="删除校区">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="font-semibold text-lg">{campus.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{campus.address || '未填写地址'}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <School className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{count}</span>
                        <span className="text-muted-foreground">个班级</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewCampus(campus)}
                        className="gap-1.5 h-8 text-xs"
                        title="查看该校区下的班级"
                      >
                        <Eye className="w-3.5 h-3.5" /> 查看班级
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 添加/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑校区' : '添加校区'}</DialogTitle>
            <DialogDescription>
              {editingId ? '修改校区信息' : '添加新的校区，如：万象城校区、高新校区'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="cp-name">校区名称 <span className="text-destructive">*</span></Label>
              <Input
                id="cp-name"
                placeholder="请输入校区名称，如：万象城校区"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp-address">校区地址</Label>
              <Input
                id="cp-address"
                placeholder="请输入校区地址（可选）"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button type="submit">{editingId ? '保存修改' : '确认添加'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 查看班级详情 */}
      <Dialog open={viewCampus !== null} onOpenChange={(open) => !open && setViewCampus(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={cn('w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center', CAMPUS_COLORS[campuses.findIndex(c => c.id === viewCampus?.id) % CAMPUS_COLORS.length])}>
                <Building2 className="w-4 h-4 text-white" />
              </span>
              {viewCampus?.name}
            </DialogTitle>
            <DialogDescription>
              {viewCampus
                ? `该校区下共 ${viewClasses.length} 个班级${viewCampus.address ? ` · ${viewCampus.address}` : ''}`
                : '查看校区班级'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            {viewClasses.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <School className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">该校区下暂无班级</p>
                <p className="text-xs mt-1 opacity-80">可前往「班级管理」将班级分配到该校区</p>
              </div>
            ) : (
              viewClasses.map((cls, idx) => {
                const teacher = teachers.find(t => t.id === cls.teacherId);
                const studentCount = getStudentCount(cls.id);
                return (
                  <div key={cls.id} className="rounded-xl border bg-card p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shrink-0 shadow-sm">
                          {cls.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{cls.name}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', CLASS_LEVELS[cls.level].color)}>
                              {CLASS_LEVELS[cls.level].label}
                            </span>
                            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', CLASS_DURATIONS[cls.duration].color)}>
                              {CLASS_DURATIONS[cls.duration].label}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">#{idx + 1}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <GraduationCap className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{teacher?.name || '未分配'}</span>
                        {teacher && (
                          <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0', TEACHER_LEVELS[teacher.level].color)}>
                            {TEACHER_LEVELS[teacher.level].label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span>{studentCount} 名学生</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span>每课 {CLASS_DURATIONS[cls.duration].shortLabel}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button onClick={() => setViewCampus(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除该校区？</AlertDialogTitle>
            <AlertDialogDescription>
              {classCount > 0
                ? `删除后不可恢复。该校区下共有 ${classCount} 个班级，将被移出该校区（班级信息保留）。`
                : '删除后不可恢复。该校区下暂无班级。'}
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
    </div>
  );
}
