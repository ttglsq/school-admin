import { Toaster } from '@/components/ui/sonner';
import { useStore } from '@/hooks/useStore';
import LoginPage from '@/components/LoginPage';
import Dashboard from '@/components/Dashboard';

export default function App() {
  const store = useStore();

  return (
    <>
      {store.isLoggedIn ? (
        <Dashboard
          teachers={store.teachers}
          classes={store.classes}
          students={store.students}
          campuses={store.campuses}
          account={store.account}
          onLogout={store.logout}
          onUpdateAccount={store.updateAccount}
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
        />
      ) : (
        <LoginPage account={store.account} onLogin={store.login} />
      )}
      <Toaster richColors position="top-center" />
    </>
  );
}
