# Privacy Policy — Contrast Check

**Last updated:** April 15, 2026

Contrast Check is a Chrome extension built by [Peter Benoit](https://www.peterbenoit.com/).

## What the extension does

Contrast Check reads the computed CSS styles of text elements on the active page to calculate WCAG color contrast ratios. It displays the results in a tooltip overlay directly on the page.

## Data collection

Contrast Check does **not** collect, store, transmit, or share any data. Specifically:

- No personal information is collected
- No browsing history is recorded
- No page content is stored or sent anywhere
- No cookies are set
- No analytics or tracking scripts are included
- No network requests are made by the extension

All processing happens locally in your browser. Nothing leaves your machine.

## Permissions

The extension requests two permissions:

- **activeTab**: Used to read computed CSS styles (color, background color, font size, font weight) of elements on the current tab when you activate the extension. This permission only grants access to the tab you are viewing, and only after you click the toolbar icon.
- **scripting**: Used to inject the content script that performs contrast calculations and renders the tooltip. The script is injected only into the active tab, only on your action, and is removed when you deactivate the extension.

## Third-party services

Contrast Check does not use any third-party services, APIs, libraries, or CDNs. It is entirely self-contained.

## Changes to this policy

If this policy changes, the updated version will be posted here with a new "Last updated" date.

## Contact

If you have questions about this policy, you can reach me at [hello@peterbenoit.com](mailto:hello@peterbenoit.com) or open an issue on the [GitHub repository](https://github.com/peterbenoit/contrast-check).
