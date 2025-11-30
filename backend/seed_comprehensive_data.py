"""
Comprehensive Seed Script for SupplyLine MRO Suite

This script populates the database with realistic test data including:
- Warehouses
- Aircraft Types
- Kits with boxes
- Tools (with serial numbers)
- Chemicals (with lot numbers)
- Kit Expendables (with lot/serial numbers)

All items are properly tracked with serial or lot numbers per the new enforcement policy.
"""

import os
import sys
from datetime import datetime, timedelta


# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import app from run.py to get proper Flask context with all models loaded
from models import Chemical, LotNumberSequence, Tool, User, Warehouse, db
from models_kits import AircraftType, Kit, KitBox, KitExpendable
from run import app


def get_or_create_admin():
    """Get the admin user or create one if it doesn't exist."""
    admin = User.query.filter_by(employee_number="ADMIN001").first()
    if not admin:
        admin = User.query.filter_by(is_admin=True).first()
    if not admin:
        print("Warning: No admin user found. Creating a default admin.")
        admin = User(
            name="System Admin",
            employee_number="ADMIN001",
            department="IT",
            is_admin=True
        )
        admin.set_password("admin123")
        db.session.add(admin)
        db.session.commit()
    return admin


def generate_lot_number(prefix="LOT"):
    """Generate a unique lot number."""
    date_str = datetime.now().strftime("%y%m%d")
    # Get next sequence
    seq = LotNumberSequence.query.filter_by(date=datetime.now().strftime("%Y%m%d")).first()
    if seq:
        seq.sequence_counter += 1
        counter = seq.sequence_counter
    else:
        seq = LotNumberSequence(date=datetime.now().strftime("%Y%m%d"), sequence_counter=1)
        db.session.add(seq)
        counter = 1
    db.session.flush()
    return f"{prefix}-{date_str}-{counter:04d}"


def seed_warehouses():
    """Create warehouse locations."""
    print("\n=== Seeding Warehouses ===")

    warehouses_data = [
        {
            "name": "Main Warehouse - Abbotsford",
            "address": "1455 Aviation Way",
            "city": "Abbotsford",
            "state": "BC",
            "zip_code": "V2T 6H5",
            "country": "Canada",
            "warehouse_type": "main",
            "contact_person": "John Smith",
            "contact_phone": "604-555-0100",
            "contact_email": "jsmith@conair.ca"
        },
        {
            "name": "Satellite Warehouse - Red Deer",
            "address": "4500 Aero Drive",
            "city": "Red Deer",
            "state": "AB",
            "zip_code": "T4N 6V7",
            "country": "Canada",
            "warehouse_type": "satellite",
            "contact_person": "Mike Johnson",
            "contact_phone": "403-555-0200",
            "contact_email": "mjohnson@conair.ca"
        },
        {
            "name": "Satellite Warehouse - Kamloops",
            "address": "2750 Airport Road",
            "city": "Kamloops",
            "state": "BC",
            "zip_code": "V2B 7X1",
            "country": "Canada",
            "warehouse_type": "satellite",
            "contact_person": "Sarah Wilson",
            "contact_phone": "250-555-0300",
            "contact_email": "swilson@conair.ca"
        }
    ]

    warehouses = []
    for wh_data in warehouses_data:
        existing = Warehouse.query.filter_by(name=wh_data["name"]).first()
        if existing:
            print(f"  Warehouse '{wh_data['name']}' already exists, skipping.")
            warehouses.append(existing)
        else:
            wh = Warehouse(**wh_data)
            db.session.add(wh)
            warehouses.append(wh)
            print(f"  Created warehouse: {wh_data['name']}")

    db.session.commit()
    return warehouses


