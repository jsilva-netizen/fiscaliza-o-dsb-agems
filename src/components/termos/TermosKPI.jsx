import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Clock, AlertCircle } from 'lucide-react';

export default function TermosKPI({ termos }) {
  const pendenteTNAssinado = termos.filter(t => !t.arquivo_url).length;
  const pendenteProtocolo = termos.filter(t => t.arquivo_url && (!t.data_protocolo || !t.arquivo_protocolo_url)).length;
  const ativos = termos.filter(t => t.arquivo_url && t.data_protocolo && t.arquivo_protocolo_url && !t.data_recebimento_resposta).length;

  const verificaPrazoVencido = (termo) => {
      if (!termo.data_maxima_resposta) return false;
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataMax = new Date(termo.data_maxima_resposta);
      dataMax.setHours(0, 0, 0, 0);
      return hoje > dataMax;
  };

  const prazoVencido = termos.filter(t => t.arquivo_url && t.data_protocolo && t.arquivo_protocolo_url && !t.data_recebimento_resposta && verificaPrazoVencido(t)).length;
  const respondidos = termos.filter(t => t.data_recebimento_resposta).length;
  const total = termos.length;

  const kpis = [
    { label: 'Total de TNs', value: total, color: 'bg-blue-50', textColor: 'text-blue-600', icon: FileText },
    { label: 'Pendente TN Assinado', value: pendenteTNAssinado, color: 'bg-yellow-50', textColor: 'text-yellow-600', icon: AlertCircle },
    { label: 'Pendente Protocolo', value: pendenteProtocolo, color: 'bg-orange-50', textColor: 'text-orange-600', icon: Clock },
    { label: 'Ativos', value: ativos, color: 'bg-green-50', textColor: 'text-green-600', icon: FileText },
    { label: 'Prazo Vencido', value: prazoVencido, color: 'bg-red-50', textColor: 'text-red-600', icon: AlertCircle },
    { label: 'Respondidos', value: respondidos, color: 'bg-purple-50', textColor: 'text-purple-600', icon: FileText },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon;
        return (
          <Card key={idx} className={`${kpi.color}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${kpi.textColor}`} />
                <span className="text-xs font-medium text-gray-600">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-bold ${kpi.textColor}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}