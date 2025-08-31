import tagCategoriesJson from '../../data/tag-categories.json' assert {type: 'json'};
import {baseUrl, makeUrl} from './makeUrl.js';

export interface IDemo {
  id: string;
  title: string;
  shortDescription?: string;
  description?: string;
  url: string;
  href: string;
  previewImage?: string;
  tags?: string[];
}

export interface ITag {
  demoIds: Set<string>;
  relatedTags: Set<string>;
}

interface ICategory {
  name: string;
  description?: string;
  order?: number;
  tagId?: string;
  includeTags: string[];
  tags: string[];
}

const hiddenTags = new Set(tagCategoriesJson.hiddenTags || []);

const tagCategories: Map<string, ICategory> = new Map();

tagCategoriesJson.categories.forEach((category) => {
  tagCategories.set(category.name, {
    ...category,
    tags: [],
  });
});

const tags: Map<string, {demoIds: Set<string>; relatedTags: Set<string>}> = new Map();

const demos = Object.entries(
  import.meta.glob('../../pages/demos/*.json', {
    eager: true,
  }),
).map(([filepath, json]: [string, any]) => {
  const id = filepath.replace(/.*\/([^/.]+)\.json$/, '$1');
  if (json.tags) {
    json.tags.forEach((tag: string) => {
      if (hiddenTags.has(tag)) {
        return; // Skip hidden tags
      }
      if (!tags.has(tag)) {
        tags.set(tag, {demoIds: new Set(), relatedTags: new Set()});
      }
      const meta = tags.get(tag)!;
      meta.demoIds.add(id);
      json.tags.filter((t: string) => t !== tag).forEach((t: string) => meta.relatedTags.add(t));
    });
  }
  return {...json, id, href: makeUrl(json.url), tags: json.tags?.sort()};
}) as IDemo[];

const uniqTagKeys = Array.from(tags.keys()).sort();

const defaultCategory: ICategory = {
  ...tagCategoriesJson.defaultCategory,
  includeTags: [],
  tags: [],
};

uniqTagKeys.forEach((tag) => {
  let foundCategory = false;
  for (const category of tagCategories.values()) {
    if (category.includeTags.includes(tag)) {
      category.tags.push(tag);
      foundCategory = true;
      break;
    }
  }
  if (!foundCategory) {
    if (!tagCategories.has(defaultCategory.name)) {
      tagCategories.set(defaultCategory.name, defaultCategory);
    }
    tagCategories.get(defaultCategory.name)!.tags.push(tag);
  }
});

export const loadMetadataForDemos = () => ({
  baseUrl,
  demos,
  tags,
  uniqTagKeys,
  tagCategories: Array.from(tagCategories.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
});
