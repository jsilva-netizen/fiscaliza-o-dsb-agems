# ANÁLISE PROFUNDA: FLUXO COMPLETO DE VISTORIA
## Resposta → Numeração → NC/D → Relatório com rastreamento de dados

---

## 🎯 OVERVIEW VISUAL DO FLUXO

```
┌─────────────────────────────────────────────────────────────────────────┐
│ USUÁRIO CLICA EM SIM/NAO/NA NO CHECKLIST (ChecklistItem)                │
└────────────────────────────┬────────────────────────────────────────────┘
                             ↓
        ┌────────────────────────────────────────┐
        │ handleResponder(itemId, data)           │ ← ChecklistItem.jsx:429
        │ - resposta: "SIM"/"NAO"/"NA"            │
        │ - observacao: string (optional)         │
        └────────────────────┬───────────────────┘
                             ↓
    ┌──────────────────────────────────────────────────────┐
    │ salvarRespostaMutation.mutate({itemId, data})        │
    │ (VistoriarUnidade.jsx:231-348)                       │
    └──────────────────────┬───────────────────────────────┘
                           ↓
    ┌────────────────────────────────────────────────────────┐
    │ executarRespostaAtomicamente()                         │
    │ (respostaTransacao.js)                                 │
    │                                                        │
    │ ETAPA 1: Gerar CONSTATAÇÃO (C)                        │
    │  └─ Buscar todas respostas da unidade                 │
    │  └─ Extrair números_constatacao existentes             │
    │  └─ Calcular: C{max+1}                                │
    │                                                        │
    │ ETAPA 2: Salvar RESPOSTA                              │
    │  └─ Criar ou atualizar RespostaChecklist              │
    │  └─ Vincular numero_constatacao                        │
    │                                                        │
    │ ETAPA 3: Decidir sobre NC                             │
    │  └─ Condição: resposta=NAO && item.gera_nc=true       │
    │  └─ Se sim: executar ETAPA 4                          │
    │  └─ Se não (mudou NAO→SIM): deletar NC/D              │
    │                                                        │
    │ ETAPA 4: Criar NC + D em cascata                      │
    │  └─ Gerar NC{max+1} sequencial                        │
    │  └─ Criar NaoConformidade (referencia C no texto)     │
    │  └─ Se item.texto_determinacao:                       │
    │     └─ Gerar D{max+1} sequencial                      │
    │     └─ Criar Determinacao (FK para NC)                │
    └────────────────────┬─────────────────────────────────┘
                         ↓
    ┌──────────────────────────────────────────────────┐
    │ invalidateQueries(['respostas', 'ncs', 'dets']) │
    │ ↓ UI atualiza automaticamente                   │
    │ (React Query refetch)                          │
    └──────────────────────────────────────────────────┘
                         ↓
        ┌───────────────────────────────────┐
        │ NC/D TAB mostra conteúdo atualizado│
        │ RelatorioUnidade já tem dados      │
        └───────────────────────────────────┘
```

---

## 📊 ESTRUTURA DE DADOS EM CADA ETAPA

### ETAPA 1: CLIQUE DO USUÁRIO
**Origem**: ChecklistItem.jsx - `handleResposta(valor)`

```javascript
// Input (usuário clica botão)
{
    resposta: "SIM" | "NAO" | "NA",
    observacao: "texto opcional"
}

// ChecklistItem passa para VistoriarUnidade via:
handleResponder(itemId, {resposta, observacao})
```

---

### ETAPA 2: PREPARAÇÃO EM VistoriarUnidade

**Local**: VistoriarUnidade.jsx:429-432

```javascript
const handleResponder = (itemId, data) => {
    setRespostas(prev => ({ ...prev, [itemId]: data }));
    // ↓ OTIMISTA: atualiza estado local ANTES de salvar
    // (UI responde imediatamente)
    
    salvarRespostaMutation.mutate({ itemId, data });
};
```

**Queries Disponíveis** (React Query cache):
- `respostasExistentes` ← RespostaChecklist.filter({ unidade_fiscalizada_id })
- `ncsExistentes` ← NaoConformidade.filter({ unidade_fiscalizada_id })
- `determinacoesExistentes` ← Determinacao.filter({ unidade_fiscalizada_id })
- `itensChecklist` ← ItemChecklist.filter({ tipo_unidade_id })

---

### ETAPA 3: EXECUÇÃO ATÔMICA (respostaTransacao.js)

#### 3.1 Buscar ItemChecklist
```javascript
const item = itensChecklist.find(i => i.id === itemId);
// Possui: { gera_nc, texto_nc, texto_determinacao, artigo_portaria, ... }
```

