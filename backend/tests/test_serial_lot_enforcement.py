"""
Unit tests for Serial/Lot Number Enforcement Rules

Tests the following policies:
1. All items must have either a serial number OR a lot number (not both, not neither)
2. Part number + serial/lot number combinations must be unique across the system
3. Child lots are created when items are partially issued
4. Serial-tracked items must be transferred as whole units
5. Tracking type enforcement (no "none" allowed)
"""

import pytest

from models import Chemical, Expendable, Tool, Warehouse
from models_kits import AircraftType, Kit, KitBox, KitExpendable, KitItem
from utils.serial_lot_validation import (
    SerialLotValidationError,
    check_lot_number_unique,
    check_serial_number_unique,
    generate_child_lot_suffix,
    get_tracking_type,
    validate_item_tracking,
    validate_serial_lot_required,
    validate_transfer_tracking,
)
from utils.lot_utils import (
    create_child_chemical,
    create_child_expendable,
    generate_child_lot_number,
    get_expendable_lot_lineage,
    get_lot_lineage,
    get_next_child_lot_number,
    get_next_expendable_child_lot_number,
)


class TestValidateSerialLotRequired:
    """Test that items must have either a serial number or lot number."""

    def test_valid_serial_only(self):
        """Item with only serial number is valid."""
        is_valid, error = validate_serial_lot_required(
            serial_number="SN-12345",
            lot_number=None,
            item_type="tool"
        )
        assert is_valid is True
        assert error is None

    def test_valid_lot_only(self):
        """Item with only lot number is valid."""
        is_valid, error = validate_serial_lot_required(
            serial_number=None,
            lot_number="LOT-001",
            item_type="chemical"
        )
        assert is_valid is True
        assert error is None

    def test_invalid_neither_serial_nor_lot(self):
        """Item with neither serial nor lot number is invalid."""
        with pytest.raises(SerialLotValidationError) as exc_info:
            validate_serial_lot_required(
                serial_number=None,
                lot_number=None,
                item_type="tool"
            )
        assert "must have either a serial number or a lot number" in str(exc_info.value)

    def test_invalid_empty_strings(self):
        """Item with empty strings for both is invalid."""
        with pytest.raises(SerialLotValidationError) as exc_info:
            validate_serial_lot_required(
                serial_number="",
                lot_number="",
                item_type="expendable"
            )
        assert "must have either a serial number or a lot number" in str(exc_info.value)

    def test_invalid_whitespace_only(self):
        """Item with only whitespace is invalid."""
        with pytest.raises(SerialLotValidationError) as exc_info:
            validate_serial_lot_required(
                serial_number="   ",
                lot_number="   ",
                item_type="chemical"
            )
        assert "must have either a serial number or a lot number" in str(exc_info.value)

    def test_invalid_both_serial_and_lot(self):
        """Item with both serial and lot number is invalid."""
        with pytest.raises(SerialLotValidationError) as exc_info:
            validate_serial_lot_required(
                serial_number="SN-12345",
                lot_number="LOT-001",
                item_type="tool"
            )
        assert "cannot have both a serial number and a lot number" in str(exc_info.value)

    def test_error_includes_item_type(self):
        """Error message includes the item type."""
        with pytest.raises(SerialLotValidationError) as exc_info:
            validate_serial_lot_required(
                serial_number=None,
                lot_number=None,
                item_type="chemical"
            )
        assert "Chemical" in str(exc_info.value)


class TestGetTrackingType:
    """Test tracking type determination."""

    def test_serial_tracking(self):
        """Returns 'serial' when serial number is provided."""
        tracking_type = get_tracking_type(
            serial_number="SN-12345",
            lot_number=None
        )
        assert tracking_type == "serial"

    def test_lot_tracking(self):
        """Returns 'lot' when lot number is provided."""
        tracking_type = get_tracking_type(
            serial_number=None,
            lot_number="LOT-001"
        )
        assert tracking_type == "lot"

    def test_error_when_neither(self):
        """Raises error when neither is provided."""
        with pytest.raises(SerialLotValidationError):
            get_tracking_type(serial_number=None, lot_number=None)

    def test_error_when_both(self):
        """Raises error when both are provided."""
        with pytest.raises(SerialLotValidationError):
            get_tracking_type(serial_number="SN-001", lot_number="LOT-001")


