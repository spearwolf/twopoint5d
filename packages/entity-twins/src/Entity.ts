import {eventize} from '@spearwolf/eventize';
import {EntityRegistry, getDefaultRegistry} from './EntityRegistry';
import {EntityConstructor} from './types';

export interface EntityDecoratorOptions {
  token: string;
  registry?: EntityRegistry;
}

export function Entity(options: EntityDecoratorOptions) {
  // return function <C extends EntityConstructor>(target: C, _context?: ClassDecoratorContext<C>) {
  return function <C extends EntityConstructor>(target: C, _context?: any) {
    const Entity = class extends target {
      constructor(...args: any[]) {
        super(...args);
        eventize(this);
      }
    };

    const registry = options.registry ?? getDefaultRegistry();
    registry.registerEntityComponent(options.token, Entity);

    return Entity;
  };
}
