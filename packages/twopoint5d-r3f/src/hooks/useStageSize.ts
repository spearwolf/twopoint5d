import {on} from '@spearwolf/eventize';
import {Stage2D} from '@spearwolf/twopoint5d';
import {StageResize} from '@spearwolf/twopoint5d/events.js';
import {useContext, useEffect, useState} from 'react';
import {Stage2DContext} from '../components/Stage2D.js';

/**
 * Use this hook if you simply want to know the stage size.
 * Note that it can happen that this hook is triggered even if there are no changes in the size.
 * If you want to implement an effect that should only be called when the size changes,
 * then use the `useStageResize(callback)` hook instead.
 */
export function useStageSize() {
  const parentStage = useContext(Stage2DContext);

  const parentStageWidth = parentStage?.width ?? 0;
  const parentStageHeight = parentStage?.height ?? 0;

  const [size, setSize] = useState<[width: number, height: number]>([parentStageWidth, parentStageHeight]);

  const updateSize = (w: number, h: number) => {
    if (w !== size[0] || h !== size[1]) {
      setSize([w ?? 0, h ?? 0]);
    }
  };

  useEffect(() => {
    if (parentStage) {
      updateSize(parentStage.width, parentStage.height);

      return on(parentStage, StageResize, ({width, height}: Stage2D) => {
        updateSize(width, height);
      });
    }
  }, [parentStage]);

  return size;
}
