import base64
from pathlib import Path

src = Path(r"C:\Users\Lenovo\.gemini\antigravity-ide\brain\b6371b01-fd39-422d-8fc3-179fa0b96d77\.user_uploaded\media_1787777817777.png")
data = base64.b64encode(src.read_bytes()).decode('utf-8')
data_uri = f"data:image/png;base64,{data}"

out_file = Path(r"c:\Users\Lenovo\Desktop\legal-metrology-platform\web\src\logoData.js")
out_file.write_text(f"export const logoDataUri = {repr(data_uri)};\n", encoding='utf-8')

out_file1 = Path(r"c:\Users\Lenovo\Desktop\legal-metrology-platform\web1\web\src\logoData.js")
out_file1.write_text(f"export const logoDataUri = {repr(data_uri)};\n", encoding='utf-8')

# Also copy files directly
for dest_dir in [Path(r"c:\Users\Lenovo\Desktop\legal-metrology-platform\web\src"), Path(r"c:\Users\Lenovo\Desktop\legal-metrology-platform\web1\web\src")]:
    (dest_dir / "logo.png").write_bytes(src.read_bytes())
    (dest_dir / "logo_light.png").write_bytes(src.read_bytes())
    (dest_dir / "logo_dark.png").write_bytes(src.read_bytes())

print("Logo assets and logoData.js created successfully!")
