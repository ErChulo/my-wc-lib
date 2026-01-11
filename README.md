````md
# Vite + React → Web Components (Custom Elements) → Single JS Bundle → GitHub → CDN (jsDelivr)

A repeatable template to build **React components** that are consumed like **native Web Components** from a **single CDN `<script>`** in any plain HTML file—no runtime app server required.

This recipe produces a single **IIFE** JavaScript bundle (classic `<script src="...">`) that registers custom elements (e.g., `<x-hello-card>`). It is suitable for publishing via a GitHub repo + jsDelivr.

---

## 0) Prerequisites (Windows)

Install:
- **Node.js LTS** (includes npm)
- **Git**
- **VS Code**

Verify in **Git Bash**:
```bash
node -v
npm -v
git --version
````

Configure git identity:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

---

## 1) Create a Vite + React project (TypeScript)

```bash
mkdir my-wc-lib
cd my-wc-lib
npm create vite@latest . -- --template react-ts
npm install
code .
```

---

## 2) Add example React components

Create: `src/components/HelloCard.tsx`

```tsx
import React from "react";

export type HelloCardProps = {
  name?: string;
};

export function HelloCard({ name = "World" }: HelloCardProps) {
  return (
    <div style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <h3 style={{ margin: 0 }}>Hello, {name}!</h3>
      <p style={{ margin: "8px 0 0" }}>
        This is a React component shipped as a Web Component.
      </p>
    </div>
  );
}
```

Create: `src/components/Counter.tsx`

```tsx
import React from "react";

export type CounterProps = {
  start?: number;
  step?: number;
  onChange?: (value: number) => void; // bridged to a DOM CustomEvent
};

export function Counter({ start = 0, step = 1, onChange }: CounterProps) {
  const [value, setValue] = React.useState(start);

  React.useEffect(() => {
    setValue(start);
  }, [start]);

  function inc() {
    const next = value + step;
    setValue(next);
    onChange?.(next);
  }

  return (
    <div style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <div style={{ fontSize: 18, marginBottom: 8 }}>Value: {value}</div>
      <button onClick={inc}>+{step}</button>
    </div>
  );
}
```

---

## 3) Create a React → CustomElement wrapper utility

Create: `src/wc/defineReactCustomElement.tsx`

```tsx
import React from "react";
import { createRoot, Root } from "react-dom/client";

type PropType = "string" | "number" | "boolean" | "json";
type PropSchema = Record<string, PropType>;

function parseAttr(value: string | null, type: PropType) {
  if (value === null) return undefined;

  switch (type) {
    case "string":
      return value;
    case "number": {
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined;
    }
    case "boolean":
      // presence="" or "true" => true; "false" => false
      return value === "" || value.toLowerCase() === "true";
    case "json":
      try {
        return JSON.parse(value);
      } catch {
        return undefined;
      }
  }
}

