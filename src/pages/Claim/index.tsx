import { Trans } from "@lingui/macro";
import {
  BrowserEvent,
  InterfaceElementName,
  InterfaceEventName,
  InterfacePageName,
  InterfaceSectionName,
  SharedEventName,
  SwapEventName,
} from "@uniswap/analytics-events";
import { formatCurrencyAmount, NumberType } from "@uniswap/conedison/format";
import {
  ChainId,
  Currency,
  CurrencyAmount,
  NativeCurrency,
  Percent,
  Token,
} from "@uniswap/sdk-core";
import { useWeb3React } from "@web3-react/core";
import { sendAnalyticsEvent, Trace, TraceEvent, useTrace } from "analytics";
import { useToggleAccountDrawer } from "components/AccountDrawer";
import AddressInputPanel from "components/AddressInputPanel";
import {
  ButtonError,
  ButtonLight,
  ButtonPrimary,
  ButtonSecondary,
} from "components/Button";
import { GrayCard } from "components/Card";
import { AutoColumn } from "components/Column";
import SwapCurrencyInputPanel from "components/CurrencyInputPanel/SwapCurrencyInputPanel";
import { NetworkAlert } from "components/NetworkAlert/NetworkAlert";
import { AutoRow, RowBetween, RowFixed } from "components/Row";
import confirmPriceImpactWithoutFee from "components/swap/confirmPriceImpactWithoutFee";
import ConfirmSwapModal from "components/swap/ConfirmSwapModal";
import PriceImpactModal from "components/swap/PriceImpactModal";
import PriceImpactWarning from "components/swap/PriceImpactWarning";
import {
  ArrowWrapper,
  PageWrapper,
  SwapWrapper,
} from "components/swap/styleds";
import SwapDetailsDropdown from "components/swap/SwapDetailsDropdown";
import SwapHeader from "components/swap/SwapHeader";
import TokenSafetyModal from "components/TokenSafety/TokenSafetyModal";
import { getChainInfo } from "constants/chainInfo";
import { asSupportedChain, isSupportedChain } from "constants/chains";
import { getSwapCurrencyId, TOKEN_SHORTHANDS } from "constants/tokens";
import { useCurrency, useDefaultActiveTokens } from "hooks/Tokens";
import { useIsSwapUnsupported } from "hooks/useIsSwapUnsupported";
import { useMaxAmountIn } from "hooks/useMaxAmountIn";
import usePermit2Allowance, { AllowanceState } from "hooks/usePermit2Allowance";
import usePrevious from "hooks/usePrevious";
import { SwapResult, useSwapCallback } from "hooks/useSwapCallback";
import { useSwitchChain } from "hooks/useSwitchChain";
import { useUSDPrice } from "hooks/useUSDPrice";
import useWrapCallback, {
  WrapErrorText,
  WrapType,
} from "hooks/useWrapCallback";
import JSBI from "jsbi";
import { formatSwapQuoteReceivedEventProperties } from "lib/utils/analytics";
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { ArrowDown } from "react-feather";
import { useLocation, useNavigate } from "react-router-dom";
import { Text } from "rebass";
import { useAppDispatch, useAppSelector } from "state/hooks";
import { InterfaceTrade, TradeState } from "state/routing/types";
import { isClassicTrade, isUniswapXTrade } from "state/routing/utils";
import { Field, replaceSwapState } from "state/swap/actions";
import {
  useDefaultsFromURLSearch,
  useDerivedSwapInfo,
  useSwapActionHandlers,
} from "state/swap/hooks";
import swapReducer, {
  initialState as initialSwapState,
  SwapState,
} from "state/swap/reducer";
import styled, { useTheme } from "styled-components/macro";
import { LinkStyledButton, ThemedText } from "theme";
import { computeFiatValuePriceImpact } from "utils/computeFiatValuePriceImpact";
import { maxAmountSpend } from "utils/maxAmountSpend";
import { computeRealizedPriceImpact, warningSeverity } from "utils/prices";
import { didUserReject } from "utils/swapErrorToUserReadableMessage";

