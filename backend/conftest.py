"""
Pytest configuration - loaded BEFORE test conftest.py
This fixes the Python path before any test imports happen.
"""

import sys
import os

# Fix path BEFORE pytest loads anything else
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))

# Remove '' which causes current dir to be searched first
while '' in sys.path:
    sys.path.remove('')

# Ensure our backend directory is first so app.py > app/
if BACKEND_DIR in sys.path:
    sys.path.remove(BACKEND_DIR)
sys.path.insert(0, BACKEND_DIR)

# Now Python should find app.py before app/ package
