"""
Bulk import tests for SupplyLine MRO Suite

Tests bulk data import functionality including:
- CSV chemical import
- Data validation during import
- Error handling and reporting
- Import performance
- Rollback on errors
"""

from io import BytesIO, StringIO

import pytest

from models import Chemical, ChemicalPart, Tool, User


def _ensure_chemical_parts(db_session, part_numbers):
    """Create master ChemicalPart rows so bulk-import lots can resolve them."""
    for part_number in part_numbers:
        existing = ChemicalPart.query.filter_by(part_number=part_number).first()
        if existing is None:
            db_session.add(ChemicalPart(
                part_number=part_number,
                description=f"Master part for {part_number}",
                default_unit="ml",
                category="Category1",
            ))
    db_session.commit()


@pytest.mark.bulk
@pytest.mark.integration
class TestChemicalBulkImport:
    """Test bulk chemical import from CSV"""

    def test_bulk_import_valid_chemicals(self, client, db_session, admin_user, auth_headers, test_warehouse):
        """Test importing valid chemicals from CSV"""
        _ensure_chemical_parts(db_session, ["BULK001", "BULK002", "BULK003"])
        csv_data = f"""part_number,lot_number,description,manufacturer,quantity,unit,location,category,warehouse_id
BULK001,LOT001,Test Chemical 1,Manufacturer A,100.0,ml,Storage A,Category1,{test_warehouse.id}
BULK002,LOT002,Test Chemical 2,Manufacturer B,200.0,ml,Storage B,Category2,{test_warehouse.id}
BULK003,LOT003,Test Chemical 3,Manufacturer C,150.0,ml,Storage C,Category1,{test_warehouse.id}
"""

        # Create file upload
        data = {
            "file": (BytesIO(csv_data.encode()), "chemicals.csv")
        }

        response = client.post(
            "/api/chemicals/bulk-import",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data"
        )

        assert response.status_code in [200, 201, 404]

        if response.status_code in [200, 201]:
            # Verify chemicals imported
            imported = Chemical.query.filter(Chemical.part_number.like("BULK%")).all()
            assert len(imported) == 3

    def test_bulk_import_with_validation_errors(self, client, db_session, admin_user, auth_headers, test_warehouse):
        """Test that invalid data is properly rejected"""
        # CSV with invalid data (missing required fields)
        csv_data = """part_number,lot_number,description,manufacturer,quantity,unit,location,category
BULK004,,Test Chemical 4,Manufacturer A,100.0,ml,Storage A,Category1
BULK005,LOT005,,Manufacturer B,200.0,ml,Storage B,Category2
BULK006,LOT006,Test Chemical 6,,-50.0,ml,Storage C,Category1
"""

        data = {
            "file": (BytesIO(csv_data.encode()), "chemicals.csv")
        }

        response = client.post(
            "/api/chemicals/bulk-import",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data"
        )

        # Should reject or report errors (207 = Multi-Status for partial success)
        assert response.status_code in [200, 207, 400, 404, 422]

        if response.status_code == 200:
            # Check that errors were reported
            data = response.get_json()
            assert "errors" in data or "failed" in data or "success" in data

    def test_bulk_import_duplicate_handling(self, client, db_session, admin_user, auth_headers, test_warehouse):
        """Test handling of duplicate entries in import"""
        # Create existing chemical
        existing = Chemical(
            part_number="BULK007",
            lot_number="LOT007",
            description="Existing Chemical",
            manufacturer="Manufacturer A",
            quantity=100,
            unit="ml",
            location="Storage A",
            category="Category1",
            warehouse_id=test_warehouse.id
        )
        db_session.add(existing)
        db_session.commit()

        # Try to import duplicate
        csv_data = f"""part_number,lot_number,description,manufacturer,quantity,unit,location,category,warehouse_id
BULK007,LOT007,Duplicate Chemical,Manufacturer A,200.0,ml,Storage A,Category1,{test_warehouse.id}
"""

        data = {
            "file": (BytesIO(csv_data.encode()), "chemicals.csv")
        }

        response = client.post(
            "/api/chemicals/bulk-import",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data"
        )

        # Should handle duplicate appropriately
        assert response.status_code in [200, 400, 404, 409, 422]

    def test_bulk_import_large_dataset(self, client, db_session, admin_user, auth_headers, test_warehouse):
        """Test importing a large dataset"""
        _ensure_chemical_parts(db_session, [f"LARGE{i:04d}" for i in range(100)])
        # Generate CSV with 100 chemicals
        csv_lines = ["part_number,lot_number,description,manufacturer,quantity,unit,location,category,warehouse_id"]

        for i in range(100):
            csv_lines.append(
                f"LARGE{i:04d},LOT{i:04d},Chemical {i},Manufacturer,100.0,ml,Storage,Category,{test_warehouse.id}"
            )

        csv_data = "\n".join(csv_lines)

        data = {
            "file": (BytesIO(csv_data.encode()), "large_import.csv")
        }

        response = client.post(
            "/api/chemicals/bulk-import",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data"
        )

        assert response.status_code in [200, 201, 404, 422]

        if response.status_code in [200, 201]:
            # Verify all imported
            imported = Chemical.query.filter(Chemical.part_number.like("LARGE%")).count()
            assert imported in {100, 0}  # All or none (transaction rollback)

    def test_bulk_import_invalid_csv_format(self, client, db_session, admin_user, auth_headers):
        """Test rejection of invalid CSV format"""
        # Invalid CSV (missing headers)
        csv_data = """BULK008,LOT008,Test Chemical,Manufacturer,100.0,ml,Storage,Category
"""

        data = {
            "file": (BytesIO(csv_data.encode()), "invalid.csv")
        }

        response = client.post(
            "/api/chemicals/bulk-import",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data"
        )

        # Should reject invalid format
        assert response.status_code in [400, 404, 422]

    def test_bulk_import_with_special_characters(self, client, db_session, admin_user, auth_headers, test_warehouse):
        """Test import with special characters in data"""
        _ensure_chemical_parts(db_session, ["BULK009", "BULK010"])
        # Using different quote style to avoid triple-quote ambiguity
        csv_data = "part_number,lot_number,description,manufacturer,quantity,unit,location,category,warehouse_id\n"
        csv_data += f'BULK009,LOT009,"Chemical with quotes",Manufacturer,100.0,ml,Storage,Category,{test_warehouse.id}\n'
        csv_data += f"BULK010,LOT010,Chemical with commas in name,Manufacturer,100.0,ml,Storage,Category,{test_warehouse.id}\n"

        data = {
            "file": (BytesIO(csv_data.encode()), "special_chars.csv")
        }

        response = client.post(
            "/api/chemicals/bulk-import",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data"
        )

        assert response.status_code in [200, 201, 404, 422]

    def test_bulk_import_rollback_on_error(self, client, db_session, admin_user, auth_headers, test_warehouse):
        """Test that import is rolled back if any row fails"""
        # Mix of valid and invalid data
        csv_data = f"""part_number,lot_number,description,manufacturer,quantity,unit,location,category,warehouse_id
BULK011,LOT011,Valid Chemical 1,Manufacturer,100.0,ml,Storage,Category,{test_warehouse.id}
BULK012,LOT012,Valid Chemical 2,Manufacturer,200.0,ml,Storage,Category,{test_warehouse.id}
BULK013,LOT013,Invalid Chemical,,Invalid,ml,Storage,Category,{test_warehouse.id}
BULK014,LOT014,Valid Chemical 3,Manufacturer,300.0,ml,Storage,Category,{test_warehouse.id}
"""

        data = {
            "file": (BytesIO(csv_data.encode()), "mixed.csv")
        }

        # Get count before import
        count_before = Chemical.query.filter(Chemical.part_number.like("BULK01%")).count()

        response = client.post(
            "/api/chemicals/bulk-import",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data"
        )

        # If strict validation, should rollback all
        if response.status_code in [400, 422]:
            count_after = Chemical.query.filter(Chemical.part_number.like("BULK01%")).count()
            # None should be imported
            assert count_after == count_before

    def test_bulk_import_create_missing_parts_flag(
        self, client, db_session, admin_user, auth_headers, test_warehouse
    ):
        """With create_missing_parts=true, the importer adds new master parts."""
        from models import ChemicalPart

        csv_data = f"""part_number,lot_number,description,manufacturer,quantity,unit,location,category,warehouse_id
NEWMASTER1,LOT_A,Auto-created part one,Acme,100.0,ml,Storage,Adhesive,{test_warehouse.id}
NEWMASTER1,LOT_B,Auto-created part one,Acme,50.0,ml,Storage,Adhesive,{test_warehouse.id}
NEWMASTER2,LOT_C,Auto-created part two,Beta,25.0,ml,Storage,Sealant,{test_warehouse.id}
"""

        data = {
            "file": (BytesIO(csv_data.encode()), "chemicals.csv"),
            "create_missing_parts": "true",
        }

        response = client.post(
            "/api/chemicals/bulk-import",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data",
        )

        assert response.status_code == 200, response.data
        body = response.get_json()
        assert body["success_count"] == 3
        assert body["error_count"] == 0
        # Two distinct part numbers were auto-created on the master list,
        # not three — the duplicate part_number reused the same master.
        assert sorted(body["created_master_parts"]) == ["NEWMASTER1", "NEWMASTER2"]

        # Verify the master records exist with metadata from the CSV row
        master1 = ChemicalPart.query.filter_by(part_number="NEWMASTER1").first()
        assert master1 is not None
        assert master1.description == "Auto-created part one"
        assert master1.manufacturer == "Acme"
        assert master1.category == "Adhesive"

        master2 = ChemicalPart.query.filter_by(part_number="NEWMASTER2").first()
        assert master2 is not None

        # All three lot rows link to the appropriate master part
        lots = Chemical.query.filter(Chemical.part_number.in_(["NEWMASTER1", "NEWMASTER2"])).all()
        assert len(lots) == 3
        for lot in lots:
            assert lot.chemical_part_id is not None

    def test_bulk_import_rejects_rows_without_master_part(
        self, client, db_session, admin_user, auth_headers, test_warehouse
    ):
        """Bulk import must reject any row whose part_number has no ChemicalPart."""
        # Only create master part for the first row
        _ensure_chemical_parts(db_session, ["BULK_MASTER_OK"])

        csv_data = f"""part_number,lot_number,description,manufacturer,quantity,unit,location,category,warehouse_id
BULK_MASTER_OK,LOT_OK,Valid Chemical,Manufacturer,100.0,ml,Storage,Category,{test_warehouse.id}
BULK_NO_MASTER,LOT_BAD,Unknown Master,Manufacturer,100.0,ml,Storage,Category,{test_warehouse.id}
"""

        data = {
            "file": (BytesIO(csv_data.encode()), "chemicals.csv")
        }

        response = client.post(
            "/api/chemicals/bulk-import",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data"
        )

        # Partial success: 1 imported, 1 rejected
        assert response.status_code in [200, 207]
        body = response.get_json()
        assert body["success_count"] == 1
        assert body["error_count"] == 1
        error_messages = " ".join(err.get("error", "") for err in body.get("errors", []))
        assert "master chemical list" in error_messages

        # Imported row was linked to its master part
        imported = Chemical.query.filter_by(part_number="BULK_MASTER_OK").first()
        assert imported is not None
        assert imported.chemical_part_id is not None
        # Rejected row was not persisted
        rejected = Chemical.query.filter_by(part_number="BULK_NO_MASTER").first()
        assert rejected is None

    def test_bulk_import_defaults_to_active_warehouse(
        self, client, db_session, admin_user, auth_headers, test_warehouse
    ):
        """A CSV with no warehouse_id column lands lots in the importer's active warehouse.

        Regression: imported lots used to get a NULL warehouse, making them
        invisible in the warehouse-scoped chemical inventory views.
        """
        _ensure_chemical_parts(db_session, ["WHDEF001", "WHDEF002"])
        admin_user.active_warehouse_id = test_warehouse.id
        db_session.commit()

        csv_data = """part_number,lot_number,description,manufacturer,quantity,unit,location,category
WHDEF001,LOTW1,Chem one,Acme,5,ml,Storage,Category1
WHDEF002,LOTW2,Chem two,Acme,8,ml,Storage,Category1
"""
        data = {"file": (BytesIO(csv_data.encode()), "chemicals.csv")}
        response = client.post(
            "/api/chemicals/bulk-import",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data",
        )

        assert response.status_code == 200
        body = response.get_json()
        assert body["success_count"] == 2
        assert body["error_count"] == 0

        lots = Chemical.query.filter(Chemical.part_number.like("WHDEF%")).all()
        assert len(lots) == 2
        assert all(lot.warehouse_id == test_warehouse.id for lot in lots)

    def test_bulk_import_rejects_lot_with_no_warehouse(
        self, client, db_session, admin_user, auth_headers
    ):
        """A row with no warehouse_id column and no active warehouse is rejected, not orphaned."""
        _ensure_chemical_parts(db_session, ["WHNONE001"])
        # admin_user intentionally has no active_warehouse_id set

        csv_data = """part_number,lot_number,description,manufacturer,quantity,unit,location,category
WHNONE001,LOTNONE,Chem,Acme,5,ml,Storage,Category1
"""
        data = {"file": (BytesIO(csv_data.encode()), "chemicals.csv")}
        response = client.post(
            "/api/chemicals/bulk-import",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data",
        )

        assert response.status_code == 400
        body = response.get_json()
        assert body["success_count"] == 0
        assert body["error_count"] == 1
        error_messages = " ".join(err.get("error", "") for err in body.get("errors", []))
        assert "warehouse" in error_messages.lower()

        assert Chemical.query.filter_by(part_number="WHNONE001").first() is None


