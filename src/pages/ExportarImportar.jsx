import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, FileJson, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

export default function ExportarImportar() {
    const [exportando, setExportando] = useState(false);
    const [importando, setImportando] = useState(false);
    const [exportStatus, setExportStatus] = useState(null);
    const [importStatus, setImportStatus] = useState(null);
    const [importLog, setImportLog] = useState([]);

    // ===================== EXPORTAÇÃO =====================
    const handleExportar = async () => {
        setExportando(true);
        setExportStatus(null);
        try {
            // 1. Buscar fiscalizações finalizadas
            const fiscalizacoes = await base44.entities.Fiscalizacao.filter({ status: 'finalizada' }, '-data_fim', 500);

            if (fiscalizacoes.length === 0) {
                setExportStatus({ tipo: 'aviso', msg: 'Nenhuma fiscalização finalizada encontrada.' });
                return;
            }

            const pacote = {
                versao: '1.0',
                exportado_em: new Date().toISOString(),
                total_fiscalizacoes: fiscalizacoes.length,
                fiscalizacoes: [],
                unidades: [],
                respostas_checklist: [],
                constatacoes_manuais: [],
                nao_conformidades: [],
                determinacoes: [],
                recomendacoes: [],
            };

            pacote.fiscalizacoes = fiscalizacoes;

            const ids_fiscalizacao = fiscalizacoes.map(f => f.id);

            // 2. Buscar todas as unidades das fiscalizações finalizadas
            const todasUnidades = [];
            for (const fid of ids_fiscalizacao) {
                const u = await base44.entities.UnidadeFiscalizada.filter({ fiscalizacao_id: fid }, 'created_date', 200);
                todasUnidades.push(...u);
            }
            pacote.unidades = todasUnidades;
            const ids_unidade = todasUnidades.map(u => u.id);

            // 3. Buscar dados relacionados às unidades em paralelo
            const [respostas, constatacoes, ncs, determinacoes, recomendacoes] = await Promise.all([
                Promise.all(ids_unidade.map(uid => base44.entities.RespostaChecklist.filter({ unidade_fiscalizada_id: uid }, 'id', 500))),
                Promise.all(ids_unidade.map(uid => base44.entities.ConstatacaoManual.filter({ unidade_fiscalizada_id: uid }, 'ordem', 500))),
                Promise.all(ids_unidade.map(uid => base44.entities.NaoConformidade.filter({ unidade_fiscalizada_id: uid }, 'id', 200))),
                Promise.all(ids_unidade.map(uid => base44.entities.Determinacao.filter({ unidade_fiscalizada_id: uid }, 'id', 200))),
                Promise.all(ids_unidade.map(uid => base44.entities.Recomendacao.filter({ unidade_fiscalizada_id: uid }, 'id', 200))),
            ]);

            pacote.respostas_checklist = respostas.flat();
            pacote.constatacoes_manuais = constatacoes.flat();
            pacote.nao_conformidades = ncs.flat();
            pacote.determinacoes = determinacoes.flat();
            pacote.recomendacoes = recomendacoes.flat();

            // 4. Gerar e baixar JSON
            const json = JSON.stringify(pacote, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fiscalizacoes_export_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);

            setExportStatus({
                tipo: 'sucesso',
                msg: `Exportadas ${fiscalizacoes.length} fiscalizações com ${todasUnidades.length} unidades e ${pacote.nao_conformidades.length} NCs.`
            });
        } catch (err) {
            setExportStatus({ tipo: 'erro', msg: `Erro na exportação: ${err.message}` });
        } finally {
            setExportando(false);
        }
    };

    // ===================== IMPORTAÇÃO =====================
    const handleImportar = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImportando(true);
        setImportStatus(null);
        setImportLog([]);

        const log = [];
        const addLog = (msg) => {
            log.push(msg);
            setImportLog([...log]);
        };

        try {
            const text = await file.text();
            const pacote = JSON.parse(text);

            if (!pacote.fiscalizacoes) throw new Error('Arquivo inválido: estrutura não reconhecida.');

            addLog(`📦 Arquivo carregado: ${pacote.total_fiscalizacoes} fiscalizações`);

            // Mapa de IDs antigos -> novos
            const mapaFiscalizacao = {};
            const mapaUnidade = {};
            const mapaNc = {};

            // 1. Importar Fiscalizações
            addLog('⏳ Importando fiscalizações...');
            for (const fisc of pacote.fiscalizacoes) {
                const { id: oldId, created_date, updated_date, ...dados } = fisc;
                const novo = await base44.entities.Fiscalizacao.create(dados);
                mapaFiscalizacao[oldId] = novo.id;
            }
            addLog(`✅ ${pacote.fiscalizacoes.length} fiscalizações criadas`);

            // 2. Importar Unidades
            addLog('⏳ Importando unidades fiscalizadas...');
            for (const unidade of pacote.unidades) {
                const { id: oldId, created_date, updated_date, ...dados } = unidade;
                dados.fiscalizacao_id = mapaFiscalizacao[dados.fiscalizacao_id] || dados.fiscalizacao_id;
                const nova = await base44.entities.UnidadeFiscalizada.create(dados);
                mapaUnidade[oldId] = nova.id;
            }
            addLog(`✅ ${pacote.unidades.length} unidades criadas`);

            // 3. Importar Respostas do Checklist
            if (pacote.respostas_checklist?.length > 0) {
                addLog('⏳ Importando respostas do checklist...');
                for (const resp of pacote.respostas_checklist) {
                    const { id: oldId, created_date, updated_date, ...dados } = resp;
                    dados.unidade_fiscalizada_id = mapaUnidade[dados.unidade_fiscalizada_id] || dados.unidade_fiscalizada_id;
                    await base44.entities.RespostaChecklist.create(dados);
                }
                addLog(`✅ ${pacote.respostas_checklist.length} respostas criadas`);
            }

            // 4. Importar Constatações Manuais
            if (pacote.constatacoes_manuais?.length > 0) {
                addLog('⏳ Importando constatações manuais...');
                for (const cm of pacote.constatacoes_manuais) {
                    const { id: oldId, created_date, updated_date, ...dados } = cm;
                    dados.unidade_fiscalizada_id = mapaUnidade[dados.unidade_fiscalizada_id] || dados.unidade_fiscalizada_id;
                    await base44.entities.ConstatacaoManual.create(dados);
                }
                addLog(`✅ ${pacote.constatacoes_manuais.length} constatações manuais criadas`);
            }

            // 5. Importar Não Conformidades
            if (pacote.nao_conformidades?.length > 0) {
                addLog('⏳ Importando não conformidades...');
                for (const nc of pacote.nao_conformidades) {
                    const { id: oldId, created_date, updated_date, ...dados } = nc;
                    dados.unidade_fiscalizada_id = mapaUnidade[dados.unidade_fiscalizada_id] || dados.unidade_fiscalizada_id;
                    const nova = await base44.entities.NaoConformidade.create(dados);
                    mapaNc[oldId] = nova.id;
                }
                addLog(`✅ ${pacote.nao_conformidades.length} NCs criadas`);
            }

            // 6. Importar Determinações
            if (pacote.determinacoes?.length > 0) {
                addLog('⏳ Importando determinações...');
                for (const det of pacote.determinacoes) {
                    const { id: oldId, created_date, updated_date, ...dados } = det;
                    dados.unidade_fiscalizada_id = mapaUnidade[dados.unidade_fiscalizada_id] || dados.unidade_fiscalizada_id;
                    if (dados.nao_conformidade_id) {
                        dados.nao_conformidade_id = mapaNc[dados.nao_conformidade_id] || dados.nao_conformidade_id;
                    }
                    await base44.entities.Determinacao.create(dados);
                }
                addLog(`✅ ${pacote.determinacoes.length} determinações criadas`);
            }

            // 7. Importar Recomendações
            if (pacote.recomendacoes?.length > 0) {
                addLog('⏳ Importando recomendações...');
                for (const rec of pacote.recomendacoes) {
                    const { id: oldId, created_date, updated_date, ...dados } = rec;
                    dados.unidade_fiscalizada_id = mapaUnidade[dados.unidade_fiscalizada_id] || dados.unidade_fiscalizada_id;
                    await base44.entities.Recomendacao.create(dados);
                }
                addLog(`✅ ${pacote.recomendacoes.length} recomendações criadas`);
            }

            setImportStatus({ tipo: 'sucesso', msg: 'Importação concluída com sucesso!' });
        } catch (err) {
            addLog(`❌ Erro: ${err.message}`);
            setImportStatus({ tipo: 'erro', msg: `Erro na importação: ${err.message}` });
        } finally {
            setImportando(false);
            e.target.value = '';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <Link to={createPageUrl('Home')}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Exportar / Importar Dados</h1>
                        <p className="text-sm text-gray-500">Migração de fiscalizações finalizadas entre servidores</p>
                    </div>
                </div>

                {/* Card Exportar */}
                <Card className="mb-4">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Download className="h-5 w-5 text-blue-600" />
                            Exportar Fiscalizações Finalizadas
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Gera um arquivo <strong>.json</strong> com todas as fiscalizações finalizadas e seus dados relacionados
                            (unidades, checklists, NCs, determinações, recomendações).
                        </p>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                            ⚠️ <strong>Atenção:</strong> As URLs de fotos apontam para o servidor original. As imagens não são exportadas, apenas os links.
                        </div>
                        <Button onClick={handleExportar} disabled={exportando} className="w-full bg-blue-600 hover:bg-blue-700">
                            {exportando ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Exportando...</>
                            ) : (
                                <><FileJson className="h-4 w-4 mr-2" />Exportar JSON</>
                            )}
                        </Button>
                        {exportStatus && (
                            <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                                exportStatus.tipo === 'sucesso' ? 'bg-green-50 text-green-800 border border-green-200' :
                                exportStatus.tipo === 'aviso' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
                                'bg-red-50 text-red-800 border border-red-200'
                            }`}>
                                {exportStatus.tipo === 'sucesso' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                                {exportStatus.msg}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Card Importar */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Upload className="h-5 w-5 text-green-600" />
                            Importar Fiscalizações
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Carrega um arquivo <strong>.json</strong> exportado anteriormente e cria os registros neste servidor.
                            Os IDs serão remapeados automaticamente.
                        </p>
                        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
                            ⚠️ <strong>Cuidado:</strong> Esta operação criará novos registros. Execute apenas uma vez para evitar duplicatas.
                        </div>
                        <label className={`flex items-center justify-center gap-2 w-full py-3 px-4 rounded-md border-2 border-dashed cursor-pointer transition-colors ${
                            importando ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                        }`}>
                            {importando ? (
                                <><Loader2 className="h-4 w-4 animate-spin" />Importando...</>
                            ) : (
                                <><Upload className="h-4 w-4" />Selecionar arquivo .json para importar</>
                            )}
                            <input
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={handleImportar}
                                disabled={importando}
                            />
                        </label>

                        {importLog.length > 0 && (
                            <div className="bg-gray-900 rounded-md p-3 max-h-48 overflow-y-auto">
                                {importLog.map((linha, i) => (
                                    <p key={i} className="text-xs text-green-400 font-mono">{linha}</p>
                                ))}
                            </div>
                        )}

                        {importStatus && (
                            <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                                importStatus.tipo === 'sucesso' ? 'bg-green-50 text-green-800 border border-green-200' :
                                'bg-red-50 text-red-800 border border-red-200'
                            }`}>
                                {importStatus.tipo === 'sucesso' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                                {importStatus.msg}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}