def seed_aircraft_types():
    """Create aircraft types."""
    print("\n=== Seeding Aircraft Types ===")

    types_data = [
        {"name": "Q400", "description": "De Havilland Dash 8 Q400 Air Tanker"},
        {"name": "RJ85", "description": "BAe 146/Avro RJ85 Air Tanker"},
        {"name": "CL415", "description": "Canadair CL-415 Amphibious Water Bomber"},
        {"name": "CV580", "description": "Convair 580 Air Tanker"},
        {"name": "King Air", "description": "Beechcraft King Air Lead/Bird Dog Aircraft"}
    ]

    aircraft_types = []
    for at_data in types_data:
        existing = AircraftType.query.filter_by(name=at_data["name"]).first()
        if existing:
            print(f"  Aircraft type '{at_data['name']}' already exists, skipping.")
            aircraft_types.append(existing)
        else:
            at = AircraftType(**at_data)
            db.session.add(at)
            aircraft_types.append(at)
            print(f"  Created aircraft type: {at_data['name']}")

    db.session.commit()
    return aircraft_types


def seed_tools(warehouses):
    """Create tools with serial numbers in warehouses."""
    print("\n=== Seeding Tools ===")

    main_warehouse = warehouses[0]

    tools_data = [
        # Hand Tools
        {"tool_number": "HT-001", "serial_number": "SN-HT-2024-001", "description": 'Torque Wrench 1/2" Drive 20-150 ft-lbs', "category": "Hand Tools", "condition": "Excellent"},
        {"tool_number": "HT-002", "serial_number": "SN-HT-2024-002", "description": 'Torque Wrench 3/8" Drive 10-80 ft-lbs', "category": "Hand Tools", "condition": "Good"},
        {"tool_number": "HT-003", "serial_number": "SN-HT-2024-003", "description": "Safety Wire Pliers - 6 inch", "category": "Hand Tools", "condition": "Excellent"},
        {"tool_number": "HT-004", "serial_number": "SN-HT-2024-004", "description": "Rivet Gun - Pneumatic", "category": "Hand Tools", "condition": "Good"},
        {"tool_number": "HT-005", "serial_number": "SN-HT-2024-005", "description": "Bucking Bar Set - 6 piece", "category": "Hand Tools", "condition": "Fair"},
        {"tool_number": "HT-006", "serial_number": "SN-HT-2024-006", "description": "Cleco Pliers", "category": "Hand Tools", "condition": "Excellent"},
        {"tool_number": "HT-007", "serial_number": "SN-HT-2024-007", "description": 'Drill Bit Set - Cobalt 1/16" to 1/2"', "category": "Hand Tools", "condition": "Good"},

        # Power Tools
        {"tool_number": "PT-001", "serial_number": "SN-PT-2024-001", "description": "Pneumatic Drill - 90 Degree", "category": "Power Tools", "condition": "Excellent"},
        {"tool_number": "PT-002", "serial_number": "SN-PT-2024-002", "description": "Die Grinder - Pneumatic", "category": "Power Tools", "condition": "Good"},
        {"tool_number": "PT-003", "serial_number": "SN-PT-2024-003", "description": "Orbital Sander - Pneumatic", "category": "Power Tools", "condition": "Excellent"},
        {"tool_number": "PT-004", "serial_number": "SN-PT-2024-004", "description": "Heat Gun - Industrial", "category": "Power Tools", "condition": "Good"},
        {"tool_number": "PT-005", "serial_number": "SN-PT-2024-005", "description": "Hydraulic Rivet Squeezer", "category": "Power Tools", "condition": "Fair"},

        # Measuring/Calibrated Tools
        {"tool_number": "MT-001", "serial_number": "SN-MT-2024-001", "description": "Digital Caliper - 6 inch", "category": "Measuring", "condition": "Excellent", "requires_calibration": True, "calibration_frequency_days": 365},
        {"tool_number": "MT-002", "serial_number": "SN-MT-2024-002", "description": "Micrometer Set - 0-3 inch", "category": "Measuring", "condition": "Excellent", "requires_calibration": True, "calibration_frequency_days": 365},
        {"tool_number": "MT-003", "serial_number": "SN-MT-2024-003", "description": "Depth Gauge - Digital", "category": "Measuring", "condition": "Good", "requires_calibration": True, "calibration_frequency_days": 180},
        {"tool_number": "MT-004", "serial_number": "SN-MT-2024-004", "description": "Protractor - Digital", "category": "Measuring", "condition": "Excellent", "requires_calibration": True, "calibration_frequency_days": 365},
        {"tool_number": "MT-005", "serial_number": "SN-MT-2024-005", "description": "Feeler Gauge Set - 26 blade", "category": "Measuring", "condition": "Good"},

        # Specialty Tools
        {"tool_number": "SP-001", "serial_number": "SN-SP-2024-001", "description": "Borescope - Articulating", "category": "Specialty", "condition": "Excellent"},
        {"tool_number": "SP-002", "serial_number": "SN-SP-2024-002", "description": "Multimeter - Digital", "category": "Specialty", "condition": "Good", "requires_calibration": True, "calibration_frequency_days": 365},
        {"tool_number": "SP-003", "serial_number": "SN-SP-2024-003", "description": "Cable Tensiometer", "category": "Specialty", "condition": "Excellent", "requires_calibration": True, "calibration_frequency_days": 180},
    ]

    tools = []
    for tool_data in tools_data:
        existing = Tool.query.filter_by(serial_number=tool_data["serial_number"]).first()
        if existing:
            print(f"  Tool '{tool_data['serial_number']}' already exists, skipping.")
            tools.append(existing)
        else:
            tool = Tool(
                tool_number=tool_data["tool_number"],
                serial_number=tool_data["serial_number"],
                description=tool_data["description"],
                category=tool_data.get("category", "General"),
                condition=tool_data.get("condition", "Good"),
                status="available",
                warehouse_id=main_warehouse.id,
                requires_calibration=tool_data.get("requires_calibration", False),
                calibration_frequency_days=tool_data.get("calibration_frequency_days"),
            )
            if tool.requires_calibration:
                tool.last_calibration_date = datetime.now() - timedelta(days=30)
                tool.next_calibration_date = tool.last_calibration_date + timedelta(days=tool.calibration_frequency_days)
                tool.update_calibration_status()
            db.session.add(tool)
            tools.append(tool)
            print(f"  Created tool: {tool_data['description']} ({tool_data['serial_number']})")

    db.session.commit()
    return tools


