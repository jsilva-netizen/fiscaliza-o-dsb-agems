import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Busca IDs em lotes sequenciais com delay para evitar rate limit
async function fetchInBatches(ids, fetchFn, batchSize = 3, delayMs = 300) {
    const results = [];
    for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(fetchFn));
        results.push(...batchResults.flat());
        if (i + batchSize < ids.length) await sleep(delayMs);
    }
    return results;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const fiscalizacoes = await base44.entities.Fiscalizacao.filter({ status: 'finalizada' });

        if (fiscalizacoes.length === 0) {
            return Response.json({ pacote: null, aviso: 'Nenhuma fiscalização finalizada encontrada.' });
        }

        const fiscIds = fiscalizacoes.map(f => f.id);

        // Buscar unidades em lotes
        const todasUnidades = await fetchInBatches(fiscIds, id =>
            base44.entities.UnidadeFiscalizada.filter({ fiscalizacao_id: id })
        );

        const unidadeIds = todasUnidades.map(u => u.id);

        // Buscar dados por tipo, um tipo por vez, em lotes internos
        await sleep(200);
        const todasRespostas = await fetchInBatches(unidadeIds, id =>
            base44.entities.RespostaChecklist.filter({ unidade_fiscalizada_id: id })
        );

        await sleep(200);
        const todasNCs = await fetchInBatches(unidadeIds, id =>
            base44.entities.NaoConformidade.filter({ unidade_fiscalizada_id: id })
        );

        await sleep(200);
        const todasDets = await fetchInBatches(unidadeIds, id =>
            base44.entities.Determinacao.filter({ unidade_fiscalizada_id: id })
        );

        await sleep(200);
        const todasRecs = await fetchInBatches(unidadeIds, id =>
            base44.entities.Recomendacao.filter({ unidade_fiscalizada_id: id })
        );

        await sleep(200);
        const todasConsts = await fetchInBatches(unidadeIds, id =>
            base44.entities.ConstatacaoManual.filter({ unidade_fiscalizada_id: id })
        );

        await sleep(200);
        const todosTermos = await fetchInBatches(fiscIds, id =>
            base44.entities.TermoNotificacao.filter({ fiscalizacao_id: id })
        );

        const pacote = {
            versao: '1.0',
            exportado_em: new Date().toISOString(),
            total_fiscalizacoes: fiscalizacoes.length,
            fiscalizacoes,
            unidades: todasUnidades,
            respostas_checklist: todasRespostas,
            nao_conformidades: todasNCs,
            determinacoes: todasDets,
            recomendacoes: todasRecs,
            constatacoes_manuais: todasConsts,
            termos_notificacao: todosTermos,
            fotos_urls: [],
        };

        // Coletar URLs de fotos
        const fotosSet = new Set();
        for (const unidade of pacote.unidades) {
            if (Array.isArray(unidade.fotos_unidade)) {
                unidade.fotos_unidade.forEach(f => f?.url && fotosSet.add(f.url));
            }
        }
        for (const nc of pacote.nao_conformidades) {
            if (Array.isArray(nc.fotos)) {
                nc.fotos.forEach(url => url && fotosSet.add(url));
            }
        }
        for (const termo of pacote.termos_notificacao) {
            if (termo.arquivo_url) fotosSet.add(termo.arquivo_url);
            if (termo.arquivo_protocolo_url) fotosSet.add(termo.arquivo_protocolo_url);
            if (Array.isArray(termo.arquivos_resposta)) {
                termo.arquivos_resposta.forEach(a => a?.url && fotosSet.add(a.url));
            }
        }
        pacote.fotos_urls = Array.from(fotosSet);

        return Response.json({ pacote });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});