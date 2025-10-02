import { useEffect, useState } from "react";

export default function Home(){
  const [invoices, setInvoices] = useState([]);
  const [subs, setSubs] = useState([]);
  const [invoiceResp, setInvoiceResp] = useState(null);

  async function loadData(){
    const inv = await fetch("/data/invoices.json").then(r=>r.json()).catch(()=>[]);
    const sb = await fetch("/data/subscribers.json").then(r=>r.json()).catch(()=>[]);
    setInvoices(inv);
    setSubs(sb);
  }

  useEffect(()=>{ loadData(); const i = setInterval(loadData,15000); return ()=>clearInterval(i); }, []);

  async function createInvoice(plan='basic', payIn='USDT'){
    const resp = await fetch("/api/create-invoice", {
      method:"POST",
      headers: {"content-type":"application/json"},
      body: JSON.stringify({ user: "web_user", plan, payIn })
    });
    const j = await resp.json();
    setInvoiceResp(j.invoice);
    await loadData();
  }

  return (
    <div style={{padding:20}}>
      <h1>💎 ICEGODS Dashboard</h1>
      <div style={{marginTop:20}}>
        <button onClick={()=>createInvoice('basic','USDT')}>Create Basic (USDT)</button>
        <button onClick={()=>createInvoice('basic','ETH')}>Create Basic (ETH)</button>
        <button onClick={()=>createInvoice('basic','SOL')}>Create Basic (SOL)</button>
      </div>

      <h2 style={{marginTop:20}}>Invoices</h2>
      {invoices.length===0 ? <p>No invoices yet.</p> : invoices.map(i=>(
        <div key={i.id} style={{border:"1px solid #444", padding:10, margin:6}}>
          <div><b>ID:</b> {i.id}</div>
          <div><b>Amount:</b> {i.amount} {i.payIn}</div>
          <div><b>Status:</b> {i.status}</div>
          <div><b>Pay to:</b> {i.payTo}</div>
          <div><button onClick={()=>navigator.clipboard && navigator.clipboard.writeText(i.payTo)}>Copy Address</button></div>
        </div>
      ))}

      <h2 style={{marginTop:20}}>Subscribers</h2>
      {subs.length===0 ? <p>No subscribers yet.</p> : subs.map((s,idx)=>(
        <div key={idx}>{s.wallet} • {s.chain} • {s.plan}</div>
      ))}

      {invoiceResp && (
        <div style={{position:"fixed", right:20, bottom:20, background:"#222", padding:12, color:"#fff"}}>
          <div>Invoice created: {invoiceResp.id}</div>
          <div>Send exactly: <b>{invoiceResp.amount} {invoiceResp.payIn}</b></div>
          <div>To: {invoiceResp.payTo}</div>
        </div>
      )}
    </div>
  );
}
