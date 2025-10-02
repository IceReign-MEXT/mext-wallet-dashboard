import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import fetch from 'node-fetch';

// Load invoice + subscriber storage
const invoicesFile = path.join(process.cwd(), 'data', 'invoices.json');
const subsFile = path.join(process.cwd(), 'data', 'subscribers.json');

// RPCs from .env
const ETH_RPC = process.env.ETH_RPC;
const SOL_RPC = process.env.SOL_RPC;
const USDT_CONTRACT = process.env.USDT_CONTRACT; // ERC20 USDT contract address

export default async function handler(req, res) {
  const invoices = JSON.parse(fs.readFileSync(invoicesFile, 'utf8'));
  const subs = JSON.parse(fs.readFileSync(subsFile, 'utf8'));

  const ethProvider = new ethers.JsonRpcProvider(ETH_RPC);
  const solConnection = new Connection(SOL_RPC, 'confirmed');

  for (let invoice of invoices) {
    if (invoice.status === 'pending') {
      if (invoice.token === 'ETH') {
        // Check ETH
        const balance = await ethProvider.getBalance(invoice.address);
        const received = Number(ethers.formatEther(balance));
        if (received >= invoice.amount) {
          invoice.status = 'paid';
          subs.push({ wallet: invoice.address, token: 'ETH', ts: Date.now() });
        }

      } else if (invoice.token === 'USDT') {
        // Check USDT ERC20 balance
        const erc20Abi = [
          "function balanceOf(address owner) view returns (uint256)",
          "function decimals() view returns (uint8)"
        ];
        const usdt = new ethers.Contract(USDT_CONTRACT, erc20Abi, ethProvider);
        const balance = await usdt.balanceOf(invoice.address);
        const decimals = await usdt.decimals();
        const received = Number(ethers.formatUnits(balance, decimals));
        if (received >= invoice.amount) {
          invoice.status = 'paid';
          subs.push({ wallet: invoice.address, token: 'USDT', ts: Date.now() });
        }

      } else if (invoice.token === 'SOL') {
        // Check Solana balance
        const pubKey = new PublicKey(invoice.address);
        const balanceLamports = await solConnection.getBalance(pubKey);
        const received = balanceLamports / 1e9; // SOL decimals = 9
        if (received >= invoice.amount) {
          invoice.status = 'paid';
          subs.push({ wallet: invoice.address, token: 'SOL', ts: Date.now() });
        }
      }
    }
  }

  fs.writeFileSync(invoicesFile, JSON.stringify(invoices, null, 2));
  fs.writeFileSync(subsFile, JSON.stringify(subs, null, 2));

  res.status(200).json({ success: true, invoices, subs });
}
