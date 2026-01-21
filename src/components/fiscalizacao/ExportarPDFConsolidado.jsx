import React from 'react';
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ExportarPDFConsolidado({ fiscalizacoes }) {
    const [isGenerating, setIsGenerating] = React.useState(false);

    const gerarPDF = async () => {
        setIsGenerating(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            let yPos = margin;

            // Capa
            pdf.setFontSize(24);
            pdf.setFont('helvetica', 'bold');
            pdf.text('RELATÓRIO CONSOLIDADO', pageWidth / 2, 40, { align: 'center' });
            pdf.setFontSize(16);
            pdf.text('FISCALIZAÇÕES AGEMS', pageWidth / 2, 50, { align: 'center' });
            
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 60, { align: 'center' });
            pdf.text(`Total de Fiscalizações: ${fiscalizacoes.length}`, pageWidth / 2, 68, { align: 'center' });

            // Nova página para dados
            pdf.addPage();
            yPos = margin;

            for (let i = 0; i < fiscalizacoes.length; i++) {
                const fisc = fiscalizacoes[i];
                
                // Verificar espaço
                if (yPos > pageHeight - 40) {
                    pdf.addPage();
                    yPos = margin;
                }

                // Header da Fiscalização
                pdf.setFillColor(189, 214, 238);
                pdf.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text(`${i + 1}. ${fisc.municipio_nome} - ${fisc.servico}`, margin + 3, yPos + 6);
                yPos += 12;

                // Informações básicas
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Status: ${fisc.status === 'finalizada' ? 'Finalizada' : 'Em andamento'}`, margin, yPos);
                yPos += 5;
                pdf.text(`Data: ${format(new Date(fisc.data_inicio), 'dd/MM/yyyy HH:mm')}`, margin, yPos);
                yPos += 5;
                if (fisc.fiscal_nome) {
                    pdf.text(`Fiscal: ${fisc.fiscal_nome}`, margin, yPos);
                    yPos += 5;
                }

                // Buscar unidades
                const unidades = await base44.entities.UnidadeFiscalizada.filter({ 
                    fiscalizacao_id: fisc.id 
                });

                if (unidades.length > 0) {
                    yPos += 3;
                    pdf.setFont('helvetica', 'bold');
                    pdf.text(`Unidades Vistoriadas: ${unidades.length}`, margin + 5, yPos);
                    yPos += 5;

                    let totalNCs = 0;
                    let totalDets = 0;
                    let totalRecs = 0;

                    for (const unidade of unidades) {
                        const ncs = await base44.entities.NaoConformidade.filter({ 
                            unidade_fiscalizada_id: unidade.id 
                        });
                        const dets = await base44.entities.Determinacao.filter({ 
                            unidade_fiscalizada_id: unidade.id 
                        });
                        const recs = await base44.entities.Recomendacao.filter({ 
                            unidade_fiscalizada_id: unidade.id 
                        });

                        totalNCs += ncs.length;
                        totalDets += dets.length;
                        totalRecs += recs.length;

                        // Verificar espaço
                        if (yPos > pageHeight - 20) {
                            pdf.addPage();
                            yPos = margin;
                        }

                        pdf.setFont('helvetica', 'normal');
                        pdf.text(`• ${unidade.tipo_unidade_nome}${unidade.codigo_unidade ? ` (${unidade.codigo_unidade})` : ''}`, margin + 10, yPos);
                        yPos += 4;
                        pdf.setFontSize(8);
                        pdf.text(`  NCs: ${ncs.length} | Determinações: ${dets.length} | Recomendações: ${recs.length}`, margin + 10, yPos);
                        pdf.setFontSize(9);
                        yPos += 6;
                    }

                    // Totais
                    yPos += 2;
                    pdf.setFont('helvetica', 'bold');
                    pdf.text(`TOTAIS: NCs: ${totalNCs} | Determinações: ${totalDets} | Recomendações: ${totalRecs}`, margin + 5, yPos);
                    yPos += 8;
                } else {
                    pdf.text('Nenhuma unidade vistoriada', margin + 5, yPos);
                    yPos += 8;
                }
            }

            // Salvar
            pdf.save(`relatorio_consolidado_${format(new Date(), 'yyyyMMdd-HHmmss')}.pdf`);
        } catch (err) {
            console.error('Erro ao gerar PDF:', err);
            alert('Erro ao gerar PDF consolidado. Tente novamente.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Button 
            onClick={gerarPDF}
            disabled={isGenerating || fiscalizacoes.length === 0}
            variant="outline"
            className="flex-1"
        >
            {isGenerating ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Gerando...
                </>
            ) : (
                <>
                    <FileText className="h-4 w-4 mr-2" />
                    PDF Consolidado
                </>
            )}
        </Button>
    );
}