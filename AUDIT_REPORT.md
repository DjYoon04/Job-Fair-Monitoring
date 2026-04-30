# Job Fair Monitoring System - Audit Report
## Data Integrity & API Issues

**Date:** March 19, 2026  
**Status:** ⚠️ CRITICAL BUGS FOUND

---

## 1. PRIMARY KEY NULL BUG (CRITICAL)

### Issue Description
All edit modals include `id: null` in the data object when creating new records. This causes:
- **UPDATE queries with NULL WHERE clause** - updates fail or affect wrong records
- **Inconsistent behavior** - create/update logic doesn't properly differentiate

### Affected Code Locations

#### A. JFA Tracking Modal (`renderer.js` lines 400-420)
```javascript
// CURRENT (BUGGY):
const data = {
  id: id,  // ← Problem: id is null for new records
  jfa_no: getFormValue('fJfaNo'),
  agency_id: getFormInt('fJfaAgency'),
  ...
};
```

**Handler:** `ipc/handlers.js` lines 177-188
```javascript
ipcMain.handle('jfa:update', async (_, data) => {
  const res = await db.query(
    `UPDATE jfa_records SET ...
     WHERE id=$13 RETURNING *`,
    [...params, data.id]  // ← When data.id=null, this fails
  );
});
```

#### B. Job Fair Event Modal (`renderer.js` lines 600-620)
```javascript
// CURRENT (BUGGY):
const data = {
  id: id,  // ← Problem: id is null for new records
  fiscal_year: getFormInt('fJfYear'),
  ...
};
```

#### C. Monitoring Record Modal (`renderer.js` lines 850-870)
```javascript
// CURRENT (BUGGY):
const data = {
  id: id,  // ← Problem: id is null for new records
  implementing_agency_id: getFormInt('fMonAgency'),
  ...
};
```

#### D. Agency Modal (`renderer.js` lines 1065)
```javascript
// CURRENT (BUGGY):
const data = {
  id: id,  // ← Problem: id is null for new records
  agency_name: getFormValue('fAgName'),
  agency_type: getFormValue('fAgType'),
  is_active: getFormValue('fAgActive') === 'true',
};
```

#### E. Venue Modal (`renderer.js` lines 1138)
```javascript
// CURRENT (BUGGY):
const data = {
  id: id,  // ← Problem: id is null for new records
  venue_name: getFormValue('fVnName'),
  city_municipality: getFormValue('fVnCity'),
  ...
};
```

---

## 2. API ENDPOINT ISSUES

### Missing ID Validation in Backend Handlers

**Issue:** Update handlers don't validate that `data.id` is NOT null before executing UPDATE

#### Handler Issues (`ipc/handlers.js`)
- **Line 184** `jfa:update` - No validation `if (!data.id)`
- **Line 266** `jobfair:update` - No validation `if (!data.id)`
- **Line 51** `agency:update` - No validation `if (!data.id)`
- **Line 82** `venue:update` - No validation `if (!data.id)`
- **Monitoring handlers** - Similar missing validation

### Example of Silent Failure
```javascript
ipcMain.handle('jfa:update', async (_, data) => {
  // data = { id: null, jfa_no: '...', agency_id: 1, ... }
  // This creates: UPDATE jfa_records SET ... WHERE id=$13 RETURNING *
  // With: [...params, null]
  // Result: No records match WHERE id=null → SILENT FAIL or partial update
  const res = await db.query(...);
  return res.rows[0];  // Returns undefined!
});
```

---

## 3. BUSINESS LOGIC ISSUES IN GET/POST/PUT

### A. JFA Records (`handlers.js` lines 103-188)

✅ **GET Functions**
- `jfa:getAll` - Works correctly with filters
- `jfa:getById` - Properly joins agency, venue, documents

❌ **CREATE Issue** (Line 159)
- Missing validation for required fields: `jfa_no`, `agency_id`, `fiscal_year`
- Should reject if `jfa_no` is duplicate (UNIQUE constraint exists)

❌ **UPDATE Issue** (Line 177)
- **CRITICAL:** No check for `data.id === null`
- Results in: `UPDATE jfa_records SET ... WHERE id=null` → 0 rows updated

### B. Job Fair Events (`handlers.js` lines 220-278)

❌ **CREATE Issue** (Line 235)
- Missing `job_fair_date_start` validation (NOT NULL in schema)
- No type validation for dates

❌ **UPDATE Issue** (Line 250)
- **CRITICAL:** No check for `data.id === null`
- `organizer_id` is optional but should validate if provided

❌ **Participant Handlers** (Line 281, 295)
- Missing validation: `event_id` must be valid FK reference
- `agency_id` not validated against agencies table

### C. Monitoring Records (`handlers.js` lines ~325+)

❌ **UPDATE Issue**
- `implementing_agency_id` is NOT NULL but no validation
- `venue_id` is optional but not validated

### D. Agency Management (`handlers.js` lines 19-56)

❌ **CREATE Issue** (Line 36)
- UNIQUE constraint: `(agency_name, agency_type)`
- No user feedback on duplicate

