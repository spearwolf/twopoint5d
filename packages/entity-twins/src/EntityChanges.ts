import {
  EntityChangeType,
  EntityChangeTrailPhase,
  IEntityChangeCreateEntity,
  IEntityChangeDestroyEntity,
  IEntityChangeEntry,
  IEntityChangeProperty,
  IEntityChangeSetParent,
} from './types';

export class EntityChanges {
  #entityUuid: string;
  #token: string;

  #curTrailSerial = 1;
  #isCreateEntity = true;

  #isDestroyEntity = false;
  #removeChildren: Set<string> = new Set();
  #parentUuid: string | null | undefined = undefined;
  #properties: Map<string, unknown> = new Map();

  get entityUuid() {
    return this.#entityUuid;
  }

  constructor(entityUuid: string, token: string) {
    this.#entityUuid = entityUuid;
    this.#token = token;
  }

  destroyEntity() {
    this.#isDestroyEntity = true;
    this.#curTrailSerial++;
  }

  // TODO add child

  // TODO call me
  removeChild(childUuid: string) {
    this.#removeChildren.add(childUuid);
    this.#curTrailSerial++;
  }

  setParent(parentUuid?: string) {
    this.#parentUuid = parentUuid ?? null;
    this.#curTrailSerial++;
  }

  // TODO call me
  changeProperties(props: Record<string, unknown>) {
    for (const key in props) {
      this.#properties.set(key, props[key]);
    }
    this.#curTrailSerial++;
  }

  hasChanges() {
    return this.#curTrailSerial > 0;
  }

  clear() {
    this.#isCreateEntity = false;
    this.#isDestroyEntity = false;
    this.#removeChildren.clear();
    this.#parentUuid = undefined;
    this.#properties.clear();
    this.#curTrailSerial = 0;
  }

  buildChangeTrail(trail: IEntityChangeEntry[], trailPhase: EntityChangeTrailPhase) {
    switch (trailPhase) {
      case EntityChangeTrailPhase.StructuralChanges:
        if (!this.#isDestroyEntity && this.#isCreateEntity) {
          trail.push(this.makeCreateEntityChange());
        }
        if (!this.#isCreateEntity && !this.#isDestroyEntity) {
          if (this.#parentUuid !== undefined) {
            trail.push(this.makeSetParentChange());
          }
        }
        // TODO children
        break;
      case EntityChangeTrailPhase.ContentUpdates:
        if (this.#properties.size > 0) {
          trail.push(this.makeChangePropertyChange());
        }
        break;
      case EntityChangeTrailPhase.Removal:
        if (this.#isDestroyEntity && !this.#isCreateEntity) {
          trail.push(this.makeDestroyEntityChange());
        }
        break;
    }
  }

  makeCreateEntityChange(): IEntityChangeCreateEntity {
    const entry: IEntityChangeCreateEntity = {
      type: EntityChangeType.CreateEntity,
      uuid: this.#entityUuid,
      token: this.#token,
    };

    if (this.#parentUuid) {
      entry.parentUuid = this.#parentUuid;
    }

    if (this.#properties.size > 0) {
      entry.properties = this.#makeProperties();
    }

    return entry;
  }

  makeDestroyEntityChange(): IEntityChangeDestroyEntity {
    return {
      type: EntityChangeType.DestroyEntity,
      uuid: this.#entityUuid,
    };
  }

  makeSetParentChange(): IEntityChangeSetParent {
    return {
      type: EntityChangeType.SetParent,
      uuid: this.#entityUuid,
      parentUuid: this.#parentUuid ?? undefined,
    };
  }

  makeChangePropertyChange(): IEntityChangeProperty {
    return {
      type: EntityChangeType.ChangeProperty,
      uuid: this.#entityUuid,
      properties: this.#makeProperties(),
    };
  }

  #makeProperties(): [string, unknown][] {
    return Array.from(this.#properties.entries());
  }
}