import { useScreenSize } from "../../hooks/useScreenSize";
import {
  BRIDGE_CONTRACTS,
  CLAIM_CONTRACTS,
  UNIVERSAL_ROUTER_ADDRESSES,
} from "constants/routing";
import PrefetchBalancesWrapper from "components/AccountDrawer/PrefetchBalancesWrapper";
import { darken } from "polished";
import { flexColumnNoWrap, flexRowNoWrap } from "theme/styles";
import NumericalInput from "components/NumericalInput";
import { loadingOpacityMixin } from "components/Loader/styled";
import { Box, Flex, VStack } from "@chakra-ui/layout";
import { NumberInput, NumberInputField } from "@chakra-ui/number-input";
import useCurrencyBalance, {
  useNativeCurrencyBalances,
} from "lib/hooks/useCurrencyBalance";
import CurrencyLogo from "components/Logo/CurrencyLogo";
import useNativeCurrency from "lib/hooks/useNativeCurrency";
import { startSwitchingChain } from "state/wallets/reducer";
import { BigNumber, ethers } from "ethers";
import { Button, HStack } from "@chakra-ui/react";
import { ApprovalState, useApproveCallback } from "hooks/useApproveCallback";
import { formatEther } from "ethers/lib/utils";

export const ArrowContainer = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;

  width: 100%;
  height: 100%;
`;

const SwapSection = styled.div`
  position: relative;
  background-color: ${({ theme }) => theme.backgroundModule};
  border-radius: 12px;
  padding: 16px;
  color: ${({ theme }) => theme.textSecondary};
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;

  &:before {
    box-sizing: border-box;
    background-size: 100%;
    border-radius: inherit;

    position: absolute;
    top: 0;
    left: 0;

    width: 100%;
    height: 100%;
    pointer-events: none;
    content: "";
    border: 1px solid ${({ theme }) => theme.backgroundModule};
  }

  &:hover:before {
    border-color: ${({ theme }) => theme.stateOverlayHover};
  }

  &:focus-within:before {
    border-color: ${({ theme }) => theme.stateOverlayPressed};
  }
`;

const OutputSwapSection = styled(SwapSection)`
  border-bottom: ${({ theme }) => `1px solid ${theme.backgroundSurface}`};
`;

const InputPanel = styled.div<{ hideInput?: boolean }>`
  ${flexColumnNoWrap};
  position: relative;
  border-radius: ${({ hideInput }) => (hideInput ? "16px" : "20px")};
  z-index: 1;
  width: ${({ hideInput }) => (hideInput ? "100%" : "initial")};
  transition: height 1s ease;
  will-change: height;
`;

const FixedContainer = styled.div`
  width: 100%;
  height: 100%;
  position: absolute;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
`;

const Container = styled.div<{ hideInput: boolean }>`
  min-height: 44px;
  border-radius: ${({ hideInput }) => (hideInput ? "16px" : "20px")};
  width: ${({ hideInput }) => (hideInput ? "100%" : "initial")};
`;

const StyledSwapHeader = styled(RowBetween)`
  margin-bottom: 10px;
  color: ${({ theme }) => theme.textSecondary};
`;

const HeaderButtonContainer = styled(RowFixed)`
  padding: 0 12px;
  gap: 16px;
`;

const InputRow = styled.div`
  ${flexRowNoWrap};
  align-items: center;
  justify-content: space-between;
`;

const LabelRow = styled.div`
  ${flexRowNoWrap};
  align-items: center;
  color: ${({ theme }) => theme.textSecondary};
  font-size: 0.75rem;
  line-height: 1rem;

  span:hover {
    cursor: pointer;
    color: ${({ theme }) => darken(0.2, theme.textSecondary)};
  }
`;

const FiatRow = styled(LabelRow)`
  justify-content: flex-end;
  min-height: 20px;
  padding: 8px 0px 0px 0px;
`;

const Aligner = styled.span`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;

