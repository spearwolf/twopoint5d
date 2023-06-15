export enum EntityTrailType {
  Structural = 1,
  Content,
  Cleanup,
}

export enum EntityChangeType {
  CreateEntity = 1,
  DestroyEntity,
  AddChild,
  RemoveChild,
  SetParent,
  ChangeProperty,
}

export interface IEntityChangeEntry {
  type: EntityChangeType;
  uuid: string;
  data?: unknown;
}
