import {emit, eventize, getSubscriptionCount, on, once, Priority} from '@spearwolf/eventize';
import {describe, expect, test, vi} from 'vitest';
import {ResourceFollower} from './ResourceFollower.js';
import {type AnyTextureResource, TextureResource, TextureResourceEvents} from './TextureResource.js';

// A store as the follower sees it: the resource it carries under one id, an announcement event,
// and the Priority.Max listener that takes a resource disposed directly out of its map
const stubStore = () => {
  const store = eventize({});
  let carried: AnyTextureResource | undefined;

  const carry = (resource: AnyTextureResource) => {
    carried = resource;
    once(resource, TextureResourceEvents.Dispose, Priority.Max, () => {
      if (carried === resource) carried = undefined;
    });
  };
  const announce = (resource: AnyTextureResource) => {
    if (carried !== resource) carry(resource);
    emit(store, 'resource:a', resource);
  };
  const follower = new ResourceFollower(
    () => carried,
    (announced) => on(store, 'resource:a', announced),
  );

  return {store, follower, carry, announce};
};

const imageResource = (url = 'a.png') => TextureResource.fromImage('a', url);

describe('ResourceFollower', () => {
  test('hands over the instance there now at once', () => {
    const {follower, carry} = stubStore();
    const a = imageResource();
    carry(a);
    const onResource = vi.fn();

    follower.follow(onResource);

    expect(onResource).toHaveBeenCalledExactlyOnceWith(a, expect.any(Function));
    follower.dispose();
    a.dispose();
  });

  test('without an instance waits for the next announcement', () => {
    const {follower, announce} = stubStore();
    const onResource = vi.fn();

    follower.follow(onResource);
    expect(onResource).not.toHaveBeenCalled();

    const a = imageResource();
    announce(a);

    expect(onResource).toHaveBeenCalledExactlyOnceWith(a, expect.any(Function));
    follower.dispose();
    a.dispose();
  });

  test('hands over the same instance once, however often it is announced', () => {
    const {follower, announce} = stubStore();
    const onResource = vi.fn();
    follower.follow(onResource);

    const a = imageResource();
    announce(a);
    announce(a);
    announce(a);

    expect(onResource).toHaveBeenCalledOnce();
    follower.dispose();
    a.dispose();
  });

  test('after the dispose of the instance its holds are released and the next instance announced is handed over', () => {
    const {follower, carry, announce} = stubStore();
    const a = imageResource();
    carry(a);
    const releasedA = vi.fn();
    const handed: AnyTextureResource[] = [];
    follower.follow((resource, hold) => {
      handed.push(resource);
      if (resource === a) hold(releasedA);
    });

    a.dispose();

    expect(releasedA).toHaveBeenCalledOnce();
    expect(handed).toEqual([a]);

    const b = imageResource('b.png');
    announce(b);

    expect(handed).toEqual([a, b]);
    expect(releasedA).toHaveBeenCalledOnce();
    follower.dispose();
    b.dispose();
  });

  test('a listener a hold put up on the dispose of the instance hears it before the hold is released', () => {
    const {follower, carry} = stubStore();
    const a = imageResource();
    carry(a);
    const heard = vi.fn();
    follower.follow((resource, hold) => {
      hold(once(resource, TextureResourceEvents.Dispose, heard));
    });

    a.dispose();

    expect(heard).toHaveBeenCalledOnce();
    follower.dispose();
  });

  test('the next instance handed over releases the holds of the one before', () => {
    const {follower, announce} = stubStore();
    const released = vi.fn();
    const handed: AnyTextureResource[] = [];
    follower.follow((resource, hold) => {
      handed.push(resource);
      hold(() => released(resource));
    });

    // waiting for an announcement, the follower hears every one that comes after
    const a = imageResource();
    announce(a);
    const b = imageResource('b.png');
    announce(b);

    expect(handed).toEqual([a, b]);
    expect(released).toHaveBeenCalledExactlyOnceWith(a);
    follower.dispose();
    a.dispose();
    b.dispose();
  });

  test('dispose() releases everything it holds and hands over nothing afterwards', () => {
    const {store, follower, carry, announce} = stubStore();
    const a = imageResource();
    carry(a);
    const released = vi.fn();
    const onResource = vi.fn((_resource: AnyTextureResource, hold: (release: () => void) => void) => hold(released));
    follower.follow(onResource);
    a.dispose();
    const b = imageResource('b.png');
    announce(b);
    onResource.mockClear();
    released.mockClear();

    follower.dispose();

    expect(released).toHaveBeenCalledOnce();
    expect(getSubscriptionCount(store)).toBe(0);
    const c = imageResource('c.png');
    announce(c);
    expect(onResource).not.toHaveBeenCalled();
    // a second call does nothing
    follower.dispose();
    expect(released).toHaveBeenCalledOnce();
    b.dispose();
    c.dispose();
  });

  test('a hold() after dispose() releases at once', () => {
    const {follower, carry} = stubStore();
    const a = imageResource();
    carry(a);
    let holdOfA: ((release: () => void) => void) | undefined;
    follower.follow((_resource, hold) => {
      holdOfA = hold;
    });

    follower.dispose();
    const released = vi.fn();
    holdOfA?.(released);

    expect(released).toHaveBeenCalledOnce();
    a.dispose();
  });

  test('a dispose() from inside onResource ends the round: every later hold of it releases at once, and nothing is handed over afterwards', () => {
    const {follower, carry, announce} = stubStore();
    const a = imageResource();
    carry(a);
    const before = vi.fn();
    const after = vi.fn();
    const onResource = vi.fn((_resource: AnyTextureResource, hold: (release: () => void) => void) => {
      hold(before);
      follower.dispose();
      hold(after);
    });

    follower.follow(onResource);

    expect(before).toHaveBeenCalledOnce();
    expect(after).toHaveBeenCalledOnce();
    a.dispose();
    const b = imageResource('b.png');
    announce(b);
    expect(onResource).toHaveBeenCalledOnce();
    b.dispose();
  });

  test('follow() after dispose() hands over nothing', () => {
    const {follower, carry} = stubStore();
    const a = imageResource();
    carry(a);
    const onResource = vi.fn();

    follower.dispose();
    follower.follow(onResource);

    expect(onResource).not.toHaveBeenCalled();
    a.dispose();
  });
});
