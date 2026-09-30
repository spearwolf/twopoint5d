import type {IDemo} from '~demos/utils/loadMetadataForDemos';

/**
 * The demos that match `query`, in the order of `demos`. The query is split at whitespace
 * into terms, and a demo matches when every term is part of its title, its id, one of its
 * tags, its short description or its description, case ignored. An empty query matches
 * every demo.
 */
export function searchDemos(demos: readonly IDemo[], query: string): IDemo[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...demos];

  return demos.filter((demo) => {
    const haystack = [demo.title, demo.id, ...(demo.tags ?? []), demo.shortDescription ?? '', demo.description ?? '']
      .join('\n')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
