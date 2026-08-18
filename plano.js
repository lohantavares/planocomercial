const LIQ = 456;
const ASSESSOR = [
  1500,1500,1500,1500,1500,1500,
  2100,2200,2300,2400,
  3000,3150,3300,3450,3600,
  4200,4380,4560,4740,4920,
  5500,5700,5900,6100,6300,6500,6700,6900,7100,7300,7500
];
const A_FIX = 1500;

// Margem de material por matrícula — base do saldo do pré-vendedor.
// A taxa de matrícula (R$456) já é repasse integral pra comissão do assessor,
// não sobra caixa dela; mensalidade demora 11 meses pra realizar. Por isso o
// saldo do pré-vendedor usa só a margem de material, mais conservador.
const MAT_MARGIN = 450;
const PV_PISO = 42;

// Pré-vendedor: só o modelo presencial PJ (fixo garantido) — o remoto sem fixo
// foi descartado, a segurança de renda importa mais pra reter a contratação.
function computePV(realizadas, matriculas){
  const fixo = 1500;
  const taxaReuniao = 15;
  const pisoOk = realizadas >= PV_PISO;
  const reuniaoComm = pisoOk ? realizadas * taxaReuniao : 0;
  const matComm = matriculas * 100;
  const total = fixo + reuniaoComm + matComm;
  return {fixo, reuniaoComm, matComm, total, pisoOk};
}

