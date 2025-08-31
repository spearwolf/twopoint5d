import type {EVENT_SHOW_DEMOS} from './constants.js';

export interface LookBookShowDemosEventDetail {
  showAll: boolean;
  filterById?: Set<string>;
  activeTags?: Set<string>;
  relatedTags?: Set<string>;
}

export interface LookBookShowDemosEvent extends CustomEvent {
  detail: LookBookShowDemosEventDetail;
}

export interface LookBookEventMap {
  [EVENT_SHOW_DEMOS]: LookBookShowDemosEvent;
}

declare global {
  interface DocumentEventMap extends LookBookEventMap {
    addEventListener<K extends keyof LookBookEventMap>(
      type: K,
      listener: (this: Document, ev: LookBookEventMap[K]) => void,
    ): void;
    dispatchEvent<K extends keyof LookBookEventMap>(ev: LookBookEventMap[K]): void;
  }
}
