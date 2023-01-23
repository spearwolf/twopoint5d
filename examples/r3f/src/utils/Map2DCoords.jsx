import styled from "styled-components";

const Map2DCoordsContainer = styled.section`
  position: fixed;
  left: 2rem;
  bottom: 4rem;
`;

const Map2DCoordsText = styled.div`
  color: #fff;
  font-size: 1.5rem;
  font-weight: bold;
`;

export const Map2DCoords = () => (
  <Map2DCoordsContainer>
    <Map2DCoordsText>
      <span className="map2dCoords" />
    </Map2DCoordsText>
  </Map2DCoordsContainer>
);
