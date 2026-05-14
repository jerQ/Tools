# Compliancy Manager

A lightweight, browser-based tool for reviewing and tracking software requirements against compliance standards. Import a CSV of requirements, assess each one, add internal remarks, and export the results — no server required.

## Features

- Import requirements from a CSV file
- Set compliance status per requirement (Compliant, Non-Compliant, Partial, N/A)
- Add internal reviewer remarks
- View read-only customer feedback and acceptance status
- Filter by compliance status or customer acceptance
- Search requirements by ID or text
- Export reviewed requirements back to CSV
- All edits are saved in browser localStorage and survive re-imports

## Getting Started

### Run with Docker

```bash
docker build -t compliancymanager .
docker run -p 8080:80 compliancymanager
```

Then open `http://localhost:8080` in your browser.

### Run without Docker

Open `index.html` directly in any modern browser. No build step or server needed.

## CSV Format

The file must be UTF-8 encoded with a header row. Column order does not matter.

| Column | Required | Description |
|--------|----------|-------------|
| `id` | Yes | Unique identifier for the requirement (e.g. `REQ-001`) |
| `requirement` | Yes | Full requirement text |
| `compliancy` | No | Initial compliance status — editable in the app |
| `remarks` | No | Internal reviewer notes — editable in the app, stored locally |
| `customer_remarks` | No | Read-only customer feedback imported from the file |
| `customer_acceptance` | No | Read-only customer acceptance status imported from the file |

### Recognised compliancy values

Matching is case-insensitive. Any other value is shown as *Other*.

- `Compliant`
- `Non-Compliant` (also accepts `Non Compliant`)
- `Partial`
- `N/A` (also accepts `NA`)

### Recognised customer acceptance values

- `Accepted`
- `Rejected`
- `Conditional`
- `Pending`

### Example

```csv
id,requirement,compliancy,remarks,customer_remarks,customer_acceptance
REQ-001,"System shall authenticate all users.",Compliant,"Verified in UAT.","Approved by customer.",Accepted
REQ-002,"Data must be encrypted in transit.",Non-Compliant,"TLS upgrade pending.",,Rejected
```

A sample file with 15 requirements is included as `requirements.csv`.

## Usage

1. Click **Import CSV** in the sidebar and select your requirements file.
2. For each requirement card, set the **compliancy** status using the input field (autocomplete suggests values already in use).
3. Add **remarks** in the text area below each requirement.
4. Use the sidebar filters to focus on specific compliance states (e.g. *Non-Compliant*, *No Remarks*).
5. Use the top bar to filter by customer acceptance status or search by requirement ID/text.
6. Click **Export CSV** to download the full dataset with your assessments.

### Clear compliancy

The **Clear Compliancy** button resets all compliance status values and removes them from localStorage. Remarks are left untouched.

## Data Persistence

Edits are stored in `localStorage` under two keys:

| Key | Contents |
|-----|----------|
| `ct-compliancy` | Compliance status per requirement ID |
| `ct-remarks` | Reviewer remarks per requirement ID |

Because storage is keyed by requirement ID (not row index), edits are preserved if the CSV is re-imported in a different order. Re-importing also refreshes `customer_remarks` and `customer_acceptance` from the file, since those fields are read-only.

Clearing browser storage or using a different browser will lose saved edits. Export to CSV before clearing if you need a permanent record.
