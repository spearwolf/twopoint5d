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

  it('should insert change-properties in change trail', () => {
    const a = new EntityTwin('a');
    const b = new EntityTwin('b', a);

    a.setProperty('foo', 'bar');
    a.setProperty('plah', 42);
    a.removeProperty('plah');

    let changes = ctx.buildChangeTrails();

    expect(changes).toHaveLength(2);
    expect(changes).toEqual([
      {type: EntityChangeType.CreateEntity, uuid: a.uuid, token: 'a', properties: [['foo', 'bar']]},
      {type: EntityChangeType.CreateEntity, uuid: b.uuid, token: 'b', parentUuid: a.uuid},
    ]);

    a.setProperty('foo', 'bar');
    a.setProperty('plah', 42);
    b.setProperty('xyz', 123);
    b.setProperty('numberOfTheBeast', 666);

    changes = ctx.buildChangeTrails();

    expect(changes).toHaveLength(2);
    expect(changes).toEqual([
      {type: EntityChangeType.ChangeProperties, uuid: a.uuid, properties: [['plah', 42]]},
      {
        type: EntityChangeType.ChangeProperties,
        uuid: b.uuid,
        properties: [
          ['xyz', 123],
          ['numberOfTheBeast', 666],
        ],
      },
    ]);
  });
});
