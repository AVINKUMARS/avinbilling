# Frontend review — 19 September 2026

## Confirmed on Render

- All 21 navigation pages opened in the signed-in workspace during a read-only smoke check.
- Submitting an invalid product showed no visible error and left the form open. The browser console contained an unhandled validation rejection. No test product was created in the live database.

## Fixed

- Shared form save boundary: pending state, disabled controls, duplicate-submit guard, and inline errors retaining entered values.
- Applied to customers, brands, products, projects, areas, measurements, warehouses/transfers, files/sharing, security password form, CRM, costing, service/warranty, and custom builders.
- Confirmation toast and close after successful main-form saves; offline queued saves have distinct wording.
- Capture custom fields before asynchronous requests; correct the swapped customer/project custom-field types.
- Capture warehouse form before awaiting its save so reset does not throw afterward.
- Refresh each workspace dataset independently: one failed module no longer prevents successful product/customer loads.
- Display server field-validation details and readable non-JSON response errors; a failed local cache write no longer hides fresh data.
- Label dialog and navigation controls, contain keyboard focus, restore focus, support Escape, and lock background scrolling while a dialog is open.
- Dashboard customer shortcut reflects whether customers already exist.

## Verification

- Regression tests cover product save/close/list refresh/toast, failed save retaining input, partial workspace load failure, customer event lifetime, duplicate submissions, API validation feedback, and cache failures.
- Production frontend build and TypeScript check.

## Limits / remaining verification

- Navigation smoke checks are not end-to-end verification of approvals, invoices, stock movements, payments, file uploads, or offline replay. These require a disposable test organization and representative data.
- Live success-path data creation was deliberately left to local regression tests to avoid polluting the business account.
- Offline custom-field follow-up writes and multi-step save recovery need a separate transactional/replay review.
- The existing large PDF bundle produces a build size warning; it remains lazy loaded.
