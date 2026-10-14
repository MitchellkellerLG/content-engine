"""Build a 1280x720 slide deck (HTML + PDF + PNG per slide) from slides.py.

    python build.py slides.py                 # light mode (default): Legion site palette, no glow
    python build.py slides.py --theme dark    # Legion dark canvas, cobalt accent
    python build.py slides.py --theme both    # renders out/light/ and out/dark/

slides.py calls S(eyebrow, title, body_html, notes_list) once per slide.
Theme tokens come from repurpose/graphics/themes/legion-light.css and legion.css,
so decks and graphics share one palette. Footer is a page number only (prospect decks carry no
branding); pass --corner yourdomain.com when branding is wanted.
Arcadia is listed first in the light theme but is not bundled; without it installed the deck
falls back to Hanken Grotesk.
"""
import argparse, asyncio, html as H
from pathlib import Path

KIT = Path(__file__).resolve().parents[3] / "repurpose" / "graphics"
THEMES = {"light": "legion-light", "dark": "legion"}

CSS = """
@font-face{font-family:"Hanken Grotesk";src:url(FONTS/HankenGrotesk.woff2);font-weight:100 900}
@font-face{font-family:"JetBrains Mono";src:url(FONTS/JetBrainsMono.woff2)}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--canvas);font-family:var(--font);color:var(--text);-webkit-font-smoothing:antialiased}
@page{size:1280px 720px;margin:0}
.slide{position:relative;display:flex;flex-direction:column;width:1280px;height:720px;overflow:hidden;
 padding:72px 96px 104px;background:var(--canvas);break-after:page}
.dark .slide{background:radial-gradient(1000px 600px at 15% -20%,var(--glow2),transparent 65%),var(--canvas)}
.eb{font-family:var(--mono);font-size:20px;letter-spacing:.06em;color:var(--accent-text);text-transform:uppercase}
h1{font-size:56px;line-height:1.06;font-weight:700;letter-spacing:-.025em;margin-top:18px;max-width:1080px}
.sub{font-size:26px;color:var(--muted);margin-top:14px;line-height:1.35;max-width:1080px}
.card,.tile{background:var(--card);border:1.5px solid var(--border);border-radius:20px;padding:24px 28px;box-shadow:var(--ambient)}
.hi{border-color:var(--accent);background:var(--hi-bg)}
.acc{color:var(--accent-text)} .dim{color:var(--muted)}
.ft{position:absolute;left:96px;right:96px;bottom:40px;display:flex;justify-content:space-between;font-size:24px;color:var(--muted)}
.notes{display:none}
"""

def load(slides_py):
    slides = []
    def S(e, t, b, n=(), c=""): slides.append(dict(e=e, t=t, b=b, n=list(n), c=c))
    exec(Path(slides_py).read_text(), {"S": S, "esc": H.escape})
    return slides

def page(slides, mode, corner, fonts):
    theme = (KIT / "themes" / f"{THEMES[mode]}.css").read_text()
    out = []
    for i, s in enumerate(slides, 1):
        notes = "".join(f"<li>{n}</li>" for n in s["n"])
        out.append(f'<section class="slide {s["c"]}"><div class="eb">{s["e"]}</div><h1>{s["t"]}</h1>{s["b"]}'
                   f'<div class="ft"><span>{i}</span><span>{corner}</span></div>'
                   f'<aside class="notes"><ul>{notes}</ul></aside></section>')
    return (f'<!doctype html><html><head><meta charset="utf-8"><style>{theme}{CSS.replace("FONTS", fonts)}</style>'
            f'</head><body class="{mode}">{"".join(out)}</body></html>')

async def render(html_path, out, n):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=2)
        await pg.goto(html_path.resolve().as_uri()); await pg.evaluate("document.fonts.ready")
        (out / "png").mkdir(exist_ok=True)
        for i, el in enumerate(await pg.query_selector_all("section.slide"), 1):
            await el.screenshot(path=str(out / "png" / f"slide_{i:02d}.png"))
        over = await pg.evaluate("[...document.querySelectorAll('section.slide')].map((s,i)=>s.scrollHeight>720?i+1:0).filter(Boolean)")
        await pg.pdf(path=str(out / "deck.pdf"), width="1280px", height="720px", print_background=True)
        await b.close()
    print("overflow on slides:", over or "none")

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slides"); ap.add_argument("--theme", choices=["light", "dark", "both"], default="light")
    ap.add_argument("--corner", default="", help="footer corner text; empty for prospect decks")
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    slides = load(a.slides)
    for mode in (["light", "dark"] if a.theme == "both" else [a.theme]):
        out = Path(a.out) / mode if a.theme == "both" else Path(a.out)
        out.mkdir(parents=True, exist_ok=True)
        hp = out / "deck.html"
        hp.write_text(page(slides, mode, a.corner, Path(KIT / "fonts").resolve().as_uri()))
        asyncio.run(render(hp, out, len(slides)))
        print(f"{mode}: {out}")

if __name__ == "__main__":
    main()
