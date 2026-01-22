import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ChartEvolucaoStatus({ determinacoes, respostas }) {
    // Contar status atual
    const pendentes = determinacoes.filter(d => d.status === 'pendente').length;
    const atendidas = respostas.filter(r => r.status === 'atendida').length;
    const naoAtendidas = respostas.filter(r => r.status === 'nao_atendida').length;

    const dados = [
        { nome: 'Pendentes', quantidade: pendentes, fill: '#f97316' },
        { nome: 'Atendidas', quantidade: atendidas, fill: '#22c55e' },
        { nome: 'Não Atendidas', quantidade: naoAtendidas, fill: '#ef4444' }
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Evolução de Status</CardTitle>
            </CardHeader>
            <CardContent>
                {determinacoes.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">Sem dados</div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={dados}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="nome" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="quantidade" />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}