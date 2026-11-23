
import { Link, useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import Button from '@/components/common/Button';
import NotificationBell from '@/components/common/NotificationBell';

function Header() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } catch {
      // Локальну сесію все одно завершуємо, навіть якщо сервер недоступний.
    } finally {
      logout();
      navigate('/login');
    }
  };

  return (
    <header className="bg-slate-900 text-white shadow-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link to="/" className="text-xl font-bold">
          Event Management
        </Link>

        <nav className="flex flex-wrap items-center gap-5">
          <Link to="/" className="transition hover:text-primary-500">
            Головна
          </Link>

          <Link to="/about" className="transition hover:text-primary-500">
            Про систему
          </Link>

          {user ? (
            <>
              <Link to="/dashboard" className="transition hover:text-primary-500">
                Панель
              </Link>

              <Link to="/events" className="transition hover:text-primary-500">
                Керування подіями
              </Link>

              <NotificationBell />

              <span className="text-sm text-gray-300">
                {user.name} ({user.role})
              </span>

              <Button variant="danger" onClick={handleLogout}>
                Вийти
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="transition hover:text-primary-500">
                Увійти
              </Link>

              <Link to="/register" className="transition hover:text-primary-500">
                Реєстрація
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;
