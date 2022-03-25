import { useStageSize } from "picimo";
import { useEffect } from "react";

export const LogStageSizeToConsole = () => {
  const [width, height] = useStageSize();

  useEffect(() => {
    console.log("stage size is", width, height);
  }, [width, height]);

  return null;
};
