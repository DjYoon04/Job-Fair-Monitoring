const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const db = require('./connection');

const ROOT = path.resolve(__dirname, '..');

function resolveFirstExistingWorkbook(candidates) {
  for (const candidate of candidates) {
    const full = path.join(ROOT, candidate);
    if (fs.existsSync(full)) {
      return full;
    }
  }
  return path.join(ROOT, candidates[0]);
}

const WORKBOOKS = {
  jfa2025: path.join(ROOT, '2025 JFA AND DOCUMENT TRACKING.xlsx'),
  jfa2026: path.join(ROOT, '2026 JFA TRACKING NO..xlsx'),
  report2025: path.join(ROOT, '2025 JOB FAIR REPORT.xlsx'),
  report2026: resolveFirstExistingWorkbook([
    '2026 JOB FAIR REPORT (New).xlsx',
    '2026 JOB FAIR REPORT.xlsx',
  ]),
};

const MONTHS = {
  JAN: 1,
  JANUARY: 1,
  FEB: 2,
  FEBRUARY: 2,
  FERBUARY: 2,
  MAR: 3,
  MARCH: 3,
  APR: 4,
  APRIL: 4,
  MAY: 5,
  JUN: 6,
  JUNE: 6,
  JUL: 7,
  JULY: 7,
  AUG: 8,
  AUGUST: 8,
  SEP: 9,
  SEPT: 9,
  SEPTEMBER: 9,
  OCT: 10,
  OCTOBER: 10,
  NOV: 11,
  NOVEMBER: 11,
  DEC: 12,
  DECEMBER: 12,
};

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeKey(value) {
  return normalizeText(value).toUpperCase();
}

function keyVariants(value) {
  const base = normalizeKey(value);
  if (!base) {
    return [];
  }
  const variants = new Set([base]);
  variants.add(base.replace(/\./g, ''));
  variants.add(base.replace(/,/g, ''));
  variants.add(base.replace(/\s*&\s*/g, ' AND '));
  variants.add(base.replace(/\s+INC\.?$/g, ' INC.'));
  variants.add(base.replace(/\s+CORP\.?$/g, ' CORP.'));
  variants.add(base.replace(/\s+CORPORATION$/g, ' CORP.'));
  variants.add(base.replace(/\bSERVICES\s+CORPORATION\b/g, 'SERVICES CORP.'));
  variants.add(base.replace(/\bRECRUTIMENT\b/g, 'RECRUITMENT'));
  return Array.from(variants).filter(Boolean);
}

function parseNumeric(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const num = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(num) ? num : 0;
}

function parseMonitoringFlag(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const raw = normalizeKey(value);
  if (!raw) {
    return null;
  }

  if (['TRUE', 'YES', 'Y', '1', 'CHECKED', 'CHECK', '✓', '✔', '☑', '✅'].includes(raw)) {
    return true;
  }

  if (['FALSE', 'NO', 'N', '0', 'UNCHECKED', '✗', '✘', '❌'].includes(raw)) {
    return false;
  }

  return null;
}

function parseDate(value) {
  if (!value && value !== 0) {
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }

  const upper = raw.toUpperCase();
  if (['N.A.', 'N.A', 'NA', 'NONE', '-', 'NOT SPECIFY'].includes(upper)) {
    return null;
  }

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  return null;
}

function parseDateRange(value) {
  if (!value && value !== 0) {
    return { start: null, end: null };
  }

  if (value instanceof Date) {
    return { start: value, end: null };
  }

  const raw = normalizeText(value);
  if (!raw) {
    return { start: null, end: null };
  }

  const direct = parseDate(raw);
  if (direct) {
    return { start: direct, end: null };
  }

  const upper = raw.toUpperCase();
  const regex = /([A-Z]+)\s+(\d{1,2})\s*-\s*(\d{1,2}),\s*(\d{4})/;
  const match = upper.match(regex);
  if (match) {
    const month = MONTHS[match[1]];
    const startDay = Number(match[2]);
    const endDay = Number(match[3]);
    const year = Number(match[4]);
    if (month && startDay && endDay && year) {
      return {
        start: new Date(Date.UTC(year, month - 1, startDay)),
        end: new Date(Date.UTC(year, month - 1, endDay)),
      };
    }
  }

  return { start: null, end: null };
}

