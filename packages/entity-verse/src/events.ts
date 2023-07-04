import {EntityUplink} from './EntityUplink';

export const OnCreate = Symbol('onCreate');
export const OnInit = Symbol('onInit');
export const OnDestroy = Symbol('onDestroy'); // TODO OnDestroy should be called before entity is removed from kernel

export const OnAddToParent = Symbol('onAddToParent'); // TODO call OnAddToParent when entity-child is added to a parent
export const OnRemoveFromParent = Symbol('onRemoveFromParent');

export const OnAddChild = Symbol('onAddChild'); // TODO call OnAddChild when when the entity gets a new child added
export const OnRemoveChild = Symbol('onRemoveChild'); // TODO call OnRemoveChild when a child is removed from the entity

/**
 * Is called when the entity component object has been created and attached to the _entity uplink_.
 * This happens directly after the _entity uplink_ construction and before the `OnInit` event.
 *
 * This is the only event callback that only the entity component object gets.
 * The _entity uplink_ does not get this event.
 */
export interface OnCreate {
  [OnCreate](entity: EntityUplink): void;
}

/**
 * Is called when the _entity uplink_ object has been created and all the _entity components_ have been attached to it.
 *
 * The `OnInit` is triggered on the _entity uplink_, therefore all _entity components_ created with the uplink receive this event.
 *
 * When the `OnInit` event is triggered, **all** entity components have been initialized and have already received their individual `OnCreate` event.
 */
export interface OnInit {
  [OnInit](entity: EntityUplink): void;
}

/**
 * Is called when the entity is about to be destroyed.
 *
 * The `OnDestroy` is triggered on the _entity uplink_, therefore all _entity components_ created with the uplink receive this event.
 *
 * This is the last event in the lifecycle of an entity component.
 */
export interface OnDestroy {
  [OnDestroy](entity: EntityUplink): void;
}

/**
 * Is called when the entity is added to a parent entity as child.
 *
 * The `OnAddToParent` is triggered on the _entity uplink_, therefore all _entity components_ created with the uplink receive this event.
 *
 * The `OnAddToParent` event comes _after_ the `OnAddChild` event.
 */
export interface OnAddToParent {
  [OnAddToParent](child: EntityUplink, parent: EntityUplink): void;
}

export interface OnRemoveFromParent {
  [OnRemoveFromParent](child: EntityUplink, parent: EntityUplink): void;
}

export interface OnAddChild {
  [OnAddChild](parent: EntityUplink, child: EntityUplink): void;
}

export interface OnRemoveChild {
  [OnRemoveChild](parent: EntityUplink, child: EntityUplink): void;
}
