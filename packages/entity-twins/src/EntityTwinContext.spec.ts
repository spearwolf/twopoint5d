import {EntityTwin} from './EntityTwin';
import {EntityTwinContext} from './EntityTwinContext';
import {EntityChangeType} from './types';

describe('EntityTwinContext', () => {
  const ctx = EntityTwinContext.get();

  afterAll(() => {
    ctx.clear();
  });

  it('should be defined', () => {
    expect(EntityTwinContext).toBeDefined();
  });

  it('should insert create-entity and destroy-entites in change trail', () => {
    const a = new EntityTwin('a');
    const b = new EntityTwin('b', a);

    let changes = ctx.buildChangeTrails();

    expect(changes).toHaveLength(2);
    expect(changes).toEqual([
      {type: EntityChangeType.CreateEntity, uuid: a.uuid, token: 'a'},
      {type: EntityChangeType.CreateEntity, uuid: b.uuid, token: 'b', parentUuid: a.uuid},
    ]);

    a.destroy();

    changes = ctx.buildChangeTrails();

    expect(changes).toHaveLength(2);
    expect(changes).toEqual([
      {type: EntityChangeType.SetParent, uuid: b.uuid, parentUuid: undefined},
      {type: EntityChangeType.DestroyEntity, uuid: a.uuid},
    ]);
  });
});
