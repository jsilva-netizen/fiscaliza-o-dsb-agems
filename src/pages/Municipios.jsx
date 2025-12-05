import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, MapPin } from 'lucide-react';

export default function Municipios() {
    const [search, setSearch] = React.useState('');

    const { data: municipios = [], isLoading } = useQuery({
        queryKey: ['municipios'],
        queryFn: () => base44.entities.Municipio.list('nome', 100)
    });

    const filteredMunicipios = municipios.filter(m => 
        m.nome.toLowerCase().includes(search.toLowerCase()) ||
        m.codigo_ibge?.includes(search)
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-blue-900 text-white">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-3">
                        <Link to={createPageUrl('Home')}>
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold">Municípios do MS</h1>
                            <p className="text-blue-200 text-sm">{municipios.length} municípios cadastrados</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="max-w-4xl mx-auto px-4 py-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Buscar município ou código IBGE..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* List */}
            <div className="max-w-4xl mx-auto px-4 pb-8">
                {isLoading ? (
                    <div className="text-center py-8 text-gray-500">Carregando...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {filteredMunicipios.map((municipio) => (
                            <Card key={municipio.id} className="hover:bg-gray-50">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                        <MapPin className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-medium">{municipio.nome}</h3>
                                        <p className="text-xs text-gray-500">IBGE: {municipio.codigo_ibge}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {!isLoading && filteredMunicipios.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        Nenhum município encontrado
                    </div>
                )}
            </div>
        </div>
    );
}