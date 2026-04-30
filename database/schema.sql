-- ============================================================================
-- JOB FAIR MONITORING SYSTEM - PostgreSQL Schema
-- ============================================================================
-- This schema replaces 4 Excel workbooks (34 sheets):
--   1. 2025-JFA-AND-DOCUMENT-TRACKING.xlsx  (SUMMARY + JAN-DEC = 13 sheets)
--   2. 2026-JFA-TRACKING-NO.xlsx            (SUMMARY + JAN-MAR = 4 sheets)
--   3. 2025-JOB-FAIR-REPORT.xlsx            (SUMMARY + JAN-DEC = 13 sheets)
--   4. 2026-JOB-FAIR-REPORT.xlsx            (SUMMARY + MONITORING + FEB-MAR = 4 sheets)
-- ============================================================================

-- Drop existing objects if re-running
DROP VIEW  IF EXISTS v_job_fair_summary CASCADE;
DROP VIEW  IF EXISTS v_jfa_summary CASCADE;
DROP VIEW  IF EXISTS v_jfa_document_status CASCADE;
DROP VIEW  IF EXISTS v_job_fair_event_details CASCADE;
DROP VIEW  IF EXISTS v_monitoring_overview CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS monitoring_records CASCADE;
DROP TABLE IF EXISTS job_fair_participants CASCADE;
DROP TABLE IF EXISTS job_fair_events CASCADE;
DROP TABLE IF EXISTS jfa_documents CASCADE;
DROP TABLE IF EXISTS jfa_records CASCADE;
DROP TABLE IF EXISTS venues CASCADE;
DROP TABLE IF EXISTS agencies CASCADE;
DROP TABLE IF EXISTS fiscal_years CASCADE;

-- ============================================================================
-- 1. REFERENCE TABLES
-- ============================================================================

-- Fiscal years for easy filtering
CREATE TABLE fiscal_years (
    year INTEGER PRIMARY KEY,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Agencies / Institutions / Organizers
-- Covers: recruitment agencies, LGUs, schools, DOLE offices, etc.
CREATE TABLE agencies (
    id SERIAL PRIMARY KEY,
    agency_name VARCHAR(500) NOT NULL,
    agency_type VARCHAR(50) NOT NULL DEFAULT 'recruitment',
        -- 'recruitment', 'lgu', 'institution', 'dole', 'school', 'other'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(agency_name, agency_type)
);

-- Venues where job fairs are held
CREATE TABLE venues (
    id SERIAL PRIMARY KEY,
    venue_name VARCHAR(500) NOT NULL,
    city_municipality VARCHAR(255),
    province VARCHAR(255),
    region VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Application users (for login + role-based access)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'staff')),
    password_hash TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- 2. JFA TRACKING TABLES
--    Replaces: 2025-JFA-AND-DOCUMENT-TRACKING.xlsx (JAN-DEC sheets)
--              2026-JFA-TRACKING-NO.xlsx (JAN-MAR sheets)
-- ============================================================================