def seed_chemicals(warehouses):
    """Create chemicals with lot numbers in warehouses."""
    print("\n=== Seeding Chemicals ===")

    main_warehouse = warehouses[0]

    chemicals_data = [
        # Sealants
        {"part_number": "PR-1422", "description": "PR-1422 Class B-2 Sealant", "manufacturer": "PPG", "category": "Sealant", "quantity": 24, "unit": "tube", "expiration_days": 365},
        {"part_number": "PR-1440", "description": "PR-1440 Class A Fuel Tank Sealant", "manufacturer": "PPG", "category": "Sealant", "quantity": 12, "unit": "tube", "expiration_days": 180},
        {"part_number": "PR-1776", "description": "PR-1776 Class B Sealant", "manufacturer": "PPG", "category": "Sealant", "quantity": 18, "unit": "tube", "expiration_days": 270},
        {"part_number": "CS-3204", "description": "CS-3204 Polysulfide Sealant", "manufacturer": "Flamemaster", "category": "Sealant", "quantity": 10, "unit": "cartridge", "expiration_days": 365},
        {"part_number": "RTV-106", "description": "RTV-106 Silicone Sealant", "manufacturer": "Momentive", "category": "Sealant", "quantity": 20, "unit": "tube", "expiration_days": 730},

        # Adhesives
        {"part_number": "EA-9394", "description": "EA-9394 Structural Adhesive", "manufacturer": "Henkel", "category": "Adhesive", "quantity": 8, "unit": "kit", "expiration_days": 365},
        {"part_number": "EC-2216", "description": "EC-2216 Epoxy Adhesive", "manufacturer": "3M", "category": "Adhesive", "quantity": 15, "unit": "cartridge", "expiration_days": 365},
        {"part_number": "FM-73", "description": "FM-73 Film Adhesive", "manufacturer": "Cytec", "category": "Adhesive", "quantity": 5, "unit": "roll", "expiration_days": 180},

        # Lubricants
        {"part_number": "MIL-PRF-23827", "description": "MIL-PRF-23827 Type II Grease", "manufacturer": "Aeroshell", "category": "Lubricant", "quantity": 24, "unit": "can", "expiration_days": 1095},
        {"part_number": "MIL-PRF-81322", "description": "MIL-PRF-81322 Wide Temp Grease", "manufacturer": "Mobil", "category": "Lubricant", "quantity": 20, "unit": "tube", "expiration_days": 1095},
        {"part_number": "LPS-2", "description": "LPS-2 Industrial Lubricant", "manufacturer": "LPS", "category": "Lubricant", "quantity": 36, "unit": "can", "expiration_days": 1825},

        # Cleaners
        {"part_number": "MEK", "description": "MEK Solvent (Methyl Ethyl Ketone)", "manufacturer": "Klean-Strip", "category": "Cleaner", "quantity": 12, "unit": "gallon", "expiration_days": 1825},
        {"part_number": "AC-140", "description": "AC-140 Alkaline Cleaner", "manufacturer": "Cee-Bee", "category": "Cleaner", "quantity": 8, "unit": "gallon", "expiration_days": 730},
        {"part_number": "ISOPROPYL", "description": "Isopropyl Alcohol 99%", "manufacturer": "Various", "category": "Cleaner", "quantity": 20, "unit": "gallon", "expiration_days": 1825},

        # Primers/Paints
        {"part_number": "EWPR-2", "description": "EWPR-2 Epoxy Primer", "manufacturer": "PPG", "category": "Primer", "quantity": 6, "unit": "quart", "expiration_days": 365},
        {"part_number": "CA-8000", "description": "CA-8000 Polyurethane Topcoat", "manufacturer": "Akzo Nobel", "category": "Paint", "quantity": 4, "unit": "quart", "expiration_days": 365},
    ]

    chemicals = []
    for chem_data in chemicals_data:
        lot_number = generate_lot_number("LOT")
        existing = Chemical.query.filter_by(part_number=chem_data["part_number"], lot_number=lot_number).first()
        if existing:
            print(f"  Chemical '{chem_data['part_number']}' with lot '{lot_number}' already exists, skipping.")
            chemicals.append(existing)
        else:
            chem = Chemical(
                part_number=chem_data["part_number"],
                lot_number=lot_number,
                description=chem_data["description"],
                manufacturer=chem_data["manufacturer"],
                category=chem_data.get("category", "General"),
                quantity=chem_data["quantity"],
                unit=chem_data.get("unit", "each"),
                status="available",
                warehouse_id=main_warehouse.id,
                expiration_date=datetime.now() + timedelta(days=chem_data.get("expiration_days", 365)),
                minimum_stock_level=max(1, chem_data["quantity"] // 4)
            )
            db.session.add(chem)
            chemicals.append(chem)
            print(f"  Created chemical: {chem_data['description']} (Lot: {lot_number})")

    db.session.commit()
    return chemicals


def seed_kits(aircraft_types, admin):
    """Create kits with boxes."""
    print("\n=== Seeding Kits with Boxes ===")

    kits_data = [
        {
            "name": "Q400-Kit-01",
            "aircraft_type": "Q400",
            "description": "Primary Q400 maintenance kit - Abbotsford Base",
            "location_address": "1455 Aviation Way",
            "location_city": "Abbotsford",
            "location_state": "BC",
            "location_zip": "V2T 6H5",
            "location_country": "Canada",
            "latitude": 49.0253,
            "longitude": -122.3610,
            "trailer_number": "TRL-Q4-001"
        },
        {
            "name": "Q400-Kit-02",
            "aircraft_type": "Q400",
            "description": "Secondary Q400 maintenance kit - Field Operations",
            "location_city": "Red Deer",
            "location_state": "AB",
            "location_country": "Canada",
            "latitude": 52.2616,
            "longitude": -113.8116,
            "trailer_number": "TRL-Q4-002"
        },
        {
            "name": "RJ85-Kit-01",
            "aircraft_type": "RJ85",
            "description": "Primary RJ85 maintenance kit",
            "location_city": "Kamloops",
            "location_state": "BC",
            "location_country": "Canada",
            "latitude": 50.7024,
            "longitude": -120.4442,
            "trailer_number": "TRL-RJ-001"
        },
        {
            "name": "CL415-Kit-01",
            "aircraft_type": "CL415",
            "description": "CL415 water bomber maintenance kit",
            "location_city": "Penticton",
            "location_state": "BC",
            "location_country": "Canada",
            "latitude": 49.4643,
            "longitude": -119.6017,
            "trailer_number": "TRL-CL-001"
        },
    ]

    # Standard box configuration for each kit
    box_configs = [
        {"box_number": "Box1", "box_type": "expendable", "description": "Expendable consumables - rivets, fasteners, safety wire"},
        {"box_number": "Box2", "box_type": "tooling", "description": "Specialty tooling and fixtures"},
        {"box_number": "Box3", "box_type": "consumable", "description": "Chemicals, sealants, lubricants"},
        {"box_number": "Loose", "box_type": "loose", "description": "Cabinet items and loose components"},
        {"box_number": "Floor", "box_type": "floor", "description": "Large floor items - jacks, stands"},
    ]

    kits = []
    for kit_data in kits_data:
        # Get aircraft type
        ac_type = next((at for at in aircraft_types if at.name == kit_data["aircraft_type"]), None)
        if not ac_type:
            print(f"  Warning: Aircraft type '{kit_data['aircraft_type']}' not found, skipping kit.")
            continue

        existing = Kit.query.filter_by(name=kit_data["name"]).first()
        if existing:
            print(f"  Kit '{kit_data['name']}' already exists, skipping.")
            kits.append(existing)
            continue

        kit = Kit(
            name=kit_data["name"],
            aircraft_type_id=ac_type.id,
            description=kit_data["description"],
            status="active",
            created_by=admin.id,
            location_address=kit_data.get("location_address"),
            location_city=kit_data.get("location_city"),
            location_state=kit_data.get("location_state"),
            location_zip=kit_data.get("location_zip"),
            location_country=kit_data.get("location_country", "Canada"),
            latitude=kit_data.get("latitude"),
            longitude=kit_data.get("longitude"),
            trailer_number=kit_data.get("trailer_number")
        )
        db.session.add(kit)
        db.session.flush()  # Get kit ID

        # Create boxes for this kit
        for box_config in box_configs:
            box = KitBox(
                kit_id=kit.id,
                box_number=box_config["box_number"],
                box_type=box_config["box_type"],
                description=box_config["description"]
            )
            db.session.add(box)

        kits.append(kit)
        print(f"  Created kit: {kit_data['name']} with {len(box_configs)} boxes")

    db.session.commit()
    return kits


def seed_kit_expendables(kits):
    """Add expendable items to kit boxes with proper lot/serial tracking."""
    print("\n=== Seeding Kit Expendables ===")

    # Expendables for expendable boxes (Box1)
    expendable_items = [
        # Rivets - lot tracked
        {"part_number": "MS20470AD4-4", "description": 'Rivet, Universal Head, 1/8" dia x 1/4" grip', "quantity": 500, "unit": "each", "tracking_type": "lot", "category": "Rivets"},
        {"part_number": "MS20470AD4-5", "description": 'Rivet, Universal Head, 1/8" dia x 5/16" grip', "quantity": 500, "unit": "each", "tracking_type": "lot", "category": "Rivets"},
        {"part_number": "MS20470AD5-6", "description": 'Rivet, Universal Head, 5/32" dia x 3/8" grip', "quantity": 300, "unit": "each", "tracking_type": "lot", "category": "Rivets"},
        {"part_number": "NAS1097AD4-4", "description": 'Rivet, Countersunk, 1/8" dia x 1/4" grip', "quantity": 400, "unit": "each", "tracking_type": "lot", "category": "Rivets"},
        {"part_number": "CR3212-4-02", "description": 'Cherry Max Rivet, 1/8" dia', "quantity": 200, "unit": "each", "tracking_type": "lot", "category": "Rivets"},

        # Fasteners - lot tracked
        {"part_number": "AN3-5A", "description": 'Bolt, Hex Head, 10-32 x 5/16"', "quantity": 100, "unit": "each", "tracking_type": "lot", "category": "Fasteners"},
        {"part_number": "AN4-6A", "description": 'Bolt, Hex Head, 1/4-28 x 3/8"', "quantity": 100, "unit": "each", "tracking_type": "lot", "category": "Fasteners"},
        {"part_number": "AN365-428A", "description": "Nut, Self-locking, 1/4-28", "quantity": 200, "unit": "each", "tracking_type": "lot", "category": "Fasteners"},
        {"part_number": "AN960-416", "description": 'Washer, Flat, 1/4"', "quantity": 300, "unit": "each", "tracking_type": "lot", "category": "Fasteners"},

        # Safety Wire - lot tracked
        {"part_number": "MS20995C32", "description": 'Safety Wire, .032" dia, Stainless', "quantity": 10, "unit": "lb", "tracking_type": "lot", "category": "Safety Wire"},
        {"part_number": "MS20995C41", "description": 'Safety Wire, .041" dia, Stainless', "quantity": 5, "unit": "lb", "tracking_type": "lot", "category": "Safety Wire"},
    ]

    # Consumable items for consumable boxes (Box3)
    consumable_items = [
        {"part_number": "PR-1422-B2-KIT", "description": "PR-1422 Class B-2 Sealant Kit", "quantity": 6, "unit": "kit", "tracking_type": "lot", "category": "Sealant"},
        {"part_number": "RTV-108-TUBE", "description": "RTV-108 Silicone Sealant 3oz Tube", "quantity": 12, "unit": "tube", "tracking_type": "lot", "category": "Sealant"},
        {"part_number": "LOCTITE-242", "description": "Loctite 242 Threadlocker Blue", "quantity": 4, "unit": "bottle", "tracking_type": "lot", "category": "Adhesive"},
        {"part_number": "LOCTITE-271", "description": "Loctite 271 Threadlocker Red", "quantity": 4, "unit": "bottle", "tracking_type": "lot", "category": "Adhesive"},
        {"part_number": "AEROSHELL-33", "description": "AeroShell Grease 33 Universal Grease", "quantity": 6, "unit": "tube", "tracking_type": "lot", "category": "Lubricant"},
    ]

    # Tooling items for tooling boxes (Box2) - serial tracked
    tooling_items = [
        {"part_number": "JIG-Q4-FLAP", "description": "Q400 Flap Hinge Alignment Jig", "quantity": 1, "unit": "each", "tracking_type": "serial", "category": "Jigs"},
        {"part_number": "JIG-Q4-DOOR", "description": "Q400 Door Seal Installation Jig", "quantity": 1, "unit": "each", "tracking_type": "serial", "category": "Jigs"},
        {"part_number": "FIXTURE-WING", "description": "Wing Skin Repair Fixture", "quantity": 1, "unit": "each", "tracking_type": "serial", "category": "Fixtures"},
        {"part_number": "GAUGE-RIVET", "description": "Rivet Height Gauge Set", "quantity": 1, "unit": "set", "tracking_type": "serial", "category": "Gauges"},
        {"part_number": "TEMPLATE-PATCH", "description": "Standard Patch Template Set", "quantity": 1, "unit": "set", "tracking_type": "serial", "category": "Templates"},
    ]

    # Large floor items (Floor box) - serial tracked
    floor_items = [
        {"part_number": "JACK-AXLE-5T", "description": "5-Ton Axle Jack", "quantity": 1, "unit": "each", "tracking_type": "serial", "category": "GSE"},
        {"part_number": "STAND-TAIL-Q4", "description": "Q400 Tail Stand", "quantity": 1, "unit": "each", "tracking_type": "serial", "category": "GSE"},
        {"part_number": "LADDER-WING", "description": "Wing Access Platform Ladder", "quantity": 1, "unit": "each", "tracking_type": "serial", "category": "GSE"},
        {"part_number": "TOOLBOX-MOBILE", "description": 'Mobile Tool Chest - 52"', "quantity": 1, "unit": "each", "tracking_type": "serial", "category": "Storage"},
        {"part_number": "COMPRESSOR-PORT", "description": "Portable Air Compressor", "quantity": 1, "unit": "each", "tracking_type": "serial", "category": "Equipment"},
    ]

    serial_counter = 1

    for kit in kits:
        print(f"\n  Populating kit: {kit.name}")

        # Get boxes for this kit
        boxes = {box.box_type: box for box in kit.boxes.all()}

        # Add expendables to Box1
        if "expendable" in boxes:
            box = boxes["expendable"]
            for item_data in expendable_items:
                lot_number = generate_lot_number("EXP")
                exp = KitExpendable(
                    kit_id=kit.id,
                    box_id=box.id,
                    part_number=item_data["part_number"],
                    lot_number=lot_number,
                    tracking_type="lot",
                    description=item_data["description"],
                    quantity=item_data["quantity"],
                    unit=item_data["unit"],
                    status="available",
                    minimum_stock_level=item_data["quantity"] // 5
                )
                db.session.add(exp)
            print(f"    Added {len(expendable_items)} expendable items to {box.box_number}")

        # Add consumables to Box3
        if "consumable" in boxes:
            box = boxes["consumable"]
            for item_data in consumable_items:
                lot_number = generate_lot_number("CON")
                exp = KitExpendable(
                    kit_id=kit.id,
                    box_id=box.id,
                    part_number=item_data["part_number"],
                    lot_number=lot_number,
                    tracking_type="lot",
                    description=item_data["description"],
                    quantity=item_data["quantity"],
                    unit=item_data["unit"],
                    status="available",
                    minimum_stock_level=max(1, item_data["quantity"] // 4)
                )
                db.session.add(exp)
            print(f"    Added {len(consumable_items)} consumable items to {box.box_number}")

        # Add tooling to Box2
        if "tooling" in boxes:
            box = boxes["tooling"]
            for item_data in tooling_items:
                serial_number = f"SN-{kit.name}-{serial_counter:04d}"
                serial_counter += 1
                exp = KitExpendable(
                    kit_id=kit.id,
                    box_id=box.id,
                    part_number=item_data["part_number"],
                    serial_number=serial_number,
                    tracking_type="serial",
                    description=item_data["description"],
                    quantity=item_data["quantity"],
                    unit=item_data["unit"],
                    status="available"
                )
                db.session.add(exp)
            print(f"    Added {len(tooling_items)} tooling items to {box.box_number}")

        # Add floor items
        if "floor" in boxes:
            box = boxes["floor"]
            for item_data in floor_items:
                serial_number = f"SN-{kit.name}-{serial_counter:04d}"
                serial_counter += 1
                exp = KitExpendable(
                    kit_id=kit.id,
                    box_id=box.id,
                    part_number=item_data["part_number"],
                    serial_number=serial_number,
                    tracking_type="serial",
                    description=item_data["description"],
                    quantity=item_data["quantity"],
                    unit=item_data["unit"],
                    status="available"
                )
                db.session.add(exp)
            print(f"    Added {len(floor_items)} floor items to {box.box_number}")

    db.session.commit()


def seed_database():
    """Main function to seed all data."""
    with app.app_context():
        print("=" * 60)
        print("SupplyLine MRO Suite - Comprehensive Database Seeding")
        print("=" * 60)

        # Get or create admin user
        admin = get_or_create_admin()
        print(f"\nUsing admin user: {admin.name} ({admin.employee_number})")

        # Seed data in order of dependencies
        warehouses = seed_warehouses()
        aircraft_types = seed_aircraft_types()
        seed_tools(warehouses)
        seed_chemicals(warehouses)
        kits = seed_kits(aircraft_types, admin)
        seed_kit_expendables(kits)

        # Summary
        print("\n" + "=" * 60)
        print("SEEDING COMPLETE - Summary")
        print("=" * 60)
        print(f"  Warehouses:     {Warehouse.query.count()}")
        print(f"  Aircraft Types: {AircraftType.query.count()}")
        print(f"  Tools:          {Tool.query.count()}")
        print(f"  Chemicals:      {Chemical.query.count()}")
        print(f"  Kits:           {Kit.query.count()}")
        print(f"  Kit Boxes:      {KitBox.query.count()}")
        print(f"  Kit Expendables:{KitExpendable.query.count()}")
        print("=" * 60)


if __name__ == "__main__":
    seed_database()
    print("\nDatabase seeded successfully!")
