import { useStage2DSize } from "picimo";
import { useEffect } from "react";

export const LogStage2DSizeToConsole = () => {
  const [width, height] = useStage2DSize();

  useEffect(() => {
    console.log("stage size is", width, height);
  }, [width, height]);

  return null;
};
