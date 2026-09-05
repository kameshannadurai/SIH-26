"""
ScaleSync / Legal Metrology Digital Verification Platform
Single-command launcher: starts both FastAPI backend and Vite frontend.
Usage:
    python run.py
"""
import os
import sys
import time
import subprocess
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
WEB_DIR = ROOT / "web"

def main():
    print("=" * 60)
    print("  LEGAL METROLOGY DIGITAL PLATFORM (ScaleSync)")
    print("  Launching Backend API (Port 8000) & Web (Port 5173)...")
    print("=" * 60)

    # 1. Determine Python and uvicorn executable for backend
    venv_py = BACKEND_DIR / "venv" / "Scripts" / "python.exe"
    venv_uvicorn = BACKEND_DIR / "venv" / "Scripts" / "uvicorn.exe"
    
    python_to_use = str(sys.executable)
    if venv_py.exists():
        try:
            test_res = subprocess.run([str(venv_py), "--version"], capture_output=True, timeout=3)
            if test_res.returncode == 0:
                python_to_use = str(venv_py)
        except Exception:
            pass

    backend_cmd = f'"{python_to_use}" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000'

    print(f"\n[1/3] Starting FastAPI Backend on http://127.0.0.1:8000 ...")
    backend_proc = subprocess.Popen(backend_cmd, cwd=str(BACKEND_DIR), shell=True)

    # 2. Determine frontend command (prefer local vite.cmd)
    local_vite = WEB_DIR / "node_modules" / ".bin" / "vite.cmd"
    if local_vite.exists():
        npm_cmd = f'"{local_vite}" --host 127.0.0.1 --port 5173'
    else:
        npm_cmd = "npm run dev"

    print(f"[2/3] Starting Vite Frontend on http://localhost:5173 ...")
    web_proc = subprocess.Popen(npm_cmd, cwd=str(WEB_DIR), shell=True)

    # 3. Wait and open browser
    time.sleep(4)
    print("[3/3] Opening browser at http://localhost:5173 ...")
    try:
        webbrowser.open("http://localhost:5173")
    except Exception:
        pass

    print("\n" + "=" * 60)
    print("  ScaleSync Platform is LIVE!")
    print("  - Web Frontend:  http://localhost:5173")
    print("  - Backend API:   http://127.0.0.1:8000")
    print("  - API Docs:      http://127.0.0.1:8000/docs")
    print("=" * 60)
    print("KEEP THIS TERMINAL WINDOW OPEN to keep the servers alive.")
    print("Press Ctrl+C to stop both servers.\n")

    try:
        while True:
            time.sleep(1)
            # Check if backend unexpectedly died
            if backend_proc.poll() is not None:
                print(f"\n[Warning] Backend process exited with code: {backend_proc.poll()}")
                print("To inspect backend errors, run in a separate terminal:")
                print(f"  cd backend && {backend_cmd}")
                break
            # Check if web unexpectedly died
            if web_proc.poll() is not None:
                print(f"\n[Warning] Web frontend process exited with code: {web_proc.poll()}")
                print("To inspect frontend errors, run in a separate terminal:")
                print("  cd web && npm run dev")
                break
    except KeyboardInterrupt:
        print("\nStopping servers gracefully...")
    finally:
        try:
            backend_proc.terminate()
            web_proc.terminate()
        except Exception:
            pass
        print("Servers stopped.")

if __name__ == "__main__":
    main()
