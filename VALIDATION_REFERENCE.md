# Data Flow & Validation Reference Guide

## Architecture Overview

```
USER INTERACTION
      ↓
FRONTEND VALIDATION (renderer.js)
      ↓
API CALL (window.api.*)
      ↓
IPC BRIDGE (main process)
      ↓
BACKEND VALIDATION (handlers.js)
      ↓
DATABASE OPERATION
      ↓
RESPONSE (with error handling)
```

---

## Required Fields by Entity Type

### JFA Records (jfa:create / jfa:update)
```
CREATE (Required):
  - jfa_no: string (non-empty, trimmed)
  - agency_id: number (valid FK to agencies)
  - fiscal_year: number (2025, 2026, etc.)
  - month: number (1-12)

UPDATE (Required):
  - id: number (non-null, valid record)
  + All CREATE required fields

OPTIONAL (both):
  - job_fair_date_start: date (ISO format or null)
  - job_fair_date_end: date (ISO format or null)
  - venue_id: number (valid FK or null)
  - available_job_orders: number (default 0)
  - job_site: string (default null)
  - job_orders_balance: number (default 0)
  - status: string (active|completed|cancelled|not_participated, default 'active')
  - remarks: string (default null)
```

### Job Fair Events (jobfair:create / jobfair:update)
```
CREATE (Required):
  - fiscal_year: number (2025, 2026, etc.)
  - month: number (1-12)
  - job_fair_date_start: date (ISO format, not null)

UPDATE (Required):
  - id: number (non-null, valid record)
  + All CREATE required fields

OPTIONAL (both):
  - organizer_id: number (valid FK or null)
  - job_fair_date_end: date (ISO format or null)
  - venue_id: number (valid FK or null)
  - num_job_fairs_facilitated: number (default 1)
  - monitored_by: string (default null)
  - remarks: string (default null)
```

### Monitoring Records (monitoring:create / monitoring:update)
```
CREATE (Required):
  - implementing_agency_id: number (valid FK to agencies)
  - job_fair_date_start: date (ISO format, not null)
  - fiscal_year: number (2025, 2026, etc.)
  - month: number (1-12)

UPDATE (Required):
  - id: number (non-null, valid record)
  + All CREATE required fields

OPTIONAL (both):
  - event_id: number (valid FK or null)
  - job_fair_date_end: date (ISO format or null)
  - venue_id: number (valid FK or null)
  - communication_letter_received: date (or null)
  - invitation_emailed: date (or null)
  - confirmation_deadline: date (or null)
  - transmittal_letter_date: date (or null)
  - evidence_path: string (file path or null)
  - remarks: string (default null)
```

### Agencies (agency:create / agency:update)
```
CREATE (Required):
  - agency_name: string (non-empty, trimmed, unique with agency_type)

UPDATE (Required):
  - id: number (non-null, valid record)
  - agency_name: string (non-empty, trimmed)

OPTIONAL (both):
  - agency_type: string (recruitment|lgu|school|dole|sea-based|other, default 'recruitment')
  - is_active: boolean (default true)
```

### Venues (venue:create / venue:update)
```
CREATE (Required):
  - venue_name: string (non-empty, trimmed)

UPDATE (Required):
  - id: number (non-null, valid record)
  - venue_name: string (non-empty, trimmed)

OPTIONAL (both):
  - city_municipality: string (default null)
  - province: string (default 'Agusan del Norte')
  - region: string (default 'CARAGA')
```

---

## Error Scenarios & Handling

### Scenario 1: Missing Required Field (CREATE)
```javascript
// User tries to create JFA without agency
API CALL: window.api.createJfa({
  jfa_no: 'BUT-26-0301-001',
  // agency_id: MISSING!
  fiscal_year: 2026,
  month: 3
})

BACKEND RESPONSE:
throw new Error('Agency is required');

FRONTEND HANDLING:
showToast('Error: Agency is required', 'error');
```

### Scenario 2: NULL ID on Update
```javascript
// System tries to update with null ID (shouldn't happen with fix)
API CALL: window.api.updateJfa({
  id: null,  // ← WRONG!
  jfa_no: 'BUT-26-0301-001',
  ...
})

BACKEND RESPONSE:
throw new Error('Invalid JFA ID for update');

FRONTEND HANDLING:
showToast('Error: Invalid JFA ID for update', 'error');
```

### Scenario 3: Record Not Found on Update
```javascript
// User deletes record, then tries to edit it
API CALL: window.api.updateJfa({
  id: 999,  // ← Record doesn't exist
  ...
})

BACKEND RESPONSE:
// Query runs: UPDATE jfa_records SET ... WHERE id=999
// Result: 0 rows affected
throw new Error('JFA record not found or update failed');

FRONTEND HANDLING:
showToast('Error: JFA record not found or update failed', 'error');
```

### Scenario 4: Invalid Month Value
```javascript
// User enters month=13 manually in form
API CALL: window.api.createJfa({
  ...
  month: 13  // ← Invalid!
})

BACKEND RESPONSE:
throw new Error('Valid month is required');

FRONTEND HANDLING:
showToast('Error: Valid month is required', 'error');
```

---

## Validation Flow Diagram

