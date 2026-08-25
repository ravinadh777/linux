// Minimal async mutex — serializes writers to a single JSON file (Architecture §6.4).
export class Mutex {
  constructor() {
    this._tail = Promise.resolve();
  }

  /**
   * Run `fn` exclusively; concurrent calls queue and run in arrival order.
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  runExclusive(fn) {
    const result = this._tail.then(() => fn());
    // keep the chain alive regardless of success/failure, but don't swallow the caller's result
    this._tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
