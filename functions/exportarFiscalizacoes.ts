import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

        const pacote = {
            versao: '1.0',
            exportado_em: new Date().toISOString(),
            total_fiscalizacoes: fiscalizacoes.length,
            fiscalizacoes,
            unidades: [],
            respostas_checklist: [],
            nao_conformidades: [],
            determinacoes: [],
            recomendacoes: [],
            constatacoes_manuais: [],
            termos_notificacao: [],
            fotos_urls: [],
        };

        // Buscar todos os IDs de fiscalizações de uma vez
        const fiscIds = fiscalizacoes.map(f => f.id);

        // Buscar todas as unidades de todas as fiscalizações em paralelo
        const unidadesPorFisc = await Promise.all(
            fiscIds.map(id => base44.entities.UnidadeFiscalizada.filter({ fiscalizacao_id: id }))
        );
        const todasUnidades = unidadesPorFisc.flat();
        pacote.unidades = todasUnidades;

        const unidadeIds = todasUnidades.map(u => u.id);

        // Buscar todos os dados relacionados às unidades em paralelo (batch por tipo)
        const [
            todasRespostas,
            todasNCs,
            todasDets,
            todasRecs,
            todasConsts,
            todosTermos,
        ] = await Promise.all([
            Promise.all(unidadeIds.map(id => base44.entities.RespostaChecklist.filter({ unidade_fiscalizada_id: id }))).then(r => r.flat()),
            Promise.all(unidadeIds.map(id => base44.entities.NaoConformidade.filter({ unidade_fiscalizada_id: id }))).then(r => r.flat()),
            Promise.all(unidadeIds.map(id => base44.entities.Determinacao.filter({ unidade_fiscalizada_id: id }))).then(r => r.flat()),
            Promise.all(unidadeIds.map(id => base44.entities.Recomendacao.filter({ unidade_fiscalizada_id: id }))).then(r => r.flat()),
            Promise.all(unidadeIds.map(id => base44.entities.ConstatacaoManual.filter({ unidade_fiscalizada_id: id }))).then(r => r.flat()),
            Promise.all(fiscIds.map(id => base44.entities.TermoNotificacao.filter({ fiscalizacao_id: id }))).then(r => r.flat()),
        ]);

        pacote.respostas_checklist = todasRespostas;
        pacote.nao_conformidades = todasNCs;
        pacote.determinacoes = todasDets;
        pacote.recomendacoes = todasRecs;
        pacote.constatacoes_manuais = todasConsts;
        pacote.termos_notificacao = todosTermos;

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