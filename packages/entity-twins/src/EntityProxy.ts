import {EntityProxyContext} from './EntityProxyContext';
import {generateUUID} from './generateUUID';

export class EntityProxy {
  #uuid: string;
  #token: string;

  #namespace?: string | symbol;
  #context: EntityProxyContext;
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
      parent.addChild(this);
    } else {
      this.removeFromParent();
    }
  }

  constructor(token: string, parent?: EntityProxy, namespace?: string | symbol) {
    this.#uuid = generateUUID();

    this.#token = token;
    this.#parent = parent;
    this.#namespace = namespace;

    this.#context = EntityProxyContext.get(this.#namespace);
    this.#context.addEntity(this);
  }

  isChildOf(entity: EntityProxy) {
    return this.#parent === entity;
  }

  removeFromParent() {
    if (this.#parent) {
      this.#context.removeChildFromParent(this.uuid, this.#parent);
      this.#parent = undefined;
    }
  }

  addChild(child: EntityProxy) {
    if (!child.isChildOf(this)) {
      child.removeFromParent();
      child.#parent = this;
      this.#context.addToChildren(this, child);
    }
  }

  destroy() {
    this.removeFromParent();
    this.#context.removeEntity(this);
  }
}
