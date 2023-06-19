import {EntitiesLink} from './EntitiesLink';
import {EntityKernel} from './EntityKernel';
import {EntitiesSyncEvent} from './types';

export class EntitiesDirectLink extends EntitiesLink {
  readonly kernel = new EntityKernel();

  constructor(namespace?: string | symbol) {
    super(namespace);

    this.on(EntitiesLink.OnSync, (event: EntitiesSyncEvent) => this.kernel.run(event));
  }

  public override start(): EntitiesDirectLink {
    super.start();
    return this;
  }
}
