import {Stage2D} from '@spearwolf/stage25';
import {ReactNode} from 'react';
import {useStage2D} from '../hooks/useStage2D';

export interface GetStage2DProps {
  name: string;
  children: (stage: Stage2D | undefined) => ReactNode;
  fallback?: ReactNode;
}

export function GetStage2D({name, children, fallback}: GetStage2DProps) {
  const stage = useStage2D(name);

  return stage ? children(stage) : fallback ?? null;
}

GetStage2D.displayName = 'GetStage2D';