const StyledTokenName = styled.span<{ active?: boolean }>`
  ${({ active }) =>
    active
      ? "  margin: 0 0.25rem 0 0.25rem;"
      : "  margin: 0 0.25rem 0 0.25rem;"}
  font-size: 20px;
  font-weight: 600;
`;

const StyledBalanceMax = styled.button<{ disabled?: boolean }>`
  background-color: transparent;
  border: none;
  color: ${({ theme }) => theme.accentAction};
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  opacity: ${({ disabled }) => (!disabled ? 1 : 0.4)};
  padding: 4px 6px;
  pointer-events: ${({ disabled }) => (!disabled ? "initial" : "none")};

  :hover {
    opacity: ${({ disabled }) => (!disabled ? 0.8 : 0.4)};
  }

  :focus {
    outline: none;
  }
`;

const StyledNumericalInput = styled(NumericalInput)<{ $loading: boolean }>`
  ${loadingOpacityMixin};
  text-align: left;
  font-size: 36px;
  line-height: 44px;
  font-variant: small-caps;
`;

export default function ClaimPage({ className }: { className?: string }) {
  const { chainId: connectedChainId } = useWeb3React();
  const loadedUrlParams = useDefaultsFromURLSearch();

  const location = useLocation();

  return (
    <Trace page={InterfacePageName.SWAP_PAGE} shouldLogImpression>
      <PageWrapper>
        <Claim className={className} chainId={connectedChainId} />
      </PageWrapper>
      {/* {location.pathname === '/swap' && <SwitchLocaleLink />} */}
    </Trace>
  );
}

/**
 * The swap component displays the swap interface, manages state for the swap, and triggers onchain swaps.
 *
 * In most cases, chainId should refer to the connected chain, i.e. `useWeb3React().chainId`.
 * However if this component is being used in a context that displays information from a different, unconnected
 * chain (e.g. the TDP), then chainId should refer to the unconnected chain.
 */

