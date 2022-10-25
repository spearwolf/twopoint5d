import { Stage2DContext, useStageResize } from "twopoint5d-r3f";
import { useContext } from "react";

export const LogStageSizeToConsole = () => {
  const stage = useContext(Stage2DContext);

  useStageResize((width, height) =>
    console.log(`stage[${stage?.name}] size is`, width, height)
  );

  return null;
};
