const LIQ = 456;
// Base fixa R$2.100 + comissão por faixa (a parte variável é a mesma de antes;
// só a base subiu de R$1.500 para R$2.100, então cada total subiu R$600).
const ASSESSOR = [
  2100,2100,2100,2100,2100,2100,
  2700,2800,2900,3000,
  3600,3750,3900,4050,4200,
  4800,4980,5160,5340,5520,
  6100,6300,6500,6700,6900,7100,7300,7500,7700,7900,8100
];
const A_FIX = 2100;

// Margem de material por matrícula — base do saldo do pré-vendedor.
// A taxa de matrícula (R$456) já é repasse integral pra comissão do assessor,
// não sobra caixa dela; mensalidade demora 11 meses pra realizar. Por isso o
// saldo do pré-vendedor usa só a margem de material, mais conservador.
const MAT_MARGIN = 450;
const PV_PISO = 42;

// Pré-vendedor: só o modelo presencial PJ (fixo garantido) — o remoto sem fixo
// foi descartado, a segurança de renda importa mais pra reter a contratação.
function computePV(realizadas, matriculas){
  const fixo = 1800;
  const taxaReuniao = 15;
  const pisoOk = realizadas >= PV_PISO;
  const reuniaoComm = pisoOk ? realizadas * taxaReuniao : 0;
  const matComm = matriculas * 100;
  const total = fixo + reuniaoComm + matComm;
  return {fixo, reuniaoComm, matComm, total, pisoOk};
}

// Gerente: base fixa + comissão marginal sobre o total de matrículas da EQUIPE,
// em faixas (cada faixa paga mais por matrícula), + vendas próprias.
const G_FIX = 3000;
const G_TIERS = [[15,0],[30,40],[45,60],[60,80],[Infinity,100]]; // [até T matrículas da equipe, R$ por matrícula]
const G_OWN = 342;            // 60% de R$570 por matrícula própria
const GM_DESCONTO_PV = 100;   // desconto na comissão própria quando a matrícula veio do pré-vendedor
function gerenteComm(T){
  let c = 0, prev = 0;
  for(const [lim, r] of G_TIERS){
    c += Math.max(0, Math.min(T, lim) - prev) * r;
    prev = lim;
    if(T <= lim) break;
  }
  return c;
}
function gerenteTotal(matPerAssessor, nv){ return G_FIX + gerenteComm(matPerAssessor*nv); }

function brl(v){ return 'R$ ' + Math.round(v).toLocaleString('pt-BR'); }
function brlSigned(v){ const s = v<0?'− ':'+ '; return s + 'R$ ' + Math.abs(Math.round(v)).toLocaleString('pt-BR'); }

function faixa(m){
  if(m<=5) return {txt:'Base garantida', cls:'b-base'};
  if(m<=9) return {txt:'Comissão parcial', cls:'b-mid'};
  if(m<=14) return {txt:'Meta atingida', cls:'b-meta'};
  if(m<=19) return {txt:'Alta performance', cls:'b-top'};
  return {txt:'Teto do plano', cls:'b-top'};
}

let view = 'assessor';
let chart;
let escState = {nv:0, gm:0, gOwnEsc:0, pvTotal:0}; // preenchido a cada render(), lido pelo gráfico da Escola

