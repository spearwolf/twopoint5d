import {appendTo} from './array-utils';
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

  #parentUuid: string | null | undefined = undefined;

  #properties: Map<string, unknown> = new Map();
  #changedProperties: string[] = []; // we use an Array here and not a Set, because we want to keep the insertion order

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

  setParent(parentUuid?: string) {
    this.#parentUuid = parentUuid ?? null;
    this.#curTrailSerial++;
  }

  changeProperty<T = unknown>(key: string, value: T, isEqual?: (a: T, b: T) => boolean) {
    const prevValue = this.#properties.get(key) as T;
    if ((isEqual == null && value !== prevValue) || (isEqual != null && !isEqual(value, prevValue))) {
      this.#properties.set(key, value);
      appendTo(this.#changedProperties, key);
      this.#curTrailSerial++;
    }
  }

  removeProperty(key: string) {
    if (this.#properties.has(key)) {
      this.#properties.delete(key);
      appendTo(this.#changedProperties, key);
      this.#curTrailSerial++;
    }
  }

  hasChanges() {
    return this.#curTrailSerial > 0;
  }

  clear() {
    this.#isCreateEntity = false;
    this.#isDestroyEntity = false;
    this.#parentUuid = undefined;
    this.#changedProperties.length = 0;
    this.#curTrailSerial = 0;
  }

  dispose() {
    this.clear();
    this.#properties.clear();
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
        break;
      case EntityChangeTrailPhase.ContentUpdates:
        if (!this.#isCreateEntity && this.#changedProperties.length > 0) {
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
      entry.properties = Array.from(this.#properties.entries());
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
      type: EntityChangeType.ChangeProperties,
      uuid: this.#entityUuid,
      properties: this.#changedProperties.reduce(
        (entries, key) => [...entries, [key, this.#properties.get(key)]],
        [] as [string, unknown][],
      ),
    };
  }
}
