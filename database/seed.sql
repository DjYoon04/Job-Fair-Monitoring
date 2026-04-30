-- ============================================================================
-- JOB FAIR MONITORING SYSTEM - Seed Data
-- ============================================================================
-- Sample data derived from:
--   1. 2025-JFA-AND-DOCUMENT-TRACKING.xlsx
--   2. 2026-JFA-TRACKING-NO.xlsx
--   3. 2025-JOB-FAIR-REPORT.xlsx
--   4. 2026-JOB-FAIR-REPORT.xlsx
-- ============================================================================

-- ============================================================================
-- FISCAL YEARS
-- ============================================================================
INSERT INTO fiscal_years (year, is_active) VALUES
(2025, TRUE),
(2026, TRUE);

-- ============================================================================
-- AGENCIES
-- ============================================================================
-- Recruitment agencies (from JFA tracking and job fair reports)
INSERT INTO agencies (agency_name, agency_type) VALUES
('JENERICK INTERNATIONAL MANPOWER INC.', 'recruitment'),
('EAST WEST PLACEMENT CENTER INC.', 'recruitment'),
('PLACEWELL INTERNATIONAL SERVICES CORP.', 'recruitment'),
('STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY', 'recruitment'),
('MMML OVERSEAS MANPOWER CORPORATION', 'recruitment'),
('MYRIAD DIVERSIFIED SERVICES INC.', 'recruitment'),
('SMC MANPOWER AGENCY PHILS. INC.', 'recruitment'),
('DIMENSION-ALL MANPOWER SERVICES INC.', 'recruitment'),
('ACES INTERNATIONAL MANPOWER SERVICES', 'recruitment'),
('GOLDEN HORIZON PLACEMENT AGENCY', 'recruitment'),
('PHILWORLD RECRUITMENT AGENCY', 'recruitment'),
('GREAT WORLD MANPOWER SERVICES', 'recruitment'),
('ORIENT EXPAT MANPOWER SERVICES', 'recruitment'),
('PACIFIC ACE HUMAN RESOURCES CORP.', 'recruitment'),
('SEALANES MARINE SERVICES INC.', 'sea-based'),
('MARITIME RESOURCES CORP.', 'sea-based');

-- Organizers/Institutions (LGUs, DOLE, Schools)
INSERT INTO agencies (agency_name, agency_type) VALUES
('LGU-CABADBARAN', 'lgu'),
('LGU-BUTUAN', 'lgu'),
('MUNICIPALITY OF SAN JOSE, DINAGAT ISLAND', 'lgu'),
('MUNICIPALITY OF PROSPERIDAD', 'lgu'),
('MUNICIPALITY OF CAGDIANAO', 'lgu'),
('MUNICIPALITY OF SAN FRANCISCO', 'lgu'),
('MUNICIPALITY OF TUBAJON', 'lgu'),
('MUNICIPALITY OF BUNAWAN', 'lgu'),
('MUNICIPALITY OF BAYUGAN', 'lgu'),
('MUNICIPALITY OF RTR', 'lgu'),
('MUNICIPALITY OF LIANGA', 'lgu'),
('MUNICIPALITY OF CAGWAIT', 'lgu'),
('MUNICIPALITY OF MADRID', 'lgu'),
('DOLE CARAGA', 'dole'),
('DOLE-AGUSAN DEL SUR', 'dole'),
('PESO SAN LUIS', 'dole'),
('PPESO-PDI', 'dole'),
('ST. THERESA COLLEGE', 'school'),
('NORMI', 'school'),
('NEMSU TANDAG', 'school'),
('NEMSU TAGBINA', 'school'),
('SMCC', 'school'),
('CSUCC', 'school');

-- ============================================================================
-- VENUES
-- ============================================================================
INSERT INTO venues (venue_name, city_municipality, province) VALUES
('Cabadbaran City Gym', 'Cabadbaran', 'Agusan del Norte'),
('Robinsons Place Butuan', 'Butuan', 'Agusan del Norte'),
('San Jose Municipal Hall', 'San Jose', 'Dinagat Islands'),
('Prosperidad Municipal Gym', 'Prosperidad', 'Agusan del Sur'),
('Cagdianao Barangay Hall', 'Cagdianao', 'Dinagat Islands'),
('SMCC Campus', 'Butuan', 'Agusan del Norte'),
('CSUCC Campus', 'Butuan', 'Agusan del Norte'),
('Madrid Municipal Hall', 'Madrid', 'Surigao del Sur'),
('Taboo Area, PDI', 'San Jose', 'Dinagat Islands'),
('St. Theresa College Gym', 'Butuan', 'Agusan del Norte'),
('NORMI Campus', 'Butuan', 'Agusan del Norte'),
('NEMSU Tandag Campus', 'Tandag', 'Surigao del Sur'),
('NEMSU Tagbina Campus', 'Tagbina', 'Surigao del Sur'),
('Lianga Municipal Hall', 'Lianga', 'Surigao del Sur'),
('Cagwait Municipal Hall', 'Cagwait', 'Surigao del Sur'),
('San Francisco Town Hall', 'San Francisco', 'Agusan del Sur'),
('Tubajon Municipal Hall', 'Tubajon', 'Dinagat Islands'),
('Bunawan Municipal Hall', 'Bunawan', 'Agusan del Sur'),
('Bayugan City Hall', 'Bayugan', 'Agusan del Sur'),
('PESO RTR Gym', 'RTR', 'Agusan del Norte'),
('CBR Cabadbaran', 'Cabadbaran', 'Agusan del Norte'),
('PESO San Luis Gym', 'San Luis', 'Agusan del Sur');

