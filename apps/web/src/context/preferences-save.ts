/** Keep slow saves from overwriting a more recent preference snapshot. */
export class PreferenceSaveQueue {
  private pending: Promise<unknown> = Promise.resolve();

  run<T>(save: () => Promise<T>): Promise<T> {
    const result = this.pending.catch(() => undefined).then(save);
    this.pending = result;
    return result;
  }
}
