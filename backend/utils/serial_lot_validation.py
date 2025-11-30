"""
Serial/Lot Number Validation Utilities

This module provides centralized validation for serial and lot number uniqueness
across the entire SupplyLine inventory system.

Policy:
- All items (tools, chemicals, expendables) must have either a serial number OR a lot number
- The combination of part_number + serial_number must be unique across the system
- The combination of part_number + lot_number must be unique across the system
- Child lots are created when items are partially issued, maintaining full traceability
"""

import logging
import string
from typing import Optional, Tuple

from utils.error_handler import ValidationError


logger = logging.getLogger(__name__)


class SerialLotValidationError(ValidationError):
    """Custom exception for serial/lot validation errors with detailed context."""

    def __init__(self, message: str, item_type: str = None, location: str = None,
                 part_number: str = None, serial_number: str = None, lot_number: str = None):
        super().__init__(message)
        self.item_type = item_type
        self.location = location
        self.part_number = part_number
        self.serial_number = serial_number
        self.lot_number = lot_number


def validate_serial_lot_required(serial_number: Optional[str], lot_number: Optional[str],
                                  item_type: str = "item") -> Tuple[bool, Optional[str]]:
    """
    Validate that an item has either a serial number or lot number (but not both).

    Args:
        serial_number: The serial number (can be None or empty)
        lot_number: The lot number (can be None or empty)
        item_type: Type of item for error messages (tool, chemical, expendable)

    Returns:
        Tuple of (is_valid, error_message or None)

    Raises:
        SerialLotValidationError: If validation fails
    """
    has_serial = bool(serial_number and serial_number.strip())
    has_lot = bool(lot_number and lot_number.strip())

    if not has_serial and not has_lot:
        error_msg = f"{item_type.capitalize()} must have either a serial number or a lot number for tracking purposes."
        raise SerialLotValidationError(
            error_msg,
            item_type=item_type,
            serial_number=serial_number,
            lot_number=lot_number
        )

    if has_serial and has_lot:
        error_msg = f"{item_type.capitalize()} cannot have both a serial number and a lot number. Please use only one tracking method."
        raise SerialLotValidationError(
            error_msg,
            item_type=item_type,
            serial_number=serial_number,
            lot_number=lot_number
        )

    return True, None


def check_serial_number_unique(part_number: str, serial_number: str,
                                exclude_id: Optional[int] = None,
                                exclude_type: Optional[str] = None) -> bool:
    """
    Check if a serial number is unique for a given part number across all inventory types.

    Args:
        part_number: The part number to check
        serial_number: The serial number to check
        exclude_id: Optional ID to exclude from the check (for updates)
        exclude_type: Type of item to exclude ('tool', 'expendable', 'kit_expendable', 'kit_item')

    Returns:
        True if unique, raises SerialLotValidationError if duplicate found
    """
    from models import Tool, Expendable
    from models_kits import KitExpendable, KitItem

    if not serial_number or not serial_number.strip():
        return True

    serial_number = serial_number.strip()
    part_number = part_number.strip()

    # Check Tools - tools use tool_number as their part_number equivalent
    tool_query = Tool.query.filter(
        Tool.tool_number == part_number,
        Tool.serial_number == serial_number
    )
    if exclude_type == "tool" and exclude_id:
        tool_query = tool_query.filter(Tool.id != exclude_id)

    existing_tool = tool_query.first()
    if existing_tool:
        location = f"Warehouse: {existing_tool.warehouse.name}" if existing_tool.warehouse else "In a kit"
        raise SerialLotValidationError(
            f"A tool with part number '{part_number}' and serial number '{serial_number}' already exists. Location: {location}",
            item_type="tool",
            location=location,
            part_number=part_number,
            serial_number=serial_number
        )

    # Check Expendables (main expendable records)
    expendable_query = Expendable.query.filter(
        Expendable.part_number == part_number,
        Expendable.serial_number == serial_number
    )
    if exclude_type == "expendable" and exclude_id:
        expendable_query = expendable_query.filter(Expendable.id != exclude_id)

    existing_expendable = expendable_query.first()
    if existing_expendable:
        raise SerialLotValidationError(
            f"An expendable with part number '{part_number}' and serial number '{serial_number}' already exists.",
            item_type="expendable",
            part_number=part_number,
            serial_number=serial_number
        )

    # Check KitExpendables
    kit_exp_query = KitExpendable.query.filter(
        KitExpendable.part_number == part_number,
        KitExpendable.serial_number == serial_number
    )
    if exclude_type == "kit_expendable" and exclude_id:
        kit_exp_query = kit_exp_query.filter(KitExpendable.id != exclude_id)

    existing_kit_exp = kit_exp_query.first()
    if existing_kit_exp:
        kit_name = existing_kit_exp.kit.name if existing_kit_exp.kit else "Unknown kit"
        raise SerialLotValidationError(
            f"An expendable with part number '{part_number}' and serial number '{serial_number}' already exists in kit '{kit_name}'.",
            item_type="expendable",
            location=kit_name,
            part_number=part_number,
            serial_number=serial_number
        )

    # Check KitItems (tools/chemicals in kits) that have serial numbers
    kit_item_query = KitItem.query.filter(
        KitItem.part_number == part_number,
        KitItem.serial_number == serial_number
    )
    if exclude_type == "kit_item" and exclude_id:
        kit_item_query = kit_item_query.filter(KitItem.id != exclude_id)

    existing_kit_item = kit_item_query.first()
    if existing_kit_item:
        kit_name = existing_kit_item.kit.name if existing_kit_item.kit else "Unknown kit"
        raise SerialLotValidationError(
            f"An item with part number '{part_number}' and serial number '{serial_number}' already exists in kit '{kit_name}'.",
            item_type=existing_kit_item.item_type,
            location=kit_name,
            part_number=part_number,
            serial_number=serial_number
        )

    return True