function render(){
  const mat = +document.getElementById('mat').value;
  const nv = +document.getElementById('nv').value;
  const gm = +document.getElementById('gm').value;
  const pvRealizadas = +document.getElementById('pv-realizadas').value;
  const pvMatriculas = +document.getElementById('pv-matriculas').value;

  document.getElementById('mat-out').textContent = mat;
  document.getElementById('nv-out').textContent = nv;
  document.getElementById('gm-out').textContent = gm;
  document.getElementById('total-mat-out').textContent = (mat*nv) + gm;
  document.getElementById('pv-realizadas-out').textContent = pvRealizadas;
  document.getElementById('pv-matriculas-out').textContent = pvMatriculas;

  const aTotal = ASSESSOR[mat];
  const aBonus = aTotal - A_FIX;
  const totalMat = mat * nv;
  const gTeam = gerenteTotal(mat, nv);           // base + faixas da equipe
  const f = faixa(mat);
  const pv = computePV(pvRealizadas, pvMatriculas);
  const pvSaldo = pvMatriculas*MAT_MARGIN - pv.total;

  // Atribuição de matrículas ao pré-vendedor (gerente e equipe de assessores)
  const matgSlider = document.getElementById('esc-pv-matg');
  const mataSlider = document.getElementById('esc-pv-mata');
  matgSlider.max = gm;
  mataSlider.max = mat*nv;
  let pvMatG = Math.min(+matgSlider.value, gm);
  let pvMatA = Math.min(+mataSlider.value, mat*nv);
  if(+matgSlider.value !== pvMatG) matgSlider.value = pvMatG;
  if(+mataSlider.value !== pvMatA) mataSlider.value = pvMatA;
  document.getElementById('esc-pv-matg-out').textContent = pvMatG;
  document.getElementById('esc-pv-mata-out').textContent = pvMatA;

  const gOwn = (gm - pvMatG)*G_OWN + pvMatG*(G_OWN - GM_DESCONTO_PV);
  const gTotal = gTeam + gOwn;                   // ganho total do gerente
  const recG = mat*LIQ*nv + gm*LIQ;              // receita: assessores + matrículas próprias do gerente

  const pvMatTotalEsc = pvMatG + pvMatA;
  const pvEsc = computePV(pvRealizadas, pvMatTotalEsc);
  // O fixo do pré-vendedor sai da escola (margem de material/mensalidade), não da
  // comissão de matrícula — por isso só o variável (reunião + matrícula) entra no
  // saldo abaixo, que mede especificamente se a matrícula autofinancia a estrutura.
  const pvVariavelEsc = pvEsc.reuniaoComm + pvEsc.matComm;
  const gOwnEsc = gOwn;
  const gTotalEsc = gTotal;
  const recTotalEsc = recG;
  const pagoTotalEsc = aTotal*nv + gTotalEsc + pvVariavelEsc;
  const saldoEsc = recTotalEsc - pagoTotalEsc;
  const marginEsc = recTotalEsc>0 ? Math.round(saldoEsc/recTotalEsc*100) : 0;
  const saldoG = recG - (aTotal*nv + gTotal);
  escState = {nv, gm, gOwnEsc, pvTotal: pvVariavelEsc};

  const badge = document.getElementById('res-badge');

  if(view === 'assessor'){
    badge.className = 'badge ' + f.cls;
    badge.textContent = f.txt;
    document.getElementById('res-tag').textContent = 'Holerite do assessor';
    document.getElementById('res-body').innerHTML = `
      <div class="big-label">Seu ganho no mês</div>
      <div class="big-num pos num">${brl(aTotal)}</div>
      <div class="big-sub">com ${mat} ${mat===1?'matrícula':'matrículas'} no mês</div>
      <div class="lines">
        <div class="pline"><span class="k"><span class="dot" style="background:var(--gold)"></span>Base garantida</span><span class="v num">${brl(A_FIX)}</span></div>
        <div class="pline"><span class="k"><span class="dot" style="background:var(--emerald)"></span>Comissão por matrículas</span><span class="v num">${brl(aBonus)}</span></div>
        <div class="pline total"><span class="k">Total a receber</span><span class="v num">${brl(aTotal)}</span></div>
      </div>`;
  } else if(view === 'gerente'){
    badge.className = 'badge b-meta';
    badge.textContent = nv + (nv===1?' assessor':' assessores');
    document.getElementById('res-tag').textContent = 'Ganho do gerente';
    const ownLine = gm>0
      ? `<div class="pline"><span class="k"><span class="dot" style="background:var(--emerald)"></span>Suas matrículas (${gm})</span><span class="v num">${brl(gOwn)}</span></div>`
      : '';
    const pvNote = pvMatG>0
      ? `<div style="margin-top:14px;font-size:13px;color:var(--faint);">${pvMatG} ${pvMatG===1?'das suas matrículas veio':'das suas matrículas vieram'} de entrevista agendada pelo pré-vendedor: R$ ${G_OWN-GM_DESCONTO_PV} em vez de R$ ${G_OWN} em cada uma.</div>`
      : '';
    document.getElementById('res-body').innerHTML = `
      <div class="big-label">Seu ganho no mês como gerente</div>
      <div class="big-num pos num">${brl(gTotal)}</div>
      <div class="big-sub">equipe de ${totalMat} ${totalMat===1?'matrícula':'matrículas'}${gm>0?` + ${gm} ${gm===1?'matrícula própria':'matrículas próprias'}`:''}</div>
      <div class="lines">
        <div class="pline"><span class="k"><span class="dot" style="background:var(--gold)"></span>Base garantida</span><span class="v num">${brl(G_FIX)}</span></div>
        <div class="pline"><span class="k"><span class="dot" style="background:var(--emerald)"></span>Comissão da equipe (${totalMat} ${totalMat===1?'matrícula':'matrículas'})</span><span class="v num">${brl(gTeam - G_FIX)}</span></div>
        ${ownLine}
        <div class="pline total"><span class="k">Você recebe (gerente)</span><span class="v num">${brl(gTotal)}</span></div>
      </div>
      ${pvNote}
      ${nv>0 ? `<div style="margin-top:18px;padding-top:16px;border-top:0.5px solid var(--line);font-size:13.5px;color:var(--muted);">
        Cada um dos seus ${nv} ${nv===1?'assessor leva':'assessores leva'} <strong style="color:var(--ink)">${brl(aTotal)}</strong> fazendo ${mat} ${mat===1?'matrícula':'matrículas'}.
      </div>` : `<div style="margin-top:18px;padding-top:16px;border-top:0.5px solid var(--line);font-size:13.5px;color:var(--muted);">
        Sem assessores na equipe, seu ganho vem da base e das matrículas que você fechar.
      </div>`}`;
  } else if(view === 'prevendedor'){
    badge.className = 'badge ' + (pv.pisoOk ? 'b-meta' : 'b-loss');
    badge.textContent = pv.pisoOk ? 'Piso de reunião atingido' : 'Abaixo do piso — sem comissão de reunião';
    document.getElementById('res-tag').textContent = 'Holerite do pré-vendedor';
    document.getElementById('res-body').innerHTML = `
      <div class="big-label">Seu ganho no mês (presencial, com fixo)</div>
      <div class="big-num pos num">${brl(pv.total)}</div>
      <div class="big-sub">${pvRealizadas} reuniões realizadas · ${pvMatriculas} ${pvMatriculas===1?'matrícula originada':'matrículas originadas'}</div>
      <div class="lines">
        <div class="pline"><span class="k"><span class="dot" style="background:var(--gold)"></span>Base fixa</span><span class="v num">${brl(pv.fixo)}</span></div>
        <div class="pline"><span class="k"><span class="dot" style="background:var(--emerald)"></span>Comissão por reunião${pv.pisoOk?'':' (zerada — abaixo do piso)'}</span><span class="v num">${brl(pv.reuniaoComm)}</span></div>
        <div class="pline"><span class="k"><span class="dot" style="background:var(--slate)"></span>Comissão por matrícula</span><span class="v num">${brl(pv.matComm)}</span></div>
        <div class="pline total"><span class="k">Total a receber</span><span class="v num">${brl(pv.total)}</span></div>
      </div>
      <div style="margin-top:18px;padding-top:16px;border-top:0.5px solid var(--line);font-size:13.5px;color:var(--muted);">
        Saldo da escola nesse cenário (margem de material, R$ 450/matrícula): <strong style="color:${pvSaldo>=0?'var(--emerald)':'var(--loss)'}">${brlSigned(pvSaldo)}</strong>
      </div>`;
  } else {
    badge.className = 'badge ' + (saldoEsc>=0 ? 'b-meta':'b-loss');
    badge.textContent = saldoEsc>=0 ? 'Saldo positivo' : 'Saldo negativo';
    document.getElementById('res-tag').textContent = 'Resultado da escola';
    const ownRev = gm>0
      ? `<div class="pline"><span class="k"><span class="dot" style="background:var(--emerald)"></span>Receita das suas matrículas (gerente)</span><span class="v num">${brl(gm*LIQ)}</span></div>`
      : '';
    const pvLine = pvVariavelEsc>0
      ? `<div class="pline"><span class="k"><span class="dot" style="background:var(--slate)"></span>Pré-vendedor, variável (${pvMatTotalEsc} ${pvMatTotalEsc===1?'matrícula originada':'matrículas originadas'})</span><span class="v num">− ${brl(pvVariavelEsc)}</span></div>`
      : '';
    const descontoNote = pvMatG>0
      ? `<div style="margin-top:16px;padding-top:14px;border-top:0.5px solid var(--line);font-size:13px;color:var(--faint);">${pvMatG} ${pvMatG===1?'matrícula própria do gerente veio':'matrículas próprias do gerente vieram'} de entrevista agendada pelo pré-vendedor — comissão dessas reduzida em R$ ${GM_DESCONTO_PV}: R$ ${G_OWN-GM_DESCONTO_PV} em vez de R$ ${G_OWN}.</div>`
      : '';
    const pvFixoNote = pvEsc.fixo>0
      ? `<div style="margin-top:${pvMatG>0?'10px':'16px'};${pvMatG>0?'':'padding-top:14px;border-top:0.5px solid var(--line);'}font-size:13px;color:var(--faint);">+ ${brl(pvEsc.fixo)} de base fixa do pré-vendedor presencial — sai da escola (margem de material/mensalidade), não desconta desse saldo porque não é coberto pela comissão de matrícula.</div>`
      : '';
    document.getElementById('res-body').innerHTML = `
      <div class="big-label">Saldo da escola no mês · ${nv} ${nv===1?'assessor':'assessores'}${gm>0?' + gerente':''}${pvVariavelEsc>0?' + pré-vendedor':''}</div>
      <div class="big-num ${saldoEsc>=0?'pos':'neg'} num">${brlSigned(saldoEsc)}</div>
      <div class="big-sub">${saldoEsc>=0?'margem de '+marginEsc+'% sobre a receita bruta':'mês abaixo do ponto de equilíbrio'}</div>
      <div class="lines">
        <div class="pline"><span class="k"><span class="dot" style="background:var(--emerald)"></span>Receita bruta (assessores)</span><span class="v num">${brl(mat*LIQ*nv)}</span></div>
        ${ownRev}
        <div class="pline"><span class="k"><span class="dot" style="background:var(--gold)"></span>Assessores (${nv}× ${brl(aTotal)})</span><span class="v num">− ${brl(aTotal*nv)}</span></div>
        <div class="pline"><span class="k"><span class="dot" style="background:var(--loss)"></span>Gerente${gm>0?' (equipe + próprias)':''}</span><span class="v num">− ${brl(gTotalEsc)}</span></div>
        ${pvLine}
        <div class="pline total"><span class="k">Saldo operacional</span><span class="v num">${brlSigned(saldoEsc)}</span></div>
      </div>
      ${descontoNote}
      ${pvFixoNote}`;
  }

  const tbody = document.getElementById('tbody');
  const theadRow = document.getElementById('thead-row');

  if(view === 'prevendedor'){
    theadRow.innerHTML = `<th>Matr.</th><th>Realizadas</th><th>Comissão reunião</th><th>Comissão matrícula</th><th>Fixo</th><th>Total pago</th><th>Saldo (material)</th>`;
    let rows = '';
    for(let m=0;m<=15;m++){
      const p = computePV(pvRealizadas, m);
      const sal = m*MAT_MARGIN - p.total;
      const cls = m===pvMatriculas?'active':'';
      rows += `<tr class="${cls.trim()}">
        <td>${m}</td>
        <td class="num">${pvRealizadas}</td>
        <td class="num">${brl(p.reuniaoComm)}</td>
        <td class="num">${brl(p.matComm)}</td>
        <td class="num">${brl(p.fixo)}</td>
        <td class="num">${brl(p.total)}</td>
        <td class="num ${sal>=0?'saldo-pos':'saldo-neg'}">${brlSigned(sal)}</td>
      </tr>`;
    }
    tbody.innerHTML = rows;
    document.getElementById('table-note').innerHTML = `Simulação com <strong>${pvRealizadas} reuniões realizadas</strong> (${pv.pisoOk?'piso de 42 atingido':'abaixo do piso de 42 — comissão de reunião zerada'}), modelo <strong>presencial</strong>. Saldo calculado sobre margem de material (R$ 450/matrícula) — base conservadora: não conta mensalidade (realiza em 11 meses) nem a taxa de matrícula (já é repasse integral pra comissão do assessor).`;
  } else if(view === 'socios'){
    theadRow.innerHTML = `<th>Matr./assessor</th><th>Receita bruta</th><th>Assessor</th><th>Gerente</th><th>Pré-vendedor (variável)</th><th>Total pago</th><th>Saldo escola</th>`;
    let rows = '';
    for(let m=0;m<=30;m++){
      const at = ASSESSOR[m];
      const gtOverride = gerenteTotal(m, nv);
      const gtTotal = gtOverride + gOwnEsc;         // parte própria do gerente é fixa (não escala com m)
      const r = m*LIQ*nv + gm*LIQ;
      const pago = at*nv + gtTotal + pvVariavelEsc; // fixo do pré-vendedor não entra aqui — sai da escola, não da matrícula
      const sal = r - pago;
      const cls = (m===mat?'active ':'') + (m>=10&&m<=14?'meta-row':'');
      rows += `<tr class="${cls.trim()}">
        <td>${m}</td>
        <td class="num">${brl(r)}</td>
        <td class="num">${brl(at)}</td>
        <td class="num">${brl(gtTotal)}</td>
        <td class="num">${brl(pvVariavelEsc)}</td>
        <td class="num">${brl(pago)}</td>
        <td class="num ${sal>=0?'saldo-pos':'saldo-neg'}">${brlSigned(sal)}</td>
      </tr>`;
    }
    tbody.innerHTML = rows;
    document.getElementById('table-note').innerHTML = `Receita bruta = R$ 456 por matrícula (80% de R$ 570, já descontados 20% de royalties). Colunas consideram <strong>${nv} ${nv===1?'assessor':'assessores'}</strong>, <strong>${gm} ${gm===1?'matrícula própria':'matrículas próprias'} do gerente</strong> (${pvMatG} ${pvMatG===1?'delas vinda':'delas vindas'} do pré-vendedor, a R$ ${G_OWN-GM_DESCONTO_PV} de comissão) e <strong>${pvMatTotalEsc} ${pvMatTotalEsc===1?'matrícula originada':'matrículas originadas'}</strong> pelo pré-vendedor no total, fixos ao longo da tabela. A coluna Pré-vendedor mostra só o variável${pvEsc.fixo>0?` — o fixo de ${brl(pvEsc.fixo)} sai da escola separadamente, não da matrícula`:''}.`;
  } else if(view === 'assessor'){
    theadRow.innerHTML = `<th>Matr.</th><th>Receita líquida</th><th>Seu ganho</th><th>Sobra da matrícula</th>`;
    let rows = '';
    for(let m=0;m<=30;m++){
      const at = ASSESSOR[m];
      const r = m*LIQ;
      const sal = r - at;
      const cls = (m===mat?'active ':'') + (m>=10&&m<=14?'meta-row':'');
      rows += `<tr class="${cls.trim()}">
        <td>${m}</td>
        <td class="num">${brl(r)}</td>
        <td class="num">${brl(at)}</td>
        <td class="num ${sal>=0?'saldo-pos':'saldo-neg'}">${brlSigned(sal)}</td>
      </tr>`;
    }
    tbody.innerHTML = rows;
    document.getElementById('table-note').innerHTML = `Receita líquida = R$ 456 por matrícula (80% de R$ 570, já descontados 20% de royalties). Valores para <strong>1 assessor</strong>.`;
  } else {
    // gerente: equipe de nv assessores, com as matrículas próprias fixas
    theadRow.innerHTML = `<th>Matr./assessor</th><th>Receita líquida</th><th>Assessor</th><th>Gerente</th><th>Total pago</th><th>Saldo escola</th>`;
    let rows = '';
    for(let m=0;m<=30;m++){
      const at = ASSESSOR[m];
      const gt = gerenteTotal(m, nv) + gOwn;
      const r = m*LIQ*nv + gm*LIQ;
      const pago = at*nv + gt;
      const sal = r - pago;
      const cls = (m===mat?'active ':'') + (m>=10&&m<=14?'meta-row':'');
      rows += `<tr class="${cls.trim()}">
        <td>${m}</td>
        <td class="num">${brl(r)}</td>
        <td class="num">${brl(at)}</td>
        <td class="num">${brl(gt)}</td>
        <td class="num">${brl(pago)}</td>
        <td class="num ${sal>=0?'saldo-pos':'saldo-neg'}">${brlSigned(sal)}</td>
      </tr>`;
    }
    tbody.innerHTML = rows;
    document.getElementById('table-note').innerHTML = `Receita líquida = R$ 456 por matrícula (80% de R$ 570, já descontados 20% de royalties). Colunas consideram <strong>${nv} ${nv===1?'assessor':'assessores'}</strong> e <strong>${gm} ${gm===1?'matrícula própria':'matrículas próprias'} do gerente</strong>, fixas ao longo da tabela.`;
  }

  updateChart();
}