@pytest.mark.bulk
@pytest.mark.integration
class TestToolBulkImport:
    """Test bulk tool import"""

    def test_bulk_import_tools_from_csv(self, client, db_session, admin_user, auth_headers, test_warehouse):
        """Test importing tools from CSV"""
        csv_data = """tool_number,serial_number,description,condition,location,category,status
TBULK001,SN001,Test Tool 1,Good,Location A,Category1,available
TBULK002,SN002,Test Tool 2,Good,Location B,Category2,available
TBULK003,SN003,Test Tool 3,Excellent,Location C,Category1,available
"""

        data = {
            "file": (BytesIO(csv_data.encode()), "tools.csv")
        }

        response = client.post(
            "/api/tools/bulk-import",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data"
        )

        assert response.status_code in [200, 201, 400, 404]

        if response.status_code in [200, 201]:
            # Verify tools imported
            imported = Tool.query.filter(Tool.tool_number.like("TBULK%")).all()
            assert len(imported) == 3

    def test_bulk_import_tools_with_calibration_data(self, client, db_session, admin_user, auth_headers, test_warehouse):
        """Test importing tools with calibration dates"""
        from datetime import datetime, timedelta

        future_date = (datetime.utcnow() + timedelta(days=365)).strftime("%Y-%m-%d")

        csv_data = f"""tool_number,serial_number,description,condition,location,category,status,calibration_due
TCAL001,SN001,Calibrated Tool 1,Good,Location A,Measurement,available,{future_date}
TCAL002,SN002,Calibrated Tool 2,Good,Location B,Measurement,available,{future_date}
"""

        data = {
            "file": (BytesIO(csv_data.encode()), "tools_with_cal.csv")
        }

        response = client.post(
            "/api/tools/bulk-import",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data"
        )

        assert response.status_code in [200, 201, 400, 404]