#### 3.2 Gerar CONSTATAÇÃO (C)
```javascript
// CRÍTICO: Recarrega do BANCO (não usa cache)
const todasRespostas = await base44.entities.RespostaChecklist.filter(
    { unidade_fiscalizada_id },
    '-created_date',  // ← Mais recentes primeiro
    500
);

// Extrair números existentes
const numeros = todasRespostas
    .filter(r => r.numero_constatacao)  // Ignora null
    .map(r => parseInt(r.numero_constatacao.replace('C', '')))
    .filter(n => !isNaN(n) && n > 0);   // Valida

// Calcular próximo
const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
const numeroConstatacao = `C${proximo}`;

// Exemplo:
// Existem: [C1, C2, C3, null] → numeros=[1,2,3] → proximo=4 → C4 ✓
// Existem: [] → numeros=[] → proximo=1 → C1 ✓
```

⚠️ **CRÍTICO**: Se dois usuários fazem isso simultaneamente:
- Usuário A lê banco: max=3
- Usuário B lê banco: max=3 (antes de A salvar)
- A salva C4, B salva C4 (COLISÃO!)
- **Solução**: Timestamps + validação no backend

#### 3.3 Criar RESPOSTA
```javascript
const payloadResposta = {
    unidade_fiscalizada_id: "xxx",
    item_checklist_id: itemId,
    pergunta: data.pergunta || item.pergunta,
    numero_constatacao: numeroConstatacao,  // ← C4 (ou null se NA)
    resposta: "SIM" | "NAO" | "NA",
    observacao: data.observacao || null,
    gera_nc: item.gera_nc || false
};

if (respostaExistente) {
    // UPDATE
    await base44.entities.RespostaChecklist.update(
        respostaExistente.id,
        payloadResposta
    );
    respostaId = respostaExistente.id;
} else {
    // CREATE
    const respostaCriada = await base44.entities.RespostaChecklist.create(
        payloadResposta
    );
    respostaId = respostaCriada.id;
}

// Resultado no banco:
// RespostaChecklist {
//   id: "resp_123",
//   unidade_fiscalizada_id: "unidade_456",
//   item_checklist_id: "item_789",
//   resposta: "NAO",
//   numero_constatacao: "C4",
//   pergunta: "Existem extravasamentos? Observação: Vazamento na válvula",
//   observacao: "Vazamento na válvula",
//   gera_nc: true,
//   created_date: "2026-01-20T14:32:00Z"
// }
```

#### 3.4 Decidir Sobre NC

```javascript
// Recarregar NCs e Determinações (estado mais recente)
const ncsAtualizadas = await base44.entities.NaoConformidade.filter({...});
const determinacoesAtualizadas = await base44.entities.Determinacao.filter({...});

// Buscar NC vinculada a esta resposta
const ncVinculada = ncsAtualizadas.find(nc => nc.resposta_checklist_id === respostaId);

// Verificar se DEVE existir NC
const deveExistirNC = (data.resposta === 'NAO' && item.gera_nc === true);

if (deveExistirNC && !ncVinculada) {
    // CASO A: Criar NC + Determinação
    // ...
} else if (!deveExistirNC && ncVinculada) {
    // CASO B: Deletar NC + Determinação
    // ...
} else {
    // CASO C: Sem mudança
}
```

#### 3.5 CASO A: Criar NC + D

