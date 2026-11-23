
import { Link, useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';

function DashboardPage() {
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
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 to-blue-800 p-8 text-white shadow-lg">
        <p className="text-sm font-medium text-blue-200">
          EVENT MANAGEMENT
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          Панель керування
        </h1>

        <p className="mt-3 text-slate-200">
          Вітаємо, {user?.name || 'користувачу'}!
          Радий бачити тебе в системі.
        </p>

        <div className="mt-5 inline-flex rounded-full bg-white/15 px-4 py-2 text-sm">
          Роль: {user?.role || 'USER'}
        </div>
      </section>

      <section>
        <h2 className="mb-5 text-2xl font-bold text-gray-900">Робочий простір організатора</h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: '📅', title: 'Події', description: 'Створення та керування заходами.', href: '/events', action: 'Керувати подіями' },
            { icon: '📍', title: 'Локації', description: 'Майданчики, адреси та місткість.', href: '/events', action: 'Відкрити локації' },
            { icon: '🎟️', title: 'Учасники та квитки', description: 'Реєстрації, учасники й квитки.', href: '/events', action: 'Керувати реєстраціями' },
          ].map((item) => <Card key={item.title}><div className="text-4xl">{item.icon}</div><h3 className="mt-3 text-xl font-semibold">{item.title}</h3><p className="my-3 text-gray-600">{item.description}</p><Link to={item.href}><Button>{item.action}</Button></Link></Card>)}
        </div>
      </section>

      <div className="flex justify-end border-t border-gray-200 pt-5">
        <Button variant="danger" onClick={handleLogout}>
          Вийти з акаунта
        </Button>
      </div>
    </div>
  );
}

export default DashboardPage;
