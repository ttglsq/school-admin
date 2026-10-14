import { useEffect } from 'react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { useStore } from '@/hooks/useStore';
import LoginPage from '@/components/LoginPage';
import Dashboard from '@/components/Dashboard';
import { APP_VERSION } from '@/version';
import { appendLocalLog } from '@/lib/opLog';

export default function App() {
  const store = useStore();

  // 全局异常捕获 → 写进操作日志，方便事后排查
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      appendLocalLog({
        actor: '系统', action: 'error', entity: 'system',
        target: '页面脚本异常',
        detail: `${e.message} @ ${String(e.filename).split('/').pop()}:${e.lineno}`,
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string } | undefined;
      appendLocalLog({
        actor: '系统', action: 'error', entity: 'system',
        target: '未处理的异步异常',
        detail: String(r?.message ?? r).slice(0, 300),
      });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  // 自动版本检测：线上有新版本发布时，自动刷新，避免设备长时间停留在旧版本
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json() as { version?: string };
        if (stopped || !j?.version || j.version === APP_VERSION) return;
        const key = 'school_version_reloaded_for';
        if (sessionStorage.getItem(key) === j.version) return; // 防止刷新死循环
        sessionStorage.setItem(key, j.version);
        toast.info('检测到新版本，正在自动刷新…', { duration: 1500 });
        window.setTimeout(() => window.location.reload(), 800);
      } catch { /* 忽略网络错误 */ }
    };
    void check();
    const timer = window.setInterval(() => { void check(); }, 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <>
      {store.isLoggedIn && store.currentUser ? (
        <Dashboard
          teachers={store.teachers}
          classes={store.classes}
          students={store.students}
          campuses={store.campuses}
          accounts={store.accounts}
          currentUser={store.currentUser}
          onLogout={store.logout}
          onAddAccount={store.addAccount}
          onUpdateAccount={store.updateAccount}
          onDeleteAccount={store.deleteAccount}
          onUpdateOwnAccount={store.updateOwnAccount}
          isUsernameTaken={store.isUsernameTaken}
          onAddTeacher={store.addTeacher}
          onUpdateTeacher={store.updateTeacher}
          onDeleteTeacher={store.deleteTeacher}
          onAddClass={store.addClass}
          onUpdateClass={store.updateClass}
          onDeleteClass={store.deleteClass}
          onAddStudent={store.addStudent}
          onUpdateStudent={store.updateStudent}
          onDeleteStudent={store.deleteStudent}
          onAddCampus={store.addCampus}
          onUpdateCampus={store.updateCampus}
          onDeleteCampus={store.deleteCampus}
          salaryStandard={store.salaryStandard}
          onUpdateSalaryStandard={store.updateSalaryStandard}
          onResetSalaryStandard={store.resetSalaryStandard}
          monthlyRecords={store.monthlyRecords}
          onSaveWeeklyRecords={store.saveWeeklyRecords}
          partTimeRecords={store.partTimeRecords}
          onSavePartTimeRecords={store.savePartTimeRecords}
          cloudStatus={store.cloudStatus}
          cloudLoaded={store.cloudLoaded}
          pendingCount={store.pendingCount}
        />
      ) : (
        <LoginPage accounts={store.accounts} onLogin={store.login} />
      )}
      <Toaster richColors position="top-center" />
    </>
  );
}
