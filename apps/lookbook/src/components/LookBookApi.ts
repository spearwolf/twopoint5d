import type {IDemo, ITag} from '~demos/utils/loadMetadataForDemos';
import {
  STORAGE_KEY_ACTIVE_TAGS,
  STORAGE_KEY_FILTER_DEMOS_BY_ID,
  STORAGE_KEY_RELATED_TAGS,
  STORAGE_KEY_SHOW_ALL_DEMOS,
} from './constants';
import type {LookBookShowDemosEventDetail} from './types';

export interface LookBookMetadata {
  demos: IDemo[];
  tags: Map<string, ITag>;
}

export function getShowDemosConfig(): LookBookShowDemosEventDetail {
  const localFilterById = localStorage.getItem(STORAGE_KEY_FILTER_DEMOS_BY_ID);
  const localActiveTags = localStorage.getItem(STORAGE_KEY_ACTIVE_TAGS);
  const localRelatedTags = localStorage.getItem(STORAGE_KEY_RELATED_TAGS);

  return {
    showAll: !(localStorage.getItem(STORAGE_KEY_SHOW_ALL_DEMOS) === 'false'),
    filterById: localFilterById ? new Set(localFilterById.split(',')) : undefined,
    activeTags: localActiveTags ? new Set(localActiveTags.split(',')) : undefined,
    relatedTags: localRelatedTags ? new Set(localRelatedTags.split(',')) : undefined,
  };
}

export function saveShowDemosConfig(config: LookBookShowDemosEventDetail) {
  localStorage.setItem(STORAGE_KEY_SHOW_ALL_DEMOS, config.showAll ? 'true' : 'false');

  if (config.showAll) {
    localStorage.removeItem(STORAGE_KEY_FILTER_DEMOS_BY_ID);
    localStorage.removeItem(STORAGE_KEY_ACTIVE_TAGS);
    localStorage.removeItem(STORAGE_KEY_RELATED_TAGS);
  } else {
    if (config.filterById?.size) {
      localStorage.setItem(STORAGE_KEY_FILTER_DEMOS_BY_ID, Array.from(config.filterById).join(','));
    } else {
      localStorage.removeItem(STORAGE_KEY_FILTER_DEMOS_BY_ID);
    }
    if (config.activeTags?.size) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_TAGS, Array.from(config.activeTags).join(','));
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_TAGS);
    }
    if (config.relatedTags?.size) {
      localStorage.setItem(STORAGE_KEY_RELATED_TAGS, Array.from(config.relatedTags).join(','));
    } else {
      localStorage.removeItem(STORAGE_KEY_RELATED_TAGS);
    }
  }
}

let metadata: LookBookMetadata = undefined;

export function getMetadataForDemos(): LookBookMetadata | undefined {
  if (metadata) return metadata;

  const lookMetatdataEl = document.getElementById('lookbook-metadata');
  if (lookMetatdataEl) {
    const demos = JSON.parse(lookMetatdataEl.getAttribute('data-lookbook-demos'));
    const tags = JSON.parse(lookMetatdataEl.getAttribute('data-lookbook-tags'));

    metadata = {
      demos,
      tags: new Map(
        Object.entries(tags).map(([k, v]: [string, any]) => [
          k,
          {demoIds: new Set(v.demoIds), relatedTags: new Set(v.relatedTags)},
        ]),
      ),
    };
  } else {
    throw new Error('LookBook metadata element not found');
  }

  return metadata;
}
