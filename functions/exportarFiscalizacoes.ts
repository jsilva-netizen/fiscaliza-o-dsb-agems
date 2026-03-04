import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Usar asServiceRole para buscar TUDO de uma vez sem rate limit por ID
        const sr = base44.asServiceRole;

        const fiscalizacoes = await sr.entities.Fiscalizacao.filter({ status: 'finalizada' }, null, 500);
        if (fiscalizacoes.length === 0) {
            return Response.json({ pacote: null, aviso: 'Nenhuma fiscalização finalizada encontrada.' });
        }

        const fiscIds = new Set(fiscalizacoes.map(f => f.id));

        // Buscar TODAS as entidades de uma vez (sem filtro por ID) e filtrar em memória
        await sleep(100);
        const todasUnidades = (await sr.entities.UnidadeFiscalizada.list(null, 1000))
            .filter(u => fiscIds.has(u.fiscalizacao_id));

        const unidadeIds = new Set(todasUnidades.map(u => u.id));

        await sleep(100);
        const [todasRespostas, todasNCs, todasDets, todasRecs, todasConsts, todosTermos] = await Promise.all([
            sr.entities.RespostaChecklist.list(null, 2000).then(r => r.filter(x => unidadeIds.has(x.unidade_fiscalizada_id))),
            sr.entities.NaoConformidade.list(null, 1000).then(r => r.filter(x => unidadeIds.has(x.unidade_fiscalizada_id))),
            sr.entities.Determinacao.list(null, 1000).then(r => r.filter(x => unidadeIds.has(x.unidade_fiscalizada_id))),
            sr.entities.Recomendacao.list(null, 1000).then(r => r.filter(x => unidadeIds.has(x.unidade_fiscalizada_id))),
            sr.entities.ConstatacaoManual.list(null, 1000).then(r => r.filter(x => unidadeIds.has(x.unidade_fiscalizada_id))),
            sr.entities.TermoNotificacao.list(null, 500).then(r => r.filter(x => fiscIds.has(x.fiscalizacao_id))),
        ]);

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