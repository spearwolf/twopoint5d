import type {EVENT_SHOW_DEMOS, EVENT_TOGGLE_TAG} from './constants.js';

export interface LookBookShowDemosEventDetail {
  showAll: boolean;
  filterById?: Set<string>;
  activeTags?: Set<string>;
  relatedTags?: Set<string>;
}

export interface LookBookShowDemosEvent extends CustomEvent {
  detail: LookBookShowDemosEventDetail;
}

/** Asks the tag filter to toggle a tag, as a click on the tag in the filter would. */
export interface LookBookToggleTagEvent extends CustomEvent {
  detail: {tag: string};
}

export interface LookBookEventMap {
  [EVENT_SHOW_DEMOS]: LookBookShowDemosEvent;
  [EVENT_TOGGLE_TAG]: LookBookToggleTagEvent;
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
