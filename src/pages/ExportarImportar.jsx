import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
    Download, Upload, FileJson, CheckCircle2, 
    AlertCircle, Loader2, Database, ArrowRight, Info
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ExportarImportar() {
    const [exportando, setExportando] = useState(false);
    const [importando, setImportando] = useState(false);
    const [exportStatus, setExportStatus] = useState(null);
    const [importStatus, setImportStatus] = useState(null);
    const [importLog, setImportLog] = useState([]);
    const [previewImport, setPreviewImport] = useState(null);

    // ========================
    // EXPORTAÇÃO
    // ========================
    const exportarDados = async () => {
        setExportando(true);
        setExportStatus(null);
        try {
            const addLog = (msg) => console.log(msg);

            addLog('Buscando fiscalizações finalizadas...');
            const fiscalizacoes = await base44.entities.Fiscalizacao.filter({ status: 'finalizada' });

            if (fiscalizacoes.length === 0) {
                setExportStatus({ tipo: 'aviso', msg: 'Nenhuma fiscalização finalizada encontrada.' });
                setExportando(false);
                return;
            }

            const pacote = {
                versao: '1.0',
                exportado_em: new Date().toISOString(),
                total_fiscalizacoes: fiscalizacoes.length,
                fiscalizacoes: [],
                unidades: [],
                respostas_checklist: [],
                nao_conformidades: [],
                determinacoes: [],
                recomendacoes: [],
                constatacoes_manuais: [],
                termos_notificacao: [],
                // Mapa de todas as URLs de fotos encontradas no pacote
                fotos_urls: [],
            };

            for (const fisc of fiscalizacoes) {
                pacote.fiscalizacoes.push(fisc);

                const unidades = await base44.entities.UnidadeFiscalizada.filter({ fiscalizacao_id: fisc.id });
                pacote.unidades.push(...unidades);

                for (const unidade of unidades) {
                    const [respostas, ncs, dets, recs, consts] = await Promise.all([
                        base44.entities.RespostaChecklist.filter({ unidade_fiscalizada_id: unidade.id }),
                        base44.entities.NaoConformidade.filter({ unidade_fiscalizada_id: unidade.id }),
                        base44.entities.Determinacao.filter({ unidade_fiscalizada_id: unidade.id }),
                        base44.entities.Recomendacao.filter({ unidade_fiscalizada_id: unidade.id }),
                        base44.entities.ConstatacaoManual.filter({ unidade_fiscalizada_id: unidade.id }),
                    ]);
                    pacote.respostas_checklist.push(...respostas);
                    pacote.nao_conformidades.push(...ncs);
                    pacote.determinacoes.push(...dets);
                    pacote.recomendacoes.push(...recs);
                    pacote.constatacoes_manuais.push(...consts);
                }

                const termos = await base44.entities.TermoNotificacao.filter({ fiscalizacao_id: fisc.id });
                pacote.termos_notificacao.push(...termos);
            }

            // Coletar todas as URLs de fotos do pacote
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

            const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `exportacao_fiscalizacoes_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`;
            a.click();
            URL.revokeObjectURL(url);

            setExportStatus({
                tipo: 'sucesso',
                msg: `Exportação concluída! ${fiscalizacoes.length} fiscalizações e ${pacote.fotos_urls.length} URLs de fotos exportadas.`
            });
        } catch (err) {
            setExportStatus({ tipo: 'erro', msg: `Erro na exportação: ${err.message}` });
        }
        setExportando(false);
    };

    // ========================
    // PRÉ-VISUALIZAÇÃO DO ARQUIVO
    // ========================
    const handleArquivoSelecionado = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const dados = JSON.parse(ev.target.result);
                setPreviewImport({
                    arquivo: file,
                    dados,
                    nome: file.name,
                });
                setImportStatus(null);
                setImportLog([]);
            } catch {
                setImportStatus({ tipo: 'erro', msg: 'Arquivo JSON inválido.' });
                setPreviewImport(null);
            }
        };
        reader.readAsText(file);
    };

    // ========================
    // HELPER: Re-upload de foto por URL
    // ========================
    const reuploadFoto = async (urlOriginal, urlMap) => {
        if (!urlOriginal || urlMap[urlOriginal]) return urlMap[urlOriginal] || urlOriginal;
        try {
            const response = await fetch(urlOriginal);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const ext = urlOriginal.split('.').pop().split('?')[0] || 'jpg';
            const file = new File([blob], `foto_migrada.${ext}`, { type: blob.type || 'image/jpeg' });
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            urlMap[urlOriginal] = file_url;
            return file_url;
        } catch {
            // Se falhar, mantém URL original
            urlMap[urlOriginal] = urlOriginal;
            return urlOriginal;
        }
    };

    // Substitui todas as URLs em uma estrutura de dados
    const substituirUrls = (obj, urlMap) => {
        if (!obj) return obj;
        if (typeof obj === 'string') return urlMap[obj] || obj;
        if (Array.isArray(obj)) return obj.map(item => substituirUrls(item, urlMap));
        if (typeof obj === 'object') {
            const novo = {};
            for (const key of Object.keys(obj)) {
                novo[key] = substituirUrls(obj[key], urlMap);
            }
            return novo;
        }
        return obj;
    };

    // ========================
    // IMPORTAÇÃO
    // ========================
    const importarDados = async () => {
        if (!previewImport) return;
        setImportando(true);
        setImportStatus(null);
        const logs = [];
        const addLog = (msg) => {
            logs.push(msg);
            setImportLog([...logs]);
        };

        try {
            const dados = previewImport.dados;
            // Mapa de IDs antigos -> novos
            const idMap = {};
            // Mapa de URLs antigas -> novas
            const urlMap = {};

            // 0. Re-upload de fotos
            const totalFotos = dados.fotos_urls?.length || 0;
            if (totalFotos > 0) {
                addLog(`Re-fazendo upload de ${totalFotos} fotos/arquivos...`);
                let ok = 0, falhou = 0;
                for (const url of dados.fotos_urls) {
                    const resultado = await reuploadFoto(url, urlMap);
                    if (resultado !== url) ok++;
                    else falhou++;
                    addLog(`  [${ok + falhou}/${totalFotos}] ${resultado !== url ? '✓' : '⚠ mantida original'} ${url.split('/').pop().substring(0, 40)}`);
                }
                addLog(`✓ Fotos: ${ok} re-uploadadas, ${falhou} mantidas como URL original`);
            }

            // 1. Fiscalizações
            addLog(`Importando ${dados.fiscalizacoes.length} fiscalizações...`);
            for (const fisc of dados.fiscalizacoes) {
                const { id: oldId, created_date, updated_date, created_by, ...resto } = fisc;
                const novo = await base44.entities.Fiscalizacao.create(substituirUrls(resto, urlMap));
                idMap[oldId] = novo.id;
            }
            addLog(`✓ ${dados.fiscalizacoes.length} fiscalizações criadas`);

            // 2. Unidades Fiscalizadas
            addLog(`Importando ${dados.unidades.length} unidades...`);
            for (const unidade of dados.unidades) {
                const { id: oldId, created_date, updated_date, created_by, ...resto } = unidade;
                resto.fiscalizacao_id = idMap[resto.fiscalizacao_id] || resto.fiscalizacao_id;
                const novo = await base44.entities.UnidadeFiscalizada.create(substituirUrls(resto, urlMap));
                idMap[oldId] = novo.id;
            }
            addLog(`✓ ${dados.unidades.length} unidades criadas`);

            // 3. Respostas Checklist
            addLog(`Importando ${dados.respostas_checklist.length} respostas...`);
            for (const resp of dados.respostas_checklist) {
                const { id: oldId, created_date, updated_date, created_by, ...resto } = resp;
                resto.unidade_fiscalizada_id = idMap[resto.unidade_fiscalizada_id] || resto.unidade_fiscalizada_id;
                const novo = await base44.entities.RespostaChecklist.create(resto);
                idMap[oldId] = novo.id;
            }
            addLog(`✓ ${dados.respostas_checklist.length} respostas criadas`);

            // 4. Não Conformidades
            addLog(`Importando ${dados.nao_conformidades.length} não conformidades...`);
            for (const nc of dados.nao_conformidades) {
                const { id: oldId, created_date, updated_date, created_by, ...resto } = nc;
                resto.unidade_fiscalizada_id = idMap[resto.unidade_fiscalizada_id] || resto.unidade_fiscalizada_id;
                if (resto.resposta_checklist_id) resto.resposta_checklist_id = idMap[resto.resposta_checklist_id] || resto.resposta_checklist_id;
                const novo = await base44.entities.NaoConformidade.create(substituirUrls(resto, urlMap));
                idMap[oldId] = novo.id;
            }
            addLog(`✓ ${dados.nao_conformidades.length} NCs criadas`);

            // 5. Determinações
            addLog(`Importando ${dados.determinacoes.length} determinações...`);
            for (const det of dados.determinacoes) {
                const { id: oldId, created_date, updated_date, created_by, ...resto } = det;
                resto.unidade_fiscalizada_id = idMap[resto.unidade_fiscalizada_id] || resto.unidade_fiscalizada_id;
                if (resto.nao_conformidade_id) resto.nao_conformidade_id = idMap[resto.nao_conformidade_id] || resto.nao_conformidade_id;
                const novo = await base44.entities.Determinacao.create(resto);
                idMap[oldId] = novo.id;
            }
            addLog(`✓ ${dados.determinacoes.length} determinações criadas`);

            // 6. Recomendações
            addLog(`Importando ${dados.recomendacoes.length} recomendações...`);
            for (const rec of dados.recomendacoes) {
                const { id: oldId, created_date, updated_date, created_by, ...resto } = rec;
                resto.unidade_fiscalizada_id = idMap[resto.unidade_fiscalizada_id] || resto.unidade_fiscalizada_id;
                await base44.entities.Recomendacao.create(resto);
            }
            addLog(`✓ ${dados.recomendacoes.length} recomendações criadas`);

            // 7. Constatações Manuais
            addLog(`Importando ${dados.constatacoes_manuais.length} constatações manuais...`);
            for (const con of dados.constatacoes_manuais) {
                const { id: oldId, created_date, updated_date, created_by, ...resto } = con;
                resto.unidade_fiscalizada_id = idMap[resto.unidade_fiscalizada_id] || resto.unidade_fiscalizada_id;
                await base44.entities.ConstatacaoManual.create(resto);
            }
            addLog(`✓ ${dados.constatacoes_manuais.length} constatações manuais criadas`);

            // 8. Termos de Notificação
            addLog(`Importando ${dados.termos_notificacao.length} termos de notificação...`);
            for (const termo of dados.termos_notificacao) {
                const { id: oldId, created_date, updated_date, created_by, ...resto } = termo;
                resto.fiscalizacao_id = idMap[resto.fiscalizacao_id] || resto.fiscalizacao_id;
                await base44.entities.TermoNotificacao.create(resto);
            }
            addLog(`✓ ${dados.termos_notificacao.length} termos criados`);

            addLog('');
            addLog('✅ Importação concluída com sucesso!');
            setImportStatus({ tipo: 'sucesso', msg: `Importação concluída! ${dados.fiscalizacoes.length} fiscalizações importadas.` });
            setPreviewImport(null);
        } catch (err) {
            addLog(`❌ Erro: ${err.message}`);
            setImportStatus({ tipo: 'erro', msg: `Erro na importação: ${err.message}` });
        }
        setImportando(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Database className="h-7 w-7 text-blue-600" />
                        <h1 className="text-2xl font-bold text-gray-900">Exportar / Importar Dados</h1>
                    </div>
                    <p className="text-gray-500 text-sm">Migre fiscalizações finalizadas entre instâncias do app</p>
                </div>

                {/* Info */}
                <Alert className="mb-6 border-blue-200 bg-blue-50">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800 text-sm">
                        A exportação gera um arquivo JSON com todas as fiscalizações <strong>finalizadas</strong> e seus dados relacionados. 
                        Para migrar fotos, as imagens precisam ser re-uploadadas manualmente.
                    </AlertDescription>
                </Alert>

                {/* EXPORTAÇÃO */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Download className="h-5 w-5 text-green-600" />
                            Exportar Dados
                        </CardTitle>
                        <CardDescription>
                            Exporta todas as fiscalizações finalizadas em um arquivo JSON
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 space-y-1">
                            <p>O arquivo incluirá:</p>
                            <ul className="list-disc list-inside space-y-0.5 text-xs mt-1">
                                <li>Fiscalizações (status: finalizada)</li>
                                <li>Unidades Fiscalizadas</li>
                                <li>Respostas do Checklist</li>
                                <li>Não Conformidades</li>
                                <li>Determinações e Recomendações</li>
                                <li>Constatações Manuais</li>
                                <li>Termos de Notificação</li>
                            </ul>
                        </div>

                        {exportStatus && (
                            <Alert className={exportStatus.tipo === 'sucesso' ? 'border-green-200 bg-green-50' : exportStatus.tipo === 'aviso' ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'}>
                                {exportStatus.tipo === 'sucesso' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-yellow-600" />}
                                <AlertDescription className={exportStatus.tipo === 'sucesso' ? 'text-green-800' : 'text-yellow-800'}>
                                    {exportStatus.msg}
                                </AlertDescription>
                            </Alert>
                        )}

                        <Button onClick={exportarDados} disabled={exportando} className="w-full bg-green-600 hover:bg-green-700">
                            {exportando ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Exportando...</>
                            ) : (
                                <><Download className="h-4 w-4 mr-2" />Exportar Fiscalizações Finalizadas</>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Divisor */}
                <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-gray-200" />
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* IMPORTAÇÃO */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Upload className="h-5 w-5 text-blue-600" />
                            Importar Dados
                        </CardTitle>
                        <CardDescription>
                            Importe um arquivo JSON exportado de outra instância do app
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Upload área */}
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <FileJson className="h-8 w-8 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-500">
                                    <span className="font-medium text-blue-600">Clique para selecionar</span> o arquivo JSON
                                </p>
                                <p className="text-xs text-gray-400 mt-1">Arquivo exportado por esta aplicação</p>
                            </div>
                            <input type="file" accept=".json" className="hidden" onChange={handleArquivoSelecionado} />
                        </label>

                        {/* Preview do arquivo */}
                        {previewImport && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                                <p className="font-medium text-blue-900 text-sm flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Arquivo carregado: <span className="font-mono">{previewImport.nome}</span>
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-white rounded p-2 text-center">
                                        <div className="font-bold text-lg text-blue-700">{previewImport.dados.fiscalizacoes?.length || 0}</div>
                                        <div className="text-gray-500">Fiscalizações</div>
                                    </div>
                                    <div className="bg-white rounded p-2 text-center">
                                        <div className="font-bold text-lg text-blue-700">{previewImport.dados.unidades?.length || 0}</div>
                                        <div className="text-gray-500">Unidades</div>
                                    </div>
                                    <div className="bg-white rounded p-2 text-center">
                                        <div className="font-bold text-lg text-blue-700">{previewImport.dados.nao_conformidades?.length || 0}</div>
                                        <div className="text-gray-500">NCs</div>
                                    </div>
                                    <div className="bg-white rounded p-2 text-center">
                                        <div className="font-bold text-lg text-blue-700">{previewImport.dados.determinacoes?.length || 0}</div>
                                        <div className="text-gray-500">Determinações</div>
                                    </div>
                                </div>
                                {previewImport.dados.exportado_em && (
                                    <p className="text-xs text-gray-500">
                                        Exportado em: {format(new Date(previewImport.dados.exportado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Log de importação */}
                        {importLog.length > 0 && (
                            <div className="bg-gray-900 rounded-lg p-3 max-h-48 overflow-y-auto">
                                {importLog.map((log, i) => (
                                    <p key={i} className="text-xs font-mono text-green-400 leading-5">{log}</p>
                                ))}
                            </div>
                        )}

                        {/* Status */}
                        {importStatus && (
                            <Alert className={importStatus.tipo === 'sucesso' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                                {importStatus.tipo === 'sucesso' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
                                <AlertDescription className={importStatus.tipo === 'sucesso' ? 'text-green-800' : 'text-red-800'}>
                                    {importStatus.msg}
                                </AlertDescription>
                            </Alert>
                        )}

                        <Button
                            onClick={importarDados}
                            disabled={!previewImport || importando}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            {importando ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importando...</>
                            ) : (
                                <><Upload className="h-4 w-4 mr-2" />Iniciar Importação</>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}