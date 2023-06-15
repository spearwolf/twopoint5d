// export enum EntityChangeType {
//   CreateEntity = 1,
//   DestroyEntity,
//   AddChild,
//   RemoveChild,
//   SetParent,
//   ChangeProperty,
// }

export class EntityChanges {
  #entityUuid: string;

  #curTrailSerial = 0;

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
}