function toSqlDate(value) {
  const dt = parseDate(value);
  if (!dt) {
    return null;
  }
  return dt.toISOString().slice(0, 10);
}

function dateRangeToSql(value) {
  const parsed = parseDateRange(value);
  return {
    start: parsed.start ? parsed.start.toISOString().slice(0, 10) : null,
    end: parsed.end ? parsed.end.toISOString().slice(0, 10) : null,
  };
}

function readSheetRows(filePath, sheetName) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    return [];
  }
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

async function clearData(client) {
  await client.query('BEGIN');
  await client.query(`
    TRUNCATE TABLE
      monitoring_records,
      job_fair_participants,
      job_fair_events,
      jfa_documents,
      jfa_records,
      venues,
      agencies,
      fiscal_years
    RESTART IDENTITY CASCADE
  `);
  await client.query('COMMIT');
}

async function insertFiscalYears(client) {
  await client.query('INSERT INTO fiscal_years (year, is_active) VALUES (2025, TRUE), (2026, TRUE)');
}

function inferAgencyType(name, source = 'unknown') {
  const n = normalizeKey(name);
  if (!n) {
    return 'other';
  }

  if (
    n.includes('LGU') ||
    n.includes('MUNICIPALITY') ||
    n.includes('CITY GOVERNMENT') ||
    n.includes('PROVINCIAL GOVERNMENT') ||
    n.includes('PESO')
  ) {
    return 'lgu';
  }

  if (n.includes('DOLE')) {
    return 'dole';
  }

  if (
    n.includes('COLLEGE') ||
    n.includes('UNIVERSITY') ||
    n.includes('NEMSU') ||
    n.includes('SMCC') ||
    n.includes('CSUCC') ||
    n.includes('SCHOOL')
  ) {
    return 'school';
  }

  if (source === 'monitoring') {
    return 'lgu';
  }

  return 'recruitment';
}

class LookupCache {
  constructor() {
    this.agencyByVariant = new Map();
    this.venueByVariant = new Map();
    this.jfaByNo = new Map();
  }

  registerAgency(id, name) {
    for (const key of keyVariants(name)) {
      this.agencyByVariant.set(key, id);
    }
  }

  registerVenue(id, name) {
    for (const key of keyVariants(name)) {
      this.venueByVariant.set(key, id);
    }
  }

  findAgency(name) {
    for (const key of keyVariants(name)) {
      if (this.agencyByVariant.has(key)) {
        return this.agencyByVariant.get(key);
      }
    }
    return null;
  }

  findVenue(name) {
    for (const key of keyVariants(name)) {
      if (this.venueByVariant.has(key)) {
        return this.venueByVariant.get(key);
      }
    }
    return null;
  }
}

async function getOrCreateAgency(client, cache, rawName, source) {
  const name = normalizeText(rawName);
  if (!name) {
    return null;
  }

  const existing = cache.findAgency(name);
  if (existing) {
    return existing;
  }

  const agencyType = inferAgencyType(name, source);
  const res = await client.query(
    `INSERT INTO agencies (agency_name, agency_type)
     VALUES ($1, $2)
     ON CONFLICT (agency_name, agency_type) DO UPDATE SET agency_name = EXCLUDED.agency_name
     RETURNING id, agency_name`,
    [name, agencyType]
  );

  const agency = res.rows[0];
  cache.registerAgency(agency.id, agency.agency_name);
  return agency.id;
}