const CLAIM_ABI = [
  "function claimShare() external",
  "function getETHOut(address account) external view returns (uint256)",
];
export function Claim({
  className,
  chainId,
}: {
  className?: string;
  prefilledState?: Partial<SwapState>;
  chainId?: ChainId;
  onCurrencyChange?: (
    selected: Pick<SwapState, Field.INPUT | Field.OUTPUT>
  ) => void;
  disableTokenInputs?: boolean;
}) {
  const {
    account,
    chainId: connectedChainId,
    connector,
    provider,
  } = useWeb3React();
  const currency =
    useCurrency("0x8ec4574176888f3f285eeca14aa967ddbfb4e245", chainId) ||
    undefined;
  const balance = useCurrencyBalance(account, currency);
  const nativeCurrency = useNativeCurrency(chainId);
  const nativeBalance = useNativeCurrencyBalances([account])[account || ""];
  const [approval, approveCallback] = useApproveCallback(
    balance,
    CLAIM_CONTRACTS[chainId || 0]
  );
  const [ethOut, setEthOut] = useState<string>("");

  useEffect(() => {
    if (connectedChainId) {
      const signer = provider?.getSigner();
      const contract = new ethers.Contract(
        CLAIM_CONTRACTS[connectedChainId],
        CLAIM_ABI,
        signer
      );
      contract.getETHOut(account).then((res: BigNumber) => {
        setEthOut(formatEther(res));
      });
    }
  }, [balance]);

  const handleClaim = async () => {
    if (connectedChainId) {
      const signer = provider?.getSigner();
      const contract = new ethers.Contract(
        CLAIM_CONTRACTS[connectedChainId],
        CLAIM_ABI,
        signer
      );
      const tx = await contract.claimShare();
      await tx.wait();
    }
  };

  const unsupportedChain =
  connectedChainId !== ChainId.BASE &&
  connectedChainId !== ChainId.BASE_GOERLI;
  
  const claimingContractIsBeingDeployed = false;

  let button;

  if (approval === ApprovalState.APPROVED) {
    button = (
      <ButtonPrimary disabled={claimingContractIsBeingDeployed} onClick={handleClaim}>Claim your share</ButtonPrimary>
    );
  } else if (approval === ApprovalState.PENDING) {
    button = <ButtonPrimary disabled>Approval pending</ButtonPrimary>;
  } else {
    button = (
      <ButtonPrimary disabled={claimingContractIsBeingDeployed} onClick={approveCallback}>
        Approve Claiming Contract
      </ButtonPrimary>
    );
  }

  return (
    <SwapWrapper chainId={chainId} className={className} id="swap-page">
      <StyledSwapHeader>
        <HeaderButtonContainer>
          <ThemedText.SubHeader>
            {!unsupportedChain && (
              <Text fontSize="18px">Claim your share of the $SHINY LP</Text>
            )}
            {unsupportedChain && (
              <Text fontSize="18px" color="red">
                Unsupported chain, switch to Base
              </Text>
            )}
            {claimingContractIsBeingDeployed && (
              <Text fontSize="18px" color="red">
                The claiming contract is currently being deployed, please refresh the page in a few minutes
              </Text>
            )}
          </ThemedText.SubHeader>
        </HeaderButtonContainer>
      </StyledSwapHeader>
      <VStack spacing="12px">
        <Flex bg="#F5F6FC" borderRadius="12px" h="100px" flexDirection="column">
          <Flex flexDirection="row">
            <NumberInput
              w="100%"
              paddingY="16px"
              value={formatCurrencyAmount(balance)}
              isDisabled={unsupportedChain}
              isReadOnly
            >
              <NumberInputField
                w="100%"
                border="none"
                fontSize="36px"
                lineHeight="44px"
                fontWeight="500"
                textAlign="left"
                _focusVisible={{ outline: "none" }}
                value={formatCurrencyAmount(balance)}
              />
            </NumberInput>
            <RowFixed mr="36px">
              <CurrencyLogo
                style={{ marginRight: "2px" }}
                currency={currency}
                size="24px"
              />
              <StyledTokenName
                className="token-symbol-container"
                active={Boolean(currency && currency.symbol)}
              >
                {currency?.symbol}
              </StyledTokenName>
            </RowFixed>
          </Flex>
          <HStack w="100%" paddingX="12px" align="center" justify="right">
            <Text
              textAlign="right"
              color="rgb(119, 128, 160)"
              lineHeight="1rem"
              fontSize="14px"
            >
              Balance: {formatCurrencyAmount(balance)}
            </Text>
          </HStack>
        </Flex>
        <StyledSwapHeader>
          <HeaderButtonContainer>
            <ThemedText.SubHeader>
              <Text fontSize="18px">You will receive:</Text>
            </ThemedText.SubHeader>
          </HeaderButtonContainer>
        </StyledSwapHeader>
        <Flex bg="#F5F6FC" borderRadius="12px" h="100px" flexDirection="column">
          <Flex flexDirection="row">
            <NumberInput
              w="100%"
              paddingY="16px"
              value={ethOut}
              isDisabled={unsupportedChain}
              isReadOnly
            >
              <NumberInputField
                w="100%"
                border="none"
                fontSize="36px"
                lineHeight="44px"
                fontWeight="500"
                textAlign="left"
                _focusVisible={{ outline: "none" }}
                placeholder="0"
                value={ethOut}
              />
            </NumberInput>
            <RowFixed mr="36px">
              <CurrencyLogo
                style={{ marginRight: "2px" }}
                currency={nativeCurrency}
                size="24px"
              />
              <StyledTokenName
                className="token-symbol-container"
                active={Boolean(nativeCurrency && nativeCurrency.symbol)}
              >
                {nativeCurrency?.symbol}
              </StyledTokenName>
            </RowFixed>
          </Flex>
          <HStack w="100%" paddingX="12px" align="center" justify="right">
            <Text
              textAlign="right"
              color="rgb(119, 128, 160)"
              lineHeight="1rem"
              fontSize="14px"
            >
              Balance: {formatCurrencyAmount(nativeBalance)}
            </Text>
          </HStack>
        </Flex>
        {button}
      </VStack>
    </SwapWrapper>
  );
}
