# Recreating the Kits System

This document provides a detailed technical guide to recreating the Mobile Warehouse (Kits) system, based on the analysis of the existing codebase. It covers the database schema, API endpoints, business logic, and frontend requirements.

## 1. Database Schema

The system relies on several relational models.

### Core Models

*   **`AircraftType`**
    *   **Purpose**: Categorizes kits (e.g., Q400, RJ85).
    *   **Fields**: `id`, `name` (unique), `description`, `is_active`, `created_at`.
    *   **Relationships**: One-to-many with `Kit`.

*   **`Kit`**
    *   **Purpose**: Represents a mobile warehouse.
    *   **Fields**: `id`, `name` (unique), `aircraft_type_id` (FK), `description`, `status` ('active', 'inactive', 'maintenance'), `created_at`, `updated_at`, `created_by` (FK).
    *   **Relationships**:
        *   Belongs to `AircraftType`.
        *   Has many `KitBox`, `KitItem`, `KitExpendable`, `KitIssuance`, `KitReorderRequest`, `KitMessage`.

*   **`KitBox`**
    *   **Purpose**: Physical containers within a kit.
    *   **Fields**: `id`, `kit_id` (FK), `box_number` (e.g., "Box1"), `box_type` ('expendable', 'tooling', 'consumable', 'loose', 'floor'), `description`, `created_at`.
    *   **Constraints**: Unique constraint on `(kit_id, box_number)`.

### Inventory Models

*   **`KitItem`**
    *   **Purpose**: Tracks tools and chemicals transferred from the main warehouse.
    *   **Fields**: `id`, `kit_id` (FK), `box_id` (FK), `item_type` ('tool', 'chemical'), `item_id` (FK to `Tool` or `Chemical`), `part_number`, `serial_number`, `lot_number`, `description`, `quantity`, `location`, `status` ('available', 'issued', 'maintenance'), `added_date`, `last_updated`.
    *   **Logic**: These items retain a link to their original warehouse record (`item_id`) but the warehouse record's `warehouse_id` is set to `NULL` while in a kit.

*   **`KitExpendable`**
    *   **Purpose**: Tracks expendable items (fasteners, etc.) which are often created directly in the kit or transferred without a persistent warehouse link.
    *   **Fields**: `id`, `kit_id` (FK), `box_id` (FK), `part_number`, `serial_number`, `lot_number`, `tracking_type` ('lot', 'serial', 'none'), `description`, `quantity`, `unit`, `location`, `status`, `minimum_stock_level`, `added_date`, `last_updated`.
    *   **Logic**: Can track by lot OR serial, or neither.

### Transaction Models

*   **`KitIssuance`**
    *   **Purpose**: Audit log of items used/consumed from the kit.
    *   **Fields**: `id`, `kit_id` (FK), `item_type`, `item_id`, `issued_by` (FK), `issued_to` (FK), `part_number`, `serial_number`, `lot_number`, `description`, `quantity`, `purpose`, `work_order`, `issued_date`, `notes`.

*   **`KitTransfer`**
    *   **Purpose**: Tracks movements between Kit<->Kit or Kit<->Warehouse.
    *   **Fields**: `id`, `item_type`, `item_id`, `from_location_type` ('kit', 'warehouse'), `from_location_id`, `to_location_type`, `to_location_id`, `quantity`, `transferred_by` (FK), `transfer_date`, `status` ('pending', 'completed', 'cancelled'), `completed_date`, `notes`.

*   **`KitReorderRequest`**
    *   **Purpose**: Requests to restock items.
    *   **Fields**: `id`, `kit_id` (FK), `item_type`, `item_id`, `part_number`, `description`, `quantity_requested`, `priority`, `requested_by` (FK), `requested_date`, `status`, `approved_by` (FK), `approved_date`, `fulfillment_date`, `notes`, `is_automatic`, `image_path`.

*   **`KitMessage`**
    *   **Purpose**: Communication between mechanics and stores.
    *   **Fields**: `id`, `kit_id` (FK), `related_request_id` (FK), `sender_id` (FK), `recipient_id` (FK), `subject`, `message`, `is_read`, `sent_date`, `read_date`, `parent_message_id` (FK), `attachments`.

## 2. Business Logic & Workflows

### Kit Creation (Wizard)
1.  **Select Aircraft Type**: Choose from active types.
2.  **Details**: Name (unique), description.
3.  **Box Configuration**: System suggests default boxes (Box1-Expendable, Box2-Tooling, etc.), user can customize.
4.  **Creation**: Creates `Kit` and `KitBox` records transactionally. Logs to `AuditLog`.

### Transfers (Complex Logic)
*   **Warehouse to Kit**:
    *   **Tools**: Validates tool exists in source warehouse. Sets `Tool.warehouse_id` to `NULL`. Creates `KitItem`.
    *   **Chemicals**: Validates chemical exists. If partial quantity transfer, may create a "child chemical" record (lot splitting). Sets `Chemical.warehouse_id` to `NULL` (or updates location if partial). Creates `KitItem`.
    *   **Expendables**: Not typically transferred from warehouse in this model (created directly in kit), but if supported, would create `KitExpendable`.
    *   **Status**: Auto-completes immediately.
