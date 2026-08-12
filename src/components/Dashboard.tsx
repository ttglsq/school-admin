import { useState, useEffect } from 'react';
import { GraduationCap, Users, School, LayoutDashboard, LogOut, Menu, Building2, KeyRound, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import TeacherManagement from './TeacherManagement';
import ClassManagement from './ClassManagement';
import StudentManagement from './StudentManagement';
import CampusManagement from './CampusManagement';
import AccountManagement from './AccountManagement';
import AccountSettingsDialog from './AccountSettingsDialog';
import type { Teacher, ClassInfo, Student, Campus, Account, PermissionId } from '@/types';
import { TEACHER_LEVELS, CLASS_LEVELS, ROLE_LABELS } from '@/types';

export type PageId = 'overview' | 'campuses' | 'teachers' | 'classes' | 'students' | 'accounts';

interface DashboardProps {
  teachers: Teacher[];
  classes: ClassInfo[];
  students: Student[];
  campuses: Campus[];
  accounts: Account[];
  currentUser: Account;
  onLogout: () => void;
  // 账号操作
  onAddAccount: (data: { username: string; password: string; permissions: PermissionId[] }) => void;
  onUpdateAccount: (id: string, data: Partial<Omit<Account, 'id' | 'createdAt' | 'role'>>) => void;
  onDeleteAccount: (id: string) => void;
  onUpdateOwnAccount: (username: string, password: string) => void;
  isUsernameTaken: (username: string, excludeId?: string) => boolean;
  // 老师操作
  onAddTeacher: (data: Omit<Teacher, 'id' | 'createdAt'>) => void;
  onUpdateTeacher: (id: string, data: Partial<Omit<Teacher, 'id' | 'createdAt'>>) => void;
  onDeleteTeacher: (id: string) => void;
  // 班级操作
  onAddClass: (data: Omit<ClassInfo, 'id' | 'createdAt'>) => void;
  onUpdateClass: (id: string, data: Partial<Omit<ClassInfo, 'id' | 'createdAt'>>) => void;
  onDeleteClass: (id: string) => void;
  // 学生操作
  onAddStudent: (data: Omit<Student, 'id' | 'createdAt'>) => void;
  onUpdateStudent: (id: string, data: Partial<Omit<Student, 'id' | 'createdAt'>>) => void;
  onDeleteStudent: (id: string) => void;
  // 校区操作
  onAddCampus: (data: Omit<Campus, 'id' | 'createdAt'>) => void;
  onUpdateCampus: (id: string, data: Partial<Omit<Campus, 'id' | 'createdAt'>>) => void;
  onDeleteCampus: (id: string) => void;
}

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: '首页概览', icon: LayoutDashboard },
  { id: 'campuses', label: '校区管理', icon: Building2 },
  { id: 'teachers', label: '老师管理', icon: GraduationCap },
  { id: 'classes', label: '班级管理', icon: School },
  { id: 'students', label: '学生管理', icon: Users },
  { id: 'accounts', label: '账号管理', icon: UserCog },
];

