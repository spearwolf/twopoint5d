import {useContext, useEffect, useState} from 'react';
import {Stage2DContext} from '../components/Stage2D';

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

      return parentStage.on('resize', (stage) => {
        updateSize(stage.width, stage.height);
      });
    }
  }, [parentStage]);

  return size;
}
