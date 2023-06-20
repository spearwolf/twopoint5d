import {isEventized} from '@spearwolf/eventize';
import {Entity} from './Entity';
import {EntityKernel} from './EntityKernel';
import {EntityRegistry} from './EntityRegistry';

describe('@Entity decorator', () => {
  afterEach(() => {
    EntityRegistry.clear();
  });

  it('should register a class constructor by token', () => {
    @Entity({token: 'test'})
    class Foo {}

    expect(Foo).toBeDefined();
    expect(EntityRegistry.hasToken('test')).toBeTruthy();
    expect(EntityRegistry.findConstructors('test')).toContain(Foo);
  });

  it('should create an entity component instance', () => {
    @Entity({token: 'test'})
    class Foo {
      foo: number;
      bar = 666;

      constructor() {
        this.foo = 23;
      }
    }

    const kernel = new EntityKernel();
    const entity = kernel.createEntityComponents('test')?.at(-1) as Foo;

    expect(entity).toBeDefined();
    expect(entity).toBeInstanceOf(Foo);
    expect(isEventized(entity!)).toBeTruthy();

    expect(entity.foo).toBe(23);
    expect(entity.bar).toBe(666);
  });
});
