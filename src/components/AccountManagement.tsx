import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, KeyRound, UserCog, ShieldCheck, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
import type { Account, PermissionId } from '@/types';
import { PERMISSION_MODULES, ROLE_LABELS, ALL_PERMISSIONS } from '@/types';
import { cn } from '@/lib/utils';

interface AccountManagementProps {
  accounts: Account[];
  /** 当前登录账号（管理员本人，用于禁止删除自己） */
  currentUserId: string;
  onAdd: (data: { username: string; password: string; permissions: PermissionId[] }) => void;
  onUpdate: (id: string, data: Partial<Omit<Account, 'id' | 'createdAt' | 'role'>>) => void;
  onDelete: (id: string) => void;
  isUsernameTaken: (username: string, excludeId?: string) => boolean;
}

// 权限徽章颜色
const PERM_COLORS: Record<PermissionId, string> = {
  overview: 'bg-blue-100 text-blue-700 border-blue-200',
  campuses: 'bg-slate-100 text-slate-700 border-slate-200',
  teachers: 'bg-amber-100 text-amber-700 border-amber-200',
  classes: 'bg-purple-100 text-purple-700 border-purple-200',
  students: 'bg-teal-100 text-teal-700 border-teal-200',
  salary: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  performance: 'bg-rose-100 text-rose-700 border-rose-200',
};

