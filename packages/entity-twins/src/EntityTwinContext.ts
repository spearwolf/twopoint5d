import {EntityChanges} from './EntityChanges';
import {EntityTwin} from './EntityTwin';
import {EntityChangeTrailPhase, IEntityChangeEntry} from './types';

interface EntityEntry {
  entity: EntityTwin;
  children: Set<string>;
  changes: EntityChanges;
}

declare global {
  // eslint-disable-next-line no-var
  var __entityProxyContext: Map<string | symbol, EntityTwinContext> | undefined;
}

export class EntityTwinContext {
  static GlobalNS = Symbol.for('globalEntityProxyContext');

  static get(namespace?: string | symbol): EntityTwinContext {
    if (globalThis.__entityProxyContext === undefined) {
      globalThis.__entityProxyContext = new Map<string | symbol, EntityTwinContext>();
    }
    const ns = namespace ?? EntityTwinContext.GlobalNS;
    if (globalThis.__entityProxyContext.has(ns)) {
      return globalThis.__entityProxyContext.get(ns)!;
    } else {
      const ctx = new EntityTwinContext();
      globalThis.__entityProxyContext.set(ns, ctx);
      return ctx;
    }
  }

  #entities: Map<string, EntityEntry> = new Map();
  #rootEntities: Set<string> = new Set();

  #removedEntityChanges: EntityChanges[] = [];

  addEntity(entity: EntityTwin) {
    if (this.hasEntity(entity)) {
      throw new Error(`Entity with uuid:${entity.uuid} already exists`);
    }
    const changes = new EntityChanges(entity.uuid, entity.token);
    this.#entities.set(entity.uuid, {
      entity,
      children: new Set<string>(),
      changes,
    });
    if (entity.parent) {
      this.addToChildren(entity.parent, entity);
      changes.setParent(entity.parent.uuid);
    } else {
      this.#rootEntities.add(entity.uuid);
    }
  }

  hasEntity(entity: EntityTwin) {
    return this.#entities.has(entity.uuid);
  }

  isRootEntity(entity: EntityTwin) {
    return this.#rootEntities.has(entity.uuid);
  }

  removeEntity(entity: EntityTwin) {
    if (this.hasEntity(entity)) {
      const entry = this.#entities.get(entity.uuid)!;

      for (const childUuid of entry.children) {
        const child = this.#entities.get(childUuid);
        if (child) {
          child.entity.removeFromParent();
        }
      }

      this.#entities.delete(entity.uuid);
      this.#rootEntities.delete(entity.uuid);

      this.#removedEntityChanges.push(entry.changes);
      entry.changes.destroyEntity();
    }
  }

  removeChildFromParent(childUuid: string, parent: EntityTwin) {
    if (this.hasEntity(parent)) {
      const entry = this.#entities.get(parent.uuid)!;
      if (entry.children.has(childUuid)) {
        entry.children.delete(childUuid);
        this.#entities.get(childUuid)?.changes.setParent(undefined);
      }
    }
    this.#rootEntities.add(childUuid);
  }

  isChildOf(child: EntityTwin, parent: EntityTwin) {
    if (this.hasEntity(parent)) {
      const entry = this.#entities.get(parent.uuid)!;
      return entry.children.has(child.uuid);
    }
    return false;
  }

  addToChildren(parent: EntityTwin, child: EntityTwin) {
    const entry = this.#entities.get(parent.uuid);
    if (entry) {
      entry.children.add(child.uuid);
      this.#entities.get(child.uuid)?.changes.setParent(parent.uuid);
      this.#rootEntities.delete(child.uuid);
    } else {
      throw new Error(`Could not add child entity to parent! Parent entity with uuid:${parent.uuid} does not exist`);
    }
  }

  removeEntitySubTree(entityUuid: string) {
    const entry = this.#entities.get(entityUuid);
    if (entry) {
      for (const childUuid of Array.from(entry.children)) {
        this.removeEntitySubTree(childUuid);
      }
      this.removeEntity(entry.entity);
    }
  }

  clear() {
    for (const entity of Array.from(this.#rootEntities)) {
      this.removeEntitySubTree(entity);
    }

    if (this.#rootEntities.size !== 0) {
      throw new Error('entity-proxy-context clear panic: rootEntities is not empty!');
    }

    if (this.#entities.size !== 0) {
      throw new Error('entity-proxy-context clear panic: entities is not empty!');
    }
  }

  buildChangeTrails() {
    const trail: IEntityChangeEntry[] = [];
    const pathOfChanges = this.#buildPathOfChanges();

    for (const changes of pathOfChanges) {
      changes.buildChangeTrail(trail, EntityChangeTrailPhase.StructuralChanges);
    }

    for (const changes of pathOfChanges) {
      changes.buildChangeTrail(trail, EntityChangeTrailPhase.ContentUpdates);
      changes.clear();
    }

    for (const changes of this.#removedEntityChanges) {
      changes.buildChangeTrail(trail, EntityChangeTrailPhase.Removal);
      changes.clear();
    }

    this.#removedEntityChanges.length = 0;

    return trail;
  }

  #buildPathOfChanges(): EntityChanges[] {
    const path: EntityChanges[] = [];

    const buildPath = (entityUuid: string) => {
      const entity = this.#entities.get(entityUuid);
      if (entity) {
        if (entity.changes.hasChanges()) {
          path.push(entity.changes);
        }
        for (const childUuid of entity.children) {
          buildPath(childUuid);
        }
      }
    };

    for (const entityUuid of this.#rootEntities) {
      buildPath(entityUuid);
    }

    return path;
  }
}
