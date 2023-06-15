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

  it('should insert create-entity in change trail', () => {
    const a = new EntityProxy('a');
    const b = new EntityProxy('b');

    const changes = ctx.buildChangeTrails();

    console.log('changes', changes);

    expect(changes[0].type).toBe(EntityChangeType.CreateEntity);
    expect(changes[0].uuid).toBe(a.uuid);

    expect(changes[1].type).toBe(EntityChangeType.CreateEntity);
    expect(changes[1].uuid).toBe(b.uuid);
  });
});
