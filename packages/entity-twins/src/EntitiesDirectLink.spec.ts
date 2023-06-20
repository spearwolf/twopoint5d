import {EventizeApi} from '@spearwolf/eventize';
import {EntitiesDirectLink} from './EntitiesDirectLink';
import {EntitiesLink} from './EntitiesLink';
import {EntityTwin} from './EntityTwin';
import {EntityTwinContext} from './EntityTwinContext';
import {OnRemoveFromParent} from './events';
import {EntitiesSyncEvent, EntityChangeType} from './types';
import {EntityUplink} from './EntityUplink';

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

    const c = new EntityTwin('c', a, -1);

    await directLink.sync();

    const cc = directLink.kernel.getEntity(c.uuid);

    expect(aa.children).toHaveLength(2);
    expect(aa.children[0]).toBe(cc);
    expect(aa.children[1]).toBe(bb);

    const removeFromParent = waitForNext(cc, OnRemoveFromParent).then(([entity]) => (entity as EntityUplink).uuid);

    c.removeFromParent();

    // TODO check if removeFromParent is called before entity is destroyed

    await directLink.sync();

    expect(aa.children).toHaveLength(1);
    expect(cc.parent).toBeUndefined();

    await expect(removeFromParent).resolves.toBe(cc.uuid);
  });
});
