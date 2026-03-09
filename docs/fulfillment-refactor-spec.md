# SupplyLine V2 Fulfillment Refactor Spec

## Status
Draft v1 for review before implementation.

## Purpose
SupplyLine V2 is an **operational inventory movement and fulfillment system** for an aerial firefighting company.

It should support:
- tool tracking
- parts/material requests
- movement between warehouses and mobile kits
- replenishment of mobile kits
- visibility into operational demand and fulfillment
- tracking repairable/core returns back to Stores

It is **not** the source of truth for:
- purchase orders
- vendor accounting
- pricing/cost
- finance workflows
- the company-wide inventory master

If external procurement is required, SupplyLine should track the **operational status** only. The actual PO and accounting workflow remains in the existing inventory control system.

---

## Core Product Model
This is **one workflow with multiple roles**, not two disconnected modules.

### Core flow
1. Demand is created
2. Fulfillment team reviews it
3. Source is determined
4. Material moves or external procurement is tracked
5. Request is completed
6. If a repairable/core is involved, the return is tracked back to Stores

---

## Key Concepts

### Request
A request is a record of **operational demand**.

A request answers:
- what is needed
- how much is needed
- where it is needed
- why it is needed
- how urgent it is
- what triggered it

A request does **not** necessarily mean a purchase order.

### Fulfillment
Fulfillment is the **materials / buyers / warehouse response** to a request.

Examples:
- fulfill from main warehouse stock
- fulfill from satellite warehouse stock
- replenish a mobile kit
- transfer material between locations
- mark as awaiting external procurement
- partially fulfill and keep the remainder open

**Rename the current Orders page to Fulfillment.**

### Location
A location is any operational inventory node.

Types:
- Main warehouse
- Satellite warehouse
- Mobile warehouse / kit
- Maintenance base / destination point
- Optional future: external/vendor reference only

### Mobile kit
A mobile kit is a **mobile warehouse**, not a static bag of parts.

Characteristics:
- follows aircraft/mobile operations
- gets depleted through issuance
- must be replenished to maintain readiness
- should have local expendable tracking only for the stock physically in the kit

### Standard warehouse
A standard warehouse stores tools and materials and can fulfill requests or replenish kits.

Important scope boundary:
- SupplyLine should support warehouse-side movement and fulfillment workflows
- SupplyLine should **not** try to mirror the full company expendable stock master from the legacy inventory system

### Expendables
Expendables in SupplyLine should be limited to:
- expendables physically held in kits
- optional operational references needed to request or replenish stock

The main inventory program remains the source of truth for bulk expendable stock, accounting, and enterprise-wide inventory positioning.

### Repairables / cores
Some issued items are repairable assets, not disposables.

When a repairable item is issued from a kit:
1. the item is issued from the kit
2. a core/return obligation is created
3. the return/core is tracked back to Stores
4. once returned to Stores, SupplyLine responsibility ends

This is an operational return-tracking workflow, not a full repair-management workflow.

---

## Roles and Workspaces

### Mechanics / field ops
Primary workspace: **Requests**

They need to:
- create requests for tools, parts, materials, and consumables
- see requests generated from kit depletion/replenishment needs
- view status of their requests
- understand whether something is being reviewed, fulfilled, transferred, or awaiting external procurement

They should **not** need to understand purchasing-system details.

### Buyers / materials / warehouse staff
Primary workspace: **Fulfillment**

They need to:
- review incoming requests
- determine source location
- decide whether fulfillment can happen internally
- mark when external procurement is required
- fulfill, partially fulfill, transfer, replenish, or close requests
- track repairable/core returns when applicable

They should **not** be forced into fake PO/accounting fields that belong in another system.

### Admin / managers
Need visibility across both sides:
- demand backlog
- urgent requests
- kits needing replenishment
- items awaiting external procurement
- repairable/core return backlog
- bottlenecks by warehouse, kit, or request type

---

## Request Types
Each request should have a request type.

Recommended types:
1. **Manual Request**
   - created by mechanic/user
   - tool, part, consumable, etc.

2. **Kit Replenishment**
   - created because a mobile kit was depleted
   - may be automatic or user-assisted

3. **Warehouse Replenishment**
   - created when a standard warehouse needs stock replenishment or movement support

