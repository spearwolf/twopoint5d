import {eventize} from '@spearwolf/eventize';
import {EntityRegistry} from './EntityRegistry';
import {EntityConstructor} from './types';

export interface EntityDecoratorOptions {
  token: string;
}

export function Entity(options: EntityDecoratorOptions) {
  return function <C extends EntityConstructor>(target: C, _context?: ClassDecoratorContext<C>) {
    const Entity = class extends target {
      constructor(...args: any[]) {
        super(...args);
        eventize(this);
      }
    };
    EntityRegistry.registerEntityComponent(options.token, Entity);
    return Entity;
  };
}
