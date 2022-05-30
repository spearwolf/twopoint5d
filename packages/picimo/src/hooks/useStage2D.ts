import {Stage2D} from '@spearwolf/stage25';
import {useContext, useEffect, useState} from 'react';
import {StageRendererContext} from '../context/StageRenderer';

export function useStage2D(name: string): Stage2D | undefined {
  const stageRenderer = useContext(StageRendererContext);

  const [stage, setStage] = useState<Stage2D | undefined>(stageRenderer.getStage(name));

  useEffect(() => {
    if (stageRenderer) {
      const nextStage = stageRenderer.getStage(name);

      if (stage !== nextStage) {
        setStage(nextStage);
      }

      return stageRenderer.on({
        addStage(stageName: string, addedStage: Stage2D) {
          if (stageName === name && stage !== addedStage) {
            setStage(addedStage);
          }
        },
        removeStage(stageName: string) {
          if (stageName === name && stage) {
            setStage(undefined);
          }
        },
      });
    }
  }, [stageRenderer, name, stage]);

  return stage;
}
