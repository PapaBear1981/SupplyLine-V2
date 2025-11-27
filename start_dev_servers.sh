#!/bin/bash

echo "==================================================="
echo "   SupplyLine MRO Suite - Backend Server"
echo "==================================================="
echo

echo "Starting backend server..."
echo

# Store the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3.8+ and try again."
    exit 1
fi

# Create database directory if it doesn't exist
if [ ! -d "$PROJECT_ROOT/database" ]; then
    echo "Creating database directory..."
    mkdir -p "$PROJECT_ROOT/database"
fi

# Start backend server in a new terminal
echo "Starting backend server..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    osascript -e "tell application \"Terminal\" to do script \"cd '$PROJECT_ROOT/backend' && echo 'Activating virtual environment if it exists...' && if [ -f venv/bin/activate ]; then source venv/bin/activate; else echo 'No virtual environment found, continuing without it...'; fi && echo 'Installing backend dependencies...' && pip install -r requirements.txt && echo 'Starting Flask server...' && python app.py\""
else
    # Linux
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "cd '$PROJECT_ROOT/backend' && echo 'Activating virtual environment if it exists...' && if [ -f venv/bin/activate ]; then source venv/bin/activate; else echo 'No virtual environment found, continuing without it...'; fi && echo 'Installing backend dependencies...' && pip install -r requirements.txt && echo 'Starting Flask server...' && python app.py; exec bash"
    elif command -v xterm &> /dev/null; then
        xterm -e "cd '$PROJECT_ROOT/backend' && echo 'Activating virtual environment if it exists...' && if [ -f venv/bin/activate ]; then source venv/bin/activate; else echo 'No virtual environment found, continuing without it...'; fi && echo 'Installing backend dependencies...' && pip install -r requirements.txt && echo 'Starting Flask server...' && python app.py; exec bash"
    else
        echo "Could not find a suitable terminal emulator. Please start the backend server manually."
        echo "cd '$PROJECT_ROOT/backend' && python app.py"
    fi
fi

echo
echo "==================================================="
echo "Backend server is starting in a separate window."
echo
echo "Backend API will be available at: http://localhost:5000"
echo "Health check endpoint: http://localhost:5000/api/health"
echo
echo "Frontend: Set up your frontend framework separately"
echo "Configure CORS_ORIGINS in .env to include your frontend URL"
echo
echo "Default admin credentials:"
echo "- Employee Number: ADMIN001"
echo "- Password: admin123"
echo "==================================================="
echo
