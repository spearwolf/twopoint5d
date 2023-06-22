import {appendTo} from './array-utils';
import {EntityConstructor} from './types';

interface RegistryEntry {
  token: string;
  constructors: EntityConstructor[];
}

export class EntityRegistry {
  readonly #registry = new Map<string, RegistryEntry>();

  registerEntityComponent(token: string, constructor: EntityConstructor) {
    if (this.#registry.has(token)) {
      appendTo(this.#registry.get(token)!.constructors, constructor);
    } else {
      this.#registry.set(token, {token, constructors: [constructor]});
    }
  }

  findConstructors(token: string): EntityConstructor[] | undefined {
    return this.#registry.get(token)?.constructors;
  }

  hasToken(token: string): boolean {
    return this.#registry.has(token);
  }

  clear() {
    this.#registry.clear();
  }
}

const defaultRegistry = new EntityRegistry();

export const getDefaultRegistry = () => defaultRegistry;
