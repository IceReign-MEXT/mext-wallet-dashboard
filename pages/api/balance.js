import Web3 from 'web3';
import { Connection, PublicKey } from '@solana/web3.js';

export default async function handler(req, res) {
  try {
    const ethRpc = process.env.ETH_RPC;
    const solRpc = process.env.SOL_RPC;
    const ethWallet = process.env.ETH_WALLET;
    const solWallet = process.env.SOL_WALLET;

    // Ethereum balance
    const web3 = new Web3(new Web3.providers.HttpProvider(ethRpc));
    const ethBalanceWei = await web3.eth.getBalance(ethWallet);
    const ethBalance = web3.utils.fromWei(ethBalanceWei, 'ether');

    // Solana balance
    const connection = new Connection(solRpc, 'confirmed');
    const balanceLamports = await connection.getBalance(new PublicKey(solWallet));
    const solBalance = balanceLamports / 1e9;

    res.status(200).json({
      eth: ethBalance,
      sol: solBalance
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch balances' });
  }
}