export function defineReactCustomElement<P extends object>(opts: {
  tagName: string;
  Component: React.ComponentType<P>;
  props: PropSchema;
  shadow?: "open" | "closed" | false;
  events?: Record<string, string>; // { reactPropName: domEventName }
}) {
  const { tagName, Component, props: propSchema, shadow = false, events = {} } = opts;

  if (!tagName.includes("-")) {
    throw new Error(`Custom element tagName must contain a hyphen: "${tagName}"`);
  }

  class ReactCustomElement extends HTMLElement {
    static get observedAttributes() {
      return Object.keys(propSchema);
    }

    private _root: Root | null = null;
    private _mount: HTMLElement | null = null;
    private _propValues: Record<string, unknown> = {};

    connectedCallback() {
      if (!this._mount) {
        if (shadow) {
          const sr = this.attachShadow({ mode: shadow });
          this._mount = document.createElement("div");
          sr.appendChild(this._mount);
        } else {
          this._mount = document.createElement("div");
          this.appendChild(this._mount);
        }
      }

      if (!this._root) {
        this._root = createRoot(this._mount!);
      }

      // Define JS properties (so consumers can do: el.start = 10)
      for (const key of Object.keys(propSchema)) {
        if (Object.prototype.hasOwnProperty.call(this, key)) continue;

        Object.defineProperty(this, key, {
          get: () => this._propValues[key],
          set: (v) => {
            this._propValues[key] = v;
            this.render();
          },
        });
      }

      // Init from attributes once
      for (const [key, type] of Object.entries(propSchema)) {
        const parsed = parseAttr(this.getAttribute(key), type);
        if (parsed !== undefined) this._propValues[key] = parsed;
      }

      this.render();
    }

    attributeChangedCallback(name: string) {
      const type = propSchema[name];
      if (!type) return;

      const parsed = parseAttr(this.getAttribute(name), type);
      if (parsed === undefined) delete this._propValues[name];
      else this._propValues[name] = parsed;

      this.render();
    }

    disconnectedCallback() {
      this._root?.unmount();
      this._root = null;
    }

    private render() {
      if (!this._root) return;

      // Bridge React callbacks to DOM events
      const eventProps: Record<string, unknown> = {};
      for (const [reactPropName, domEventName] of Object.entries(events)) {
        eventProps[reactPropName] = (detail: unknown) => {
          this.dispatchEvent(
            new CustomEvent(domEventName, {
              detail,
              bubbles: true,
              composed: true,
            })
          );
        };
      }

      const allProps = { ...(this._propValues as P), ...(eventProps as P) };

      this._root.render(
        <React.StrictMode>
          <Component {...allProps} />
        </React.StrictMode>
      );
    }
  }

  // Safe to load twice (CDN cache / multi-page)
  if (!customElements.get(tagName)) {
    customElements.define(tagName, ReactCustomElement);
  }
}
```

---

## 4) Create the single library entrypoint that registers all components

Create: `src/entry.tsx`

```tsx
import { defineReactCustomElement } from "./wc/defineReactCustomElement";
import { HelloCard } from "./components/HelloCard";
import { Counter } from "./components/Counter";

defineReactCustomElement({
  tagName: "x-hello-card",
  Component: HelloCard,
  props: { name: "string" },
  shadow: "open",
});

defineReactCustomElement({
  tagName: "x-counter",
  Component: Counter,
  props: { start: "number", step: "number" },
  events: { onChange: "change" }, // Counter's onChange(value) -> DOM event "change"
  shadow: "open",
});
```

Result: loading the final bundle will define the custom elements:

* `<x-hello-card name="Ada"></x-hello-card>`
* `<x-counter start="10" step="5"></x-counter>`

---

## 5) Configure Vite to emit a SINGLE classic-script bundle (IIFE)

### 5.1 Install “inject CSS into JS” plugin (recommended)

If your components import CSS, this helps keep “single JS file” output:

```bash
npm i -D vite-plugin-css-injected-by-js
```

### 5.2 Replace `vite.config.ts`

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import path from "node:path";

export default defineConfig({
  // IMPORTANT: prevents runtime "process is not defined" in library builds
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  plugins: [react(), cssInjectedByJsPlugin()],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/entry.tsx"),
      name: "MyWcComponents",
      formats: ["iife"], // supports plain <script src="..."></script>
      fileName: () => "my-wc-components.iife.js",
    },
    rollupOptions: {
      output: {
        // keep to one file (avoid chunking)
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
  },
});
```

---

## 6) Build the bundle

```bash
npm run build
```

Output:

* `dist/my-wc-components.iife.js`

Optional quick check:

```bash
grep -n "process" dist/my-wc-components.iife.js | head
```

You should not see runtime `process` usage.

---

## 7) Local “no server” test with a plain HTML file

