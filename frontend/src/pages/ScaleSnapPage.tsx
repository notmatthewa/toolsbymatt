import { useEffect, useRef } from "react";

export default function ScaleSnapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Load ScaleSnap CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/apps/scalesnap/style.css";
    document.head.appendChild(link);

    // Load heic-to library
    const heicScript = document.createElement("script");
    heicScript.src =
      "https://cdn.jsdelivr.net/npm/heic-to@1.4.3/dist/iife/heic-to.js";
    document.head.appendChild(heicScript);

    // Load app.js after DOM is ready
    const appScript = document.createElement("script");
    appScript.src = "/apps/scalesnap/app.js";
    heicScript.onload = () => document.body.appendChild(appScript);
    heicScript.onerror = () => document.body.appendChild(appScript);

    cleanupRef.current = () => {
      link.remove();
      heicScript.remove();
      appScript.remove();
    };

    return () => {
      cleanupRef.current?.();
    };
  }, []);

  return (
    <div id="scalesnap-root" ref={containerRef}>
      <div id="app">
        <header>
          <h1>ScaleSnap</h1>
          <p className="subtitle">Measure anything in a photo</p>
        </header>

        <input type="file" id="file-input" accept="image/*,.heic,.heif" hidden />
        <label id="drop-zone" className="drop-zone" htmlFor="file-input">
          <div className="drop-content">
            <svg
              className="drop-icon"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div className="drop-spinner hidden">
              <svg width="36" height="36" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="70 30"
                  className="spinner-arc"
                />
              </svg>
            </div>
            <p className="drop-text">
              Drop an image here or <span className="file-label">browse</span>
            </p>
            <p className="loading-text hidden">Loading image...</p>
          </div>
        </label>

        <div id="workspace" className="workspace hidden">
          <div className="toolbar">
            <div className="toolbar-row">
              <button
                id="btn-perspective"
                className="persp-btn"
                title="Toggle perspective / 3D mode"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 6l4-2v16l-4-2V6z" />
                  <path d="M6 4l16-2v20L6 20" />
                  <line x1="10" y1="5" x2="10" y2="19" />
                  <line x1="14" y1="4" x2="14" y2="20" />
                  <line x1="18" y1="3.5" x2="18" y2="20.5" />
                </svg>
                <span className="btn-text">Perspective</span>
              </button>
              <div className="toolbar-sep"></div>
              <div className="steps">
                <button
                  id="btn-reference"
                  className="step-btn active"
                  title="Set reference measurement"
                >
                  <span className="step-num">1</span>{" "}
                  <span id="ref-label">Reference</span>
                </button>
                <button
                  id="btn-measure"
                  className="step-btn"
                  disabled
                  title="Measure objects"
                >
                  <span className="step-num">2</span> Measure
                </button>
              </div>
              <div id="measure-modes" className="measure-modes hidden">
                <button
                  id="btn-mode-surface"
                  className="mode-btn active"
                  title="Measure along the ground"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <polyline points="17 8 21 12 17 16" />
                  </svg>
                  <span className="btn-text">Surface</span>
                </button>
                <button
                  id="btn-mode-height"
                  className="mode-btn"
                  title="Measure vertical height"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <line x1="12" y1="21" x2="12" y2="3" />
                    <polyline points="8 7 12 3 16 7" />
                  </svg>
                  <span className="btn-text">Height</span>
                </button>
              </div>
              <div className="toolbar-right">
                <button id="btn-reset-image" className="btn-icon" title="New image">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="toolbar-row toolbar-inputs">
              <div id="reference-input" className="ref-input">
                <input
                  type="number"
                  id="ref-value"
                  placeholder="Length"
                  step="any"
                  min="0"
                />
                <select id="ref-unit">
                  <optgroup label="Imperial">
                    <option value="in">inches</option>
                    <option value="ft">feet</option>
                    <option value="yd">yards</option>
                    <option value="mi">miles</option>
                  </optgroup>
                  <optgroup label="Metric">
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="m">meters</option>
                    <option value="km">km</option>
                  </optgroup>
                </select>
                <button id="btn-set-ref" className="btn-primary" disabled>
                  Set
                </button>
              </div>
              <div id="plane-input" className="ref-input hidden">
                <span className="dim-label">W</span>
                <input
                  type="number"
                  id="plane-w"
                  placeholder="Width"
                  step="any"
                  min="0"
                />
                <span className="dim-x">&times;</span>
                <span className="dim-label">D</span>
                <input
                  type="number"
                  id="plane-d"
                  placeholder="Depth"
                  step="any"
                  min="0"
                />
                <select id="plane-unit">
                  <optgroup label="Imperial">
                    <option value="in">inches</option>
                    <option value="ft">feet</option>
                    <option value="yd">yards</option>
                    <option value="mi">miles</option>
                  </optgroup>
                  <optgroup label="Metric">
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="m">meters</option>
                    <option value="km">km</option>
                  </optgroup>
                </select>
                <button id="btn-set-plane" className="btn-primary" disabled>
                  Set
                </button>
              </div>
              <button
                id="btn-cal-toggle"
                className="cal-toggle hidden"
                type="button"
              ></button>
            </div>
          </div>

          <div id="instructions" className="instructions">
            Click two points on the image to set a{" "}
            <strong>reference line</strong> of known length.
          </div>

          <div id="canvas-wrap" className="canvas-wrap">
            <canvas id="canvas"></canvas>
            <div className="view-controls">
              <button id="btn-zoom-in" className="view-btn" title="Zoom in">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <button id="btn-zoom-out" className="view-btn" title="Zoom out">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <button id="btn-zoom-fit" className="view-btn" title="Fit to view">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <polyline points="9 3 9 9 3 9" />
                  <polyline points="15 3 15 9 21 9" />
                  <polyline points="9 21 9 15 3 15" />
                  <polyline points="15 21 15 15 21 15" />
                </svg>
              </button>
              <div className="view-sep"></div>
              <button
                id="btn-pan"
                className="view-btn"
                title="Pan mode (hold Space)"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 11V6a2 2 0 0 0-4 0v5" />
                  <path d="M14 10V4a2 2 0 0 0-4 0v6" />
                  <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
                  <path d="M18 11a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.7-2.4L3.7 18a2 2 0 0 1 3-2.5L8 17" />
                </svg>
              </button>
            </div>
          </div>

          <div id="result-bar" className="result-bar hidden">
            <span id="result-value"></span>
            <select id="output-unit" className="output-unit-select">
              <optgroup label="Imperial">
                <option value="in">in</option>
                <option value="ft">ft</option>
                <option value="yd">yd</option>
                <option value="mi">mi</option>
              </optgroup>
              <optgroup label="Metric">
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
                <option value="km">km</option>
              </optgroup>
            </select>
            <span id="result-badge"></span>
          </div>

          <div id="measure-history" className="history hidden">
            <h3>Measurements</h3>
            <ul id="history-list"></ul>
            <button id="btn-clear-history" className="btn-ghost">
              Clear all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
