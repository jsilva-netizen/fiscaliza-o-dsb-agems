import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Mail, Phone, Building2, Edit2, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import HistoricoFiscalizacoes from '@/components/prestador/HistoricoFiscalizacoes';
import HistoricoDeterminacoes from '@/components/prestador/HistoricoDeterminacoes';
import HistoricoAutos from '@/components/prestador/HistoricoAutos';
import DocumentosManager from '@/components/prestador/DocumentosManager';

export default function DetalhePrestador() {
    const [searchParams] = useSearchParams();
    const prestadorId = searchParams.get('id');
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [isUploadingDoc, setIsUploadingDoc] = useState(false);

    const { data: prestador } = useQuery({
        queryKey: ['prestador', prestadorId],
        queryFn: () => base44.entities.PrestadorServico.list().then(ps => ps.find(p => p.id === prestadorId))
    });

    const { data: fiscalizacoes = [] } = useQuery({
        queryKey: ['fiscalizacoes-prestador', prestadorId],
        queryFn: () => base44.entities.Fiscalizacao.list('id', 500).then(fs => fs.filter(f => f.prestador_servico_id === prestadorId))
    });

    const { data: unidades = [] } = useQuery({
        queryKey: ['unidades-fiscalizacoes', prestadorId],
        queryFn: async () => {
            if (fiscalizacoes.length === 0) return [];
            return base44.entities.UnidadeFiscalizada.list('id', 500).then(us => 
                us.filter(u => fiscalizacoes.some(f => f.id === u.fiscalizacao_id))
            );
        },
        enabled: fiscalizacoes.length > 0
    });

    const { data: ncs = [] } = useQuery({
        queryKey: ['ncs-prestador', prestadorId],
        queryFn: async () => {
            if (unidades.length === 0) return [];
            return base44.entities.NaoConformidade.list('id', 500).then(ns => 
                ns.filter(n => unidades.some(u => u.id === n.unidade_fiscalizada_id))
            );
        },
        enabled: unidades.length > 0
    });

    const { data: determinacoes = [] } = useQuery({
        queryKey: ['determinacoes-prestador', prestadorId],
        queryFn: async () => {
            if (unidades.length === 0) return [];
            return base44.entities.Determinacao.list('id', 500).then(ds => 
                ds.filter(d => unidades.some(u => u.id === d.unidade_fiscalizada_id))
            );
        },
        enabled: unidades.length > 0
    });

    const { data: respostas = [] } = useQuery({
        queryKey: ['respostas-determinacoes'],
        queryFn: () => base44.entities.RespostaDeterminacao.list('id', 500)
    });

    const { data: autos = [] } = useQuery({
        queryKey: ['autos-prestador', prestadorId],
        queryFn: () => base44.entities.AutoInfracao.list('id', 500).then(as => as.filter(a => a.prestador_servico_id === prestadorId))
    });

    const { data: municipios = [] } = useQuery({
        queryKey: ['municipios'],
        queryFn: () => base44.entities.Municipio.list('nome', 500)
    });

    const atualizarMutation = useMutation({
        mutationFn: (data) => base44.entities.PrestadorServico.update(prestadorId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['prestador', prestadorId] });
            setIsEditing(false);
        }
    });

    const handleSaveEdit = () => {
        atualizarMutation.mutate(editForm);
    };

    const handleUploadDocumento = async (file, tipo) => {
        setIsUploadingDoc(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            const novoDoc = {
                nome: file.name,
                tipo,
                url: file_url,
                data_upload: new Date().toISOString()
            };
            
            const docsAtualizados = [...(prestador?.documentos || []), novoDoc];
            await base44.entities.PrestadorServico.update(prestadorId, {
                documentos: docsAtualizados
            });
            
            queryClient.invalidateQueries({ queryKey: ['prestador', prestadorId] });
            alert('Documento anexado com sucesso!');
        } catch (error) {
            console.error('Erro:', error);
            alert('Erro ao fazer upload');
        } finally {
            setIsUploadingDoc(false);
        }
    };

    const handleDeleteDocumento = async (index) => {
        const docsAtualizados = prestador.documentos.filter((_, i) => i !== index);
        await base44.entities.PrestadorServico.update(prestadorId, {
            documentos: docsAtualizados
        });
        queryClient.invalidateQueries({ queryKey: ['prestador', prestadorId] });
    };

    if (!prestador) return <div className="p-6">Carregando...</div>;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-blue-900 text-white">
                <div className="max-w-6xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Link to={createPageUrl('PrestadoresServico')}>
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold">{prestador.nome}</h1>
                            <div className="flex items-center gap-4 mt-2 text-blue-100">
                                {prestador.email_contato && (
                                    <div className="flex items-center gap-1">
                                        <Mail className="h-4 w-4" />
                                        {prestador.email_contato}
                                    </div>
                                )}
                                {prestador.telefone && (
                                    <div className="flex items-center gap-1">
                                        <Phone className="h-4 w-4" />
                                        {prestador.telefone}
                                    </div>
                                )}
                                {prestador.tipo && (
                                    <Badge className={prestador.tipo === 'titular' ? 'bg-purple-600' : 'bg-blue-600'}>
                                        {prestador.tipo === 'titular' ? 'Titular' : 'Prestador de Serviço'}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <Dialog open={isEditing} onOpenChange={setIsEditing}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="text-blue-900" onClick={() => setEditForm(prestador)}>
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Editar
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>Editar Prestador</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                    <Input
                                        label="Nome"
                                        value={editForm.nome || ''}
                                        onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                                        placeholder="Nome"
                                    />
                                    <Input
                                        placeholder="Razão Social"
                                        value={editForm.razao_social || ''}
                                        onChange={(e) => setEditForm({ ...editForm, razao_social: e.target.value })}
                                    />
                                    <Input
                                        placeholder="CNPJ"
                                        value={editForm.cnpj || ''}
                                        onChange={(e) => setEditForm({ ...editForm, cnpj: e.target.value })}
                                    />
                                    <Input
                                        placeholder="Email de Contato"
                                        type="email"
                                        value={editForm.email_contato || ''}
                                        onChange={(e) => setEditForm({ ...editForm, email_contato: e.target.value })}
                                    />
                                    <Input
                                        placeholder="Telefone"
                                        value={editForm.telefone || ''}
                                        onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
                                    />
                                    <Textarea
                                        placeholder="Endereço"
                                        value={editForm.endereco || ''}
                                        onChange={(e) => setEditForm({ ...editForm, endereco: e.target.value })}
                                    />
                                    <Input
                                        placeholder="Cidade"
                                        value={editForm.cidade || ''}
                                        onChange={(e) => setEditForm({ ...editForm, cidade: e.target.value })}
                                    />
                                    <Input
                                        placeholder="Responsável"
                                        value={editForm.responsavel || ''}
                                        onChange={(e) => setEditForm({ ...editForm, responsavel: e.target.value })}
                                    />
                                    <Input
                                        placeholder="Cargo"
                                        value={editForm.cargo || ''}
                                        onChange={(e) => setEditForm({ ...editForm, cargo: e.target.value })}
                                    />
                                    <div>
                                        <Label>Tipo</Label>
                                        <Select value={editForm.tipo || 'prestador_servico'} onValueChange={(value) => setEditForm({ ...editForm, tipo: value })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="prestador_servico">Prestador de Serviço</SelectItem>
                                                <SelectItem value="titular">Titular</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-4">
                                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                                    <Button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700">
                                        <Save className="h-4 w-4 mr-2" />
                                        Salvar
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-4 py-6">
                {/* Info Cards */}
                <div className="grid grid-cols-5 gap-4 mb-6">
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="text-sm text-gray-600 mb-1">Fiscalizações</p>
                            <p className="text-2xl font-bold text-blue-600">{fiscalizacoes.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="text-sm text-gray-600 mb-1">Finalizadas</p>
                            <p className="text-2xl font-bold text-green-600">{fiscalizacoes.filter(f => f.status === 'finalizada').length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="text-sm text-gray-600 mb-1">Determinações</p>
                            <p className="text-2xl font-bold text-orange-600">{determinacoes.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="text-sm text-gray-600 mb-1">Autos de Infração</p>
                            <p className="text-2xl font-bold text-red-600">{autos.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="text-sm text-gray-600 mb-1">Documentos</p>
                            <p className="text-2xl font-bold text-green-600">{prestador.documentos?.length || 0}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="info" className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="info">Informações</TabsTrigger>
                        <TabsTrigger value="fiscalizacoes">Fiscalizações ({fiscalizacoes.length})</TabsTrigger>
                        <TabsTrigger value="determinacoes">Determinações ({determinacoes.length})</TabsTrigger>
                        <TabsTrigger value="autos">Autos ({autos.length})</TabsTrigger>
                        <TabsTrigger value="documentos">Documentos</TabsTrigger>
                    </TabsList>

                    <TabsContent value="info" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Informações Gerais</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-sm font-medium text-gray-600 mb-1">Nome</p>
                                    <p className="text-base">{prestador.nome}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-600 mb-1">CNPJ/MF</p>
                                    <p className="text-base">{prestador.cnpj}</p>
                                </div>
                                {prestador.razao_social && (
                                    <div>
                                        <p className="text-sm font-medium text-gray-600 mb-1">Razão Social</p>
                                        <p className="text-base">{prestador.razao_social}</p>
                                    </div>
                                )}
                                {prestador.email_contato && (
                                    <div>
                                        <p className="text-sm font-medium text-gray-600 mb-1">Email de Contato</p>
                                        <p className="text-base">{prestador.email_contato}</p>
                                    </div>
                                )}
                                {prestador.telefone && (
                                    <div>
                                        <p className="text-sm font-medium text-gray-600 mb-1">Telefone</p>
                                        <p className="text-base">{prestador.telefone}</p>
                                    </div>
                                )}
                                {prestador.cidade && (
                                    <div>
                                        <p className="text-sm font-medium text-gray-600 mb-1">Cidade</p>
                                        <p className="text-base">{prestador.cidade}</p>
                                    </div>
                                )}
                                {prestador.endereco && (
                                    <div className="col-span-2">
                                        <p className="text-sm font-medium text-gray-600 mb-1">Endereço</p>
                                        <p className="text-base">{prestador.endereco}</p>
                                    </div>
                                )}
                                {prestador.responsavel && (
                                    <div>
                                        <p className="text-sm font-medium text-gray-600 mb-1">Responsável</p>
                                        <p className="text-base">{prestador.responsavel}</p>
                                    </div>
                                )}
                                {prestador.cargo && (
                                    <div>
                                        <p className="text-sm font-medium text-gray-600 mb-1">Cargo</p>
                                        <p className="text-base">{prestador.cargo}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="fiscalizacoes">
                        <HistoricoFiscalizacoes fiscalizacoes={fiscalizacoes} municipios={municipios} />
                    </TabsContent>

                    <TabsContent value="determinacoes">
                        <HistoricoDeterminacoes determinacoes={determinacoes} respostas={respostas} />
                    </TabsContent>

                    <TabsContent value="autos">
                        <HistoricoAutos autos={autos} />
                    </TabsContent>

                    <TabsContent value="documentos">
                        <DocumentosManager
                            documentos={prestador.documentos || []}
                            onUpload={handleUploadDocumento}
                            onDelete={handleDeleteDocumento}
                            isUploading={isUploadingDoc}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}