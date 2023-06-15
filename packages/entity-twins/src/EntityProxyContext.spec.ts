import {EntityProxy} from './EntityProxy';
import {EntityProxyContext} from './EntityProxyContext';
import {EntityChangeType} from './types';

describe('EntityProxyContext', () => {
  const ctx = EntityProxyContext.get();

  afterAll(() => {
    ctx.clear();
  });

  it('should be defined', () => {
    expect(EntityProxyContext).toBeDefined();
  });

  it('should insert create-entity and destroy-entites in change trail', () => {
    const a = new EntityProxy('a');
    const b = new EntityProxy('b', a);

    let changes = ctx.buildChangeTrails();

    console.log('changes[create]', changes);

    expect(changes).toHaveLength(2);

    expect(changes[0].type).toBe(EntityChangeType.CreateEntity);
    expect(changes[0].uuid).toBe(a.uuid);

    expect(changes[1].type).toBe(EntityChangeType.CreateEntity);
    expect(changes[1].uuid).toBe(b.uuid);
    expect((changes[1].data as any)?.parentUuid).toBe(a.uuid);

    a.destroy();

    changes = ctx.buildChangeTrails();

    console.log('changes[destroy]', changes);

    expect(changes).toHaveLength(1);

    expect(changes[0].type).toBe(EntityChangeType.DestroyEntity);
    expect(changes[0].uuid).toBe(a.uuid);
  });
});
