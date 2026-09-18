# Delivery roadmap

## Foundation (current)

- Workspace, API and web application
- Multi-organization data boundary
- Module registry and UPVC pack manifest
- Authentication and authorization foundation
- Generic client, brand, project and quote models

## Next: usable sales workflow

- Login and organization bootstrap UI
- CRUD APIs for clients, brands and projects
- Project hierarchy: buildings, floors, rooms and work packages
- Versioned rate cards
- Generic measurements and calculation definitions
- Quote alternatives and customer selection
- PDF quotation and approval workflow

## Operations

- Suppliers, purchasing and goods receipt
- Inventory, allocations, offcuts and wastage
- BOM, work orders and quality control
- Delivery and installation
- Change orders and job costing

## Platform customization

- Custom fields and forms
- Visual formula builder
- Workflow builder
- Document template builder
- Automation rules
- Kitchen, wardrobe and contractor packs

## Offline synchronization (implemented)

- Per-user IndexedDB cache for workspace reads
- Durable mutation queue for on-site work without connectivity
- Automatic retry on reconnect with visible pending and conflict states
- Server-side idempotency keys to prevent duplicate records during retry
