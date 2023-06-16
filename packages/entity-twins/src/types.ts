export enum EntityChangeTrailPhase {
  StructuralChanges = 1,
  ContentUpdates,
  Removal,
}

export enum EntityChangeType {
  CreateEntity = 1,
  DestroyEntity,
  SetParent,
  AddChild,
  RemoveChild,
  ChangeProperty,
}

export interface IEntityChangeEntry {
  type: EntityChangeType;
  uuid: string;
}

export interface IEntityChangeCreateEntity extends IEntityChangeEntry {
  type: EntityChangeType.CreateEntity;
  token: string;
  parentUuid?: string;
  properties?: [string, unknown][];
}

export interface IEntityChangeDestroyEntity extends IEntityChangeEntry {
  type: EntityChangeType.DestroyEntity;
}

export interface IEntityChangeSetParent extends IEntityChangeEntry {
  type: EntityChangeType.SetParent;
  parentUuid: string | undefined;
}

export interface IEntityChangeProperty extends IEntityChangeEntry {
  type: EntityChangeType.ChangeProperty;
  properties: [string, unknown][];
}
