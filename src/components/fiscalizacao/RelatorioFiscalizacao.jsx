import React from 'react';
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';

export default function RelatorioFiscalizacao({ fiscalizacao }) {
    const [isGenerating, setIsGenerating] = React.useState(false);

    const loadImageAsBase64 = async (url) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = reject;
            img.src = url;
        });
    };

    const gerarRelatorio = async () => {
        setIsGenerating(true);
        try {
            // Buscar dados completos
            const unidades = await base44.entities.UnidadeFiscalizada.filter(
                { fiscalizacao_id: fiscalizacao.id }, 
                'created_date', 
                100
            );

            const todasRespostas = await Promise.all(
                unidades.map(u => 
                    base44.entities.RespostaChecklist.filter({ unidade_fiscalizada_id: u.id }, 'id', 500)
                )
            );

            const todasNcs = await Promise.all(
                unidades.map(u => 
                    base44.entities.NaoConformidade.filter({ unidade_fiscalizada_id: u.id }, 'id', 200)
                )
            );

            const todasDeterminacoes = await Promise.all(
                unidades.map(u => 
                    base44.entities.Determinacao.filter({ unidade_fiscalizada_id: u.id }, 'id', 200)
                )
            );

            const todasRecomendacoes = await Promise.all(
                unidades.map(u => 
                    base44.entities.Recomendacao.filter({ unidade_fiscalizada_id: u.id }, 'id', 200)
                )
            );

            const todasFotos = await Promise.all(
                unidades.map(u => 
                    base44.entities.FotoEvidencia.filter({ unidade_fiscalizada_id: u.id, tipo: 'unidade' }, 'created_date', 100)
                )
            );

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            let yPos = margin;

            const tableWidth = pageWidth - 2 * margin;
            const rowHeight = 7;
            
            // Desenhar célula
            const drawCell = (text, x, y, width, height, bold = false, center = false, fillColor = null) => {
                if (fillColor) {
                    pdf.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
                    pdf.rect(x, y, width, height, 'F');
                }
                pdf.setDrawColor(0);
                pdf.rect(x, y, width, height, 'S');
                
                pdf.setFont('helvetica', bold ? 'bold' : 'normal');
                const textY = y + height / 2 + 1.5;
                if (center) {
                    pdf.text(text, x + width / 2, textY, { align: 'center' });
                } else {
                    pdf.text(text, x + 2, textY);
                }
            };

            // Para cada unidade
            for (let idx = 0; idx < unidades.length; idx++) {
                const unidade = unidades[idx];
                const respostas = todasRespostas[idx] || [];
                const ncs = todasNcs[idx] || [];
                const determinacoes = todasDeterminacoes[idx] || [];
                const recomendacoes = todasRecomendacoes[idx] || [];
                const fotos = todasFotos[idx] || [];

                // Nova página para cada unidade
                if (idx > 0) {
                    pdf.addPage();
                }
                yPos = margin;

                pdf.setFontSize(9);

                // Cabeçalho - TIPO DE UNIDADE
                pdf.setFillColor(192, 192, 192);
                pdf.rect(margin, yPos, tableWidth, rowHeight, 'F');
                pdf.setDrawColor(0);
                pdf.rect(margin, yPos, tableWidth, rowHeight, 'S');
                pdf.setFontSize(11);
                pdf.setFont('helvetica', 'bold');
                pdf.text(unidade.tipo_unidade_nome.toUpperCase(), pageWidth / 2, yPos + 4.5, { align: 'center' });
                yPos += rowHeight;

                // ID Unidade
                pdf.setFontSize(9);
                drawCell(`ID Unidade: ${unidade.codigo_unidade || unidade.nome_unidade || '-'}`, margin, yPos, tableWidth, rowHeight, true);
                yPos += rowHeight;

                // Localização
                drawCell(`Localização: ${unidade.endereco || '-'}`, margin, yPos, tableWidth, rowHeight, true);
                yPos += rowHeight;

                // Constatações - Header
                drawCell('Constatações', margin, yPos, tableWidth, rowHeight, true, true, [192, 192, 192]);
                yPos += rowHeight;

                const constatacoes = respostas.filter(r => r.resposta === 'SIM' || r.resposta === 'NA');
                constatacoes.forEach((resp, i) => {
                    const texto = `C${i + 1}. ${resp.pergunta}${resp.observacao ? ` - ${resp.observacao}` : ''}`;
                    const lines = pdf.splitTextToSize(texto, tableWidth - 4);
                    const cellHeight = Math.max(rowHeight, lines.length * 4 + 2);
                    
                    // Check page break
                    if (yPos + cellHeight > pageHeight - margin) {
                        pdf.addPage();
                        yPos = margin;
                    }
                    
                    pdf.rect(margin, yPos, tableWidth, cellHeight, 'S');
                    pdf.setFont('helvetica', 'bold');
                    pdf.text(`C${i + 1}.`, margin + 2, yPos + 5);
                    pdf.setFont('helvetica', 'normal');
                    const restText = texto.substring(texto.indexOf('.') + 2);
                    const restLines = pdf.splitTextToSize(restText, tableWidth - 15);
                    pdf.text(restLines, margin + 12, yPos + 5);
                    
                    yPos += cellHeight;
                });

                // Não Conformidades
                if (ncs.length > 0) {
                    if (yPos + rowHeight > pageHeight - margin) {
                        pdf.addPage();
                        yPos = margin;
                    }
                    drawCell('Não Conformidade', margin, yPos, tableWidth, rowHeight, true, true, [192, 192, 192]);
                    yPos += rowHeight;

                    ncs.forEach((nc) => {
                        const texto = `${nc.numero_nc}. ${nc.descricao}${nc.artigo_portaria ? ` (${nc.artigo_portaria})` : ''}`;
                        const lines = pdf.splitTextToSize(texto, tableWidth - 4);
                        const cellHeight = Math.max(rowHeight, lines.length * 4 + 2);
                        
                        if (yPos + cellHeight > pageHeight - margin) {
                            pdf.addPage();
                            yPos = margin;
                        }
                        
                        pdf.rect(margin, yPos, tableWidth, cellHeight, 'S');
                        pdf.setFont('helvetica', 'bold');
                        pdf.text(nc.numero_nc + '.', margin + 2, yPos + 5);
                        pdf.setFont('helvetica', 'normal');
                        const restText = texto.substring(texto.indexOf('.') + 2);
                        const restLines = pdf.splitTextToSize(restText, tableWidth - 15);
                        pdf.text(restLines, margin + 12, yPos + 5);
                        
                        yPos += cellHeight;
                    });
                }

                // Recomendações
                if (recomendacoes.length > 0) {
                    if (yPos + rowHeight > pageHeight - margin) {
                        pdf.addPage();
                        yPos = margin;
                    }
                    drawCell('Recomendações', margin, yPos, tableWidth, rowHeight, true, true, [192, 192, 192]);
                    yPos += rowHeight;

                    recomendacoes.forEach((rec) => {
                        const texto = `${rec.numero_recomendacao}. ${rec.descricao}`;
                        const lines = pdf.splitTextToSize(texto, tableWidth - 4);
                        const cellHeight = Math.max(rowHeight, lines.length * 4 + 2);
                        
                        if (yPos + cellHeight > pageHeight - margin) {
                            pdf.addPage();
                            yPos = margin;
                        }
                        
                        pdf.rect(margin, yPos, tableWidth, cellHeight, 'S');
                        pdf.setFont('helvetica', 'bold');
                        pdf.text(rec.numero_recomendacao + '.', margin + 2, yPos + 5);
                        pdf.setFont('helvetica', 'normal');
                        const restText = texto.substring(texto.indexOf('.') + 2);
                        const restLines = pdf.splitTextToSize(restText, tableWidth - 15);
                        pdf.text(restLines, margin + 12, yPos + 5);
                        
                        yPos += cellHeight;
                    });
                }

                // Determinações
                if (determinacoes.length > 0) {
                    if (yPos + rowHeight > pageHeight - margin) {
                        pdf.addPage();
                        yPos = margin;
                    }
                    drawCell('Determinações', margin, yPos, tableWidth, rowHeight, true, true, [192, 192, 192]);
                    yPos += rowHeight;

                    determinacoes.forEach((det) => {
                        const texto = `${det.numero_determinacao}. ${det.descricao} Prazo: ${det.prazo_dias} dias.`;
                        const lines = pdf.splitTextToSize(texto, tableWidth - 4);
                        const cellHeight = Math.max(rowHeight, lines.length * 4 + 2);
                        
                        if (yPos + cellHeight > pageHeight - margin) {
                            pdf.addPage();
                            yPos = margin;
                        }
                        
                        pdf.rect(margin, yPos, tableWidth, cellHeight, 'S');
                        pdf.setFont('helvetica', 'bold');
                        pdf.text(det.numero_determinacao + '.', margin + 2, yPos + 5);
                        pdf.setFont('helvetica', 'normal');
                        const restText = texto.substring(texto.indexOf('.') + 2);
                        const restLines = pdf.splitTextToSize(restText, tableWidth - 15);
                        pdf.text(restLines, margin + 12, yPos + 5);
                        
                        yPos += cellHeight;
                    });
                }

                // Registros Fotográficos
                if (fotos.length > 0) {
                    if (yPos + rowHeight > pageHeight - margin) {
                        pdf.addPage();
                        yPos = margin;
                    }
                    drawCell('Registros Fotográficos', margin, yPos, tableWidth, rowHeight, true, true, [192, 192, 192]);
                    yPos += rowHeight;

                    // Converter todas as imagens para base64 primeiro
                    const fotosBase64 = [];
                    for (const foto of fotos) {
                        try {
                            const base64 = await loadImageAsBase64(foto.url);
                            fotosBase64.push({ ...foto, base64 });
                        } catch (err) {
                            console.error('Erro ao carregar imagem:', err);
                        }
                    }

                    // Adicionar fotos em grid 2x2 dentro da tabela
                    const cellPadding = 2;
                    const imgCellWidth = (tableWidth - cellPadding) / 2;
                    const imgWidth = imgCellWidth - 4;
                    const imgHeight = 70;
                    const captionHeight = 8;
                    const totalCellHeight = imgHeight + captionHeight;

                    for (let i = 0; i < fotosBase64.length; i += 2) {
                        // Verificar se precisa de nova página
                        if (yPos + totalCellHeight + 10 > pageHeight - margin) {
                            pdf.addPage();
                            yPos = margin;
                        }

                        // Desenhar células do grid 2x2
                        const leftX = margin;
                        const rightX = margin + imgCellWidth;

                        // Célula esquerda
                        pdf.rect(leftX, yPos, imgCellWidth, totalCellHeight, 'S');
                        if (fotosBase64[i]?.base64) {
                            try {
                                pdf.addImage(fotosBase64[i].base64, 'JPEG', leftX + 2, yPos + 2, imgWidth, imgHeight);
                                pdf.setFontSize(8);
                                pdf.setFont('helvetica', 'normal');
                                const legenda = fotosBase64[i].legenda || `Figura ${i + 1}`;
                                pdf.text(legenda, leftX + imgCellWidth / 2, yPos + imgHeight + 6, { align: 'center' });
                            } catch (err) {
                                console.error('Erro ao adicionar foto:', err);
                            }
                        }

                        // Célula direita
                        pdf.rect(rightX, yPos, imgCellWidth, totalCellHeight, 'S');
                        if (fotosBase64[i + 1]?.base64) {
                            try {
                                pdf.addImage(fotosBase64[i + 1].base64, 'JPEG', rightX + 2, yPos + 2, imgWidth, imgHeight);
                                pdf.setFontSize(8);
                                pdf.setFont('helvetica', 'normal');
                                const legenda = fotosBase64[i + 1].legenda || `Figura ${i + 2}`;
                                pdf.text(legenda, rightX + imgCellWidth / 2, yPos + imgHeight + 6, { align: 'center' });
                            } catch (err) {
                                console.error('Erro ao adicionar foto:', err);
                            }
                        }

                        yPos += totalCellHeight;
                    }
                }
            }

            // Salvar
            const nomeArquivo = `Relatorio_Fiscalizacao_${fiscalizacao.municipio_nome}_${format(new Date(), 'yyyyMMdd-HHmmss')}.pdf`;
            pdf.save(nomeArquivo);

        } catch (err) {
            console.error('Erro ao gerar relatório:', err);
            alert('Erro ao gerar relatório. Tente novamente.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Button 
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                gerarRelatorio();
            }}
            disabled={isGenerating}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="sm"
        >
            {isGenerating ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Gerando...
                </>
            ) : (
                <>
                    <FileText className="h-4 w-4 mr-2" />
                    Gerar Relatório
                </>
            )}
        </Button>
    );
}