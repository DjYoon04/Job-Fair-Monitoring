-- ============================================================================
-- JOB FAIR MONITORING SYSTEM - Clear All Data
-- ============================================================================
-- This removes all rows from the database while keeping the schema intact.
-- Run it against an existing job_fair_monitoring database:
--   psql -U postgres -d job_fair_monitoring -f database/clear-data.sql
-- ============================================================================

TRUNCATE TABLE
    monitoring_records,
    job_fair_participants,
    job_fair_events,
    jfa_documents,
    jfa_records,
    users,
    venues,
    agencies,
    fiscal_years
RESTART IDENTITY CASCADE;

INSERT INTO users (username, full_name, role, password_hash)
VALUES (
    'admin',
    'System Administrator',
    'admin',
    'pbkdf2$120000$fixedsalt$6d01a7c18349b74d5e9fef3b3149d927e20f203316188dcc665b6cfc57197ac1062ee02b22b0421c118fc04c4b20f7149d9e734f9119b679d1bf64a236919d43'
);

INSERT INTO users (username, full_name, role, password_hash, created_by)
VALUES (
    'client',
    'Client User',
    'staff',
    'pbkdf2$120000$fixedsalt$006c72cd504faaf808047c127f6f687768a8dc22fd2df867f9c7ce91a08428c8947e2f37ab822cddba92bb3ad909656d2b04cef0026438ac9ace3cf1efe3562e',
    (SELECT id FROM users WHERE username = 'admin')
);
