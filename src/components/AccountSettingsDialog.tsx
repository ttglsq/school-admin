import { useState, useEffect } from 'react';
import { KeyRound, User, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { Account } from '@/types';

interface AccountSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 当前登录账号 */
  account: Account;
  onUpdate: (username: string, password: string) => void;
  /** 判断用户名是否已被其他账号占用 */
  isUsernameTaken: (username: string, excludeId?: string) => boolean;
}

export default function AccountSettingsDialog({ open, onOpenChange, account, onUpdate, isUsernameTaken }: AccountSettingsDialogProps) {
  const [username, setUsername] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // 每次打开时重置表单并同步当前账号名
  useEffect(() => {
    if (open) {
      setUsername(account.username);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open, account]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { toast.error('请输入账号名'); return; }
    if (isUsernameTaken(username.trim(), account.id)) { toast.error('该账号名已被使用'); return; }
    if (!oldPassword) { toast.error('请输入当前密码'); return; }
    if (oldPassword !== account.password) { toast.error('当前密码不正确'); return; }
    if (!newPassword) { toast.error('请输入新密码'); return; }
    if (newPassword.length < 6) { toast.error('新密码至少 6 位'); return; }
    if (newPassword === oldPassword) { toast.error('新密码不能与当前密码相同'); return; }
    if (newPassword !== confirmPassword) { toast.error('两次输入的新密码不一致'); return; }

    onUpdate(username.trim(), newPassword);
    toast.success('账号信息已更新，下次登录请使用新账号密码');
    onOpenChange(false);
  };

  const passwordInput = (
    value: string,
    setValue: (v: string) => void,
    show: boolean,
    setShow: (v: boolean) => void,
    placeholder: string,
    autoComplete: string
  ) => (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-9 pr-9"
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-blue-600" />
            修改我的账号密码
          </DialogTitle>
          <DialogDescription>修改当前账号的登录名和密码，修改后下次登录请使用新信息</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="acc-username">账号名</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="acc-username"
                placeholder="请输入账号名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-9"
                autoComplete="username"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="acc-old">当前密码</Label>
            {passwordInput(oldPassword, setOldPassword, showOld, setShowOld, '请输入当前密码', 'current-password')}
          </div>

          <div className="space-y-2">
            <Label htmlFor="acc-new">新密码 <span className="text-xs text-muted-foreground">（至少 6 位）</span></Label>
            {passwordInput(newPassword, setNewPassword, showNew, setShowNew, '请输入新密码', 'new-password')}
          </div>

          <div className="space-y-2">
            <Label htmlFor="acc-confirm">确认新密码</Label>
            {passwordInput(confirmPassword, setConfirmPassword, showConfirm, setShowConfirm, '再次输入新密码', 'new-password')}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">保存修改</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
