# UI Debug Plan — Para Copilot

## Test Infrastructure

- **Tool:** Playwright (chromium, headless)
- **Script:** `e2e/uiAudit.mjs`
- **Target:** `http://localhost:3456` (dev server via `npm start`)
- **Runner:** `node e2e/uiAudit.mjs`

## Test Surfaces (15 categories, 39 checks)

### 1. App Load (4 checks)
- [x] Page loads with title
- [x] Brand header (`.brand`) rendered
- [x] Sidebar (`.sidebar`) rendered
- [x] Main content (`.main-content`) rendered

### 2. Period Switching (2 checks)
- [x] Switch to Period 1 via `select.period-select`
- [x] Switch back to Period 3

### 3. Navigation (5 checks)
- [x] Found 18 nav buttons in sidebar
- [x] Navigate to Data Vault
- [x] Navigate to IEP Import
- [x] Navigate to Analytics
- [x] Navigate to Dashboard

### 4. Simple Mode (3 checks)
- [x] Toggle Simple Mode ON — button text updates
- [x] Simple mode shows 20 interactive elements (student cards)
- [x] Toggle Simple Mode OFF

### 5. Toolbox Sidebar (4 checks)
- [x] Situations panel opens in second aside
- [x] Close button works
- [x] Timer toolbox opens
- [x] Fullscreen button available for student-safe tool

### 6. Stealth Mode (3 checks)
- [x] Fixed overlay appears at z-index 1500
- [x] Contains "Classroom Tools" / "Stealth Mode Active" text
- [x] Exit Stealth button works

### 7. Private Roster (2 checks)
- [x] Panel opens on button click
- [x] Panel closes on second click (toggle)

### 8. Dashboard (5 checks)
- [x] Student cards render (0 in non-demo mode, correct)
- [x] Copilot chat panel toggles open
- [x] Chat bubbles area renders with initial message
- [x] Chat input found with correct placeholder
- [x] Chat message sends and displays as new bubble

### 9. Vault View (4 checks)
- [x] Vault header "Data Vault" visible
- [x] 3 vault tab buttons found (All Logs, By Student, Flagged)
- [x] By Student tab clickable
- [x] KB tab shows "Add to Knowledge Base" form

### 10. Analytics (1 check)
- [x] Analytics view renders in main content

### 11. IEP Import (1 check)
- [x] IEP Import view renders in main content

### 12. Quick Actions (2 checks)
- [x] Panel opens with content (488 chars)
- [x] Close button works

### 13. Floating Tool Window (1 check)
- [x] Double-click Timer nav button creates floating window at z-index 1200

### 14. Student Profile Modal (1 check)
- [x] Gracefully handles no student cards (demo mode off)

### 15. Console Errors (1 check)
- [x] Zero console errors during full navigation cycle

## Results

```
PASSED: 39
ISSUES: 0
```

## Issues Found and Fixed During Development

### Issue 1: Stealth overlay text selector (test-only)
- **Symptom:** `text=Stealth Mode Active` Playwright selector didn't match
- **Root cause:** Playwright text selector matching behavior with inline-styled divs
- **Fix:** Used style-based selector `div[style*="position: fixed"][style*="z-index: 1500"]` + textContent verification
- **Category:** Test selector, not app bug

### Issue 2: Chat panel not visible by default (test-only)
- **Symptom:** `.chat-window` and chat input not found on Dashboard
- **Root cause:** Chat panel is hidden by default, requires clicking "Copilot" toggle button
- **Fix:** Added Copilot button click before checking chat elements
- **Category:** Test flow, not app bug

### Issue 3: Floating window selector mismatch (test-only)
- **Symptom:** `div[style*="resize"]` didn't match floating window
- **Root cause:** Resize handle is a child element, not on the main container div
- **Fix:** Used `div[style*="z-index: 1200"]` selector instead
- **Category:** Test selector, not app bug

## Surfaces Not Tested (requires data/external services)

These require imported student data or running Ollama, which aren't available in headless automated testing:

1. **Student profile modal tabs** — needs student cards (requires IEP import)
2. **Ollama AI chat responses** — needs Ollama running (`ollama serve`)
3. **AI pattern summary / handoff / email draft** — needs Ollama + student data
4. **Google Doc fetch** — needs valid doc link
5. **CSV export** — triggers file download (hard to verify in headless)
6. **PDF upload to KB** — needs file input interaction
7. **Drag/resize floating windows** — requires precise mouse movement simulation
8. **IEP paste/import flow** — needs clipboard data

## How to Run

```bash
# Start dev server
npm start

# In another terminal, run the audit
node e2e/uiAudit.mjs
```

Requires Playwright installed: `npm install -D playwright && npx playwright install`
