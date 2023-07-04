import {isEventized} from '@spearwolf/eventize';
import {Entity} from './Entity';
import {EntityKernel} from './EntityKernel';
import {EntityRegistry, getDefaultRegistry} from './EntityRegistry';

describe('@Entity decorator', () => {
  afterEach(() => {
    getDefaultRegistry().clear();
  });

  it('should register a class constructor by token', () => {
    @Entity({token: 'test'})
    class Foo {}

    expect(Foo).toBeDefined();
    expect(getDefaultRegistry().hasToken('test')).toBeTruthy();
    expect(getDefaultRegistry().findConstructors('test')).toContain(Foo);
  });

  it('should create an entity component instance', () => {
    const registry = new EntityRegistry();
    const kernel = new EntityKernel(registry);

    @Entity({registry, token: 'test'})
    class Foo {
      foo: number;
      bar = 666;

      constructor() {
        this.foo = 23;
      }
    }

    const entity = kernel.createEntityComponents('test')?.at(-1) as Foo;

    expect(entity).toBeDefined();
    expect(entity).toBeInstanceOf(Foo);
    expect(isEventized(entity!)).toBeTruthy();

    expect(entity.foo).toBe(23);
    expect(entity.bar).toBe(666);
  });
});