def check_lot_number_unique(part_number: str, lot_number: str,
                            exclude_id: Optional[int] = None,
                            exclude_type: Optional[str] = None) -> bool:
    """
    Check if a lot number is unique for a given part number across all inventory types.

    Args:
        part_number: The part number to check
        lot_number: The lot number to check
        exclude_id: Optional ID to exclude from the check (for updates)
        exclude_type: Type of item to exclude ('chemical', 'expendable', 'kit_expendable', 'kit_item')

    Returns:
        True if unique, raises SerialLotValidationError if duplicate found
    """
    from models import Chemical, Expendable
    from models_kits import KitExpendable, KitItem

    if not lot_number or not lot_number.strip():
        return True

    lot_number = lot_number.strip()
    part_number = part_number.strip()

    # Check Chemicals
    chemical_query = Chemical.query.filter(
        Chemical.part_number == part_number,
        Chemical.lot_number == lot_number
    )
    if exclude_type == "chemical" and exclude_id:
        chemical_query = chemical_query.filter(Chemical.id != exclude_id)

    existing_chemical = chemical_query.first()
    if existing_chemical:
        location = f"Warehouse: {existing_chemical.warehouse.name}" if existing_chemical.warehouse else "In a kit"
        raise SerialLotValidationError(
            f"A chemical with part number '{part_number}' and lot number '{lot_number}' already exists. Location: {location}",
            item_type="chemical",
            location=location,
            part_number=part_number,
            lot_number=lot_number
        )

    # Check Expendables (main expendable records)
    expendable_query = Expendable.query.filter(
        Expendable.part_number == part_number,
        Expendable.lot_number == lot_number
    )
    if exclude_type == "expendable" and exclude_id:
        expendable_query = expendable_query.filter(Expendable.id != exclude_id)

    existing_expendable = expendable_query.first()
    if existing_expendable:
        raise SerialLotValidationError(
            f"An expendable with part number '{part_number}' and lot number '{lot_number}' already exists.",
            item_type="expendable",
            part_number=part_number,
            lot_number=lot_number
        )

    # Check KitExpendables
    kit_exp_query = KitExpendable.query.filter(
        KitExpendable.part_number == part_number,
        KitExpendable.lot_number == lot_number
    )
    if exclude_type == "kit_expendable" and exclude_id:
        kit_exp_query = kit_exp_query.filter(KitExpendable.id != exclude_id)

    existing_kit_exp = kit_exp_query.first()
    if existing_kit_exp:
        kit_name = existing_kit_exp.kit.name if existing_kit_exp.kit else "Unknown kit"
        raise SerialLotValidationError(
            f"An expendable with part number '{part_number}' and lot number '{lot_number}' already exists in kit '{kit_name}'.",
            item_type="expendable",
            location=kit_name,
            part_number=part_number,
            lot_number=lot_number
        )

    # Check KitItems (tools/chemicals in kits) that have lot numbers
    kit_item_query = KitItem.query.filter(
        KitItem.part_number == part_number,
        KitItem.lot_number == lot_number
    )
    if exclude_type == "kit_item" and exclude_id:
        kit_item_query = kit_item_query.filter(KitItem.id != exclude_id)

    existing_kit_item = kit_item_query.first()
    if existing_kit_item:
        kit_name = existing_kit_item.kit.name if existing_kit_item.kit else "Unknown kit"
        raise SerialLotValidationError(
            f"An item with part number '{part_number}' and lot number '{lot_number}' already exists in kit '{kit_name}'.",
            item_type=existing_kit_item.item_type,
            location=kit_name,
            part_number=part_number,
            lot_number=lot_number
        )

    return True


