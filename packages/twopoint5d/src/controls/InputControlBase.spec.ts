import {createSandbox} from 'sinon';
import {afterEach, describe, expect, test} from 'vitest';

import {InputControlBase} from './InputControlBase.js';

// addEventListener/removeEventListener are protected: a subclass is how a caller reaches
// them, and how this spec does
class TestControl extends InputControlBase {
  listen(host: EventTarget, eventName: string, callback: EventListener, passive?: boolean) {
    this.addEventListener(host, eventName, callback, passive);
  }

  unlisten(host: EventTarget, eventName: string, callback: EventListener) {
    this.removeEventListener(host, eventName, callback);
  }
}

describe('InputControlBase', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  test('hooks its listeners up and takes them off again', () => {
    const host = new EventTarget();
    const control = new TestControl();

    let calls = 0;
    const callback = () => {
      calls += 1;
    };

    control.listen(host, 'ping', callback);
    host.dispatchEvent(new Event('ping'));
    expect(calls, 'while alive').toBe(1);
    expect(control.isActive).toBe(true);

    control.unsubscribe();
    host.dispatchEvent(new Event('ping'));
    expect(calls, 'after unsubscribe()').toBe(1);
    expect(control.isActive).toBe(false);

    control.subscribe();
    host.dispatchEvent(new Event('ping'));
    expect(calls, 'after subscribe()').toBe(2);
    expect(control.isActive).toBe(true);
  });

  describe('the identity of a listener', () => {
    test('the same callback added once passive and once not is one listener, and one remove takes it off', () => {
      const host = new EventTarget();
      const control = new TestControl();
      let calls = 0;
      const callback = () => {
        calls += 1;
      };

      control.listen(host, 'ping', callback, true);
      control.listen(host, 'ping', callback, false);
      control.unlisten(host, 'ping', callback);

      host.dispatchEvent(new Event('ping'));
      expect(calls).toBe(0);
      expect(control.isActive).toBe(false);
    });

    test('a second add with another passive replaces the listener', () => {
      const host = new EventTarget();
      const control = new TestControl();
      const callback = (event: Event) => event.preventDefault();

      control.listen(host, 'ping', callback, true);
      control.listen(host, 'ping', callback, false);

      const event = new Event('ping', {cancelable: true});
      host.dispatchEvent(event);
      expect(event.defaultPrevented, 'the listener that is not passive prevents the default').toBe(true);

      // and the list hooks it up as the last add asked for
      control.unsubscribe();
      control.subscribe();
      const again = new Event('ping', {cancelable: true});
      host.dispatchEvent(again);
      expect(again.defaultPrevented, 'after subscribe()').toBe(true);
    });

    test('a second add with the same passive keeps the one listener, and one while unsubscribed waits for subscribe()', () => {
      const host = new EventTarget();
      const control = new TestControl();
      let calls = 0;
      const callback = (event: Event) => {
        calls += 1;
        event.preventDefault();
      };

      control.listen(host, 'ping', callback, true);
      control.listen(host, 'ping', callback, true);
      control.unsubscribe();
      const addEventListener = sandbox.spy(host, 'addEventListener');
      control.listen(host, 'ping', callback, false);
      expect(addEventListener.called, 'nothing reaches the host while unsubscribed').toBe(false);

      control.subscribe();
      const event = new Event('ping', {cancelable: true});
      host.dispatchEvent(event);

      expect(calls, 'one listener').toBe(1);
      expect(event.defaultPrevented, 'hooked up as the last add asked for').toBe(true);
    });
  });

  describe('dispose()', () => {
    // (a) "releases what it built itself" and (b) "does not touch what was handed in" have
    // no separate subject here: this class builds no resource of its own. What it holds are
    // listener registrations on hosts that belong to the caller, and the case below is both
    // their release and the proof that nothing else on the host is touched.

    test('takes its listeners off the host', () => {
      const host = new EventTarget();
      const removeEventListener = sandbox.spy(host, 'removeEventListener');
      const control = new TestControl();

      let calls = 0;
      const first = () => {
        calls += 1;
      };
      const second = () => {
        calls += 1;
      };

      control.listen(host, 'ping', first);
      control.listen(host, 'pong', second);

      control.dispose();

      expect(removeEventListener.callCount, 'one call per registration').toBe(2);

      host.dispatchEvent(new Event('ping'));
      host.dispatchEvent(new Event('pong'));

      expect(calls, 'no handler is reached any more').toBe(0);
    });

    test('destroyAllListeners() empties its list also when unsubscribe() of a subclass throws', () => {
      class ThrowingControl extends TestControl {
        override unsubscribe() {
          super.unsubscribe();
          throw new Error('unsubscribe fails on purpose');
        }
      }
      const host = new EventTarget();
      const control = new ThrowingControl();
      let calls = 0;
      control.listen(host, 'ping', () => {
        calls += 1;
      });

      expect(() => control.destroyAllListeners()).toThrow('unsubscribe fails on purpose');

      control.subscribe();
      host.dispatchEvent(new Event('ping'));
      expect(calls).toBe(0);
    });

    // (c) every public member behaves after dispose() as its TSDoc says
    test('behaves as documented after dispose()', () => {
      const host = new EventTarget();
      const control = new TestControl();
      const callback = () => {};

      control.listen(host, 'ping', callback);
      control.dispose();

      expect(control.isDisposed, 'isDisposed').toBe(true);
      expect(control.isActive, 'isActive').toBe(false);

      expect(() => control.subscribe()).not.toThrow();
      expect(() => control.unsubscribe()).not.toThrow();
      expect(() => control.destroyAllListeners()).not.toThrow();
      expect(() => control.unlisten(host, 'ping', callback)).not.toThrow();
      expect(() => control.dispose()).not.toThrow();
    });

    test('cannot be brought back', () => {
      const host = new EventTarget();
      const control = new TestControl();

      let calls = 0;
      const callback = () => {
        calls += 1;
      };

      control.dispose();

      control.subscribe();
      control.listen(host, 'ping', callback);
      control.isActive = true;

      expect(control.isActive, 'isActive').toBe(false);
      expect(control.isDisposed, 'isDisposed').toBe(true);

      host.dispatchEvent(new Event('ping'));

      expect(calls, 'no handler is reached').toBe(0);
    });

    test('takes no listener back after dispose()', () => {
      const host = new EventTarget();
      const control = new TestControl();

      control.dispose();

      control.listen(host, 'ping', () => {});

      // the list is private, so it is probed through the one method that walks it without a
      // guard of its own: unsubscribe() calls the host once per entry, and a control that
      // refused the registration has no entry to walk. What is at stake is not a listener
      // back on the host — #active is false, none would be hooked up — but the closure and
      // the host reference a spent control would go on holding
      const removeEventListener = sandbox.spy(host, 'removeEventListener');

      control.unsubscribe();

      expect(removeEventListener.callCount, 'entries left in the list').toBe(0);
    });

    // (d) the second call throws nothing and releases nothing a second time
    test('is safe to call twice', () => {
      const host = new EventTarget();
      const removeEventListener = sandbox.spy(host, 'removeEventListener');
      const control = new TestControl();

      control.listen(host, 'ping', () => {});

      expect(() => {
        control.dispose();
        control.dispose();
      }).not.toThrow();

      expect(removeEventListener.callCount, 'one call per registration').toBe(1);
    });

    test('destroyAllListeners() is not dispose()', () => {
      const host = new EventTarget();
      const control = new TestControl();

      let calls = 0;
      const callback = () => {
        calls += 1;
      };

      control.listen(host, 'ping', callback);
      control.destroyAllListeners();

      expect(control.isDisposed, 'isDisposed').toBe(false);

      // emptying the list also unsubscribes, so a fresh registration waits for a subscribe()
      // — and that subscribe() is what a disposed control no longer has
      control.listen(host, 'ping', callback);
      control.subscribe();
      host.dispatchEvent(new Event('ping'));

      expect(calls, 'the host gets its event again').toBe(1);
    });

    // (e) "leaks no signals and no effects" has no subject: this class creates neither.
    // (f) "gives every slot it took back" has no subject either: it takes no slot from a
    // pool or a factory.
  });
});