Create `demo.html` in the project root:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Web Components Demo</title>

    <!-- Local test: load the built file directly -->
    <script src="./dist/my-wc-components.iife.js"></script>
  </head>
  <body>
    <h2>Demo</h2>

    <x-hello-card name="Ada"></x-hello-card>
    <x-counter start="10" step="5"></x-counter>

    <script>
      const counter = document.querySelector("x-counter");
      counter.addEventListener("change", (e) => {
        console.log("Counter changed:", e.detail);
      });

      // property-style usage also works
      counter.start = 100;
      counter.step = 10;
    </script>
  </body>
</html>
```

Open `demo.html` by double-clicking it (file://).

Because this is an **IIFE bundle** loaded by a classic `<script>`, it avoids ES-module import CORS constraints in the consumer HTML.

---

## 8) Prepare the repo for CDN hosting (commit the dist output)

### 8.1 Ensure `dist/` is NOT ignored

Open `.gitignore` and remove any lines like:

```
dist
dist/
```

Reason: jsDelivr (GitHub CDN) serves files that exist in your GitHub repository; if `dist/` isn’t committed, the CDN URL will 404.

### 8.2 Commit

```bash
git init
git add .
git commit -m "Initial React web components library (single-file IIFE build)"
```

---

## 9) Create the GitHub repo and push

### 9.1 Create a repository on GitHub (web UI)

* GitHub → New repository
* Name: `my-wc-lib` (example)
* Public recommended for frictionless CDN usage

### 9.2 Push

```bash
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/my-wc-lib.git
git push -u origin main
```

(If prompted for password over HTTPS, use a GitHub Personal Access Token.)

---

## 10) Tag a version (recommended for stable CDN URLs)

```bash
git tag v0.1.0
git push origin v0.1.0
```

---

## 11) Consume from any HTML page via jsDelivr CDN

Use a pinned tag (recommended):

```html
<script src="https://cdn.jsdelivr.net/gh/<YOUR_USERNAME>/my-wc-lib@v0.1.0/dist/my-wc-components.iife.js"></script>

<x-hello-card name="Remote"></x-hello-card>
<x-counter start="1" step="2"></x-counter>
```

---

## 12) Release/update workflow (repeatable)

When you change components:

```bash
npm run build
git add .
git commit -m "Update components"
git tag v0.1.1
git push origin main
git push origin v0.1.1
```

Consumers update their script URL from `@v0.1.0` to `@v0.1.1`.

---

## 13) Practical constraints and tips

### Single-script consumption

* Use IIFE output and classic `<script src="..."></script>`.
* Avoid runtime `import` statements in the distributed file.

### Styling

* Prefer Shadow DOM (`shadow: "open"`) for drop-in widgets with encapsulated styles.
* If using global CSS frameworks that must “pierce” components, set `shadow: false` or manually inject CSS into the shadow root.

### Events

* Bridge React callbacks to DOM events using `CustomEvent`.
* Keep event names stable for consumers (e.g., `"change"`, `"ready"`, `"submit"`).

### External libraries

* Prefer browser-ready builds.
* If you see Node-global errors (e.g., `process`, `Buffer`), add `define` replacements or choose a browser build of the dependency.

---

## 14) Minimal checklist (for future projects)

1. `npm create vite@latest ... --template react-ts`
2. Build React components in `src/components/`
3. Add wrapper `src/wc/defineReactCustomElement.tsx`
4. Register elements in `src/entry.tsx`
5. Configure `vite.config.ts`:

   * `formats: ["iife"]`
   * `inlineDynamicImports: true`
   * `manualChunks: undefined`
   * `define: { "process.env.NODE_ENV": "production" }`
   * optional CSS injection plugin
6. `npm run build` → verify `dist/*.js`
7. Confirm `demo.html` works from file://
8. Ensure `dist/` is committed (remove from `.gitignore` if needed)
9. Push to GitHub
10. Tag release (`vX.Y.Z`)
11. Use jsDelivr URL in plain HTML

```
::contentReference[oaicite:0]{index=0}
```