class TestGenerateChildLotSuffix:
    """Test child lot suffix generation."""

    def test_first_suffix_is_a(self):
        """First child lot suffix is 'A'."""
        suffix = generate_child_lot_suffix(0)
        assert suffix == "A"

    def test_second_suffix_is_b(self):
        """Second child lot suffix is 'B'."""
        suffix = generate_child_lot_suffix(1)
        assert suffix == "B"

    def test_26th_suffix_is_z(self):
        """26th child lot suffix is 'Z'."""
        suffix = generate_child_lot_suffix(25)
        assert suffix == "Z"

    def test_27th_suffix_is_aa(self):
        """27th child lot suffix is 'AA'."""
        suffix = generate_child_lot_suffix(26)
        assert suffix == "AA"

    def test_28th_suffix_is_ab(self):
        """28th child lot suffix is 'AB'."""
        suffix = generate_child_lot_suffix(27)
        assert suffix == "AB"


class TestGenerateChildLotNumber:
    """Test child lot number generation."""

    def test_child_lot_format(self):
        """Child lot number follows PARENT-SUFFIX format."""
        child_lot = generate_child_lot_number("LOT-001", 0)
        assert child_lot == "LOT-001-A"

    def test_multiple_children(self):
        """Multiple children have sequential suffixes."""
        children = [generate_child_lot_number("LOT-001", i) for i in range(3)]
        assert children == ["LOT-001-A", "LOT-001-B", "LOT-001-C"]

    def test_child_of_child(self):
        """Child of a child lot follows the same pattern."""
        parent = "LOT-001-A"
        child = generate_child_lot_number(parent, 0)
        assert child == "LOT-001-A-A"


class TestCheckSerialNumberUnique:
    """Test serial number uniqueness validation across all inventory types."""

    def test_unique_serial_passes(self, app, db_session, test_warehouse):
        """Unique serial number passes validation."""
        # No existing items with this serial
        result = check_serial_number_unique(
            part_number="TOOL-001",
            serial_number="SN-UNIQUE-001"
        )
        assert result is True

    def test_duplicate_in_tool_fails(self, app, db_session, test_warehouse):
        """Duplicate serial number in Tool table fails."""
        # Create a tool with the serial number
        tool = Tool(
            tool_number="TOOL-001",
            serial_number="SN-DUPLICATE",
            description="Test Tool",
            status="available",
            warehouse_id=test_warehouse.id
        )
        db_session.add(tool)
        db_session.commit()

        # Try to use the same serial number
        with pytest.raises(SerialLotValidationError) as exc_info:
            check_serial_number_unique(
                part_number="TOOL-001",
                serial_number="SN-DUPLICATE"
            )
        assert "already exists" in str(exc_info.value)
        assert "TOOL-001" in str(exc_info.value)
        assert "SN-DUPLICATE" in str(exc_info.value)

    def test_exclude_self_on_update(self, app, db_session, test_warehouse):
        """Updating an item should exclude itself from uniqueness check."""
        tool = Tool(
            tool_number="TOOL-002",
            serial_number="SN-SELF",
            description="Test Tool",
            status="available",
            warehouse_id=test_warehouse.id
        )
        db_session.add(tool)
        db_session.commit()

        # Should pass when excluding the tool's own ID
        result = check_serial_number_unique(
            part_number="TOOL-002",
            serial_number="SN-SELF",
            exclude_id=tool.id,
            exclude_type="tool"
        )
        assert result is True

    def test_different_part_numbers_allowed(self, app, db_session, test_warehouse):
        """Same serial number with different part numbers is allowed."""
        tool = Tool(
            tool_number="TOOL-003",
            serial_number="SN-SHARED",
            description="Test Tool",
            status="available",
            warehouse_id=test_warehouse.id
        )
        db_session.add(tool)
        db_session.commit()

        # Should pass with different part number
        result = check_serial_number_unique(
            part_number="TOOL-004",
            serial_number="SN-SHARED"
        )
        assert result is True

    def test_empty_serial_passes(self, app, db_session):
        """Empty serial number always passes."""
        result = check_serial_number_unique(
            part_number="TOOL-005",
            serial_number=""
        )
        assert result is True

    def test_none_serial_passes(self, app, db_session):
        """None serial number always passes."""
        result = check_serial_number_unique(
            part_number="TOOL-006",
            serial_number=None
        )
        assert result is True