*   **Kit to Kit**:
    *   **Status**: Starts as `pending`. Requires manual completion by Materials department.
    *   **Completion**: Decrements source quantity. Increments destination quantity (or creates new item/expendable). Handles merging of expendables if same part/lot/serial exists in destination.
*   **Kit to Warehouse**:
    *   Returns item to warehouse control. Updates `warehouse_id` on the underlying `Tool` or `Chemical`.

### Issuance
*   **Tools**: Cannot be issued (only transferred or retired).
*   **Consumables/Expendables**:
    *   User selects item and quantity.
    *   Validates quantity <= available.
    *   Decrements stock.
    *   Creates `KitIssuance` record.
    *   **Auto-Reorder**: If quantity drops below `minimum_stock_level`, automatically creates a `KitReorderRequest`.
    *   **Barcode**: Triggers a barcode print modal after issuance (for labeling the issued portion if needed, or just confirmation).

### Reordering
*   **Triggers**: Manual request OR Automatic (low stock/out of stock).
*   **Workflow**: Pending -> Approved -> Ordered -> Fulfilled.
*   **Fulfillment**: When fulfilled, items are added to the kit (often via a transfer or direct add).

## 3. API Endpoints

### Base Path: `/api/kits`

*   `GET /`: List kits (filters: status, aircraft_type_id).
*   `POST /`: Create kit.
*   `GET /{id}`: Get kit details.
*   `PUT /{id}`: Update kit.
*   `DELETE /{id}`: Soft delete (set status to inactive).
*   `POST /{id}/duplicate`: Duplicate a kit structure (boxes) to a new kit.
*   `POST /wizard`: Multi-step validation for kit creation.

### Sub-resources

*   **Boxes**:
    *   `GET /{id}/boxes`
    *   `POST /{id}/boxes`
    *   `PUT /{id}/boxes/{box_id}`
    *   `DELETE /{id}/boxes/{box_id}`

*   **Items**:
    *   `GET /{id}/items`: Returns both `KitItem` and `KitExpendable` records, normalized.
    *   `POST /{id}/items`: Add item (transfer from warehouse).
    *   `PUT /{id}/items/{item_id}`
    *   `DELETE /{id}/items/{item_id}`

*   **Expendables**:
    *   `GET /{id}/expendables`
    *   `POST /{id}/expendables`: Create new expendable directly.

*   **Issuance**:
    *   `POST /{id}/issue`: Issue item.
    *   `GET /{id}/issuances`: History.

*   **Analytics/Alerts**:
    *   `GET /{id}/analytics`
    *   `GET /{id}/alerts`

### Transfers (`/api/transfers`)
*   `POST /`: Create transfer.
*   `PUT /{id}/complete`: Complete a pending transfer.
*   `PUT /{id}/cancel`: Cancel pending transfer.
*   `GET /`: List transfers.

### Reorders (`/api/reorder-requests`)
*   Standard CRUD + workflow actions (`approve`, `order`, `fulfill`, `cancel`).

## 4. Frontend Requirements

### Components Needed
1.  **Kit Dashboard**: Cards for kits, status summary, alerts.
2.  **Kit Wizard**: Stepper for creating kits (Type -> Details -> Boxes -> Review).
3.  **Kit Detail View**: Tabs for Overview, Items, Issuances, Transfers, Reorders, Messages.
4.  **Box Manager**: UI to add/edit/delete boxes (as seen in `KitBoxManager.jsx`).
5.  **Item List**: Filterable table (by box, type, status). Needs to handle both `KitItem` and `KitExpendable` unified view.
6.  **Issuance Form**: Modal with validation, low stock warnings, and barcode trigger (`KitIssuanceForm.jsx`).
7.  **Transfer Form**: Complex form handling Source/Dest selection and Item selection.
8.  **Barcode Modal**: For printing labels (4x6, 3x4, etc.) with QR/Barcodes.

### State Management (Redux)
*   Need slices for `kits`, `aircraftTypes`, `transfers`, `reorders`.
*   Actions should mirror the API endpoints.
*   Optimistic updates or re-fetching after transactions (issuance, transfer) is critical for data accuracy.

## 5. Key Considerations for Recreation
*   **Data Integrity**: Ensure `warehouse_id` is correctly toggled when items move in/out of kits.
*   **Audit Trail**: Every movement (transfer, issuance, creation) must be logged.
*   **Lot Splitting**: The chemical transfer logic is the most complex part; ensure child lots are handled correctly.
*   **Unified Item View**: The frontend must gracefully handle the difference between `KitItem` (linked to warehouse) and `KitExpendable` (local to kit).