async function getOrCreateVenue(client, cache, rawVenue) {
  const venue = normalizeText(rawVenue);
  if (!venue) {
    return null;
  }

  const existing = cache.findVenue(venue);
  if (existing) {
    return existing;
  }

  const res = await client.query(
    `INSERT INTO venues (venue_name)
     VALUES ($1)
     RETURNING id, venue_name`,
    [venue]
  );

  const row = res.rows[0];
  cache.registerVenue(row.id, row.venue_name);
  return row.id;
}

function determineJfaStatus(remarks, agencyName) {
  const r = normalizeKey(remarks);
  if (!agencyName) {
    return 'active';
  }
  if (r.includes('CANCEL')) {
    return 'cancelled';
  }
  if (
    r.includes('NOT ABLE') ||
    r.includes('NOT PARTICIPATE') ||
    r.includes('DID NOT PARTICIPATE') ||
    r.includes('WAS NOT ABLE')
  ) {
    return 'not_participated';
  }
  return 'completed';
}

function monthFromSheetName(sheetName) {
  const key = normalizeKey(sheetName);
  return MONTHS[key] || null;
}

function shouldSkipRow(row) {
  if (!Array.isArray(row)) {
    return true;
  }
  return row.every((v) => normalizeText(v) === '');
}

function findColumn(row, matcher) {
  if (!Array.isArray(row)) {
    return -1;
  }
  for (let i = 0; i < row.length; i += 1) {
    if (matcher(normalizeKey(row[i]))) {
      return i;
    }
  }
  return -1;
}

function findColumnInDualHeader(primaryRow, secondaryRow, matcher) {
  const width = Math.max(primaryRow?.length || 0, secondaryRow?.length || 0);
  for (let i = 0; i < width; i += 1) {
    const top = normalizeKey(primaryRow?.[i]);
    const bottom = normalizeKey(secondaryRow?.[i]);
    const combined = `${top} ${bottom}`.trim();
    if (matcher(top, bottom, combined)) {
      return i;
    }
  }
  return -1;
}

function isJfaSheetDataRow(row) {
  const jfaNo = normalizeText(row[1]);
  return /^BUT-\d{2}-\d{4}-\d{3}$/i.test(jfaNo);
}

