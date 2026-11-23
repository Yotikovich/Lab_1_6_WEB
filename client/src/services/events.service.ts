import api from './api';

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
export interface EventItem {
  id: number; title: string; description?: string | null; status: EventStatus;
  startsAt: string; endsAt: string; capacity?: number | null; venueId?: number | null;
  venue?: Venue | null; _count?: { registrations: number; schedules: number; ticketTypes: number };
}
export interface Venue { id: number; name: string; address: string; city: string; capacity?: number | null; description?: string | null; _count?: { events: number } }
export interface Participant { id: number; name: string; email: string; phone?: string | null; _count?: { registrations: number } }
export interface TicketType { id: number; name: string; description?: string | null; price: string; quantity: number }
export interface ScheduleItem { id: number; title: string; description?: string | null; startsAt: string; endsAt: string; speaker?: string | null; location?: string | null }
export interface Registration { id: number; status: string; registeredAt: string; participant: Participant; event: Pick<EventItem, 'id' | 'title' | 'startsAt'>; tickets: { id: number; code: string; status: string; ticketType: TicketType }[] }
const eventsService = {
  getAll: async (search = '') => (await api.get<{ data: EventItem[]; pagination: { total: number } }>('/events', { params: { search, limit: 100 } })).data,
  getOne: async (id: number) => (await api.get<EventItem>(`/events/${id}`)).data,
  create: async (data: Record<string, unknown>) => (await api.post<EventItem>('/events', data)).data,
  update: async (id: number, data: Record<string, unknown>) => (await api.put<EventItem>(`/events/${id}`, data)).data,
  remove: async (id: number) => api.delete(`/events/${id}`),
  getVenues: async () => (await api.get<Venue[]>('/events/venues')).data,
  createVenue: async (data: Record<string, unknown>) => (await api.post<Venue>('/events/venues', data)).data,
  updateVenue: async (id: number, data: Record<string, unknown>) => (await api.put<Venue>(`/events/venues/${id}`, data)).data,
  removeVenue: async (id: number) => api.delete(`/events/venues/${id}`),
  getParticipants: async () => (await api.get<Participant[]>('/events/participants')).data,
  createParticipant: async (data: Record<string, unknown>) => (await api.post<Participant>('/events/participants', data)).data,
  updateParticipant: async (id: number, data: Record<string, unknown>) => (await api.put<Participant>(`/events/participants/${id}`, data)).data,
  removeParticipant: async (id: number) => api.delete(`/events/participants/${id}`),
  getRegistrations: async () => (await api.get<Registration[]>('/events/registrations')).data,
  cancelRegistration: async (id: number) => api.patch(`/events/registrations/${id}/cancel`),
  checkInTicket: async (id: number) => (await api.patch(`/events/tickets/${id}/check-in`)).data,
  getTickets: async (eventId: number) => (await api.get<TicketType[]>(`/events/${eventId}/ticket-types`)).data,
  createTicket: async (eventId: number, data: Record<string, unknown>) => (await api.post<TicketType>(`/events/${eventId}/ticket-types`, data)).data,
  updateTicket: async (eventId: number, ticketId: number, data: Record<string, unknown>) => (await api.put<TicketType>(`/events/${eventId}/ticket-types/${ticketId}`, data)).data,
  removeTicket: async (eventId: number, ticketId: number) => api.delete(`/events/${eventId}/ticket-types/${ticketId}`),
  getSchedule: async (eventId: number) => (await api.get<ScheduleItem[]>(`/events/${eventId}/schedule`)).data,
  createSchedule: async (eventId: number, data: Record<string, unknown>) => (await api.post<ScheduleItem>(`/events/${eventId}/schedule`, data)).data,
  updateSchedule: async (eventId: number, itemId: number, data: Record<string, unknown>) => (await api.put<ScheduleItem>(`/events/${eventId}/schedule/${itemId}`, data)).data,
  removeSchedule: async (eventId: number, itemId: number) => api.delete(`/events/${eventId}/schedule/${itemId}`),
  register: async (eventId: number, participantId: number, ticketTypeId: number) => (await api.post(`/events/${eventId}/registrations`, { participantId, ticketTypeId })).data,
};
export default eventsService;
