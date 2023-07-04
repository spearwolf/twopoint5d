import {Eventize} from '@spearwolf/eventize';
import {batch} from '@spearwolf/signalize';
import {EntityUplink} from './EntityUplink';
import {OnCreate, OnDestroy, OnInit} from './events';
import {EntitiesSyncEvent, EntityChangeEntryType, EntityChangeType} from './types';
import {EntityRegistry, getDefaultRegistry} from './EntityRegistry';

export class EntityKernel extends Eventize {
  registry: EntityRegistry;

  #entities: Map<string, EntityUplink> = new Map();

  constructor(registry?: EntityRegistry) {
    super();
    this.registry = registry ?? getDefaultRegistry();
  }

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

  createEntity(uuid: string, token: string, parentUuid?: string, order = 0, properties?: [string, unknown][]) {
    const entity = new EntityUplink(this, uuid);

    entity.order = order;

    this.#entities.set(uuid, entity);

    this.createEntityComponents(token, entity);

    if (parentUuid) {
      entity.parentUuid = parentUuid;
    }

    if (properties) {
      entity.setProperties(properties);
    }

    entity.emit(OnInit, entity, this);
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
    return this.registry.findConstructors(token)?.map((constructor) => {
      const instance = new constructor();
      if (uplink) {
        uplink.on(instance);
        if (typeof (instance as OnCreate)[OnCreate] === 'function') {
          (instance as OnCreate)[OnCreate](uplink);
        }
      }
      return instance;
    });
  }
}
