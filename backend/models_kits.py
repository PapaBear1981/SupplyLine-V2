"""
Database Models for Mobile Warehouse/Kits System

This module contains all database models related to the Mobile Warehouse (Kits) functionality,
including aircraft types, kits, boxes, items, transfers, reorders, and messaging.
"""

from models import db, get_current_time


class AircraftType(db.Model):
    """
    Aircraft Type model for categorizing kits by aircraft type.
    Examples: Q400, RJ85, CL415
    """
    __tablename__ = "aircraft_types"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    description = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=get_current_time, nullable=False)

    # Relationships
    kits = db.relationship("Kit", back_populates="aircraft_type", lazy="dynamic")

    def to_dict(self):
        """Convert model to dictionary"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "kit_count": self.kits.filter_by(status="active").count() if self.kits else 0
        }


class Kit(db.Model):
    """
    Kit model representing a mobile warehouse.
    Each kit is associated with an aircraft type and contains boxes of items.
    """
    __tablename__ = "kits"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    # Version field for optimistic locking (concurrent update detection)
    version = db.Column(db.Integer, nullable=False, default=1, server_default="1")
    aircraft_type_id = db.Column(db.Integer, db.ForeignKey("aircraft_types.id"), nullable=False)
    description = db.Column(db.String(500))
    status = db.Column(db.String(20), nullable=False, default="active")  # active, inactive, maintenance
    created_at = db.Column(db.DateTime, default=get_current_time, nullable=False)
    updated_at = db.Column(db.DateTime, default=get_current_time, onupdate=get_current_time, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    # Location fields for map display
    location_address = db.Column(db.String(255), nullable=True)
    location_city = db.Column(db.String(100), nullable=True)
    location_state = db.Column(db.String(100), nullable=True)
    location_zip = db.Column(db.String(20), nullable=True)
    location_country = db.Column(db.String(100), nullable=True, default="USA")
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    location_notes = db.Column(db.String(500), nullable=True)  # E.g., "Hangar 3, Bay 2"
    trailer_number = db.Column(db.String(100), nullable=True)  # Trailer number for kits assigned to trailers

    # Relationships
    aircraft_type = db.relationship("AircraftType", back_populates="kits")
    creator = db.relationship("User", foreign_keys=[created_by])
    boxes = db.relationship("KitBox", back_populates="kit", lazy="dynamic", cascade="all, delete-orphan")
    items = db.relationship("KitItem", back_populates="kit", lazy="dynamic", cascade="all, delete-orphan")
    expendables = db.relationship("KitExpendable", back_populates="kit", lazy="dynamic", cascade="all, delete-orphan")
    issuances = db.relationship("KitIssuance", back_populates="kit", lazy="dynamic", cascade="all, delete-orphan")
    reorder_requests = db.relationship("KitReorderRequest", back_populates="kit", lazy="dynamic", cascade="all, delete-orphan")
    messages = db.relationship("KitMessage", back_populates="kit", lazy="dynamic", cascade="all, delete-orphan")

    def to_dict(self, include_details=False):
        """Convert model to dictionary"""
        data = {
            "id": self.id,
            "version": self.version,  # For optimistic locking
            "name": self.name,
            "aircraft_type_id": self.aircraft_type_id,
            "aircraft_type_name": self.aircraft_type.name if self.aircraft_type else None,
            "description": self.description,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
            "creator_name": self.creator.name if self.creator else None,
            "box_count": self.boxes.count() if self.boxes else 0,
            "item_count": self.items.count() + self.expendables.count() if self.items and self.expendables else 0,
            # Location fields
            "location_address": self.location_address,
            "location_city": self.location_city,
            "location_state": self.location_state,
            "location_zip": self.location_zip,
            "location_country": self.location_country,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "location_notes": self.location_notes,
            "trailer_number": self.trailer_number,
            "has_location": self.latitude is not None and self.longitude is not None,
        }

        if include_details:
            data["boxes"] = [box.to_dict() for box in self.boxes.all()] if self.boxes else []
            data["pending_reorders"] = self.reorder_requests.filter_by(status="pending").count() if self.reorder_requests else 0
            data["unread_messages"] = self.messages.filter_by(is_read=False).count() if self.messages else 0

        return data

    def get_full_address(self):
        """Get the full formatted address"""
        parts = []
        if self.location_address:
            parts.append(self.location_address)
        if self.location_city:
            parts.append(self.location_city)
        if self.location_state:
            if self.location_zip:
                parts.append(f"{self.location_state} {self.location_zip}")
            else:
                parts.append(self.location_state)
        elif self.location_zip:
            parts.append(self.location_zip)
        if self.location_country and self.location_country != "USA":
            parts.append(self.location_country)
        return ", ".join(parts) if parts else None


class KitBox(db.Model):
    """
    KitBox model representing a physical box within a kit.
    Each box has a type: expendable, tooling, consumable, loose, or floor.
    """
    __tablename__ = "kit_boxes"

    id = db.Column(db.Integer, primary_key=True)
    kit_id = db.Column(db.Integer, db.ForeignKey("kits.id"), nullable=False)
    box_number = db.Column(db.String(20), nullable=False)  # e.g., "Box1", "Box2", "Loose", "Floor"
    box_type = db.Column(db.String(20), nullable=False)  # expendable, tooling, consumable, loose, floor
    description = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=get_current_time, nullable=False)

    # Relationships
    kit = db.relationship("Kit", back_populates="boxes")
    items = db.relationship("KitItem", back_populates="box", lazy="dynamic", cascade="all, delete-orphan")
    expendables = db.relationship("KitExpendable", back_populates="box", lazy="dynamic", cascade="all, delete-orphan")

    # Unique constraint: kit_id + box_number must be unique
    __table_args__ = (
        db.UniqueConstraint("kit_id", "box_number", name="uix_kit_box_number"),
    )

    def to_dict(self):
        """Convert model to dictionary"""
        return {
            "id": self.id,
            "kit_id": self.kit_id,
            "box_number": self.box_number,
            "box_type": self.box_type,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "item_count": (self.items.count() if self.items else 0) + (self.expendables.count() if self.expendables else 0)
        }


class KitItem(db.Model):
    """
    KitItem model representing tools or chemicals transferred into a kit.
    Links to existing Tool or Chemical records.
    """
    __tablename__ = "kit_items"

    id = db.Column(db.Integer, primary_key=True)
    kit_id = db.Column(db.Integer, db.ForeignKey("kits.id"), nullable=False)
    box_id = db.Column(db.Integer, db.ForeignKey("kit_boxes.id"), nullable=False)
    item_type = db.Column(db.String(20), nullable=False)  # tool, chemical
    item_id = db.Column(db.Integer, nullable=False)  # FK to tools.id or chemicals.id
    part_number = db.Column(db.String(100))
    serial_number = db.Column(db.String(100))
    lot_number = db.Column(db.String(100))
    description = db.Column(db.String(500))
    quantity = db.Column(db.Float, nullable=False, default=1.0)
    location = db.Column(db.String(100))  # Location within the box
    status = db.Column(db.String(20), nullable=False, default="available")  # available, issued, maintenance
    added_date = db.Column(db.DateTime, default=get_current_time, nullable=False)
    last_updated = db.Column(db.DateTime, default=get_current_time, onupdate=get_current_time, nullable=False)

    # Relationships
    kit = db.relationship("Kit", back_populates="items")
    box = db.relationship("KitBox", back_populates="items")

    def to_dict(self):
        """Convert model to dictionary"""
        return {
            "id": self.id,
            "kit_id": self.kit_id,
            "box_id": self.box_id,
            "box_number": self.box.box_number if self.box else None,
            "item_type": self.item_type,
            "item_id": self.item_id,
            "part_number": self.part_number,
            "serial_number": self.serial_number,
            "lot_number": self.lot_number,
            "description": self.description,
            "quantity": self.quantity,
            "location": self.location,
            "status": self.status,
            "added_date": self.added_date.isoformat() if self.added_date else None,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None
        }


class KitExpendable(db.Model):
    """
    KitExpendable model for manually added expendable items.
    These are not linked to existing inventory records.
    Expendables MUST be tracked by EITHER lot number OR serial number (never both, never neither).

    Policy:
    - All expendables must have either a serial number or a lot number for traceability
    - The combination of part_number + serial/lot must be unique across the system
    - Child lots are created when items are partially issued
    """
    __tablename__ = "kit_expendables"

    id = db.Column(db.Integer, primary_key=True)
    kit_id = db.Column(db.Integer, db.ForeignKey("kits.id"), nullable=False)
    box_id = db.Column(db.Integer, db.ForeignKey("kit_boxes.id"), nullable=False)
    part_number = db.Column(db.String(100), nullable=False, index=True)
    serial_number = db.Column(db.String(100), index=True)
    lot_number = db.Column(db.String(100), index=True)
    # tracking_type MUST be either 'lot' or 'serial' - 'none' is no longer allowed
    # All items must be tracked for audit/traceability purposes
    tracking_type = db.Column(db.String(20), nullable=False, default="lot")
    description = db.Column(db.String(500), nullable=False)
    quantity = db.Column(db.Float, nullable=False, default=0)
    unit = db.Column(db.String(20), nullable=False, default="each")  # each, oz, ml, etc.
    location = db.Column(db.String(100))
    status = db.Column(db.String(20), nullable=False, default="available")  # available, low_stock, out_of_stock
    minimum_stock_level = db.Column(db.Float)
    added_date = db.Column(db.DateTime, default=get_current_time, nullable=False)
    last_updated = db.Column(db.DateTime, default=get_current_time, onupdate=get_current_time, nullable=False)

    # Lot lineage tracking for partial issuances
    parent_lot_number = db.Column(db.String(100), nullable=True)  # Parent lot if this is a child lot
    lot_sequence = db.Column(db.Integer, nullable=True, default=0)  # Number of child lots created from this

    # Relationships
    kit = db.relationship("Kit", back_populates="expendables")
    box = db.relationship("KitBox", back_populates="expendables")

    def to_dict(self):
        """Convert model to dictionary"""
        return {
            "id": self.id,
            "kit_id": self.kit_id,
            "box_id": self.box_id,
            "box_number": self.box.box_number if self.box else None,
            "item_type": "expendable",  # Always 'expendable' for KitExpendable items
            "part_number": self.part_number,
            "serial_number": self.serial_number,
            "lot_number": self.lot_number,
            "tracking_type": self.tracking_type,
            "description": self.description,
            "quantity": self.quantity,
            "unit": self.unit,
            "location": self.location,
            "status": self.status,
            "minimum_stock_level": self.minimum_stock_level,
            "is_low_stock": self.is_low_stock(),
            "added_date": self.added_date.isoformat() if self.added_date else None,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
            "parent_lot_number": self.parent_lot_number,
            "lot_sequence": self.lot_sequence or 0,
            "source": "expendable"  # Indicates this came from kit_expendables table
        }

    def is_low_stock(self):
        """Check if expendable is at or below minimum stock level"""
        if self.minimum_stock_level is None:
            return False
        return self.quantity <= self.minimum_stock_level

    def validate_tracking(self):
        """
        Validate that appropriate tracking identifiers are present based on tracking_type.
        Items MUST have EITHER lot number OR serial number, never both, never neither.

        Policy: All expendables must be tracked for audit and traceability purposes.
        'none' tracking type is no longer allowed.

        Returns:
            tuple: (is_valid, error_message)
        """
        # Normalise tracking type to ensure comparisons work even if the value was stored in
        # uppercase or contains unexpected whitespace.
        tracking_type = (self.tracking_type or "lot").strip().lower()

        # 'none' is no longer allowed - migrate to 'lot' with auto-generated lot number
        if tracking_type == "none":
            tracking_type = "lot"

        self.tracking_type = tracking_type

        if tracking_type == "lot":
            if not self.lot_number:
                return False, "Lot number is required for tracking. All expendables must have either a lot number or serial number."
            if self.serial_number:
                return False, "Items cannot have both lot number and serial number. Please use only one tracking method."
        elif tracking_type == "serial":
            if not self.serial_number:
                return False, "Serial number is required for tracking. All expendables must have either a serial number or lot number."
            if self.lot_number:
                return False, "Items cannot have both serial number and lot number. Please use only one tracking method."
        else:
            return False, (
                f"Invalid tracking_type: {self.tracking_type}. Must be 'lot' or 'serial'. All items must be tracked."
            )

        return True, None

    def get_tracking_identifier(self):
        """Get the tracking identifier (lot or serial number) for this expendable."""
        if self.tracking_type == "serial":
            return self.serial_number
        return self.lot_number

    def has_children(self):
        """Check if this expendable has any child lots."""
        if not self.lot_number or self.tracking_type != "lot":
            return False
        return KitExpendable.query.filter_by(parent_lot_number=self.lot_number).count() > 0


class KitIssuance(db.Model):
    """
    KitIssuance model for tracking items issued from kits.
    Records all issuances for audit and reorder purposes.
    """
    __tablename__ = "kit_issuances"

    id = db.Column(db.Integer, primary_key=True)
    kit_id = db.Column(db.Integer, db.ForeignKey("kits.id"), nullable=False)
    item_type = db.Column(db.String(20), nullable=False)  # tool, chemical, expendable
    item_id = db.Column(db.Integer, nullable=False)  # FK to kit_items.id or kit_expendables.id
    issued_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    issued_to = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)  # Who received the item
    part_number = db.Column(db.String(100))  # Part number or tool number
    serial_number = db.Column(db.String(100))  # Serial number (for tools)
    lot_number = db.Column(db.String(100))  # Lot number (for chemicals/expendables)
    description = db.Column(db.String(500))  # Item description
    quantity = db.Column(db.Float, nullable=False)
    purpose = db.Column(db.String(500))
    work_order = db.Column(db.String(100))
    issued_date = db.Column(db.DateTime, default=get_current_time, nullable=False)
    notes = db.Column(db.String(1000))

    # Relationships
    kit = db.relationship("Kit", back_populates="issuances")
    issuer = db.relationship("User", foreign_keys=[issued_by])
    recipient = db.relationship("User", foreign_keys=[issued_to])

    def to_dict(self):
        """Convert model to dictionary"""
        return {
            "id": self.id,
            "kit_id": self.kit_id,
            "kit_name": self.kit.name if self.kit else None,
            "item_type": self.item_type,
            "item_id": self.item_id,
            "issued_by": self.issued_by,
            "issuer_name": self.issuer.name if self.issuer else None,
            "issued_to": self.issued_to,
            "recipient_name": self.recipient.name if self.recipient else None,
            "part_number": self.part_number,
            "serial_number": self.serial_number,
            "lot_number": self.lot_number,
            "description": self.description,
            "quantity": self.quantity,
            "purpose": self.purpose,
            "work_order": self.work_order,
            "issued_date": self.issued_date.isoformat() if self.issued_date else None,
            "notes": self.notes
        }


class KitTransfer(db.Model):
    """
    KitTransfer model for tracking transfers between kits and warehouses.
    Supports kit-to-kit, kit-to-warehouse, and warehouse-to-kit transfers.
    """
    __tablename__ = "kit_transfers"

    id = db.Column(db.Integer, primary_key=True)
    item_type = db.Column(db.String(20), nullable=False)  # tool, chemical, expendable
    item_id = db.Column(db.Integer, nullable=False)
    from_location_type = db.Column(db.String(20), nullable=False)  # kit, warehouse
    from_location_id = db.Column(db.Integer, nullable=False)  # kit_id or warehouse identifier
    to_location_type = db.Column(db.String(20), nullable=False)  # kit, warehouse
    to_location_id = db.Column(db.Integer, nullable=False)  # kit_id or warehouse identifier
    quantity = db.Column(db.Float, nullable=False)
    transferred_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    transfer_date = db.Column(db.DateTime, default=get_current_time, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="pending")  # pending, completed, cancelled
    completed_date = db.Column(db.DateTime)
    notes = db.Column(db.String(1000))

    # Relationships
    transferrer = db.relationship("User", foreign_keys=[transferred_by])

    def to_dict(self):
        """Convert model to dictionary with item details"""
        from models import Chemical, Tool

        # Base transfer data
        data = {
            "id": self.id,
            "item_type": self.item_type,
            "item_id": self.item_id,
            "from_location_type": self.from_location_type,
            "from_location_id": self.from_location_id,
            "to_location_type": self.to_location_type,
            "to_location_id": self.to_location_id,
            "quantity": self.quantity,
            "transferred_by": self.transferred_by,
            "transferred_by_name": self.transferrer.name if self.transferrer else None,
            "transfer_date": self.transfer_date.isoformat() if self.transfer_date else None,
            "status": self.status,
            "completed_date": self.completed_date.isoformat() if self.completed_date else None,
            "notes": self.notes
        }

        # Add location names
        if self.from_location_type == "kit":
            from_kit = db.session.get(Kit, self.from_location_id)
            data["from_location_name"] = from_kit.name if from_kit else None
        elif self.from_location_type == "warehouse":
            from models import Warehouse
            from_warehouse = db.session.get(Warehouse, self.from_location_id)
            data["from_location_name"] = from_warehouse.name if from_warehouse else None

        if self.to_location_type == "kit":
            to_kit = db.session.get(Kit, self.to_location_id)
            data["to_location_name"] = to_kit.name if to_kit else None
        elif self.to_location_type == "warehouse":
            from models import Warehouse
            to_warehouse = db.session.get(Warehouse, self.to_location_id)
            data["to_location_name"] = to_warehouse.name if to_warehouse else None

        # Fetch item details based on item_type
        if self.item_type == "tool":
            tool = db.session.get(Tool, self.item_id)
            if tool:
                data["tool_number"] = tool.tool_number
                data["part_number"] = None
                data["description"] = tool.description
                data["serial_number"] = tool.serial_number
        elif self.item_type == "chemical":
            chemical = db.session.get(Chemical, self.item_id)
            if chemical:
                data["part_number"] = chemical.part_number
                data["tool_number"] = None
                data["description"] = chemical.description
                data["lot_number"] = chemical.lot_number
        elif self.item_type == "expendable":
            expendable = db.session.get(KitExpendable, self.item_id)
            if expendable:
                data["part_number"] = expendable.part_number
                data["tool_number"] = None
                data["description"] = expendable.description
                data["lot_number"] = expendable.lot_number
                data["serial_number"] = expendable.serial_number

        return data


class KitReorderRequest(db.Model):
    """
    KitReorderRequest model for tracking reorder requests.
    Can be automatically generated or manually created.
    """
    __tablename__ = "kit_reorder_requests"

    id = db.Column(db.Integer, primary_key=True)
    kit_id = db.Column(db.Integer, db.ForeignKey("kits.id"), nullable=False)
    item_type = db.Column(db.String(20), nullable=False)  # tool, chemical, expendable
    item_id = db.Column(db.Integer)  # Nullable for new items
    part_number = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500), nullable=False)
    quantity_requested = db.Column(db.Float, nullable=False)
    priority = db.Column(db.String(20), nullable=False, default="medium")  # low, medium, high, urgent
    requested_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    requested_date = db.Column(db.DateTime, default=get_current_time, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="pending")  # pending, approved, ordered, fulfilled, cancelled
    approved_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    approved_date = db.Column(db.DateTime)
    fulfillment_date = db.Column(db.DateTime)
    notes = db.Column(db.String(1000))
    is_automatic = db.Column(db.Boolean, default=False)  # True if auto-generated
    image_path = db.Column(db.String(500))  # Path to uploaded image for new item requests

    # Relationships
    kit = db.relationship("Kit", back_populates="reorder_requests")
    requester = db.relationship("User", foreign_keys=[requested_by])
    approver = db.relationship("User", foreign_keys=[approved_by])
    messages = db.relationship("KitMessage", back_populates="related_request", lazy="dynamic")

    def to_dict(self):
        """Convert model to dictionary"""
        # Get linked procurement order status if exists
        from models import ProcurementOrder
        linked_order = ProcurementOrder.query.filter_by(
            reference_type="kit_reorder",
            reference_number=str(self.id)
        ).first()

        return {
            "id": self.id,
            "kit_id": self.kit_id,
            "kit_name": self.kit.name if self.kit else None,
            "item_type": self.item_type,
            "item_id": self.item_id,
            "part_number": self.part_number,
            "description": self.description,
            "quantity_requested": self.quantity_requested,
            "priority": self.priority,
            "requested_by": self.requested_by,
            "requester_name": self.requester.name if self.requester else None,
            "requested_date": self.requested_date.isoformat() if self.requested_date else None,
            "status": self.status,
            "order_status": linked_order.status if linked_order else None,
            "approved_by": self.approved_by,
            "approver_name": self.approver.name if self.approver else None,
            "approved_date": self.approved_date.isoformat() if self.approved_date else None,
            "fulfillment_date": self.fulfillment_date.isoformat() if self.fulfillment_date else None,
            "notes": self.notes,
            "is_automatic": self.is_automatic,
            "image_path": self.image_path,
            "message_count": self.messages.count() if self.messages else 0
        }


class KitMessage(db.Model):
    """
    KitMessage model for messaging between mechanics and stores personnel.
    Supports threading and attachments.
    """
    __tablename__ = "kit_messages"

    id = db.Column(db.Integer, primary_key=True)
    kit_id = db.Column(db.Integer, db.ForeignKey("kits.id"), nullable=False)
    related_request_id = db.Column(db.Integer, db.ForeignKey("kit_reorder_requests.id"))  # Optional link to reorder request
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey("users.id"))  # Nullable for broadcast messages
    subject = db.Column(db.String(200), nullable=False)
    message = db.Column(db.String(5000), nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    sent_date = db.Column(db.DateTime, default=get_current_time, nullable=False)
    read_date = db.Column(db.DateTime)
    parent_message_id = db.Column(db.Integer, db.ForeignKey("kit_messages.id"))  # For threading
    attachments = db.Column(db.String(1000))  # JSON string of attachment paths

    # Relationships
    kit = db.relationship("Kit", back_populates="messages")
    related_request = db.relationship("KitReorderRequest", back_populates="messages")
    sender = db.relationship("User", foreign_keys=[sender_id])
    recipient = db.relationship("User", foreign_keys=[recipient_id])
    parent_message = db.relationship("KitMessage", remote_side=[id], backref="replies")

    def to_dict(self, include_replies=False):
        """Convert model to dictionary"""
        data = {
            "id": self.id,
            "kit_id": self.kit_id,
            "kit_name": self.kit.name if self.kit else None,
            "related_request_id": self.related_request_id,
            "sender_id": self.sender_id,
            "sender_name": self.sender.name if self.sender else None,
            "recipient_id": self.recipient_id,
            "recipient_name": self.recipient.name if self.recipient else None,
            "subject": self.subject,
            "message": self.message,
            "is_read": self.is_read,
            "sent_date": self.sent_date.isoformat() if self.sent_date else None,
            "read_date": self.read_date.isoformat() if self.read_date else None,
            "parent_message_id": self.parent_message_id,
            "attachments": self.attachments,
            "reply_count": len(self.replies) if hasattr(self, "replies") else 0
        }

        if include_replies and hasattr(self, "replies"):
            data["replies"] = [reply.to_dict() for reply in self.replies]

        return data
