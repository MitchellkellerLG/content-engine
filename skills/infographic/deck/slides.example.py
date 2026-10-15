# Example deck. Copy, edit, then: python build.py slides.py  (light default) or --theme dark / both
S("Offer", "The headline that states what they get", '<div class="sub">Slide 1 is the title. Proof goes on slide 2.</div>', ["Say the offer in one line."])
S("Proof", "Our current client's real return goes here",
  '<div class="sub">Earnings only. Every number has a source label. Never invent one.</div>',
  ["Print the number exactly as the source report shows it."])
S("Projection", "What this looks like for you",
  '<div class="sub">Based on our current client\'s results, minus 25%.</div>',
  ["State the minus-25% basis plainly. No dates, no internal notes."])