export default function Dashboard(props: DashboardProps) {
  const [currentPage, setCurrentPage] = useState<PageId>('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const isAdmin = props.currentUser.role === 'admin';

  // 判断是否有某个板块的访问权限
  const canAccess = (page: PageId): boolean => {
    if (page === 'accounts') return isAdmin;
    if (isAdmin) return true;
    return props.currentUser.permissions.includes(page as PermissionId);
  };

  const navItems = ALL_NAV_ITEMS.filter(item => canAccess(item.id));

  // 当前页无权限时（如权限被调整），跳转到第一个可访问页面
  useEffect(() => {
    if (!canAccess(currentPage)) {
      const first = navItems[0];
      if (first) setCurrentPage(first.id);
      else setCurrentPage('overview');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, props.currentUser.id, props.currentUser.role, props.currentUser.permissions.join(',')]);

  const currentLabel = navItems.find(n => n.id === currentPage)?.label || '';

  const navigate = (page: PageId) => {
    if (!canAccess(page)) return;
    setCurrentPage(page);
    setMobileSidebarOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shrink-0">
          <GraduationCap className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-sidebar-foreground text-base leading-tight">书悦管理系统</div>
          <div className="text-xs text-sidebar-foreground/50">ShuYue Admin</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          onClick={props.onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-red-300 transition-all duration-150"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span>退出登录</span>
        </button>
      </div>
    </div>
  );

  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewPage {...props} onNavigate={navigate} canAccess={canAccess} />;
      case 'accounts':
        return (
          <AccountManagement
            accounts={props.accounts}
            currentUserId={props.currentUser.id}
            onAdd={props.onAddAccount}
            onUpdate={props.onUpdateAccount}
            onDelete={props.onDeleteAccount}
            isUsernameTaken={props.isUsernameTaken}
          />
        );
      case 'campuses':
        return (
          <CampusManagement
            campuses={props.campuses}
            classes={props.classes}
            teachers={props.teachers}
            students={props.students}
            onAdd={props.onAddCampus}
            onUpdate={props.onUpdateCampus}
            onDelete={props.onDeleteCampus}
          />
        );
      case 'teachers':
        return (
          <TeacherManagement
            teachers={props.teachers}
            onAdd={props.onAddTeacher}
            onUpdate={props.onUpdateTeacher}
            onDelete={props.onDeleteTeacher}
          />
        );
      case 'classes':
        return (
          <ClassManagement
            classes={props.classes}
            teachers={props.teachers}
            students={props.students}
            campuses={props.campuses}
            onAdd={props.onAddClass}
            onUpdate={props.onUpdateClass}
            onDelete={props.onDeleteClass}
          />
        );
      case 'students':
        return (
          <StudentManagement
            students={props.students}
            classes={props.classes}
            campuses={props.campuses}
            onAdd={props.onAddStudent}
            onUpdate={props.onUpdateStudent}
            onDelete={props.onDeleteStudent}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground" >
          <SheetTitle className="sr-only">导航菜单</SheetTitle>
          {renderSidebarContent()}
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 shrink-0 border-b bg-card flex items-center justify-between px-4 md:px-6 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu button */}
            <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden shrink-0">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
            </Sheet>
            <h1 className="text-lg md:text-xl font-semibold truncate">{currentLabel}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm text-muted-foreground">{props.currentUser.username}</span>
              <span className="text-xs text-muted-foreground/60">({ROLE_LABELS[props.currentUser.role]})</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAccountOpen(true)}
              title="修改我的账号密码"
              className="text-muted-foreground hover:text-foreground"
            >
              <KeyRound className="w-5 h-5" />
            </Button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {props.currentUser.username.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* 修改我的账号密码 */}
        <AccountSettingsDialog
          open={accountOpen}
          onOpenChange={setAccountOpen}
          account={props.currentUser}
          onUpdate={props.onUpdateOwnAccount}
          isUsernameTaken={props.isUsernameTaken}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

// 概览页面
function OverviewPage(
  props: DashboardProps & { onNavigate: (page: PageId) => void; canAccess: (page: PageId) => boolean }
) {
  const { teachers, classes, students, campuses, onNavigate, canAccess } = props;

  // 统计数据
  const teacherLevelCount = { A: 0, B: 0, C: 0 };
  teachers.forEach(t => teacherLevelCount[t.level]++);

  const classLevelCount = { A: 0, B: 0, C: 0 };
  classes.forEach(c => classLevelCount[c.level]++);

  const unassignedStudents = students.filter(s => !s.classId).length;

  const stats = [
    {
      label: '校区总数',
      value: campuses.length,
      icon: Building2,
      gradient: 'from-slate-500 to-slate-700',
      page: 'campuses' as PageId,
      detail: `含班级 ${classes.filter(c => c.campusId).length} 个`,
    },
    {
      label: '老师总数',
      value: teachers.length,
      icon: GraduationCap,
      gradient: 'from-blue-500 to-blue-600',
      page: 'teachers' as PageId,
      detail: `A: ${teacherLevelCount.A}  B: ${teacherLevelCount.B}  C: ${teacherLevelCount.C}`,
    },
    {
      label: '班级总数',
      value: classes.length,
      icon: School,
      gradient: 'from-purple-500 to-purple-600',
      page: 'classes' as PageId,
      detail: `初级: ${classLevelCount.A}  入门: ${classLevelCount.B}  启蒙: ${classLevelCount.C}`,
    },
    {
      label: '学生总数',
      value: students.length,
      icon: Users,
      gradient: 'from-teal-500 to-teal-600',
      page: 'students' as PageId,
      detail: `未分班: ${unassignedStudents}人`,
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 欢迎卡片 */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 md:p-8 text-white shadow-lg">
        <h2 className="text-2xl font-bold mb-1">欢迎使用书悦管理系统</h2>
        <p className="text-blue-100 text-sm">管理校区、老师、班级和学生信息，支持等级设置、校区分配和分班操作</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const allowed = canAccess(stat.page);
          return (
            <button
              key={stat.label}
              onClick={() => allowed && onNavigate(stat.page)}
              disabled={!allowed}
              className={cn('text-left', !allowed && 'cursor-not-allowed')}
            >
              <Card className={cn(
                'transition-shadow border-border/60',
                allowed ? 'hover:shadow-md cursor-pointer' : 'opacity-60'
              )}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm', stat.gradient)}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mb-2">{stat.label}</div>
                  <div className="text-xs text-muted-foreground/80">{stat.detail}</div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {/* 等级分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-600" />
              老师等级分布
            </h3>
            <div className="space-y-3">
              {(['A', 'B', 'C'] as const).map(level => (
                <div key={level} className="flex items-center gap-3">
                  <span className={cn('text-xs font-medium px-2.5 py-1 rounded-md border', TEACHER_LEVELS[level].color)}>
                    {TEACHER_LEVELS[level].label}
                  </span>
                  <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${teachers.length > 0 ? (teacherLevelCount[level] / teachers.length * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold w-8 text-right">{teacherLevelCount[level]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <School className="w-5 h-5 text-purple-600" />
              班级等级分布
            </h3>
            <div className="space-y-3">
              {(['A', 'B', 'C'] as const).map(level => (
                <div key={level} className="flex items-center gap-3">
                  <span className={cn('text-xs font-medium px-2.5 py-1 rounded-md border', CLASS_LEVELS[level].color)}>
                    {CLASS_LEVELS[level].label}
                  </span>
                  <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-500 transition-all"
                      style={{ width: `${classes.length > 0 ? (classLevelCount[level] / classes.length * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold w-8 text-right">{classLevelCount[level]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-600" />
              校区班级分布
            </h3>
            {campuses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">暂无校区，请在「校区管理」中添加</p>
            ) : (
              <div className="space-y-3">
                {campuses.map(cp => {
                  const count = classes.filter(c => c.campusId === cp.id).length;
                  return (
                    <div key={cp.id} className="flex items-center gap-3">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-600 max-w-[120px] truncate">
                        {cp.name}
                      </span>
                      <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-slate-500 transition-all"
                          style={{ width: `${classes.length > 0 ? (count / classes.length * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 快捷操作 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold mb-4">快捷操作</h3>
          <div className="flex flex-wrap gap-3">
            {canAccess('campuses') && (
              <Button onClick={() => onNavigate('campuses')} variant="outline" className="gap-2">
                <Building2 className="w-4 h-4" /> 管理校区
              </Button>
            )}
            {canAccess('teachers') && (
              <Button onClick={() => onNavigate('teachers')} variant="outline" className="gap-2">
                <GraduationCap className="w-4 h-4" /> 管理老师
              </Button>
            )}
            {canAccess('classes') && (
              <Button onClick={() => onNavigate('classes')} variant="outline" className="gap-2">
                <School className="w-4 h-4" /> 管理班级
              </Button>
            )}
            {canAccess('students') && (
              <Button onClick={() => onNavigate('students')} variant="outline" className="gap-2">
                <Users className="w-4 h-4" /> 管理学生
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
