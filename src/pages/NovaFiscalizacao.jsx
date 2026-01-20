import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import OfflineIndicator from '@/components/OfflineIndicator';
import SyncManager from '@/components/offline/SyncManager';
import { addPendingOperation } from '@/components/offline/offlineStorage';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MapPin, Loader2, Navigation, AlertCircle } from 'lucide-react';

const SERVICOS = ['Água', 'Esgoto', 'Resíduos', 'Limpeza Urbana', 'Drenagem'];

export default function NovaFiscalizacao() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        municipio_id: '',
        servico: ''
    });
    const [location, setLocation] = useState(null);
    const [locationError, setLocationError] = useState(null);
    const [gettingLocation, setGettingLocation] = useState(false);
    const [user, setUser] = useState(null);

    const { data: municipios = [], isLoading: loadingMunicipios } = useQuery({
        queryKey: ['municipios'],
        queryFn: () => base44.entities.Municipio.list('nome', 100)
    });

    useEffect(() => {
        const loadUser = async () => {
            const u = await base44.auth.me();
            setUser(u);
        };
        loadUser();
    }, []);

    const getLocation = () => {
        setGettingLocation(true);
        setLocationError(null);
        
        if (!navigator.geolocation) {
            setLocationError('Geolocalização não suportada');
            setGettingLocation(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                });
                setGettingLocation(false);
            },
            (err) => {
                setLocationError('Não foi possível obter localização. Verifique as permissões.');
                setGettingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    useEffect(() => {
        getLocation();
    }, []);

    const createMutation = useMutation({
        mutationFn: async (data) => {
            const municipio = municipios.find(m => m.id === data.municipio_id);
            const fiscalizacaoData = {
                ...data,
                municipio_nome: municipio?.nome,
                fiscal_nome: user?.full_name || 'Fiscal',
                fiscal_email: user?.email,
                data_inicio: new Date().toISOString(),
                latitude_inicio: location?.lat,
                longitude_inicio: location?.lng,
                status: 'em_andamento'
            };

            // Suporte offline
            if (!navigator.onLine) {
                await addPendingOperation({
                    operation: 'create',
                    entity: 'Fiscalizacao',
                    data: fiscalizacaoData,
                    priority: 10
                });
                // Retorna ID temporário para navegação
                return { id: 'temp_' + Date.now() };
            }

            return base44.entities.Fiscalizacao.create(fiscalizacaoData);
        },
        onSuccess: (result) => {
            navigate(createPageUrl('ExecutarFiscalizacao') + `?id=${result.id}`);
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.municipio_id || !formData.servico) {
            alert('Preencha todos os campos obrigatórios');
            return;
        }
        createMutation.mutate(formData);
    };

    const municipioSelecionado = municipios.find(m => m.id === formData.municipio_id);

    return (
        <SyncManager>
            <OfflineIndicator />
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
            <div className="bg-green-600 text-white">
                <div className="max-w-lg mx-auto px-4 py-4">
                    <div className="flex items-center gap-3">
                        <Link to={createPageUrl('Home')}>
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold">Nova Fiscalização</h1>
                            <p className="text-green-100 text-sm">Configure os dados iniciais</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="max-w-lg mx-auto px-4 py-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* GPS Status */}
                    <Card className={location ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${location ? 'bg-green-500' : 'bg-yellow-500'}`}>
                                        {gettingLocation ? (
                                            <Loader2 className="h-5 w-5 text-white animate-spin" />
                                        ) : (
                                            <Navigation className="h-5 w-5 text-white" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium">
                                            {gettingLocation ? 'Obtendo GPS...' : location ? 'GPS Capturado' : 'GPS Pendente'}
                                        </p>
                                        {location && (
                                            <p className="text-xs text-gray-500">
                                                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                                            </p>
                                        )}
                                        {locationError && (
                                            <p className="text-xs text-red-600">{locationError}</p>
                                        )}
                                    </div>
                                </div>
                                {!location && !gettingLocation && (
                                    <Button type="button" size="sm" variant="outline" onClick={getLocation}>
                                        Tentar novamente
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Município */}
                    <div className="space-y-2">
                        <Label>Município *</Label>
                        <Select 
                            value={formData.municipio_id} 
                            onValueChange={(v) => setFormData({...formData, municipio_id: v})}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o município..." />
                            </SelectTrigger>
                            <SelectContent>
                                {municipios.map(m => (
                                    <SelectItem key={m.id} value={m.id}>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-gray-400" />
                                            {m.nome}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Serviço */}
                    <div className="space-y-2">
                        <Label>Serviço *</Label>
                        <Select 
                            value={formData.servico} 
                            onValueChange={(v) => setFormData({...formData, servico: v})}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o serviço..." />
                            </SelectTrigger>
                            <SelectContent>
                                {SERVICOS.map(s => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Fiscal Info */}
                    {user && (
                        <Card className="bg-blue-50 border-blue-200">
                            <CardContent className="p-4">
                                <p className="text-sm text-blue-800">
                                    <strong>Fiscal:</strong> {user.full_name}
                                </p>
                                <p className="text-xs text-blue-600">{user.email}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Submit */}
                    <Button 
                        type="submit" 
                        className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                        disabled={createMutation.isPending || !formData.municipio_id || !formData.servico}
                    >
                        {createMutation.isPending ? (
                            <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Criando...
                            </>
                        ) : (
                            'Iniciar Fiscalização'
                        )}
                    </Button>
                </form>
            </div>
        </SyncManager>
    );
}