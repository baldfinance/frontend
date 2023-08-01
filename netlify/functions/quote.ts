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

const V2_ROUTER_ADDRESSES: AddressMap = {
  [ChainId.BASE]: '0xBe8758DA8d5aC48191Ea4367DE48f4E216aCA9F8',
  [ChainId.BASE_GOERLI]: '0xcF34aD93dcA3aa41871D8A794D51e1480b3a9677',
};

const ROUTER_ABI = [
    "function quote(uint amountA, uint reserveA, uint reserveB) internal pure returns (uint amountB)",
    "function getAmountsOut(uint amountIn, address[] memory path) public view virtual override returns (uint[] memory amounts)",
]

const FACTORY_ABI = [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)"
]

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

const PAIR_ABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
]

const WETH_ADDRESSES = {
  [ChainId.BASE]: "0x4200000000000000000000000000000000000006",
  [ChainId.BASE_GOERLI]: "0x4200000000000000000000000000000000000006",
};

const SHINY_ADDRESSES = {
  [ChainId.BASE]: "0xbe49A5AeFB08cC5b84dBcB92B5aae6B78Dac3A8c",
  [ChainId.BASE_GOERLI]: "0x45F65264b6C254cFa23163849fAB4FC8CaFe143f",
};

enum URAQuoteType {
  CLASSIC = 'CLASSIC',
  DUTCH_LIMIT = 'DUTCH_LIMIT',
}

type TokenInRoute = Pick<Token, 'address' | 'chainId' | 'symbol' | 'decimals'>

type V2Reserve = {
  token: TokenInRoute
  quotient: string
}

type V2PoolInRoute = {
  type: 'v2-pool'
  tokenIn: TokenInRoute
  tokenOut: TokenInRoute
  reserve0: V2Reserve
  reserve1: V2Reserve
  amountIn?: string
  amountOut?: string

  // not used in the interface
  // avoid returning it from the client-side smart-order-router
  address?: string
}

interface ClassicQuoteData {
  quoteId?: string
  requestId?: string
  blockNumber: string
  amount: string
  amountDecimals: string
  gasPriceWei: string
  gasUseEstimate: string
  gasUseEstimateQuote: string
  gasUseEstimateQuoteDecimals: string
  gasUseEstimateUSD: string
  methodParameters?: { calldata: string; value: string }
  quote: string
  quoteDecimals: string
  quoteGasAdjusted: string
  quoteGasAdjustedDecimals: string
  route: Array<V2PoolInRoute[]>
  routeString: string
}

type URAClassicQuoteResponse = {
  routing: URAQuoteType.CLASSIC
  quote: ClassicQuoteData
  allQuotes: Array<number>
}

