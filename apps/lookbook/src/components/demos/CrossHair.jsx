import styled from 'styled-components';

const SIZE = 30;
const THICKNESS = 2;
const COLOR = 'rgba(0, 0, 0, 0.5)';

const Container = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 50%;
  height: 50%;
  z-index: 1000000;
  pointer-events: none;
  user-select: none;
`;

const CrossHairGrid = styled.div`
  position: absolute;
  right: 0;
  bottom: 0;
  transform: translate(50%, 50%);

  display: grid;
  grid-template-columns: ${SIZE}px ${SIZE}px;
  grid-auto-rows: ${SIZE}px;

  & > div {
    &:nth-child(1),
    &:nth-child(3) {
      border-right: ${THICKNESS}px solid ${COLOR};
    }

    &:nth-child(2),
    &:nth-child(4) {
      border-left: ${THICKNESS}px solid ${COLOR};
    }

    &:nth-child(1),
    &:nth-child(2) {
      border-bottom: ${THICKNESS}px solid ${COLOR};
    }

    &:nth-child(3),
    &:nth-child(4) {
      border-top: ${THICKNESS}px solid ${COLOR};
    }
  }
`;

export const CrossHair = () => (
  <Container>
    <CrossHairGrid>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </CrossHairGrid>
  </Container>
);
