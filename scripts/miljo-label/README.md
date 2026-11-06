# Miljøregistrering label artwork

Sources for `src/lib/miljo/labelArt.ts`, the vector artwork of the 49 × 49 mm QR label. The label's
text is stored as outlines, so changing it means running this generator again.

Python is only needed to change the artwork. The site and the admin button use the generated file.

## Setup

```
python -m pip install -r scripts/miljo-label/requirements.txt
```

## Regenerate

```
python scripts/miljo-label/generate-label-art.py
npx tsx --tsconfig tsconfig.test.json --test src/lib/miljo/labelPdf.test.ts
```

The output is deterministic: if nothing was edited, `git diff src/lib/miljo/labelArt.ts` stays empty.

## What to edit

| To change | Edit |
| --- | --- |
| Label wording, font or letter spacing | `TEXTS` in `generate-label-art.py` |
| Icon line weight | `GLOBE_STROKE`, `BATTERY_STROKE` |
| Icon shapes | `globe_icon()`, `battery_icon()` |
| The cube logo | Replace `public/logo.png`; `trace_mark()` traces it again |
| Sizes and positions on the label, colours | `src/lib/miljo/labelPdf.ts` |

After any change, check that the longer text still fits (the tests fail if an element leaves the
label or enters the QR quiet zone), then scan and print a real label. Lines should stay at least
0.25 mm wide, which is 2 dots on the 203 dpi TSC DA210.

A new text line also needs a `placeText` call in `labelPdf.ts`.

## Files

- `generate-label-art.py`: the generator
- `fonts/Poppins-Bold.ttf`, `fonts/Poppins-SemiBold.ttf`: from
  [google/fonts](https://github.com/google/fonts/tree/main/ofl/poppins), under the SIL Open Font
  License (`fonts/OFL.txt`)

The design reference, `references/aBoks-Miljoregistrering-2linjer-QR-klistremerker-90mm.pdf`, is
gitignored and is not needed to run the generator.