const G_RATE = 150;
function gerenteTotal(matPerAssessor, nv){ return matPerAssessor*nv*G_RATE; }

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
  const gOverride = gerenteTotal(mat, nv);       // R$150 por matrícula da equipe
  const gOwn = gm * LIQ;                          // R$456 por matrícula própria
  const gTotal = gOverride + gOwn;               // ganho total do gerente
  const recEq = mat * LIQ * nv;
  const pagoEq = aTotal*nv + gOverride;          // saldo da escola não inclui o repasse das matrículas próprias (pass-through)
  const saldoEq = recEq - pagoEq;
  const f = faixa(mat);
  const pv = computePV(pvRealizadas, pvMatriculas);
  const pvSaldo = pvMatriculas*MAT_MARGIN - pv.total;

  // Escola: atribuição de matrículas ao pré-vendedor (gerente e equipe de assessores)
  const GM_DESCONTO_PV = 100;
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

  const pvMatTotalEsc = pvMatG + pvMatA;
  const pvEsc = computePV(pvRealizadas, pvMatTotalEsc);
  // O fixo do pré-vendedor sai da escola (margem de material/mensalidade), não da
  // comissão de matrícula — por isso só o variável (reunião + matrícula) entra no
  // saldo abaixo, que mede especificamente se a matrícula autofinancia a estrutura.
  const pvVariavelEsc = pvEsc.reuniaoComm + pvEsc.matComm;
  const gOwnEsc = (gm - pvMatG)*LIQ + pvMatG*(LIQ - GM_DESCONTO_PV);
  const gTotalEsc = gOverride + gOwnEsc;
  const recTotalEsc = mat*LIQ*nv + gm*LIQ;
  const pagoTotalEsc = aTotal*nv + gTotalEsc + pvVariavelEsc;
  const saldoEsc = recTotalEsc - pagoTotalEsc;
  const marginEsc = recTotalEsc>0 ? Math.round(saldoEsc/recTotalEsc*100) : 0;
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
      ? `<div class="pline"><span class="k"><span class="dot" style="background:var(--emerald)"></span>Suas matrículas (${gm} × R$ 456)</span><span class="v num">${brl(gOwn)}</span></div>`
      : '';
    document.getElementById('res-body').innerHTML = `
      <div class="big-label">Seu ganho no mês como gerente</div>
      <div class="big-num pos num">${brl(gTotal)}</div>
      <div class="big-sub">equipe de ${totalMat} ${totalMat===1?'matrícula':'matrículas'} × R$ 150${gm>0?` + ${gm} ${gm===1?'matrícula própria':'matrículas próprias'} × R$ 456`:''}</div>
      <div class="lines">
        <div class="pline"><span class="k"><span class="dot" style="background:var(--gold)"></span>Override da equipe (${totalMat} × R$ 150)</span><span class="v num">${brl(gOverride)}</span></div>
        ${ownLine}
        <div class="pline total"><span class="k">Você recebe (gerente)</span><span class="v num">${brl(gTotal)}</span></div>
      </div>
      ${nv>0 ? `<div style="margin-top:18px;padding-top:16px;border-top:0.5px solid var(--line);font-size:13.5px;color:var(--muted);">
        Cada um dos seus ${nv} ${nv===1?'assessor leva':'assessores leva'} <strong style="color:var(--ink)">${brl(aTotal)}</strong> fazendo ${mat} ${mat===1?'matrícula':'matrículas'}.
      </div>` : `<div style="margin-top:18px;padding-top:16px;border-top:0.5px solid var(--line);font-size:13.5px;color:var(--muted);">
        Sem assessores na equipe, seu ganho vem só das matrículas que você fechar.
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
      ? `<div style="margin-top:16px;padding-top:14px;border-top:0.5px solid var(--line);font-size:13px;color:var(--faint);">${pvMatG} ${pvMatG===1?'matrícula própria do gerente veio':'matrículas próprias do gerente vieram'} de entrevista agendada pelo pré-vendedor — comissão dessas reduzida em R$ ${GM_DESCONTO_PV}: R$ ${LIQ-GM_DESCONTO_PV} em vez de R$ ${LIQ}.</div>`
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
    document.getElementById('table-note').innerHTML = `Receita bruta = R$ 456 por matrícula (80% de R$ 570, já descontados 20% de royalties). Colunas consideram <strong>${nv} ${nv===1?'assessor':'assessores'}</strong>, <strong>${gm} ${gm===1?'matrícula própria':'matrículas próprias'} do gerente</strong> (${pvMatG} ${pvMatG===1?'delas vinda':'delas vindas'} do pré-vendedor, a R$ ${LIQ-GM_DESCONTO_PV}) e <strong>${pvMatTotalEsc} ${pvMatTotalEsc===1?'matrícula originada':'matrículas originadas'}</strong> pelo pré-vendedor no total, fixos ao longo da tabela. A coluna Pré-vendedor mostra só o variável${pvEsc.fixo>0?` — o fixo de ${brl(pvEsc.fixo)} sai da escola separadamente, não da matrícula`:''}.`;
  } else {
    // assessor view uses nv=1 (individual); gerente usa a equipe
    const tNv = view==='assessor' ? 1 : nv;
    let rows = '';
    for(let m=0;m<=30;m++){
      const at = ASSESSOR[m];
      const gt = gerenteTotal(m, tNv);
      const r = m*LIQ*tNv;
      const pago = at*tNv + gt;
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
    theadRow.innerHTML = `<th>Matr.</th><th>Receita líquida</th><th>Assessor</th><th>Gerente</th><th>Total pago</th><th>Saldo escola</th>`;

    document.getElementById('table-note').innerHTML = view==='assessor'
      ? `Receita líquida = R$ 456 por matrícula (80% de R$ 570, já descontados 20% de royalties). Valores para <strong>1 assessor</strong>.`
      : `Receita líquida = R$ 456 por matrícula (80% de R$ 570, já descontados 20% de royalties). Colunas consideram <strong>${nv} ${nv===1?'assessor':'assessores'}</strong>.`;
  }

  updateChart();
}

function chartSeries(nv){
  const labels = Array.from({length:31}, (_,m)=>m);
  return {
    labels,
    assessor: labels.map(m=>ASSESSOR[m]*nv),
    gerente: labels.map(m=>gerenteTotal(m,nv)),
    saldo: labels.map(m=> m*LIQ*nv - ASSESSOR[m]*nv - gerenteTotal(m,nv))
  };
}

