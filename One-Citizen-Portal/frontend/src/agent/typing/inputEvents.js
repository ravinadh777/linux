// InputEventDispatcher — dispatches the COMPLETE browser input lifecycle on a real DOM node,
// so React (onChange/onInput/onBlur), React Hook Form, Formik, MUI, masks, validators,
// dependent fields and conditional rendering all react exactly as if a human typed.
//
// The critical detail: React tracks an input's value on the node and de-dupes changes. Setting
// `node.value = x` directly is ignored by React. We use the NATIVE prototype setter to bypass
// React's value tracker, then dispatch a real `input` event — the documented technique for
// programmatic changes that React's synthetic onChange will honour.

function nativeValueSetter(el) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  return Object.getOwnPropertyDescriptor(proto, 'value')?.set;
}

/** Set a value the way React can see it (bypasses React's value tracker). */
export function setNativeValue(el, value) {
  const setter = nativeValueSetter(el);
  if (setter) setter.call(el, value);
  else el.value = value; // last-resort fallback
}

function key(el, type, char) {
  el.dispatchEvent(new KeyboardEvent(type, { key: char, bubbles: true, cancelable: true }));
}

function beforeInput(el, char) {
  try {
    el.dispatchEvent(new InputEvent('beforeinput', { data: char, inputType: 'insertText', bubbles: true, cancelable: true }));
  } catch { /* InputEvent ctor unsupported — safe to skip */ }
}

function inputEvent(el, char) {
  try {
    el.dispatchEvent(new InputEvent('input', { data: char, inputType: 'insertText', bubbles: true }));
  } catch {
    el.dispatchEvent(new Event('input', { bubbles: true })); // React still fires onChange
  }
}

/**
 * Simulate ONE keystroke: keydown → keypress → beforeinput → (value grows) → input → keyup.
 * `cumulative` is the field's full value up to and including this character.
 */
export function typeKeystroke(el, char, cumulative) {
  key(el, 'keydown', char);
  key(el, 'keypress', char);
  beforeInput(el, char);
  setNativeValue(el, cumulative);
  inputEvent(el, char);
  key(el, 'keyup', char);
}

/** Set a whole value at once but still through a real input event (dates, long values, masks). */
export function setValueViaInput(el, value) {
  setNativeValue(el, value);
  inputEvent(el, value);
}

export function focusField(el) {
  try { el.focus({ preventScroll: true }); } catch { el.focus?.(); }
  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('focus', { bubbles: false }));
}

export function blurField(el) {
  el.dispatchEvent(new Event('change', { bubbles: true })); // native change (fires on real blur)
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
  try { el.blur?.(); } catch { /* noop */ }
}