const makeRouteLeg = async (pairContract: Contract, tokenIn: Token, tokenOut: Token, amountIn: string, amountOut: string): Promise<V2PoolInRoute> => {
    const reserves = await pairContract.getReserves();
    const token0 = await pairContract.token0();
    let reserve0, reserve1;
    if (token0 === tokenIn.address) {
      reserve0 = {
        token: tokenIn,
        quotient: reserves[0].toString()
      }
      reserve1 = {
        token: tokenOut,
        quotient: reserves[1].toString()
      }
    }
    else {
      reserve0 = {
        token: tokenOut,
        quotient: reserves[0].toString()
      }
      reserve1 = {
        token: tokenIn,
        quotient: reserves[1].toString()
      }
    }
  return {
    type: 'v2-pool',
    address: pairContract.address,
    tokenIn: tokenIn,
    tokenOut: tokenOut,
    reserve0: reserve0,
    reserve1: reserve1,
    amountIn: amountIn,
    amountOut: amountOut,
  }
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const provider = new ethers.providers.JsonRpcProvider("https://base-goerli.blastapi.io/b2ba991b-e915-4fd6-8f73-2d60d2350ce5");
  const body = JSON.parse(event.body || "{}");
  const WETH_ADDRESS = WETH_ADDRESSES[body.tokenInChainId];
  let tokenIn = body.tokenIn;
  if (tokenIn === "ETH") {
    tokenIn = WETH_ADDRESS;
  }
  let tokenOut = body.tokenOut;
  if (tokenOut === "ETH") {
    tokenOut = WETH_ADDRESS;
  }
  let amount = body.amount;

  const tradeType = body.type;
  if (!tokenIn || !tokenOut || !amount || !tradeType) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid query parameters" }),
    };
  }
  const CHAIN_ID = body.tokenInChainId;
  const ROUTER_ADDRESS = V2_ROUTER_ADDRESSES[CHAIN_ID];
  const FACTORY_ADDRESS = V2_FACTORY_ADDRESSES[CHAIN_ID];
  const WETH_TOKEN = new Token(CHAIN_ID, WETH_ADDRESS, 18, "WETH", "Wrapped Ether");
  const SHINY_TOKEN = new Token(CHAIN_ID, SHINY_ADDRESSES[CHAIN_ID], 18, "SHINY", "Shiny");
  const erc20_token_in = new ethers.Contract(tokenIn, ERC20_ABI, provider);
  const erc20_token_out = new ethers.Contract(tokenOut, ERC20_ABI, provider);
  const tokenInCanonical = new Token(CHAIN_ID, tokenIn, (await erc20_token_in.decimals()), (await erc20_token_in.symbol()).toString());
  const tokenOutCanonical = new Token(CHAIN_ID, tokenOut, (await erc20_token_out.decimals()), (await erc20_token_out.symbol()).toString());
  // Finding a route
  // If a tokenIn->tokenOut route exists, use it
  // Otherwise, try to find a tokenIn->SHINY->tokenOut route
  // Otherwise, try to find a tokenIn->WETH->tokenOut route
  // If no route exists, return an error
  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, provider);

  const directPairAddress = await factory.getPair(tokenInCanonical.address, tokenOutCanonical.address);

  let amountOut; let route : Array<V2PoolInRoute[]> = [];

  console.log("direct", directPairAddress)
  if (directPairAddress !== ethers.constants.AddressZero) {
    // Direct route exists
    amountOut = (await router.getAmountsOut(amount, [tokenInCanonical.address, tokenOutCanonical.address]))[1].toString();
    route = [
      [
        await makeRouteLeg(
          new ethers.Contract(directPairAddress, PAIR_ABI, provider),
          tokenInCanonical,
          tokenOutCanonical,
          amount,
          amountOut
        )
      ]
    ]
  }

  if (route.length === 0) {
    // Try to find a route via SHINY
    const shinyTokenInPair = await factory.getPair(tokenInCanonical.address, SHINY_TOKEN.address);
    const shinyTokenOutPair = await factory.getPair(SHINY_TOKEN.address, tokenOutCanonical.address);
    if (shinyTokenInPair !== ethers.constants.AddressZero && shinyTokenOutPair !== ethers.constants.AddressZero) {
      // Route via SHINY exists
      const shinyAmountOut = (await router.getAmountsOut(amount, [tokenInCanonical.address, SHINY_TOKEN.address, tokenOutCanonical.address]))[2].toString();
      const firstLegAmountOut = (await router.getAmountsOut(amount, [tokenInCanonical.address, SHINY_TOKEN.address]))[1].toString();
      if (amountOut === undefined || shinyAmountOut < amountOut) {
        amountOut = shinyAmountOut;
        route = [
          [
            await makeRouteLeg(
              new ethers.Contract(shinyTokenInPair, PAIR_ABI, provider),
              tokenInCanonical,
              SHINY_TOKEN,
              amount,
              firstLegAmountOut,
            ),
            await makeRouteLeg(
              new ethers.Contract(shinyTokenOutPair, PAIR_ABI, provider),
              SHINY_TOKEN,
              tokenOutCanonical,
              firstLegAmountOut,
              amountOut
            )
          ]
        ]
      }
    }
  }

  if (route.length === 0) {
    // Try to find a route via WETH
    const wethTokenInPair = await factory.getPair(tokenInCanonical.address, WETH_TOKEN.address);
    const wethTokenOutPair = await factory.getPair(WETH_TOKEN.address, tokenOutCanonical.address);
    if (wethTokenInPair !== ethers.constants.AddressZero && wethTokenOutPair !== ethers.constants.AddressZero) {
      // Route via WETH exists
      const wethAmountOut = (await router.getAmountsOut(amount, [tokenInCanonical.address, WETH_TOKEN.address, tokenOutCanonical.address]))[2].toString();
      const firstLegAmountOut = (await router.getAmountsOut(amount, [tokenInCanonical.address, WETH_TOKEN.address]))[1].toString();
      if (amountOut === undefined || wethAmountOut < amountOut) {
        amountOut = wethAmountOut;
        route = [
          [
            await makeRouteLeg(
              new ethers.Contract(wethTokenInPair, PAIR_ABI, provider),
              tokenInCanonical,
              WETH_TOKEN,
              amount,
              firstLegAmountOut,
            ),
            await makeRouteLeg(
              new ethers.Contract(wethTokenOutPair, PAIR_ABI, provider),
              WETH_TOKEN,
              tokenOutCanonical,
              firstLegAmountOut,
              amountOut
            )
          ]
        ]
      }
    }
  }

  if (route.length === 0) {
    // No route exists
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "No route exists" }),
    };
  }

  const response: URAClassicQuoteResponse = {
    routing: URAQuoteType.CLASSIC,
    quote: {
      blockNumber: (await provider.getBlockNumber()).toString(),
      amount: amount,
      amountDecimals: "",
      gasPriceWei: (await provider.getGasPrice()).toString(),
      gasUseEstimate: "",
      gasUseEstimateQuote: "",
      gasUseEstimateQuoteDecimals: "",
      gasUseEstimateUSD: "",
      quote: amountOut.toString(),
      quoteDecimals: "",
      quoteGasAdjusted: "",
      quoteGasAdjustedDecimals: "",
      route: route,
      routeString: ""
    },
    allQuotes: []
  }

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
};

export { handler };