/**
 * Add a new item to the array, but only if it does not already exist
 */
export function appendTo<T = unknown>(array: T[], item: T) {
  const index = array.indexOf(item);
  if (index === -1) {
    array.push(item);
  }
}

export function removeFrom<T = unknown>(array: T[], item: T) {
  const index = array.indexOf(item);
  if (index !== -1) {
    array.splice(index, 1);
  }
}
