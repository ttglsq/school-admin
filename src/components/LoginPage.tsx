import { useState } from 'react';
import { GraduationCap, Lock, User, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AccountInfo } from '@/hooks/useStore';

interface LoginPageProps {
  account: AccountInfo;
  onLogin: () => void;
}

export default function LoginPage({ account, onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isDefaultPassword = account.password === 'admin123';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }

    setLoading(true);
    // 模拟登录验证：与可修改的账号信息比对
    setTimeout(() => {
      if (username === account.username && password === account.password) {
        onLogin();
      } else {
        setError('用户名或密码错误');
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div className="login-gradient min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-3 text-center pt-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <GraduationCap className="w-9 h-9 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">书悦管理系统</CardTitle>
            <CardDescription className="text-base mt-1">书悦教育管理平台</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9 h-11"
                  autoComplete="username"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-9 h-11"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
              {loading ? '登录中...' : '登 录'}
            </Button>

            <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5">
              {isDefaultPassword ? (
                <>
                  当前账号：<span className="font-semibold text-foreground">{account.username}</span>
                  {'　'}默认密码：<span className="font-semibold text-foreground">admin123</span>
                  <span className="block text-xs mt-1">登录后可在右上角修改账号密码</span>
                </>
              ) : (
                <>
                  当前账号：<span className="font-semibold text-foreground">{account.username}</span>
                  <span className="block text-xs mt-1">密码已修改，请使用新密码登录</span>
                </>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
