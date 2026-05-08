"""
Migration to add oncall_schedules table for scheduling on-call assignments.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models import OnCallSchedule, db


def migrate():
    app = create_app()
    with app.app_context():
        print("Creating oncall_schedules table...")
        db.create_all()
        count = OnCallSchedule.query.count()
        print(f"Migration complete. Existing schedule rows: {count}")


if __name__ == "__main__":
    migrate()
