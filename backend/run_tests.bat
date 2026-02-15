@echo off
set SECRET_KEY=test-secret-key-for-testing-12345
set JWT_SECRET_KEY=test-jwt-secret-key-for-testing-12345
set FLASK_ENV=testing
set TESTING=true
cd /d "%~dp0"
python -m pytest --tb=short -q 2>&1
