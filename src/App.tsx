import { Toaster } from '@/components/ui/sonner';
import { useStore } from '@/hooks/useStore';
import LoginPage from '@/components/LoginPage';
import Dashboard from '@/components/Dashboard';

export default function App() {
  const store = useStore();

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
          cloudStatus={store.cloudStatus}
        />
      ) : (
        <LoginPage accounts={store.accounts} onLogin={store.login} />
      )}
      <Toaster richColors position="top-center" />
    </>
  );
}
