import {EntityUplink} from './EntityUplink';
import {EntitiesSyncEvent, EntityChangeType, IEntityChangeCreateEntity, IEntityChangeEntry} from './types';

export class EntityKernel {
  #entities: Map<string, EntityUplink> = new Map();

  run(event: EntitiesSyncEvent) {
    // console.log('run', event);
    for (const entry of event.changeTrail) {
      this.parse(entry);
    }
  }

  parse(entry: IEntityChangeEntry) {
    switch (entry.type) {
      case EntityChangeType.CreateEntity:
        this.createEntity(entry as IEntityChangeCreateEntity);
    }
  }

  createEntity(entry: IEntityChangeCreateEntity) {
    const entity = new EntityUplink(this, entry.uuid);
    // TODO use token for entity creation
    // TODO respect entity parent
    entry.properties?.forEach(([key, value]) => {
      (entity as any)[key] = value;
    });

    this.#entities.set(entry.uuid, entity);

    console.log('create', entity);
  }
}
