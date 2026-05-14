// ── State ──────────────────────────────────────────────────────────────────
// Single source of truth for the loaded dataset. All rendering reads from here;
// localStorage is only consulted at import time to rehydrate user edits.
let rows = [];   // [{ id, requirement, compliancy, remarks, customer_remarks, customer_acceptance }]
let activeFilter           = 'all';
let activeAcceptanceFilter = 'all';
let searchQuery            = '';
let fileName               = '';

// ── Storage ────────────────────────────────────────────────────────────────
// Remarks and compliancy edits are persisted separately so that clearing one
// does not affect the other. Both are keyed by row id, not array index, so
// they survive re-imports of reordered or filtered CSV files.
const REMARKS_KEY    = 'ct-remarks';
const COMPLIANCY_KEY = 'ct-compliancy';

function loadStoredRemarks() {
  try { return JSON.parse(localStorage.getItem(REMARKS_KEY) || '{}'); }
  catch { return {}; }  // Corrupt storage should not break the app
}
function saveRemark(id, value) {
  const s = loadStoredRemarks(); s[id] = value;
  localStorage.setItem(REMARKS_KEY, JSON.stringify(s));
}

function loadStoredCompliancy() {
  try { return JSON.parse(localStorage.getItem(COMPLIANCY_KEY) || '{}'); }
  catch { return {}; }
}
function saveCompliancy(id, value) {
  const s = loadStoredCompliancy(); s[id] = value;
  localStorage.setItem(COMPLIANCY_KEY, JSON.stringify(s));
}

// ── CSV Parser ─────────────────────────────────────────────────────────────
// Character-by-character RFC 4180 parser. A line-split approach would be
// simpler but breaks on quoted fields that contain embedded newlines.
function parseCSV(text) {
  // Excel and some editors prepend a UTF-8 BOM; strip it before parsing.
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const result = [];
  let row = [], field = '', inQuotes = false, i = 0;

  while (i < text.length) {
    const ch = text[i], next = text[i + 1];
    if (inQuotes) {
      // "" inside a quoted field is an escaped literal quote (RFC 4180 §2.7)
      if (ch === '"' && next === '"') { field += '"'; i += 2; }
      else if (ch === '"')            { inQuotes = false; i++; }
      else                            { field += ch; i++; }
    } else {
      if      (ch === '"')                    { inQuotes = true; i++; }
      else if (ch === ',')                    { row.push(field); field = ''; i++; }
      else if (ch === '\r' && next === '\n')  { row.push(field); field = ''; result.push(row); row = []; i += 2; }
      else if (ch === '\n' || ch === '\r')    { row.push(field); field = ''; result.push(row); row = []; i++; }
      else                                    { field += ch; i++; }
    }
  }

  // Flush the final field/row if the file does not end with a newline
  if (field !== '' || row.length > 0) { row.push(field); result.push(row); }

  // Many editors append a trailing blank line; drop it to avoid a phantom row
  while (result.length > 0 && result[result.length - 1].every(f => f.trim() === '')) result.pop();

  return result;
}

// Converts the raw 2D array from parseCSV into objects keyed by lowercased
// header names, making column order irrelevant for downstream consumers.
function csvToObjects(parsed) {
  if (parsed.length < 2) return [];
  const headers = parsed[0].map(h => h.trim().toLowerCase());
  return parsed.slice(1).map(cols => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cols[i] ?? '').trim(); });
    return obj;
  });
}

