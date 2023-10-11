import {Stage2D} from '@spearwolf/twopoint5d';
import {useContext, useEffect, useState} from 'react';
import {REGISTER, StageRendererContext, UNREGISTER} from '../context/StageRenderer.js';

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
        [REGISTER](stageName: string, addedStage: Stage2D) {
          if (stageName === name && stage !== addedStage) {
            setStage(addedStage);
          }
        },
        [UNREGISTER](stageName: string) {
          if (stageName === name && stage) {
            setStage(undefined);
          }
        },
      });
    }
  }, [stageRenderer, name, stage]);

  return stage;
}
