# Third-party notices

content-engine is MIT licensed (see `LICENSE`). It adapts, uses or bundles the following.

## no-ai-slop (adapted)

`skills/no-ai-slop/SKILL.md` is adapted from https://github.com/petergyang/no-ai-slop: the edit/detect structure, the minimum-edit principle and much of the pattern list come from upstream, condensed and reworded for this repo. The upstream copyright and license:

```
MIT License

Copyright (c) 2026 Peter Yang

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Typefully agent skills (used, not bundled)

`repurpose/typefully.md` and `skills/repurpose/` tell you to install Typefully's own CLI from https://github.com/typefully/agent-skills (MIT License, Copyright (c) 2025 Typefully). No Typefully code is copied into this repo. Typefully is a trademark of its owner; this project is not affiliated with or endorsed by Typefully.

## Fonts (bundled)

- `repurpose/graphics/fonts/HankenGrotesk.woff2`: Hanken Grotesk, Copyright 2021 The Hanken Grotesk Project Authors. SIL Open Font License 1.1, full text in `repurpose/graphics/fonts/OFL-HankenGrotesk.txt`.
- `repurpose/graphics/fonts/JetBrainsMono.woff2`: JetBrains Mono, Copyright 2020 The JetBrains Mono Project Authors. SIL Open Font License 1.1, full text in `repurpose/graphics/fonts/OFL-JetBrainsMono.txt`.

Both files are subsets converted to WOFF2. Neither font declares a Reserved Font Name.

## npm dependencies (installed, not bundled)

| Package | License |
|---|---|
| `@trigger.dev/sdk`, `trigger.dev` | MIT |
| `postgres` | Unlicense |
| `typescript` | Apache-2.0 |
| `@types/node` | MIT |

## Optional tools (installed by you)

Playwright, ffmpeg, the GitHub CLI and any AI assistant you use are not bundled and keep their own licenses.

## Names

X, LinkedIn, GitHub, Trigger.dev and Typefully are trademarks of their owners. They are named only to describe compatibility. This project is not affiliated with or endorsed by any of them.