4. **Transfer Request**
   - material needs to move from one location to another

5. **Repairable Return / Core Tracking**
   - created or linked when a repairable item issued from a kit must be returned to Stores

Notes:
- External procurement is usually a **fulfillment outcome/state**, not a request type.
- A request may lead to internal movement, external procurement tracking, or both.

---

## Request Fields
Each request should capture at least:

### Identity
- request number
- title / short description
- created date/time
- created by
- request type

### Item detail
- item class: tool / part / chemical / expendable / repairable / other
- item identifier (part number, tool number, SKU, etc.)
- description
- quantity requested
- unit of measure

### Operational context
- source trigger
  - manual
  - kit issuance
  - low stock
  - transfer
  - return/core obligation
- destination type
  - mobile kit
  - warehouse
  - person/team
  - base/location
- destination ID/name
- related kit, if applicable
- related aircraft type, if applicable
- related warehouse, if applicable

### Business context
- priority
  - routine
  - urgent
  - critical / AOG-equivalent
- reason / notes
- needed-by date (optional)

### Workflow context
- current request status
- fulfillment summary/status
- assigned fulfillment owner (optional)
- external system reference (optional, if used)

### Repairable/core fields
When relevant:
- repairable flag
- core required flag
- return destination (default: Stores)
- return status
- return completed date

---

## Request Statuses
These should be understandable to mechanics and field users.

Recommended request lifecycle:
- **New**
- **Under Review**
- **Approved**
- **Pending Fulfillment**
- **In Transfer**
- **Awaiting External Procurement**
- **Partially Fulfilled**
- **Fulfilled**
- **Needs Info**
- **Cancelled**

Mechanics should mostly track the request through these statuses, not through purchasing jargon.

---

## Fulfillment Queue Behavior
The current Orders page should be renamed and reworked as **Fulfillment**.

Each fulfillment item should answer:
- what request needs action?
- what location needs it?
- can it be sourced internally?
- if yes, from where?
- if not, is external procurement required?
- is this replenishing a kit, supporting a warehouse, or satisfying a direct request?
- is there a repairable/core return obligation attached?

### Fulfillment actions
Buyers/materials/warehouse users should be able to:
- assign request to self
- mark under review
- choose fulfillment source
- transfer from warehouse A to location B
- replenish kit X
- mark awaiting external procurement
- record partial fulfillment
- mark fulfilled
- add internal notes/comments
- send back for clarification
- track repairable/core return progress when applicable

---

## Relationship Between Requests and Fulfillment
This is the core product rule:

- **Request = demand**
- **Fulfillment = response/work**

Implications:
- every fulfillment record links back to a request
- a request may have one or more fulfillment actions over time
- mechanics care primarily about request status
- buyers/materials/warehouse staff care primarily about fulfillment work state

This is **one lifecycle viewed from two roles**, not two separate products.

---

## Internal vs External Sourcing

### Internal fulfillment
Use when stock exists in:
- main warehouse
- satellite warehouse
- another location
- possibly another kit if allowed by business rules

Outcome:
- create transfer / issue / replenishment movement
- update movement history
- move request toward fulfillment

### External procurement
Use when stock does not exist internally.

Outcome:
- mark request as **Awaiting External Procurement**
- optionally store an external reference number
- do not recreate PO logic inside SupplyLine
- once item is received through the real-world process, continue fulfillment inside SupplyLine

---

## Kit Behavior
Kits are mobile warehouses and need explicit support for:
- local inventory visibility
- inventory depletion through issuance
- replenishment requests
- link to aircraft/platform context
- location-aware fulfillment
- repairable/core tracking on issued items

### Important rule
A kit replenishment request is not just “buy this thing.”
It is:
> this operational location needs stock restored to readiness.

### Expendable scope rule
SupplyLine should track expendables **in kits only**, not the full company-wide expendable catalog/location map.

---

## Warehouse Behavior
Standard warehouses should support:
- storing tools and operationally relevant materials
- fulfilling requests
- transferring stock
- replenishing kits
- optionally creating/receiving replenishment requests
- receiving returned repairable/core items into Stores

Warehouses and kits should be modeled as related but distinct location types.

---

## Repairable / Core Return Workflow
This needs to be explicit, not buried in notes.

