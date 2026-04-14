(function () {
	// Prevent double-injection
	if (window.__contrastCheckActive) return;
	window.__contrastCheckActive = true;

	// =========================================================================
	// Color math (WCAG 2.1 relative luminance + contrast ratio)
	// =========================================================================

	/**
	 * Parse any CSS color string into { r, g, b, a } with 0-255 for RGB, 0-1 for alpha.
	 * Uses a temporary canvas to let the browser do the heavy lifting.
	 */
	function parseColor(colorStr) {
		if (!colorStr || colorStr === "transparent") {
			return { r: 0, g: 0, b: 0, a: 0 };
		}

		const ctx = document.createElement("canvas").getContext("2d");
		ctx.fillStyle = colorStr;
		ctx.fillRect(0, 0, 1, 1);
		const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
		return { r, g, b, a: a / 255 };
	}

	/**
	 * Composite a foreground RGBA color over an opaque RGB background.
	 */
	function compositeOver(fg, bg) {
		const a = fg.a;
		return {
			r: Math.round(fg.r * a + bg.r * (1 - a)),
			g: Math.round(fg.g * a + bg.g * (1 - a)),
			b: Math.round(fg.b * a + bg.b * (1 - a)),
			a: 1,
		};
	}

	/**
	 * Walk up the DOM to resolve the effective background color,
	 * compositing semi-transparent layers as we go.
	 */
	function getEffectiveBackground(el) {
		const layers = [];
		let current = el;

		while (current && current !== document.documentElement) {
			const style = getComputedStyle(current);
			const bg = parseColor(style.backgroundColor);

			// If there's a background image, we can't compute reliably
			if (
				style.backgroundImage &&
				style.backgroundImage !== "none"
			) {
				return { color: null, hasImage: true };
			}

			if (bg.a > 0) {
				layers.push(bg);
			}

			if (bg.a === 1) break; // Opaque layer found, stop walking

			current = current.parentElement;
		}

		// If we walked all the way up without hitting an opaque layer,
		// assume white page background
		let result = { r: 255, g: 255, b: 255, a: 1 };

		// Composite from bottom (outermost) to top (innermost)
		for (let i = layers.length - 1; i >= 0; i--) {
			result = compositeOver(layers[i], result);
		}

		return { color: result, hasImage: false };
	}

	/**
	 * WCAG 2.1 relative luminance
	 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
	 */
	function relativeLuminance({ r, g, b }) {
		const [rs, gs, bs] = [r, g, b].map((c) => {
			const s = c / 255;
			return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
		});
		return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
	}

	/**
	 * WCAG contrast ratio between two colors.
	 */
	function contrastRatio(color1, color2) {
		const l1 = relativeLuminance(color1);
		const l2 = relativeLuminance(color2);
		const lighter = Math.max(l1, l2);
		const darker = Math.min(l1, l2);
		return (lighter + 0.05) / (darker + 0.05);
	}

	/**
	 * Determine WCAG pass/fail for AA and AAA at normal and large text sizes.
	 * Large text: >= 18pt (24px) or >= 14pt (18.66px) bold.
	 */
	function evaluateWCAG(ratio, fontSize, fontWeight) {
		const pxSize = parseFloat(fontSize);
		const weight = parseInt(fontWeight, 10);
		const isLarge = pxSize >= 24 || (pxSize >= 18.66 && weight >= 700);

		return {
			aa: ratio >= (isLarge ? 3 : 4.5),
			aaa: ratio >= (isLarge ? 4.5 : 7),
			isLarge,
		};
	}

	/**
	 * Convert RGB to hex string.
	 */
	function rgbToHex({ r, g, b }) {
		const hex = (n) => n.toString(16).padStart(2, "0");
		return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
	}

	// =========================================================================
	// Tooltip
	// =========================================================================

	const TOOLTIP_ID = "contrast-check-tooltip";
	let tooltip = null;
	let pinnedElement = null;
	let currentTarget = null;

	function createTooltip() {
		const el = document.createElement("div");
		el.id = TOOLTIP_ID;
		el.setAttribute("role", "status");
		el.setAttribute("aria-live", "polite");
		document.body.appendChild(el);
		return el;
	}

	function positionTooltip(e) {
		if (!tooltip) return;

		const pad = 16;
		const rect = tooltip.getBoundingClientRect();
		let x = e.clientX + pad;
		let y = e.clientY + pad;

		// Keep tooltip in viewport
		if (x + rect.width > window.innerWidth) {
			x = e.clientX - rect.width - pad;
		}
		if (y + rect.height > window.innerHeight) {
			y = e.clientY - rect.height - pad;
		}

		// Clamp to viewport edges
		x = Math.max(4, Math.min(x, window.innerWidth - rect.width - 4));
		y = Math.max(4, Math.min(y, window.innerHeight - rect.height - 4));

		tooltip.style.left = `${x}px`;
		tooltip.style.top = `${y}px`;
	}

	function renderTooltip(data) {
		if (!tooltip) tooltip = createTooltip();

		const { fgHex, bgHex, ratio, aa, aaa, isLarge, hasImage } = data;

		const badge = (pass, label) =>
			`<span class="cc-badge ${pass ? "cc-pass" : "cc-fail"}">${label}: ${pass ? "Pass" : "Fail"}</span>`;

		const sizeLabel = isLarge ? "Large text" : "Normal text";

		if (hasImage) {
			tooltip.innerHTML = `
        <div class="cc-row cc-row-warning">
          <span class="cc-label">Background image detected</span>
        </div>
        <div class="cc-row">
          <span class="cc-label">Text</span>
          <span class="cc-swatch" style="background:${fgHex}"></span>
          <span class="cc-value cc-value-copy" title="Click to copy">${fgHex}</span>
        </div>
        <div class="cc-row cc-note">Contrast cannot be computed over images or gradients.</div>
      `;
		} else {
			const ratioStr = ratio.toFixed(2);
			tooltip.innerHTML = `
        <div class="cc-header">
          <span class="cc-ratio ${aa ? "" : "cc-ratio-fail"}">${ratioStr}:1</span>
          <span class="cc-size-label">${sizeLabel}</span>
        </div>
        <div class="cc-badges">
          ${badge(aa, "AA")}
          ${badge(aaa, "AAA")}
        </div>
        <div class="cc-colors">
          <div class="cc-row">
            <span class="cc-label">Text</span>
            <span class="cc-swatch" style="background:${fgHex}"></span>
            <span class="cc-value cc-value-copy" title="Click to copy">${fgHex}</span>
          </div>
          <div class="cc-row">
            <span class="cc-label">BG</span>
            <span class="cc-swatch" style="background:${bgHex}"></span>
            <span class="cc-value cc-value-copy" title="Click to copy">${bgHex}</span>
          </div>
        </div>
        <div class="cc-preview">
          <span style="color:${fgHex}; background:${bgHex}; padding: 2px 6px; border-radius: 3px; font-size: 12px;">Sample Text</span>
        </div>
      `;
		}

		tooltip.classList.add("cc-visible");
	}

	function hideTooltip() {
		if (tooltip) {
			tooltip.classList.remove("cc-visible");
		}
	}

	// =========================================================================
	// Copy to clipboard
	// =========================================================================

	function copyToClipboard(text, element) {
		navigator.clipboard.writeText(text).then(() => {
			// Show feedback
			const originalText = element.textContent;
			element.textContent = "Copied!";
			element.classList.add("cc-copied");

			setTimeout(() => {
				element.textContent = originalText;
				element.classList.remove("cc-copied");
			}, 1000);
		}).catch(err => {
			console.error("Failed to copy:", err);
		});
	}

	function onTooltipClick(e) {
		const colorValue = e.target.closest(".cc-value-copy");
		if (colorValue) {
			e.stopPropagation();
			const text = colorValue.textContent;
			copyToClipboard(text, colorValue);
		}
	}

	// =========================================================================
	// Element inspection
	// =========================================================================

	function hasTextContent(el) {
		// Check if element directly contains text (not just child elements)
		for (const node of el.childNodes) {
			if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
				return true;
			}
		}
		return false;
	}

	function inspectElement(el) {
		const style = getComputedStyle(el);

		// Skip invisible elements
		if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
			return null;
		}

		// We care about elements with text
		if (!hasTextContent(el)) return null;

		const fgColor = parseColor(style.color);
		const bgResult = getEffectiveBackground(el);

		// Resolve foreground against background (for semi-transparent text)
		let effectiveFg = fgColor;
		if (fgColor.a < 1 && bgResult.color) {
			effectiveFg = compositeOver(fgColor, bgResult.color);
		}

		const fgHex = rgbToHex(effectiveFg);

		if (bgResult.hasImage) {
			return { fgHex, bgHex: null, ratio: null, aa: null, aaa: null, isLarge: false, hasImage: true };
		}

		const bgHex = rgbToHex(bgResult.color);
		const ratio = contrastRatio(effectiveFg, bgResult.color);
		const { aa, aaa, isLarge } = evaluateWCAG(ratio, style.fontSize, style.fontWeight);

		return { fgHex, bgHex, ratio, aa, aaa, isLarge, hasImage: false };
	}

	// =========================================================================
	// Highlight outline
	// =========================================================================

	const OUTLINE_ID = "contrast-check-outline";
	let outlineEl = null;

	function createOutline() {
		const el = document.createElement("div");
		el.id = OUTLINE_ID;
		document.body.appendChild(el);
		return el;
	}

	function showOutline(target) {
		if (!outlineEl) outlineEl = createOutline();

		const rect = target.getBoundingClientRect();
		outlineEl.style.left = `${rect.left + window.scrollX - 2}px`;
		outlineEl.style.top = `${rect.top + window.scrollY - 2}px`;
		outlineEl.style.width = `${rect.width + 4}px`;
		outlineEl.style.height = `${rect.height + 4}px`;
		outlineEl.classList.add("cc-outline-visible");
	}

	function hideOutline() {
		if (outlineEl) {
			outlineEl.classList.remove("cc-outline-visible");
		}
	}

	// =========================================================================
	// Event handlers
	// =========================================================================

	function onMouseMove(e) {
		// Don't update if pinned
		if (pinnedElement) return;

		// Ignore our own tooltip/outline
		if (e.target.closest(`#${TOOLTIP_ID}, #${OUTLINE_ID}`)) return;

		const el = e.target;

		if (el === currentTarget) {
			positionTooltip(e);
			return;
		}

		currentTarget = el;
		const data = inspectElement(el);

		if (data) {
			renderTooltip(data);
			positionTooltip(e);
			showOutline(el);
		} else {
			hideTooltip();
			hideOutline();
		}
	}

	function onClick(e) {
		// Ignore clicks on our own UI
		if (e.target.closest(`#${TOOLTIP_ID}, #${OUTLINE_ID}`)) return;

		e.preventDefault();
		e.stopPropagation();

		if (pinnedElement) {
			// Unpin
			pinnedElement = null;
			tooltip?.classList.remove("cc-pinned");
			return;
		}

		// Pin current element
		const data = inspectElement(e.target);
		if (data) {
			pinnedElement = e.target;
			renderTooltip(data);
			positionTooltip(e);
			showOutline(e.target);
			tooltip?.classList.add("cc-pinned");
		}
	}

	function onKeyDown(e) {
		if (e.key === "Escape") {
			if (pinnedElement) {
				pinnedElement = null;
				tooltip?.classList.remove("cc-pinned");
			} else {
				deactivate();
			}
		}
	}

	// =========================================================================
	// Lifecycle
	// =========================================================================

	function activate() {
		document.addEventListener("mousemove", onMouseMove, true);
		document.addEventListener("click", onClick, true);
		if (tooltip) {
			tooltip.addEventListener("click", onTooltipClick);
		}
		document.addEventListener("keydown", onKeyDown, true);
		document.body.classList.add("contrast-check-active");
	}

	function deactivate() {
		window.__contrastCheckActive = false;
		document.removeEventListener("mousemove", onMouseMove, true);
		document.removeEventListener("click", onClick, true);
		if (tooltip) {
			tooltip.removeEventListener("click", onTooltipClick);
		}
		document.removeEventListener("keydown", onKeyDown, true);
		document.body.classList.remove("contrast-check-active");

		pinnedElement = null;
		currentTarget = null;

		hideTooltip();
		hideOutline();

		tooltip?.remove();
		outlineEl?.remove();
		tooltip = null;
		outlineEl = null;
	}

	// Listen for deactivation signal from background script
	window.addEventListener("contrast-check-deactivate", () => {
		deactivate();
	});

	// Start
	activate();
})();
