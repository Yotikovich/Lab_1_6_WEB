-- Make ticket cleanup cascade when an event/type is removed. The API still
-- prevents deleting ticket types that have already issued tickets.
ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_ticketTypeId_fkey";
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketTypeId_fkey"
  FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The application has been migrated from Task Management to Event Management.
-- Remove the old domain tables after the new event domain has been introduced.
DROP TABLE IF EXISTS "Comment" CASCADE;
DROP TABLE IF EXISTS "Task" CASCADE;
DROP TABLE IF EXISTS "Project" CASCADE;
DROP TYPE IF EXISTS "TaskPriority";
DROP TYPE IF EXISTS "TaskStatus";
