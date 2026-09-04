import subprocess
import sys
from pathlib import Path

web_dir = Path(__file__).resolve().parents[2] / 'web'
subprocess.Popen(['npx', 'vite', '--host', '127.0.0.1', '--port', '5173'], cwd=str(web_dir), shell=True)
print("Vite web server launched successfully on http://127.0.0.1:5173")
