import { useCallback } from "react";
import styled, { css } from "styled-components";
import { useDemoStore } from "./useDemoStore";

const Layout = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  margin: 1em auto;
  display: flex;
  justify-content: center;
`;

const CameraButtonStyled = styled.button`
  font-family: sans-serif;
  font-size: 1rem;
  font-weight: bold;

  line-height: 1;

  margin: 0.1em 0.2em;
  padding: 0.5em 1em;

  border-radius: 1em;
  border: 0;

  cursor: pointer;
  user-select: none;

  transition: 0.2s;

  position: relative;
  z-index: 0;

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
          color: #fff;

          box-shadow: inset 0 0 1.5em #cc9, inset 0.5em 0 1.5em #f06,
            inset -0.5em 0 1.5em #06f, inset 0.5em 0 3em #f06,
            inset -0.5em 0 5em #06f, 0 0 0.5em #fff, -0.5em 0 1.5em #f06,
            0.5em 0 1.5em #06f;

          z-index: 1;
        `
      : css`
          background: #202028;
          color: #eee;

          &:hover {
            background: #282830;
            text-shadow: 0 0 0.5em #fff, -0.5em 0 2em #f09, 0.5em 0 2em #09f;
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
    key: "cam1",
    label: "Orbit Around",
  },
  {
    key: "cam0",
    label: "Map2D Pan-Control",
  },
  {
    key: "cam2",
    label: "Control Map2D Camera",
  },
  {
    key: "cam3",
    label: "View & Control Map2D Camera",
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
          isActive={activeCamera === key}
          onAction={(name) => setActiveCamera(name)}
        />
      ))}
    </Layout>
  );
};