class TestCheckLotNumberUnique:
    """Test lot number uniqueness validation across all inventory types."""

    def test_unique_lot_passes(self, app, db_session, test_warehouse):
        """Unique lot number passes validation."""
        result = check_lot_number_unique(
            part_number="CHEM-001",
            lot_number="LOT-UNIQUE-001"
        )
        assert result is True

    def test_duplicate_in_chemical_fails(self, app, db_session, test_warehouse):
        """Duplicate lot number in Chemical table fails."""
        chemical = Chemical(
            part_number="CHEM-001",
            lot_number="LOT-DUPLICATE",
            description="Test Chemical",
            manufacturer="Test Mfg",
            quantity=100,
            unit="ml",
            status="available",
            warehouse_id=test_warehouse.id
        )
        db_session.add(chemical)
        db_session.commit()

        with pytest.raises(SerialLotValidationError) as exc_info:
            check_lot_number_unique(
                part_number="CHEM-001",
                lot_number="LOT-DUPLICATE"
            )
        assert "already exists" in str(exc_info.value)
        assert "CHEM-001" in str(exc_info.value)

    def test_exclude_self_on_update(self, app, db_session, test_warehouse):
        """Updating an item should exclude itself from uniqueness check."""
        chemical = Chemical(
            part_number="CHEM-002",
            lot_number="LOT-SELF",
            description="Test Chemical",
            manufacturer="Test Mfg",
            quantity=100,
            unit="ml",
            status="available",
            warehouse_id=test_warehouse.id
        )
        db_session.add(chemical)
        db_session.commit()

        result = check_lot_number_unique(
            part_number="CHEM-002",
            lot_number="LOT-SELF",
            exclude_id=chemical.id,
            exclude_type="chemical"
        )
        assert result is True

    def test_different_part_numbers_allowed(self, app, db_session, test_warehouse):
        """Same lot number with different part numbers is allowed."""
        chemical = Chemical(
            part_number="CHEM-003",
            lot_number="LOT-SHARED",
            description="Test Chemical",
            manufacturer="Test Mfg",
            quantity=100,
            unit="ml",
            status="available",
            warehouse_id=test_warehouse.id
        )
        db_session.add(chemical)
        db_session.commit()

        result = check_lot_number_unique(
            part_number="CHEM-004",
            lot_number="LOT-SHARED"
        )
        assert result is True


class TestValidateItemTracking:
    """Test combined item tracking validation."""

    def test_valid_serial_tracking(self, app, db_session):
        """Valid serial-tracked item passes."""
        result = validate_item_tracking(
            part_number="TOOL-001",
            serial_number="SN-VALID",
            lot_number=None,
            item_type="tool"
        )
        assert result is True

    def test_valid_lot_tracking(self, app, db_session):
        """Valid lot-tracked item passes."""
        result = validate_item_tracking(
            part_number="CHEM-001",
            serial_number=None,
            lot_number="LOT-VALID",
            item_type="chemical"
        )
        assert result is True

    def test_missing_tracking_fails(self, app, db_session):
        """Item without tracking fails."""
        with pytest.raises(SerialLotValidationError):
            validate_item_tracking(
                part_number="ITEM-001",
                serial_number=None,
                lot_number=None,
                item_type="item"
            )


