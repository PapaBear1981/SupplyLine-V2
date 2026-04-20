import atexit
import datetime
import logging.config
import os
import time

from flask import Flask
from flask_cors import CORS
from sqlalchemy import inspect as sa_inspect
from sqlalchemy import text as sa_text

from config import Config
from models import db
from routes import register_routes
from socketio_config import init_socketio
from utils.logging_utils import setup_request_logging
from utils.resource_monitor import init_resource_monitoring
from utils.scheduled_backup import init_scheduled_backup, shutdown_scheduled_backup
from utils.scheduled_maintenance import init_scheduled_maintenance, shutdown_scheduled_maintenance


def create_app():
    # Set the system timezone to UTC
    os.environ["TZ"] = "UTC"
    try:
        time.tzset()
        print("System timezone set to UTC")  # Keep this as print since logging not yet configured
    except AttributeError:
        # Windows doesn't have time.tzset()
        print("Running on Windows, cannot set system timezone. Ensure system time is correct.")

    # serve frontend static files from backend/static
    app = Flask(
        __name__,
        instance_relative_config=False,
        static_folder="static",
        static_url_path="/static"
    )
    app.config.from_object(Config)

    # File upload safeguards
    app.config.setdefault("MAX_AVATAR_FILE_SIZE", 5 * 1024 * 1024)  # 5MB
    app.config.setdefault("MAX_BULK_IMPORT_FILE_SIZE", 5 * 1024 * 1024)
    app.config.setdefault("MAX_CALIBRATION_CERTIFICATE_FILE_SIZE", 5 * 1024 * 1024)
    app.config.setdefault(
        "CALIBRATION_CERTIFICATE_FOLDER",
        os.path.join(app.instance_path, "calibration_certificates")
    )
    os.makedirs(app.config["CALIBRATION_CERTIFICATE_FOLDER"], exist_ok=True)

    # Ensure session storage is configured with a supported backend
    session_type = app.config.get("SESSION_TYPE")
    if not session_type or session_type.lower() == "null":
        app.config["SESSION_TYPE"] = "filesystem"

    if app.config["SESSION_TYPE"] == "filesystem":
        session_dir = app.config.get("SESSION_FILE_DIR") or os.path.join(app.instance_path, "flask_session")
        os.makedirs(session_dir, exist_ok=True)
        app.config["SESSION_FILE_DIR"] = session_dir

    # Allow runtime overrides of the database URL (useful for tests)
    runtime_db_url = os.environ.get("DATABASE_URL")
    if runtime_db_url:
        app.config["SQLALCHEMY_DATABASE_URI"] = runtime_db_url

    # Normalize engine options when using SQLite (particularly in tests)
    db_uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if db_uri.startswith("sqlite"):
        app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
            "echo": False,
            "pool_pre_ping": True,
            "connect_args": {"check_same_thread": False},
        }

    # Determine if we're running in a testing environment
    is_testing_env = bool(
        app.config.get("TESTING")
        or os.environ.get("FLASK_ENV") == "testing"
        or os.environ.get("PYTEST_CURRENT_TEST")
    )
    if is_testing_env:
        app.config["TESTING"] = True

    # Validate security configuration (deferred to allow test fixtures to set values)
    Config.validate_security_config(app.config)

    # Configure structured logging
    if hasattr(Config, "LOGGING_CONFIG"):
        try:
            logging.config.dictConfig(Config.LOGGING_CONFIG)
            logging.getLogger(__name__).info("Structured logging configured successfully")
        except Exception as e:
            logging.getLogger(__name__).warning("Error configuring logging: %s", e)
            # Fall back to basic logging
            logging.basicConfig(level=logging.INFO)

    # Initialize CORS with settings from config
    allowed_origins = app.config.get("CORS_ORIGINS", ["http://localhost:5173"])
    allow_headers = app.config.get("CORS_ALLOW_HEADERS", [
        "Content-Type",
        "Authorization",
        "X-CSRF-Token",
    ])
    supports_credentials = app.config.get("CORS_SUPPORTS_CREDENTIALS", False)
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": allowed_origins,
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": allow_headers,
                "supports_credentials": supports_credentials,
            },
            r"/tool-view/*": {
                "origins": allowed_origins,
                "methods": ["GET", "OPTIONS"],
                "allow_headers": allow_headers,
                "supports_credentials": supports_credentials,
            },
            r"/chemical-view/*": {
                "origins": allowed_origins,
                "methods": ["GET", "OPTIONS"],
                "allow_headers": allow_headers,
                "supports_credentials": supports_credentials,
            }
        },
    )

    # Short-circuit CORS preflight requests so they never touch any
    # auth decorators (jwt_required, admin_required, csrf_required, etc).
    # Attach the CORS headers directly here — in some cases Flask-CORS's
    # after_request hook does not decorate responses that originate from
    # before_request, which was causing browsers to reject the preflight.
    from flask import make_response as _make_response
    from flask import request as _flask_request

    _ALLOWED_CORS_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    _ALLOWED_CORS_HEADERS = ", ".join(
        app.config.get("CORS_ALLOW_HEADERS", [
            "Content-Type", "Authorization", "X-CSRF-Token",
        ])
    )

    @app.before_request
    def _cors_preflight_bypass():
        if _flask_request.method != "OPTIONS":
            return None
        origin = _flask_request.headers.get("Origin", "")
        allowed = app.config.get("CORS_ORIGINS", [])
        resp = _make_response("", 204)
        if origin and origin in allowed:
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Vary"] = "Origin"
            resp.headers["Access-Control-Allow-Credentials"] = "true"
            resp.headers["Access-Control-Allow-Methods"] = _ALLOWED_CORS_METHODS
            # Echo the requested headers when present; otherwise use the
            # configured allow-list. Safer than hardcoding.
            requested_headers = _flask_request.headers.get(
                "Access-Control-Request-Headers", _ALLOWED_CORS_HEADERS
            )
            resp.headers["Access-Control-Allow-Headers"] = requested_headers
            resp.headers["Access-Control-Max-Age"] = "3600"
        return resp

    # Belt-and-suspenders: ensure every response to an API request from
    # an allowed origin carries the CORS headers, even if the view raised
    # and Flask's default error handler built the response (Flask-CORS's
    # own after_request can miss these).
    @app.after_request
    def _cors_response_headers(response):
        origin = _flask_request.headers.get("Origin", "")
        if not origin:
            return response
        allowed = app.config.get("CORS_ORIGINS", [])
        if origin not in allowed:
            return response
        # Only decorate if not already set (avoid double-setting when
        # Flask-CORS has already handled the response cleanly).
        if "Access-Control-Allow-Origin" not in response.headers:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            # Merge Vary header without clobbering existing values.
            vary = response.headers.get("Vary", "")
            if "Origin" not in vary:
                response.headers["Vary"] = f"{vary}, Origin".strip(", ") if vary else "Origin"
        return response

    # Ensure session storage is configured (default to secure filesystem storage)
    session_type = app.config.get("SESSION_TYPE")
    if not session_type or str(session_type).lower() in {"none", "null", ""}:
        app.config["SESSION_TYPE"] = "filesystem"

    # Initialize Flask-Session - DISABLED due to Flask 3.x compatibility issues
    # The application uses JWT authentication, so Flask-Session is not needed
    # Session(app)

    # Initialize session cleanup - DISABLED since Flask-Session is disabled
    # init_session_cleanup(app)

    # Initialize resource monitoring
    init_resource_monitoring(app)

    # Setup request logging middleware
    setup_request_logging(app)

    # Initialize database with app
    db.init_app(app)

    # Initialize SocketIO for real-time messaging
    init_socketio(app)

    # Register WebSocket event handlers
    from socketio_events import register_socketio_events
    register_socketio_events(app)

    # Get logger after logging is configured
    logger = logging.getLogger(__name__)

    # Load persisted security settings (e.g., inactivity timeout)
    try:
        from utils.system_settings import load_security_settings

        timeout_minutes = load_security_settings(app)
        logger.info(
            "Loaded security settings",
            extra={"session_timeout_minutes": timeout_minutes},
        )
    except Exception as exc:
        logger.error(
            "Failed to load security settings",
            exc_info=True,
            extra={"error_message": str(exc)},
        )

    # Log current time information for debugging
    logger.info("Application starting", extra={
        "utc_time": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "local_time": datetime.datetime.now().isoformat()
    })

    # Database migrations have been applied and are managed through the migrations/ directory
    # No inline migrations needed at startup

    # Setup global error handlers
    from utils.error_handler import setup_global_error_handlers
    setup_global_error_handlers(app)

    # Create database tables (after all setup is complete)
    if not is_testing_env:
        try:
            logger.info("Creating database tables...")
            with app.app_context():
                db.create_all()
            logger.info("Database tables created successfully")
        except Exception as e:
            logger.error("Error creating database tables", exc_info=True, extra={
                "error_message": str(e)
            })
            raise

        # Auto-apply Phase 2 schema migrations (additive column additions).
        # Inspector-based checks make this idempotent and safe on every startup.
        # db.engine.connect() uses SQLAlchemy Core — works on both SQLite and
        # PostgreSQL, unlike raw_connection() which is DBAPI-driver-specific.
        try:
            with app.app_context():
                inspector = sa_inspect(db.engine)
                tables = set(inspector.get_table_names())

                with db.engine.connect() as _conn:
                    def _auto_add_col(table, col_sql, col_name, existing_cols):
                        if col_name not in existing_cols:
                            _conn.execute(sa_text(f"ALTER TABLE {table} ADD COLUMN {col_sql}"))
                            _conn.commit()
                            logger.info("Phase 2 auto-migration: added %s.%s", table, col_name)

                    if "user_requests" in tables:
                        req_cols = {c["name"] for c in inspector.get_columns("user_requests")}
                        _auto_add_col("user_requests", "request_type VARCHAR(50) NOT NULL DEFAULT 'manual'", "request_type", req_cols)
                        _auto_add_col("user_requests", "source_trigger VARCHAR(50) NULL", "source_trigger", req_cols)
                        _auto_add_col("user_requests", "destination_type VARCHAR(50) NULL", "destination_type", req_cols)
                        _auto_add_col("user_requests", "destination_location VARCHAR(200) NULL", "destination_location", req_cols)
                        _auto_add_col("user_requests", "related_kit_id INTEGER NULL", "related_kit_id", req_cols)
                        _auto_add_col("user_requests", "item_class VARCHAR(50) NULL", "item_class", req_cols)
                        _auto_add_col("user_requests", "repairable BOOLEAN NOT NULL DEFAULT FALSE", "repairable", req_cols)
                        _auto_add_col("user_requests", "core_required BOOLEAN NOT NULL DEFAULT FALSE", "core_required", req_cols)
                        _auto_add_col("user_requests", "return_status VARCHAR(50) NULL", "return_status", req_cols)
                        _auto_add_col("user_requests", "return_destination VARCHAR(200) NOT NULL DEFAULT 'Main Warehouse / Stores'", "return_destination", req_cols)
                        _auto_add_col("user_requests", "external_reference VARCHAR(200) NULL", "external_reference", req_cols)
                        # Migrate legacy priority values (idempotent)
                        _conn.execute(sa_text("UPDATE user_requests SET priority = 'routine' WHERE priority IN ('low', 'normal')"))
                        _conn.execute(sa_text("UPDATE user_requests SET priority = 'urgent' WHERE priority = 'high'"))
                        _conn.execute(sa_text("UPDATE user_requests SET priority = 'aog' WHERE priority = 'critical'"))
                        # Migrate legacy status values (idempotent)
                        _conn.execute(sa_text("UPDATE user_requests SET status = 'needs_info' WHERE status = 'awaiting_info'"))
                        _conn.execute(sa_text("UPDATE user_requests SET status = 'pending_fulfillment' WHERE status IN ('in_progress', 'ordered')"))
                        _conn.execute(sa_text("UPDATE user_requests SET status = 'partially_fulfilled' WHERE status IN ('partially_ordered', 'partially_received')"))
                        _conn.execute(sa_text("UPDATE user_requests SET status = 'fulfilled' WHERE status = 'received'"))
                        _conn.commit()

                    if "procurement_orders" in tables:
                        ord_cols = {c["name"] for c in inspector.get_columns("procurement_orders")}
                        _auto_add_col("procurement_orders", "request_id INTEGER NULL", "request_id", ord_cols)
                        if "request_id" not in ord_cols:
                            _conn.execute(sa_text(
                                "CREATE INDEX IF NOT EXISTS idx_procurement_orders_request_id "
                                "ON procurement_orders(request_id)"
                            ))
                            _conn.commit()
                        _auto_add_col("procurement_orders", "source_location VARCHAR(200) NULL", "source_location", ord_cols)
                        _auto_add_col("procurement_orders", "fulfillment_action_type VARCHAR(50) NULL", "fulfillment_action_type", ord_cols)
                        _auto_add_col("procurement_orders", "fulfillment_quantity INTEGER NULL", "fulfillment_quantity", ord_cols)
                        _auto_add_col("procurement_orders", "is_internal_fulfillment BOOLEAN NOT NULL DEFAULT FALSE", "is_internal_fulfillment", ord_cols)

                    if "tools" in tables:
                        tool_cols = {c["name"] for c in inspector.get_columns("tools")}
                        _auto_add_col("tools", "maintenance_return_date TIMESTAMP NULL", "maintenance_return_date", tool_cols)

                    if "users" in tables:
                        user_cols = {c["name"] for c in inspector.get_columns("users")}
                        _auto_add_col("users", "phone VARCHAR(30) NULL", "phone", user_cols)
                        # Multi-warehouse scoping
                        _auto_add_col("users", "active_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL", "active_warehouse_id", user_cols)
                        if "active_warehouse_id" not in user_cols:
                            _conn.execute(sa_text(
                                "CREATE INDEX IF NOT EXISTS ix_users_active_warehouse_id "
                                "ON users(active_warehouse_id)"
                            ))
                            # Backfill: assign the main warehouse for existing users
                            _conn.execute(sa_text(
                                "UPDATE users SET active_warehouse_id = ("
                                "  SELECT id FROM warehouses"
                                "  WHERE warehouse_type = 'main' AND is_active = TRUE"
                                "  ORDER BY id LIMIT 1"
                                ") WHERE active_warehouse_id IS NULL"
                            ))
                            _conn.commit()
                            logger.info("Phase 2 auto-migration: backfilled users.active_warehouse_id from main warehouse")

                    if "warehouse_transfers" in tables:
                        xfer_cols = {c["name"] for c in inspector.get_columns("warehouse_transfers")}
                        _auto_add_col("warehouse_transfers", "received_by_id INTEGER REFERENCES users(id)", "received_by_id", xfer_cols)
                        _auto_add_col("warehouse_transfers", "received_date TIMESTAMP", "received_date", xfer_cols)
                        _auto_add_col("warehouse_transfers", "source_location VARCHAR(200)", "source_location", xfer_cols)
                        _auto_add_col("warehouse_transfers", "destination_location VARCHAR(200)", "destination_location", xfer_cols)
                        _auto_add_col("warehouse_transfers", "cancelled_by_id INTEGER REFERENCES users(id)", "cancelled_by_id", xfer_cols)
                        _auto_add_col("warehouse_transfers", "cancelled_date TIMESTAMP", "cancelled_date", xfer_cols)
                        _auto_add_col("warehouse_transfers", "cancel_reason VARCHAR(500)", "cancel_reason", xfer_cols)
                        if "received_by_id" not in xfer_cols:
                            _conn.execute(sa_text(
                                "CREATE INDEX IF NOT EXISTS ix_warehouse_transfers_received_by_id "
                                "ON warehouse_transfers(received_by_id)"
                            ))
                            _conn.commit()

                    # Widen users.totp_secret — PostgreSQL-only syntax; SQLite skips cleanly.
                    if "users" in tables:
                        try:
                            totp_col = next(
                                (c for c in inspector.get_columns("users") if c["name"] == "totp_secret"),
                                None,
                            )
                            col_type = totp_col.get("type") if totp_col else None
                            existing_length = getattr(col_type, "length", None)
                            if existing_length is not None and existing_length < 255:
                                _conn.execute(sa_text(
                                    "ALTER TABLE users ALTER COLUMN totp_secret TYPE VARCHAR(255)"
                                ))
                                _conn.commit()
                                logger.info("Phase 2 auto-migration: widened users.totp_secret to VARCHAR(255)")
                        except Exception as totp_exc:
                            logger.debug("Phase 2 auto-migration: totp_secret widen skipped (%s)", totp_exc)

                logger.info("Phase 2 auto-migrations verified/applied successfully")
        except Exception as e:
            logger.warning("Phase 2 auto-migration warning (non-fatal): %s", str(e))
    else:
        logger.info("Skipping automatic database table creation in testing mode")

    # Create admin user if it doesn't exist (after tables are created)
    if not is_testing_env:
        try:
            from utils.admin_init import create_secure_admin
            logger.info("Checking/creating admin user...")
            with app.app_context():
                success, message, password = create_secure_admin()
                if success:
                    logger.warning("SECURITY NOTICE: Admin user created successfully")
                    if password:
                        logger.warning("INITIAL ADMIN PASSWORD GENERATED - copy from env-var not from logs")
                else:
                    logger.error(f"Failed to create admin user: {message}")
        except Exception as e:
            logger.error("Error during admin user creation", exc_info=True, extra={
                "error_message": str(e)
            })

    # Ensure the Inventory Viewer role exists (idempotent — safe on every startup)
    if not is_testing_env:
        try:
            with app.app_context():
                from models import Permission, Role, RolePermission
                _viewer_role = Role.query.filter_by(name="Inventory Viewer").first()
                if not _viewer_role:
                    _viewer_role = Role(
                        name="Inventory Viewer",
                        description="Read-only access to tooling and chemicals inventory",
                        is_system_role=True,
                    )
                    db.session.add(_viewer_role)
                    db.session.flush()
                    logger.info("Created 'Inventory Viewer' role")

                _viewer_perms = [
                    "tool.view",
                    "chemical.view",
                    "page.tools",
                    "page.chemicals",
                    "page.profile",
                ]
                for _perm_name in _viewer_perms:
                    _perm = Permission.query.filter_by(name=_perm_name).first()
                    if _perm and not RolePermission.query.filter_by(
                        role_id=_viewer_role.id, permission_id=_perm.id
                    ).first():
                        db.session.add(RolePermission(role_id=_viewer_role.id, permission_id=_perm.id))

                db.session.commit()
                logger.info("Inventory Viewer role permissions verified/applied")
        except Exception as e:
            logger.warning("Inventory Viewer role setup warning (non-fatal): %s", str(e))

    # Register main routes
    register_routes(app)

    # Add security headers middleware
    @app.after_request
    def add_security_headers(response):
        security_headers = app.config.get("SECURITY_HEADERS", {})
        for header, value in security_headers.items():
            response.headers[header] = value
        return response

    @app.route("/")
    def index():
        return app.send_static_file("index.html")

    # Log all registered routes for debugging
    logger.info("Application routes registered", extra={
        "route_count": len(list(app.url_map.iter_rules())),
        "routes": [f"{rule} - {rule.methods}" for rule in app.url_map.iter_rules()]
    })

    # Initialize scheduled backup service
    if not is_testing_env:
        try:
            logger.info("Initializing scheduled backup service...")
            init_scheduled_backup(app)

            # Register cleanup on shutdown
            atexit.register(shutdown_scheduled_backup)

            logger.info("Scheduled backup service initialized")
        except Exception as e:
            logger.error("Error initializing scheduled backup service", exc_info=True, extra={
                "error_message": str(e)
            })

    # Initialize scheduled maintenance service
    if not is_testing_env:
        try:
            logger.info("Initializing scheduled maintenance service...")
            init_scheduled_maintenance(app)

            # Register cleanup on shutdown
            atexit.register(shutdown_scheduled_maintenance)

            logger.info("Scheduled maintenance service initialized")
        except Exception as e:
            logger.error("Error initializing scheduled maintenance service", exc_info=True, extra={
                "error_message": str(e)
            })

    return app

if __name__ == "__main__":
    app = create_app()

    # Determine host and debug settings based on environment variables (Bandit B104, B201 mitigation)
    # Default to secure settings (127.0.0.1, debug=False) unless FLASK_ENV is 'development'
    is_development = os.environ.get("FLASK_ENV") == "development"

    # B104: Restrict host binding unless explicitly set or in development
    # nosec B104: Binding to 0.0.0.0 is intentional in development/Docker environments
    # In production, this should be overridden via FLASK_RUN_HOST environment variable
    host = os.environ.get("FLASK_RUN_HOST", "0.0.0.0" if is_development else "127.0.0.1")  # nosec B104
    port = int(os.environ.get("FLASK_RUN_PORT", 5000))
    # B201: Disable debug unless explicitly set or in development
    debug = os.environ.get("FLASK_DEBUG", "True" if is_development else "False").lower() in ("true", "1", "yes")

    app.run(host=host, port=port, debug=debug)
