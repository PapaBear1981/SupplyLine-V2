"""
Migration script to add user_permissions table for per-user permission grants/denies.
This allows administrators to grant or deny specific permissions to individual users,
overriding their role-based permissions.
"""
import os
import sqlite3
import sys


def run_migration():
    # Get the database path from DATABASE_URL environment variable or use default
    database_url = os.environ.get("DATABASE_URL", "sqlite:///database/tools.db")

    # Extract the path from the SQLite URL
    if database_url.startswith("sqlite:///"):
        db_path = database_url.replace("sqlite:///", "")
        # If it's a relative path, resolve it relative to the repository root
        if not os.path.isabs(db_path):
            repo_root = os.path.dirname(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            )
            db_path = os.path.join(repo_root, db_path)
    else:
        # Fallback to default path
        db_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "database",
            "tools.db",
        )

    print(f"Using database at: {db_path}")

    try:
        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if user_permissions table already exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='user_permissions'"
        )
        if cursor.fetchone():
            print("user_permissions table already exists, skipping creation")
        else:
            # Create user_permissions table
            cursor.execute(
                """
                CREATE TABLE user_permissions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    permission_id INTEGER NOT NULL,
                    grant_type TEXT NOT NULL CHECK(grant_type IN ('grant', 'deny')),
                    granted_by INTEGER NOT NULL,
                    reason TEXT,
                    expires_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
                    FOREIGN KEY (granted_by) REFERENCES users(id),
                    UNIQUE(user_id, permission_id)
                )
            """
            )
            print("Created user_permissions table")

            # Create indexes for faster lookups
            cursor.execute(
                """
                CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id)
            """
            )
            cursor.execute(
                """
                CREATE INDEX idx_user_permissions_permission_id ON user_permissions(permission_id)
            """
            )
            cursor.execute(
                """
                CREATE INDEX idx_user_permissions_grant_type ON user_permissions(grant_type)
            """
            )
            cursor.execute(
                """
                CREATE INDEX idx_user_permissions_expires_at ON user_permissions(expires_at)
            """
            )
            print("Created indexes on user_permissions table")

        # Commit the changes
        conn.commit()
        print("Schema changes committed successfully")

        # Close the connection
        conn.close()
        print("Database update completed successfully")
        return True
    except Exception as e:
        print(f"Error during migration: {e!s}")
        return False


if __name__ == "__main__":
    success = run_migration()
    if not success:
        sys.exit(1)
