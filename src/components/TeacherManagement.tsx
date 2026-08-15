import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Phone, GraduationCap } from 'lucide-react';
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
import type { Teacher, TeacherLevel } from '@/types';
import { TEACHER_LEVELS } from '@/types';
import { cn } from '@/lib/utils';

interface TeacherManagementProps {
  teachers: Teacher[];
  onAdd: (data: Omit<Teacher, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, data: Partial<Omit<Teacher, 'id' | 'createdAt'>>) => void;
  onDelete: (id: string) => void;
}

export default function TeacherManagement({ teachers, onAdd, onUpdate, onDelete }: TeacherManagementProps) {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', level: '' as TeacherLevel | '', idCard: '', joinDate: '' });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.phone.includes(q) ||
      TEACHER_LEVELS[t.level].label.toLowerCase().includes(q)
    );
  }, [teachers, search]);

  const openAdd = () => {
    setForm({ name: '', phone: '', level: '', idCard: '', joinDate: '' });
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (teacher: Teacher) => {
    setForm({ name: teacher.name, phone: teacher.phone, level: teacher.level, idCard: teacher.idCard ?? '', joinDate: teacher.joinDate ?? '' });
    setEditingId(teacher.id);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('请输入老师姓名'); return; }
    if (!form.phone.trim()) { toast.error('请输入联系方式'); return; }
    if (!form.level) { toast.error('请选择老师等级'); return; }

    if (editingId) {
      onUpdate(editingId, { name: form.name.trim(), phone: form.phone.trim(), level: form.level, idCard: form.idCard.trim() || undefined, joinDate: form.joinDate || undefined });
      toast.success('老师信息已更新');
    } else {
      onAdd({ name: form.name.trim(), phone: form.phone.trim(), level: form.level, idCard: form.idCard.trim() || undefined, joinDate: form.joinDate || undefined });
      toast.success('老师添加成功');
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      toast.success('老师已删除');
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
            placeholder="搜索姓名、电话或等级..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openAdd} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> 添加老师
        </Button>
      </div>

      {/* 表格 */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>联系方式</TableHead>
                <TableHead>老师等级</TableHead>
                <TableHead>入职时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                    <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    {search ? '未找到匹配的老师' : '暂无老师数据，点击「添加老师」开始'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((teacher, idx) => (
                  <TableRow key={teacher.id} className="table-row-hover">
                    <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{teacher.name}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                        {teacher.phone}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border', TEACHER_LEVELS[teacher.level].color)}>
                        {TEACHER_LEVELS[teacher.level].label}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums text-sm">
                      {teacher.joinDate || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(teacher)} className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(teacher.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
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
        共 {filtered.length} 位老师
      </div>

      {/* 添加/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑老师' : '添加老师'}</DialogTitle>
            <DialogDescription>
              {editingId ? '修改老师信息' : '填写老师的姓名、联系方式和等级'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="t-name">姓名 <span className="text-destructive">*</span></Label>
              <Input
                id="t-name"
                placeholder="请输入老师姓名"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-phone">联系方式 <span className="text-destructive">*</span></Label>
              <Input
                id="t-phone"
                placeholder="请输入手机号码"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>老师等级 <span className="text-destructive">*</span></Label>
              <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v as TeacherLevel })}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择等级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">
                    <span className="flex items-center gap-2">
                      <span className={cn('inline-block w-2 h-2 rounded-full', 'bg-red-500')} />
                      A级（高级教师）
                    </span>
                  </SelectItem>
                  <SelectItem value="B">
                    <span className="flex items-center gap-2">
                      <span className={cn('inline-block w-2 h-2 rounded-full', 'bg-amber-500')} />
                      B级（中级教师）
                    </span>
                  </SelectItem>
                  <SelectItem value="C">
                    <span className="flex items-center gap-2">
                      <span className={cn('inline-block w-2 h-2 rounded-full', 'bg-green-500')} />
                      C级（初级教师）
                    </span>
                  </SelectItem>
                  <SelectItem value="D">
                    <span className="flex items-center gap-2">
                      <span className={cn('inline-block w-2 h-2 rounded-full', 'bg-slate-500')} />
                      D级（兼职教师）
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="t-idcard">身份证号</Label>
                <Input
                  id="t-idcard"
                  placeholder="请输入身份证号"
                  value={form.idCard}
                  onChange={(e) => setForm({ ...form, idCard: e.target.value })}
                  maxLength={18}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-joindate">入职时间</Label>
                <Input
                  id="t-joindate"
                  type="date"
                  value={form.joinDate}
                  onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
                />
              </div>
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
            <AlertDialogTitle>确认删除该老师？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后不可恢复。如果该老师已关联班级，班级的任课老师将被清空。
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
