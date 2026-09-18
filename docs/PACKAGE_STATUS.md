# Avin Business Suite — Package Status Tracker

Last updated: 18 September 2026

This is the master implementation checklist for Avin Business Suite. Update this file whenever a package is started or completed.

## Status rules

- `[x] Completed`: Backend, frontend, validation, tests, production build and live UI verification are finished.
- `[~] In progress`: Implementation has started but required work remains.
- `[ ] Pending`: Package has not been started.
- A package is marked completed only after its code is committed and pushed to GitHub.

## Current priority

**Next package:** Runtime Customization Integration

## Package summary

| No. | Package | Status | Notes |
| ---: | --- | --- | --- |
| 1 | Platform Foundation | Completed | MERN workspace, MongoDB, PWA, organization bootstrap and authentication |
| 2 | Company Settings and Theme | Completed | Editable company documents, branding and software appearance |
| 3 | Products, Brands and Rate Cards | Completed | Multi-brand catalog, materials, services and versioned pricing |
| 4 | Projects, Floors, Rooms and Measurements | Completed | Building hierarchy and reusable measurements |
| 5 | Multi-brand Quotations and PDFs | Completed | Brand comparison, mixed-brand selection, revisions, sharing and PDFs |
| 6 | Approval, Payments and GST Invoices | Completed | Order locking, advances, invoices, credit notes and balances |
| 7 | BOM and Production | Completed | BOM generation, work orders, stages and quality checks |
| 8 | Purchasing and Inventory | Completed | Suppliers, purchase orders, receipts, stock and allocations |
| 9 | Delivery and Installation | Completed | Packing, dispatch, installation, snags and completion certificates |
| 10 | Reports and Project Profitability | Completed | Sales, GST, stock, wastage, logistics and profitability reports |
| 11 | Offline Synchronization | Completed | IndexedDB cache, mutation queue, retries, conflicts and duplicate protection |
| 12 | Users, Roles and Branches | Completed | Invitations, permissions, branch assignment, password controls and activity history |
| 13 | Custom Builders | Completed | Fields, forms, formulas, workflows and document-template builders |
| 14 | Additional Industry Packs | Completed | Eight configurable packs with installers, examples, formulas and workflows |
| 15 | Runtime Customization Integration | Pending | Use active custom definitions inside real screens, calculations and documents |
| 16 | Advanced Project Costing | Pending | Complete estimated-versus-actual job costing |
| 17 | Branch Data Isolation | Pending | Active branch selector and branch-restricted business records |
| 18 | Service and Warranty | Pending | Complaints, service jobs, warranty and technician visits |
| 19 | CRM Leads and Follow-ups | Pending | Lead pipeline, reminders, notes and conversion tracking |
| 20 | Files, Photos and Notifications | Pending | Attachments, site photos, WhatsApp/email and reminders |
| 21 | Advanced Audit and Security | Pending | Complete security hardening and immutable audit coverage |
| 22 | Production Deployment | Pending | Hosted application, production database, domain, SSL and backups |
| 23 | Full QA and Installation | Pending | End-to-end, mobile, offline, PWA installation and business acceptance testing |

## Completed package details

### [x] 1. Platform Foundation

- [x] React, Vite and Tailwind frontend
- [x] Node.js and Express API
- [x] MongoDB Atlas and Mongoose models
- [x] Multi-organization data foundation
- [x] Organization setup wizard
- [x] Login and JWT authorization
- [x] Installable PWA foundation

### [x] 2. Company Settings and Theme

- [x] Editable company, GST and bank information
- [x] Editable quotation and invoice wording
- [x] Theme colours, fonts, spacing and corner styles
- [x] Organization-specific settings storage

### [x] 3. Products, Brands and Rate Cards

- [x] Multiple brands and manufacturers
- [x] Products, materials, components, hardware and services
- [x] Purchase and selling rates
- [x] Wastage percentages
- [x] Rate-card versions and activation

### [x] 4. Projects, Floors, Rooms and Measurements

- [x] Customer projects
- [x] Buildings, floors, rooms and areas
- [x] Millimetre, inch and feet input conversion
- [x] Window, door and configurable measurement records

### [x] 5. Multi-brand Quotations and PDFs

- [x] Calculate multiple brands from one measurement
- [x] Mixed-brand quotation selections
- [x] Discounts, GST and additional charges
- [x] Quotation revisions
- [x] Client-side PDF generation
- [x] Web Share support

### [x] 6. Approval, Payments and GST Invoices

- [x] Irreversible quotation approval and locking
- [x] Advance and progress payments
- [x] GST invoices
- [x] Credit notes
- [x] Outstanding-balance calculation
- [x] Invoice PDFs

### [x] 7. BOM and Production

- [x] Automatic BOM generation
- [x] Profile and glass requirements
- [x] Work-order stages
- [x] Factory quality checklist
- [x] Production wastage reporting

### [x] 8. Purchasing and Inventory

- [x] Suppliers
- [x] Purchase orders
- [x] Goods receipts
- [x] Stock movements
- [x] Project allocation
- [x] Reorder warnings and valuation

### [x] 9. Delivery and Installation

- [x] Delivery scheduling and packing checklist
- [x] Dispatch and delivery status
- [x] Installation teams and checklist
- [x] Snag recording
- [x] Customer sign-off and completion certificate

### [x] 10. Reports and Project Profitability

- [x] Date filters
- [x] Sales and conversion
- [x] Collections and outstanding
- [x] GST summary
- [x] Project revenue, purchase cost and gross profit
- [x] Inventory valuation
- [x] Production and logistics performance
- [x] CSV export and printable report
- [x] GitHub commit `fd1a805`

### [x] 11. Offline Synchronization

