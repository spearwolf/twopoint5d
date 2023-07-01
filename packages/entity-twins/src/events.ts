import {EntityUplink} from './EntityUplink';

export const OnCreate = Symbol('onCreate'); // TODO emit(OnCreate) on entity component creation
export const OnInit = Symbol('onInit');
export const OnDestroy = Symbol('onDestroy');

export const OnAddToParent = Symbol('onAddToParent');
export const OnRemoveFromParent = Symbol('onRemoveFromParent');

export const OnAddChild = Symbol('onAddChild');
export const OnRemoveChild = Symbol('onRemoveChild');

export interface OnInit {
  [OnInit](entity: EntityUplink): void;
}

export interface OnDestroy {
  [OnDestroy](entity: EntityUplink): void;
}

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