-- Each row = one JFA issued (one row per JFA number)
CREATE TABLE jfa_records (
    id SERIAL PRIMARY KEY,
    jfa_no VARCHAR(50) NOT NULL UNIQUE,
        -- Format: BUT-YY-MMDD-NNN (e.g., BUT-25-0130-001)
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    fiscal_year INTEGER NOT NULL REFERENCES fiscal_years(year),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    job_fair_date_start DATE,
    job_fair_date_end DATE,
    venue_id INTEGER REFERENCES venues(id),
    available_job_orders INTEGER DEFAULT 0,
    job_site TEXT,
        -- Countries/locations for the job orders
    job_orders_balance INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
        -- 'active', 'cancelled', 'not_participated', 'completed'
    remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_jfa_fiscal_year ON jfa_records(fiscal_year);
CREATE INDEX idx_jfa_month ON jfa_records(fiscal_year, month);
CREATE INDEX idx_jfa_agency ON jfa_records(agency_id);
CREATE INDEX idx_jfa_status ON jfa_records(status);

-- Document compliance tracking per JFA
-- Each JFA has one document tracking record
CREATE TABLE jfa_documents (
    id SERIAL PRIMARY KEY,
    jfa_id INTEGER NOT NULL UNIQUE REFERENCES jfa_records(id) ON DELETE CASCADE,
    invitation_letter_date DATE,
        -- Date invitation letter was emailed
    affidavit_date DATE,
        -- Date affidavit of undertaking was received
    job_orders_date DATE,
        -- Date job orders were received
    representative_id_date DATE,
        -- Date representative company ID was received
    terminal_report_date DATE,
        -- Date terminal report was received
    status_of_applicants TEXT,
        -- Status description
    status_date DATE,
        -- Date of status update
    is_complete BOOLEAN GENERATED ALWAYS AS (
        invitation_letter_date IS NOT NULL AND
        affidavit_date IS NOT NULL AND
        job_orders_date IS NOT NULL AND
        representative_id_date IS NOT NULL AND
        terminal_report_date IS NOT NULL
    ) STORED,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 3. JOB FAIR REPORT TABLES
--    Replaces: 2025-JOB-FAIR-REPORT.xlsx (JAN-DEC monthly report sheets)
--              2026-JOB-FAIR-REPORT.xlsx (FEB, MAR report sheets)
-- ============================================================================

-- Each row = one job fair event conducted
CREATE TABLE job_fair_events (
    id SERIAL PRIMARY KEY,
    fiscal_year INTEGER NOT NULL REFERENCES fiscal_years(year),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    organizer_id INTEGER REFERENCES agencies(id),
        -- LGU, DOLE office, school, etc. that organized the event
    job_fair_date_start DATE NOT NULL,
    job_fair_date_end DATE,
    venue_id INTEGER REFERENCES venues(id),
    num_job_fairs_facilitated INTEGER DEFAULT 1,
        -- NO. OF JOBS FAIR FACILITATED/SUPERVISED
    monitored_by VARCHAR(255),
        -- Staff who monitored (2026 report column)
    remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_event_fiscal_year ON job_fair_events(fiscal_year);
CREATE INDEX idx_event_month ON job_fair_events(fiscal_year, month);
CREATE INDEX idx_event_organizer ON job_fair_events(organizer_id);

-- Each row = one recruitment agency participating in a job fair event
CREATE TABLE job_fair_participants (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES job_fair_events(id) ON DELETE CASCADE,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    jfa_id INTEGER REFERENCES jfa_records(id),
        -- Link back to the JFA that authorized this participation
    agency_category VARCHAR(20) NOT NULL DEFAULT 'land-based'
        CHECK (agency_category IN ('land-based', 'sea-based')),
    -- Registered applicants (from event day)
    registered_applicants_male INTEGER DEFAULT 0,
    registered_applicants_female INTEGER DEFAULT 0,
    registered_applicants_total INTEGER GENERATED ALWAYS AS
        (registered_applicants_male + registered_applicants_female) STORED,
    -- Terminal report figures (post-event verified)
    terminal_report_male INTEGER DEFAULT 0,
    terminal_report_female INTEGER DEFAULT 0,
    terminal_report_total INTEGER GENERATED ALWAYS AS
        (terminal_report_male + terminal_report_female) STORED,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(event_id, agency_id)
);

CREATE INDEX idx_participant_event ON job_fair_participants(event_id);
CREATE INDEX idx_participant_agency ON job_fair_participants(agency_id);

-- ============================================================================
-- 4. MONITORING TABLE
--    Replaces: 2026-JOB-FAIR-REPORT.xlsx (MONITORING sheet)
-- ============================================================================

-- Tracks the administrative process timeline for each job fair
CREATE TABLE monitoring_records (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES job_fair_events(id) ON DELETE CASCADE,
    implementing_agency_id INTEGER REFERENCES agencies(id),
    job_fair_date_start DATE,
    job_fair_date_end DATE,
    venue_id INTEGER REFERENCES venues(id),
    celebration_event TEXT,
        -- Celebration/event context from monitoring sheet
    job_fair_monitoring BOOLEAN,
        -- Whether job fair monitoring activity was completed
    conduct_of_peos BOOLEAN,
        -- Whether conduct of PEOS activity was completed
    -- Process timeline dates
    communication_letter_received DATE,
    invitation_emailed DATE,
    confirmation_deadline DATE,
    transmittal_letter_date DATE,
        -- Date transmittal letter with job order summary was emailed
    evidence_path TEXT,
        -- File path to evidence folder
    monitored_by VARCHAR(255),
        -- Person or unit who monitored the event
    remarks TEXT,
    fiscal_year INTEGER NOT NULL REFERENCES fiscal_years(year),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_monitoring_fiscal_year ON monitoring_records(fiscal_year);

-- ============================================================================
-- 5. VIEWS - Auto-computed summaries
--    Replaces: SUMMARY sheets in all 4 Excel files
-- ============================================================================

-- JFA Summary View
-- Replaces: 2025-JFA-AND-DOCUMENT-TRACKING.xlsx → SUMMARY
--           2026-JFA-TRACKING-NO.xlsx → SUMMARY OF JFA ISSUED
CREATE VIEW v_jfa_summary AS
SELECT
    fiscal_year,
    month,
    TO_CHAR(TO_DATE(month::TEXT, 'MM'), 'Month') AS month_name,
    COUNT(*) AS total_jfa_issued,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
    COUNT(*) FILTER (WHERE status = 'not_participated') AS not_participated,
    COUNT(*) FILTER (WHERE status = 'active') AS active
FROM jfa_records
GROUP BY fiscal_year, month
ORDER BY fiscal_year, month;

-- JFA Document Status View
-- Shows compliance status per JFA
CREATE VIEW v_jfa_document_status AS
SELECT
    j.id,
    j.jfa_no,
    a.agency_name,
    j.fiscal_year,
    j.month,
    j.job_fair_date_start,
    j.job_fair_date_end,
    v.venue_name,
    j.available_job_orders,
    j.job_site,
    j.job_orders_balance,
    j.status,
    j.remarks,
    d.invitation_letter_date,
    d.affidavit_date,
    d.job_orders_date,
    d.representative_id_date,
    d.terminal_report_date,
    d.status_of_applicants,
    d.status_date,
    d.is_complete AS documents_complete
FROM jfa_records j
JOIN agencies a ON j.agency_id = a.id
LEFT JOIN venues v ON j.venue_id = v.id
LEFT JOIN jfa_documents d ON j.id = d.jfa_id
ORDER BY j.fiscal_year, j.month, j.jfa_no;

-- Job Fair Summary View
-- Replaces: 2025-JOB-FAIR-REPORT.xlsx → SUMMARY
--           2026-JOB-FAIR-REPORT.xlsx → SUMMARY
CREATE VIEW v_job_fair_summary AS
SELECT
    e.fiscal_year,
    e.month,
    TO_CHAR(TO_DATE(e.month::TEXT, 'MM'), 'Month') AS month_name,
    COALESCE(SUM(e.num_job_fairs_facilitated), 0) AS num_job_fairs,
    COALESCE(SUM(p.registered_applicants_male), 0) AS total_male_applicants,
    COALESCE(SUM(p.registered_applicants_female), 0) AS total_female_applicants,
    COALESCE(SUM(p.registered_applicants_male), 0) +
        COALESCE(SUM(p.registered_applicants_female), 0) AS total_applicants,
    COUNT(DISTINCT p.id) FILTER (WHERE p.agency_category = 'land-based')
        AS land_based_agencies,
    COUNT(DISTINCT p.id) FILTER (WHERE p.agency_category = 'sea-based')
        AS sea_based_agencies,
    COUNT(DISTINCT p.id) AS total_participating_agencies
FROM job_fair_events e
LEFT JOIN job_fair_participants p ON e.id = p.event_id
GROUP BY e.fiscal_year, e.month
ORDER BY e.fiscal_year, e.month;

-- Job Fair Event Details View
-- Shows full event details with aggregated participant data
CREATE VIEW v_job_fair_event_details AS
SELECT
    e.id AS event_id,
    e.fiscal_year,
    e.month,
    org.agency_name AS organizer,
    e.job_fair_date_start,
    e.job_fair_date_end,
    v.venue_name,
    e.num_job_fairs_facilitated,
    e.monitored_by,
    COALESCE(SUM(p.registered_applicants_male), 0) AS total_male,
    COALESCE(SUM(p.registered_applicants_female), 0) AS total_female,
    COALESCE(SUM(p.registered_applicants_male), 0) +
        COALESCE(SUM(p.registered_applicants_female), 0) AS total_applicants,
    COALESCE(SUM(p.terminal_report_male), 0) AS terminal_male,
    COALESCE(SUM(p.terminal_report_female), 0) AS terminal_female,
    COALESCE(SUM(p.terminal_report_male), 0) +
        COALESCE(SUM(p.terminal_report_female), 0) AS terminal_total,
    COUNT(DISTINCT p.id) FILTER (WHERE p.agency_category = 'land-based')
        AS land_based_count,
    COUNT(DISTINCT p.id) FILTER (WHERE p.agency_category = 'sea-based')
        AS sea_based_count,
    COUNT(DISTINCT p.id) AS total_agencies
FROM job_fair_events e
LEFT JOIN agencies org ON e.organizer_id = org.id
LEFT JOIN venues v ON e.venue_id = v.id
LEFT JOIN job_fair_participants p ON e.id = p.event_id
GROUP BY e.id, e.fiscal_year, e.month, org.agency_name,
         e.job_fair_date_start, e.job_fair_date_end, v.venue_name,
         e.num_job_fairs_facilitated, e.monitored_by
ORDER BY e.fiscal_year, e.month, e.job_fair_date_start;

-- Monitoring Overview View
-- Replaces: 2026-JOB-FAIR-REPORT.xlsx → MONITORING sheet
CREATE VIEW v_monitoring_overview AS
SELECT
    m.id,
    m.fiscal_year,
    m.month,
    a.agency_name AS implementing_agency,
    m.job_fair_date_start,
    m.job_fair_date_end,
    v.venue_name,
    m.communication_letter_received,
    m.invitation_emailed,
    m.confirmation_deadline,
    m.transmittal_letter_date,
    m.evidence_path,
    m.remarks,
    -- Process completion flags
    CASE WHEN m.communication_letter_received IS NOT NULL THEN TRUE ELSE FALSE END AS step1_done,
    CASE WHEN m.invitation_emailed IS NOT NULL THEN TRUE ELSE FALSE END AS step2_done,
    CASE WHEN m.confirmation_deadline IS NOT NULL THEN TRUE ELSE FALSE END AS step3_done,
    CASE WHEN m.transmittal_letter_date IS NOT NULL THEN TRUE ELSE FALSE END AS step4_done
FROM monitoring_records m
LEFT JOIN agencies a ON m.implementing_agency_id = a.id
LEFT JOIN venues v ON m.venue_id = v.id
ORDER BY m.fiscal_year, m.month, m.job_fair_date_start;

-- ============================================================================
-- 6. TRIGGER: Auto-update updated_at timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agencies_updated
    BEFORE UPDATE ON agencies
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_venues_updated
    BEFORE UPDATE ON venues
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_jfa_records_updated
    BEFORE UPDATE ON jfa_records
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_jfa_documents_updated
    BEFORE UPDATE ON jfa_documents
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_job_fair_events_updated
    BEFORE UPDATE ON job_fair_events
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_monitoring_updated
    BEFORE UPDATE ON monitoring_records
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- 7. TRIGGER: Auto-create jfa_documents row when jfa_record is inserted
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_create_jfa_document()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO jfa_documents (jfa_id) VALUES (NEW.id)
    ON CONFLICT (jfa_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_create_jfa_doc
    AFTER INSERT ON jfa_records
    FOR EACH ROW EXECUTE FUNCTION auto_create_jfa_document();

-- ============================================================================
-- Schema complete.
-- Run seed.sql next to populate with data from the Excel files.
-- ============================================================================
