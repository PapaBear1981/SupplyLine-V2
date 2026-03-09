# SupplyLine V2 — Phase 2 Implementation Brief

## Requests / Fulfillment workflow alignment

## Objective
Implement Phase 2 of the SupplyLine V2 workflow refactor so the app better matches real operational flow for:

- mechanics creating requests
- materials/buyers/warehouse staff fulfilling them
- kit replenishment
- split fulfillment from multiple sources
- repairable/core return tracking back to the main warehouse (Stores)

This phase should improve workflow and data-model alignment without turning the system into an ERP or finance tool.

---

## Business rules
These are mandatory:

- SupplyLine is **not** the source of truth for PO, vendor, cost, or accounting workflows
- SupplyLine is **not** the source of truth for enterprise-wide expendable inventory locations
- SupplyLine **does** track:
  - tools
  - requests
  - fulfillment workflow
  - operational inventory movement
  - kit-held expendables
  - repairable/core returns back to the main warehouse
- Kits are **mobile warehouses**
- Standard warehouses participate in the same operational workflow
- The **main warehouse functions as Stores**
- If external procurement is required, SupplyLine tracks only the operational status, not the actual PO lifecycle

---

## Core workflow model

### Requests = demand
Requests represent operational need:
- manual mechanic request
- kit replenishment need
- warehouse replenishment need
- transfer need
- repairable/core-related operational need

### Fulfillment = response/work
Fulfillment represents how materials/stores/buyers respond:
- fulfill from source warehouse
- split quantities across multiple source locations
- transfer material
- replenish a kit
- mark awaiting external procurement
- track repairable/core return obligation
- close completed work

### Key structural rule
- **One request may have multiple fulfillment records/actions**
- **One request may be fulfilled from multiple source locations**
- Mechanics should see **summarized status**
- Fulfillment staff manage the detailed fulfillment actions

---

## Phase 2 scope

### 1. Data/workflow alignment
Implement the minimum viable backend/data changes needed for:

- multiple fulfillment actions per request
- multiple source-location fulfillment support
- request type
- request priority
- source/destination context
- repairable/core tracking fields
- fulfillment-specific status fields

Prefer additive changes over destructive rewrites.

---

### 2. Request model changes
Add or clarify support for:

- `request_type`
- `priority`
- `source_trigger`
- `destination_type`
- `destination_location`
- `related_kit`
- `related_warehouse`
- `item_class`
- `repairable`
- `core_required`
- optional `external_reference`

### Request priorities
Use exactly:
- `routine`
- `urgent`
- `aog`

### Request statuses
Use or map toward:
- `new`
- `under_review`
- `pending_fulfillment`
- `in_transfer`
- `awaiting_external_procurement`
- `partially_fulfilled`
- `fulfilled`
- `needs_info`
- `cancelled`

These are the statuses mechanics should primarily see.

---

### 3. Fulfillment model changes
Introduce or adapt a fulfillment-action structure so that:

- one request can have many fulfillment actions
- each fulfillment action can have:
  - source location
  - destination location
  - quantity
  - assigned owner
  - fulfillment status
  - external procurement flag
  - notes
- fulfillment actions roll up into a summarized request status for mechanics

If an existing order/procurement model exists, adapt it carefully rather than nuking everything blindly.

### Fulfillment statuses
Use or map toward operationally meaningful states such as:
- `new`
- `assigned`
- `sourcing`
- `in_transfer`
- `awaiting_external_procurement`
- `partially_fulfilled`
- `fulfilled`
- `closed`
- `cancelled`

Claude may refine naming if needed, but it must stay operational, not financial.

---

### 4. Split fulfillment support
This is required in Phase 2.

Example:
- request for quantity 10
- 4 fulfilled from main warehouse
- 6 fulfilled from satellite warehouse
- both actions linked to the same request

The request should roll up to:
- partially fulfilled until complete
- fulfilled once all required quantity is satisfied

---

### 5. Repairable / core return support
Implement basic but explicit support for repairable/core tracking.

