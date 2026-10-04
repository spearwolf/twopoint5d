import type {EVENT_GENERATE_PREVIEW, EVENT_SHOW_DEMOS, EVENT_TOGGLE_TAG} from './constants.js';

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

export interface LookBookGeneratePreviewEventDetail {
  /** The last segment of the page path, the id of the demo's `_<id>.json`. */
  demoId: string;
  /** `timeout`: the default delay ran out; `ready`: the demo called `ready()` of its handle. */
  trigger: 'timeout' | 'ready';
}

/** The demo page is ready for the screenshot of its preview image; see `~demos/utils/demoPreview`. */
export interface LookBookGeneratePreviewEvent extends CustomEvent {
  detail: LookBookGeneratePreviewEventDetail;
}

export interface LookBookEventMap {
  [EVENT_SHOW_DEMOS]: LookBookShowDemosEvent;
  [EVENT_TOGGLE_TAG]: LookBookToggleTagEvent;
  [EVENT_GENERATE_PREVIEW]: LookBookGeneratePreviewEvent;
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