function chartSeriesAssessor(){
  const labels = Array.from({length:31}, (_,m)=>m);
  return {
    labels,
    ganho: labels.map(m=>ASSESSOR[m]),
    saldo: labels.map(m=> m*LIQ - ASSESSOR[m])
  };
}

// gerente (withPV=false) e escola (withPV=true) compartilham a mesma série
function chartSeriesEsc(withPV){
  const {nv, gm, gOwnEsc, pvTotal} = escState;
  const pvCost = withPV ? pvTotal : 0;
  const labels = Array.from({length:31}, (_,m)=>m);
  return {
    labels,
    assessor: labels.map(m=>ASSESSOR[m]*nv),
    gerente: labels.map(m=> gerenteTotal(m,nv) + gOwnEsc),
    saldo: labels.map(m=> (m*LIQ*nv + gm*LIQ) - (ASSESSOR[m]*nv + gerenteTotal(m,nv) + gOwnEsc + pvCost))
  };
}

function pvChartSeries(realizadas){
  const labels = Array.from({length:16}, (_,m)=>m);
  return {
    labels,
    total: labels.map(m=>computePV(realizadas,m).total),
    saldo: labels.map(m=> m*MAT_MARGIN - computePV(realizadas,m).total)
  };
}

const CHART_TOOLTIP = {backgroundColor:'#15241E',padding:12,cornerRadius:10,titleFont:{family:'Inter',size:13},bodyFont:{family:'Inter',size:13}};
const CHART_Y = {grid:{color:'rgba(21,36,30,0.07)'},ticks:{font:{family:'Inter',size:11},color:'#8A968F',callback:v=>'R$ '+(v/1000)+'k'}};
function lineDs(label, data, color, dashed){
  return {label,data,borderColor:color,backgroundColor:color,borderWidth:dashed?2:2.5,borderDash:dashed?[5,4]:[],tension:.3,pointRadius:0,pointHoverRadius:5};
}
function makeChart(labels, datasets, xTitle, tipSuffix, sparseTicks){
  const ctx = document.getElementById('chart').getContext('2d');
  chart = new Chart(ctx,{
    type:'line',
    data:{labels,datasets},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:{...CHART_TOOLTIP,
        callbacks:{title:i=>i[0].label+' '+tipSuffix,label:c=>c.dataset.label+': '+brl(c.raw)}}},
      scales:{
        x:{title:{display:true,text:xTitle,font:{family:'Inter',size:12},color:'#8A968F'},
           grid:{display:false},ticks:{font:{family:'Inter',size:11},color:'#8A968F',maxRotation:0,...(sparseTicks?{callback:(v,i)=>i%5===0?i:''}:{})}},
        y:CHART_Y
      }
    }
  });
}

