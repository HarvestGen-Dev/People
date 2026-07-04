-- 018_additional_performance_indices.sql

-- 1. Index on people(email) for fast lookups (frequently used in logins/imports/integrations)
CREATE INDEX IF NOT EXISTS idx_people_email ON people(email);

-- 2. Index on event_registrations(event_id) to quickly get all registrations for an event
CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON event_registrations(event_id);

-- 3. Index on event_registrations(status) for filtering the dashboard/lists
CREATE INDEX IF NOT EXISTS idx_event_registrations_status ON event_registrations(status);

-- 4. Composite index on event_registrations for the table view (event_id + status)
CREATE INDEX IF NOT EXISTS idx_event_registrations_event_status ON event_registrations(event_id, status);

-- 5. Index on person_tags(person_id) for quickly joining tags to a person
CREATE INDEX IF NOT EXISTS idx_person_tags_person_id ON person_tags(person_id);

-- 6. Index on person_field_values(person_id) for quickly getting custom fields
CREATE INDEX IF NOT EXISTS idx_person_field_values_person_id ON person_field_values(person_id);

-- 7. Index on notes(person_id)
CREATE INDEX IF NOT EXISTS idx_notes_person_id ON notes(person_id);

-- 8. Index on person_events(person_id) to quickly load the activity timeline
CREATE INDEX IF NOT EXISTS idx_person_events_person_id ON person_events(person_id);
