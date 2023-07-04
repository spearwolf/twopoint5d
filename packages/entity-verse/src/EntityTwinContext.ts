import {EntityChanges} from './EntityChanges';
import {EntityTwin} from './EntityTwin';
import {removeFrom} from './array-utils';
import {EntityChangeEntryType, EntityChangeTrailPhase} from './types';

interface EntityEntry {
  entity: EntityTwin;
  children: string[]; // we use an Array here and not a Set, because we want to keep the insertion order
  changes: EntityChanges;
}

declare global {
  // eslint-disable-next-line no-var
  var __entityProxyContext: Map<string | symbol, EntityTwinContext> | undefined;
}

export class EntityTwinContext {
  static GlobalNS = Symbol.for('globalEntities');

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
  #rootEntities: string[] = []; // we use an Array here and not a Set, because we want to keep the insertion order

  #removedEntityChanges: EntityChanges[] = [];

  addEntity(entity: EntityTwin) {
    if (this.hasEntity(entity)) {
      throw new Error(`Entity with uuid:${entity.uuid} already exists`);
    }
    const changes = new EntityChanges(entity.uuid, entity.token, entity.order);
    this.#entities.set(entity.uuid, {
      entity,
      children: [],
      changes,
    });
    if (entity.parent) {
      this.addToChildren(entity.parent, entity);
      changes.setParent(entity.parent.uuid);
    } else {
      this.#appendToOrdered(entity, this.#rootEntities);
    }
  }

  hasEntity(entity: EntityTwin) {
    return this.#entities.has(entity.uuid);
  }

  isRootEntity(entity: EntityTwin) {
    return this.#rootEntities.includes(entity.uuid);
  }

  removeEntity(entity: EntityTwin) {
    if (this.hasEntity(entity)) {
      const entry = this.#entities.get(entity.uuid)!;

      entry.children.slice(0).forEach((childUuid) => this.#entities.get(childUuid)?.entity.removeFromParent());

      this.#entities.delete(entity.uuid);
      removeFrom(this.#rootEntities, entity.uuid);

      this.#removedEntityChanges.push(entry.changes);
      entry.changes.destroyEntity();
    }
  }

  removeChildFromParent(childUuid: string, parent: EntityTwin) {
    if (this.hasEntity(parent)) {
      const childEntry = this.#entities.get(childUuid)!;
      const entry = this.#entities.get(parent.uuid)!;
      const childIdx = entry.children.indexOf(childUuid);
      if (childIdx !== -1) {
        entry.children.splice(childIdx, 1);
        childEntry.changes.setParent(undefined);
      }
      this.#appendToOrdered(childEntry.entity, this.#rootEntities);
    }
  }

  isChildOf(child: EntityTwin, parent: EntityTwin) {
    if (this.hasEntity(parent)) {
      const entry = this.#entities.get(parent.uuid)!;
      return entry.children.includes(child.uuid);
    }
    return false;
  }

  addToChildren(parent: EntityTwin, child: EntityTwin) {
    const entry = this.#entities.get(parent.uuid);
    if (entry) {
      this.#appendToOrdered(child, entry.children);
      this.#entities.get(child.uuid)?.changes.setParent(parent.uuid);
      removeFrom(this.#rootEntities, child.uuid);
    } else {
      throw new Error(`Could not add child entity to parent! Parent entity with uuid:${parent.uuid} does not exist`);
    }
  }

  removeEntitySubTree(entityUuid: string) {
    const entry = this.#entities.get(entityUuid);
    if (entry) {
      entry.children.slice(0).forEach((childUuid) => this.removeEntitySubTree(childUuid));
      this.removeEntity(entry.entity);
    }
  }

  setProperty<T = unknown>(entity: EntityTwin, propKey: string, value: T, isEqual?: (a: T, b: T) => boolean) {
    this.#entities.get(entity.uuid)?.changes.changeProperty(propKey, value, isEqual);
  }

  removeProperty(entity: EntityTwin, propKey: string) {
    this.#entities.get(entity.uuid)?.changes.removeProperty(propKey);
  }

  changeOrder(entity: EntityTwin) {
    if (entity.parent) {
      const parentEntry = this.#entities.get(entity.parent.uuid)!;
      removeFrom(parentEntry.children, entity.uuid);
      this.#appendToOrdered(entity, parentEntry.children);
    } else {
      removeFrom(this.#rootEntities, entity.uuid);
      this.#appendToOrdered(entity, this.#rootEntities);
    }
    this.#entities.get(entity.uuid)?.changes.changeOrder(entity.order);
  }

  clear() {
    this.#rootEntities.slice(0).forEach((uuid) => this.removeEntitySubTree(uuid));

    if (this.#rootEntities.length !== 0) {
      throw new Error('entity-proxy-context clear panic: rootEntities is not empty!');
    }

    if (this.#entities.size !== 0) {
      throw new Error('entity-proxy-context clear panic: entities is not empty!');
    }
  }

  buildChangeTrails() {
    const trail: EntityChangeEntryType[] = [];
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
      changes.dispose();
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
        entity.children.forEach((childUuid) => buildPath(childUuid));
      }
    };

    for (const entityUuid of this.#rootEntities) {
      buildPath(entityUuid);
    }

    return path;
  }

  #appendToOrdered(entity: EntityTwin, childUuids: string[]) {
    if (childUuids.length === 0) {
      childUuids.push(entity.uuid);
      return;
    }

    if (childUuids.includes(entity.uuid)) {
      return;
    }

    const len = childUuids.length;
    const childEntities = new Array<EntityTwin>(len);

    childEntities[0] = this.#entities.get(childUuids[0])!.entity;

    if (entity.order < childEntities[0].order) {
      childUuids.unshift(entity.uuid);
      return;
    }

    if (len === 1) {
      childUuids.push(entity.uuid);
      return;
    }

    const lastIdx = len - 1;
    childEntities[lastIdx] = this.#entities.get(childUuids[lastIdx])!.entity;

    if (entity.order >= childEntities[lastIdx].order) {
      childUuids.push(entity.uuid);
      return;
    }

    if (len === 2) {
      childUuids.splice(1, 0, entity.uuid);
      return;
    }

    for (let i = lastIdx - 1; i >= 1; i--) {
      childEntities[i] = this.#entities.get(childUuids[i])!.entity;
      if (entity.order >= childEntities[i].order) {
        childUuids.splice(i + 1, 0, entity.uuid);
        return;
      }
    }
  }
}