def validate_item_tracking(part_number: str, serial_number: Optional[str], lot_number: Optional[str],
                           item_type: str = "item",
                           exclude_id: Optional[int] = None,
                           exclude_type: Optional[str] = None) -> bool:
    """
    Complete validation of item tracking - ensures serial/lot is required and unique.

    Args:
        part_number: The part number of the item
        serial_number: The serial number (can be None)
        lot_number: The lot number (can be None)
        item_type: Type of item for error messages
        exclude_id: Optional ID to exclude from uniqueness check
        exclude_type: Type to exclude from uniqueness check

    Returns:
        True if validation passes

    Raises:
        SerialLotValidationError: If validation fails
    """
    # First validate that serial or lot is provided
    validate_serial_lot_required(serial_number, lot_number, item_type)

    # Then validate uniqueness
    if serial_number and serial_number.strip():
        check_serial_number_unique(part_number, serial_number, exclude_id, exclude_type)

    if lot_number and lot_number.strip():
        check_lot_number_unique(part_number, lot_number, exclude_id, exclude_type)

    return True


def get_tracking_type(serial_number: Optional[str], lot_number: Optional[str]) -> str:
    """
    Determine the tracking type based on which identifier is provided.

    Args:
        serial_number: The serial number (can be None)
        lot_number: The lot number (can be None)

    Returns:
        'serial' if serial_number is provided, 'lot' if lot_number is provided

    Raises:
        SerialLotValidationError: If neither or both are provided
    """
    has_serial = bool(serial_number and serial_number.strip())
    has_lot = bool(lot_number and lot_number.strip())

    if has_serial and has_lot:
        raise SerialLotValidationError(
            "Item cannot have both serial number and lot number. Please use only one tracking method."
        )

    if has_serial:
        return "serial"

    if has_lot:
        return "lot"

    raise SerialLotValidationError(
        "Item must have either a serial number or lot number for tracking."
    )


def validate_transfer_tracking(from_item, to_location_type: str, to_location_id: int,
                               quantity: float = 1.0) -> bool:
    """
    Validate that a transfer maintains proper tracking.

    Args:
        from_item: The source item being transferred
        to_location_type: 'kit' or 'warehouse'
        to_location_id: ID of destination kit or warehouse
        quantity: Quantity being transferred

    Returns:
        True if transfer is valid

    Raises:
        SerialLotValidationError: If transfer would violate tracking policy
    """
    # Determine tracking identifiers from the source item
    serial_number = getattr(from_item, 'serial_number', None)
    lot_number = getattr(from_item, 'lot_number', None)
    part_number = getattr(from_item, 'part_number', None) or getattr(from_item, 'tool_number', None)

    if not part_number:
        raise SerialLotValidationError(
            "Cannot transfer item without a part number."
        )

    # Validate that the item has proper tracking
    validate_serial_lot_required(serial_number, lot_number, "item")

    return True


def generate_child_lot_suffix(sequence: int) -> str:
    """
    Generate a suffix for child lot numbers (A, B, C, ..., Z, AA, AB, ...).

    Args:
        sequence: The sequence number (0-based)

    Returns:
        The suffix string
    """
    suffix = ""
    num = sequence

    while True:
        suffix = string.ascii_uppercase[num % 26] + suffix
        num = num // 26
        if num == 0:
            break
        num -= 1  # Adjust for 0-based indexing

    return suffix
