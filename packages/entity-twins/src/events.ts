export const OnCreate = Symbol('onCreate'); // TODO emit(OnCreate) on entity component creation
export const OnInit = Symbol('onInit');
export const OnDestroy = Symbol('onDestroy');

export const OnAddToParent = Symbol('onAddToParent');
export const OnRemoveFromParent = Symbol('onRemoveFromParent');

export const OnAddChild = Symbol('onAddChild');
export const OnRemoveChild = Symbol('onRemoveChild');