class TestCreateChildChemical:
    """Test child chemical creation for partial issuances."""

    @pytest.fixture
    def parent_chemical(self, db_session, test_warehouse):
        """Create a parent chemical for testing."""
        chemical = Chemical(
            part_number="CHEM-PARENT",
            lot_number="LOT-PARENT-001",
            description="Parent Chemical",
            manufacturer="Test Mfg",
            quantity=100,
            unit="ml",
            status="available",
            warehouse_id=test_warehouse.id,
            lot_sequence=0
        )
        db_session.add(chemical)
        db_session.commit()
        return chemical

    def test_create_child_reduces_parent_quantity(self, app, db_session, parent_chemical, test_warehouse):
        """Creating a child reduces parent quantity."""
        initial_quantity = parent_chemical.quantity

        child = create_child_chemical(
            parent_chemical=parent_chemical,
            quantity=30,
            destination_warehouse_id=test_warehouse.id
        )
        db_session.add(child)
        db_session.commit()

        assert parent_chemical.quantity == initial_quantity - 30
        assert child.quantity == 30

    def test_child_has_correct_lot_number(self, app, db_session, parent_chemical, test_warehouse):
        """Child has lot number with suffix."""
        child = create_child_chemical(
            parent_chemical=parent_chemical,
            quantity=20,
            destination_warehouse_id=test_warehouse.id
        )
        db_session.add(child)
        db_session.commit()

        assert child.lot_number == "LOT-PARENT-001-A"
        assert child.parent_lot_number == "LOT-PARENT-001"

    def test_multiple_children_sequential_suffixes(self, app, db_session, parent_chemical, test_warehouse):
        """Multiple children have sequential suffixes."""
        child1 = create_child_chemical(parent_chemical, 10, test_warehouse.id)
        child2 = create_child_chemical(parent_chemical, 10, test_warehouse.id)
        child3 = create_child_chemical(parent_chemical, 10, test_warehouse.id)

        db_session.add_all([child1, child2, child3])
        db_session.commit()

        assert child1.lot_number == "LOT-PARENT-001-A"
        assert child2.lot_number == "LOT-PARENT-001-B"
        assert child3.lot_number == "LOT-PARENT-001-C"

    def test_parent_sequence_increments(self, app, db_session, parent_chemical, test_warehouse):
        """Parent lot_sequence increments with each child."""
        assert parent_chemical.lot_sequence == 0

        create_child_chemical(parent_chemical, 10, test_warehouse.id)
        assert parent_chemical.lot_sequence == 1

        create_child_chemical(parent_chemical, 10, test_warehouse.id)
        assert parent_chemical.lot_sequence == 2

    def test_invalid_quantity_zero_fails(self, app, db_session, parent_chemical, test_warehouse):
        """Creating child with zero quantity fails."""
        with pytest.raises(ValueError, match="greater than 0"):
            create_child_chemical(parent_chemical, 0, test_warehouse.id)

    def test_invalid_quantity_exceeds_available_fails(self, app, db_session, parent_chemical, test_warehouse):
        """Creating child with more quantity than available fails."""
        with pytest.raises(ValueError, match="Cannot transfer"):
            create_child_chemical(parent_chemical, 150, test_warehouse.id)

    def test_parent_depleted_status(self, app, db_session, parent_chemical, test_warehouse):
        """Parent status changes to depleted when quantity reaches 0."""
        child = create_child_chemical(parent_chemical, 100, test_warehouse.id)
        db_session.add(child)
        db_session.commit()

        assert parent_chemical.quantity == 0
        assert parent_chemical.status == "depleted"


class TestCreateChildExpendable:
    """Test child expendable creation for partial issuances."""

    @pytest.fixture
    def test_kit_with_box(self, db_session, admin_user):
        """Create a test kit with a box."""
        aircraft_type = AircraftType(name="Test Aircraft", description="Test")
        db_session.add(aircraft_type)
        db_session.flush()

        kit = Kit(
            name="Test Kit",
            aircraft_type_id=aircraft_type.id,
            created_by=admin_user.id,
            status="active"
        )
        db_session.add(kit)
        db_session.flush()

        box = KitBox(
            kit_id=kit.id,
            box_number="1",
            box_type="expendable",
            description="Test Box"
        )
        db_session.add(box)
        db_session.commit()

        return kit, box

    @pytest.fixture
    def parent_expendable(self, db_session, test_kit_with_box):
        """Create a parent expendable for testing."""
        kit, box = test_kit_with_box
        expendable = KitExpendable(
            kit_id=kit.id,
            box_id=box.id,
            part_number="EXP-PARENT",
            lot_number="LOT-EXP-001",
            tracking_type="lot",
            description="Parent Expendable",
            quantity=100,
            unit="ft",
            status="available",
            lot_sequence=0
        )
        db_session.add(expendable)
        db_session.commit()
        return expendable

    def test_create_child_reduces_parent(self, app, db_session, parent_expendable, test_kit_with_box):
        """Creating a child reduces parent quantity."""
        kit, box = test_kit_with_box
        initial_quantity = parent_expendable.quantity

        child = create_child_expendable(
            parent_expendable=parent_expendable,
            quantity=25,
            destination_kit_id=kit.id,
            destination_box_id=box.id
        )
        db_session.add(child)
        db_session.commit()

        assert parent_expendable.quantity == initial_quantity - 25
        assert child.quantity == 25

    def test_child_has_correct_lot_number(self, app, db_session, parent_expendable, test_kit_with_box):
        """Child has lot number with suffix."""
        kit, box = test_kit_with_box

        child = create_child_expendable(
            parent_expendable=parent_expendable,
            quantity=10,
            destination_kit_id=kit.id,
            destination_box_id=box.id
        )
        db_session.add(child)
        db_session.commit()

        assert child.lot_number == "LOT-EXP-001-A"
        assert child.parent_lot_number == "LOT-EXP-001"

    def test_serial_tracked_cannot_split(self, app, db_session, test_kit_with_box):
        """Serial-tracked expendables cannot be split."""
        kit, box = test_kit_with_box

        serial_expendable = KitExpendable(
            kit_id=kit.id,
            box_id=box.id,
            part_number="EXP-SERIAL",
            serial_number="SN-001",
            tracking_type="serial",
            description="Serial Expendable",
            quantity=1,
            unit="ea",
            status="available"
        )
        db_session.add(serial_expendable)
        db_session.commit()

        with pytest.raises(ValueError, match="Cannot split serial-tracked"):
            create_child_expendable(
                parent_expendable=serial_expendable,
                quantity=1,
                destination_kit_id=kit.id,
                destination_box_id=box.id
            )


