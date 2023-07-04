import {EntityTwin} from './EntityTwin';
import {EntityTwinContext} from './EntityTwinContext';

describe('EntityProxy', () => {
  const ctx = EntityTwinContext.get();

  afterAll(() => {
    ctx.clear();
  });

  it('should be defined', () => {
    expect(EntityTwin).toBeDefined();
  });

  it('should create new entity', () => {
    const entity = new EntityTwin('test');
    expect(entity.uuid).toBeDefined();
    expect(entity.token).toBe('test');
    expect(entity.parent).toBeUndefined();
    expect(ctx.hasEntity(entity)).toBeTruthy();
    expect(ctx.isRootEntity(entity)).toBeTruthy();
  });

  it('should destroy entity', () => {
    const entity = new EntityTwin('test');
    expect(ctx.hasEntity(entity)).toBeTruthy();
    entity.destroy();
    expect(ctx.hasEntity(entity)).toBeFalsy();
  });

  it('should add entity as child (constructor)', () => {
    const parent = new EntityTwin('test');
    const child = new EntityTwin('test', parent);
    const ctx = EntityTwinContext.get();

    expect(ctx.hasEntity(parent)).toBeTruthy();
    expect(ctx.hasEntity(child)).toBeTruthy();
    expect(ctx.isChildOf(child, parent)).toBeTruthy();
    expect(ctx.isRootEntity(child)).toBeFalsy();
  });

  it('should add entity as child (addChild)', () => {
    const parent = new EntityTwin('test');
    const child = new EntityTwin('test');

    expect(ctx.hasEntity(parent)).toBeTruthy();
    expect(ctx.hasEntity(child)).toBeTruthy();
    expect(ctx.isChildOf(child, parent)).toBeFalsy();
    expect(ctx.isRootEntity(child)).toBeTruthy();

    parent.addChild(child);

    expect(ctx.isChildOf(child, parent)).toBeTruthy();
    expect(ctx.isRootEntity(child)).toBeFalsy();
  });

  it('should remove from parent', () => {
    const parent = new EntityTwin('test');
    const child = new EntityTwin('test', parent);

    expect(ctx.isChildOf(child, parent)).toBeTruthy();
    expect(ctx.isRootEntity(parent)).toBeTruthy();

    child.removeFromParent();

    expect(child.parent).toBeUndefined();
    expect(ctx.isChildOf(child, parent)).toBeFalsy();
    expect(ctx.isRootEntity(child)).toBeTruthy();
  });

  it('should set parent', () => {
    const a = new EntityTwin('test');
    const b = new EntityTwin('test', a);
    const c = new EntityTwin('test');

    expect(ctx.isChildOf(b, a)).toBeTruthy();
    expect(ctx.isChildOf(b, c)).toBeFalsy();

    b.parent = c;

    expect(b.parent).toBe(c);
    expect(ctx.isChildOf(b, a)).toBeFalsy();
    expect(ctx.isChildOf(b, c)).toBeTruthy();
  });
});
