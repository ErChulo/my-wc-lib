import React from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

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
      // treat presence="" or "true" as true; "false" as false
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
  const {
    tagName,
    Component,
    props: propSchema,
    shadow = false,
    events = {},
  } = opts;

  if (!tagName.includes("-")) {
    throw new Error(
      `Custom element tagName must contain a hyphen: "${tagName}"`
    );
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

      // Define JS properties (so consumers can do el.start = 10, etc.)
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

      // Initialize propValues from current attributes once
      for (const [key, type] of Object.entries(propSchema)) {
        const parsed = parseAttr(this.getAttribute(key), type);
        if (parsed !== undefined) this._propValues[key] = parsed;
      }

      this.render();
    }

    attributeChangedCallback(
      name: string,
      _oldValue: string | null,
      _newValue: string | null
    ) {
      const type = propSchema[name];
      if (!type) return;
      const parsed = parseAttr(this.getAttribute(name), type);
      if (parsed === undefined) {
        delete this._propValues[name];
      } else {
        this._propValues[name] = parsed;
      }
      this.render();
    }

    disconnectedCallback() {
      this._root?.unmount();
      this._root = null;
    }

    private render() {
      if (!this._root) return;

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

  // Don’t throw if loaded twice; just skip re-definition.
  if (!customElements.get(tagName)) {
    customElements.define(tagName, ReactCustomElement);
  }
}
