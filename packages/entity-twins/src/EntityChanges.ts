import {EntityChangeType, EntityTrailType, IEntityChangeEntry} from './types';

export class EntityChanges {
  #entityUuid: string;

  #curTrailSerial = 1;
  #isCreateEntity = true;

  #isDestroyEntity = false;
  #removeChildren: Set<string> = new Set();
  #parentUuid?: string = undefined;
  #properties: Map<string, unknown> = new Map();

  get entityUuid() {
    return this.#entityUuid;
  }

  constructor(entityUuid: string) {
    this.#entityUuid = entityUuid;
  }

  removeChild(childUuid: string) {
    this.#removeChildren.add(childUuid);
    this.#curTrailSerial++;
  }

  setParent(parentUuid?: string) {
    this.#parentUuid = parentUuid;
    this.#curTrailSerial++;
  }

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

  buildChangeTrail(trail: IEntityChangeEntry[], trailType: EntityTrailType) {
    switch (trailType) {
      case EntityTrailType.Structural:
        if (!this.#isDestroyEntity && this.#isCreateEntity) {
          const entry: IEntityChangeEntry = {
            type: EntityChangeType.CreateEntity,
            uuid: this.#entityUuid,
          };

          if (this.#parentUuid) {
            entry.data = {parentUuid: this.#parentUuid};
          }

          if (this.#properties.size > 0) {
            const properties = Array.from(this.#properties.entries());
            if (!entry.data) {
              entry.data = {properties};
            } else {
              (entry.data as any).properties = properties;
            }
          }

          trail.push(entry);
        }

        if (!this.#isCreateEntity && !this.#isDestroyEntity) {
          if (this.#parentUuid) {
            trail.push({
              type: EntityChangeType.SetParent,
              uuid: this.#entityUuid,
              data: {parentUuid: this.#parentUuid},
            });
          }
        }

        // TODO children
        //
        break;
      case EntityTrailType.Content:
        if (this.#properties.size > 0) {
          const properties = Array.from(this.#properties.entries());
          trail.push({
            type: EntityChangeType.ChangeProperty,
            uuid: this.#entityUuid,
            data: {properties},
          });
        }
        break;
      case EntityTrailType.Cleanup:
        if (this.#isDestroyEntity && !this.#isCreateEntity) {
          trail.push({
            type: EntityChangeType.DestroyEntity,
            uuid: this.#entityUuid,
          });
        }
        break;
    }
  }
}
