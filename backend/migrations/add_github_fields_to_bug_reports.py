"""Migration: Add github_issue_number and github_issue_url to bug_reports table.

Works with both SQLite (development) and PostgreSQL/Supabase (production).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text

from app import create_app
from models import db


def migrate():
    app = create_app()

    with app.app_context():
        inspector = inspect(db.engine)
        existing_cols = {col["name"] for col in inspector.get_columns("bug_reports")}

        added = []

        if "github_issue_number" not in existing_cols:
            db.session.execute(
                text("ALTER TABLE bug_reports ADD COLUMN github_issue_number INTEGER")
            )
            added.append("github_issue_number")

        if "github_issue_url" not in existing_cols:
            db.session.execute(
                text("ALTER TABLE bug_reports ADD COLUMN github_issue_url VARCHAR(500)")
            )
            added.append("github_issue_url")

        if added:
            db.session.commit()
            print(f"Added columns to bug_reports: {', '.join(added)}")
        else:
            print("Columns already exist, nothing to do.")

        print("Migration complete.")


if __name__ == "__main__":
    migrate()