Rules:
- when a repairable item is issued from a kit, create or associate a core-return obligation
- return destination should be the **main warehouse / Stores**
- mechanics can see summarized return state
- fulfillment side manages detailed return tracking

### Core return statuses
Use:
- `issued_core_expected`
- `in_return_transit`
- `returned_to_stores`
- `closed`

This is not a full repair-management workflow. Once returned to Stores/main warehouse, SupplyLine’s responsibility ends.

---

### 6. Requests page behavior
Requests page should clearly represent **demand**.

It should show:
- what is needed
- who requested it
- where it is needed
- request type
- priority
- summarized status
- whether it relates to replenishment or repairable/core handling

Mechanics should **not** see full fulfillment internals by default.

They should see rolled-up summaries like:
- Pending Fulfillment
- In Transfer
- Awaiting External Procurement
- Partially Fulfilled
- Fulfilled
- Core Return In Progress

---

### 7. Fulfillment page behavior
Fulfillment page should clearly represent **response/work queue**.

It should support:
- assignment
- sourcing decision
- split fulfillment
- source/destination visibility
- replenishment actions
- marking external procurement dependency
- repairable/core return management
- multiple fulfillment actions per request

This page should be the operational workspace for buyers/materials/stores users.

---

### 8. Kits and warehouses
Phase 2 should start surfacing the operational role of both:

#### Kits
- mobile warehouses
- local expendable tracking
- replenishment destination/source context
- repairable/core obligations from issued items

#### Warehouses
- operational stock locations
- fulfillment sources
- replenishment sources
- main warehouse acts as Stores for return/core receipt

Do **not** try to mirror the full enterprise expendable stock universe.

---

## Out of scope
Do **not** implement in Phase 2:

- PO creation
- vendor workflows
- pricing/cost
- accounting logic
- full external inventory system integration
- full company-wide expendable stock mirroring
- full repair process after return to main warehouse
- giant unrelated architecture rewrites

---

## UX/content guidance
Use operational language, not ERP/procurement language.

Prefer:
- Request
- Fulfillment
- Replenishment
- Transfer
- Awaiting External Procurement
- Return to Main Warehouse
- Core Expected
- AOG

Avoid finance-heavy language.

Mechanics get simple summarized statuses.
Fulfillment users get the detailed workflow controls.

---

## Compatibility guidance
- keep existing routes/API compatibility where possible
- avoid breaking seeded/demo data if reasonably avoidable
- prefer additive migrations over destructive changes
- do not break login/TOTP/session flows

---

## Validation requirements
Use Docker for validation.

At minimum:
1. rebuild/restart relevant containers
2. verify frontend/backend load correctly
3. verify Requests and Fulfillment pages render
4. verify at least one request can display multiple fulfillment actions
5. verify summarized status appears correctly on the request side
6. verify repairable/core return fields/status display where implemented
7. run the smallest relevant tests available
8. clearly note any pre-existing test harness failures

---

## Deliverables
Claude should provide:

1. code changes for Phase 2 only
2. any migrations/schema updates required
3. updated UI behavior for Requests and Fulfillment
4. Docker validation
5. one clean commit
6. summary of:
   - changed files
   - implemented workflow behavior
   - deferred items
   - validation steps
   - risks/caveats

---

## Guardrails
Claude should **not**:
- build a fake ERP
- add vendor/cost logic
- mirror all expendables
- dump mechanics into warehouse-internal detail
- over-refactor unrelated code

Claude **should**:
- make the workflow clearer
- support split fulfillment correctly
- represent repairable/core return explicitly
- preserve operational realism
- keep the changes understandable and reviewable

---

## Suggested implementation order
1. inspect current request/order data model
2. identify additive schema changes needed
3. update backend models/routes cautiously
4. update frontend Requests/Fulfillment UI
5. add/adjust status display logic
6. surface repairable/core workflow lightly but clearly
7. rebuild in Docker
8. validate app behavior
9. commit and summarize
