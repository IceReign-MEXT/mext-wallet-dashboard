// scripts/payment_watcher.js
import fs from "fs";
import path from "path";
import { ethers } from "ethers";
import { Connection, PublicKey } from "@solana/web3.js";
import fetch from "node-fetch";

const INVOICES_FILE = process.env.INVOICES_FILE || path.join(process.cwd(), "data", "invoices.json");
const SUBS_FILE = process.env.SUBS_FILE || path.join(process.cwd(), "data", "subscribers.json");

const ETH_RPC = process.env.ETH_RPC;
const SOL_RPC = process.env.SOL_RPC;
const PLATFORM_ETH = (process.env.PLATFORM_ETH || "").toLowerCase();
const PLATFORM_SOL = process.env.PLATFORM_SOL;
const USDT_CONTRACT = (process.env.USDT_CONTRACT || "").toLowerCase();

const provider = new ethers.JsonRpcProvider(ETH_RPC);
const solConn = new Connection(SOL_RPC, "confirmed");

// helper I/O
function loadInvoices(){ try { return JSON.parse(fs.readFileSync(INVOICES_FILE)); } catch(e){ return []; } }
function saveInvoices(x){ fs.writeFileSync(INVOICES_FILE, JSON.stringify(x, null, 2)); }
function loadSubs(){ try { return JSON.parse(fs.readFileSync(SUBS_FILE)); } catch(e){ return []; } }
function saveSubs(x){ fs.writeFileSync(SUBS_FILE, JSON.stringify(x, null, 2)); }

async function checkEthAndUsdt(){
  const invoices = loadInvoices();
  const pending = invoices.filter(i => i.status === "pending" && (i.payIn === "ETH" || i.payIn === "USDT"));

  if(pending.length === 0) return;

  // 1) Check ETH transfers by scanning recent transactions to PLATFORM_ETH via getHistory if supported
  // We'll use provider.getLogs for USDT Transfer events and provider.getBalance for ETH (but ETH requires matching txs).
  // Fetch last 5000 blocks range (safe)
  const latest = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latest - 1200); // ~5k-10k blocks depending on chain speed; tune as needed

  // USDT Transfer topic
  const transferTopic = ethers.id("Transfer(address,address,uint256)");

  // get logs where 'to' is PLATFORM_ETH for USDT contract
  if(USDT_CONTRACT){
    try {
      const logs = await provider.getLogs({
        address: USDT_CONTRACT,
        topics: [transferTopic, null, ethers.hexZeroPad(PLATFORM_ETH, 32)],
        fromBlock,
        toBlock: latest
      });
      // parse logs
      for(const log of logs){
        try {
          const parsed = ethers.AbiCoder.defaultAbiCoder().decode(["address","address","uint256"], log.data);
        } catch(e){}
        // decode manual with interface
        const iface = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
        const parsedLog = iface.parseLog(log);
        const from = parsedLog.args.from.toLowerCase();
        const to = parsedLog.args.to.toLowerCase();
        const value = parsedLog.args.value; // BigNumber
        const usdtAmount = Number(ethers.formatUnits(value, 6)); // USDT has 6 decimals

        // match pending invoices with payIn USDT and same amount (allow tiny epsilon)
        for(const inv of pending.filter(p => p.payIn === "USDT")){
          if(inv.amount && Math.abs(Number(inv.amount) - usdtAmount) < 1e-6){
            // mark paid
            inv.status = "paid";
            inv.paidTx = log.transactionHash;
            inv.paidAt = Date.now();
            // add subscriber
            const subs = loadSubs();
            subs.push({ wallet: from, plan: inv.plan || "basic", chain: "USDT", joinedAt: Date.now() });
            saveSubs(subs);
            saveInvoices(invoices);
            console.log("USDT invoice paid:", inv.id, usdtAmount, log.transactionHash);
          }
        }
      }
    } catch(e){
      console.error("USDT log check error", e);
    }
  }

  // ETH: scan for transactions where 'to' = PLATFORM_ETH and value in wei matches invoice amount
  try {
    // fetch recent block range txs for PLATFORM_ETH via etherscan-like provider? provider.getHistory may be implemented by some providers
    // We'll attempt provider.getHistory if available:
    if(provider.getHistory){
      const history = await provider.getHistory(PLATFORM_ETH, fromBlock, latest);
      for(const tx of history){
        const valueEth = Number(ethers.formatEther(tx.value));
        for(const inv of pending.filter(p => p.payIn === "ETH")){
          if(inv.amount && Math.abs(Number(inv.amount) - valueEth) < 1e-9){
            inv.status = "paid";
            inv.paidTx = tx.hash;
            inv.paidAt = Date.now();
            const subs = loadSubs();
            subs.push({ wallet: tx.from, plan: inv.plan || "basic", chain: "ETH", joinedAt: Date.now() });
            saveSubs(subs);
            saveInvoices(invoices);
            console.log("ETH invoice paid:", inv.id, valueEth, tx.hash);
          }
        }
      }
    } else {
      // fallback: check balance change — simpler but less reliable (not used here)
    }
  } catch(e){
    console.error("ETH history check error", e);
  }
}

async function checkSol(){
  const invoices = loadInvoices();
  const pending = invoices.filter(i => i.status === "pending" && i.payIn === "SOL");
  if(pending.length === 0) return;

  // get recent signatures
  try {
    const sigs = await solConn.getSignaturesForAddress(new PublicKey(PLATFORM_SOL), { limit: 200 });
    for(const s of sigs){
      if(s.err) continue;
      const parsed = await solConn.getParsedTransaction(s.signature, "confirmed");
      if(!parsed || !parsed.meta) continue;
      // find index of PLATFORM_SOL in accountKeys
      const keys = parsed.transaction.message.accountKeys.map(k => k.pubkey.toString());
      const idx = keys.indexOf(PLATFORM_SOL);
      if(idx === -1) continue;
      const pre = parsed.meta.preBalances[idx];
      const post = parsed.meta.postBalances[idx];
      const diff = (post - pre) / 1e9;
      for(const inv of pending){
        if(inv.amount && Math.abs(Number(inv.amount) - diff) < 1e-9){
          inv.status = "paid";
          inv.paidTx = s.signature;
          inv.paidAt = Date.now();
          // payer is likely parsed.transaction.message.accountKeys[0]
          const payer = parsed.transaction.message.accountKeys[0].pubkey.toString();
          const subs = loadSubs();
          subs.push({ wallet: payer, plan: inv.plan || "basic", chain: "SOL", joinedAt: Date.now() });
          saveSubs(subs);
          saveInvoices(invoices);
          console.log("SOL invoice paid:", inv.id, diff, s.signature);
        }
      }
    }
  } catch(e){
    console.error("Solana check error", e);
  }
}

async function mainLoop(){
  console.log("Payment watcher started");
  while(true){
    try {
      await checkEthAndUsdt();
      await checkSol();
    } catch(e){
      console.error("Watcher loop error", e);
    }
    await new Promise(r => setTimeout(r, 20000)); // 20s
  }
}

mainLoop();
