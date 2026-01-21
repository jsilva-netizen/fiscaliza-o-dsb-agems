import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import 'leaflet/dist/leaflet.css';

export default function MapaDistribuicao({ determinacoes, autos, municipios }) {
    // Contar determinações e autos por município
    const distribuicao = {};

    determinacoes.forEach(det => {
        const unidadeFisc = det.unidade_fiscalizada_id;
        // Precisamos do ID do município da unidade, para simplificar vamos usar o primeiro município como centro
        const mun = municipios[0];
        if (mun && !distribuicao[mun.id]) {
            distribuicao[mun.id] = { 
                nome: mun.nome, 
                lat: mun.latitude || -20, 
                lng: mun.longitude || -55,
                determinacoes: 0, 
                autos: 0 
            };
        }
        if (mun) distribuicao[mun.id].determinacoes++;
    });

    autos.forEach(auto => {
        const mun = municipios[0];
        if (mun && distribuicao[mun.id]) {
            distribuicao[mun.id].autos++;
        }
    });

    const dados = Object.values(distribuicao).filter(d => d.lat && d.lng);

    if (dados.length === 0) {
        return (
            <Card>
                <CardContent className="p-6 text-center text-gray-500">
                    Sem dados de localização para exibir no mapa
                </CardContent>
            </Card>
        );
    }

    const centerLat = dados.reduce((sum, d) => sum + d.lat, 0) / dados.length;
    const centerLng = dados.reduce((sum, d) => sum + d.lng, 0) / dados.length;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Distribuição por Município</CardTitle>
            </CardHeader>
            <CardContent>
                <div style={{ height: '400px', width: '100%' }}>
                    <MapContainer 
                        center={[centerLat, centerLng]} 
                        zoom={8} 
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; OpenStreetMap contributors'
                        />
                        {dados.map(d => {
                            const total = d.determinacoes + d.autos;
                            const raio = Math.min(50, 15 + total * 5);
                            const cor = d.autos > 0 ? '#ef4444' : d.determinacoes > 5 ? '#f97316' : '#3b82f6';
                            
                            return (
                                <CircleMarker
                                    key={d.nome}
                                    center={[d.lat, d.lng]}
                                    radius={raio}
                                    fillColor={cor}
                                    fillOpacity={0.7}
                                    weight={2}
                                    color="#fff"
                                >
                                    <Popup>
                                        <div className="text-sm font-semibold">{d.nome}</div>
                                        <div className="text-xs">
                                            Determinações: <strong>{d.determinacoes}</strong>
                                        </div>
                                        <div className="text-xs">
                                            Autos: <strong>{d.autos}</strong>
                                        </div>
                                    </Popup>
                                </CircleMarker>
                            );
                        })}
                    </MapContainer>
                </div>
                <div className="mt-4 text-xs text-gray-600">
                    <p>Azul: até 5 determinações | Laranja: 5+ determinações | Vermelho: com autos de infração</p>
                </div>
            </CardContent>
        </Card>
    );
}