// ── Import ─────────────────────────────────────────────────────────────────
document.getElementById('file-input').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  fileName = file.name;

  const reader = new FileReader();
  reader.onload = function (evt) {
    const objects    = csvToObjects(parseCSV(evt.target.result));
    const storedRem  = loadStoredRemarks();
    const storedComp = loadStoredCompliancy();

    // localStorage takes precedence over CSV for user-editable fields (remarks,
    // compliancy) so that re-importing the original file does not discard edits.
    // customer_remarks and customer_acceptance are read-only; they always come
    // from the CSV and are never overridden by local storage.
    rows = objects.map(obj => ({
      id:                  obj.id                  || '',
      requirement:         obj.requirement         || '',
      compliancy:          storedComp[obj.id] !== undefined ? storedComp[obj.id] : (obj.compliancy || ''),
      remarks:             storedRem[obj.id]  !== undefined ? storedRem[obj.id]  : (obj.remarks    || ''),
      customer_remarks:    obj.customer_remarks    || '',
      customer_acceptance: obj.customer_acceptance || ''
    }));

    render();
  };

  reader.readAsText(file);
  // Reset the input value so selecting the same file again triggers 'change'
  this.value = '';
});

// ── Export ─────────────────────────────────────────────────────────────────
// Opens the filename modal pre-filled with a sensible suggestion.
// Actual download is triggered by btn-export-confirm.
function exportCSV() {
  if (rows.length === 0) return;
  const suggestion = fileName.replace(/\.csv$/i, '') + '_export';
  document.getElementById('export-filename').value = suggestion;
  document.getElementById('export-modal-backdrop').classList.add('visible');
  // Select the filename text so the user can immediately overtype it
  document.getElementById('export-filename').select();
}