-- ============================================================================
-- 2025 JFA RECORDS (from 2025-JFA-AND-DOCUMENT-TRACKING.xlsx)
-- ============================================================================
-- JANUARY 2025: 2 JFAs
INSERT INTO jfa_records (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, job_fair_date_end, venue_id, available_job_orders, job_site, status, remarks) VALUES
('BUT-25-0130-001', (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 2025, 1, '2025-01-30', '2025-01-31', (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 150, 'Saudi Arabia, Qatar, UAE', 'completed', NULL),
('BUT-25-0130-002', (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 2025, 1, '2025-01-30', '2025-01-31', (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 80, 'Japan, Taiwan', 'completed', NULL);

-- FEBRUARY 2025: 3 JFAs
INSERT INTO jfa_records (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, job_fair_date_end, venue_id, available_job_orders, job_site, status, remarks) VALUES
('BUT-25-0213-003', (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 2025, 2, '2025-02-13', '2025-02-14', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 120, 'Saudi Arabia, Kuwait', 'completed', NULL),
('BUT-25-0213-004', (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 2025, 2, '2025-02-13', '2025-02-14', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 90, 'Qatar, Bahrain', 'completed', NULL),
('BUT-25-0220-005', (SELECT id FROM agencies WHERE agency_name='ACES INTERNATIONAL MANPOWER SERVICES'), 2025, 2, '2025-02-20', NULL, (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 60, 'UAE', 'not_participated', 'Not participated');

-- MARCH 2025: 5 JFAs
INSERT INTO jfa_records (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, job_fair_date_end, venue_id, available_job_orders, job_site, status, remarks) VALUES
('BUT-25-0313-006', (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 2025, 3, '2025-03-13', '2025-03-14', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 100, 'Saudi Arabia', 'completed', NULL),
('BUT-25-0313-007', (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 2025, 3, '2025-03-13', '2025-03-14', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 85, 'Kuwait, Qatar', 'completed', NULL),
('BUT-25-0325-008', (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 2025, 3, '2025-03-25', NULL, (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 70, 'Japan', 'completed', NULL),
('BUT-25-0325-009', (SELECT id FROM agencies WHERE agency_name='GOLDEN HORIZON PLACEMENT AGENCY'), 2025, 3, '2025-03-25', NULL, (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 50, 'Taiwan', 'cancelled', 'Job Fair was cancelled'),
('BUT-25-0327-010', (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 2025, 3, '2025-03-27', '2025-03-28', (SELECT id FROM venues WHERE venue_name='Cagdianao Barangay Hall'), 75, 'Saudi Arabia', 'completed', NULL);

-- APRIL 2025: 7 JFAs
INSERT INTO jfa_records (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, job_fair_date_end, venue_id, available_job_orders, job_site, status, remarks) VALUES
('BUT-25-0410-011', (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 2025, 4, '2025-04-10', NULL, (SELECT id FROM venues WHERE venue_name='PESO San Luis Gym'), 90, 'Saudi Arabia, Qatar', 'completed', NULL),
('BUT-25-0410-012', (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 2025, 4, '2025-04-10', NULL, (SELECT id FROM venues WHERE venue_name='PESO San Luis Gym'), 65, 'Kuwait', 'completed', NULL),
('BUT-25-0415-013', (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 2025, 4, '2025-04-15', NULL, (SELECT id FROM venues WHERE venue_name='SMCC Campus'), 80, 'UAE, Qatar', 'completed', NULL),
('BUT-25-0415-014', (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 2025, 4, '2025-04-15', NULL, (SELECT id FROM venues WHERE venue_name='SMCC Campus'), 55, 'Japan', 'completed', NULL),
('BUT-25-0422-015', (SELECT id FROM agencies WHERE agency_name='GOLDEN HORIZON PLACEMENT AGENCY'), 2025, 4, '2025-04-22', NULL, (SELECT id FROM venues WHERE venue_name='CSUCC Campus'), 60, 'Taiwan', 'completed', NULL),
('BUT-25-0422-016', (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 2025, 4, '2025-04-22', NULL, (SELECT id FROM venues WHERE venue_name='CSUCC Campus'), 70, 'Japan, Korea', 'completed', NULL),
('BUT-25-0428-017', (SELECT id FROM agencies WHERE agency_name='SMC MANPOWER AGENCY PHILS. INC.'), 2025, 4, '2025-04-28', NULL, (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 45, 'UAE', 'not_participated', 'Late notice');

-- MAY 2025: 12 JFAs
INSERT INTO jfa_records (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, job_fair_date_end, venue_id, available_job_orders, job_site, status, remarks) VALUES
('BUT-25-0501-018', (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 2025, 5, '2025-05-01', NULL, (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 100, 'Saudi Arabia', 'completed', NULL),
('BUT-25-0501-019', (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 2025, 5, '2025-05-01', NULL, (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 85, 'Kuwait, Qatar', 'completed', NULL),
('BUT-25-0501-020', (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 2025, 5, '2025-05-01', NULL, (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 75, 'UAE', 'completed', NULL),
('BUT-25-0508-021', (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 2025, 5, '2025-05-08', NULL, (SELECT id FROM venues WHERE venue_name='Taboo Area, PDI'), 60, 'Japan', 'completed', NULL),
('BUT-25-0508-022', (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 2025, 5, '2025-05-08', NULL, (SELECT id FROM venues WHERE venue_name='Taboo Area, PDI'), 50, 'Taiwan', 'completed', NULL),
('BUT-25-0515-023', (SELECT id FROM agencies WHERE agency_name='GOLDEN HORIZON PLACEMENT AGENCY'), 2025, 5, '2025-05-15', NULL, (SELECT id FROM venues WHERE venue_name='St. Theresa College Gym'), 70, 'Saudi Arabia', 'completed', NULL),
('BUT-25-0515-024', (SELECT id FROM agencies WHERE agency_name='SMC MANPOWER AGENCY PHILS. INC.'), 2025, 5, '2025-05-15', NULL, (SELECT id FROM venues WHERE venue_name='St. Theresa College Gym'), 40, 'UAE', 'completed', NULL),
('BUT-25-0520-025', (SELECT id FROM agencies WHERE agency_name='ACES INTERNATIONAL MANPOWER SERVICES'), 2025, 5, '2025-05-20', NULL, (SELECT id FROM venues WHERE venue_name='NORMI Campus'), 55, 'Qatar', 'completed', NULL),
('BUT-25-0520-026', (SELECT id FROM agencies WHERE agency_name='PHILWORLD RECRUITMENT AGENCY'), 2025, 5, '2025-05-20', NULL, (SELECT id FROM venues WHERE venue_name='NORMI Campus'), 45, 'Japan', 'completed', NULL),
('BUT-25-0525-027', (SELECT id FROM agencies WHERE agency_name='MYRIAD DIVERSIFIED SERVICES INC.'), 2025, 5, '2025-05-25', NULL, (SELECT id FROM venues WHERE venue_name='NEMSU Tandag Campus'), 65, 'Saudi Arabia', 'completed', NULL),
('BUT-25-0525-028', (SELECT id FROM agencies WHERE agency_name='DIMENSION-ALL MANPOWER SERVICES INC.'), 2025, 5, '2025-05-25', NULL, (SELECT id FROM venues WHERE venue_name='NEMSU Tandag Campus'), 50, 'Kuwait', 'completed', NULL),
('BUT-25-0530-029', (SELECT id FROM agencies WHERE agency_name='ORIENT EXPAT MANPOWER SERVICES'), 2025, 5, '2025-05-30', NULL, (SELECT id FROM venues WHERE venue_name='PESO RTR Gym'), 40, 'UAE', 'completed', NULL);

-- JUNE 2025: 27 JFAs (largest month)
INSERT INTO jfa_records (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, job_fair_date_end, venue_id, available_job_orders, job_site, status, remarks) VALUES
('BUT-25-0602-030', (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 2025, 6, '2025-06-02', NULL, (SELECT id FROM venues WHERE venue_name='NEMSU Tagbina Campus'), 80, 'Saudi Arabia', 'completed', NULL),
('BUT-25-0602-031', (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 2025, 6, '2025-06-02', NULL, (SELECT id FROM venues WHERE venue_name='NEMSU Tagbina Campus'), 65, 'Kuwait', 'completed', NULL),
('BUT-25-0605-032', (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 2025, 6, '2025-06-05', NULL, (SELECT id FROM venues WHERE venue_name='Lianga Municipal Hall'), 70, 'UAE, Qatar', 'completed', NULL),
('BUT-25-0605-033', (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 2025, 6, '2025-06-05', NULL, (SELECT id FROM venues WHERE venue_name='Lianga Municipal Hall'), 55, 'Japan', 'completed', NULL),
('BUT-25-0608-034', (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 2025, 6, '2025-06-08', NULL, (SELECT id FROM venues WHERE venue_name='Cagwait Municipal Hall'), 45, 'Taiwan', 'completed', NULL),
('BUT-25-0610-035', (SELECT id FROM agencies WHERE agency_name='GOLDEN HORIZON PLACEMENT AGENCY'), 2025, 6, '2025-06-10', NULL, (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 90, 'Saudi Arabia, UAE', 'completed', NULL),
('BUT-25-0610-036', (SELECT id FROM agencies WHERE agency_name='SMC MANPOWER AGENCY PHILS. INC.'), 2025, 6, '2025-06-10', NULL, (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 60, 'Qatar', 'completed', NULL),
('BUT-25-0610-037', (SELECT id FROM agencies WHERE agency_name='ACES INTERNATIONAL MANPOWER SERVICES'), 2025, 6, '2025-06-10', NULL, (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 50, 'Kuwait', 'completed', NULL),
('BUT-25-0610-038', (SELECT id FROM agencies WHERE agency_name='PHILWORLD RECRUITMENT AGENCY'), 2025, 6, '2025-06-10', NULL, (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 40, 'Japan', 'completed', NULL),
('BUT-25-0612-039', (SELECT id FROM agencies WHERE agency_name='MYRIAD DIVERSIFIED SERVICES INC.'), 2025, 6, '2025-06-12', NULL, (SELECT id FROM venues WHERE venue_name='Prosperidad Municipal Gym'), 75, 'Saudi Arabia', 'completed', NULL),
('BUT-25-0612-040', (SELECT id FROM agencies WHERE agency_name='DIMENSION-ALL MANPOWER SERVICES INC.'), 2025, 6, '2025-06-12', NULL, (SELECT id FROM venues WHERE venue_name='Prosperidad Municipal Gym'), 55, 'UAE', 'completed', NULL),
('BUT-25-0615-041', (SELECT id FROM agencies WHERE agency_name='ORIENT EXPAT MANPOWER SERVICES'), 2025, 6, '2025-06-15', NULL, (SELECT id FROM venues WHERE venue_name='San Francisco Town Hall'), 60, 'Taiwan, Japan', 'completed', NULL),
('BUT-25-0615-042', (SELECT id FROM agencies WHERE agency_name='PACIFIC ACE HUMAN RESOURCES CORP.'), 2025, 6, '2025-06-15', NULL, (SELECT id FROM venues WHERE venue_name='San Francisco Town Hall'), 45, 'Qatar', 'completed', NULL),
('BUT-25-0618-043', (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 2025, 6, '2025-06-18', NULL, (SELECT id FROM venues WHERE venue_name='Tubajon Municipal Hall'), 70, 'Saudi Arabia', 'completed', NULL),
('BUT-25-0618-044', (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 2025, 6, '2025-06-18', NULL, (SELECT id FROM venues WHERE venue_name='Tubajon Municipal Hall'), 50, 'Kuwait', 'completed', NULL),
('BUT-25-0620-045', (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 2025, 6, '2025-06-20', NULL, (SELECT id FROM venues WHERE venue_name='Bunawan Municipal Hall'), 65, 'UAE', 'completed', NULL),
('BUT-25-0620-046', (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 2025, 6, '2025-06-20', NULL, (SELECT id FROM venues WHERE venue_name='Bunawan Municipal Hall'), 40, 'Japan', 'completed', NULL),
('BUT-25-0622-047', (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 2025, 6, '2025-06-22', NULL, (SELECT id FROM venues WHERE venue_name='Bayugan City Hall'), 55, 'Taiwan', 'completed', NULL),
('BUT-25-0622-048', (SELECT id FROM agencies WHERE agency_name='GOLDEN HORIZON PLACEMENT AGENCY'), 2025, 6, '2025-06-22', NULL, (SELECT id FROM venues WHERE venue_name='Bayugan City Hall'), 80, 'Saudi Arabia', 'completed', NULL),
('BUT-25-0625-049', (SELECT id FROM agencies WHERE agency_name='SMC MANPOWER AGENCY PHILS. INC.'), 2025, 6, '2025-06-25', NULL, (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 45, 'UAE, Qatar', 'completed', NULL),
('BUT-25-0625-050', (SELECT id FROM agencies WHERE agency_name='ACES INTERNATIONAL MANPOWER SERVICES'), 2025, 6, '2025-06-25', NULL, (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 50, 'Kuwait', 'completed', NULL),
('BUT-25-0625-051', (SELECT id FROM agencies WHERE agency_name='MYRIAD DIVERSIFIED SERVICES INC.'), 2025, 6, '2025-06-25', NULL, (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 60, 'Japan', 'completed', NULL),
('BUT-25-0627-052', (SELECT id FROM agencies WHERE agency_name='PHILWORLD RECRUITMENT AGENCY'), 2025, 6, '2025-06-27', NULL, (SELECT id FROM venues WHERE venue_name='NEMSU Tandag Campus'), 35, 'Taiwan', 'completed', NULL),
('BUT-25-0627-053', (SELECT id FROM agencies WHERE agency_name='DIMENSION-ALL MANPOWER SERVICES INC.'), 2025, 6, '2025-06-27', NULL, (SELECT id FROM venues WHERE venue_name='NEMSU Tandag Campus'), 40, 'Saudi Arabia', 'completed', NULL),
('BUT-25-0628-054', (SELECT id FROM agencies WHERE agency_name='ORIENT EXPAT MANPOWER SERVICES'), 2025, 6, '2025-06-28', NULL, (SELECT id FROM venues WHERE venue_name='PESO RTR Gym'), 30, 'UAE', 'completed', NULL),
('BUT-25-0628-055', (SELECT id FROM agencies WHERE agency_name='PACIFIC ACE HUMAN RESOURCES CORP.'), 2025, 6, '2025-06-28', NULL, (SELECT id FROM venues WHERE venue_name='PESO RTR Gym'), 35, 'Qatar', 'cancelled', 'Job Fair was cancelled'),
('BUT-25-0630-056', (SELECT id FROM agencies WHERE agency_name='GREAT WORLD MANPOWER SERVICES'), 2025, 6, '2025-06-30', NULL, (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 50, 'Saudi Arabia, Japan', 'completed', NULL);

-- JULY-DECEMBER 2025: 79 JFAs total (representative samples for each month)
-- JUL: 10 JFAs
INSERT INTO jfa_records (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, venue_id, available_job_orders, job_site, status) VALUES
('BUT-25-0703-057', (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 2025, 7, '2025-07-03', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 80, 'Saudi Arabia', 'completed'),
('BUT-25-0703-058', (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 2025, 7, '2025-07-03', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 65, 'Kuwait', 'completed'),
('BUT-25-0710-059', (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 2025, 7, '2025-07-10', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 90, 'UAE', 'completed'),
('BUT-25-0710-060', (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 2025, 7, '2025-07-10', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 50, 'Japan', 'completed'),
('BUT-25-0715-061', (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 2025, 7, '2025-07-15', (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 70, 'Taiwan', 'completed'),
('BUT-25-0715-062', (SELECT id FROM agencies WHERE agency_name='GOLDEN HORIZON PLACEMENT AGENCY'), 2025, 7, '2025-07-15', (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 55, 'Qatar', 'completed'),
('BUT-25-0720-063', (SELECT id FROM agencies WHERE agency_name='SMC MANPOWER AGENCY PHILS. INC.'), 2025, 7, '2025-07-20', (SELECT id FROM venues WHERE venue_name='Prosperidad Municipal Gym'), 45, 'UAE', 'completed'),
('BUT-25-0720-064', (SELECT id FROM agencies WHERE agency_name='ACES INTERNATIONAL MANPOWER SERVICES'), 2025, 7, '2025-07-20', (SELECT id FROM venues WHERE venue_name='Prosperidad Municipal Gym'), 60, 'Saudi Arabia', 'completed'),
('BUT-25-0725-065', (SELECT id FROM agencies WHERE agency_name='MYRIAD DIVERSIFIED SERVICES INC.'), 2025, 7, '2025-07-25', (SELECT id FROM venues WHERE venue_name='SMCC Campus'), 40, 'Japan', 'completed'),
('BUT-25-0725-066', (SELECT id FROM agencies WHERE agency_name='DIMENSION-ALL MANPOWER SERVICES INC.'), 2025, 7, '2025-07-25', (SELECT id FROM venues WHERE venue_name='SMCC Campus'), 35, 'Kuwait', 'completed');

-- AUG: 12 JFAs
INSERT INTO jfa_records (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, venue_id, available_job_orders, job_site, status) VALUES
('BUT-25-0805-067', (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 2025, 8, '2025-08-05', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 85, 'Saudi Arabia', 'completed'),
('BUT-25-0805-068', (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 2025, 8, '2025-08-05', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 70, 'Kuwait', 'completed'),
('BUT-25-0808-069', (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 2025, 8, '2025-08-08', (SELECT id FROM venues WHERE venue_name='CSUCC Campus'), 60, 'UAE', 'completed'),
('BUT-25-0808-070', (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 2025, 8, '2025-08-08', (SELECT id FROM venues WHERE venue_name='CSUCC Campus'), 45, 'Japan', 'completed'),
('BUT-25-0812-071', (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 2025, 8, '2025-08-12', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 55, 'Taiwan', 'completed'),
('BUT-25-0812-072', (SELECT id FROM agencies WHERE agency_name='GOLDEN HORIZON PLACEMENT AGENCY'), 2025, 8, '2025-08-12', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 65, 'Saudi Arabia', 'completed'),
('BUT-25-0815-073', (SELECT id FROM agencies WHERE agency_name='SMC MANPOWER AGENCY PHILS. INC.'), 2025, 8, '2025-08-15', (SELECT id FROM venues WHERE venue_name='Bunawan Municipal Hall'), 40, 'Qatar', 'completed'),
('BUT-25-0815-074', (SELECT id FROM agencies WHERE agency_name='ACES INTERNATIONAL MANPOWER SERVICES'), 2025, 8, '2025-08-15', (SELECT id FROM venues WHERE venue_name='Bunawan Municipal Hall'), 50, 'UAE', 'completed'),
('BUT-25-0820-075', (SELECT id FROM agencies WHERE agency_name='MYRIAD DIVERSIFIED SERVICES INC.'), 2025, 8, '2025-08-20', (SELECT id FROM venues WHERE venue_name='Bayugan City Hall'), 60, 'Japan', 'completed'),
('BUT-25-0820-076', (SELECT id FROM agencies WHERE agency_name='PHILWORLD RECRUITMENT AGENCY'), 2025, 8, '2025-08-20', (SELECT id FROM venues WHERE venue_name='Bayugan City Hall'), 45, 'Taiwan', 'completed'),
('BUT-25-0825-077', (SELECT id FROM agencies WHERE agency_name='ORIENT EXPAT MANPOWER SERVICES'), 2025, 8, '2025-08-25', (SELECT id FROM venues WHERE venue_name='NEMSU Tandag Campus'), 35, 'Saudi Arabia', 'completed'),
('BUT-25-0825-078', (SELECT id FROM agencies WHERE agency_name='PACIFIC ACE HUMAN RESOURCES CORP.'), 2025, 8, '2025-08-25', (SELECT id FROM venues WHERE venue_name='NEMSU Tandag Campus'), 40, 'Kuwait', 'completed');

-- SEP: 10 JFAs
INSERT INTO jfa_records (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, venue_id, available_job_orders, job_site, status) VALUES
('BUT-25-0903-079', (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 2025, 9, '2025-09-03', (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 75, 'Saudi Arabia', 'completed'),
('BUT-25-0903-080', (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 2025, 9, '2025-09-03', (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 60, 'Kuwait', 'completed'),
('BUT-25-0910-081', (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 2025, 9, '2025-09-10', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 80, 'UAE', 'completed'),
('BUT-25-0910-082', (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 2025, 9, '2025-09-10', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 50, 'Japan', 'completed'),
('BUT-25-0915-083', (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 2025, 9, '2025-09-15', (SELECT id FROM venues WHERE venue_name='Prosperidad Municipal Gym'), 45, 'Taiwan', 'completed'),
('BUT-25-0915-084', (SELECT id FROM agencies WHERE agency_name='GOLDEN HORIZON PLACEMENT AGENCY'), 2025, 9, '2025-09-15', (SELECT id FROM venues WHERE venue_name='Prosperidad Municipal Gym'), 55, 'Saudi Arabia', 'completed'),
('BUT-25-0920-085', (SELECT id FROM agencies WHERE agency_name='SMC MANPOWER AGENCY PHILS. INC.'), 2025, 9, '2025-09-20', (SELECT id FROM venues WHERE venue_name='SMCC Campus'), 40, 'Qatar', 'completed'),
('BUT-25-0920-086', (SELECT id FROM agencies WHERE agency_name='MYRIAD DIVERSIFIED SERVICES INC.'), 2025, 9, '2025-09-20', (SELECT id FROM venues WHERE venue_name='SMCC Campus'), 50, 'UAE', 'completed'),
('BUT-25-0925-087', (SELECT id FROM agencies WHERE agency_name='DIMENSION-ALL MANPOWER SERVICES INC.'), 2025, 9, '2025-09-25', (SELECT id FROM venues WHERE venue_name='CSUCC Campus'), 35, 'Japan', 'completed'),
('BUT-25-0925-088', (SELECT id FROM agencies WHERE agency_name='ACES INTERNATIONAL MANPOWER SERVICES'), 2025, 9, '2025-09-25', (SELECT id FROM venues WHERE venue_name='CSUCC Campus'), 60, 'Kuwait', 'completed');

-- OCT: 13 JFAs
INSERT INTO jfa_records (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, venue_id, available_job_orders, job_site, status) VALUES
('BUT-25-1002-089', (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 2025, 10, '2025-10-02', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 90, 'Saudi Arabia', 'completed'),
('BUT-25-1002-090', (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 2025, 10, '2025-10-02', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 75, 'Kuwait', 'completed'),
('BUT-25-1005-091', (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 2025, 10, '2025-10-05', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 60, 'UAE', 'completed'),
('BUT-25-1005-092', (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 2025, 10, '2025-10-05', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 50, 'Japan', 'completed'),
('BUT-25-1008-093', (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 2025, 10, '2025-10-08', (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 45, 'Taiwan', 'completed'),
('BUT-25-1008-094', (SELECT id FROM agencies WHERE agency_name='GOLDEN HORIZON PLACEMENT AGENCY'), 2025, 10, '2025-10-08', (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 65, 'Saudi Arabia', 'completed'),
('BUT-25-1012-095', (SELECT id FROM agencies WHERE agency_name='SMC MANPOWER AGENCY PHILS. INC.'), 2025, 10, '2025-10-12', (SELECT id FROM venues WHERE venue_name='Prosperidad Municipal Gym'), 40, 'Qatar', 'completed'),
('BUT-25-1012-096', (SELECT id FROM agencies WHERE agency_name='ACES INTERNATIONAL MANPOWER SERVICES'), 2025, 10, '2025-10-12', (SELECT id FROM venues WHERE venue_name='Prosperidad Municipal Gym'), 55, 'UAE', 'completed'),
('BUT-25-1015-097', (SELECT id FROM agencies WHERE agency_name='MYRIAD DIVERSIFIED SERVICES INC.'), 2025, 10, '2025-10-15', (SELECT id FROM venues WHERE venue_name='NEMSU Tagbina Campus'), 70, 'Japan', 'completed'),
('BUT-25-1015-098', (SELECT id FROM agencies WHERE agency_name='PHILWORLD RECRUITMENT AGENCY'), 2025, 10, '2025-10-15', (SELECT id FROM venues WHERE venue_name='NEMSU Tagbina Campus'), 35, 'Taiwan', 'completed'),
('BUT-25-1020-099', (SELECT id FROM agencies WHERE agency_name='DIMENSION-ALL MANPOWER SERVICES INC.'), 2025, 10, '2025-10-20', (SELECT id FROM venues WHERE venue_name='Lianga Municipal Hall'), 50, 'Saudi Arabia', 'completed'),
('BUT-25-1020-100', (SELECT id FROM agencies WHERE agency_name='ORIENT EXPAT MANPOWER SERVICES'), 2025, 10, '2025-10-20', (SELECT id FROM venues WHERE venue_name='Lianga Municipal Hall'), 40, 'Kuwait', 'completed'),
('BUT-25-1025-101', (SELECT id FROM agencies WHERE agency_name='PACIFIC ACE HUMAN RESOURCES CORP.'), 2025, 10, '2025-10-25', (SELECT id FROM venues WHERE venue_name='Bunawan Municipal Hall'), 55, 'UAE, Qatar', 'completed');

-- NOV: 14 JFAs
INSERT INTO jfa_records (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, venue_id, available_job_orders, job_site, status) VALUES
('BUT-25-1103-102', (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 2025, 11, '2025-11-03', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 85, 'Saudi Arabia', 'completed'),
('BUT-25-1103-103', (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 2025, 11, '2025-11-03', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 70, 'Kuwait', 'completed'),
('BUT-25-1106-104', (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 2025, 11, '2025-11-06', (SELECT id FROM venues WHERE venue_name='SMCC Campus'), 60, 'UAE', 'completed'),
('BUT-25-1106-105', (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 2025, 11, '2025-11-06', (SELECT id FROM venues WHERE venue_name='SMCC Campus'), 50, 'Japan', 'completed'),
('BUT-25-1110-106', (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 2025, 11, '2025-11-10', (SELECT id FROM venues WHERE venue_name='CSUCC Campus'), 45, 'Taiwan', 'completed'),
('BUT-25-1110-107', (SELECT id FROM agencies WHERE agency_name='GOLDEN HORIZON PLACEMENT AGENCY'), 2025, 11, '2025-11-10', (SELECT id FROM venues WHERE venue_name='CSUCC Campus'), 75, 'Saudi Arabia', 'completed'),
('BUT-25-1113-108', (SELECT id FROM agencies WHERE agency_name='SMC MANPOWER AGENCY PHILS. INC.'), 2025, 11, '2025-11-13', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 40, 'Qatar', 'completed'),
('BUT-25-1113-109', (SELECT id FROM agencies WHERE agency_name='ACES INTERNATIONAL MANPOWER SERVICES'), 2025, 11, '2025-11-13', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 55, 'UAE', 'completed'),
('BUT-25-1118-110', (SELECT id FROM agencies WHERE agency_name='MYRIAD DIVERSIFIED SERVICES INC.'), 2025, 11, '2025-11-18', (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 65, 'Japan', 'completed'),
('BUT-25-1118-111', (SELECT id FROM agencies WHERE agency_name='PHILWORLD RECRUITMENT AGENCY'), 2025, 11, '2025-11-18', (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 40, 'Taiwan', 'completed'),
('BUT-25-1122-112', (SELECT id FROM agencies WHERE agency_name='DIMENSION-ALL MANPOWER SERVICES INC.'), 2025, 11, '2025-11-22', (SELECT id FROM venues WHERE venue_name='Bayugan City Hall'), 50, 'Saudi Arabia', 'completed'),
('BUT-25-1122-113', (SELECT id FROM agencies WHERE agency_name='ORIENT EXPAT MANPOWER SERVICES'), 2025, 11, '2025-11-22', (SELECT id FROM venues WHERE venue_name='Bayugan City Hall'), 35, 'Kuwait', 'completed'),
('BUT-25-1125-114', (SELECT id FROM agencies WHERE agency_name='PACIFIC ACE HUMAN RESOURCES CORP.'), 2025, 11, '2025-11-25', (SELECT id FROM venues WHERE venue_name='Prosperidad Municipal Gym'), 60, 'UAE', 'completed'),
('BUT-25-1125-115', (SELECT id FROM agencies WHERE agency_name='GREAT WORLD MANPOWER SERVICES'), 2025, 11, '2025-11-25', (SELECT id FROM venues WHERE venue_name='Prosperidad Municipal Gym'), 45, 'Qatar', 'completed');

-- DEC: 20 JFAs
INSERT INTO jfa_records (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, venue_id, available_job_orders, job_site, status) VALUES
('BUT-25-1202-116', (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 2025, 12, '2025-12-02', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 80, 'Saudi Arabia', 'completed'),
('BUT-25-1202-117', (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 2025, 12, '2025-12-02', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 65, 'Kuwait', 'completed'),
('BUT-25-1205-118', (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 2025, 12, '2025-12-05', (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 55, 'UAE', 'completed'),
('BUT-25-1205-119', (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 2025, 12, '2025-12-05', (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 50, 'Japan', 'completed'),
('BUT-25-1208-120', (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 2025, 12, '2025-12-08', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 40, 'Taiwan', 'completed'),
('BUT-25-1208-121', (SELECT id FROM agencies WHERE agency_name='GOLDEN HORIZON PLACEMENT AGENCY'), 2025, 12, '2025-12-08', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 70, 'Saudi Arabia', 'completed'),
('BUT-25-1210-122', (SELECT id FROM agencies WHERE agency_name='SMC MANPOWER AGENCY PHILS. INC.'), 2025, 12, '2025-12-10', (SELECT id FROM venues WHERE venue_name='SMCC Campus'), 35, 'Qatar', 'completed'),
('BUT-25-1210-123', (SELECT id FROM agencies WHERE agency_name='ACES INTERNATIONAL MANPOWER SERVICES'), 2025, 12, '2025-12-10', (SELECT id FROM venues WHERE venue_name='SMCC Campus'), 50, 'UAE', 'completed'),
('BUT-25-1212-124', (SELECT id FROM agencies WHERE agency_name='MYRIAD DIVERSIFIED SERVICES INC.'), 2025, 12, '2025-12-12', (SELECT id FROM venues WHERE venue_name='CSUCC Campus'), 60, 'Japan', 'completed'),
('BUT-25-1212-125', (SELECT id FROM agencies WHERE agency_name='PHILWORLD RECRUITMENT AGENCY'), 2025, 12, '2025-12-12', (SELECT id FROM venues WHERE venue_name='CSUCC Campus'), 45, 'Taiwan', 'completed'),
('BUT-25-1215-126', (SELECT id FROM agencies WHERE agency_name='DIMENSION-ALL MANPOWER SERVICES INC.'), 2025, 12, '2025-12-15', (SELECT id FROM venues WHERE venue_name='Prosperidad Municipal Gym'), 55, 'Saudi Arabia', 'completed'),
('BUT-25-1215-127', (SELECT id FROM agencies WHERE agency_name='ORIENT EXPAT MANPOWER SERVICES'), 2025, 12, '2025-12-15', (SELECT id FROM venues WHERE venue_name='Prosperidad Municipal Gym'), 40, 'Kuwait', 'completed'),
('BUT-25-1218-128', (SELECT id FROM agencies WHERE agency_name='PACIFIC ACE HUMAN RESOURCES CORP.'), 2025, 12, '2025-12-18', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 50, 'UAE', 'completed'),
('BUT-25-1218-129', (SELECT id FROM agencies WHERE agency_name='GREAT WORLD MANPOWER SERVICES'), 2025, 12, '2025-12-18', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 55, 'Qatar', 'completed'),
('BUT-25-1220-130', (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 2025, 12, '2025-12-20', (SELECT id FROM venues WHERE venue_name='Bunawan Municipal Hall'), 70, 'Saudi Arabia', 'completed'),
('BUT-25-1220-131', (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 2025, 12, '2025-12-20', (SELECT id FROM venues WHERE venue_name='Bunawan Municipal Hall'), 60, 'UAE', 'completed'),
('BUT-25-1222-132', (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 2025, 12, '2025-12-22', (SELECT id FROM venues WHERE venue_name='Bayugan City Hall'), 45, 'Japan', 'completed'),
('BUT-25-1222-133', (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 2025, 12, '2025-12-22', (SELECT id FROM venues WHERE venue_name='Bayugan City Hall'), 40, 'Taiwan', 'completed'),
('BUT-25-1226-134', (SELECT id FROM agencies WHERE agency_name='GOLDEN HORIZON PLACEMENT AGENCY'), 2025, 12, '2025-12-26', (SELECT id FROM venues WHERE venue_name='NEMSU Tandag Campus'), 75, 'Saudi Arabia', 'completed'),
('BUT-25-1226-135', (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 2025, 12, '2025-12-26', (SELECT id FROM venues WHERE venue_name='NEMSU Tandag Campus'), 50, 'Kuwait', 'completed');

-- ============================================================================
-- 2025 JFA DOCUMENT TRACKING
-- (Auto-created by trigger, update with actual dates)
-- ============================================================================
-- Update January JFA documents
UPDATE jfa_documents SET
    invitation_letter_date = '2025-01-20',
    affidavit_date = '2025-01-22',
    job_orders_date = '2025-01-23',
    representative_id_date = '2025-01-25',
    terminal_report_date = '2025-02-10',
    status_of_applicants = 'Hired: 15',
    status_date = '2025-02-15'
WHERE jfa_id = (SELECT id FROM jfa_records WHERE jfa_no = 'BUT-25-0130-001');

UPDATE jfa_documents SET
    invitation_letter_date = '2025-01-20',
    affidavit_date = '2025-01-22',
    job_orders_date = '2025-01-24',
    representative_id_date = '2025-01-26',
    terminal_report_date = '2025-02-12',
    status_of_applicants = 'Hired: 8',
    status_date = '2025-02-18'
WHERE jfa_id = (SELECT id FROM jfa_records WHERE jfa_no = 'BUT-25-0130-002');

-- Update February JFA documents
UPDATE jfa_documents SET
    invitation_letter_date = '2025-02-05',
    affidavit_date = '2025-02-07',
    job_orders_date = '2025-02-08',
    representative_id_date = '2025-02-10',
    terminal_report_date = '2025-03-01',
    status_of_applicants = 'Hired: 12',
    status_date = '2025-03-05'
WHERE jfa_id = (SELECT id FROM jfa_records WHERE jfa_no = 'BUT-25-0213-003');

UPDATE jfa_documents SET
    invitation_letter_date = '2025-02-05',
    affidavit_date = '2025-02-07',
    job_orders_date = '2025-02-09',
    representative_id_date = '2025-02-11',
    terminal_report_date = '2025-03-02',
    status_of_applicants = 'Hired: 10',
    status_date = '2025-03-06'
WHERE jfa_id = (SELECT id FROM jfa_records WHERE jfa_no = 'BUT-25-0213-004');

-- ============================================================================
-- 2026 JFA RECORDS (from 2026-JFA-TRACKING-NO.xlsx)
-- ============================================================================
-- JANUARY 2026: 1 JFA
INSERT INTO jfa_records (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, job_fair_date_end, venue_id, available_job_orders, job_site, status, remarks) VALUES
('BUT-26-0130-001', (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 2026, 1, '2026-01-30', NULL, (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 120, 'Japan, Taiwan', 'completed', NULL);

-- FEBRUARY 2026: 19 JFAs
INSERT INTO jfa_records (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, job_fair_date_end, venue_id, available_job_orders, job_site, status, remarks) VALUES
('BUT-26-0203-002', (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 2026, 2, '2026-02-23', NULL, (SELECT id FROM venues WHERE venue_name='CBR Cabadbaran'), 100, 'Saudi Arabia', 'completed', NULL),
('BUT-26-0203-003', (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 2026, 2, '2026-02-23', NULL, (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 80, 'Japan', 'completed', NULL),
('BUT-26-0203-004', (SELECT id FROM agencies WHERE agency_name='MYRIAD DIVERSIFIED SERVICES INC.'), 2026, 2, '2026-02-23', NULL, (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 75, 'UAE', 'completed', NULL),
('BUT-26-0203-005', (SELECT id FROM agencies WHERE agency_name='SMC MANPOWER AGENCY PHILS. INC.'), 2026, 2, '2026-02-23', NULL, (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 60, 'Qatar', 'completed', NULL),
('BUT-26-0205-006', (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 2026, 2, '2026-02-05', NULL, (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 90, 'Kuwait', 'completed', NULL),
('BUT-26-0207-007', (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 2026, 2, '2026-02-07', NULL, (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 85, 'Saudi Arabia', 'completed', NULL),
('BUT-26-0210-008', (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 2026, 2, '2026-02-10', NULL, (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 70, 'Japan', 'completed', NULL),
('BUT-26-0210-009', (SELECT id FROM agencies WHERE agency_name='GOLDEN HORIZON PLACEMENT AGENCY'), 2026, 2, '2026-02-10', NULL, (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 55, 'Taiwan', 'completed', NULL),
('BUT-26-0212-010', (SELECT id FROM agencies WHERE agency_name='ACES INTERNATIONAL MANPOWER SERVICES'), 2026, 2, '2026-02-12', NULL, (SELECT id FROM venues WHERE venue_name='Prosperidad Municipal Gym'), 65, 'UAE', 'completed', NULL),
('BUT-26-0212-011', (SELECT id FROM agencies WHERE agency_name='DIMENSION-ALL MANPOWER SERVICES INC.'), 2026, 2, '2026-02-12', NULL, (SELECT id FROM venues WHERE venue_name='Prosperidad Municipal Gym'), 50, 'Kuwait', 'completed', NULL),
('BUT-26-0215-012', (SELECT id FROM agencies WHERE agency_name='ORIENT EXPAT MANPOWER SERVICES'), 2026, 2, '2026-02-15', NULL, (SELECT id FROM venues WHERE venue_name='SMCC Campus'), 45, 'Qatar', 'completed', NULL),
('BUT-26-0215-013', (SELECT id FROM agencies WHERE agency_name='PACIFIC ACE HUMAN RESOURCES CORP.'), 2026, 2, '2026-02-15', NULL, (SELECT id FROM venues WHERE venue_name='SMCC Campus'), 40, 'Saudi Arabia', 'completed', NULL),
('BUT-26-0218-014', (SELECT id FROM agencies WHERE agency_name='PHILWORLD RECRUITMENT AGENCY'), 2026, 2, '2026-02-18', NULL, (SELECT id FROM venues WHERE venue_name='CSUCC Campus'), 55, 'Japan', 'completed', NULL),
('BUT-26-0218-015', (SELECT id FROM agencies WHERE agency_name='GREAT WORLD MANPOWER SERVICES'), 2026, 2, '2026-02-18', NULL, (SELECT id FROM venues WHERE venue_name='CSUCC Campus'), 50, 'Taiwan', 'completed', NULL),
('BUT-26-0220-016', (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 2026, 2, '2026-02-20', NULL, (SELECT id FROM venues WHERE venue_name='Bunawan Municipal Hall'), 70, 'Saudi Arabia', 'completed', NULL),
('BUT-26-0220-017', (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 2026, 2, '2026-02-20', NULL, (SELECT id FROM venues WHERE venue_name='Bunawan Municipal Hall'), 60, 'Kuwait', 'completed', NULL),
('BUT-26-0222-018', (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 2026, 2, '2026-02-22', NULL, (SELECT id FROM venues WHERE venue_name='Bayugan City Hall'), 75, 'UAE', 'completed', NULL),
('BUT-26-0222-019', (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 2026, 2, '2026-02-22', NULL, (SELECT id FROM venues WHERE venue_name='Bayugan City Hall'), 65, 'Japan', 'completed', NULL),
('BUT-26-0225-020', (SELECT id FROM agencies WHERE agency_name='MYRIAD DIVERSIFIED SERVICES INC.'), 2026, 2, '2026-02-25', NULL, (SELECT id FROM venues WHERE venue_name='NEMSU Tandag Campus'), 50, 'Saudi Arabia', 'completed', NULL);

-- Update 2026 JFA documents with dates
UPDATE jfa_documents SET
    affidavit_date = '2026-01-25',
    job_orders_date = '2026-01-27'
WHERE jfa_id = (SELECT id FROM jfa_records WHERE jfa_no = 'BUT-26-0130-001');

UPDATE jfa_documents SET
    affidavit_date = '2026-02-18',
    job_orders_date = '2026-02-19',
    representative_id_date = '2026-02-20',
    terminal_report_date = '2026-03-05'
WHERE jfa_id = (SELECT id FROM jfa_records WHERE jfa_no = 'BUT-26-0203-002');

UPDATE jfa_documents SET
    affidavit_date = '2026-02-18',
    job_orders_date = '2026-02-19',
    representative_id_date = '2026-02-20',
    terminal_report_date = '2026-03-05'
WHERE jfa_id = (SELECT id FROM jfa_records WHERE jfa_no = 'BUT-26-0203-003');

UPDATE jfa_documents SET
    affidavit_date = '2026-02-18',
    job_orders_date = '2026-02-20',
    representative_id_date = '2026-02-21',
    terminal_report_date = '2026-03-06'
WHERE jfa_id = (SELECT id FROM jfa_records WHERE jfa_no = 'BUT-26-0203-004');

UPDATE jfa_documents SET
    affidavit_date = '2026-02-19',
    job_orders_date = '2026-02-20',
    representative_id_date = '2026-02-21',
    terminal_report_date = '2026-03-06'
WHERE jfa_id = (SELECT id FROM jfa_records WHERE jfa_no = 'BUT-26-0203-005');

-- MARCH 2026: 1 JFA placeholder
INSERT INTO jfa_records (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, venue_id, available_job_orders, job_site, status, remarks) VALUES
('BUT-26-0304-021', (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 2026, 3, '2026-03-05', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 0, NULL, 'active', 'Placeholder');

-- ============================================================================
-- 2025 JOB FAIR EVENTS (from 2025-JOB-FAIR-REPORT.xlsx)
-- ============================================================================
-- JANUARY 2025: 1 job fair, 45 applicants (25M, 20F), 2 land-based
INSERT INTO job_fair_events (fiscal_year, month, organizer_id, job_fair_date_start, job_fair_date_end, venue_id, num_job_fairs_facilitated) VALUES
(2025, 1, (SELECT id FROM agencies WHERE agency_name='LGU-CABADBARAN'), '2025-01-30', '2025-01-31', (SELECT id FROM venues WHERE venue_name='Cabadbaran City Gym'), 1);

INSERT INTO job_fair_participants (event_id, agency_id, jfa_id, agency_category, registered_applicants_male, registered_applicants_female) VALUES
((SELECT id FROM job_fair_events WHERE fiscal_year=2025 AND month=1 LIMIT 1), (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), (SELECT id FROM jfa_records WHERE jfa_no='BUT-25-0130-001'), 'land-based', 15, 12),
((SELECT id FROM job_fair_events WHERE fiscal_year=2025 AND month=1 LIMIT 1), (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), (SELECT id FROM jfa_records WHERE jfa_no='BUT-25-0130-002'), 'land-based', 10, 8);

-- FEBRUARY 2025: 1 job fair at San Jose
INSERT INTO job_fair_events (fiscal_year, month, organizer_id, job_fair_date_start, job_fair_date_end, venue_id, num_job_fairs_facilitated) VALUES
(2025, 2, (SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF SAN JOSE, DINAGAT ISLAND'), '2025-02-13', '2025-02-14', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 1);

INSERT INTO job_fair_participants (event_id, agency_id, jfa_id, agency_category, registered_applicants_male, registered_applicants_female) VALUES
((SELECT id FROM job_fair_events WHERE fiscal_year=2025 AND month=2 LIMIT 1), (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), (SELECT id FROM jfa_records WHERE jfa_no='BUT-25-0213-003'), 'land-based', 18, 14),
((SELECT id FROM job_fair_events WHERE fiscal_year=2025 AND month=2 LIMIT 1), (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), (SELECT id FROM jfa_records WHERE jfa_no='BUT-25-0213-004'), 'land-based', 12, 10);

-- MARCH 2025: 2 job fairs
INSERT INTO job_fair_events (fiscal_year, month, organizer_id, job_fair_date_start, job_fair_date_end, venue_id, num_job_fairs_facilitated) VALUES
(2025, 3, (SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF SAN JOSE, DINAGAT ISLAND'), '2025-03-13', '2025-03-14', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 1),
(2025, 3, (SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF CAGDIANAO'), '2025-03-27', '2025-03-28', (SELECT id FROM venues WHERE venue_name='Cagdianao Barangay Hall'), 1);

INSERT INTO job_fair_participants (event_id, agency_id, agency_category, registered_applicants_male, registered_applicants_female) VALUES
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=3 AND v.venue_name='San Jose Municipal Hall'), (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 'land-based', 20, 18),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=3 AND v.venue_name='San Jose Municipal Hall'), (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 'land-based', 15, 12),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=3 AND v.venue_name='Cagdianao Barangay Hall'), (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 'land-based', 10, 8);

-- APRIL 2025: 3 job fairs
INSERT INTO job_fair_events (fiscal_year, month, organizer_id, job_fair_date_start, venue_id, num_job_fairs_facilitated) VALUES
(2025, 4, (SELECT id FROM agencies WHERE agency_name='DOLE-AGUSAN DEL SUR'), '2025-04-10', (SELECT id FROM venues WHERE venue_name='PESO San Luis Gym'), 1),
(2025, 4, (SELECT id FROM agencies WHERE agency_name='SMCC'), '2025-04-15', (SELECT id FROM venues WHERE venue_name='SMCC Campus'), 1),
(2025, 4, (SELECT id FROM agencies WHERE agency_name='CSUCC'), '2025-04-22', (SELECT id FROM venues WHERE venue_name='CSUCC Campus'), 1);

INSERT INTO job_fair_participants (event_id, agency_id, agency_category, registered_applicants_male, registered_applicants_female) VALUES
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=4 AND v.venue_name='PESO San Luis Gym'), (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 'land-based', 22, 18),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=4 AND v.venue_name='PESO San Luis Gym'), (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 'land-based', 15, 12),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=4 AND v.venue_name='SMCC Campus'), (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 'land-based', 18, 15),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=4 AND v.venue_name='SMCC Campus'), (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 'land-based', 14, 10),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=4 AND v.venue_name='CSUCC Campus'), (SELECT id FROM agencies WHERE agency_name='GOLDEN HORIZON PLACEMENT AGENCY'), 'land-based', 16, 14),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=4 AND v.venue_name='CSUCC Campus'), (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 'land-based', 12, 10);

-- MAY 2025: 6 job fairs, 362 applicants (173M, 189F), 18 land-based
INSERT INTO job_fair_events (fiscal_year, month, organizer_id, job_fair_date_start, venue_id, num_job_fairs_facilitated) VALUES
(2025, 5, (SELECT id FROM agencies WHERE agency_name='DOLE CARAGA'), '2025-05-01', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 1),
(2025, 5, (SELECT id FROM agencies WHERE agency_name='PPESO-PDI'), '2025-05-08', (SELECT id FROM venues WHERE venue_name='Taboo Area, PDI'), 1),
(2025, 5, (SELECT id FROM agencies WHERE agency_name='ST. THERESA COLLEGE'), '2025-05-15', (SELECT id FROM venues WHERE venue_name='St. Theresa College Gym'), 1),
(2025, 5, (SELECT id FROM agencies WHERE agency_name='NORMI'), '2025-05-20', (SELECT id FROM venues WHERE venue_name='NORMI Campus'), 1),
(2025, 5, (SELECT id FROM agencies WHERE agency_name='NEMSU TANDAG'), '2025-05-25', (SELECT id FROM venues WHERE venue_name='NEMSU Tandag Campus'), 1),
(2025, 5, (SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF RTR'), '2025-05-30', (SELECT id FROM venues WHERE venue_name='PESO RTR Gym'), 1);

INSERT INTO job_fair_participants (event_id, agency_id, agency_category, registered_applicants_male, registered_applicants_female) VALUES
-- DOLE CARAGA Robinsons
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=5 AND v.venue_name='Robinsons Place Butuan'), (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 'land-based', 15, 18),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=5 AND v.venue_name='Robinsons Place Butuan'), (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 'land-based', 12, 14),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=5 AND v.venue_name='Robinsons Place Butuan'), (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 'land-based', 10, 12),
-- PPeso-PDI
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=5 AND v.venue_name='Taboo Area, PDI'), (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 'land-based', 18, 20),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=5 AND v.venue_name='Taboo Area, PDI'), (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 'land-based', 14, 16),
-- St. Theresa College
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=5 AND v.venue_name='St. Theresa College Gym'), (SELECT id FROM agencies WHERE agency_name='GOLDEN HORIZON PLACEMENT AGENCY'), 'land-based', 16, 18),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=5 AND v.venue_name='St. Theresa College Gym'), (SELECT id FROM agencies WHERE agency_name='SMC MANPOWER AGENCY PHILS. INC.'), 'land-based', 10, 12),
-- NORMI
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=5 AND v.venue_name='NORMI Campus'), (SELECT id FROM agencies WHERE agency_name='ACES INTERNATIONAL MANPOWER SERVICES'), 'land-based', 20, 22),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=5 AND v.venue_name='NORMI Campus'), (SELECT id FROM agencies WHERE agency_name='PHILWORLD RECRUITMENT AGENCY'), 'land-based', 15, 16),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=5 AND v.venue_name='NORMI Campus'), (SELECT id FROM agencies WHERE agency_name='ORIENT EXPAT MANPOWER SERVICES'), 'land-based', 8, 10),
-- NEMSU Tandag
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=5 AND v.venue_name='NEMSU Tandag Campus'), (SELECT id FROM agencies WHERE agency_name='MYRIAD DIVERSIFIED SERVICES INC.'), 'land-based', 18, 15),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=5 AND v.venue_name='NEMSU Tandag Campus'), (SELECT id FROM agencies WHERE agency_name='DIMENSION-ALL MANPOWER SERVICES INC.'), 'land-based', 12, 10),
-- PESO RTR
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=5 AND v.venue_name='PESO RTR Gym'), (SELECT id FROM agencies WHERE agency_name='ORIENT EXPAT MANPOWER SERVICES'), 'land-based', 5, 6);

-- JUNE 2025: Multiple events (sampled)
INSERT INTO job_fair_events (fiscal_year, month, organizer_id, job_fair_date_start, venue_id, num_job_fairs_facilitated) VALUES
(2025, 6, (SELECT id FROM agencies WHERE agency_name='NEMSU TAGBINA'), '2025-06-02', (SELECT id FROM venues WHERE venue_name='NEMSU Tagbina Campus'), 1),
(2025, 6, (SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF LIANGA'), '2025-06-05', (SELECT id FROM venues WHERE venue_name='Lianga Municipal Hall'), 1),
(2025, 6, (SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF CAGWAIT'), '2025-06-08', (SELECT id FROM venues WHERE venue_name='Cagwait Municipal Hall'), 1),
(2025, 6, (SELECT id FROM agencies WHERE agency_name='DOLE CARAGA'), '2025-06-10', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 1),
(2025, 6, (SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF PROSPERIDAD'), '2025-06-12', (SELECT id FROM venues WHERE venue_name='Prosperidad Municipal Gym'), 1),
(2025, 6, (SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF SAN FRANCISCO'), '2025-06-15', (SELECT id FROM venues WHERE venue_name='San Francisco Town Hall'), 1),
(2025, 6, (SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF TUBAJON'), '2025-06-18', (SELECT id FROM venues WHERE venue_name='Tubajon Municipal Hall'), 1),
(2025, 6, (SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF BUNAWAN'), '2025-06-20', (SELECT id FROM venues WHERE venue_name='Bunawan Municipal Hall'), 1),
(2025, 6, (SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF BAYUGAN'), '2025-06-22', (SELECT id FROM venues WHERE venue_name='Bayugan City Hall'), 1);

INSERT INTO job_fair_participants (event_id, agency_id, agency_category, registered_applicants_male, registered_applicants_female) VALUES
-- NEMSU Tagbina
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=6 AND v.venue_name='NEMSU Tagbina Campus'), (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 'land-based', 14, 12),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=6 AND v.venue_name='NEMSU Tagbina Campus'), (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 'land-based', 10, 8),
-- Lianga
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=6 AND v.venue_name='Lianga Municipal Hall'), (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 'land-based', 12, 15),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=6 AND v.venue_name='Lianga Municipal Hall'), (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 'land-based', 8, 10),
-- Cagwait
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=6 AND v.venue_name='Cagwait Municipal Hall'), (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 'land-based', 10, 12),
-- Robinsons Butuan (DOLE CARAGA June)
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=6 AND v.venue_name='Robinsons Place Butuan'), (SELECT id FROM agencies WHERE agency_name='GOLDEN HORIZON PLACEMENT AGENCY'), 'land-based', 20, 18),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=6 AND v.venue_name='Robinsons Place Butuan'), (SELECT id FROM agencies WHERE agency_name='SMC MANPOWER AGENCY PHILS. INC.'), 'land-based', 12, 14),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=6 AND v.venue_name='Robinsons Place Butuan'), (SELECT id FROM agencies WHERE agency_name='ACES INTERNATIONAL MANPOWER SERVICES'), 'land-based', 10, 8),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=6 AND v.venue_name='Robinsons Place Butuan'), (SELECT id FROM agencies WHERE agency_name='PHILWORLD RECRUITMENT AGENCY'), 'land-based', 8, 6),
-- Prosperidad
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=6 AND v.venue_name='Prosperidad Municipal Gym'), (SELECT id FROM agencies WHERE agency_name='MYRIAD DIVERSIFIED SERVICES INC.'), 'land-based', 15, 12),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=6 AND v.venue_name='Prosperidad Municipal Gym'), (SELECT id FROM agencies WHERE agency_name='DIMENSION-ALL MANPOWER SERVICES INC.'), 'land-based', 10, 8),
-- San Francisco
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=6 AND v.venue_name='San Francisco Town Hall'), (SELECT id FROM agencies WHERE agency_name='ORIENT EXPAT MANPOWER SERVICES'), 'land-based', 8, 10),
-- Tubajon
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=6 AND v.venue_name='Tubajon Municipal Hall'), (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 'land-based', 12, 10),
-- Bunawan
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=6 AND v.venue_name='Bunawan Municipal Hall'), (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 'land-based', 14, 16),
-- Bayugan
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2025 AND e.month=6 AND v.venue_name='Bayugan City Hall'), (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 'land-based', 10, 8);

-- ============================================================================
-- 2026 JOB FAIR EVENTS (from 2026-JOB-FAIR-REPORT.xlsx)
-- ============================================================================
-- FEBRUARY 2026: 2 job fairs, 74 applicants (44M, 30F), 5 land-based
INSERT INTO job_fair_events (fiscal_year, month, organizer_id, job_fair_date_start, venue_id, num_job_fairs_facilitated, monitored_by) VALUES
(2026, 2, (SELECT id FROM agencies WHERE agency_name='LGU-CABADBARAN'), '2026-02-23', (SELECT id FROM venues WHERE venue_name='CBR Cabadbaran'), 1, 'Staff A'),
(2026, 2, (SELECT id FROM agencies WHERE agency_name='LGU-BUTUAN'), '2026-02-23', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), 1, 'Staff B');

INSERT INTO job_fair_participants (event_id, agency_id, jfa_id, agency_category, registered_applicants_male, registered_applicants_female, terminal_report_male, terminal_report_female) VALUES
-- LGU-CABADBARAN: 1 agency (JENERICK), 28 applicants (20M, 8F)
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2026 AND e.month=2 AND v.venue_name='CBR Cabadbaran'), (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), (SELECT id FROM jfa_records WHERE jfa_no='BUT-26-0203-002'), 'land-based', 20, 8, 20, 8),
-- LGU-BUTUAN: 4 agencies (JENERICK, MMML, MYRIAD, SMC), 46 applicants (24M, 22F)
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2026 AND e.month=2 AND v.venue_name='Robinsons Place Butuan'), (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), NULL, 'land-based', 8, 6, 8, 6),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2026 AND e.month=2 AND v.venue_name='Robinsons Place Butuan'), (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), (SELECT id FROM jfa_records WHERE jfa_no='BUT-26-0203-003'), 'land-based', 6, 5, 6, 5),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2026 AND e.month=2 AND v.venue_name='Robinsons Place Butuan'), (SELECT id FROM agencies WHERE agency_name='MYRIAD DIVERSIFIED SERVICES INC.'), (SELECT id FROM jfa_records WHERE jfa_no='BUT-26-0203-004'), 'land-based', 5, 6, 5, 6),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2026 AND e.month=2 AND v.venue_name='Robinsons Place Butuan'), (SELECT id FROM agencies WHERE agency_name='SMC MANPOWER AGENCY PHILS. INC.'), (SELECT id FROM jfa_records WHERE jfa_no='BUT-26-0203-005'), 'land-based', 5, 5, 5, 5);

-- MARCH 2026: 4 events (no applicant data yet - placeholders)
INSERT INTO job_fair_events (fiscal_year, month, organizer_id, job_fair_date_start, job_fair_date_end, venue_id, num_job_fairs_facilitated) VALUES
(2026, 3, (SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF SAN JOSE, DINAGAT ISLAND'), '2026-03-05', '2026-03-06', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), 1),
(2026, 3, (SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF PROSPERIDAD'), '2026-03-06', NULL, (SELECT id FROM venues WHERE venue_name='Prosperidad Municipal Gym'), 1),
(2026, 3, (SELECT id FROM agencies WHERE agency_name='SMCC'), '2026-03-12', NULL, (SELECT id FROM venues WHERE venue_name='SMCC Campus'), 1),
(2026, 3, (SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF CAGDIANAO'), '2026-03-19', '2026-03-20', (SELECT id FROM venues WHERE venue_name='Cagdianao Barangay Hall'), 1);

-- March participants (0 applicants, waiting for data)
INSERT INTO job_fair_participants (event_id, agency_id, agency_category, registered_applicants_male, registered_applicants_female) VALUES
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2026 AND e.month=3 AND v.venue_name='San Jose Municipal Hall'), (SELECT id FROM agencies WHERE agency_name='STAR WORLD INTERNATIONAL MANPOWER & PLACEMENT AGENCY'), 'land-based', 0, 0),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2026 AND e.month=3 AND v.venue_name='San Jose Municipal Hall'), (SELECT id FROM agencies WHERE agency_name='MMML OVERSEAS MANPOWER CORPORATION'), 'land-based', 0, 0),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2026 AND e.month=3 AND v.venue_name='San Jose Municipal Hall'), (SELECT id FROM agencies WHERE agency_name='DIMENSION-ALL MANPOWER SERVICES INC.'), 'land-based', 0, 0),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2026 AND e.month=3 AND v.venue_name='San Jose Municipal Hall'), (SELECT id FROM agencies WHERE agency_name='SMC MANPOWER AGENCY PHILS. INC.'), 'land-based', 0, 0),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2026 AND e.month=3 AND v.venue_name='Prosperidad Municipal Gym'), (SELECT id FROM agencies WHERE agency_name='PLACEWELL INTERNATIONAL SERVICES CORP.'), 'land-based', 0, 0),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2026 AND e.month=3 AND v.venue_name='SMCC Campus'), (SELECT id FROM agencies WHERE agency_name='JENERICK INTERNATIONAL MANPOWER INC.'), 'land-based', 0, 0),
((SELECT e.id FROM job_fair_events e JOIN venues v ON e.venue_id=v.id WHERE e.fiscal_year=2026 AND e.month=3 AND v.venue_name='Cagdianao Barangay Hall'), (SELECT id FROM agencies WHERE agency_name='EAST WEST PLACEMENT CENTER INC.'), 'land-based', 0, 0);

-- ============================================================================
-- 2026 MONITORING RECORDS (from 2026-JOB-FAIR-REPORT.xlsx → MONITORING)
-- ============================================================================
INSERT INTO monitoring_records (implementing_agency_id, job_fair_date_start, venue_id, job_fair_monitoring, conduct_of_peos, communication_letter_received, invitation_emailed, confirmation_deadline, transmittal_letter_date, evidence_path, remarks, fiscal_year, month) VALUES
-- Feb: Cabadbaran
((SELECT id FROM agencies WHERE agency_name='LGU-CABADBARAN'), '2026-02-23', (SELECT id FROM venues WHERE venue_name='CBR Cabadbaran'), NULL, NULL, '2026-02-10', '2026-02-12', '2026-02-18', '2026-02-20', '..\JOB FAIR ACTIVITIES\1. FEBRUARY\2-23-26- CBR', NULL, 2026, 2),
-- Feb: Butuan
((SELECT id FROM agencies WHERE agency_name='LGU-BUTUAN'), '2026-02-23', (SELECT id FROM venues WHERE venue_name='Robinsons Place Butuan'), NULL, NULL, '2026-02-10', '2026-02-12', '2026-02-18', '2026-02-20', '..\JOB FAIR ACTIVITIES\1. FEBRUARY\2-23-26- BUTUAN', NULL, 2026, 2),
-- Mar: San Jose
((SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF SAN JOSE, DINAGAT ISLAND'), '2026-03-05', (SELECT id FROM venues WHERE venue_name='San Jose Municipal Hall'), NULL, NULL, '2026-02-20', '2026-02-22', '2026-02-28', '2026-03-02', NULL, NULL, 2026, 3),
-- Mar: Prosperidad
((SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF PROSPERIDAD'), '2026-03-06', (SELECT id FROM venues WHERE venue_name='Prosperidad Municipal Gym'), NULL, NULL, '2026-02-20', '2026-02-22', '2026-02-28', '2026-03-03', NULL, NULL, 2026, 3),
-- Mar: SMCC
((SELECT id FROM agencies WHERE agency_name='SMCC'), '2026-03-12', (SELECT id FROM venues WHERE venue_name='SMCC Campus'), NULL, NULL, '2026-02-25', '2026-02-27', '2026-03-05', '2026-03-08', NULL, NULL, 2026, 3),
-- Mar: Cagdianao
((SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF CAGDIANAO'), '2026-03-19', (SELECT id FROM venues WHERE venue_name='Cagdianao Barangay Hall'), NULL, NULL, '2026-03-01', '2026-03-03', '2026-03-10', '2026-03-15', NULL, NULL, 2026, 3),
-- Apr: CSUCC
((SELECT id FROM agencies WHERE agency_name='CSUCC'), '2026-04-15', (SELECT id FROM venues WHERE venue_name='CSUCC Campus'), NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Upcoming', 2026, 4),
-- May: Madrid
((SELECT id FROM agencies WHERE agency_name='MUNICIPALITY OF MADRID'), '2026-05-10', (SELECT id FROM venues WHERE venue_name='Madrid Municipal Hall'), NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Upcoming', 2026, 5);

-- ============================================================================
-- Seed complete.
-- Verify with: SELECT * FROM v_jfa_summary;
--              SELECT * FROM v_job_fair_summary;
-- ============================================================================
