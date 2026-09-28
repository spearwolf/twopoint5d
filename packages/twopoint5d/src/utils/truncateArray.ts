/**
 * Cuts `list` to its first `length` entries, one `pop()` at a time; a list no longer than that
 * stays as it is.
 *
 * For a list that is filled again afterwards — the working lists a frame loop empties and fills
 * on every frame. `list.length = n` lets V8 give the backing store back (always for 0, otherwise
 * when less than half of it remains), and the next fill builds it again; `pop()` keeps it.
 */
export function truncateArray(list: unknown[], length = 0): void {
  while (list.length > length) list.pop();
}
