import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Acesso negado. Apenas administradores podem importar checklists.' }, { status: 403 });
        }

        const { file_base64 } = await req.json();

        if (!file_base64) {
            return Response.json({ error: 'Arquivo não fornecido' }, { status: 400 });
        }

        // Decodificar base64 para ArrayBuffer
        const binaryString = atob(file_base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Ler arquivo Excel
        const workbook = XLSX.read(bytes, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Converter para array de objetos
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (data.length < 2) {
            return Response.json({ error: 'Arquivo vazio ou sem dados' }, { status: 400 });
        }

        // Ignorar cabeçalho e filtrar linhas vazias
        const dataLines = data.slice(1).filter(linha => {
            // Verificar se a linha tem algum conteúdo válido
            return Array.isArray(linha) && linha.some(celula => celula && String(celula).trim() !== '');
        });

        const tiposCache = new Map();
        const itensImportados = [];
        const erros = [];

        for (let i = 0; i < dataLines.length; i++) {
            try {
                const linha = dataLines[i];
                
                // Linha é um array de células
                if (!Array.isArray(linha) || linha.length < 11) {
                    erros.push(`Linha com dados insuficientes (${linha?.length || 0} colunas). Esperado: 11 colunas`);
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
                    texto_determinacao,
                    texto_recomendacao,
                    prazo_dias
                ] = linha.map(c => c ? String(c).trim() : '');

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
                    pergunta: pergunta || '',
                    texto_constatacao_sim: texto_constatacao_sim || '',
                    texto_constatacao_nao: texto_constatacao_nao || '',
                    gera_nc: true, // Sempre gera NC quando resposta é NÃO
                    artigo_portaria: artigo_portaria || '',
                    texto_determinacao: texto_determinacao || '',
                    texto_recomendacao: texto_recomendacao || '',
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