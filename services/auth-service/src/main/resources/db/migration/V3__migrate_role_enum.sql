-- UserAccount.role moved from a free string to the fixed Role enum (ADMIN/RESPONDER/VIEWER).
-- Normalize existing data the same way Role.parse() does for any value read before this
-- migration ran: the historical "admin" default becomes ADMIN, anything unrecognized
-- degrades to the least-privileged VIEWER rather than being left as an invalid value.
UPDATE users SET role = 'ADMIN' WHERE lower(role) = 'admin';
UPDATE users SET role = 'VIEWER' WHERE role NOT IN ('ADMIN', 'RESPONDER', 'VIEWER');
