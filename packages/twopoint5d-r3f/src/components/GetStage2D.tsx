import {Stage2D} from '@spearwolf/twopoint5d';
import {type ReactNode} from 'react';
import {useStage2D} from '../hooks/useStage2D.js';

export interface GetStage2DProps {
  /**
   * If you use an array, make sure that the array always has the same number of elements.
   * Otherwise the react hooks rules will be violated.
   */
  name: string | string[];
  children: (...stages: Stage2D[]) => ReactNode;
  fallback?: ReactNode;
}

export function GetStage2D({name, children, fallback}: GetStage2DProps) {
  const stageNames = Array.isArray(name) ? name : [name];
  const stages = stageNames.map((stageName) => useStage2D(stageName));

  return stages.every((stage) => stage != null) ? children(...(stages as Stage2D[])) : (fallback ?? null);
}

GetStage2D.displayName = 'GetStage2D';
