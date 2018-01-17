export interface BlockHeader {
  number: number;
  hash: string;
  parentHash: string;
  nonce: string;
  sha3Uncles: string;
  logsBloom: string;
  transactionRoot: string;
  stateRoot: string;
  receiptRoot: string;
  miner: string;
  extraData: string;
  gasLimit: number;
  gasUsed: number;
  timestamp: number;
}

export interface Block extends BlockHeader {
  transactions: Array<Transaction>;
  size: number;
  difficulty: number;
  totalDifficulty: number;
  uncles: Array<string>;
}

export interface Transaction {
  hash: string;
  nonce: number;
  blockHash: string;
  blockNumber: number;
  transactionIndex: number;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gas: number;
  input: string;
  v?: string;
  r?: string;
  s?: string;
}

export interface TransactionReceipt {
  transactionHash: string
  transactionIndex: number
  blockHash: string
  blockNumber: number
  from: string
  to: string
  contractAddress: string
  cumulativeGasUsed: number
  gasUsed: number
  logs?: Array<Log>
  events?: {
    [eventName: string]: EventLog
  },
  status: string
}