```javascript
// 3.5.1 Gerar NÚMERO NC
const numerosNC = ncsAtualizadas
    .map(n => parseInt(n.numero_nc?.replace('NC', '') || '0'))
    .filter(n => !isNaN(n) && n > 0);
const proximoNumNC = numerosNC.length > 0 ? Math.max(...numerosNC) + 1 : 1;
const numeroNC = `NC${proximoNumNC}`;

// 3.5.2 Construir texto NC
const textoNC = item.texto_nc 
    ? `A Constatação ${numeroConstatacao} não cumpre o disposto no ${item.artigo_portaria || 'regulamento aplicável'}. ${item.texto_nc}`
    : `A Constatação ${numeroConstatacao} não cumpre o disposto no ${item.artigo_portaria || 'regulamento aplicável'}.`;

// Exemplo: "A Constatação C4 não cumpre o disposto no Art. 15, §2º. Falta limpeza mensal."

// 3.5.3 CRIAR NC no banco
const ncCriada = await base44.entities.NaoConformidade.create({
    unidade_fiscalizada_id: "unidade_456",
    resposta_checklist_id: "resp_123",  // ← FK para RespostaChecklist
    numero_nc: "NC1",
    artigo_portaria: "Art. 15, §2º",
    descricao: textoNC,  // ← SEMPRE com "A Constatação C4..."
    fotos: [],
    timestamp: "2026-01-20T14:32:05Z"
});
// Resultado: NaoConformidade { id: "nc_001", ... }

// 3.5.4 Gerar NÚMERO DETERMINAÇÃO
const numerosDet = determinacoesAtualizadas
    .map(d => parseInt(d.numero_determinacao?.replace('D', '') || '0'))
    .filter(n => !isNaN(n) && n > 0);
const proximoNumDet = numerosDet.length > 0 ? Math.max(...numerosDet) + 1 : 1;
const numeroDet = `D${proximoNumDet}`;

// 3.5.5 Construir texto DETERMINAÇÃO
const textoDet = `Para sanar ${numeroNC}, ${item.texto_determinacao.charAt(0).toLowerCase()}${item.texto_determinacao.slice(1)}`;
// Exemplo: item.texto_determinacao = "Realizar limpeza mensal"
// Resultado: "Para sanar NC1, realizar limpeza mensal"

// 3.5.6 CRIAR DETERMINAÇÃO no banco
await base44.entities.Determinacao.create({
    unidade_fiscalizada_id: "unidade_456",
    nao_conformidade_id: "nc_001",  // ← FK para NaoConformidade
    numero_determinacao: "D1",
    descricao: textoDet,
    prazo_dias: 30,
    status: "pendente",
    data_limite: "2026-02-19",  // calculated: hoje + 30
    timestamp: "2026-01-20T14:32:06Z"
});
```

#### 3.6 CASO B: Deletar NC + D (reversão)

```javascript
// Se usuário mudou: NAO → SIM (não gera mais NC)
const detsVinculadas = determinacoesAtualizadas.filter(
    d => d.nao_conformidade_id === ncVinculada.id
);

// ORDEM CRÍTICA: Deletar filhos ANTES do pai (integridade referencial)
for (const det of detsVinculadas) {
    await base44.entities.Determinacao.delete(det.id);  // ← PRIMEIRO
}
await base44.entities.NaoConformidade.delete(ncVinculada.id);  // ← DEPOIS
```

---

## 💾 DADOS ARMAZENADOS NO BANCO

### Tabela: RespostaChecklist
```
id              | unidade_id | item_id | resposta | numero_constatacao | observacao
resp_1          | unidade_1  | item_1  | SIM     | C1                 | null
resp_2          | unidade_1  | item_2  | NAO     | C2                 | "Vazamento"
resp_3          | unidade_1  | item_3  | NA      | null               | null
resp_4          | unidade_1  | item_4  | SIM     | C3                 | null
```

### Tabela: NaoConformidade
```
id    | unidade_id | resposta_id | numero_nc | descricao
nc_1  | unidade_1  | resp_2      | NC1       | "A Constatação C2 não cumpre..."
```

### Tabela: Determinacao
```
id   | unidade_id | nc_id | numero_det | descricao
d_1  | unidade_1  | nc_1  | D1         | "Para sanar NC1, ..."
```

---

## 📄 DADOS USADOS NO RELATÓRIO (RelatorioUnidade.jsx)

### Input do RelatorioUnidade:
```javascript
{
    unidade: { tipo_unidade_nome, codigo_unidade, nome_unidade, endereco, ... },
    fiscalizacao: { municipio_nome, ... },
    respostas: [RespostaChecklist[]],      // ← Sorted by numero_constatacao
    ncs: [NaoConformidade[]],               // ← Sorted by numero_nc
    determinacoes: [Determinacao[]],        // ← Sorted by numero_determinacao
    recomendacoes: [Recomendacao[]],        // ← Sorted by numero_recomendacao
    fotos: [{ url, legenda, ... }],         // ← Fotos da unidade
    offsetFiguras: 12                       // ← Número da primeira figura
}
```

### Processamento no PDF:

#### 1️⃣ CONSTATAÇÕES
```javascript
// Filtrar respostas que tem constatação
const constatacoes = respostas.filter(r => r.resposta === 'SIM' || r.resposta === 'NAO');

constatacoes.forEach((resp) => {
    // resp.numero_constatacao = "C1", "C2", etc
    // resp.pergunta = "Texto da constatação"
    // resp.observacao = "Observação adicional"
    
    // Renderiza no PDF: "C1. Texto da constatação..."
});
```

