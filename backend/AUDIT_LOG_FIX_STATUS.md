# AuditLog Constructor Fix - Status Report

## Problem
The codebase has many instances where `AuditLog` is being created with deprecated fields:
```python
log = AuditLog(
    action_type="something",
    action_details="some details"
)
db.session.add(log)
db.session.commit()
```

This causes a database error because the `action` field (nullable=False) is not being set.

## Solution Pattern
Replace with:
```python
AuditLog.log(
    user_id=get_jwt_identity(),
    action="action_name_here",
    resource_type="resource_type_here",
    resource_id=resource_id_if_applicable,
    details={"relevant": "details", "as": "dict"},
    ip_address=request.remote_addr
)
```

## Completed Files (33 instances fixed)

### ✅ routes_kits.py - 11 instances FIXED
- Line 110: aircraft_type_updated
- Line 137: aircraft_type_deactivated
- Line 228: kit_created
- Line 328: kit_updated
- Line 355: kit_deleted
- Line 408: kit_duplicated
- Line 502: kit_location_updated
- Line 601: kit_created_wizard
- Line 660: kit_box_added
- Line 900: kit_item_added
- Line 1083: kit_expendable_added
- Line 1282: kit_item_issued

### ✅ routes_auth.py - 3 instances FIXED
- Line 128: password_expired
- Line 301: user_logout
- Line 486: password_change (forced)

### ✅ routes_announcements.py - 3 instances FIXED
- Line 162: create_announcement
- Line 223: update_announcement
- Line 268: delete_announcement

### ✅ routes_calibration.py - 4 instances FIXED
- Line 247: tool_calibration
- Line 379: add_calibration_standard
- Line 496: update_calibration_standard
- Line 563: upload_calibration_certificate

### ✅ routes_password_reset.py - 1 instance FIXED
- Line 90: admin_password_reset

## Remaining Files (58 instances to fix)

### ⏳ routes_chemicals.py - 12 instances
Lines with `log = AuditLog(`:
1. auto_reorder_request_created
2. chemical_added
3. chemical_issued
4. chemical_returned
5. chemical_reorder_requested
6. chemical_ordered
7. chemical_archived (auto)
8. chemical_updated
9. chemical_deleted
10. chemical_archived (manual)
11. chemical_unarchived
12. chemical_delivered

### ⏳ routes_expendables.py - 4 instances
Lines with `log = AuditLog(`:
1. expendable_added_to_kit
2. expendable_updated
3. expendable_removed
4. expendable_transferred

### ⏳ routes_kit_messages.py - 2 instances
Lines with `log = AuditLog(`:
1. kit_message_sent
2. kit_message_marked_read

### ⏳ routes_kit_reorders.py - 7 instances
Lines with `log = AuditLog(`:
1. kit_reorder_requested
2. kit_reorder_approved
3. kit_reorder_rejected
4. kit_reorder_fulfilled
5. kit_reorder_cancelled
6. kit_reorder_updated
7. kit_reorder_auto_created

### ⏳ routes_kit_transfers.py - 3 instances
Lines with `log = AuditLog(`:
1. kit_transfer_initiated
2. kit_transfer_completed
3. kit_transfer_cancelled

### ⏳ routes_orders.py - 6 instances
Lines with `log = AuditLog(`:
1. order_created
2. order_updated
3. order_cancelled
4. order_received
5. order_partially_received
6. order_item_received

### ⏳ routes_profile.py - 2 instances
Lines with `log = AuditLog(`:
1. profile_updated
2. password_changed

### ⏳ routes.py - 11 instances
Lines with `log = AuditLog(`:
1. tool_added
2. tool_updated
3. tool_retired
4. warehouse_created
5. warehouse_updated
6. warehouse_deactivated
7. department_created
8. department_updated
9. department_deleted
10. location_created
11. location_updated

### ⏳ routes_rbac.py - 4 instances
Lines with `log = AuditLog(`:
1. role_created
2. role_updated
3. role_deleted
4. permission_assigned

### ⏳ routes_tool_checkout.py - 3 instances
Lines with `log = AuditLog(`:
1. tool_checked_out
2. tool_checked_in
3. tool_checkout_overdue

### ⏳ routes_users.py - 4 instances
Lines with `log = AuditLog(`:
1. user_created
2. user_updated
3. user_deactivated
4. user_role_changed

## Instructions for Remaining Files

For each file:

1. Add import at top (if not present):
   ```python
   from flask_jwt_extended import get_jwt_identity
   ```

2. Find all instances of:
   ```python
   log = AuditLog(
       action_type="...",
       action_details="..."
   )
   db.session.add(log)
   db.session.commit()  # Sometimes this line exists
   ```

3. Replace with:
   ```python
   AuditLog.log(
       user_id=get_jwt_identity(),
       action="<action_type_value>",
       resource_type="<appropriate_resource_type>",
       resource_id=<id_if_available>,
       details={<extract_relevant_data_as_dict>},
       ip_address=request.remote_addr
   )
   ```

4. Remove the `db.session.add(log)` line
5. Remove the `db.session.commit()` line if it was ONLY for the audit log
6. Keep any `db.session.commit()` that commits the main operation

## Resource Type Guidelines

- `tool` - for tool-related operations
- `chemical` - for chemical operations
- `expendable` - for expendable operations
- `kit` - for kit operations
- `warehouse` - for warehouse operations
- `order` - for procurement orders
- `user` - for user operations
- `role` - for RBAC role operations
- `department` - for department operations
- `auth` - for authentication operations
- `general` - for misc operations

## Progress Tracking

- Total instances: 91
- Fixed: 33 (36%)
- Remaining: 58 (64%)

Last updated: 2025-11-29