### When a repairable item is issued from a kit
1. item is issued from kit inventory
2. request/issuance is flagged as **repairable**
3. a return/core obligation is created
4. return is tracked back to Stores
5. once received by Stores, the workflow in SupplyLine ends

### Recommended return statuses
- **Issued – Core Expected**
- **In Return Transit**
- **Returned to Stores**
- **Closed**

This is reverse-logistics tracking, not full repair management.

---

## Page Responsibilities

### Requests page
Audience:
- mechanics
- field ops
- requestors

Purpose:
- create requests
- view own/all relevant requests
- track status
- understand destination and urgency
- see fulfillment progress in plain operational language

Should not feel like procurement or ERP software.

### Fulfillment page
Audience:
- buyers
- materials staff
- warehouse staff

Purpose:
- operational work queue
- assign and process requests
- choose source location
- move material
- mark external procurement dependency
- manage replenishment and transfers
- track repairable/core return obligations

Suggested page name:
- **Fulfillment**

### Warehouses page
Purpose:
- manage fixed-location inventory nodes
- support sourcing and transfer decisions
- receive repairable/core returns into Stores

### Kits page
Purpose:
- manage mobile warehouses
- track readiness and local stock
- track replenishment needs
- track repairable/core obligations resulting from kit issuance

---

## Dashboard / Reporting Implications
Dashboards and reports should emphasize:
- new requests
- urgent requests
- awaiting fulfillment
- awaiting external procurement
- partially fulfilled items
- kits needing replenishment
- warehouses with shortages or bottlenecks
- repairable/core return backlog

Reports should focus on:
- fulfillment time
- top requested items
- stockout-driven requests
- kit replenishment trends
- warehouse-to-kit movement volume
- unresolved critical requests
- repairable/core return completion time

Not cost. Not finance. Not vendor accounting.

---

## Out of Scope
To keep this sane, these are out of scope:
- purchase order creation
- vendor invoice workflows
- pricing/cost calculations
- accounting integration as source of truth
- replacing the existing inventory control system
- full company-wide expendable stock/location mirroring
- full repair lifecycle after Stores receives a return/core

Possible later:
- external reference number fields
- sync/import/export bridges with the legacy inventory system

---

## Phase 1 Refactor Scope
Phase 1 should focus on **terminology, workflow clarity, and UI structure**, not deep automation.

### Phase 1 goals
- rename **Orders** to **Fulfillment**
- clarify Request vs Fulfillment roles in UI copy
- clean up statuses and labels to match the real operational workflow
- make page summaries and empty states match the new model
- improve field naming for request and fulfillment context where low-risk
- surface kit replenishment and repairable/core-return concepts in the workflow language

### Phase 1 non-goals
- full data model rewrite
- full automation of replenishment generation
- full repairable/core lifecycle engine
- deep backend redesign unless required for UI/workflow clarity
- integration with the external inventory system

---

## Phase 2 Refactor Scope
- align request/fulfillment data model with the workflow
- add request types
- add source/destination location fields
- add repairable/core tracking fields
- distinguish kit-tracked expendables from externally-owned bulk stock
- support clearer fulfillment state tracking

---

## Phase 3 Refactor Scope
- automatic kit replenishment triggers
- automatic repairable/core return obligations
- better dashboards and reports
- more advanced filters, timelines, and alerts

---

## Decisions Already Agreed
- Rename **Orders** to **Fulfillment**
- Main inventory program remains source of truth for company-wide expendable stock
- SupplyLine tracks expendables in kits, not the entire expendable inventory universe
- SupplyLine tracks repairable/core returns back to Stores, but not the full repair process after Stores receives them
- Docker-based testing is preferred because it reflects the real app/database behavior more accurately

---

## Open Questions for Review
1. Should standard warehouses be able to create replenishment requests directly, or only respond to them?
2. Can one request create multiple fulfillment actions?
3. Can one request be fulfilled by multiple source locations?
4. Should repairable/core tracking be shown primarily on Requests, Fulfillment, Kits, or a combination?
5. What exact priorities should exist in the UI?
6. Do comments/messages need to be first-class in Phase 1, or can they wait?
7. Do mechanics need to see internal fulfillment detail, or only summarized statuses?
8. Should kit replenishment requests be automatic, manual, or both in the final model?
