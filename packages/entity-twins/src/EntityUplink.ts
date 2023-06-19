import {Eventize} from '@spearwolf/eventize';
import {EntityKernel} from './EntityKernel';

export class EntityUplink extends Eventize {
  #kernel: EntityKernel;
  #uuid: string;

  get kernel(): EntityKernel {
    return this.#kernel;
  }

  get uuid(): string {
    return this.#uuid;
  }

  constructor(kernel: EntityKernel, uuid: string) {
    super();
    this.#kernel = kernel;
    this.#uuid = uuid;
  }
}
