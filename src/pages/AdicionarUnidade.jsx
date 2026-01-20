import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Building2, Loader2, Navigation } from 'lucide-react';

export default function AdicionarUnidade() {
    const navigate = useNavigate();
    const urlParams = new URLSearchParams(window.location.search);
    const fiscalizacaoId = urlParams.get('fiscalizacao');

    const [formData, setFormData] = useState({
        tipo_unidade_id: '',
        codigo_unidade: '',
        nome_unidade: '',
        endereco: ''
    });
    const [location, setLocation] = useState(null);
    const [loadingAddress, setLoadingAddress] = useState(false);

    const { data: fiscalizacao } = useQuery({
        queryKey: ['fiscalizacao', fiscalizacaoId],
        queryFn: () => base44.entities.Fiscalizacao.filter({ id: fiscalizacaoId }).then(r => r[0]),
        enabled: !!fiscalizacaoId
    });

    const { data: tipos = [] } = useQuery({
        queryKey: ['tipos-unidade'],
        queryFn: () => base44.entities.TipoUnidade.list('nome', 100)
    });

    const { data: unidadesExistentes = [] } = useQuery({
        queryKey: ['unidades-existentes', fiscalizacaoId],
        queryFn: () => base44.entities.UnidadeFiscalizada.filter({ fiscalizacao_id: fiscalizacaoId }, 'created_date', 500),
        enabled: !!fiscalizacaoId
    });

    // Obter GPS e endereço
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    setLocation({ lat, lng });

                    // Reverse geocoding para obter endereço
                    setLoadingAddress(true);
                    try {
                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
                            { headers: { 'User-Agent': 'AGEMS-Fiscalizacao' } }
                        );
                        const data = await response.json();
                        
                        if (data.address) {
                            const endereco = [
                                data.address.road || '',
                                data.address.house_number || '',
                                data.address.suburb || data.address.neighbourhood || '',
                                data.address.city || data.address.town || data.address.village || ''
                            ].filter(Boolean).join(', ');
                            
                            setFormData(prev => ({ ...prev, endereco }));
                        }
                    } catch (err) {
                        console.error('Erro ao obter endereço:', err);
                    } finally {
                        setLoadingAddress(false);
                    }
                },
                () => {}
            );
        }
    }, []);

    const tiposFiltrados = tipos.filter(t => 
        t.servicos_aplicaveis && fiscalizacao?.servico && t.servicos_aplicaveis.includes(fiscalizacao.servico)
    );

    // Mapeamento de siglas por tipo de unidade
    const siglasUnidade = {
        'Atendimento Comercial ao Usuário': 'ACU',
        'Almoxarifado/SSA': 'ALM-SSA',
        'Poço Tubular Profundo': 'PTP',
        'Captação Superficial': 'CAF',
        'Estação de Tratamento de Água': 'ETA',
        'Unidade Dosadora de Cloro': 'UTA',
        'Unidade de Tratamento de Água': 'UTA',
        'Reservatório Apoiado': 'RAP',
        'Reservatório Elevado': 'REL',
        'Reservatório Enterrado': 'REN',
        'Reservatório Semienterrado': 'RES'
    };

    // Gerar código automático quando seleciona tipo
    const handleTipoChange = (tipoId) => {
        const tipo = tipos.find(t => t.id === tipoId);
        if (!tipo) return;

        // Obter sigla do tipo
        const sigla = siglasUnidade[tipo.nome] || tipo.nome.substring(0, 3).toUpperCase();

        // Contar quantas unidades deste tipo já existem
        const unidadesMesmoTipo = unidadesExistentes.filter(u => u.tipo_unidade_id === tipoId);
        const proximoNumero = unidadesMesmoTipo.length + 1;
        const codigo = `${sigla}-${String(proximoNumero).padStart(3, '0')}`;

        // Atualizar form
        setFormData({
            ...formData,
            tipo_unidade_id: tipoId,
            codigo_unidade: codigo,
            nome_unidade: tipo.nome
        });
    };

    const createMutation = useMutation({
        mutationFn: async (data) => {
            const tipo = tipos.find(t => t.id === data.tipo_unidade_id);
            return base44.entities.UnidadeFiscalizada.create({
                ...data,
                fiscalizacao_id: fiscalizacaoId,
                tipo_unidade_nome: tipo?.nome,
                latitude: location?.lat,
                longitude: location?.lng,
                data_hora_vistoria: new Date().toISOString(),
                status: 'em_andamento',
                fotos_unidade: []
            });
        },
        onSuccess: (result) => {
            navigate(createPageUrl('VistoriarUnidade') + `?id=${result.id}`);
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.tipo_unidade_id) {
            alert('Selecione o tipo de unidade');
            return;
        }
        createMutation.mutate(formData);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-blue-900 text-white">
                <div className="max-w-lg mx-auto px-4 py-4">
                    <div className="flex items-center gap-3">
                        <Link to={createPageUrl('ExecutarFiscalizacao') + `?id=${fiscalizacaoId}`}>
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold">Adicionar Unidade</h1>
                            <p className="text-blue-200 text-sm">{fiscalizacao?.municipio_nome} • {fiscalizacao?.servico}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="max-w-lg mx-auto px-4 py-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* GPS */}
                    <Card className={location ? "border-green-200 bg-green-50" : "border-gray-200"}>
                        <CardContent className="p-4 flex items-center gap-3">
                            <Navigation className={`h-5 w-5 ${location ? 'text-green-600' : 'text-gray-400'}`} />
                            <div>
                                <p className="font-medium text-sm">
                                    {location ? 'GPS Capturado' : 'Obtendo GPS...'}
                                </p>
                                {location && (
                                    <p className="text-xs text-gray-500">
                                        {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tipo de Unidade */}
                    <div className="space-y-2">
                        <Label>Tipo de Unidade *</Label>
                        <Select 
                            value={formData.tipo_unidade_id} 
                            onValueChange={handleTipoChange}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo..." />
                            </SelectTrigger>
                            <SelectContent>
                                {tiposFiltrados.map(t => (
                                    <SelectItem key={t.id} value={t.id}>
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-gray-400" />
                                            {t.nome}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {tiposFiltrados.length === 0 && (
                            <p className="text-xs text-yellow-600">
                                Nenhum tipo de unidade cadastrado para o serviço "{fiscalizacao?.servico}".
                                <Link to={createPageUrl('TiposUnidade')} className="text-blue-600 ml-1">
                                    Cadastrar tipos
                                </Link>
                            </p>
                        )}
                    </div>

                    {/* Código */}
                    <div className="space-y-2">
                        <Label>Código/Identificador</Label>
                        <Input
                            value={formData.codigo_unidade}
                            onChange={(e) => setFormData({...formData, codigo_unidade: e.target.value})}
                            placeholder="Ex: ETA-001"
                        />
                    </div>

                    {/* Nome */}
                    <div className="space-y-2">
                        <Label>Nome/Descrição</Label>
                        <Input
                            value={formData.nome_unidade}
                            onChange={(e) => setFormData({...formData, nome_unidade: e.target.value})}
                            placeholder="Ex: ETA Central"
                        />
                    </div>

                    {/* Endereço */}
                    <div className="space-y-2">
                        <Label>Endereço</Label>
                        <Input
                            value={formData.endereco}
                            onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                            placeholder="Rua, número, bairro..."
                            disabled={loadingAddress}
                        />
                        {loadingAddress && (
                            <p className="text-xs text-gray-500">Obtendo endereço do GPS...</p>
                        )}
                    </div>

                    {/* Submit */}
                    <Button 
                        type="submit" 
                        className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                        disabled={createMutation.isPending || !formData.tipo_unidade_id}
                    >
                        {createMutation.isPending ? (
                            <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Criando...
                            </>
                        ) : (
                            'Iniciar Vistoria'
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}