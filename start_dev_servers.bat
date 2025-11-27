@echo off
echo ===================================================
echo    SupplyLine MRO Suite - Backend Server
echo ===================================================
echo.
echo Starting backend server...
echo.

REM Store the project root directory
set PROJECT_ROOT=%~dp0

REM Check if Python is installed
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Python is not installed or not in PATH. Please install Python 3.8+ and try again.
    goto :error
)

REM Create database directory if it doesn't exist
if not exist "%PROJECT_ROOT%database" (
    echo Creating database directory...
    mkdir "%PROJECT_ROOT%database"
)

echo Starting backend server...
start cmd /k "cd /d %PROJECT_ROOT%backend && echo Activating virtual environment if it exists... && (if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat) else (echo No virtual environment found, continuing without it...)) && echo Installing backend dependencies... && pip install -r requirements.txt && echo Starting Flask server... && python app.py"

echo.
echo ===================================================
echo Backend server is starting in a separate window.
echo.
echo Backend API will be available at: http://localhost:5000
echo Health check endpoint: http://localhost:5000/api/health
echo.
echo Frontend: Set up your frontend framework separately
echo Configure CORS_ORIGINS in .env to include your frontend URL
echo.
echo Default admin credentials:
echo - Employee Number: ADMIN001
echo - Password: admin123
echo ===================================================
echo.
echo Press any key to close this window...
pause > nul
exit /b 0

:error
echo.
echo Error occurred. Please check the requirements and try again.
echo.
echo Press any key to close this window...
pause > nul
exit /b 1
