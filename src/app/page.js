"use client";
import React, { useState, useEffect } from 'react';
import { Zap, Lock, Unlock, Activity, TrendingUp } from 'lucide-react';
import { PublicKey, Connection } from '@solana/web3.js';
import { createPayment } from '@/lib/payment';
import { supabase } from '@/lib/supabase';

export default function IceGodsAlpha() {
  const [isPaid, setIsPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState(null);

  // Check VIP status on load or wallet change
  useEffect(() => {
    const checkVIP = async () => {
      if (window.solana?.publicKey) {
        const pubKey = window.solana.publicKey.toString();
        setWallet(pubKey);
        const { data } = await supabase
          .from('paid_users')
          .select('*')
          .eq('wallet_address', pubKey)
          .single();
        if (data) setIsPaid(true);
      }
    };
    checkVIP();
  }, [wallet]);

  async function handlePayment() {
    try {
      setLoading(true);
      const { solana } = window;
      if (!solana) return alert("Please install Phantom wallet");

      const resp = await solana.connect();
      const userKey = new PublicKey(resp.publicKey.toString());

      const transaction = await createPayment(userKey);
      const { signature } = await solana.signAndSendTransaction(transaction);
      
      const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
      await connection.confirmTransaction(signature);

      // Save to your Supabase
      const { error } = await supabase.from('paid_users').insert([
        { wallet_address: userKey.toString(), payment_signature: signature }
      ]);

      if (error) throw error;
      setIsPaid(true);
      alert("VIP ACCESS GRANTED!");
    } catch (err) {
      console.error(err);
      alert("Payment Failed or User Canceled");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 p-4 md:p-10 font-sans selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 p-6 rounded-3xl mb-10 gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <Zap size={28} className="text-white fill-current" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic">IceGods <span className="text-blue-500 underline decoration-blue-500/50">Nexus</span></h1>
              <p className="text-[10px] text-zinc-500 tracking-[0.2em] font-bold">INSTITUTIONAL ALPHA STREAM</p>
            </div>
          </div>
          <button onClick={handlePayment} disabled={loading} className="w-full md:w-auto bg-white text-black hover:bg-zinc-200 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 active:scale-95">
            {loading ? "Confirming..." : isPaid ? "✓ VIP Access Active" : "Connect & Upgrade"}
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-900/20 border border-zinc-800 rounded-[2rem] overflow-hidden backdrop-blur-sm">
               <div className="p-8 border-b border-zinc-800 flex justify-between items-center bg-gradient-to-r from-blue-500/5 to-transparent">
                  <h2 className="text-xl font-bold flex items-center gap-3">
                    <TrendingUp className="text-blue-500" /> Live Whale Activity
                  </h2>
               </div>
               <div className="p-10 text-center">
                  <div className={isPaid ? "space-y-4" : "filter blur-2xl pointer-events-none select-none"}>
                     <div className="p-6 bg-zinc-800/30 rounded-2xl border border-zinc-700/50 flex justify-between items-center">
                        <span className="text-blue-400 font-mono text-sm">Whale_DeGod_42x...</span>
                        <span className="bg-green-500/10 text-green-500 px-4 py-1 rounded-full text-xs font-bold font-mono">+1,400 SOL BUY</span>
                     </div>
                  </div>
                  {!isPaid && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                       <Lock size={48} className="text-blue-500/50 mb-4" />
                       <h3 className="text-2xl font-black mb-2">ALPHA LOCKED</h3>
                       <p className="text-zinc-500 text-sm mb-6 max-w-xs">Join the inner circle to see live transactions and whale wallets.</p>
                       <button onClick={handlePayment} className="bg-blue-600 hover:bg-blue-500 px-10 py-4 rounded-2xl font-bold shadow-xl shadow-blue-600/20 transition-all">Unlock for 0.1 SOL</button>
                    </div>
                  )}
               </div>
            </div>
          </div>
          
          <div className="space-y-6">
             <div className="bg-blue-600 p-8 rounded-[2rem] text-white shadow-2xl shadow-blue-600/20">
                <Shield size={32} className="mb-4 opacity-80" />
                <h4 className="text-xl font-black leading-tight mb-2">Rug-Proof Detection</h4>
                <p className="text-blue-100 text-sm leading-relaxed">Every signal is verified for burned liquidity and renounced ownership.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
