---
name: infographic
description: Decompose an idea into a structure first (Show Me), pick the matching layout, then render a branded static or animated infographic or deck.
---
# Infographic (Show Me first)

Logic adapted from HumanLayer's `show-me` skill (MIT, https://github.com/humanlayer/skills/tree/main/plugins/show-me): pick the smallest view that makes the key point clear, with real labels and data. Credited, not copied.

## 1. Decompose before you design
1. Write the single point in one sentence. One infographic = one idea.
2. Pull every label and number from the source post and note where each came from. No source, no number.
3. Sketch the structure as plain text, e.g. `checklist (8 signals) -> score -> verdict`.
4. Pick the layout:
   | Shape | Layout |
   |---|---|
   | Steps / process | numbered cards with connectors |
   | Checklist + score | grid wired into one result card |
   | Comparison | two columns, same rows, winner in accent |
   | Hierarchy | tree, max 2 levels |
   | Flow / system | boxes and arrows, max 6 nodes |
   | Numbers | 1-3 big-number cards, each with its source |
5. Cut to max 8 items.

## 2. Render in your brand style
- Ship every graphic in BOTH dark mode and light mode with the same layout: one accent colour, a progress bar on animated versions, your domain in the bottom-right corner on every frame. Light mode drops glow effects.
- Render both with `python repurpose/graphics/render.py <scene> --theme dark-theme,light-theme --stills` (outputs get a `_<theme>` suffix). The demo pair is `--theme both` = `legion` + `legion-light`; make your own pair by copying `themes/default.css`.
- Animated graphics are HTML scenes recorded to MP4/GIF. Hold the final frame for at least 5 seconds.
- Borrow a reference's motion and layout, never its logos, fonts or branding.
- Readable at ~550px wide: on a 1280px canvas body >= 24px, labels >= 19px, titles >= 44px.

## 3. Deck mode
- Write `STRUCTURE.md` first (Shape / Point / Layout per slide, FLAG anything unverified), then build slides.
- Proof goes on slide 2, verified against its source.
- Show a pipeline as a waterfall of checks that narrows the list, not equal cards.
- Every number carries a labeled source; projections are labeled and show the formula.
- Client-facing decks: no internal notes (who claimed what, "unverified", placeholders, process language), no client names, no anti-slop skipped. Prospect decks carry no branding unless asked. Default deck style is light mode, no glow.
- Projections are based on a real client's results minus 25%, stated plainly, earnings math only.
- Make a 550px contact sheet and look at it before sharing.

## 4. Posting rules
- Quote tweets get a GIF or video, never a still.
- Max one visual post per day on X.
- No images in newsletter emails.

## 4. Deck build kit
`skills/infographic/deck/`: `python build.py slides.py` renders HTML + PDF + PNG per slide in light mode by default (no glow); `--theme dark` or `--theme both` for the dark version. `python shoot.py out` makes a 550px contact sheet. The light theme lists Arcadia first but doesn't bundle it; without it installed, renders fall back to Hanken Grotesk.
