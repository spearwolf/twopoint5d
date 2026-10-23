import {once, Priority} from '@spearwolf/eventize';
import {type AnyTextureResource, TextureResourceEvents} from './TextureResource.js';

// what was booked on one instance, and whether a hold still lands there: a round closes when its
// instance is disposed, when the next one is handed over and when the follower is disposed
interface Round {
  readonly releases: Array<() => void>;
  open: boolean;
}

/**
 * Follows the resource a `TextureStore` carries under one id, from instance to instance: the one
 * there now, the next one a `parse()` announces, and after a direct dispose the one that takes its
 * place. `TextureStore#on()` and `TextureStore#getAsync()` subscribe through it.
 *
 * - The same instance is never handed over twice, however often a `parse()` announces it again.
 * - A `hold(release)` binds `release` to the instance it was handed with: it runs when that
 *   instance is disposed, when the next one is handed over and when the follower is disposed. A
 *   `hold()` after any of these runs `release` at once — `on()` can deliver a retained value
 *   synchronously, before it has returned the unsubscribe function the caller is about to hold.
 * - `dispose()` may come from inside `onResource` — a `getAsync()` that settles there: nothing is
 *   handed over afterwards, and every later `hold()` of that round releases at once.
 * - After the dispose of an instance the follower reads `current()` anew. The store takes the
 *   instance out of its map at `Priority.Max`, before this hears the dispose, so the follower waits
 *   for the next announcement.
 */
export class ResourceFollower {
  readonly #current: () => AnyTextureResource | undefined;
  readonly #announced: (callback: (resource: AnyTextureResource) => void) => () => void;

  #onResource?: (resource: AnyTextureResource, hold: (release: () => void) => void) => void;
  readonly #handedOver = new WeakSet<AnyTextureResource>();
  #round?: Round;
  #unsubscribeFromAnnounced?: () => void;
  #disposed = false;

  // `current` answers the resource the store carries under the id right now; `announced`
  // subscribes to every announcement of a resource under the id (the `resource:<id>` event of
  // the store) and answers its unsubscribe
  constructor(
    current: () => AnyTextureResource | undefined,
    announced: (callback: (resource: AnyTextureResource) => void) => () => void,
  ) {
    this.#current = current;
    this.#announced = announced;
  }

  // hands `onResource` every instance under the id once: the current one at once, else the next
  // one announced, and after a direct dispose of an instance the one that takes its place. A second
  // call, and one after dispose(), does nothing
  follow(onResource: (resource: AnyTextureResource, hold: (release: () => void) => void) => void): void {
    if (this.#disposed || this.#onResource) return;
    this.#onResource = onResource;
    this.#followCurrent();
  }

  // releases everything it holds; a second call does nothing
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#closeRound();
    this.#unsubscribeFromAnnounced?.();
    this.#unsubscribeFromAnnounced = undefined;
  }

  // The instance there now, or the next one announced. The subscription to the announcements stays
  // once it is made: every parse() that names the id announces its resource, and an instance that
  // has been handed over already is passed by
  #followCurrent(): void {
    const current = this.#current();
    if (current && !this.#handedOver.has(current)) {
      this.#handOver(current);
      return;
    }
    this.#unsubscribeFromAnnounced ??= this.#announced((resource) => this.#handOver(resource));
  }

  #handOver(resource: AnyTextureResource): void {
    const onResource = this.#onResource;
    if (this.#disposed || !onResource || this.#handedOver.has(resource)) return;
    this.#handedOver.add(resource);
    this.#closeRound();

    const round: Round = {releases: [], open: true};
    this.#round = round;
    // At Priority.Min, behind every listener a hold put up on the dispose of the instance: releasing
    // the round takes those listeners off, and one that has not heard the dispose yet would miss it
    round.releases.push(
      once(resource, TextureResourceEvents.Dispose, Priority.Min, () => {
        if (this.#round !== round) return;
        this.#closeRound();
        this.#followCurrent();
      }),
    );
    onResource(resource, (release) => {
      if (round.open) {
        round.releases.push(release);
      } else {
        release();
      }
    });
  }

  #closeRound(): void {
    const round = this.#round;
    if (!round) return;
    this.#round = undefined;
    round.open = false;
    for (const release of round.releases) release();
    round.releases.length = 0;
  }
}
