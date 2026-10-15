"""Make a 550px-wide contact sheet from out/png (or out/<mode>/png) so you can check legibility.

    python shoot.py out            # handles out/png or out/light + out/dark (from --theme both)
"""
import subprocess, sys
from pathlib import Path
root = Path(sys.argv[1] if len(sys.argv) > 1 else "out")
dirs = [root] if (root / "png").is_dir() else [p for p in (root / "light", root / "dark") if (p / "png").is_dir()]
if not dirs: sys.exit(f"no png/ folder in {root} or its light/ and dark/ subfolders")
for d in dirs:
  pngs = sorted((d / "png").glob("slide_*.png"))
  if not pngs: continue
  args = sum([["-i", str(p)] for p in pngs], [])
  f = "".join(f"[{i}:v]scale=550:-1[s{i}];" for i in range(len(pngs))) + "".join(f"[s{i}]" for i in range(len(pngs))) + f"vstack=inputs={len(pngs)}"
  subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args, "-filter_complex", f, str(d / "contact_550.png")], check=True)
  print(d / "contact_550.png")