❌ **UPDATE Issue** (Line 46)
- **CRITICAL:** No check for `data.id === null`
- Can silently fail

### E. Venue Management (`handlers.js` lines 59-88)

❌ **UPDATE Issue** (Line 74)
- **CRITICAL:** No check for `data.id === null`

---

## 4. MISSING VALIDATION LAYERS

### Frontend (`renderer.js`)
- ❌ No null checks before calling API
- ❌ Form values not validated before submission
- ❌ `getFormInt()` returns 0 for empty strings (ambiguous)

### Backend (`handlers.js`)
- ❌ No constraint violation handling
- ❌ No NULL checks on foreign keys
- ❌ No try/catch error wrapping

### Example Missing Validation
```javascript
// renderer.js - openJfaForm()
async function openJfaForm(id = null) {
  // ... form code ...
  openModal(..., async () => {
    const data = {
      id: id,
      jfa_no: getFormValue('fJfaNo'),  // ← Could be null/empty!
      agency_id: getFormInt('fJfaAgency'),  // ← Could be 0!
      // ...
    };
    
    // NO VALIDATION - just send to API!
    if (id) await window.api.updateJfa(data);
    else await window.api.createJfa(data);
  });
}
```

---

## 5. SPECIFIC BUGS TO FIX

| # | Component | Issue | Impact | Severity |
|---|-----------|-------|--------|----------|
| 1 | All Modals | `data.id = null` included in data object | UPDATE fails silently | 🔴 CRITICAL |
| 2 | JFA:update | No `if (!data.id)` validation | NULL WHERE clause | 🔴 CRITICAL |
| 3 | JobFair:update | No `if (!data.id)` validation | NULL WHERE clause | 🔴 CRITICAL |
| 4 | Monitoring:update | No `if (!data.id)` validation | NULL WHERE clause | 🔴 CRITICAL |
| 5 | Agency:update | No `if (!data.id)` validation | NULL WHERE clause | 🔴 CRITICAL |
| 6 | Venue:update | No `if (!data.id)` validation | NULL WHERE clause | 🔴 CRITICAL |
| 7 | JFA:create | No required field validation | Invalid data inserted | 🟠 HIGH |
| 8 | JobFair:create | No date validation | Invalid data inserted | 🟠 HIGH |
| 9 | Forms | Missing form input validation | Garbage data sent | 🟠 HIGH |
| 10 | All handlers | No error wrapping/reporting | Silent failures | 🟠 HIGH |

---

## 6. RECOMMENDED FIXES

### Fix 1: Update Frontend Data Objects
**File:** `renderer.js`

Replace patterns like:
```javascript
// BEFORE:
const data = { id: id, field1: val1, ... };
if (id) await api.updateX(data);
else await api.createX(data);

// AFTER:
const baseData = { field1: val1, field2: val2, ... };
if (id) {
  await api.updateX({ ...baseData, id });
} else {
  await api.createX(baseData);
}
```

### Fix 2: Add Backend Validation
**File:** `handlers.js`

Add to every UPDATE handler:
```javascript
ipcMain.handle('entity:update', async (_, data) => {
  if (!data.id || isNaN(data.id)) {
    throw new Error('Invalid ID for update');
  }
  
  // Validate required fields
  if (!data.required_field) {
    throw new Error('required_field is required');
  }
  
  const res = await db.query(...);
  if (!res.rows.length) {
    throw new Error('Record not found or update failed');
  }
  return res.rows[0];
});
```

### Fix 3: Add Form Validation
**File:** `renderer.js`

Add validation before modal save callback:
```javascript
function validateJfaForm() {
  const errors = [];
  const jfaNo = getFormValue('fJfaNo');
  const agencyId = getFormInt('fJfaAgency');
  const year = getFormInt('fJfaYear');
  
  if (!jfaNo) errors.push('JFA No. is required');
  if (!agencyId || agencyId === 0) errors.push('Agency is required');
  if (!year || year === 0) errors.push('Fiscal Year is required');
  
  if (errors.length) {
    showToast(errors.join('; '), 'error');
    return false;
  }
  return true;
}
```

---

## 7. TEST CASES TO VERIFY

### Test Case 1: Create New JFA Record
1. Click "Add JFA" button
2. Fill form with valid data
3. Click Save
4. **Expected:** New record created, ID assigned, appears in table
5. **Current:** Likely fails silently or uses wrong data

### Test Case 2: Edit Existing JFA Record
1. Click Edit icon on existing JFA
2. Modify one field
3. Click Save  
4. **Expected:** Changes saved to correct record
5. **Current:** May not update or update NULL WHERE

### Test Case 3: Create Agency Without Name
1. Click "Add Agency"
2. Leave name empty
3. Click Save
4. **Expected:** Error message "Name is required"
5. **Current:** Form submission not blocked

---

## Summary

**Total Issues Found:** 13  
**Critical (🔴):** 6  
**High (🟠):** 7  
**System Status:** ⚠️ Data integrity at risk

**Recommendation:** Fix Critical issues immediately before production use.

---

