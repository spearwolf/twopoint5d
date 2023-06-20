import {Eventize} from '@spearwolf/eventize';
import {batch} from '@spearwolf/signalize';
import {EntityUplink} from './EntityUplink';
import {OnDestroy, OnInit} from './events';
import {EntitiesSyncEvent, EntityChangeEntryType, EntityChangeType} from './types';
import {EntityRegistry} from './EntityRegistry';

export class EntityKernel extends Eventize {
  #entities: Map<string, EntityUplink> = new Map();

  getEntity(uuid: string): EntityUplink {
    const entity = this.#entities.get(uuid);
    if (!entity) {
      throw new Error(`Entity with uuid "${uuid}" not found.`);
    }
    return entity;
  }

  run(event: EntitiesSyncEvent) {
    batch(() => {
      for (const entry of event.changeTrail) {
        this.parse(entry);
      }
    });
  }

  parse(entry: EntityChangeEntryType) {
    switch (entry.type) {
      case EntityChangeType.CreateEntity:
        this.createEntity(entry.uuid, entry.token, entry.parentUuid, entry.order, entry.properties);
        break;

      case EntityChangeType.DestroyEntity:
        this.destroyEntity(entry.uuid);
        break;

      case EntityChangeType.SetParent:
        this.setParent(entry.uuid, entry.parentUuid, entry.order);
        break;

      case EntityChangeType.UpdateOrder:
        this.updateOrder(entry.uuid, entry.order);
        break;

      case EntityChangeType.ChangeProperties:
        this.changeProperties(entry.uuid, entry.properties);
        break;
    }
  }

  createEntity(uuid: string, _token: string, parentUuid?: string, order = 0, properties?: [string, unknown][]) {
    const entity = new EntityUplink(this, uuid);

    entity.order = order;

    this.#entities.set(uuid, entity);

    // TODO use token for entity component creation and emit(OnCreate)

    if (parentUuid) {
      entity.parentUuid = parentUuid;
    }

    if (properties) {
      entity.setProperties(properties);
    }

    entity.emit(OnInit, this);
  }

  destroyEntity(uuid: string) {
    const entity = this.getEntity(uuid);
    entity.emit(OnDestroy, this);
    this.#entities.delete(uuid);
  }

  setParent(uuid: string, parentUuid?: string, order = 0) {
    const entity = this.getEntity(uuid);
    entity.removeFromParent();
    entity.order = order;
    entity.parentUuid = parentUuid;
  }

  updateOrder(uuid: string, order: number) {
    this.getEntity(uuid).order = order;
  }

  changeProperties(uuid: string, properties: [string, unknown][]) {
    this.getEntity(uuid).setProperties(properties);
  }

  createEntityComponents(token: string, uplink?: EntityUplink) {
    return EntityRegistry.findConstructors(token)?.map((constructor) => {
      const instance = new constructor();
      if (uplink) {
        uplink.on(instance);
      }
      return instance;
    });
  }
}