function buildChart(){
  if(view === 'prevendedor'){
    const s = pvChartSeries(+document.getElementById('pv-realizadas').value);
    makeChart(s.labels,[lineDs('Total pago ao pré-vendedor',s.total,'#3B5166'),lineDs('Saldo (margem de material)',s.saldo,'#A23A24',true)],'Matrículas originadas no mês','matrículas originadas',false);
  } else if(view === 'assessor'){
    const s = chartSeriesAssessor();
    makeChart(s.labels,[lineDs('Seu ganho',s.ganho,'#0E5A47'),lineDs('Sobra da matrícula',s.saldo,'#A23A24',true)],'Suas matrículas no mês','matrículas',true);
  } else {
    const s = chartSeriesEsc(view==='socios');
    makeChart(s.labels,[lineDs('Assessores',s.assessor,'#0E5A47'),lineDs('Gerente',s.gerente,'#B67E22'),lineDs('Saldo escola',s.saldo,'#A23A24',true)],'Matrículas no mês (por assessor)','matrículas por assessor',true);
  }
}

function updateChart(){
  if(!chart) return;
  let target, data;
  if(view === 'prevendedor'){
    const s = pvChartSeries(+document.getElementById('pv-realizadas').value);
    data = [s.total, s.saldo];
    target = +document.getElementById('pv-matriculas').value;
  } else if(view === 'assessor'){
    const s = chartSeriesAssessor();
    data = [s.ganho, s.saldo];
    target = +document.getElementById('mat').value;
  } else {
    const s = chartSeriesEsc(view==='socios');
    data = [s.assessor, s.gerente, s.saldo];
    target = +document.getElementById('mat').value;
  }
  data.forEach((d,i)=>{ chart.data.datasets[i].data = d; });
  chart.data.datasets.forEach(ds=>{
    ds.pointRadius = chart.data.labels.map(m=>m===target?5:0);
    ds.pointBackgroundColor = ds.borderColor;
    ds.pointBorderColor = '#fff';
    ds.pointBorderWidth = 2;
  });
  chart.update('none');
}