async function importJfaWorkbook(client, cache, filePath, year, summarySheetNames) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  for (const sheetName of wb.SheetNames) {
    if (summarySheetNames.includes(sheetName)) {
      continue;
    }

    const month = monthFromSheetName(sheetName);
    if (!month) {
      continue;
    }

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rows.length < 3) {
      continue;
    }

    const header1 = rows[0] || [];
    const header2 = rows[1] || [];

    const idx = {
      jfaNo: findColumn(header1, (v) => v.includes('JFA NO')),
      agency: findColumn(header1, (v) => v === 'AGENCY'),
      jobFairDate: findColumn(header1, (v) => v.includes('DATE OF JOB FAIR')),
      venue: findColumn(header1, (v) => v.includes('VENUE OF JOB FAIR')),
      availableJobOrders: findColumn(header1, (v) => v.includes('AVAILABLE JOB ORDERS')),
      jobSite: findColumn(header1, (v) => v === 'JOB SITE'),
      jobOrdersBalance: findColumn(header1, (v) => v.includes('JOB ORDERS BALANCE')),
      invitation: findColumn(header2, (v) => v.includes('INVITATION LETTER')),
      affidavit: findColumn(header2, (v) => v.includes('AFFIDAVIT')),
      jobOrdersDate: findColumn(header2, (v) => v === 'JOB ORDERS' || v.includes('JOB ORDERS DATE')),
      representativeId: findColumn(header2, (v) => v.includes('REPRESENTATIVE COMPANY ID')),
      terminalReport: findColumn(header2, (v) => v.includes('TERMINAL REPORT')),
      statusApplicants: findColumn(header2, (v) => v === 'STATUS OF APPLICANTS'),
      statusDate: findColumn(header2, (v) => v.includes('STATUS OF APPLICANTS DATE')),
      remarks: findColumn(header2, (v) => v === 'REMARKS'),
    };

    for (let i = 2; i < rows.length; i += 1) {
      const row = rows[i];
      if (shouldSkipRow(row) || !isJfaSheetDataRow(row)) {
        continue;
      }

      const jfaNo = normalizeText(row[idx.jfaNo]);
      const agencyName = normalizeText(row[idx.agency]);
      const safeAgencyName = agencyName || 'UNSPECIFIED AGENCY (FROM WORKBOOK)';
      const remarks = idx.remarks >= 0 ? normalizeText(row[idx.remarks]) : '';
      const venueName = idx.venue >= 0 ? normalizeText(row[idx.venue]) : '';
      const dateCell = idx.jobFairDate >= 0 ? row[idx.jobFairDate] : '';

      const agencyId = await getOrCreateAgency(client, cache, safeAgencyName, 'jfa');
      const venueId = await getOrCreateVenue(client, cache, venueName);

      const parsedDate = dateRangeToSql(dateCell);
      const status = determineJfaStatus(remarks, safeAgencyName);

      const availableJobOrders = idx.availableJobOrders >= 0
        ? parseNumeric(row[idx.availableJobOrders])
        : 0;

      const jobOrdersBalance = idx.jobOrdersBalance >= 0
        ? parseNumeric(row[idx.jobOrdersBalance])
        : 0;

      const jobSite = idx.jobSite >= 0 ? normalizeText(row[idx.jobSite]) : null;

      const jfaRes = await client.query(
        `INSERT INTO jfa_records
         (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, job_fair_date_end,
          venue_id, available_job_orders, job_site, job_orders_balance, status, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (jfa_no) DO UPDATE SET
          agency_id = EXCLUDED.agency_id,
          fiscal_year = EXCLUDED.fiscal_year,
          month = EXCLUDED.month,
          job_fair_date_start = EXCLUDED.job_fair_date_start,
          job_fair_date_end = EXCLUDED.job_fair_date_end,
          venue_id = EXCLUDED.venue_id,
          available_job_orders = EXCLUDED.available_job_orders,
          job_site = EXCLUDED.job_site,
          job_orders_balance = EXCLUDED.job_orders_balance,
          status = EXCLUDED.status,
          remarks = EXCLUDED.remarks
         RETURNING id`,
        [
          jfaNo,
          agencyId,
          year,
          month,
          parsedDate.start,
          parsedDate.end,
          venueId,
          availableJobOrders,
          jobSite || null,
          jobOrdersBalance,
          status,
          remarks || null,
        ]
      );

      const jfaId = jfaRes.rows[0].id;
      cache.jfaByNo.set(jfaNo, jfaId);

      const statusApplicantsValue = idx.statusApplicants >= 0
        ? normalizeText(row[idx.statusApplicants])
        : null;

      await client.query(
        `UPDATE jfa_documents SET
          invitation_letter_date = $1,
          affidavit_date = $2,
          job_orders_date = $3,
          representative_id_date = $4,
          terminal_report_date = $5,
          status_of_applicants = $6,
          status_date = $7
         WHERE jfa_id = $8`,
        [
          idx.invitation >= 0 ? toSqlDate(row[idx.invitation]) : null,
          idx.affidavit >= 0 ? toSqlDate(row[idx.affidavit]) : null,
          idx.jobOrdersDate >= 0 ? toSqlDate(row[idx.jobOrdersDate]) : null,
          idx.representativeId >= 0 ? toSqlDate(row[idx.representativeId]) : null,
          idx.terminalReport >= 0 ? toSqlDate(row[idx.terminalReport]) : null,
          statusApplicantsValue || null,
          idx.statusDate >= 0 ? toSqlDate(row[idx.statusDate]) : null,
          jfaId,
        ]
      );
    }
  }
}

function isSummaryLabel(value) {
  const v = normalizeKey(value);
  return !v || v.includes('SUB TOTAL') || v.includes('GRAND TOTAL');
}

function monthFromReportSheet(sheetName) {
  const key = normalizeKey(sheetName);
  return MONTHS[key] || null;
}