function downloadCSV(name) {
  const header = ['id', 'requirement', 'compliancy', 'remarks', 'customer_remarks', 'customer_acceptance'].map(csvEscape).join(',');
  const lines  = rows.map(r => [r.id, r.requirement, r.compliancy, r.remarks, r.customer_remarks, r.customer_acceptance].map(csvEscape).join(','));

  // Prepend BOM so Excel opens the file as UTF-8 without a manual import wizard
  const csv  = '\uFEFF' + [header, ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);

  // Ensure the filename always ends with .csv regardless of what the user typed
  const safeName = name.trim().replace(/\.csv$/i, '') + '.csv';

  // Trigger download via a temporary anchor; avoids any popup blocker issues
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Wraps a field in double quotes if it contains a delimiter, quote, or newline.
// Existing quotes are escaped by doubling them (RFC 4180 §2.7).
function csvEscape(value) {
  const s = String(value ?? '');
  return (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r'))
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

// ── Helpers ────────────────────────────────────────────────────────────────
// Escapes user-supplied strings before injecting them into innerHTML.
// Only covers the characters that matter in HTML attribute and text contexts.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Maps a free-text customer acceptance value to a CSS data-status token.
// Normalisation is case-insensitive exact match; anything unrecognised
// renders as 'other' rather than being silently dropped.
function acceptanceKey(value) {
  const v = (value || '').trim().toLowerCase();
  if (v === 'accepted')    return 'accepted';
  if (v === 'rejected')    return 'rejected';
  if (v === 'conditional') return 'conditional';
  if (v === 'pending')     return 'pending';
  return 'other';
}

// Maps a free-text compliancy value to a CSS data-status token.
// Accepts both "non-compliant" and "non compliant" to handle the common
// inconsistency between tools that generate compliance CSVs.
function compliancyKey(value) {
  const v = (value || '').trim().toLowerCase();
  if (v === 'compliant')                              return 'c';
  if (v === 'non-compliant' || v === 'non compliant') return 'nc';
  if (v === 'partial')                                return 'p';
  if (v === 'n/a' || v === 'na')                      return 'na';
  return 'other';
}

// ── Datalist ───────────────────────────────────────────────────────────────
// Rebuilds the shared <datalist> from all unique non-empty compliancy values
// currently in rows. Called on every keystroke in any compliancy input so
// that a value typed on one card propagates as a suggestion to all others
// without requiring the user to commit (blur/Enter) first.
function updateDatalist() {
  const unique = [...new Set(rows.map(r => r.compliancy).filter(v => v.trim() !== ''))];
  const dl = document.getElementById('compliancy-options');
  dl.innerHTML = unique.map(v => `<option value="${escapeHtml(v)}">`).join('');
}

// ── Filtered view ──────────────────────────────────────────────────────────
// Returns the subset of rows matching the active sidebar filter and search
// query. Filtering and searching are AND-combined. visibleRows() is cheap
// enough to call on every render; no caching is needed at this data size.
function visibleRows() {
  return rows.filter(row => {
    const key = compliancyKey(row.compliancy);
    if (activeFilter === 'compliant'     && key !== 'c')     return false;
    if (activeFilter === 'non-compliant' && key !== 'nc')    return false;
    if (activeFilter === 'partial'       && key !== 'p')     return false;
    if (activeFilter === 'na'            && key !== 'na')    return false;
    if (activeFilter === 'other'         && key !== 'other') return false;
    if (activeFilter === 'no-remarks'    && row.remarks.trim() !== '') return false;

    // Customer acceptance is a secondary AND filter applied on top of compliancy
    if (activeAcceptanceFilter !== 'all' && acceptanceKey(row.customer_acceptance) !== activeAcceptanceFilter) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!row.id.toLowerCase().includes(q) && !row.requirement.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

// ── Render ─────────────────────────────────────────────────────────────────
// Top-level render: rebuilds all dynamic UI from the current state.
// Called after import and after clear; partial re-renders (e.g. stats only)
// are used during editing to avoid resetting textarea focus and scroll position.
function render() {
  renderFileChip();
  renderStats();
  renderFilterLabels();
  renderCards();
  updateDatalist();
  document.getElementById('btn-export').disabled = rows.length === 0;
  document.getElementById('btn-clear').disabled  = rows.length === 0;
}

function renderFileChip() {
  document.getElementById('file-chip').textContent = fileName || 'No file loaded';
}

function renderStats() {
  const counts = { c: 0, nc: 0, p: 0, na: 0, other: 0 };
  rows.forEach(r => counts[compliancyKey(r.compliancy)]++);
  document.getElementById('stat-c').textContent     = counts.c;
  document.getElementById('stat-nc').textContent    = counts.nc;
  document.getElementById('stat-p').textContent     = counts.p;
  document.getElementById('stat-na').textContent    = counts.na;
  document.getElementById('stat-other').textContent = counts.other;
}

// Updates both the count labels and the active highlight on filter items.
// Counts always reflect the full dataset, not the current filtered view,
// so the user can see how many items each filter would reveal.
function renderFilterLabels() {
  const counts = { c: 0, nc: 0, p: 0, na: 0, other: 0, nr: 0 };
  rows.forEach(r => {
    counts[compliancyKey(r.compliancy)]++;
    if (!r.remarks.trim()) counts.nr++;
  });
  const map = {
    'all':           `All (${rows.length})`,
    'compliant':     `Compliant (${counts.c})`,
    'non-compliant': `Non-Compliant (${counts.nc})`,
    'partial':       `Partial (${counts.p})`,
    'na':            `N/A (${counts.na})`,
    'other':         `Other (${counts.other})`,
    'no-remarks':    `No Remarks (${counts.nr})`
  };
  document.querySelectorAll('.filter-item').forEach(el => {
    el.querySelector('.filter-label').textContent = map[el.dataset.filter];
    el.classList.toggle('active', el.dataset.filter === activeFilter);
  });
}

function renderCards() {
  const area    = document.getElementById('cards-area');
  const visible = visibleRows();

  if (rows.length === 0) {
    area.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">&#128194;</div>
        <h3>No file loaded</h3>
        <p>Click <strong>Import CSV</strong> in the sidebar to get started.</p>

        <div class="format-docs">
          <h4>Expected CSV format</h4>
          <p>The file must be UTF-8 encoded with a header row. Column order does not matter. Supported columns:</p>

          <table class="format-table">
            <thead>
              <tr><th>Column</th><th>Required</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td>id</td><td>Yes</td><td>Unique identifier for the requirement (e.g. REQ-001)</td></tr>
              <tr><td>requirement</td><td>Yes</td><td>Full requirement text</td></tr>
              <tr><td>compliancy</td><td>No</td><td>Initial compliance status — editable in the app</td></tr>
              <tr><td>remarks</td><td>No</td><td>Internal notes — editable in the app, stored locally</td></tr>
              <tr><td>customer_remarks</td><td>No</td><td>Read-only customer feedback imported from the file</td></tr>
              <tr><td>customer_acceptance</td><td>No</td><td>Read-only customer acceptance status imported from the file</td></tr>
            </tbody>
          </table>

          <h4>Recognised compliancy values</h4>
          <p>These values map to colour-coded statuses. Matching is case-insensitive. Any other value is shown as <em>Other</em>.</p>
          <div class="format-badges">
            <span class="compliancy-input" data-status="c">Compliant</span>
            <span class="compliancy-input" data-status="nc">Non-Compliant</span>
            <span class="compliancy-input" data-status="p">Partial</span>
            <span class="compliancy-input" data-status="na">N/A</span>
          </div>

          <h4>Recognised customer acceptance values</h4>
          <div class="format-badges">
            <span class="acceptance-badge" data-status="accepted">Accepted</span>
            <span class="acceptance-badge" data-status="rejected">Rejected</span>
            <span class="acceptance-badge" data-status="conditional">Conditional</span>
            <span class="acceptance-badge" data-status="pending">Pending</span>
          </div>

          <h4>Example</h4>
          <pre class="format-example">id,requirement,compliancy,remarks,customer_remarks,customer_acceptance
REQ-001,"System shall authenticate all users.",Compliant,"Verified in UAT.","Approved by customer.",Accepted
REQ-002,"Data must be encrypted in transit.",Non-Compliant,"TLS upgrade pending.",,Rejected</pre>
        </div>
      </div>`;
    return;
  }
  if (visible.length === 0) {
    area.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">&#128269;</div>
        <h3>No results</h3>
        <p>No requirements match your current filter or search.</p>
      </div>`;
    return;
  }

  // Full innerHTML replacement is intentional: it keeps the rendering logic
  // simple and stateless. The trade-off is that any open textarea loses focus
  // on a full re-render, which is why edits trigger only partial updates
  // (renderStats / renderFilterLabels) rather than a full render() call.
  area.innerHTML = visible.map(row => {
    const key = compliancyKey(row.compliancy);
    return `
      <div class="card card-${key}" data-card-id="${escapeHtml(row.id)}">
        <div class="card-header">
          <div class="card-meta">
            <span class="card-id">${escapeHtml(row.id)}</span>
            <input
              class="compliancy-input"
              list="compliancy-options"
              data-id="${escapeHtml(row.id)}"
              data-status="${key}"
              value="${escapeHtml(row.compliancy)}"
              placeholder="Set compliancy\u2026"
              spellcheck="false"
              autocomplete="off"
            >
            ${row.customer_acceptance ? `<span class="acceptance-badge" data-status="${acceptanceKey(row.customer_acceptance)}">${escapeHtml(row.customer_acceptance)}</span>` : ''}
          </div>
          <span class="card-requirement">${escapeHtml(row.requirement)}</span>
        </div>
        <hr class="card-divider">
        <div class="card-footer">
          <label>Remarks</label>
          <textarea data-id="${escapeHtml(row.id)}" placeholder="Add your remarks\u2026">${escapeHtml(row.remarks)}</textarea>
        </div>
        ${row.customer_remarks ? `
        <hr class="card-divider">
        <div class="card-customer-remarks">
          <label>Customer Remarks</label>
          <div class="customer-remarks-text">${escapeHtml(row.customer_remarks)}</div>
        </div>` : ''}
      </div>`;
  }).join('');

  // Event listeners are attached after innerHTML is set because the elements
  // did not exist before. Delegation on #cards-area would also work but this
  // keeps the handler logic co-located with the template.
  area.querySelectorAll('.compliancy-input').forEach(input => {

    // Update rows[] and datalist on every keystroke so other cards see the
    // new value as a suggestion immediately, without waiting for a commit.
    input.addEventListener('input', function () {
      this.dataset.status = compliancyKey(this.value);
      const idx = rows.findIndex(r => r.id === this.dataset.id);
      if (idx !== -1) rows[idx].compliancy = this.value;
      updateDatalist();
    });

    // Commit trims the value and persists it. The card's top border colour is
    // patched in-place rather than re-rendering the whole card to avoid
    // disrupting any other input that may currently be focused on the page.
    const commit = function () {
      const id    = this.dataset.id;
      const value = this.value.trim();
      const key   = compliancyKey(value);
      this.dataset.status = key;
      const idx = rows.findIndex(r => r.id === id);
      if (idx !== -1) rows[idx].compliancy = value;
      saveCompliancy(id, value);
      const card = document.querySelector(`[data-card-id="${id}"]`);
      if (card) card.className = `card card-${key}`;
      renderStats();
      renderFilterLabels();
      updateDatalist();
    };
    input.addEventListener('blur', commit);
    // Enter triggers blur rather than duplicating commit logic
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
    });
  });

  area.querySelectorAll('textarea[data-id]').forEach(ta => {
    ta.addEventListener('input', function () {
      const id  = this.dataset.id;
      const idx = rows.findIndex(r => r.id === id);
      if (idx !== -1) rows[idx].remarks = this.value;
      saveRemark(id, this.value);
      // Only filter labels need updating (no-remarks count may change);
      // stats are compliancy-based and unaffected by remark edits.
      renderFilterLabels();
    });
  });
}

// ── Event listeners ────────────────────────────────────────────────────────
// The visible import button proxies to a hidden <input type="file"> to allow
// full control over the button's appearance and placement.
document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('file-input').click();
});
document.getElementById('btn-export').addEventListener('click', exportCSV);

document.getElementById('btn-export-cancel').addEventListener('click', () => {
  document.getElementById('export-modal-backdrop').classList.remove('visible');
});
document.getElementById('btn-export-confirm').addEventListener('click', () => {
  const name = document.getElementById('export-filename').value.trim();
  if (!name) return;
  document.getElementById('export-modal-backdrop').classList.remove('visible');
  downloadCSV(name);
});
document.getElementById('export-modal-backdrop').addEventListener('click', function (e) {
  if (e.target === this) this.classList.remove('visible');
});
// Allow confirming with Enter while the filename input is focused
document.getElementById('export-filename').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') document.getElementById('btn-export-confirm').click();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  document.getElementById('modal-backdrop').classList.add('visible');
});
document.getElementById('btn-modal-cancel').addEventListener('click', () => {
  document.getElementById('modal-backdrop').classList.remove('visible');
});
document.getElementById('btn-modal-confirm').addEventListener('click', () => {
  // Wipe persisted compliancy and reset in-memory values. Remarks are
  // intentionally left untouched — the user is clearing suggestions, not
  // their review notes.
  localStorage.removeItem(COMPLIANCY_KEY);
  rows.forEach(r => { r.compliancy = ''; });
  document.getElementById('modal-backdrop').classList.remove('visible');
  render();
});
// Clicking the backdrop dismisses the modal without confirming
document.getElementById('modal-backdrop').addEventListener('click', function (e) {
  if (e.target === this) this.classList.remove('visible');
});

document.getElementById('acceptance-filter').addEventListener('change', function () {
  activeAcceptanceFilter = this.value;
  renderCards();
});

document.getElementById('search-box').addEventListener('input', function () {
  searchQuery = this.value.trim();
  // Search only affects card visibility, not stats or filter counts
  renderCards();
});
document.querySelectorAll('.filter-item').forEach(el => {
  el.addEventListener('click', function () {
    activeFilter = this.dataset.filter;
    renderFilterLabels();
    renderCards();
  });
});

// ── Init ───────────────────────────────────────────────────────────────────
// Render once on load to put the UI into its correct empty state
render();