function chartSeriesEsc(){
  const {nv, gm, gOwnEsc, pvTotal} = escState;
  const labels = Array.from({length:31}, (_,m)=>m);
  return {
    labels,
    assessor: labels.map(m=>ASSESSOR[m]*nv),
    gerente: labels.map(m=> gerenteTotal(m,nv) + gOwnEsc),
    saldo: labels.map(m=> (m*LIQ*nv + gm*LIQ) - (ASSESSOR[m]*nv + gerenteTotal(m,nv) + gOwnEsc + pvTotal))
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

function buildChart(){
  const ctx = document.getElementById('chart').getContext('2d');

  if(view === 'prevendedor'){
    const pvRealizadas = +document.getElementById('pv-realizadas').value;
    const s = pvChartSeries(pvRealizadas);
    chart = new Chart(ctx,{
      type:'line',
      data:{labels:s.labels,datasets:[
        {label:'Total pago ao pré-vendedor',data:s.total,borderColor:'#3B5166',backgroundColor:'#3B5166',borderWidth:2.5,tension:.3,pointRadius:0,pointHoverRadius:5},
        {label:'Saldo (margem de material)',data:s.saldo,borderColor:'#A23A24',backgroundColor:'#A23A24',borderWidth:2,borderDash:[5,4],tension:.3,pointRadius:0,pointHoverRadius:5}
      ]},
      options:{
        responsive:true,maintainAspectRatio:false,
        interaction:{mode:'index',intersect:false},
        plugins:{legend:{display:false},tooltip:{
          backgroundColor:'#15241E',padding:12,cornerRadius:10,titleFont:{family:'Inter',size:13},bodyFont:{family:'Inter',size:13},
          callbacks:{title:i=>i[0].label+' matrículas originadas',label:c=>c.dataset.label+': '+brl(c.raw)}
        }},
        scales:{
          x:{title:{display:true,text:'Matrículas originadas no mês',font:{family:'Inter',size:12},color:'#8A968F'},
             grid:{display:false},ticks:{font:{family:'Inter',size:11},color:'#8A968F',maxRotation:0}},
          y:{grid:{color:'rgba(21,36,30,0.07)'},ticks:{font:{family:'Inter',size:11},color:'#8A968F',callback:v=>'R$ '+(v/1000)+'k'}}
        }
      }
    });
    return;
  }

  const tNv = view==='assessor' ? 1 : +document.getElementById('nv').value;
  const s = view==='socios' ? chartSeriesEsc() : chartSeries(tNv);
  chart = new Chart(ctx,{
    type:'line',
    data:{labels:s.labels,datasets:[
      {label:'Assessores',data:s.assessor,borderColor:'#0E5A47',backgroundColor:'#0E5A47',borderWidth:2.5,tension:.3,pointRadius:0,pointHoverRadius:5},
      {label:'Gerente',data:s.gerente,borderColor:'#B67E22',backgroundColor:'#B67E22',borderWidth:2.5,tension:.3,pointRadius:0,pointHoverRadius:5},
      {label:'Saldo escola',data:s.saldo,borderColor:'#A23A24',backgroundColor:'#A23A24',borderWidth:2,borderDash:[5,4],tension:.3,pointRadius:0,pointHoverRadius:5}
    ]},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:{
        backgroundColor:'#15241E',padding:12,cornerRadius:10,titleFont:{family:'Inter',size:13},bodyFont:{family:'Inter',size:13},
        callbacks:{title:i=>i[0].label+' matrículas por assessor',label:c=>c.dataset.label+': '+brl(c.raw)}
      }},
      scales:{
        x:{title:{display:true,text:'Matrículas no mês (por assessor)',font:{family:'Inter',size:12},color:'#8A968F'},
           grid:{display:false},ticks:{font:{family:'Inter',size:11},color:'#8A968F',maxRotation:0,callback:(v,i)=>i%5===0?i:''}},
        y:{grid:{color:'rgba(21,36,30,0.07)'},ticks:{font:{family:'Inter',size:11},color:'#8A968F',callback:v=>'R$ '+(v/1000)+'k'}}
      }
    }
  });
}

