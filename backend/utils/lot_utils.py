"""
Utility functions for lot number management and splitting.

This module provides functions for:
- Generating child lot numbers for partial issuances
- Creating child chemicals and expendables with proper lineage tracking
- Querying lot lineage for audit purposes

Policy:
- When items are partially issued, a child lot is created from the parent
- Child lots maintain a reference to their parent for full traceability
- The combination of part_number + lot_number must be unique across the system
"""

import string

from models import Chemical


def generate_child_lot_number(parent_lot_number, sequence):
    """
    Generate a child lot number based on the parent lot number and sequence.

    Format: PARENT-A, PARENT-B, ..., PARENT-Z, PARENT-AA, PARENT-AB, etc.

    Args:
        parent_lot_number (str): The parent lot number
        sequence (int): The sequence number (0-based)

    Returns:
        str: The generated child lot number

    Examples:
        >>> generate_child_lot_number("LOT001", 0)
        'LOT001-A'
        >>> generate_child_lot_number("LOT001", 1)
        'LOT001-B'
        >>> generate_child_lot_number("LOT001", 25)
        'LOT001-Z'
        >>> generate_child_lot_number("LOT001", 26)
        'LOT001-AA'
    """
    # Convert sequence to letter suffix (A, B, C, ..., Z, AA, AB, ...)
    suffix = ""
    num = sequence

    while True:
        suffix = string.ascii_uppercase[num % 26] + suffix
        num = num // 26
        if num == 0:
            break
        num -= 1  # Adjust for 0-based indexing

    return f"{parent_lot_number}-{suffix}"


def get_next_child_lot_number(parent_chemical):
    """
    Get the next available child lot number for a parent chemical.
    Increments the lot_sequence counter and generates the child lot number.

    Args:
        parent_chemical (Chemical): The parent chemical object

    Returns:
        tuple: (child_lot_number, sequence) - The generated child lot number and its sequence
    """
    # Get current sequence (defaults to 0 if None)
    current_sequence = parent_chemical.lot_sequence or 0

    # Generate child lot number
    child_lot_number = generate_child_lot_number(parent_chemical.lot_number, current_sequence)

    # Check if this lot number already exists (shouldn't happen, but safety check)
    existing = Chemical.query.filter_by(lot_number=child_lot_number).first()
    if existing:
        # If it exists, increment sequence and try again
        current_sequence += 1
        child_lot_number = generate_child_lot_number(parent_chemical.lot_number, current_sequence)

    # Increment the parent's lot_sequence counter
    parent_chemical.lot_sequence = current_sequence + 1

    return child_lot_number, current_sequence


def create_child_chemical(parent_chemical, quantity, destination_warehouse_id=None, destination_kit_id=None):
    """
    Create a child chemical from a parent chemical for partial transfer.

    Args:
        parent_chemical (Chemical): The parent chemical to split from
        quantity (int): The quantity to transfer to the child
        destination_warehouse_id (int, optional): Destination warehouse ID
        destination_kit_id (int, optional): Destination kit ID (for kit transfers)

    Returns:
        Chemical: The newly created child chemical

    Raises:
        ValueError: If quantity is invalid or exceeds available quantity
    """
    # Validate quantity
    if quantity <= 0:
        raise ValueError("Quantity must be greater than 0")

    if quantity > parent_chemical.quantity:
        raise ValueError(f"Cannot transfer {quantity} {parent_chemical.unit}. Only {parent_chemical.quantity} {parent_chemical.unit} available.")

    # Generate child lot number
    child_lot_number, _sequence = get_next_child_lot_number(parent_chemical)

    # Create the child chemical
    child_chemical = Chemical(
        part_number=parent_chemical.part_number,
        lot_number=child_lot_number,
        description=parent_chemical.description,
        manufacturer=parent_chemical.manufacturer,
        quantity=quantity,
        unit=parent_chemical.unit,
        location=parent_chemical.location,
        category=parent_chemical.category,
        status="available",
        warehouse_id=destination_warehouse_id,
        expiration_date=parent_chemical.expiration_date,
        minimum_stock_level=parent_chemical.minimum_stock_level,
        notes=f"Split from {parent_chemical.lot_number}",
        parent_lot_number=parent_chemical.lot_number,
        lot_sequence=0  # New child starts with sequence 0
    )

    # Reduce parent quantity
    parent_chemical.quantity -= quantity

    # Update parent status if depleted
    if parent_chemical.quantity == 0:
        parent_chemical.status = "depleted"

    return child_chemical


def get_lot_lineage(chemical):
    """
    Get the complete lineage of a chemical lot (parent and all children).

    Args:
        chemical (Chemical): The chemical to get lineage for

    Returns:
        dict: Dictionary containing parent and children information
    """
    result = {
        "current": chemical.to_dict(),
        "parent": None,
        "children": [],
        "siblings": []
    }

    # Get parent if exists
    if chemical.parent_lot_number:
        parent = Chemical.query.filter_by(lot_number=chemical.parent_lot_number).first()
        if parent:
            result["parent"] = parent.to_dict()

            # Get siblings (other children of the same parent)
            siblings = Chemical.query.filter(
                Chemical.parent_lot_number == chemical.parent_lot_number,
                Chemical.id != chemical.id
            ).all()
            result["siblings"] = [s.to_dict() for s in siblings]

    # Get children (lots split from this one)
    children = Chemical.query.filter_by(parent_lot_number=chemical.lot_number).all()
    result["children"] = [c.to_dict() for c in children]

    return result


# ============================================================================
# KitExpendable Lot Functions
# ============================================================================

