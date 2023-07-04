import {EventizeApi} from '@spearwolf/eventize';
import {EntitiesDirectLink} from './EntitiesDirectLink';
import {EntitiesLink} from './EntitiesLink';
import {Entity} from './Entity';
import {EntityRegistry} from './EntityRegistry';
import {EntityTwin} from './EntityTwin';
import {EntityTwinContext} from './EntityTwinContext';
import {EntityUplink} from './EntityUplink';
import {OnCreate, OnInit, OnRemoveFromParent} from './events';
import {EntitiesSyncEvent, EntityChangeType} from './types';

const nextSyncEvent = (link: EntitiesLink): Promise<EntitiesSyncEvent> =>
  new Promise((resolve) => {
    link.once(EntitiesLink.OnSync, resolve);
  });

const waitForNext = (obj: EventizeApi, event: string | symbol): Promise<unknown[]> =>
  new Promise((resolve) => {
    obj.once(event, (...args: unknown[]) => resolve(args));
  });

describe('EntitiesDirectLink', () => {
  const ctx = EntityTwinContext.get();

  afterAll(() => {
    ctx.clear();
  });

  it('should be defined', () => {
    expect(EntitiesDirectLink).toBeDefined();
  });

  it('should start', async () => {
    const link = new EntitiesDirectLink();

    expect(link.isReady).toBe(false);

    link.start();

    expect(link.isReady).toBe(true);

    await expect(link.ready).resolves.toBe(link);
  });

  it('should sync', async () => {
    const directLink = new EntitiesDirectLink().start();

    const a = new EntityTwin('a');
    const b = new EntityTwin('b', a);

    a.setProperty('foo', 'bar');
    b.setProperty('xyz', 123);

    directLink.sync();

    const event = await nextSyncEvent(directLink);

    expect(event.changeTrail).toEqual([
      {type: EntityChangeType.CreateEntity, token: 'a', uuid: a.uuid, properties: [['foo', 'bar']]},
      {type: EntityChangeType.CreateEntity, token: 'b', uuid: b.uuid, parentUuid: a.uuid, properties: [['xyz', 123]]},
    ]);
  });

  it('should create entities within kernel', async () => {
    const directLink = new EntitiesDirectLink().start();

    const a = new EntityTwin('a');
    const b = new EntityTwin('b', a);

    a.setProperty('foo', 'bar');
    b.setProperty('xyz', 123);

    await directLink.sync();

    const aa = directLink.kernel.getEntity(a.uuid);
    const bb = directLink.kernel.getEntity(b.uuid);

    expect(aa).toBeDefined();
    expect(aa.getProperty('foo')).toBe('bar');
    expect(aa.children).toHaveLength(1);

    expect(bb).toBeDefined();
    expect(bb.parent).toBe(aa);
    expect(aa.children[0]).toBe(bb);
    expect(bb.getProperty('xyz')).toBe(123);
    expect(bb.children).toHaveLength(0);

    const onRemoveFromParent = jest.fn();

    @Entity({registry: directLink.kernel.registry, token: 'c'})
    class EntityCcc implements OnRemoveFromParent {
      [OnRemoveFromParent](_uplink: EntityUplink) {
        onRemoveFromParent(this);
      }
    }

    const c = new EntityTwin('c', a, -1);

    await directLink.sync();

    const cc = directLink.kernel.getEntity(c.uuid);

    expect(aa.children).toHaveLength(2);
    expect(aa.children[0]).toBe(cc);
    expect(aa.children[1]).toBe(bb);

    expect(onRemoveFromParent).not.toHaveBeenCalled();

    const removeFromParent = waitForNext(cc, OnRemoveFromParent).then(([entity]) => (entity as EntityUplink).uuid);

    c.removeFromParent();

    await directLink.sync();

    expect(aa.children).toHaveLength(1);
    expect(cc.parent).toBeUndefined();

    expect(onRemoveFromParent).toHaveBeenCalled();
    expect(onRemoveFromParent.mock.calls[0][0]).toBeInstanceOf(EntityCcc);

    await expect(removeFromParent).resolves.toBe(cc.uuid);
  });

  it('should create entity components', async () => {
    const directLink = new EntitiesDirectLink().start();
    const registry = new EntityRegistry();

    directLink.kernel.registry = registry;

    const onCreateMock = jest.fn();
    const onInitMock = jest.fn();

    @Entity({registry, token: 'a'})
    class Aaa implements OnCreate, OnInit {
      [OnCreate](uplink: EntityUplink) {
        onCreateMock(uplink, this);
      }
      [OnInit](uplink: EntityUplink) {
        onInitMock(uplink, this);
      }
    }

    const a = new EntityTwin('a');
    a.setProperty('foo', 'bar');

    await directLink.sync();

    const aa = directLink.kernel.getEntity(a.uuid);

    expect(aa).toBeDefined();
    expect(aa.getProperty('foo')).toBe('bar');

    expect(Aaa).toBeDefined();

    expect(onCreateMock).toBeCalled();
    expect(onCreateMock.mock.calls[0][0]).toBe(aa);
    expect(onCreateMock.mock.calls[0][1]).toBeInstanceOf(Aaa);

    expect(onInitMock).toBeCalled();
    expect(onInitMock.mock.calls[0][0]).toBe(aa);
    expect(onInitMock.mock.calls[0][1]).toBeInstanceOf(Aaa);
  });
});