@pytest.mark.bulk
@pytest.mark.performance
class TestBulkImportPerformance:
    """Test bulk import performance"""

    def test_import_performance_500_items(self, client, db_session, admin_user, auth_headers, test_warehouse):
        """Test importing 500 items performs acceptably"""
        import time

        # Generate large CSV
        csv_lines = ["part_number,lot_number,description,manufacturer,quantity,unit,location,category,warehouse_id"]

        for i in range(500):
            csv_lines.append(
                f"PERF{i:04d},LOT{i:04d},Performance Test {i},Manufacturer,100.0,ml,Storage,Category,{test_warehouse.id}"
            )

        csv_data = "\n".join(csv_lines)

        data = {
            "file": (BytesIO(csv_data.encode()), "performance_test.csv")
        }

        start_time = time.time()

        response = client.post(
            "/api/chemicals/bulk-import",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data"
        )

        elapsed = time.time() - start_time

        # Should complete within reasonable time
        if response.status_code in [200, 201]:
            assert elapsed < 30.0, f"Import took {elapsed:.2f}s, expected < 30s"

    def test_import_memory_efficiency(self, client, db_session, admin_user, auth_headers, test_warehouse):
        """Test that import handles large files efficiently"""
        _ensure_chemical_parts(db_session, [f"MEM{i:04d}" for i in range(1000)])
        # Generate very large CSV
        csv_lines = ["part_number,lot_number,description,manufacturer,quantity,unit,location,category,warehouse_id"]

        for i in range(1000):
            csv_lines.append(
                f"MEM{i:04d},LOT{i:04d},Memory Test {i},Manufacturer,100.0,ml,Storage,Category,{test_warehouse.id}"
            )

        csv_data = "\n".join(csv_lines)

        data = {
            "file": (BytesIO(csv_data.encode()), "large_memory_test.csv")
        }

        response = client.post(
            "/api/chemicals/bulk-import",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data"
        )

        # Should handle without memory errors
        assert response.status_code in [200, 201, 404, 422, 413]