async function importJobFairWorkbook(client, cache, filePath, year, summaryNames) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  for (const sheetName of wb.SheetNames) {
    if (summaryNames.includes(sheetName)) {
      continue;
    }

    const month = monthFromReportSheet(sheetName);
    if (!month) {
      continue;
    }

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rows.length < 6) {
      continue;
    }

    const headerRowIdx = rows.findIndex((row, idx) => {
      if (idx > 10) {
        return false;
      }
      return Array.isArray(row) && row.some((c) => {
        const v = normalizeKey(c);
        return v.includes('AGENCY/ INSTITUTION') || v.includes('RECRUTIMENT AGENCIES') || v.includes('RECRUITMENT AGENCIES');
      });
    });

    if (headerRowIdx < 0 || headerRowIdx + 1 >= rows.length) {
      continue;
    }

    const headerRow = rows[headerRowIdx] || [];
    const subHeaderRow = rows[headerRowIdx + 1] || [];

    const idx = {
      organizer: findColumn(headerRow, (v) => v.includes('AGENCY/ INSTITUTION')),
      date: findColumn(headerRow, (v) => v.includes('JOB FAIR DATE')),
      venue: findColumn(headerRow, (v) => v.includes('JOB FAIR VENUE')),
      agency: findColumn(headerRow, (v) => v.includes('RECRUTIMENT AGENCIES') || v.includes('RECRUITMENT AGENCIES')),
      numJobFairs: findColumn(headerRow, (v) => v.includes('NO. OF JOB')),
      jfaNo: findColumn(headerRow, (v) => v.includes('JFA NO')),
      registeredStart: findColumn(headerRow, (v) => v.includes('NUMBER OF REGISTERED APPLICANTS') && !v.includes('TERMINAL REPORT')),
      terminalStart: findColumn(headerRow, (v) => v.includes('TERMINAL REPORT')),
      participatingStart: findColumn(headerRow, (v) => v.includes('NUMBER OF PARTICIPATING AGENCIES')),
      monitoredBy: findColumnInDualHeader(headerRow, subHeaderRow, (top, bottom, combined) =>
        top.includes('MONITORED BY') || bottom.includes('MONITORED BY') || combined.includes('MONITORED BY')
      ),
    };

    const registeredMaleIdx = idx.registeredStart >= 0
      ? idx.registeredStart
      : findColumnInDualHeader(headerRow, subHeaderRow, (_, bottom) => bottom === 'MALE');
    const registeredFemaleIdx = registeredMaleIdx >= 0 ? registeredMaleIdx + 1 : -1;

    const terminalMaleIdx = idx.terminalStart >= 0
      ? idx.terminalStart
      : findColumnInDualHeader(headerRow, subHeaderRow, (top, bottom, combined) =>
        combined.includes('TERMINAL REPORT MALE') || (top.includes('TERMINAL REPORT') && bottom === 'MALE')
      );
    const terminalFemaleIdx = terminalMaleIdx >= 0 ? terminalMaleIdx + 1 : -1;

    const landBasedIdx = idx.participatingStart >= 0
      ? idx.participatingStart
      : findColumnInDualHeader(headerRow, subHeaderRow, (_, bottom) => bottom.includes('LAND BASED'));
    const seaBasedIdx = idx.participatingStart >= 0
      ? idx.participatingStart + 1
      : findColumnInDualHeader(headerRow, subHeaderRow, (_, bottom) => bottom.includes('SEA-BASED') || bottom.includes('SEA BASED'));

    let currentEvent = null;

    for (let i = headerRowIdx + 2; i < rows.length; i += 1) {
      const row = rows[i] || [];
      const organizer = normalizeText(idx.organizer >= 0 ? row[idx.organizer] : '');
      const agency = normalizeText(idx.agency >= 0 ? row[idx.agency] : '');

      if (isSummaryLabel(organizer) && isSummaryLabel(agency)) {
        continue;
      }

      if (organizer && !isSummaryLabel(organizer)) {
        const venue = normalizeText(idx.venue >= 0 ? row[idx.venue] : '');
        const dateRange = dateRangeToSql(idx.date >= 0 ? row[idx.date] : '');
        if (!dateRange.start) {
          continue;
        }
        const organizerId = await getOrCreateAgency(client, cache, organizer, 'jobfair-organizer');
        const venueId = await getOrCreateVenue(client, cache, venue);

        const monitoredBy = idx.monitoredBy >= 0 ? normalizeText(row[idx.monitoredBy] || '') : '';
        const numJobFairs = idx.numJobFairs >= 0 ? parseNumeric(row[idx.numJobFairs]) || 1 : 1;

        const eventRes = await client.query(
          `INSERT INTO job_fair_events
           (fiscal_year, month, organizer_id, job_fair_date_start, job_fair_date_end,
            venue_id, num_job_fairs_facilitated, monitored_by, remarks)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING id`,
          [
            year,
            month,
            organizerId,
            dateRange.start,
            dateRange.end,
            venueId,
            numJobFairs,
            monitoredBy || null,
            null,
          ]
        );

        currentEvent = eventRes.rows[0].id;
      }

      if (!agency) {
        continue;
      }

      if (!currentEvent) {
        continue;
      }

      const agencyId = await getOrCreateAgency(client, cache, agency, 'jobfair-agency');
      const male = registeredMaleIdx >= 0 ? parseNumeric(row[registeredMaleIdx]) : 0;
      const female = registeredFemaleIdx >= 0 ? parseNumeric(row[registeredFemaleIdx]) : 0;

      const terminalMale = terminalMaleIdx >= 0 ? parseNumeric(row[terminalMaleIdx]) : 0;
      const terminalFemale = terminalFemaleIdx >= 0 ? parseNumeric(row[terminalFemaleIdx]) : 0;

      const seaBasedCount = seaBasedIdx >= 0 ? parseNumeric(row[seaBasedIdx]) : 0;
      const agencyCategory = seaBasedCount > 0 ? 'sea-based' : 'land-based';

      const jfaNo = normalizeText(idx.jfaNo >= 0 ? row[idx.jfaNo] : '');
      const jfaId = jfaNo ? cache.jfaByNo.get(jfaNo) || null : null;

      await client.query(
        `INSERT INTO job_fair_participants
         (event_id, agency_id, jfa_id, agency_category,
          registered_applicants_male, registered_applicants_female,
          terminal_report_male, terminal_report_female)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (event_id, agency_id) DO UPDATE SET
          jfa_id = EXCLUDED.jfa_id,
          agency_category = EXCLUDED.agency_category,
          registered_applicants_male = EXCLUDED.registered_applicants_male,
          registered_applicants_female = EXCLUDED.registered_applicants_female,
          terminal_report_male = EXCLUDED.terminal_report_male,
          terminal_report_female = EXCLUDED.terminal_report_female`,
        [
          currentEvent,
          agencyId,
          jfaId,
          agencyCategory,
          male,
          female,
          terminalMale,
          terminalFemale,
        ]
      );
    }
  }
}