- [x] Per-user IndexedDB read cache
- [x] Durable offline mutation queue
- [x] Automatic reconnect synchronization
- [x] Manual retry and conflict display
- [x] Server-side idempotency protection
- [x] GitHub commit `15c5b71`

### [x] 12. Users, Roles and Branches

- [x] Secure employee invitations
- [x] Standard roles and custom permissions
- [x] Branch creation and employee assignment
- [x] Account activation and deactivation
- [x] Administrator and self-service password controls
- [x] Login and access activity history
- [x] GitHub commit `9a353e7`

### [x] 13. Custom Builders

- [x] Visual field builder
- [x] Visual form builder
- [x] Formula builder
- [x] Workflow builder
- [x] Document-template builder
- [x] Live preview, validation, versions, activation and archiving
- [x] JSON export
- [x] GitHub commit `36da874`

## Pending package details

### [x] 14. Additional Industry Packs

- [x] Create reusable industry-pack contract and installer
- [x] Expand the UPVC pack with full product, measurement, formula, BOM and workflow defaults
- [x] Kitchen cabinet pack
- [x] Wardrobe pack
- [x] Interior works pack
- [x] Aluminium windows and doors pack
- [x] Glass and mirror work pack
- [x] Civil contractor pack
- [x] General trading and services pack
- [x] Industry-pack selection and configuration screen
- [x] Seed example data separately for each pack
- [x] GitHub commit `a6b9e28`

### [ ] 15. Runtime Customization Integration

- [ ] Render active custom fields on their selected entity screens
- [ ] Render active custom forms inside projects and measurements
- [ ] Execute approved formulas through a safe calculation engine
- [ ] Apply active workflows to real records
- [ ] Use document templates in quotation, invoice and other PDFs
- [ ] Preserve custom values in MongoDB
- [ ] Add custom-definition import

### [ ] 16. Advanced Project Costing

- [ ] Project budget
- [ ] Labour and subcontractor costs
- [ ] Transport, installation and site expenses
- [ ] General and miscellaneous expenses
- [ ] Change orders and variations
- [ ] Material issue and return costing
- [ ] Estimated-versus-actual comparison
- [ ] Gross and net project profit
- [ ] Cost approval controls

### [ ] 17. Branch Data Isolation

- [ ] Active branch selector
- [ ] Save branch ID on new business records
- [ ] Restrict lists and reports to permitted branches
- [ ] Organization-wide access for owners and approved managers
- [ ] Branch transfer workflow
- [ ] Branch-specific numbering and stock warehouses
- [ ] Automated data-isolation tests

### [ ] 18. Service and Warranty

- [ ] Product warranty registration
- [ ] Customer complaints
- [ ] Service tickets
- [ ] Technician assignment
- [ ] Site-visit scheduling
- [ ] Parts and service charges
- [ ] Resolution and customer sign-off
- [ ] Warranty-expiry reminders

### [ ] 19. CRM Leads and Follow-ups

- [ ] Lead capture
- [ ] Sales pipeline stages
- [ ] Follow-up reminders
- [ ] Customer notes and communication history
- [ ] Lost-lead reasons
- [ ] Lead-to-project conversion
- [ ] Salesperson performance

### [ ] 20. Files, Photos and Notifications

- [ ] Secure file storage provider
- [ ] Site and measurement photos
- [ ] Documents attached to customers and projects
- [ ] Delivery and installation proof uploads
- [ ] WhatsApp sharing integration
- [ ] Email notifications
- [ ] Payment and follow-up reminders
- [ ] Notification preferences

### [ ] 21. Advanced Audit and Security

- [ ] Immutable audit coverage for all important changes
- [ ] Login attempt and security-event history
- [ ] API rate limiting
- [ ] Refresh-token or secure session strategy
- [ ] Password recovery flow
- [ ] Data export and account recovery controls
- [ ] Dependency and penetration testing
- [ ] Production secrets review

### [ ] 22. Production Deployment

- [ ] Rotate the MongoDB password shared during development
- [ ] Create a least-privilege production database user
- [ ] Restrict MongoDB Atlas network access
- [ ] Enable automated database backups
- [ ] Deploy API and frontend
- [ ] Configure production environment variables
- [ ] Configure domain and SSL
- [ ] Configure monitoring, logs and uptime alerts
- [ ] Validate GST wording with the business accountant

### [ ] 23. Full QA and Installation

- [ ] API integration tests
- [ ] Frontend component tests
- [ ] Complete end-to-end business workflow tests
- [ ] Offline and synchronization tests
- [ ] Permission and branch-isolation tests
- [ ] PDF visual regression tests
- [ ] Android PWA installation test
- [ ] iPhone PWA installation test
- [ ] Windows desktop PWA installation test
- [ ] Backup and restore test
- [ ] Uncle's real-data acceptance test
- [ ] User and administrator guides

## Completion history

| Date | Package | GitHub commit |
| --- | --- | --- |
| 17 Sep 2026 | Reports and Project Profitability | `fd1a805` |
| 18 Sep 2026 | Offline Synchronization | `15c5b71` |
| 18 Sep 2026 | Users, Roles and Branches | `9a353e7` |
| 18 Sep 2026 | Custom Builders | `36da874` |
| 18 Sep 2026 | Additional Industry Packs | `a6b9e28` |

## How to update this file

When starting a package:

1. Change its summary status from `Pending` to `In progress`.
2. Change its heading marker from `[ ]` to `[~]`.
3. Mark individual completed tasks with `[x]`.

When finishing a package:

1. Confirm every required task is checked.
2. Run type checking, automated tests and the production build.
3. Perform a live UI test.
4. Commit and push to GitHub.
5. Change the package status to `Completed` and its heading to `[x]`.
6. Add the completion date and GitHub commit to the completion-history table.
7. Move **Current priority** to the next pending package.
