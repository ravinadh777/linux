// SSE codec + incremental parser (Phase 3 — streaming; Phase 9 — reusable utils).
// The Python engine emits `data: <json>\n\n` frames. We parse them as they flow so
// the gateway can (a) forward bytes untouched to the browser and (b) accumulate
// conversation/form state for persistence — without buffering the whole stream.

/** Encode one event object as an SSE frame (matches agui/events.py::encode). */
export function encodeFrame(event) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Encode a named comment/heartbeat (ignored by EventSource, keeps proxies open). */
export function encodeComment(text = '') {
  return `: ${text}\n\n`;
}

/**
 * Stateful line-buffering SSE parser. Feed it raw chunks; it returns the complete
 * event objects decoded so far. Tolerates multi-line `data:` fields and CRLF.
 */
export class SseParser {
  constructor() {
    this._buf = '';
  }

  /**
   * @param {string} chunk decoded text chunk
   * @returns {object[]} fully-parsed event objects contained in this chunk
   */
  push(chunk) {
    this._buf += chunk;
    const events = [];
    let sep;
    // Frames are separated by a blank line (\n\n). Handle \r\n\r\n too.
    // eslint-disable-next-line no-cond-assign
    while ((sep = this._nextBoundary()) !== -1) {
      const rawFrame = this._buf.slice(0, sep.index);
      this._buf = this._buf.slice(sep.index + sep.length);
      const evt = this._decodeFrame(rawFrame);
      if (evt !== undefined) events.push(evt);
    }
    return events;
  }

  _nextBoundary() {
    const lf = this._buf.indexOf('\n\n');
    const crlf = this._buf.indexOf('\r\n\r\n');
    if (lf === -1 && crlf === -1) return -1;
    if (crlf === -1 || (lf !== -1 && lf < crlf)) return { index: lf, length: 2 };
    return { index: crlf, length: 4 };
  }

  _decodeFrame(frame) {
    const dataLines = [];
    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith(':')) continue; // comment/heartbeat
      if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
    }
    if (!dataLines.length) return undefined;
    const payload = dataLines.join('\n');
    try {
      return JSON.parse(payload);
    } catch {
      return { type: 'RAW', data: payload };
    }
  }
}