async function importMonitoring(client, cache, filePath) {
  const rows = readSheetRows(filePath, 'MONITORING');
  if (!rows.length || rows.length < 5) {
    return;
  }

  const header1Idx = rows.findIndex((row, idx) => {
    if (idx > 10) {
      return false;
    }
    return Array.isArray(row) && row.some((c) => normalizeKey(c).includes('IMPLEMENTING AGENCY'));
  });

  if (header1Idx < 0 || header1Idx + 1 >= rows.length) {
    return;
  }

  const header1 = rows[header1Idx] || [];
  const header2 = rows[header1Idx + 1] || [];

  const idx = {
    no: findColumn(header1, (v) => v === 'NO.' || v === 'NO'),
    implementingAgency: findColumn(header1, (v) => v.includes('IMPLEMENTING AGENCY')),
    date: findColumn(header1, (v) => v.includes('JOB FAIR DATE')),
    venue: findColumn(header1, (v) => v.includes('JOB FAIR VENUE')),
    celebrationEvent: findColumn(header1, (v) => v.includes('CELEBRATION') || v === 'EVENT'),
    jobFairMonitoring: findColumnInDualHeader(header1, header2, (_, bottom, combined) =>
      bottom.includes('JOB FAIR MONITORING') || combined.includes('JOB FAIR MONITORING')
    ),
    conductOfPeos: findColumnInDualHeader(header1, header2, (_, bottom, combined) =>
      bottom.includes('CONDUCT OF PEOS') || combined.includes('CONDUCT OF PEOS')
    ),
    communicationLetter: findColumnInDualHeader(header1, header2, (_, bottom, combined) =>
      bottom.includes('COMMUNICATION LETTER RECEIVED') || combined.includes('COMMUNICATION LETTER RECEIVED')
    ),
    invitationEmailed: findColumnInDualHeader(header1, header2, (_, bottom, combined) =>
      bottom.includes('EMAILED THE INVITATION LETTER') || combined.includes('EMAILED THE INVITATION LETTER')
    ),
    confirmationDeadline: findColumnInDualHeader(header1, header2, (_, bottom, combined) =>
      bottom.includes('CONFIRMATION DEADLINE') || combined.includes('CONFIRMATION DEADLINE')
    ),
    transmittalLetter: findColumnInDualHeader(header1, header2, (_, bottom, combined) =>
      bottom.includes('EMAILED THE TRANSMITTAL LETTER') || combined.includes('EMAILED THE TRANSMITTAL LETTER')
    ),
    evidence: findColumnInDualHeader(header1, header2, (_, bottom, combined) =>
      bottom === 'EVIDENCE' || combined.includes(' EVIDENCE')
    ),
    monitoredBy: findColumnInDualHeader(header1, header2, (_, bottom, combined) =>
      bottom.includes('MONITORED BY') || combined.includes('MONITORED BY')
    ),
    remarks: findColumn(header1, (v) => v === 'REMARKS'),
  };

  let month = null;

  for (let i = header1Idx + 2; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const first = normalizeText(idx.no >= 0 ? row[idx.no] : row[0]);

    if (!first && shouldSkipRow(row)) {
      continue;
    }

    const maybeMonth = MONTHS[normalizeKey(first)];
    if (maybeMonth) {
      month = maybeMonth;
      continue;
    }

    const seq = parseNumeric(first);
    if (!seq) {
      continue;
    }

    const implementingAgency = normalizeText(idx.implementingAgency >= 0 ? row[idx.implementingAgency] : '');
    if (!implementingAgency || !month) {
      continue;
    }

    const agencyId = await getOrCreateAgency(client, cache, implementingAgency, 'monitoring');
    const venueId = await getOrCreateVenue(client, cache, idx.venue >= 0 ? row[idx.venue] : '');

    const dateRange = dateRangeToSql(idx.date >= 0 ? row[idx.date] : '');
    const commDate = idx.communicationLetter >= 0 ? toSqlDate(row[idx.communicationLetter]) : null;
    const invitationDate = idx.invitationEmailed >= 0 ? toSqlDate(row[idx.invitationEmailed]) : null;
    const confirmationRaw = idx.confirmationDeadline >= 0 ? row[idx.confirmationDeadline] : '';
    const confirmationText = normalizeText(confirmationRaw);
    const confirmationDate = toSqlDate(confirmationRaw);
    const transmittalDate = idx.transmittalLetter >= 0 ? toSqlDate(row[idx.transmittalLetter]) : null;
    const evidencePath = normalizeText(idx.evidence >= 0 ? row[idx.evidence] : '');
    const remarks = normalizeText(idx.remarks >= 0 ? row[idx.remarks] : '');
    const celebrationEvent = normalizeText(idx.celebrationEvent >= 0 ? row[idx.celebrationEvent] : '');
    const jobFairMonitoring = idx.jobFairMonitoring >= 0 ? parseMonitoringFlag(row[idx.jobFairMonitoring]) : null;
    const conductOfPeos = idx.conductOfPeos >= 0 ? parseMonitoringFlag(row[idx.conductOfPeos]) : null;
    const monitoredBy = normalizeText(idx.monitoredBy >= 0 ? row[idx.monitoredBy] : '');

    let linkedEventId = null;
    if (dateRange.start && venueId) {
      const eventRes = await client.query(
        `SELECT id FROM job_fair_events
         WHERE fiscal_year = 2026
           AND month = $1
           AND job_fair_date_start = $2
           AND venue_id = $3
         ORDER BY id
         LIMIT 1`,
        [month, dateRange.start, venueId]
      );
      linkedEventId = eventRes.rows[0]?.id || null;
    }

    await client.query(
      `INSERT INTO monitoring_records
       (event_id, implementing_agency_id, job_fair_date_start, job_fair_date_end,
        venue_id, celebration_event, job_fair_monitoring, conduct_of_peos,
        communication_letter_received, invitation_emailed, confirmation_deadline,
        transmittal_letter_date, evidence_path, monitored_by, remarks, fiscal_year, month)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        linkedEventId,
        agencyId,
        dateRange.start || null,
        dateRange.end,
        venueId,
        celebrationEvent || null,
        jobFairMonitoring,
        conductOfPeos,
        commDate,
        invitationDate,
        confirmationDate,
        transmittalDate,
        evidencePath || null,
        monitoredBy || null,
        [
          confirmationText && !confirmationDate ? `Confirmation: ${confirmationText}` : '',
          remarks,
        ].filter(Boolean).join(' | ') || null,
        2026,
        month,
      ]
    );
  }
}

async function run() {
  const client = await db.getClient();
  const cache = new LookupCache();

  try {
    await client.query('ALTER TABLE monitoring_records ADD COLUMN IF NOT EXISTS celebration_event TEXT');
    await client.query('ALTER TABLE monitoring_records ADD COLUMN IF NOT EXISTS monitored_by VARCHAR(255)');
    await client.query('ALTER TABLE monitoring_records ADD COLUMN IF NOT EXISTS job_fair_monitoring BOOLEAN');
    await client.query('ALTER TABLE monitoring_records ADD COLUMN IF NOT EXISTS conduct_of_peos BOOLEAN');

    console.log('Resetting data...');
    await clearData(client);

    console.log('Inserting fiscal years...');
    await insertFiscalYears(client);

    console.log('Importing JFA workbooks...');
    await importJfaWorkbook(client, cache, WORKBOOKS.jfa2025, 2025, ['SUMMARY']);
    await importJfaWorkbook(client, cache, WORKBOOKS.jfa2026, 2026, ['SUMMARY OF JFA ISSUED']);

    console.log('Importing Job Fair report workbooks...');
    await importJobFairWorkbook(client, cache, WORKBOOKS.report2025, 2025, ['SUMMARY']);
    await importJobFairWorkbook(client, cache, WORKBOOKS.report2026, 2026, ['SUMMARY', 'MONITORING']);

    console.log('Importing monitoring sheet...');
    await importMonitoring(client, cache, WORKBOOKS.report2026);

    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM agencies) AS agencies,
        (SELECT COUNT(*) FROM venues) AS venues,
        (SELECT COUNT(*) FROM jfa_records) AS jfa_records,
        (SELECT COUNT(*) FROM jfa_documents) AS jfa_documents,
        (SELECT COUNT(*) FROM job_fair_events) AS events,
        (SELECT COUNT(*) FROM job_fair_participants) AS participants,
        (SELECT COUNT(*) FROM monitoring_records) AS monitoring
    `);

    console.log('Import complete. Row counts:', counts.rows[0]);
  } catch (err) {
    console.error('Import failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.close();
  }
}

run();
