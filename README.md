# Contrast Check

A lightweight Chrome extension that shows WCAG contrast ratios on hover. No panel to open, no full-page audit. Point at any text and see if it passes.

## Features

- **Hover to inspect**: Move your cursor over any text element to see its contrast ratio instantly
- **WCAG 2.1 compliant**: Shows pass/fail for AA and AAA, with large text detection
- **Background resolution**: Walks up the DOM to find the true effective background color, compositing semi-transparent layers
- **Background image detection**: Flags elements over background images or gradients instead of giving a wrong answer
- **Copy to clipboard**: Click any element to copy its foreground and background colors to clipboard
- **Minimal permissions**: Only uses `activeTab` and `scripting`, no persistent access

## How to use

1. Click the Contrast Check icon in the toolbar to activate
2. Hover over any text element to see the contrast tooltip
3. Click an element to copy its colors to clipboard (format: `FG: #hex\nBG: #hex`)
4. Press **Escape** to deactivate, or click the toolbar icon again

## Install from source

1. Clone or download this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `contrast-check` folder

## How it works

The extension injects a content script that:

1. Listens for mouse movement over the page
2. For each text element, reads its computed `color` property
3. Walks up the DOM tree to resolve the effective background color, compositing any semi-transparent `backgroundColor` layers
4. Computes the WCAG 2.1 relative luminance and contrast ratio
5. Evaluates pass/fail against AA (4.5:1 normal, 3:1 large) and AAA (7:1 normal, 4.5:1 large) thresholds
6. Renders a tooltip with the results

## Edge cases handled

- Semi-transparent text colors composited against background
- Semi-transparent background layers composited down to root
- Large text detection (>= 24px, or >= 18.66px and bold)
- Background images and gradients (flagged, not guessed)

## License

MIT

## Author

[Peter Benoit](https://www.peterbenoit.com/)
