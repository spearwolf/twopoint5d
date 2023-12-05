import {baseUrl, makeUrl} from './makeUrl.js';

const tags: Map<string, {demoIds: Set<string>; relatedTags: Set<string>}> = new Map();

const demos = Object.entries(
  import.meta.glob('../../pages/demos/*.json', {
    eager: true,
  }),
).map(([filepath, json]: [string, any]) => {
  const id = filepath.replace(/.*\/([^/.]+)\.json$/, '$1');
  if (json.tags) {
    json.tags.forEach((tag: string) => {
      if (!tags.has(tag)) {
        tags.set(tag, {demoIds: new Set(), relatedTags: new Set()});
      }
      const meta = tags.get(tag)!;
      meta.demoIds.add(id);
      json.tags.filter((t: string) => t !== tag).forEach((t: string) => meta.relatedTags.add(t));
    });
  }
  return {...json, id, href: makeUrl(json.url), tags: json.tags?.sort()};
}) as {
  id: string;
  title: string;
  description?: string;
  url: string;
  href: string;
  previewImage?: string;
  tags?: string[];
}[];

const uniqTagKeys = Array.from(tags.keys()).sort();

export const loadMetadataForDemos = () => ({
  baseUrl,
  demos,
  tags,
  uniqTagKeys,
});