### CREATE Flow
```
Form Submission
      ↓
FRONTEND: Validate required fields present
  ├─ Empty string? → Show error, EXIT
  ├─ Wrong type? → Show error, EXIT
  └─ Valid? ↓
API Call (window.api.create*)
      ↓
BACKEND: Re-validate all fields (defense in depth)
  ├─ Empty/null on required? → throw error
  ├─ Invalid type? → throw error
  └─ Valid? ↓
Database INSERT
      ↓
Return created record OR throw DB error
      ↓
FRONTEND: Show success toast & refresh table
```

### UPDATE Flow
```
Form Submission
      ↓
FRONTEND: Validate ID present
  ├─ ID missing/null? → Show error, EXIT
  └─ ID valid? ↓
FRONTEND: Validate required fields present
  ├─ Empty string? → Show error, EXIT
  ├─ Wrong type? → Show error, EXIT
  └─ Valid? ↓
API Call (window.api.update*)
      ↓
BACKEND: Re-validate ID present
  ├─ ID missing/null? → throw error
  ├─ ID not numeric? → throw error
  └─ ID valid? ↓
BACKEND: Re-validate required fields
  ├─ Empty/null on required? → throw error
  ├─ Invalid type? → throw error
  └─ Valid? ↓
Database UPDATE
      ↓
BACKEND: Check if update succeeded
  ├─ 0 rows affected? → throw "not found"
  └─ 1+ rows affected? ↓
Return updated record
      ↓
FRONTEND: Show success toast & refresh table
```

---

## Common Mistakes to Avoid

### ❌ WRONG: Including ID in data for CREATE
```javascript
const data = {
  id: null,  // ← DON'T DO THIS
  field1: value1,
  field2: value2
};
```

### ✅ CORRECT: Separate baseData + conditional ID
```javascript
const baseData = {
  field1: value1,
  field2: value2
};

if (id) {
  await api.update({ ...baseData, id });
} else {
  await api.create(baseData);
}
```

### ❌ WRONG: Skipping validation on update
```javascript
// Don't just check `if (id)` without validating it
if (id) {
  // Could be null, undefined, or NaN!
  await api.update(data);
}
```

### ✅ CORRECT: Validate ID before using
```javascript
// Check ID is valid
if (!id || isNaN(id)) {
  throw new Error('Invalid ID');
}
await api.update(data);
```

### ❌ WRONG: Accepting UPDATE without verifying success
```javascript
// Backend doesn't check if update actually happened
const res = await db.query(`UPDATE ... WHERE id=$1 ...`, [id]);
return res.rows[0];  // ← Could be undefined!
```

### ✅ CORRECT: Verify at least one row was updated
```javascript
const res = await db.query(`UPDATE ... WHERE id=$1 ...`, [id]);
if (!res.rows.length) {
  throw new Error('Record not found');
}
return res.rows[0];
```

---

## Testing Data Integrity

### Test 1: Verify NULL ID Rejection
```javascript
// In Browser Console:
window.api.updateJfa({ id: null, jfa_no: 'BUT-26-0301-001', ... })
// Expected: Error "Invalid JFA ID for update"
```

### Test 2: Verify Required Field Validation
```javascript
// In Browser Console:
window.api.createJfa({ jfa_no: 'BUT-26-0301-001', fiscal_year: 2026 })
// Missing: agency_id, month
// Expected: Error "Agency is required"
```

### Test 3: Verify Update Success Check
```sql
-- Database test: What if WHERE clause matches 0 rows?
UPDATE jfa_records SET jfa_no = 'NEW' WHERE id = 99999;
-- Result: 0 rows affected
-- Backend now: throw "JFA record not found"
-- Before: returned undefined
```

### Test 4: Month Range Validation
```javascript
// In Browser Console:
window.api.createJfa({ ..., month: 13 })
// Expected: Error "Valid month is required"
```

---

## Database Constraints

### Unique Constraints
- `agencies.agency_name + agencies.agency_type` = UNIQUE
  - Can't have two "ABC Corporation" with type "recruitment"
  - Can have "ABC Corporation" recruitment AND "ABC Corporation" lgu

### Foreign Key Constraints
- `jfa_records.agency_id` → `agencies.id`
- `jfa_records.venue_id` → `venues.id`
- `job_fair_events.organizer_id` → `agencies.id`
- `job_fair_events.venue_id` → `venues.id`
- `monitoring_records.implementing_agency_id` → `agencies.id`
- `monitoring_records.venue_id` → `venues.id`

### Check Constraints
- `jfa_records.month BETWEEN 1 AND 12`
- `job_fair_events.month BETWEEN 1 AND 12`
- `monitoring_records.month BETWEEN 1 AND 12`
- `fiscal_years.year` = PRIMARY KEY

---

## Quick Reference: Field Categories

| Category | Fields | Validation |
|----------|--------|-----------|
| **Identifiers** | id | NOT NULL, auto-increment, PRIMARY KEY |
| **Names** | agency_name, venue_name, jfa_no | NOT NULL, trimmed, length > 0 |
| **Dates** | *_date_*, *_date_start, *_date_end | ISO format or NULL |
| **Numbers** | month, fiscal_year, *_id | 1-12 for month, numeric, FK or NULL |
| **Status** | status | Enum values only |
| **Counts** | available_job_orders, registered_applicants | >= 0, NULL → 0 |
|**Descriptions** | remarks, evidence_path | Text, can be NULL |

---

