// scripts/payment_watcher.js
// Run with: node scripts/payment_watcher.js
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { Connection, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const INVOICES_FILE = path.join(DATA_DIR, 'invoices.json');
const SUB_FILE = path.join(DATA_DIR, 'subscribers.json');

function loadInvoices(){ try { return JSON.parse(fs.readFileSync(INVOICES_FILE)); } catch(e){ return []; } }
function saveInvoices(x){ fs.writeFileSync(INVOICES_FILE, JSON.stringify(x, null,2)); }
function loadSubs(){ try{ return JSON.parse(fs.readFileSync(SUB_FILE)); }catch(e){ return []; } }
function saveSubs(x){ fs.writeFileSync(SUB_FILE, JSON.stringify(x, null,2)); }

const ETHERSCAN_API = process.env.ETHERSCAN_API;
const ETH_ADDR = (process.env.PLATFORM_ETH_ADDRESS||'').toLowerCase();
const SOL_ADDR = process.env.PLATFORM_SOL_ADDRESS || '';
const SOL_RPC = process.env.SOL_RPC || 'https://api.mainnet-beta.solana.com';
const TG_BOT = process.env.TG_BOT_TOKEN || null;
const TG_CHAT = process.env.TG_CHAT_ID || null;

const ethProvider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC || 'https://rpc.ankr.com/eth');
const solConnection = new Connection(SOL_RPC, 'confirmed');

async function sendTelegram(text){
  if(!TG_BOT || !TG_CHAT) return;
  try {
    const url = `https://api.telegram.org/bot${TG_BOT}/sendMessage`;
    await fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode:'HTML' })});
  } catch(e){ console.error('tg err', e.message || e); }
}

async function checkEthInvoices(){
  if(!ETHERSCAN_API || !ETH_ADDR) return;
  const invoices = loadInvoices().filter(i=>i.status==='pending' && i.chain==='eth');
  if(invoices.length===0) return;
  const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${ETH_ADDR}&startblock=0&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API}`;
  const r = await fetch(url);
  const j = await r.json();
  if(j.status !== "1") return;
  const txs = j.result || [];
  for(const inv of invoices){
    // match by exact value in ETH (allow small epsilon)
    for(const tx of txs){
      try {
        if(tx.to && tx.to.toLowerCase() === ETH_ADDR){
          const valueEth = Number(ethers.utils.formatEther(ethers.BigNumber.from(tx.value)));
          const target = Number(inv.amount);
          // allow small rounding tolerance
          if(Math.abs(valueEth - target) < (1e-6)){
            // mark paid
            inv.status = 'paid';
            inv.paidTx = tx.hash;
            inv.paidAt = Date.now();
            inv.payer = tx.from;
            const subs = loadSubs();
            subs.push({id: inv.id, plan: inv.plan, payer: tx.from, chain:'eth', amount: valueEth, since: Date.now()});
            saveSubs(subs);
            saveInvoices(loadInvoices().map(x=> x.id===inv.id?inv:x));
            await sendTelegram(`💰 Invoice <b>${inv.id}</b> paid on ETH by <code>${tx.from}</code> amount ${valueEth} ETH. Plan: ${inv.plan}`);
            console.log('ETH invoice paid', inv.id, tx.hash);
            break;
          }
        }
      } catch(e){ console.error('eth match error', e); }
    }
  }
}

async function checkSolInvoices(){
  const invoices = loadInvoices().filter(i=>i.status==='pending' && i.chain==='sol');
  if(invoices.length===0) return;
  // fetch recent signatures for the platform address
  const sigs = await solConnection.getSignaturesForAddress(new PublicKey(SOL_ADDR), { limit: 200 });
  for(const inv of invoices){
    for(const s of sigs){
      if(s.err) continue; // skip failed
      const parsed = await solConnection.getParsedTransaction(s.signature, 'confirmed');
      if(!parsed) continue;
      // find account index of platform address
      const keys = parsed.transaction.message.accountKeys.map(k=>k.pubkey.toString());
      const idx = keys.indexOf(SOL_ADDR);
      if(idx === -1) continue;
      const pre = parsed.meta.preBalances[idx];
      const post = parsed.meta.postBalances[idx];
      const diffLamports = post - pre;
      const diffSol = diffLamports / 1e9;
      const target = Number(inv.amount);
      if(Math.abs(diffSol - target) < 1e-6){
        // mark paid
        inv.status = 'paid';
        inv.paidTx = s.signature;
        inv.paidAt = Date.now();
        inv.payer = parsed.transaction.message.accountKeys[0].pubkey.toString();
        const subs = loadSubs();
        subs.push({id: inv.id, plan: inv.plan, payer: inv.payer, chain:'sol', amount: diffSol, since: Date.now()});
        saveSubs(subs);
        saveInvoices(loadInvoices().map(x=> x.id===inv.id?inv:x));
        await sendTelegram(`💰 Invoice <b>${inv.id}</b> paid on SOL by <code>${inv.payer}</code> amount ${diffSol} SOL. Plan: ${inv.plan}`);
        console.log('SOL invoice paid', inv.id, s.signature);
        break;
      }
    }
  }
}

async function mainLoop(){
  console.log('Payment watcher started.');
  while(true){
    try {
      await checkEthInvoices();
      await checkSolInvoices();
    } catch(e){
      console.error('watcher err', e);
    }
    // sleep 20s
    await new Promise(r=>setTimeout(r, 20000));
  }
}

mainLoop().catch(e=>console.error(e));
