#!/usr/bin/env python3
"""Render a scene folder to stills, MP4 and GIF.

  python repurpose/graphics/render.py repurpose/graphics/examples/three-steps            # page only (open in a browser)
  python repurpose/graphics/render.py <scene> --stills 1.5 4 10                          # PNG stills at 1.5s, 4s, 10s
  python repurpose/graphics/render.py <scene> --stills                                   # one PNG of the finished frame
  python repurpose/graphics/render.py <scene> --video                                    # MP4 1280x720 + 1920x1080, GIF
  python repurpose/graphics/render.py <scene> --theme default --video --name launch

Writes <scene>/index.html (open it to watch the live loop) and renders into <scene>/out/.
Needs: pip install playwright && playwright install chromium (or set CHROME_PATH), and ffmpeg.
"""
import argparse
import asyncio
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

KIT = Path(__file__).resolve().parent


def write_page(scene, theme):
    if not (KIT / "themes" / f"{theme}.css").exists():
        sys.exit(f"no theme {theme!r} in {KIT / 'themes'}")
    if not (scene / "scene.js").exists():
        sys.exit(f"{scene} has no scene.js")
    rel = os.path.relpath(KIT, scene).replace(os.sep, "/")
    html = (KIT / "index.tpl.html").read_text(encoding="utf-8")
    html = html.replace("{{KIT}}", rel).replace("{{THEME}}", theme).replace("{{TITLE}}", scene.name)
    (scene / "index.html").write_text(html, encoding="utf-8")
    return scene / "index.html"


async def capture(page_path, out, name, stills, video, fps, strict=False):
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        launch = {"args": ["--force-color-profile=srgb", "--allow-file-access-from-files", "--font-render-hinting=none"]}
        if os.environ.get("CHROME_PATH"):
            launch["executable_path"] = os.environ["CHROME_PATH"]
        browser = await p.chromium.launch(**launch)
        pg = await browser.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=2)
        msgs = []
        pg.on("console", lambda m: msgs.append(m.text))
        pg.on("pageerror", lambda e: msgs.append("ERROR " + str(e)))
        await pg.goto(page_path.resolve().as_uri() + "?capture=1")
        try:
            await pg.wait_for_function("window.READY === true", timeout=20000)
        except Exception:
            print("\n".join(msgs))
            raise
        if msgs:
            print("console:", msgs)
        total = await pg.evaluate("maxT()")
        hold = await pg.evaluate("holdT()")
        await pg.evaluate("render(10)")
        problems = await pg.evaluate("checkOverflow()")
        print("layout check:", "clean" if not problems else problems)
        if strict and problems:
            await browser.close()
            return None, problems
        for t in (stills if stills else [hold] if stills is not None else []):
            await pg.evaluate(f"render({t})")
            await pg.screenshot(path=str(out / f"{name}_{t:05.2f}s.png"))
        frames = None
        if video:
            frames = Path(tempfile.mkdtemp(prefix="kit_frames_"))
            n = int(round(total * fps))
            for i in range(n):
                await pg.evaluate(f"render({i / fps})")
                await pg.screenshot(path=str(frames / f"f{i:05d}.png"))
            print(f"captured {n} frames ({total}s @ {fps}fps)")
        await browser.close()
        return frames, problems


def encode(frames, out, name, fps, gif_width, gif_fps):
    def ff(*a):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *a], check=True)

    src = ["-framerate", str(fps), "-i", str(frames / "f%05d.png")]
    for w, h, tag in [(1280, 720, ""), (1920, 1080, "_1080p")]:
        ff(*src, "-vf", f"scale={w}:{h}:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-profile:v", "high",
           "-crf", "18", "-preset", "slow", "-movflags", "+faststart", str(out / f"{name}{tag}.mp4"))
    ff(*src, "-vf", f"fps={gif_fps},scale={gif_width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];"
       "[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", "-loop", "0", str(out / f"{name}.gif"))
    shutil.rmtree(frames, ignore_errors=True)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("scene", type=Path)
    ap.add_argument("--theme", default="default")
    ap.add_argument("--name", default="graphic")
    ap.add_argument("--stills", type=float, nargs="*", default=None,
                    help="times in seconds; with no values, one still of the finished frame")
    ap.add_argument("--video", action="store_true")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--gif-width", type=int, default=1100)
    ap.add_argument("--gif-fps", type=int, default=20)
    ap.add_argument("--strict", action="store_true", help="stop without rendering if the layout check finds problems")
    args = ap.parse_args(argv)
    scene = args.scene.resolve()
    page = write_page(scene, args.theme)
    print(f"page: {page}")
    if args.stills is None and not args.video:
        return
    if args.video and not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found")
    out = scene / "out"
    out.mkdir(exist_ok=True)
    frames, problems = asyncio.run(capture(page, out, args.name, args.stills, args.video, args.fps, args.strict))
    if args.strict and problems:
        sys.exit("layout problems found; nothing rendered (drop --strict to render anyway)")
    if frames:
        encode(frames, out, args.name, args.fps, args.gif_width, args.gif_fps)
    print(f"done -> {out}")


if __name__ == "__main__":
    main()
