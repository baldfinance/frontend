import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { Contract, ethers } from "ethers";
import { ChainId, CurrencyAmount, Token, TradeType } from "@uniswap/sdk-core";

declare type AddressMap = {
  [chainId: number]: string;
};


const V2_FACTORY_ADDRESSES: AddressMap = {
  [ChainId.BASE]: '0x40e383B4820F84d9D4887caC490FD7C37094874c',
  [ChainId.BASE_GOERLI]: '0x25688571dEd2d102053Ca0EFD382E87c00231A23',
};
const PAIR_READER_ADDRESSES = {
  [ChainId.BASE]: "0x5e4be8Bc9637f0EAA1A755019e06A68ce081D58F",
  [ChainId.BASE_GOERLI]: "0xbBB69e6428CeeBA9CE1DFE86c3B7b72ffE56BE64",
};

const PAIR_READER_ABI = [
  "function getPairAddresses(address v2_factory, address[][] memory tokens) public view returns (address[] memory)",
];

const RPC_ENDPOINTS = {
  [ChainId.BASE]: "https://base-mainnet.blastapi.io/b2ba991b-e915-4fd6-8f73-2d60d2350ce5",
  [ChainId.BASE_GOERLI]: "https://base-goerli.blastapi.io/b2ba991b-e915-4fd6-8f73-2d60d2350ce5",
};


const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const body = JSON.parse(event.body || "{}");
  const tokens: [Token, Token][] = body.tokens.map((token) => {return [token[0].address || token[0]._checksummedAddress, token[1].address || token[1]._checksummedAddress]});
  const CHAIN_ID = body.chainId;
  const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[CHAIN_ID]);

  const FACTORY_ADDRESS = V2_FACTORY_ADDRESSES[CHAIN_ID];
  const PAIR_READER_ADDRESS = PAIR_READER_ADDRESSES[CHAIN_ID];

  const pairReader = new ethers.Contract(PAIR_READER_ADDRESS, PAIR_READER_ABI, provider);

  const addresses = await pairReader.getPairAddresses(FACTORY_ADDRESS, tokens);

  const response = tokens.map((token, index) => {
    return {
      tokens: token,
      liquidityToken: addresses[index],
    }
  })

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
};

export { handler };