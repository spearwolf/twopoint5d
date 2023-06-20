import {appendTo} from './array-utils';
import {EntityConstructor} from './types';

interface RegistryEntry {
  token: string;
  constructors: EntityConstructor[];
}

const registry = new Map<string, RegistryEntry>();

export const EntityRegistry = {
  registerEntityComponent(token: string, constructor: EntityConstructor) {
    if (registry.has(token)) {
      appendTo(registry.get(token)!.constructors, constructor);
    } else {
      registry.set(token, {token, constructors: [constructor]});
    }
  },

  findConstructors(token: string): EntityConstructor[] | undefined {
    return registry.get(token)?.constructors;
  },

  hasToken(token: string): boolean {
    return registry.has(token);
  },

  clear() {
    registry.clear();
  },
};
