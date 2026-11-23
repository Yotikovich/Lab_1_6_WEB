import prisma from "../lib/prisma.js";
import { z } from "zod";

const eventFields = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"]).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  venueId: z.number().int().positive().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});
const eventInput = eventFields.refine((v) => v.endsAt > v.startsAt, { message: "Дата завершення має бути пізніше дати початку", path: ["endsAt"] });
const venueInput = z.object({ name: z.string().trim().min(2).max(160), address: z.string().trim().min(3).max(300), city: z.string().trim().min(2).max(100), capacity: z.number().int().positive().optional().nullable(), description: z.string().max(2000).optional().nullable() });
const participantInput = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().transform(v => v.toLowerCase()), phone: z.string().max(40).optional().nullable() });
const scheduleInput = z.object({ title: z.string().trim().min(2).max(160), description: z.string().max(2000).optional().nullable(), startsAt: z.coerce.date(), endsAt: z.coerce.date(), speaker: z.string().max(120).optional().nullable(), location: z.string().max(160).optional().nullable() }).refine(v => v.endsAt > v.startsAt, { message: "Час завершення має бути пізніше початку" });
const ticketTypeInput = z.object({ name: z.string().trim().min(2).max(100), description: z.string().max(1000).optional().nullable(), price: z.coerce.number().min(0), quantity: z.number().int().positive() });
const idOf = (value) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const isAdmin = (req) => req.user.role === "ADMIN";
const eventWhere = (req) => isAdmin(req) ? {} : { organizerId: Number(req.user.id) };