export default function AccountManagement({ accounts, currentUserId, onAdd, onUpdate, onDelete, isUsernameTaken }: AccountManagementProps) {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [resetAccount, setResetAccount] = useState<Account | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<Account | null>(null);
  const [form, setForm] = useState({ username: '', password: '', permissions: [...ALL_PERMISSIONS] as PermissionId[] });
  const [resetPassword, setResetPassword] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(a =>
      a.username.toLowerCase().includes(q) ||
      ROLE_LABELS[a.role].toLowerCase().includes(q)
    );
  }, [accounts, search]);

  const openAdd = () => {
    setForm({ username: '', password: '', permissions: [...ALL_PERMISSIONS] });
    setEditingAccount(null);
    setDialogOpen(true);
  };

  const openEdit = (acc: Account) => {
    setForm({ username: acc.username, password: '', permissions: [...acc.permissions] });
    setEditingAccount(acc);
    setDialogOpen(true);
  };

  const togglePermission = (perm: PermissionId) => {
    setForm(prev => {
      const has = prev.permissions.includes(perm);
      return {
        ...prev,
        permissions: has ? prev.permissions.filter(p => p !== perm) : [...prev.permissions, perm],
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim()) { toast.error('请输入用户名'); return; }
    if (isUsernameTaken(form.username.trim(), editingAccount?.id)) { toast.error('该用户名已被使用'); return; }

    if (editingAccount) {
      onUpdate(editingAccount.id, { username: form.username.trim(), permissions: form.permissions });
      toast.success('账号权限已更新');
    } else {
      if (!form.password) { toast.error('请输入初始密码'); return; }
      if (form.password.length < 6) { toast.error('密码至少 6 位'); return; }
      if (form.permissions.length === 0) { toast.error('请至少勾选一个可访问板块'); return; }
      onAdd({ username: form.username.trim(), password: form.password, permissions: form.permissions });
      toast.success('子账号创建成功');
    }
    setDialogOpen(false);
  };

  const handleResetPassword = () => {
    if (!resetAccount) return;
    if (!resetPassword) { toast.error('请输入新密码'); return; }
    if (resetPassword.length < 6) { toast.error('密码至少 6 位'); return; }
    onUpdate(resetAccount.id, { password: resetPassword });
    toast.success(`已重置「${resetAccount.username}」的密码`);
    setResetAccount(null);
    setResetPassword('');
  };

  const handleDelete = () => {
    if (!deleteAccount) return;
    onDelete(deleteAccount.id);
    toast.success(`已删除子账号「${deleteAccount.username}」`);
    setDeleteAccount(null);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return '-';
    }
  };

  const isSelf = (acc: Account) => acc.id === currentUserId;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* 说明卡片 */}
      <Card className="border-blue-200 bg-blue-50/60">
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-900/80 space-y-0.5">
            <p className="font-medium text-blue-900">账号权限管理</p>
            <p>管理员（admin）拥有全部板块权限，可创建子账号并为其分配可访问的页面板块；子账号登录后仅能看到被授权的板块。</p>
          </div>
        </CardContent>
      </Card>

      {/* 工具栏 */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索用户名..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openAdd} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> 添加子账号
        </Button>
      </div>

      {/* 账号表格 */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>用户名</TableHead>
                <TableHead>角色</TableHead>
                <TableHead className="min-w-[220px]">可访问板块</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                    <UserCog className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    {search ? '未找到匹配的账号' : '暂无账号数据'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((acc, idx) => (
                  <TableRow key={acc.id} className="table-row-hover">
                    <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{acc.username}</span>
                        {isSelf(acc) && (
                          <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">当前登录</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={acc.role === 'admin' ? 'default' : 'secondary'}>
                        {ROLE_LABELS[acc.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {acc.role === 'admin' ? (
                          <span className="text-xs text-muted-foreground">全部板块</span>
                        ) : acc.permissions.length === 0 ? (
                          <span className="text-xs text-destructive">未分配权限</span>
                        ) : (
                          acc.permissions.map(p => (
                            <span key={p} className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border', PERM_COLORS[p])}>
                              {PERMISSION_MODULES.find(m => m.id === p)?.label}
                            </span>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(acc.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {acc.role === 'admin' ? (
                          <span className="text-xs text-muted-foreground px-2">管理员账号</span>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(acc)} className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="编辑权限">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setResetAccount(acc); setResetPassword(''); }} className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50" title="重置密码">
                              <KeyRound className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteAccount(acc)}
                              disabled={isSelf(acc)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 disabled:opacity-30"
                              title={isSelf(acc) ? '不能删除当前登录账号' : '删除账号'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
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
        共 {filtered.length} 个账号
      </div>

      {/* 添加/编辑账号对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAccount ? `编辑子账号「${editingAccount.username}」` : '添加子账号'}</DialogTitle>
            <DialogDescription>
              {editingAccount ? '修改用户名，并勾选该账号可访问的页面板块' : '创建子账号并分配其可访问的页面板块权限'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="acc-username">用户名 <span className="text-destructive">*</span></Label>
              <Input
                id="acc-username"
                placeholder="请输入登录用户名"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                autoComplete="off"
              />
            </div>

            {!editingAccount && (
              <div className="space-y-2">
                <Label htmlFor="acc-password">初始密码 <span className="text-destructive">*</span></Label>
                <Input
                  id="acc-password"
                  type="password"
                  placeholder="至少 6 位"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>可访问板块 <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border p-3 bg-muted/30">
                {PERMISSION_MODULES.map(module => (
                  <label
                    key={module.id}
                    className="flex items-center gap-2.5 rounded-md px-2.5 py-2 cursor-pointer hover:bg-accent transition-colors"
                  >
                    <Checkbox
                      checked={form.permissions.includes(module.id)}
                      onCheckedChange={() => togglePermission(module.id)}
                    />
                    <span className="text-sm">{module.label}</span>
                  </label>
                ))}
              </div>
              {form.permissions.length === 0 && !editingAccount && (
                <p className="text-xs text-destructive">请至少勾选一个可访问板块</p>
              )}
              {form.permissions.length === 0 && editingAccount && (
                <p className="text-xs text-destructive">至少保留一个可访问板块，否则该账号登录后将无任何页面可看</p>
              )}
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button type="submit">{editingAccount ? '保存修改' : '创建子账号'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 重置密码对话框 */}
      <Dialog open={resetAccount !== null} onOpenChange={(open) => !open && setResetAccount(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-600" />
              重置密码
            </DialogTitle>
            <DialogDescription>
              为子账号「{resetAccount?.username}」设置新密码
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <Label htmlFor="reset-pwd">新密码 <span className="text-destructive">*</span></Label>
            <Input
              id="reset-pwd"
              type="password"
              placeholder="至少 6 位"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button type="button" variant="outline" onClick={() => setResetAccount(null)}>取消</Button>
            <Button onClick={handleResetPassword}>确认重置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={deleteAccount !== null} onOpenChange={(open) => !open && setDeleteAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除子账号「{deleteAccount?.username}」？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后该账号将无法登录，此操作不可恢复。
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
