import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FileText, CheckCircle, Upload } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function FluxoUploadDocumentos({ auto, onUpdate }) {
    const [uploading, setUploading] = useState(false);
    const [etapa, setEtapa] = useState('ai_assinado'); // ai_assinado, protocolo, defesa

    const handleUpload = async (tipoArquivo, e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            
            const updateData = {};
            let novoStatus = auto.status;

            if (tipoArquivo === 'ai_assinado') {
                updateData.arquivo_url = file_url;
            } else if (tipoArquivo === 'protocolo_oficio') {
                updateData.arquivo_protocolo_oficio = file_url;
            } else if (tipoArquivo === 'protocolo_ai_recebido') {
                updateData.arquivo_protocolo_ai_recebido = file_url;
                // Se tem ambos os protocolos, muda para "enviado"
                if (auto.arquivo_protocolo_oficio || updateData.arquivo_protocolo_oficio) {
                    novoStatus = 'enviado';
                }
            } else if (tipoArquivo === 'defesa_oficio') {
                updateData.arquivo_defesa_oficio = file_url;
            } else if (tipoArquivo === 'defesa_arquivo') {
                updateData.arquivo_defesa = file_url;
                // Se tem ambos os de defesa, muda para "em_analise"
                if (auto.arquivo_defesa_oficio || updateData.arquivo_defesa_oficio) {
                    novoStatus = 'em_analise';
                }
            }

            updateData.status = novoStatus;

            await base44.entities.AutoInfracao.update(auto.id, updateData);
            onUpdate();
            alert(`Arquivo salvo com sucesso!`);
        } catch (error) {
            alert('Erro ao fazer upload');
        } finally {
            setUploading(false);
        }
    };

    const hasAIAssinado = !!auto.arquivo_url;
    const hasProtocolo = !!auto.arquivo_protocolo_oficio && !!auto.arquivo_protocolo_ai_recebido;
    const hasDefesa = !!auto.arquivo_defesa_oficio && !!auto.arquivo_defesa;

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <Upload className="h-4 w-4 mr-1" />
                    Documentos
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Fluxo de Upload - {auto.numero_auto}</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Etapa 1: AI Assinado */}
                    <Card className={hasAIAssinado ? 'border-green-300' : ''}>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    {hasAIAssinado && <CheckCircle className="h-4 w-4 text-green-600" />}
                                    1. AI Assinado
                                </CardTitle>
                                {hasAIAssinado && <Badge variant="outline" className="bg-green-50">Concluído</Badge>}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Label>Upload do Auto de Infração assinado (PDF)</Label>
                            <input
                                type="file"
                                id="upload-ai-assinado"
                                className="hidden"
                                onChange={(e) => handleUpload('ai_assinado', e)}
                                disabled={uploading}
                                accept=".pdf"
                            />
                            <label htmlFor="upload-ai-assinado">
                                <Button variant="outline" asChild disabled={uploading} className="mt-2 w-full">
                                    <span>
                                        <Upload className="h-4 w-4 mr-2" />
                                        {hasAIAssinado ? 'Alterar arquivo' : 'Escolher arquivo'}
                                    </span>
                                </Button>
                            </label>
                        </CardContent>
                    </Card>

                    {/* Etapa 2: Protocolo */}
                    <Card className={hasProtocolo ? 'border-green-300' : hasAIAssinado ? '' : 'opacity-50'}>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    {hasProtocolo && <CheckCircle className="h-4 w-4 text-green-600" />}
                                    2. Protocolo
                                </CardTitle>
                                {hasProtocolo && <Badge variant="outline" className="bg-green-50">Concluído</Badge>}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-xs text-gray-600">Upload dos documentos de protocolo (Ofício e AI Recebido)</p>
                            
                            <div>
                                <Label className="text-xs">Ofício de Protocolo</Label>
                                <input
                                    type="file"
                                    id="upload-protocolo-oficio"
                                    className="hidden"
                                    onChange={(e) => handleUpload('protocolo_oficio', e)}
                                    disabled={uploading || !hasAIAssinado}
                                    accept=".pdf"
                                />
                                <label htmlFor="upload-protocolo-oficio">
                                    <Button variant="outline" asChild disabled={uploading || !hasAIAssinado} className="mt-1 w-full text-xs">
                                        <span>
                                            <FileText className="h-3 w-3 mr-1" />
                                            {auto.arquivo_protocolo_oficio ? 'Alterar' : 'Enviar'}
                                        </span>
                                    </Button>
                                </label>
                            </div>

                            <div>
                                <Label className="text-xs">AI Recebido</Label>
                                <input
                                    type="file"
                                    id="upload-protocolo-ai"
                                    className="hidden"
                                    onChange={(e) => handleUpload('protocolo_ai_recebido', e)}
                                    disabled={uploading || !hasAIAssinado}
                                    accept=".pdf"
                                />
                                <label htmlFor="upload-protocolo-ai">
                                    <Button variant="outline" asChild disabled={uploading || !hasAIAssinado} className="mt-1 w-full text-xs">
                                        <span>
                                            <FileText className="h-3 w-3 mr-1" />
                                            {auto.arquivo_protocolo_ai_recebido ? 'Alterar' : 'Enviar'}
                                        </span>
                                    </Button>
                                </label>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Etapa 3: Defesa */}
                    <Card className={hasDefesa ? 'border-green-300' : hasProtocolo ? '' : 'opacity-50'}>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    {hasDefesa && <CheckCircle className="h-4 w-4 text-green-600" />}
                                    3. Defesa contra AIs
                                </CardTitle>
                                {hasDefesa && <Badge variant="outline" className="bg-green-50">Concluído</Badge>}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-xs text-gray-600">Upload dos documentos de defesa (Ofício e arquivo de defesa)</p>
                            
                            <div>
                                <Label className="text-xs">Ofício de Defesa</Label>
                                <input
                                    type="file"
                                    id="upload-defesa-oficio"
                                    className="hidden"
                                    onChange={(e) => handleUpload('defesa_oficio', e)}
                                    disabled={uploading || !hasProtocolo}
                                    accept=".pdf"
                                />
                                <label htmlFor="upload-defesa-oficio">
                                    <Button variant="outline" asChild disabled={uploading || !hasProtocolo} className="mt-1 w-full text-xs">
                                        <span>
                                            <FileText className="h-3 w-3 mr-1" />
                                            {auto.arquivo_defesa_oficio ? 'Alterar' : 'Enviar'}
                                        </span>
                                    </Button>
                                </label>
                            </div>

                            <div>
                                <Label className="text-xs">Arquivo de Defesa</Label>
                                <input
                                    type="file"
                                    id="upload-defesa-arquivo"
                                    className="hidden"
                                    onChange={(e) => handleUpload('defesa_arquivo', e)}
                                    disabled={uploading || !hasProtocolo}
                                    accept=".pdf"
                                />
                                <label htmlFor="upload-defesa-arquivo">
                                    <Button variant="outline" asChild disabled={uploading || !hasProtocolo} className="mt-1 w-full text-xs">
                                        <span>
                                            <FileText className="h-3 w-3 mr-1" />
                                            {auto.arquivo_defesa ? 'Alterar' : 'Enviar'}
                                        </span>
                                    </Button>
                                </label>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    );
}