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
  events: { onChange: "change" }, // Counter calls onChange(value) -> DOM event "change"
  shadow: "open",
});