class TestLotLineage:
    """Test lot lineage tracking."""

    def test_get_lot_lineage_shows_children(self, app, db_session, test_warehouse):
        """Lot lineage includes all children."""
        parent = Chemical(
            part_number="CHEM-LINEAGE",
            lot_number="LOT-LINEAGE-001",
            description="Parent",
            manufacturer="Test",
            quantity=100,
            unit="ml",
            status="available",
            warehouse_id=test_warehouse.id,
            lot_sequence=0
        )
        db_session.add(parent)
        db_session.commit()

        child1 = create_child_chemical(parent, 20, test_warehouse.id)
        child2 = create_child_chemical(parent, 20, test_warehouse.id)
        db_session.add_all([child1, child2])
        db_session.commit()

        lineage = get_lot_lineage(parent)

        assert lineage["current"]["lot_number"] == "LOT-LINEAGE-001"
        assert len(lineage["children"]) == 2
        child_lots = [c["lot_number"] for c in lineage["children"]]
        assert "LOT-LINEAGE-001-A" in child_lots
        assert "LOT-LINEAGE-001-B" in child_lots

    def test_get_lot_lineage_shows_parent(self, app, db_session, test_warehouse):
        """Child lot lineage shows parent."""
        parent = Chemical(
            part_number="CHEM-LINEAGE-2",
            lot_number="LOT-LINEAGE-002",
            description="Parent",
            manufacturer="Test",
            quantity=100,
            unit="ml",
            status="available",
            warehouse_id=test_warehouse.id,
            lot_sequence=0
        )
        db_session.add(parent)
        db_session.commit()

        child = create_child_chemical(parent, 30, test_warehouse.id)
        db_session.add(child)
        db_session.commit()

        lineage = get_lot_lineage(child)

        assert lineage["current"]["lot_number"] == "LOT-LINEAGE-002-A"
        assert lineage["parent"]["lot_number"] == "LOT-LINEAGE-002"


class TestKitExpendableValidateTracking:
    """Test KitExpendable tracking validation."""

    @pytest.fixture
    def test_kit_with_box(self, db_session, admin_user):
        """Create a test kit with a box."""
        aircraft_type = AircraftType(name="Test Aircraft 2", description="Test")
        db_session.add(aircraft_type)
        db_session.flush()

        kit = Kit(
            name="Test Kit 2",
            aircraft_type_id=aircraft_type.id,
            created_by=admin_user.id,
            status="active"
        )
        db_session.add(kit)
        db_session.flush()

        box = KitBox(
            kit_id=kit.id,
            box_number="1",
            box_type="expendable",
            description="Test Box"
        )
        db_session.add(box)
        db_session.commit()

        return kit, box

    def test_tracking_type_none_converted_to_lot(self, app, db_session, test_kit_with_box):
        """Tracking type 'none' is converted to 'lot' with validation."""
        kit, box = test_kit_with_box

        expendable = KitExpendable(
            kit_id=kit.id,
            box_id=box.id,
            part_number="EXP-NONE",
            lot_number="LOT-AUTO",
            tracking_type="none",  # Should be converted
            description="Test",
            quantity=10,
            unit="ea",
            status="available"
        )

        # The validate_tracking method should convert "none" to "lot"
        expendable.validate_tracking()

        assert expendable.tracking_type == "lot"

    def test_get_tracking_identifier_serial(self, app, db_session, test_kit_with_box):
        """get_tracking_identifier returns serial number when serial-tracked."""
        kit, box = test_kit_with_box

        expendable = KitExpendable(
            kit_id=kit.id,
            box_id=box.id,
            part_number="EXP-SERIAL-ID",
            serial_number="SN-ID-001",
            tracking_type="serial",
            description="Test",
            quantity=1,
            unit="ea",
            status="available"
        )
        db_session.add(expendable)
        db_session.commit()

        assert expendable.get_tracking_identifier() == "SN-ID-001"

    def test_get_tracking_identifier_lot(self, app, db_session, test_kit_with_box):
        """get_tracking_identifier returns lot number when lot-tracked."""
        kit, box = test_kit_with_box

        expendable = KitExpendable(
            kit_id=kit.id,
            box_id=box.id,
            part_number="EXP-LOT-ID",
            lot_number="LOT-ID-001",
            tracking_type="lot",
            description="Test",
            quantity=10,
            unit="ea",
            status="available"
        )
        db_session.add(expendable)
        db_session.commit()

        assert expendable.get_tracking_identifier() == "LOT-ID-001"


