import {EntityProxy} from './EntityProxy';

interface EntityEntry {
  entity: EntityProxy;
  children: Set<string>;
}

declare global {
  // eslint-disable-next-line no-var
  var __entityProxyContext: Map<string | symbol, EntityProxyContext> | undefined;
}

export class EntityProxyContext {
  static GlobalNS = Symbol.for('globalEntityProxyContext');

  static get(namespace?: string | symbol): EntityProxyContext {
    if (globalThis.__entityProxyContext === undefined) {
      globalThis.__entityProxyContext = new Map<string | symbol, EntityProxyContext>();
    }
    const ns = namespace ?? EntityProxyContext.GlobalNS;
    if (globalThis.__entityProxyContext.has(ns)) {
      return globalThis.__entityProxyContext.get(ns)!;
    } else {
      const ctx = new EntityProxyContext();
      globalThis.__entityProxyContext.set(ns, ctx);
      return ctx;
    }
  }

  #entities: Map<string, EntityEntry> = new Map();

  addEntity(entity: EntityProxy) {
    if (this.hasEntity(entity)) {
      throw new Error(`Entity with uuid:${entity.uuid} already exists`);
    }
    this.#entities.set(entity.uuid, {
      entity,
      children: new Set<string>(),
    });
    if (entity.parent) {
      this.addToChildren(entity.parent, entity);
    }
  }

  hasEntity(entity: EntityProxy) {
    return this.#entities.has(entity.uuid);
  }

  removeEntity(entity: EntityProxy) {
    if (this.hasEntity(entity)) {
      const entry = this.#entities.get(entity.uuid)!;

      for (const child of entry.children) {
        this.#entities.get(child)!.entity.removeFromParent();
      }

      this.#entities.delete(entity.uuid);
    }
  }

  removeChildFromParent(childUuid: string, parent: EntityProxy) {
    if (this.hasEntity(parent)) {
      const entry = this.#entities.get(parent.uuid)!;
      entry.children.delete(childUuid);
    }
  }

  isChildOf(child: EntityProxy, parent: EntityProxy) {
    if (this.hasEntity(parent)) {
      const entry = this.#entities.get(parent.uuid)!;
      return entry.children.has(child.uuid);
    }
    return false;
  }

  addToChildren(parent: EntityProxy, child: EntityProxy) {
    const entry = this.#entities.get(parent.uuid);
    if (entry) {
      entry.children.add(child.uuid);
    } else {
      throw new Error(`Could not add child entity to parent! Parent entity with uuid:${parent.uuid} does not exist`);
    }
  }
}