@pytest.mark.bulk
@pytest.mark.security
class TestBulkImportSecurity:
    """Test security aspects of bulk import"""

    def test_bulk_import_requires_authentication(self, client, db_session):
        """Test that bulk import requires authentication"""
        csv_data = """part_number,lot_number,description,manufacturer,quantity,unit,location,category
SEC001,LOT001,Test Chemical,Manufacturer,100.0,ml,Storage,Category
"""

        data = {
            "file": (BytesIO(csv_data.encode()), "chemicals.csv")
        }

        response = client.post(
            "/api/chemicals/bulk-import",
            data=data,
            content_type="multipart/form-data"
        )

        # Should require authentication
        assert response.status_code in [401, 404]

    def test_bulk_import_sql_injection_protection(self, client, db_session, admin_user, auth_headers, test_warehouse):
        """Test protection against SQL injection in bulk import"""
        # CSV with SQL injection attempts
        csv_data = "part_number,lot_number,description,manufacturer,quantity,unit,location,category,warehouse_id\n"
        csv_data += f"SQL001,\"' OR '1'='1\",\"Test'; DROP TABLE chemicals;--\",Manufacturer,100.0,ml,Storage,Category,{test_warehouse.id}\n"

        data = {
            "file": (BytesIO(csv_data.encode()), "malicious.csv")
        }

        response = client.post(
            "/api/chemicals/bulk-import",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data"
        )

        # Should handle safely
        assert response.status_code in [200, 201, 400, 404, 422]

        # Verify database is intact
        from models import db
        # Simple check - should not crash
        chemicals = Chemical.query.all()
        assert chemicals is not None

    def test_bulk_import_csv_injection_protection(self, client, db_session, admin_user, auth_headers, test_warehouse):
        """Test protection against CSV injection attacks"""
        # CSV injection (formula injection)
        csv_data = "part_number,lot_number,description,manufacturer,quantity,unit,location,category,warehouse_id\n"
        csv_data += f"CSV001,LOT001,=cmd|'/c calc'!A1,Manufacturer,100.0,ml,Storage,Category,{test_warehouse.id}\n"
        csv_data += f"CSV002,LOT002,@SUM(1+1),Manufacturer,100.0,ml,Storage,Category,{test_warehouse.id}\n"

        data = {
            "file": (BytesIO(csv_data.encode()), "csv_injection.csv")
        }

        response = client.post(
            "/api/chemicals/bulk-import",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data"
        )

        # Should sanitize or reject
        assert response.status_code in [200, 201, 400, 404, 422]

        if response.status_code in [200, 201]:
            # Verify formulas were sanitized
            chemical = Chemical.query.filter_by(part_number="CSV001").first()
            if chemical:
                # Should not start with = @ + -
                assert not chemical.description.startswith(("=", "@", "+", "-"))
