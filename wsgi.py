import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app import create_app

application = create_app()

if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "False").lower() in ("true", "1", "yes")
    host = os.environ.get("FLASK_HOST", "127.0.0.1")
    application.run(host=host, port=5000, debug=debug)
