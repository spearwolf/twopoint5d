import {EntityProxy} from './EntityProxy';
import {EntityProxyContext} from './EntityProxyContext';

describe('EntityProxy', () => {
  it('should be defined', () => {
    expect(EntityProxy).toBeDefined();
  });

  it('should create new entity', () => {
    const entity = new EntityProxy('test');
    expect(entity.uuid).toBeDefined();
    expect(entity.token).toBe('test');
    expect(entity.parent).toBeUndefined();
    expect(EntityProxyContext.get().hasEntity(entity)).toBeTruthy();
    entity.destroy();
  });

  it('should destroy entity', () => {
    const entity = new EntityProxy('test');
    expect(EntityProxyContext.get().hasEntity(entity)).toBeTruthy();
    entity.destroy();
    expect(EntityProxyContext.get().hasEntity(entity)).toBeFalsy();
  });

  it('should add entity as child (constructor)', () => {
    const parent = new EntityProxy('test');
    const child = new EntityProxy('test', parent);
    const ctx = EntityProxyContext.get();

    expect(ctx.hasEntity(parent)).toBeTruthy();
    expect(ctx.hasEntity(child)).toBeTruthy();
    expect(ctx.isChildOf(child, parent)).toBeTruthy();

    child.destroy();
    parent.destroy();

    expect(ctx.hasEntity(parent)).toBeFalsy();
    expect(ctx.hasEntity(child)).toBeFalsy();
  });

  it('should add entity as child (addChild)', () => {
    const parent = new EntityProxy('test');
    const child = new EntityProxy('test');
    const ctx = EntityProxyContext.get();

    expect(ctx.hasEntity(parent)).toBeTruthy();
    expect(ctx.hasEntity(child)).toBeTruthy();

    expect(ctx.isChildOf(child, parent)).toBeFalsy();

    parent.addChild(child);

    expect(ctx.isChildOf(child, parent)).toBeTruthy();

    child.destroy();
    parent.destroy();

    expect(ctx.hasEntity(parent)).toBeFalsy();
    expect(ctx.hasEntity(child)).toBeFalsy();
  });

  it('should remove from parent', () => {
    const parent = new EntityProxy('test');
    const child = new EntityProxy('test', parent);
    const ctx = EntityProxyContext.get();

    expect(ctx.isChildOf(child, parent)).toBeTruthy();

    child.removeFromParent();

    expect(child.parent).toBeUndefined();
    expect(ctx.isChildOf(child, parent)).toBeFalsy();

    child.destroy();
    parent.destroy();
  });

  it('should set parent', () => {
    const a = new EntityProxy('test');
    const b = new EntityProxy('test', a);
    const c = new EntityProxy('test');
    const ctx = EntityProxyContext.get();

    expect(ctx.isChildOf(b, a)).toBeTruthy();
    expect(ctx.isChildOf(b, c)).toBeFalsy();

    b.parent = c;

    expect(b.parent).toBe(c);
    expect(ctx.isChildOf(b, a)).toBeFalsy();
    expect(ctx.isChildOf(b, c)).toBeTruthy();

    b.destroy();
    a.destroy();
    c.destroy();
  });
});
