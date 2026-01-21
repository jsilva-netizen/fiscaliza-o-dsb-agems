import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Acesso negado. Apenas administradores podem importar checklists.' }, { status: 403 });
        }

        const formData = await req.formData();
        const file = formData.get('file');

        if (!file) {
            return Response.json({ error: 'Arquivo não fornecido' }, { status: 400 });
        }

        const csvText = await file.text();
        const lines = csvText.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
            return Response.json({ error: 'Arquivo vazio ou sem dados' }, { status: 400 });
        }

        // Ignorar cabeçalho
        const dataLines = lines.slice(1);

        const tiposCache = new Map();
        const itensImportados = [];
        const erros = [];

        for (let i = 0; i < dataLines.length; i++) {
            try {
                const linha = dataLines[i];
                const colunas = linha.split(';').map(c => c.trim());

                if (colunas.length < 11) {
                    erros.push(`Linha ${i + 2}: Número insuficiente de colunas (${colunas.length}/11)`);
                    continue;
                }

                const [
                    servico,
                    tipo_unidade_codigo,
                    tipo_unidade_nome,
                    ordem,
                    pergunta,
                    texto_constatacao_sim,
                    texto_constatacao_nao,
                    artigo_portaria,
                    texto_nc,
                    texto_determinacao,
                    prazo_dias
                ] = colunas;

                // Validações básicas
                if (!pergunta || !tipo_unidade_nome) {
                    erros.push(`Linha ${i + 2}: Pergunta ou tipo de unidade vazio`);
                    continue;
                }

                // Buscar ou criar TipoUnidade
                let tipoId;
                const cacheKey = `${tipo_unidade_codigo}_${tipo_unidade_nome}`;
                
                if (tiposCache.has(cacheKey)) {
                    tipoId = tiposCache.get(cacheKey);
                } else {
                    // Buscar tipo existente
                    const tiposExistentes = await base44.entities.TipoUnidade.filter({ 
                        nome: tipo_unidade_nome 
                    });

                    if (tiposExistentes.length > 0) {
                        tipoId = tiposExistentes[0].id;
                    } else {
                        // Criar novo tipo
                        const novoTipo = await base44.asServiceRole.entities.TipoUnidade.create({
                            nome: tipo_unidade_nome,
                            descricao: `Tipo: ${tipo_unidade_codigo}`,
                            servicos_aplicaveis: servico ? [servico] : [],
                            ativo: true
                        });
                        tipoId = novoTipo.id;
                    }
                    
                    tiposCache.set(cacheKey, tipoId);
                }

                // Criar ItemChecklist
                const item = await base44.asServiceRole.entities.ItemChecklist.create({
                    tipo_unidade_id: tipoId,
                    ordem: parseInt(ordem) || 0,
                    pergunta,
                    texto_constatacao_sim,
                    texto_constatacao_nao,
                    gera_nc: true, // Sempre gera NC quando resposta é NÃO
                    artigo_portaria,
                    texto_nc, // Mantém na entidade mas não será usado
                    texto_determinacao,
                    prazo_dias: parseInt(prazo_dias) || 30,
                    ativo: true
                });

                itensImportados.push(item.id);

            } catch (error) {
                erros.push(`Linha ${i + 2}: ${error.message}`);
            }
        }

        return Response.json({
            sucesso: true,
            itens_importados: itensImportados.length,
            tipos_criados: tiposCache.size,
            erros: erros.length > 0 ? erros : null
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});