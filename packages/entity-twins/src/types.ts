export enum EntityChangeTrailPhase {
  StructuralChanges = 1,
  ContentUpdates,
  Removal,
}

export enum EntityChangeType {
  CreateEntity = 1,
  DestroyEntity,
  SetParent,
  UpdateOrder,
  ChangeProperties,
}

export interface IEntityChangeEntry {
  type: EntityChangeType;
  uuid: string;
}

export interface IEntityChangeCreateEntity extends IEntityChangeEntry {
  type: EntityChangeType.CreateEntity;
  token: string;
  parentUuid?: string;
  order?: number;
  properties?: [string, unknown][];
}

export interface IEntityChangeDestroyEntity extends IEntityChangeEntry {
  type: EntityChangeType.DestroyEntity;
}

export interface IEntityChangeSetParent extends IEntityChangeEntry {
  type: EntityChangeType.SetParent;
  parentUuid: string | undefined;
  order?: number;
}

export interface IEntityChangeUpdateOrder extends IEntityChangeEntry {
  type: EntityChangeType.UpdateOrder;
  order: number;
}

export interface IEntityChangeProperty extends IEntityChangeEntry {
  type: EntityChangeType.ChangeProperties;
  properties: [string, unknown][];
}
