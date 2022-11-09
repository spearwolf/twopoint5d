import { useCallback } from "react";
import styled, { css } from "styled-components";
import { useDemoStore } from "./useDemoStore";

const Layout = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  margin: 10px;
`;

const CameraButtonStyled = styled.button`
  margin: 2px 4px;
  padding: 0.5em 1em;

  border-radius: 1em;
  border: 0;

  font-family: sans-serif;
  font-size: 16px;
  font-weight: bold;

  cursor: pointer;
  user-select: none;

  ${({ isRadio }) =>
    isRadio &&
    css`
      &:first-child {
        margin-right: 0;
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      }

      &:not(:last-child):not(:first-child) {
        margin-left: 0;
        margin-right: 0;
        border-radius: 0;
      }

      &:last-child {
        margin-left: 0;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
      }
    `}

  ${({ isActive }) =>
    isActive
      ? css`
          background: #eee;
          color: #333;

          &:hover {
            background: #fff;
          }
        `
      : css`
          background: #333;
          color: #eee;

          &:hover {
            background: #555;
          }
        `}
`;

const CameraButton = ({ value, label, isActive, onAction, radioGroup }) => {
  const onClick = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      onAction(value);
    },
    [value]
  );

  return (
    <CameraButtonStyled
      isRadio={!!radioGroup}
      isActive={!!isActive}
      onPointerDown={onClick}
    >
      {label}
    </CameraButtonStyled>
  );
};

const CAMERA_BUTTONS = [
  {
    key: "cam0",
    label: "Move Map2D",
  },
  {
    key: "cam1",
    label: "Control Static Camera",
  },
  {
    key: "cam2",
    label: "Control Map2D Camera",
  },
];

export const SwitchCameraUI = () => {
  const activeCamera = useDemoStore((state) => state.activeCameraName);
  const setActiveCamera = useDemoStore((state) => state.setActiveCamera);

  return (
    <Layout>
      {CAMERA_BUTTONS.map(({ key, label }) => (
        <CameraButton
          key={key}
          radioGroup
          value={key}
          label={label}
          isActive={activeCamera === name}
          onAction={(name) => setActiveCamera(name)}
        />
      ))}
    </Layout>
  );
};