export async function listEvents(req, res, next) {
  try {
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1)), limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 10)));
    const where = { ...eventWhere(req) };
    if (typeof req.query.search === "string" && req.query.search.trim()) where.title = { contains: req.query.search.trim(), mode: "insensitive" };
    if (req.query.status) {
      if (!["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"].includes(req.query.status)) {
        return res.status(400).json({ error: "Некоректний статус події" });
      }
      where.status = req.query.status;
    }
    const [data, total] = await prisma.$transaction([
      prisma.event.findMany({ where, include: { venue: true, _count: { select: { registrations: true, schedules: true, ticketTypes: true } } }, orderBy: { startsAt: "asc" }, skip: (page - 1) * limit, take: limit }),
      prisma.event.count({ where }),
    ]);
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) { next(e); }
}
export async function getEvent(req, res, next) {
  try {
    const id = idOf(req.params.id); if (!id) return res.status(400).json({ error: "Некоректний ID події" });
    const event = await prisma.event.findFirst({ where: { id, ...eventWhere(req) }, include: { venue: true, schedules: { orderBy: { startsAt: "asc" } }, ticketTypes: true, _count: { select: { registrations: true } } } });
    if (!event) return res.status(404).json({ error: "Подію не знайдено" });
    res.json(event);
  } catch (e) { next(e); }
}
export async function createEvent(req, res, next) {
  try {
    const parsed = eventInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "Помилка валідації", details: parsed.error.issues });
    if (parsed.data.venueId) {
      const venue = await prisma.venue.findUnique({ where: { id: parsed.data.venueId } });
      if (!venue) return res.status(404).json({ error: "Локацію не знайдено" });
      if (venue.capacity && parsed.data.capacity && parsed.data.capacity > venue.capacity) return res.status(400).json({ error: "Місткість події не може перевищувати місткість локації" });
    }
    const event = await prisma.event.create({ data: { ...parsed.data, organizerId: Number(req.user.id) }, include: { venue: true } });
    req.app.get("io")?.emit("events:changed", { action: "created", eventId: event.id });
    res.status(201).json(event);
  } catch (e) { next(e); }
}
export async function updateEvent(req, res, next) {
  try {
    const id = idOf(req.params.id); if (!id) return res.status(400).json({ error: "Некоректний ID події" });
    const parsed = eventFields.partial().refine(v => Object.keys(v).length > 0).safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "Помилка валідації", details: parsed.error.issues });
    const exists = await prisma.event.findFirst({ where: { id, ...eventWhere(req) } }); if (!exists) return res.status(404).json({ error: "Подію не знайдено" });
    const startsAt = parsed.data.startsAt ?? exists.startsAt, endsAt = parsed.data.endsAt ?? exists.endsAt;
    if (endsAt <= startsAt) return res.status(400).json({ error: "Дата завершення має бути пізніше дати початку" });
    const venueId = parsed.data.venueId === undefined ? exists.venueId : parsed.data.venueId;
    const capacity = parsed.data.capacity === undefined ? exists.capacity : parsed.data.capacity;
    let venueCapacity = null;
    if (venueId) {
      const venue = await prisma.venue.findUnique({ where: { id: venueId } });
      if (!venue) return res.status(404).json({ error: "Локацію не знайдено" });
      venueCapacity = venue.capacity;
      if (venue.capacity && capacity && capacity > venue.capacity) return res.status(400).json({ error: "Місткість події не може перевищувати місткість локації" });
    }
    const effectiveCapacity = capacity ?? venueCapacity;
    if (effectiveCapacity) {
      const active = await prisma.registration.count({ where: { eventId: id, status: { not: "CANCELLED" } } });
      const allocated = await prisma.ticketType.aggregate({ where: { eventId: id }, _sum: { quantity: true } });
      if (effectiveCapacity < active) return res.status(409).json({ error: `Місткість не може бути меншою за кількість активних реєстрацій (${active})` });
      if (effectiveCapacity < (allocated._sum.quantity || 0)) return res.status(409).json({ error: "Місткість не може бути меншою за сумарну кількість створених квитків" });
    }
    const event = await prisma.event.update({ where: { id }, data: parsed.data, include: { venue: true } });
    req.app.get("io")?.emit("events:changed", { action: "updated", eventId: id });
    res.json(event);
  } catch (e) { next(e); }
}
export async function deleteEvent(req, res, next) {
  try { const id = idOf(req.params.id); if (!id) return res.status(400).json({ error: "Некоректний ID події" }); const result = await prisma.event.deleteMany({ where: { id, ...eventWhere(req) } }); if (!result.count) return res.status(404).json({ error: "Подію не знайдено" }); req.app.get("io")?.emit("events:changed", { action: "deleted", eventId: id }); res.status(204).end(); } catch (e) { next(e); }
}
export async function listVenues(req, res, next) {
  try { res.json(await prisma.venue.findMany({ include: { _count: { select: { events: true } } }, orderBy: [{ city: "asc" }, { name: "asc" }] })); }
  catch (e) { next(e); }
}
export async function updateVenue(req, res, next) {
  try {
    const id = idOf(req.params.id), p = venueInput.partial().safeParse(req.body);
    if (!id || !p.success || !Object.keys(p.data || {}).length) return res.status(400).json({ error: "Некоректні дані локації", details: p.success ? undefined : p.error.issues });
    const existing = await prisma.venue.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Локацію не знайдено" });
    const nextCapacity = p.data.capacity === undefined ? existing.capacity : p.data.capacity;
    if (nextCapacity) {
      const linkedEvents = await prisma.event.findMany({ where: { venueId: id }, select: { id: true, title: true, capacity: true } });
      for (const linkedEvent of linkedEvents) {
        if (linkedEvent.capacity && linkedEvent.capacity > nextCapacity) return res.status(409).json({ error: `Місткість локації менша за місткість події «${linkedEvent.title}»` });
        const active = await prisma.registration.count({ where: { eventId: linkedEvent.id, status: { not: "CANCELLED" } } });
        const allocated = await prisma.ticketType.aggregate({ where: { eventId: linkedEvent.id }, _sum: { quantity: true } });
        if (active > nextCapacity || (allocated._sum.quantity || 0) > nextCapacity) return res.status(409).json({ error: `Нова місткість локації недостатня для події «${linkedEvent.title}»` });
      }
    }
    const result = await prisma.venue.updateMany({ where: { id }, data: p.data });
    if (!result.count) return res.status(404).json({ error: "Локацію не знайдено" });
    res.json(await prisma.venue.findUnique({ where: { id } }));
  } catch (e) { next(e); }
}
export async function deleteVenue(req, res, next) {
  try { const id = idOf(req.params.id); if (!id) return res.status(400).json({ error: "Некоректний ID локації" }); const result = await prisma.venue.deleteMany({ where: { id } }); if (!result.count) return res.status(404).json({ error: "Локацію не знайдено" }); res.status(204).end(); }
  catch (e) { next(e); }
}
export async function createVenue(req, res, next) { try { const p = venueInput.safeParse(req.body); if (!p.success) return res.status(400).json({ error: "Помилка валідації", details: p.error.issues }); res.status(201).json(await prisma.venue.create({ data: p.data })); } catch (e) { next(e); } }
export async function listParticipants(req, res, next) {
  try { res.json(await prisma.participant.findMany({ include: { _count: { select: { registrations: true } } }, orderBy: { createdAt: "desc" }, take: 500 })); }
  catch (e) { next(e); }
}
export async function listRegistrations(req, res, next) {
  try {
    let eventId;
    if (req.query.eventId !== undefined) {
      eventId = idOf(req.query.eventId);
      if (!eventId) return res.status(400).json({ error: "Некоректний ID події" });
    }
    const ownershipFilter = isAdmin(req) ? {} : { event: { organizerId: Number(req.user.id) } };
    const where = { ...ownershipFilter, ...(eventId ? { eventId } : {}) };
    res.json(await prisma.registration.findMany({ where, include: { participant: true, event: { select: { id: true, title: true, startsAt: true } }, tickets: { include: { ticketType: true } } }, orderBy: { registeredAt: "desc" }, take: 500 }));
  } catch (e) { next(e); }
}
export async function cancelRegistration(req, res, next) {
  try {
    const id = idOf(req.params.id); if (!id) return res.status(400).json({ error: "Некоректний ID реєстрації" });
    const ownershipFilter = isAdmin(req) ? {} : { event: { organizerId: Number(req.user.id) } };
    const found = await prisma.registration.findFirst({ where: { id, ...ownershipFilter }, select: { id: true, eventId: true } });
    if (!found) return res.status(404).json({ error: "Реєстрацію не знайдено" });
    const checkedIn = await prisma.ticket.count({ where: { registrationId: id, status: "USED" } });
    if (checkedIn) return res.status(409).json({ error: "Не можна скасувати реєстрацію після використання квитка" });
    if (found.status === "CANCELLED") return res.status(409).json({ error: "Реєстрацію вже скасовано" });
    await prisma.$transaction([prisma.ticket.updateMany({ where: { registrationId: id }, data: { status: "CANCELLED" } }), prisma.registration.update({ where: { id }, data: { status: "CANCELLED" } })]);
    req.app.get("io")?.to(`event:${found.eventId}`).emit("registrations:changed", { action: "cancelled", registrationId: id });
    req.app.get("io")?.emit("registrations:changed", { action: "cancelled", eventId: found.eventId });
    res.json({ message: "Реєстрацію скасовано" });
  } catch (e) { next(e); }
}
export async function updateParticipant(req, res, next) {
  try {
    const id = idOf(req.params.id), p = participantInput.partial().safeParse(req.body);
    if (!id || !p.success || !Object.keys(p.data || {}).length) return res.status(400).json({ error: "Некоректні дані учасника", details: p.success ? undefined : p.error.issues });
    const result = await prisma.participant.updateMany({ where: { id }, data: p.data });
    if (!result.count) return res.status(404).json({ error: "Учасника не знайдено" });
    res.json(await prisma.participant.findUnique({ where: { id } }));
  } catch (e) { if (e.code === "P2002") return res.status(409).json({ error: "Учасник з таким email вже існує" }); next(e); }
}
export async function deleteParticipant(req, res, next) {
  try { const id = idOf(req.params.id); if (!id) return res.status(400).json({ error: "Некоректний ID учасника" }); const result = await prisma.participant.deleteMany({ where: { id } }); if (!result.count) return res.status(404).json({ error: "Учасника не знайдено" }); res.status(204).end(); }
  catch (e) { next(e); }
}
export async function createParticipant(req, res, next) { try { const p = participantInput.safeParse(req.body); if (!p.success) return res.status(400).json({ error: "Помилка валідації", details: p.error.issues }); const participant = await prisma.participant.upsert({ where: { email: p.data.email }, create: p.data, update: { name: p.data.name, phone: p.data.phone } }); res.status(201).json(participant); } catch (e) { next(e); } }
export async function listSchedule(req, res, next) { try { const eventId = idOf(req.params.id); if (!eventId) return res.status(400).json({ error: "Некоректний ID події" }); const event = await prisma.event.findFirst({ where: { id: eventId, ...eventWhere(req) } }); if (!event) return res.status(404).json({ error: "Подію не знайдено" }); res.json(await prisma.schedule.findMany({ where: { eventId }, orderBy: { startsAt: "asc" } })); } catch (e) { next(e); } }
export async function deleteScheduleItem(req, res, next) {
  try {
    const id = idOf(req.params.itemId), eventId = idOf(req.params.id);
    if (!id || !eventId) return res.status(400).json({ error: "Некоректний ID" });
    const event = await prisma.event.findFirst({ where: { id: eventId, ...eventWhere(req) } });
    if (!event) return res.status(404).json({ error: "Подію не знайдено" });
    const result = await prisma.schedule.deleteMany({ where: { id, eventId } });
    if (!result.count) return res.status(404).json({ error: "Пункт розкладу не знайдено" });
    res.status(204).end();
  } catch (e) { next(e); }
}
export async function addScheduleItem(req, res, next) {
  try {
    const eventId = idOf(req.params.id), p = scheduleInput.safeParse(req.body);
    if (!eventId || !p.success) return res.status(400).json({ error: "Некоректні дані розкладу", details: p.success ? undefined : p.error.issues });
    const event = await prisma.event.findFirst({ where: { id: eventId, ...eventWhere(req) } });
    if (!event) return res.status(404).json({ error: "Подію не знайдено" });
    if (p.data.startsAt < event.startsAt || p.data.endsAt > event.endsAt) return res.status(400).json({ error: "Пункт розкладу має бути в межах часу події" });
    res.status(201).json(await prisma.schedule.create({ data: { ...p.data, eventId } }));
  } catch (e) { next(e); }
}
export async function updateScheduleItem(req, res, next) {
  try {
    const eventId = idOf(req.params.id), itemId = idOf(req.params.itemId);
    const p = scheduleInput.partial().refine(v => Object.keys(v).length > 0).safeParse(req.body);
    if (!eventId || !itemId || !p.success) return res.status(400).json({ error: "Некоректні дані розкладу", details: p.success ? undefined : p.error.issues });
    const event = await prisma.event.findFirst({ where: { id: eventId, ...eventWhere(req) } });
    if (!event) return res.status(404).json({ error: "Подію не знайдено" });
    const current = await prisma.schedule.findFirst({ where: { id: itemId, eventId } });
    if (!current) return res.status(404).json({ error: "Пункт розкладу не знайдено" });
    const startsAt = p.data.startsAt ?? current.startsAt, endsAt = p.data.endsAt ?? current.endsAt;
    if (endsAt <= startsAt || startsAt < event.startsAt || endsAt > event.endsAt) return res.status(400).json({ error: "Час пункту розкладу має бути в межах часу події" });
    res.json(await prisma.schedule.update({ where: { id: itemId }, data: p.data }));
  } catch (e) { next(e); }
}
export async function listTicketTypes(req, res, next) { try { const eventId = idOf(req.params.id); if (!eventId) return res.status(400).json({ error: "Некоректний ID події" }); const event = await prisma.event.findFirst({ where: { id: eventId, ...eventWhere(req) } }); if (!event) return res.status(404).json({ error: "Подію не знайдено" }); res.json(await prisma.ticketType.findMany({ where: { eventId }, orderBy: { price: "asc" } })); } catch (e) { next(e); } }
export async function updateTicketType(req, res, next) {
  try {
    const eventId = idOf(req.params.id), ticketTypeId = idOf(req.params.ticketTypeId);
    const p = ticketTypeInput.partial().refine(v => Object.keys(v).length > 0).safeParse(req.body);
    if (!eventId || !ticketTypeId || !p.success) return res.status(400).json({ error: "Некоректні дані типу квитка", details: p.success ? undefined : p.error.issues });
    const event = await prisma.event.findFirst({ where: { id: eventId, ...eventWhere(req) }, include: { venue: true } });
    if (!event) return res.status(404).json({ error: "Подію не знайдено" });
    const current = await prisma.ticketType.findFirst({ where: { id: ticketTypeId, eventId } });
    if (!current) return res.status(404).json({ error: "Тип квитка не знайдено" });
    if (p.data.quantity !== undefined) {
      const sold = await prisma.ticket.count({ where: { ticketTypeId, status: { not: "CANCELLED" } } });
      if (p.data.quantity < sold) return res.status(409).json({ error: `Кількість не може бути меншою за вже видані квитки (${sold})` });
      const effectiveCapacity = event.capacity ?? event.venue?.capacity;
      if (effectiveCapacity) {
        const others = await prisma.ticketType.aggregate({ where: { eventId, id: { not: ticketTypeId } }, _sum: { quantity: true } });
        if ((others._sum.quantity || 0) + p.data.quantity > effectiveCapacity) return res.status(409).json({ error: "Сумарна кількість квитків перевищує місткість події або локації" });
      }
    }
    res.json(await prisma.ticketType.update({ where: { id: ticketTypeId }, data: p.data }));
  } catch (e) { next(e); }
}
export async function deleteTicketType(req, res, next) {
  try {
    const id = idOf(req.params.ticketTypeId), eventId = idOf(req.params.id);
    if (!id || !eventId) return res.status(400).json({ error: "Некоректний ID" });
    const event = await prisma.event.findFirst({ where: { id: eventId, ...eventWhere(req) } });
    if (!event) return res.status(404).json({ error: "Подію не знайдено" });
    const count = await prisma.ticket.count({ where: { ticketTypeId: id } });
    if (count) return res.status(409).json({ error: "Неможливо видалити тип квитка, для якого вже створювалися квитки" });
    const result = await prisma.ticketType.deleteMany({ where: { id, eventId } });
    if (!result.count) return res.status(404).json({ error: "Тип квитка не знайдено" });
    res.status(204).end();
  } catch (e) { next(e); }
}
export async function addTicketType(req, res, next) {
  try {
    const eventId = idOf(req.params.id), p = ticketTypeInput.safeParse(req.body);
    if (!eventId || !p.success) return res.status(400).json({ error: "Некоректні дані квитка", details: p.success ? undefined : p.error.issues });
    const event = await prisma.event.findFirst({ where: { id: eventId, ...eventWhere(req) }, include: { venue: true } });
    if (!event) return res.status(404).json({ error: "Подію не знайдено" });
    const effectiveCapacity = event.capacity ?? event.venue?.capacity;
    if (effectiveCapacity) {
      const allocated = await prisma.ticketType.aggregate({ where: { eventId }, _sum: { quantity: true } });
      if ((allocated._sum.quantity || 0) + p.data.quantity > effectiveCapacity) return res.status(409).json({ error: "Сумарна кількість квитків перевищує місткість події або локації" });
    }
    res.status(201).json(await prisma.ticketType.create({ data: { ...p.data, eventId } }));
  } catch (e) { next(e); }
}
export async function registerParticipant(req, res, next) {
  try {
    const eventId = idOf(req.params.id);
    const p = z.object({ participantId: z.number().int().positive(), ticketTypeId: z.number().int().positive() }).safeParse(req.body);
    if (!eventId || !p.success) return res.status(400).json({ error: "Некоректні дані реєстрації" });
    const registration = await prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({ where: { id: eventId, ...eventWhere(req) }, include: { ticketTypes: true, venue: true } });
      if (!event) { const error = new Error("Подію не знайдено"); error.status = 404; throw error; }
      if (event.status !== "PUBLISHED") { const error = new Error("Реєстрація доступна лише на опубліковані події"); error.status = 409; throw error; }
      const participant = await tx.participant.findUnique({ where: { id: p.data.participantId } });
      if (!participant) { const error = new Error("Учасника не знайдено"); error.status = 404; throw error; }
      const type = event.ticketTypes.find(t => t.id === p.data.ticketTypeId);
      if (!type) { const error = new Error("Тип квитка не належить цій події"); error.status = 404; throw error; }
      const activeRegistrations = await tx.registration.count({ where: { eventId, status: { not: "CANCELLED" } } });
      const effectiveCapacity = event.capacity ?? event.venue?.capacity;
      if (effectiveCapacity && activeRegistrations >= effectiveCapacity) { const error = new Error("На подію більше немає місць"); error.status = 409; throw error; }
      const sold = await tx.ticket.count({ where: { ticketTypeId: type.id, status: { not: "CANCELLED" } } });
      if (sold >= type.quantity) { const error = new Error("Квитки цього типу закінчилися"); error.status = 409; throw error; }
      const previous = await tx.registration.findUnique({ where: { eventId_participantId: { eventId, participantId: p.data.participantId } } });
      if (previous && previous.status !== "CANCELLED") { const error = new Error("Учасник уже зареєстрований на цю подію"); error.status = 409; throw error; }
      if (previous) {
        return tx.registration.update({
          where: { id: previous.id },
          data: { status: "CONFIRMED", registeredAt: new Date(), tickets: { create: { ticketTypeId: type.id } } },
          include: { participant: true, tickets: { include: { ticketType: true } } },
        });
      }
      return tx.registration.create({
        data: { eventId, participantId: p.data.participantId, tickets: { create: { ticketTypeId: type.id } } },
        include: { participant: true, tickets: { include: { ticketType: true } } },
      });
    }, { isolationLevel: "Serializable" });
    req.app.get("io")?.to(`event:${eventId}`).emit("registrations:changed", { action: "created", registrationId: registration.id });
    req.app.get("io")?.emit("registrations:changed", { action: "created", eventId });
    res.status(201).json(registration);
  } catch (e) {
    if (e.code === "P2002") return res.status(409).json({ error: "Учасник уже зареєстрований на цю подію" });
    if (e.code === "P2034") return res.status(409).json({ error: "Дані змінилися одночасно. Повторіть спробу" });
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
}

export async function checkInTicket(req, res, next) {
  try {
    const id = idOf(req.params.id);
    if (!id) return res.status(400).json({ error: "Некоректний ID квитка" });
    const where = isAdmin(req) ? { id } : { id, registration: { event: { organizerId: Number(req.user.id) } } };
    const ticket = await prisma.ticket.findFirst({ where, include: { registration: { include: { event: { select: { id: true, title: true } }, participant: true } }, ticketType: true } });
    if (!ticket) return res.status(404).json({ error: "Квиток не знайдено" });
    if (ticket.status !== "VALID") return res.status(409).json({ error: ticket.status === "USED" ? "Квиток уже використано" : "Квиток скасовано" });
    const updated = await prisma.ticket.update({ where: { id }, data: { status: "USED" }, include: { ticketType: true } });
    req.app.get("io")?.to(`event:${ticket.registration.event.id}`).emit("ticket:checked-in", { ticketId: id, participantId: ticket.registration.participantId });
    res.json({ ...updated, event: ticket.registration.event, participant: ticket.registration.participant });
  } catch (e) { next(e); }
}
