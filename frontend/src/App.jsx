import { Navigate, Outlet, Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './routes/LoginPage';
import SignupPage from './routes/SignupPage';
import DashboardPage from './routes/DashboardPage';
import TrainingsPage from './routes/TrainingsPage';
import TrainingDetailPage from './routes/TrainingDetailPage';
import ReportsPage from './routes/ReportsPage';
import UsersPage from './routes/UsersPage';

function Layout() {
  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/trainings" element={<TrainingsPage />} />
          <Route path="/trainings/:id" element={<TrainingDetailPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