def get_next_expendable_child_lot_number(parent_expendable):
    """
    Get the next available child lot number for a parent kit expendable.
    Increments the lot_sequence counter and generates the child lot number.

    Args:
        parent_expendable (KitExpendable): The parent expendable object

    Returns:
        tuple: (child_lot_number, sequence) - The generated child lot number and its sequence
    """
    from models_kits import KitExpendable

    # Get current sequence (defaults to 0 if None)
    current_sequence = parent_expendable.lot_sequence or 0

    # Generate child lot number
    child_lot_number = generate_child_lot_number(parent_expendable.lot_number, current_sequence)

    # Check if this lot number already exists for the same part number
    existing = KitExpendable.query.filter_by(
        part_number=parent_expendable.part_number,
        lot_number=child_lot_number
    ).first()

    if existing:
        # If it exists, increment sequence and try again
        current_sequence += 1
        child_lot_number = generate_child_lot_number(parent_expendable.lot_number, current_sequence)

    # Increment the parent's lot_sequence counter
    parent_expendable.lot_sequence = current_sequence + 1

    return child_lot_number, current_sequence


def create_child_expendable(parent_expendable, quantity, destination_kit_id, destination_box_id):
    """
    Create a child expendable from a parent expendable for partial issuance/transfer.

    This is used when partially issuing or transferring a lot-tracked expendable.
    The child maintains a reference to the parent lot for full traceability.

    Args:
        parent_expendable (KitExpendable): The parent expendable to split from
        quantity (float): The quantity to transfer to the child
        destination_kit_id (int): Destination kit ID
        destination_box_id (int): Destination box ID

    Returns:
        KitExpendable: The newly created child expendable

    Raises:
        ValueError: If quantity is invalid or exceeds available quantity
        ValueError: If parent is serial-tracked (cannot split serial-tracked items)
    """
    from models_kits import KitExpendable

    # Validate tracking type - only lot-tracked items can be split
    if parent_expendable.tracking_type == "serial":
        raise ValueError("Cannot split serial-tracked expendables. Serial numbers must be transferred as whole items.")

    # Validate quantity
    if quantity <= 0:
        raise ValueError("Quantity must be greater than 0")

    if quantity > parent_expendable.quantity:
        raise ValueError(
            f"Cannot transfer {quantity} {parent_expendable.unit}. "
            f"Only {parent_expendable.quantity} {parent_expendable.unit} available."
        )

    # Generate child lot number
    child_lot_number, _sequence = get_next_expendable_child_lot_number(parent_expendable)

    # Create the child expendable
    child_expendable = KitExpendable(
        kit_id=destination_kit_id,
        box_id=destination_box_id,
        part_number=parent_expendable.part_number,
        lot_number=child_lot_number,
        serial_number=None,  # Child lots don't have serial numbers
        tracking_type="lot",
        description=parent_expendable.description,
        quantity=quantity,
        unit=parent_expendable.unit,
        location=parent_expendable.location,
        status="available",
        minimum_stock_level=parent_expendable.minimum_stock_level,
        parent_lot_number=parent_expendable.lot_number,
        lot_sequence=0  # New child starts with sequence 0
    )

    # Reduce parent quantity
    parent_expendable.quantity -= quantity

    # Update parent status if depleted
    if parent_expendable.quantity == 0:
        parent_expendable.status = "depleted"
    elif parent_expendable.is_low_stock():
        parent_expendable.status = "low_stock"

    return child_expendable


def get_expendable_lot_lineage(expendable):
    """
    Get the complete lineage of an expendable lot (parent and all children).

    Args:
        expendable (KitExpendable): The expendable to get lineage for

    Returns:
        dict: Dictionary containing parent, children, and siblings information
    """
    from models_kits import KitExpendable

    result = {
        "current": expendable.to_dict(),
        "parent": None,
        "children": [],
        "siblings": []
    }

    # Get parent if exists
    if expendable.parent_lot_number:
        parent = KitExpendable.query.filter_by(
            part_number=expendable.part_number,
            lot_number=expendable.parent_lot_number
        ).first()
        if parent:
            result["parent"] = parent.to_dict()

            # Get siblings (other children of the same parent)
            siblings = KitExpendable.query.filter(
                KitExpendable.part_number == expendable.part_number,
                KitExpendable.parent_lot_number == expendable.parent_lot_number,
                KitExpendable.id != expendable.id
            ).all()
            result["siblings"] = [s.to_dict() for s in siblings]

    # Get children (lots split from this one)
    children = KitExpendable.query.filter_by(
        part_number=expendable.part_number,
        parent_lot_number=expendable.lot_number
    ).all()
    result["children"] = [c.to_dict() for c in children]

    return result


def trace_lot_origin(expendable):
    """
    Trace an expendable lot back to its original parent lot.

    This is useful for audit purposes - given any child lot, you can
    trace back the entire history to the original lot that was received.

    Args:
        expendable (KitExpendable): The expendable to trace

    Returns:
        list: List of dictionaries representing the lineage from original to current
    """
    from models_kits import KitExpendable

    lineage = [expendable.to_dict()]
    current = expendable

    while current.parent_lot_number:
        parent = KitExpendable.query.filter_by(
            part_number=current.part_number,
            lot_number=current.parent_lot_number
        ).first()

        if not parent:
            # Parent might be a Chemical if it was transferred from warehouse
            parent_chemical = Chemical.query.filter_by(
                part_number=current.part_number,
                lot_number=current.parent_lot_number
            ).first()
            if parent_chemical:
                lineage.insert(0, {
                    **parent_chemical.to_dict(),
                    "source_type": "chemical"
                })
            break

        lineage.insert(0, parent.to_dict())
        current = parent

    return lineage

