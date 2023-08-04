import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { Contract, ethers } from "ethers";
import { ChainId, CurrencyAmount, Token, TradeType } from "@uniswap/sdk-core";

const ONCHAIN_READER_ADDRESSES = {
  [ChainId.BASE]: "0x5e4be8Bc9637f0EAA1A755019e06A68ce081D58F",
  [ChainId.BASE_GOERLI]: "0xbBB69e6428CeeBA9CE1DFE86c3B7b72ffE56BE64",
};

const ONCHAIN_READER_ABI = [
  "function getBalances(address account, address[] memory addresses) public view returns (uint256[] memory)",
];

const RPC_ENDPOINTS = {
  [ChainId.BASE]: "https://base-mainnet.blastapi.io/b2ba991b-e915-4fd6-8f73-2d60d2350ce5",
  [ChainId.BASE_GOERLI]: "https://base-goerli.blastapi.io/b2ba991b-e915-4fd6-8f73-2d60d2350ce5",
};


const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const body = JSON.parse(event.body || "{}");
  const tokens: string[] = body.tokens
  const account = body.account;
  const CHAIN_ID = body.chainId;
  const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[CHAIN_ID]);

  const ONCHAIN_READER = ONCHAIN_READER_ADDRESSES[CHAIN_ID];

  const onChainReader = new ethers.Contract(ONCHAIN_READER, ONCHAIN_READER_ABI, provider);

  const balances = await onChainReader.getBalances(account, tokens);

  const response: {[tokenAddress: string]: CurrencyAmount<Token>}  = balances.map((balance, index) => {
    console.log("balance", index, balance)
    return {
      [tokens[index]]: CurrencyAmount.fromRawAmount(new Token(CHAIN_ID, tokens[index], 18, "UNI-V2") , balance.toString()),
    }
  });

  console.log("response", response)
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
};

export { handler };