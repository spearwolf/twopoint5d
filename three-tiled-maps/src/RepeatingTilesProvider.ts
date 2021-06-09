import { IMap2dTileDataProvider } from "./IMap2dTileDataProvider";

export type RepeatingTilesPatternType = number | number[] | number[][];
export type LimitToAxisType = "horizontal" | "vertical" | "none";

/**
 * The `RepeatingTilesProvider` repeats a 2D pattern of tile IDs endlessly.
 * If you want you can limit the repeat to only horizontal or only vertical.
 */
export class RepeatingTilesProvider implements IMap2dTileDataProvider {
  constructor(
    tileIds: RepeatingTilesPatternType,
    limitToAxis: LimitToAxisType = "none"
  ) {}

  getTileIdsWithin(
    left: number,
    top: number,
    width: number,
    height: number,
    target?: Uint32Array
  ): Uint32Array {
    throw new Error("Method not implemented.");
  }
}
