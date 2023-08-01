import { Trans } from "@lingui/macro";
import { InterfacePageName } from "@uniswap/analytics-events";
import { Trace } from "analytics";
import { SmallButtonPrimary } from "components/Button";
import { useIsMobile } from "nft/hooks";
import { Link } from "react-router-dom";
import styled from "styled-components/macro";
import { ThemedText } from "theme";
import { useIsDarkMode } from "theme/components/ThemeToggle";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Header = styled(Container)`
  gap: 30px;
`;

const PageWrapper = styled(Container)`
  flex: 1;
  justify-content: center;
  gap: 50px;

  @media screen and (min-width: ${({ theme }) => theme.breakpoint.md}px) {
    justify-content: space-between;
    padding-top: 64px;
  }
`;

export default function Soon() {
  const isDarkMode = useIsDarkMode();
  const isMobile = useIsMobile();

  const Title = isMobile ? ThemedText.LargeHeader : ThemedText.Hero;

  return (
    <PageWrapper>
      <Trace page={InterfacePageName.NOT_FOUND} shouldLogImpression>
        <Header>
          <Container>
            <Title color="white" fontSize={128}>🔜</Title>
          </Container>
        </Header>
        <SmallButtonPrimary as={Link} to="/">
          <Trans>Go back to Swaps</Trans>
        </SmallButtonPrimary>
      </Trace>
    </PageWrapper>
  );
}