#### 2️⃣ NÃO CONFORMIDADES
```javascript
ncs.forEach((nc) => {
    // nc.numero_nc = "NC1", "NC2", etc
    // nc.descricao = "A Constatação C1 não cumpre..."
    // nc.artigo_portaria = "Art. 5º"
    
    // BUSCA resposta relacionada para validação
    const respostaRelacionada = respostas.find(r => r.id === nc.resposta_checklist_id);
    const numeroConstatacao = respostaRelacionada?.numero_constatacao;
    
    // Se falta "Constatação" no texto, corrige dinamicamente
    let textoNC = nc.descricao;
    if (numeroConstatacao && !textoNC.toLowerCase().includes('constatação')) {
        textoNC = `A Constatação ${numeroConstatacao} não cumpre...`;
    }
    
    // Renderiza no PDF: "NC1. A Constatação C1 não cumpre..."
});
```

#### 3️⃣ DETERMINAÇÕES (vinculadas a NC)
```javascript
determinacoes.forEach((det) => {
    // det.numero_determinacao = "D1", "D2", etc
    // det.descricao = "Para sanar NC1, ..."
    // det.prazo_dias = 30
    
    // Renderiza no PDF: "D1. Para sanar NC1, ... Prazo: 30 dias"
});
```

#### 4️⃣ FOTOS (com numeração em cascata)
```javascript
fotos.forEach((foto, i) => {
    // foto.url = URL da imagem
    // foto.legenda = "Descrição"
    
    // offsetFiguras = quantidade de fotos das unidades anteriores
    // Exemplo: ETA-001 tem 4 fotos, ETA-002 começa em Figura 5
    const numFigura = offsetFiguras + i + 1;  // C1, C2, C3, ..., C4
    
    // Renderiza: "Figura 5 - Descrição da foto"
});
```

---

## 🔄 FLUXO OFFLINE (IndexedDB)

### Quando OFFLINE:
```javascript
if (!navigator.onLine) {
    // Salva em pending_operations em vez de salvar no banco
    await addPendingOperation({
        operation: 'create',
        entity: 'RespostaChecklist',
        data: payloadResposta,
        priority: 2,
        timestamp: "2026-01-20T14:32:00Z"
    });
    return;  // ← Não executa fluxo C/NC/D
}
```

### Quando SINCRONIZA:
```javascript
// handleSync() em SyncManager executa:
for (const op of pendingOperations) {
    if (op.entity === 'RespostaChecklist' && op.operation === 'create') {
        // Problema: NC/D não foram criadas!
        // Solução: Re-executar fluxo completo ao sincronizar
        const resposta = await base44.entities.RespostaChecklist.create(op.data);
        
        // Verificar se precisa criar NC/D
        if (resposta.resposta === 'NAO' && op.data.gera_nc) {
            // Criar NC + D com numeração recalculada
        }
    }
}
```

---

## ⚡ OTIMIZAÇÕES CRÍTICAS

### 1. Cache de ItemChecklist
```javascript
// Recarrega cada 24h (não muda frequentemente)
const { data: itensChecklist = [] } = useOfflineCache(
    `checklist_${unidade?.tipo_unidade_id}`,
    () => base44.entities.ItemChecklist.filter({ ... }),
    1440  // 24 hours
);
```

### 2. Recarregar Antes de Calcular
```javascript
// Em vez de usar cache, recarrega cada vez:
const todasRespostas = await base44.entities.RespostaChecklist.filter({...});

// Garante: sem race condition, sem colisão de números
```

### 3. Invalidação Seletiva
```javascript
queryClient.invalidateQueries({ queryKey: ['respostas', unidadeId] });
queryClient.invalidateQueries({ queryKey: ['ncs', unidadeId] });
queryClient.invalidateQueries({ queryKey: ['determinacoes', unidadeId] });

// React Query recarrega automaticamente → UI atualiza
```

---

## 🧪 CASOS DE TESTE

| Caso | Input | Esperado | Status |
|------|-------|----------|--------|
| T1 | Responder 5 itens (SIM,NAO,NA,SIM,NAO) | C1,C2,null,C3,C4 criadas | ✓ |
| T2 | Responder + muda NAO→SIM | NC/D deletadas | ✓ |
| T3 | 2 cliques paralelos (C4) | Sem colisão | ⚠️ Precisa validação backend |
| T4 | Offline + responder + sincronizar | NC/D criadas com números corretos | ⚠️ Revê handleSync |
| T5 | Finalizar vistoria | total_constatacoes e total_ncs corretos | ✓ |
| T6 | PDF com 3 unidades | Fotos numeradas 1-3, 4-7, 8-10 | ✓ |
| T7 | NC sem referência C | Corrigida dinamicamente no PDF | ✓ |