class TestValidateTransferTracking:
    """Test transfer tracking validation."""

    def test_transfer_with_serial_valid(self, app, db_session, test_warehouse):
        """Transfer with serial-tracked item is valid."""
        tool = Tool(
            tool_number="TOOL-TRANSFER",
            serial_number="SN-TRANSFER-001",
            description="Test Tool",
            status="available",
            warehouse_id=test_warehouse.id
        )
        db_session.add(tool)
        db_session.commit()

        result = validate_transfer_tracking(
            from_item=tool,
            to_location_type="kit",
            to_location_id=1,
            quantity=1
        )
        assert result is True

    def test_transfer_with_lot_valid(self, app, db_session, test_warehouse):
        """Transfer with lot-tracked item is valid."""
        chemical = Chemical(
            part_number="CHEM-TRANSFER",
            lot_number="LOT-TRANSFER-001",
            description="Test Chemical",
            manufacturer="Test",
            quantity=100,
            unit="ml",
            status="available",
            warehouse_id=test_warehouse.id
        )
        db_session.add(chemical)
        db_session.commit()

        result = validate_transfer_tracking(
            from_item=chemical,
            to_location_type="warehouse",
            to_location_id=1,
            quantity=50
        )
        assert result is True


class TestCrossSystemUniqueness:
    """Test that uniqueness is enforced across all inventory types."""

    def test_kit_expendable_blocks_duplicate_in_chemical(self, app, db_session, test_warehouse, admin_user):
        """KitExpendable blocks if same part+lot exists in Chemical."""
        # Create a chemical first
        chemical = Chemical(
            part_number="SHARED-PART",
            lot_number="SHARED-LOT",
            description="Chemical",
            manufacturer="Test",
            quantity=100,
            unit="ml",
            status="available",
            warehouse_id=test_warehouse.id
        )
        db_session.add(chemical)
        db_session.commit()

        # Try to validate same part+lot for a KitExpendable
        with pytest.raises(SerialLotValidationError) as exc_info:
            check_lot_number_unique(
                part_number="SHARED-PART",
                lot_number="SHARED-LOT"
            )
        assert "already exists" in str(exc_info.value)

    def test_chemical_blocks_duplicate_in_kit_expendable(self, app, db_session, admin_user):
        """Chemical blocks if same part+lot exists in KitExpendable."""
        # Create kit with expendable
        aircraft_type = AircraftType(name="Test Aircraft 3", description="Test")
        db_session.add(aircraft_type)
        db_session.flush()

        kit = Kit(
            name="Test Kit 3",
            aircraft_type_id=aircraft_type.id,
            created_by=admin_user.id,
            status="active"
        )
        db_session.add(kit)
        db_session.flush()

        box = KitBox(
            kit_id=kit.id,
            box_number="1",
            box_type="expendable"
        )
        db_session.add(box)
        db_session.flush()

        expendable = KitExpendable(
            kit_id=kit.id,
            box_id=box.id,
            part_number="CROSS-PART",
            lot_number="CROSS-LOT",
            tracking_type="lot",
            description="Expendable",
            quantity=50,
            unit="ft",
            status="available"
        )
        db_session.add(expendable)
        db_session.commit()

        # Try to validate same part+lot for a Chemical
        with pytest.raises(SerialLotValidationError) as exc_info:
            check_lot_number_unique(
                part_number="CROSS-PART",
                lot_number="CROSS-LOT"
            )
        assert "already exists" in str(exc_info.value)
        assert "Test Kit 3" in str(exc_info.value)


# Fixture to create auth_headers_user for existing tests compatibility
@pytest.fixture
def auth_headers_user(client, regular_user, jwt_manager):
    """Get authentication headers for regular user."""
    with client.application.app_context():
        tokens = jwt_manager.generate_tokens(regular_user)
    access_token = tokens["access_token"]
    return {"Authorization": f"Bearer {access_token}"}
