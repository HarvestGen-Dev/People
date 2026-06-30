CREATE TYPE event_status AS ENUM ('draft', 'published', 'closed');
CREATE TYPE registration_status AS ENUM ('pending_review', 'approved', 'rejected');

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
    slug VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    location VARCHAR(255),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    capacity INTEGER,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'MYR',
    payment_qr_url TEXT,
    payment_link TEXT,
    payment_instructions TEXT,
    status event_status NOT NULL DEFAULT 'draft',
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (church_id, slug)
);

CREATE TABLE event_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    guests INTEGER NOT NULL DEFAULT 0,
    amount_due NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_proof_url TEXT,
    paid_checkbox BOOLEAN NOT NULL DEFAULT FALSE,
    status registration_status NOT NULL DEFAULT 'pending_review',
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    confirmation_email_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_isolation" ON events 
    FOR ALL USING (church_id = current_setting('app.current_church_id', true)::uuid);
    
CREATE POLICY "event_registrations_isolation" ON event_registrations 
    FOR ALL USING (church_id = current_setting('app.current_church_id', true)::uuid);

-- Indexes
CREATE INDEX idx_events_church_id ON events(church_id);
CREATE INDEX idx_events_slug ON events(slug);
CREATE INDEX idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX idx_event_registrations_person_id ON event_registrations(person_id);

CREATE POLICY "Allow authenticated users all access on events" ON events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users all access on event_registrations" ON event_registrations FOR ALL TO authenticated USING (true) WITH CHECK (true);
