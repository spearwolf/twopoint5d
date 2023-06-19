import {EntitiesDirectLink} from './EntitiesDirectLink';
import {EntitiesLink} from './EntitiesLink';
import {EntityTwin} from './EntityTwin';
import {EntityTwinContext} from './EntityTwinContext';
import {EntitiesSyncEvent, EntityChangeType} from './types';

const nextSyncEvent = (link: EntitiesLink): Promise<EntitiesSyncEvent> =>
  new Promise((resolve) => {
    link.once(EntitiesLink.OnSync, resolve);
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
});
