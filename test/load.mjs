// Test loader: evaluates the card sources (src/strings.js then src/zigbee-card.js, in one block as the build does)
// in an isolated context with minimal browser stubs, and returns the requested bindings. The bundle is unchanged.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (name) => readFileSync(new URL(`../src/${name}.js`, import.meta.url), "utf8");

// `extra`: bindings that replace the stubs (fake timers…).
export const load = (names, extra = {}) => {
  class HTMLElement {
    attachShadow() {
      // Listeners kept by type, so tests can dispatch events to them.
      this.shadowRoot = {
        listeners: {},
        addEventListener(type, fn) {
          (this.listeners[type] ??= []).push(fn);
        },
        querySelector: () => null,
        innerHTML: "",
      };
      return this.shadowRoot;
    }
    dispatchEvent(ev) {
      (this.events ??= []).push(ev);
    }
    appendChild() {}
  }
  const registry = new Map();
  const docListeners = {};
  const context = {
    HTMLElement,
    customElements: { get: (n) => registry.get(n), define: (n, c) => registry.set(n, c) },
    window: {
      addEventListener(type, fn) {
        this[`on_${type}`] = fn;
      },
      removeEventListener(type, fn) {
        if (this[`on_${type}`] === fn) delete this[`on_${type}`];
      },
      dispatchEvent(ev) {
        (this.events ??= []).push(ev);
      },
    },
    // The document's capture listeners by type, so tests can tap outside a card.
    document: {
      listeners: docListeners,
      addEventListener(type, fn) {
        (docListeners[type] ??= new Set()).add(fn);
      },
      removeEventListener(type, fn) {
        docListeners[type]?.delete(fn);
      },
      createElement: (tag) => ({ tag, addEventListener() {}, appendChild() {} }),
    },
    history: {
      pushState(_s, _t, path) {
        this.path = path;
      },
    },
    console: { info() {}, error() {}, log() {}, warn() {} },
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    CSS: { escape: (s) => String(s) },
    setInterval: () => 0,
    clearInterval() {},
    setTimeout,
    clearTimeout,
    Intl,
    Date,
    Promise,
    out: null,
    ...extra,
  };
  vm.createContext(context);
  vm.runInContext(`{\n${read("strings")}\n${read("zigbee-card")}\nout = ({ ${names.join(", ")} });\n}`, context);
  return context.out;
};
