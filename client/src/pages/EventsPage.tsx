import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import eventsService from '@/services/events.service';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';

function EventsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [capacity, setCapacity] = useState('');
  const [search, setSearch] = useState('');
  const { data, isLoading, isError } = useQuery({ queryKey: ['events', search], queryFn: () => eventsService.getAll(search) });
  const create = useMutation({ mutationFn: eventsService.create, onSuccess: () => { toast.success('Подію створено'); setShowForm(false); setTitle(''); setDescription(''); setStartsAt(''); setEndsAt(''); setCapacity(''); qc.invalidateQueries({ queryKey: ['events'] }); }, onError: () => toast.error('Не вдалося створити подію') });
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!title.trim() || !startsAt || !endsAt) return toast.error('Заповніть назву та дати події'); create.mutate({ title, description, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), ...(capacity ? { capacity: Number(capacity) } : {}) }); };
  const fmt = (v: string) => new Date(v).toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' });
  const statusLabel: Record<string, string> = { DRAFT: 'Чернетка', PUBLISHED: 'Опубліковано', CANCELLED: 'Скасовано', COMPLETED: 'Завершено' };
  return <div className="space-y-6 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Event Management</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Події</h1><p className="mt-1 text-slate-600">Створення та керування подіями</p></div><Button onClick={() => setShowForm(v => !v)}>{showForm ? 'Закрити' : '+ Створити подію'}</Button></div>
    {showForm && <form onSubmit={submit} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2"><div className="md:col-span-2"><label className="mb-1 block text-sm font-medium">Назва події</label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Наприклад, IT-конференція 2026" /></div><div className="md:col-span-2"><label className="mb-1 block text-sm font-medium">Опис</label><textarea className="w-full rounded-lg border border-slate-300 p-3" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Короткий опис події" /></div><div><label className="mb-1 block text-sm font-medium">Початок</label><input required type="datetime-local" className="w-full rounded-lg border border-slate-300 p-3" value={startsAt} onChange={e => setStartsAt(e.target.value)} /></div><div><label className="mb-1 block text-sm font-medium">Завершення</label><input required type="datetime-local" className="w-full rounded-lg border border-slate-300 p-3" value={endsAt} onChange={e => setEndsAt(e.target.value)} /></div><div><label className="mb-1 block text-sm font-medium">Місткість (необов'язково)</label><Input inputMode="numeric" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="100" /></div><div className="flex items-end"><Button type="submit" disabled={create.isPending}>{create.isPending ? 'Збереження...' : 'Зберегти подію'}</Button></div></form>}
    <Input placeholder="Пошук подій за назвою..." value={search} onChange={e => setSearch(e.target.value)} />
    {isLoading && <p className="text-slate-500">Завантаження подій...</p>}{isError && <p className="text-red-600">Не вдалося завантажити події. Перевірте підключення до сервера.</p>}
    {data && data.data.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center"><div className="text-4xl">📅</div><h2 className="mt-3 text-lg font-semibold">Подій поки немає</h2><p className="mt-1 text-slate-500">Створіть першу подію, щоб вона з'явилася тут.</p></div>}
    <div className="grid gap-4 md:grid-cols-2">{data?.data.map(event => <article key={event.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><h2 className="text-xl font-semibold text-slate-900">{event.title}</h2><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{statusLabel[event.status] ?? event.status}</span></div>{event.description && <p className="mt-2 text-sm text-slate-600">{event.description}</p>}<div className="mt-4 space-y-2 text-sm text-slate-600"><p>🕒 {fmt(event.startsAt)} — {fmt(event.endsAt)}</p><p>📍 {event.venue ? `${event.venue.name}, ${event.venue.city}` : 'Локацію не вказано'}</p><p>👥 Реєстрацій: {event._count?.registrations ?? 0}{event.capacity ? ` / ${event.capacity}` : ''}</p></div></article>)}</div>
  </div>;
}
export default EventsPage;