function updateChart(){
  if(!chart) return;

  if(view === 'prevendedor'){
    const pvRealizadas = +document.getElementById('pv-realizadas').value;
    const pvMatriculas = +document.getElementById('pv-matriculas').value;
    const s = pvChartSeries(pvRealizadas);
    chart.data.datasets[0].data = s.total;
    chart.data.datasets[1].data = s.saldo;
    chart.data.datasets.forEach(ds=>{
      ds.pointRadius = chart.data.labels.map(m=>m===pvMatriculas?5:0);
      ds.pointBackgroundColor = ds.borderColor;
      ds.pointBorderColor = '#fff';
      ds.pointBorderWidth = 2;
    });
    chart.update('none');
    return;
  }

  const mat = +document.getElementById('mat').value;
  const tNv = view==='assessor' ? 1 : +document.getElementById('nv').value;
  const s = view==='socios' ? chartSeriesEsc() : chartSeries(tNv);
  chart.data.datasets[0].data = s.assessor;
  chart.data.datasets[1].data = s.gerente;
  chart.data.datasets[2].data = s.saldo;
  chart.data.datasets.forEach(ds=>{
    ds.pointRadius = chart.data.labels.map(m=>m===mat?5:0);
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
    lede:'Você recebe R$ 150 por matrícula de toda a equipe. Ajuste quantas matrículas cada assessor faz e o tamanho do time para ver seu ganho — e quanto cada assessor leva.'
  },
  prevendedor:{
    eyebrow:'Pré-vendas',
    title:'Quanto rende <em>prospectar e agendar</em> bem.',
    lede:'PJ presencial, com base fixa garantida. Ajuste reuniões realizadas e matrículas originadas pra ver o ganho e o piso de qualidade que libera a comissão de reunião.'
  },
  socios:{
    eyebrow:'Resultado financeiro',
    title:'O modelo que <em>cresce junto</em> com a escola.',
    lede:'A matrícula custeia o time comercial; a mensalidade sustenta a operação. Ajuste a equipe, a produção e quantas matrículas vieram do pré-vendedor para ver o resultado completo — incluindo o desconto de R$ 100 na comissão do gerente nas matrículas próprias que ele originou.'
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
  document.getElementById('esc-pv-matg-field').style.display = v==='socios' ? 'block' : 'none';
  document.getElementById('esc-pv-mata-field').style.display = v==='socios' ? 'block' : 'none';
  document.getElementById('mat-label').textContent = v==='assessor' ? 'Suas matrículas no mês' : 'Matrículas por assessor';

  document.getElementById('hero-eyebrow').textContent = COPY[v].eyebrow;
  document.getElementById('hero-title').innerHTML = COPY[v].title;
  document.getElementById('hero-lede').textContent = COPY[v].lede;

  document.getElementById('table-lede').textContent = v==='prevendedor'
    ? 'Todos os cenários de 0 a 15 matrículas originadas, com as reuniões realizadas fixas no valor simulado acima. A linha em destaque acompanha o que você simulou.'
    : 'Todos os cenários de 0 a 30 matrículas. Os valores de receita e saldo consideram a equipe inteira; a linha em destaque acompanha o que você simulou acima.';

  document.getElementById('chart-legend').innerHTML = v==='prevendedor'
    ? `<span class="leg"><span class="sw" style="background:#3B5166"></span>Total pago ao pré-vendedor</span>
       <span class="leg"><span class="sw" style="background:#A23A24"></span>Saldo (margem de material)</span>`
    : `<span class="leg"><span class="sw" style="background:#0E5A47"></span>Pago aos assessores (equipe)</span>
       <span class="leg"><span class="sw" style="background:#B67E22"></span>Pago ao gerente (equipe)</span>
       <span class="leg"><span class="sw" style="background:#A23A24"></span>Saldo da escola (equipe)</span>`;

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