// view toggle
const tA = document.getElementById('tab-assessor');
const tG = document.getElementById('tab-gerente');
const tP = document.getElementById('tab-prevendedor');
const tS = document.getElementById('tab-socios');
const COPY = {
  assessor:{
    eyebrow:'Remuneração por desempenho',
    title:'Quanto você leva <em>pra casa</em> no fim do mês.',
    lede:'Sua renda tem uma base garantida e cresce a cada matrícula. Mexa no controle e veja exatamente o resultado.'
  },
  gerente:{
    eyebrow:'Liderança comercial',
    title:'Quanto você ganha <em>liderando</em> a equipe.',
    lede:'Base garantida mais uma comissão que sobe de faixa conforme a equipe vende, além das suas matrículas próprias. Ajuste a equipe e a produção para ver seu ganho — e quanto cada assessor leva.'
  },
  prevendedor:{
    eyebrow:'Pré-vendas',
    title:'Quanto rende <em>prospectar e agendar</em> bem.',
    lede:'PJ presencial, com base fixa garantida. Ajuste reuniões realizadas e matrículas originadas pra ver o ganho e o piso de qualidade que libera a comissão de reunião.'
  },
  socios:{
    eyebrow:'Resultado financeiro',
    title:'O modelo que <em>cresce junto</em> com a escola.',
    lede:'A matrícula custeia o time comercial; a mensalidade sustenta a operação. Ajuste a equipe, a produção e quantas matrículas vieram do pré-vendedor para ver o resultado completo — incluindo o desconto de R$ 100 na comissão do gerente nas matrículas próprias que vieram do pré-vendedor.'
  }
};
function setView(v){
  view = v;
  tA.classList.toggle('on',v==='assessor'); tA.setAttribute('aria-selected',v==='assessor');
  tG.classList.toggle('on',v==='gerente');  tG.setAttribute('aria-selected',v==='gerente');
  tP.classList.toggle('on',v==='prevendedor'); tP.setAttribute('aria-selected',v==='prevendedor');
  tS.classList.toggle('on',v==='socios');   tS.setAttribute('aria-selected',v==='socios');

  // assessor: só as próprias matrículas · gerente/sócios: equipe + matrículas próprias do gerente
  document.getElementById('nv-field').style.display = (v==='gerente'||v==='socios') ? 'block' : 'none';
  document.getElementById('gm-field').style.display = (v==='gerente'||v==='socios') ? 'block' : 'none';
  document.getElementById('total-mat-box').style.display = (v==='gerente'||v==='socios') ? 'flex' : 'none';
  document.getElementById('mat-field').style.display = v==='prevendedor' ? 'none' : 'block';
  document.getElementById('pv-realizadas-field').style.display = (v==='prevendedor'||v==='socios') ? 'block' : 'none';
  document.getElementById('pv-matriculas-field').style.display = v==='prevendedor' ? 'block' : 'none';
  document.getElementById('esc-pv-matg-field').style.display = (v==='gerente'||v==='socios') ? 'block' : 'none';
  document.getElementById('esc-pv-mata-field').style.display = v==='socios' ? 'block' : 'none';
  document.getElementById('mat-label').textContent = v==='assessor' ? 'Suas matrículas no mês' : 'Matrículas por assessor';

  document.getElementById('hero-eyebrow').textContent = COPY[v].eyebrow;
  document.getElementById('hero-title').innerHTML = COPY[v].title;
  document.getElementById('hero-lede').textContent = COPY[v].lede;

  document.getElementById('table-lede').textContent = v==='prevendedor'
    ? 'Todos os cenários de 0 a 15 matrículas originadas, com as reuniões realizadas fixas no valor simulado acima. A linha em destaque acompanha o que você simulou.'
    : v==='assessor'
    ? 'Todos os cenários de 0 a 30 matrículas no mês. A linha em destaque acompanha o que você simulou acima.'
    : 'Todos os cenários de 0 a 30 matrículas por assessor. Os valores de receita e saldo consideram a equipe inteira; a linha em destaque acompanha o que você simulou acima.';

  const LEG = {
    prevendedor:[['#3B5166','Total pago ao pré-vendedor'],['#A23A24','Saldo (margem de material)']],
    assessor:[['#0E5A47','Seu ganho'],['#A23A24','Sobra da matrícula']]
  }[v] || [['#0E5A47','Pago aos assessores (equipe)'],['#B67E22','Pago ao gerente (equipe)'],['#A23A24','Saldo da escola (equipe)']];
  document.getElementById('chart-legend').innerHTML = LEG.map(([c,t])=>`<span class="leg"><span class="sw" style="background:${c}"></span>${t}</span>`).join('');

  if(chart){ chart.destroy(); chart = null; }
  buildChart();
  render();
}
tA.addEventListener('click',()=>setView('assessor'));
tG.addEventListener('click',()=>setView('gerente'));
tP.addEventListener('click',()=>setView('prevendedor'));
tS.addEventListener('click',()=>setView('socios'));

document.getElementById('mat').addEventListener('input',render);
document.getElementById('nv').addEventListener('input',render);
document.getElementById('gm').addEventListener('input',render);
document.getElementById('pv-realizadas').addEventListener('input',render);
document.getElementById('pv-matriculas').addEventListener('input',render);
document.getElementById('esc-pv-matg').addEventListener('input',render);
document.getElementById('esc-pv-mata').addEventListener('input',render);
