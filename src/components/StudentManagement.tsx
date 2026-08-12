import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Phone, Users, UserCircle, MapPin } from 'lucide-react';
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
import type { Student, ClassInfo, Campus } from '@/types';
import { CLASS_LEVELS, CLASS_DURATIONS } from '@/types';
import { cn } from '@/lib/utils';

interface StudentManagementProps {
  students: Student[];
  classes: ClassInfo[];
  campuses: Campus[];
  onAdd: (data: Omit<Student, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, data: Partial<Omit<Student, 'id' | 'createdAt'>>) => void;
  onDelete: (id: string) => void;
}

export default function StudentManagement({ students, classes, campuses, onAdd, onUpdate, onDelete }: StudentManagementProps) {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', contact: '', classId: '' });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.contact.includes(q) ||
      (classes.find(c => c.id === s.classId)?.name.toLowerCase().includes(q) ?? false)
    );
  }, [students, classes, search]);

  const getClassName = (classId: string) => {
    if (!classId) return null;
    const cls = classes.find(c => c.id === classId);
    return cls || null;
  };

  const getCampusName = (classId: string) => {
    const cls = classes.find(c => c.id === classId);
    if (!cls || !cls.campusId) return '';
    return campuses.find(cp => cp.id === cls.campusId)?.name || '';
  };

  const openAdd = () => {
    setForm({ name: '', contact: '', classId: '' });
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (student: Student) => {
    setForm({ name: student.name, contact: student.contact, classId: student.classId });
    setEditingId(student.id);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('请输入学生姓名'); return; }
    if (!form.contact.trim()) { toast.error('请输入联系方式'); return; }

    if (editingId) {
      onUpdate(editingId, {
        name: form.name.trim(),
        contact: form.contact.trim(),
        classId: form.classId,
      });
      toast.success('学生信息已更新');
    } else {
      onAdd({
        name: form.name.trim(),
        contact: form.contact.trim(),
        classId: form.classId,
      });
      toast.success('学生添加成功');
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      toast.success('学生已删除');
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* 工具栏 */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索姓名、联系方式或班级..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openAdd} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> 添加学生
        </Button>
      </div>

      {/* 表格 */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>学生姓名</TableHead>
                <TableHead>联系方式</TableHead>
                <TableHead>所在班级</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    {search ? '未找到匹配的学生' : '暂无学生数据，点击「添加学生」开始'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((student, idx) => {
                  const cls = getClassName(student.classId);
                  return (
                    <TableRow key={student.id} className="table-row-hover">
                      <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                            {student.name.charAt(0)}
                          </div>
                          <span className="font-medium">{student.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="w-3.5 h-3.5" />
                          {student.contact}
                        </span>
                      </TableCell>
                      <TableCell>
                        {cls ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{cls.name}</span>
                            {getCampusName(cls.id) && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border border-slate-200 bg-slate-50 text-slate-600">
                                <MapPin className="w-3 h-3" />
                                {getCampusName(cls.id)}
                              </span>
                            )}
                            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', CLASS_LEVELS[cls.level].color)}>
                              {CLASS_LEVELS[cls.level].shortLabel}
                            </span>
                            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', CLASS_DURATIONS[cls.duration].color)}>
                              {CLASS_DURATIONS[cls.duration].shortLabel}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            <UserCircle className="w-3.5 h-3.5" />
                            未分班
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(student)} className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(student.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="text-sm text-muted-foreground">
        共 {filtered.length} 名学生
        {students.filter(s => !s.classId).length > 0 && (
          <span className="ml-2 text-amber-600">
            （{students.filter(s => !s.classId).length}人未分班）
          </span>
        )}
      </div>

      {/* 添加/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑学生' : '添加学生'}</DialogTitle>
            <DialogDescription>
              {editingId ? '修改学生信息' : '填写学生姓名、联系方式并分配班级'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="s-name">学生姓名 <span className="text-destructive">*</span></Label>
              <Input
                id="s-name"
                placeholder="请输入学生姓名"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-contact">联系方式 <span className="text-destructive">*</span></Label>
              <Input
                id="s-contact"
                placeholder="请输入手机号码"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>分配班级</Label>
              <Select value={form.classId || 'none'} onValueChange={(v) => setForm({ ...form, classId: v === 'none' ? '' : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择班级（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不分配班级</SelectItem>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.campusId && campuses.find(cp => cp.id === c.campusId)
                        ? `（${campuses.find(cp => cp.id === c.campusId)!.name} · ${CLASS_LEVELS[c.level].shortLabel} · ${CLASS_DURATIONS[c.duration].shortLabel}）`
                        : `（${CLASS_LEVELS[c.level].shortLabel} · ${CLASS_DURATIONS[c.duration].shortLabel}）`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {classes.length === 0 && (
                <p className="text-xs text-muted-foreground">暂无班级，请先在「班级管理」中创建班级</p>
              )}
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
            <AlertDialogTitle>确认删除该学生？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后不可恢复，该学生的所有信息将被永久移除。
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
