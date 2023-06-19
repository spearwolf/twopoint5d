import {batch} from '@spearwolf/signalize';
import {EntityUplink} from './EntityUplink';
import {EntitiesSyncEvent, EntityChangeType, IEntityChangeCreateEntity, IEntityChangeEntry} from './types';

export class EntityKernel {
  #entities: Map<string, EntityUplink> = new Map();

  run(event: EntitiesSyncEvent) {
    batch(() => {
      for (const entry of event.changeTrail) {
        this.parse(entry);
      }
    });
  }

  parse(entry: IEntityChangeEntry) {
    switch (entry.type) {
      case EntityChangeType.CreateEntity:
        this.createEntity(entry as IEntityChangeCreateEntity);
        break;
      // TODO implement other change-entry types
    }
  }

  createEntity(entry: IEntityChangeCreateEntity) {
    const entity = new EntityUplink(this, entry.uuid);

    // TODO use token for entity creation
    // TODO respect entity parent -> children

    if (entry.properties) {
      entity.setProperties(entry.properties);
    }

    this.#entities.set(entry.uuid, entity);

    console.log('create', entity.uuid, entity.propertyEntries());
  }
}
