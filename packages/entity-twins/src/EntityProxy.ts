import {Eventize} from '@spearwolf/eventize';

export interface EntityProxy extends Eventize {}

export class EntityProxy {
  static SetParent = Symbol('setParent');
  static RemoveFromParent = Symbol('removeFromParent');
  static AddChild = Symbol('addChild');
  static RemoveChild = Symbol('removeChild');

  #uuid: string;
  #token: string;

  #parent?: EntityProxy;

  get uuid() {
    return this.#uuid;
  }

  get token() {
    return this.#token;
  }

  get parent(): EntityProxy | undefined {
    return this.#parent;
  }

  set parent(parent: EntityProxy | null | undefined) {
    if (parent) {
      this.addChild(parent);
    } else {
      this.removeFromParent();
    }
  }

  constructor(token: string, parent?: EntityProxy) {
    this.#uuid = globalThis.crypto.randomUUID();
    this.#token = token;
    this.#parent = parent;
  }

  isChildOf(entity: EntityProxy) {
    return this.#parent === entity;
  }

  removeFromParent() {
    if (this.#parent) {
      this.#parent.emit(EntityProxy.RemoveChild, this, this.#parent);
      this.#parent.emit(EntityProxy.RemoveFromParent, this.#parent, this);
      this.#parent = undefined;
    }
  }

  addChild(entity: EntityProxy) {
    if (!entity.isChildOf(this)) {
      this.removeFromParent();
      entity.#parent = this;
      this.emit(EntityProxy.AddChild, entity, this);
      entity.emit(EntityProxy.SetParent, this, entity);
    }
  }
}
