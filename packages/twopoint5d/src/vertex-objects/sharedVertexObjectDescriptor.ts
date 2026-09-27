import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {sameVertexObjectDescription} from './sameVertexObjectDescription.js';
import type {FrozenVertexObjectDescription, VertexObjectDescription} from './types.js';

// keyed by the description object a caller hands a pool; weak, so a description nothing else
// holds takes its descriptor and prototype with it
const descriptors = new WeakMap<object, VertexObjectDescriptor>();

/**
 * The descriptor for a description object: the one an earlier call built from the same object,
 * as long as the description still describes what it did then, and a new one otherwise.
 *
 * @internal
 */
export function sharedVertexObjectDescriptor(
  description: VertexObjectDescription | FrozenVertexObjectDescription,
): VertexObjectDescriptor {
  const known = descriptors.get(description);
  // a description is a plain object its author may change after the first pool; the descriptor
  // holds a frozen copy, and a pool built after the change has to see the change, so a
  // description that no longer matches gets a descriptor of its own and the pools built before
  // keep theirs
  if (known !== undefined && sameVertexObjectDescription(description, known.description)) return known;
  // the constructor only reads what it is handed and builds its own copy of it, so a frozen
  // description serves as well as a live one
  const descriptor = new VertexObjectDescriptor(description as VertexObjectDescription);
  descriptors.set(description, descriptor);
  return descriptor;
}
