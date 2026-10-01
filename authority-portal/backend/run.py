import os
import sys
import uvicorn

# Ensure the backend directory is in the Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"Starting NagarDrishti AI Authority Backend on http://{host}:{port}")
    uvicorn.run("main:app", host=host, port=port, reload=True)
