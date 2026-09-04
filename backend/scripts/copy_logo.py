import shutil
from pathlib import Path

src = Path(r"C:\Users\Lenovo\.gemini\antigravity-ide\brain\b6371b01-fd39-422d-8fc3-179fa0b96d77\.user_uploaded\media_1787777817777.png")
targets = [
    Path(r"c:\Users\Lenovo\Desktop\legal-metrology-platform\web\src\logo.png"),
    Path(r"c:\Users\Lenovo\Desktop\legal-metrology-platform\web\src\logo_light.png"),
    Path(r"c:\Users\Lenovo\Desktop\legal-metrology-platform\web\src\logo_dark.png"),
    Path(r"c:\Users\Lenovo\Desktop\legal-metrology-platform\web1\web\src\logo.png"),
    Path(r"c:\Users\Lenovo\Desktop\legal-metrology-platform\web1\web\src\logo_light.png"),
    Path(r"c:\Users\Lenovo\Desktop\legal-metrology-platform\web1\web\src\logo_dark.png"),
]

for t in targets:
    t.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, t)
    print(f"Copied to {t}")
