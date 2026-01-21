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

    const addTimbradoToPage = (pdf, timbradoBase64) => {
        try {
            if (timbradoBase64) {
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                pdf.addImage(timbradoBase64, 'JPEG', 0, 0, pageWidth, pageHeight);
            }
        } catch (err) {
            console.error('Erro ao adicionar timbrado:', err);
        }
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

            // Fotos já estão no campo fotos_unidade
            const todasFotos = unidades.map(u => u.fotos_unidade || []);

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const topMargin = 35;
            const bottomMargin = 25;
            let yPos = topMargin;

            // Carregar timbrado uma vez
            let timbradoBase64 = null;
            try {
                const timbradoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69331445067a2821c02acff8/4fe7a4846_timbrado.pdf';
                timbradoBase64 = await loadImageAsBase64(timbradoUrl);
            } catch (err) {
                console.error('Erro ao carregar timbrado:', err);
            }

            // Cabeçalho azul com título
            pdf.setFillColor(25, 75, 145); // Azul
            pdf.rect(0, 0, pageWidth, 40, 'F');
            
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(20);
            pdf.setFont('helvetica', 'bold');
            pdf.text('RELATÓRIO DE FISCALIZAÇÃO', pageWidth / 2, 15, { align: 'center' });
            
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'normal');
            pdf.text(fiscalizacao.municipio_nome, pageWidth / 2, 25, { align: 'center' });
            pdf.text(fiscalizacao.servicos.join(', '), pageWidth / 2, 33, { align: 'center' });

            pdf.setTextColor(0, 0, 0);
            yPos = 45;

            // Informações da Fiscalização
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text('INFORMAÇÕES DA FISCALIZAÇÃO', margin, yPos);
            yPos += 7;

            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Município: ${fiscalizacao.municipio_nome}`, margin + 2, yPos);
            yPos += 6;
            pdf.text(`Prestador de Serviços: ${fiscalizacao.prestador_servico_nome}`, margin + 2, yPos);
            yPos += 6;
            const servicoLabel = fiscalizacao.servicos.length > 1 ? 'Serviços' : 'Serviço';
            pdf.text(`${servicoLabel}: ${fiscalizacao.servicos.join(', ')}`, margin + 2, yPos);
            yPos += 6;
            pdf.text(`Data Início: ${format(new Date(fiscalizacao.data_inicio), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, margin + 2, yPos);
            yPos += 6;
            if (fiscalizacao.data_fim) {
                pdf.text(`Data Fim: ${format(new Date(fiscalizacao.data_fim), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, margin + 2, yPos);
                yPos += 6;
            }
            if (fiscalizacao.fiscal_nome) {
                pdf.text(`Fiscal: ${fiscalizacao.fiscal_nome}`, margin + 2, yPos);
                yPos += 6;
            }
            yPos += 8;

            // Resumo Executivo
            yPos += 6;
            pdf.setFillColor(25, 75, 145); // Azul
            pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
            pdf.setDrawColor(0);
            pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, 'S');
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(255, 255, 255);
            pdf.text('RESUMO EXECUTIVO', margin + 2, yPos + 5.5);
            pdf.setTextColor(0, 0, 0);
            yPos += 10;

            // Calcular totais reais
            const totalConstatacoes = todasRespostas.flat().filter(r => r.resposta === 'SIM' || r.resposta === 'NAO').length;
            const totalNCs = todasNcs.flat().length;
            const totalDeterminacoes = todasDeterminacoes.flat().length;
            const totalRecomendacoes = todasRecomendacoes.flat().length;

            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`• Unidades Vistoriadas: ${unidades.length}`, margin + 2, yPos);
            yPos += 6;
            pdf.text(`• Total de Constatações: ${totalConstatacoes}`, margin + 2, yPos);
            yPos += 6;
            pdf.text(`• Total de Não Conformidades: ${totalNCs}`, margin + 2, yPos);
            yPos += 6;
            pdf.text(`• Total de Recomendações: ${totalRecomendacoes}`, margin + 2, yPos);
            yPos += 6;
            pdf.text(`• Total de Determinações: ${totalDeterminacoes}`, margin + 2, yPos);

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

            // Calcular offset global de figuras
            let offsetGlobalFiguras = 0;

            // Para cada unidade
            for (let idx = 0; idx < unidades.length; idx++) {
                const unidade = unidades[idx];
                const respostas = todasRespostas[idx] || [];
                const ncs = todasNcs[idx] || [];
                const determinacoes = todasDeterminacoes[idx] || [];
                const recomendacoes = todasRecomendacoes[idx] || [];
                const fotos = todasFotos[idx] || [];

                // Nova página para cada unidade
                pdf.addPage();
                addTimbradoToPage(pdf, timbradoBase64);
                yPos = topMargin;

                pdf.setFontSize(9);

                // Cabeçalho - TIPO DE UNIDADE
                pdf.setFillColor(189, 214, 238);
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

                // Localidade
                drawCell(`Localidade: ${fiscalizacao.municipio_nome}`, margin, yPos, tableWidth, rowHeight, true);
                yPos += rowHeight;

                // Endereço
                drawCell(`Endereço: ${unidade.endereco || '-'}`, margin, yPos, tableWidth, rowHeight, true);
                yPos += rowHeight;

                // Constatações - Header
                drawCell('Constatações', margin, yPos, tableWidth, rowHeight, true, true, [189, 214, 238]);
                yPos += rowHeight;

                const constatacoes = respostas.filter(r => r.resposta === 'SIM' || r.resposta === 'NAO').sort((a, b) => {
                    const numA = parseInt(a.numero_constatacao?.replace('C', '') || '999');
                    const numB = parseInt(b.numero_constatacao?.replace('C', '') || '999');
                    return numA - numB;
                });
                
                constatacoes.forEach((resp, i) => {
                    const numConst = resp.numero_constatacao || `C${i + 1}`;
                    const textoConstatacao = resp.pergunta;
                    const texto = `${textoConstatacao}${resp.observacao ? ` Observação: ${resp.observacao}` : ''}`;
                    const restLines = pdf.splitTextToSize(texto, tableWidth - 15);
                    const cellHeight = Math.max(rowHeight, restLines.length * 5 + 4);

                    // Check page break
                    if (yPos + cellHeight > pageHeight - bottomMargin) {
                        pdf.addPage();
                        addTimbradoToPage(pdf, timbradoBase64);
                        yPos = topMargin;
                    }

                    pdf.rect(margin, yPos, tableWidth, cellHeight, 'S');
                    pdf.setFont('helvetica', 'bold');
                    pdf.text(numConst + '.', margin + 2, yPos + 5);
                    pdf.setFont('helvetica', 'normal');
                    pdf.text(restLines, margin + 12, yPos + 5);

                    yPos += cellHeight;
                });

                // Não Conformidades
                if (yPos + rowHeight > pageHeight - bottomMargin) {
                    pdf.addPage();
                    addTimbradoToPage(pdf, timbradoBase64);
                    yPos = topMargin;
                }
                drawCell('Não Conformidades', margin, yPos, tableWidth, rowHeight, true, true, [189, 214, 238]);
                yPos += rowHeight;

                if (ncs.length > 0) {
                    const ncsSorted = [...ncs].sort((a, b) => {
                        const numA = parseInt(a.numero_nc?.replace('NC', '') || '999');
                        const numB = parseInt(b.numero_nc?.replace('NC', '') || '999');
                        return numA - numB;
                    });

                    ncsSorted.forEach((nc) => {
                        // Encontrar resposta relacionada para pegar número da constatação
                        const respostaRelacionada = respostas.find(r => r.id === nc.resposta_checklist_id);
                        const numConstatacao = respostaRelacionada?.numero_constatacao || '';
                        
                        // Adicionar número da constatação na descrição
                        const descricaoCompleta = numConstatacao 
                            ? `A Constatação ${numConstatacao} não cumpre o disposto no ${nc.artigo_portaria || 'artigo'};`
                            : nc.descricao;
                        
                        const restLines = pdf.splitTextToSize(descricaoCompleta, tableWidth - 15);
                        const cellHeight = Math.max(rowHeight, restLines.length * 5 + 4);

                        if (yPos + cellHeight > pageHeight - bottomMargin) {
                            pdf.addPage();
                            addTimbradoToPage(pdf, timbradoBase64);
                            yPos = topMargin;
                        }

                        pdf.rect(margin, yPos, tableWidth, cellHeight, 'S');
                        pdf.setFont('helvetica', 'bold');
                        pdf.text(nc.numero_nc + '.', margin + 2, yPos + 5);
                        pdf.setFont('helvetica', 'normal');
                        pdf.text(restLines, margin + 12, yPos + 5);

                        yPos += cellHeight;
                    });
                } else {
                    const cellHeight = rowHeight;
                    pdf.rect(margin, yPos, tableWidth, cellHeight, 'S');
                    pdf.setFont('helvetica', 'normal');
                    pdf.text('Não se aplica.', margin + 12, yPos + 4.5);
                    yPos += cellHeight;
                }

                // Recomendações
                if (recomendacoes.length > 0) {
                    const recsSorted = [...recomendacoes].sort((a, b) => {
                        const numA = parseInt(a.numero_recomendacao?.replace('R', '') || '999');
                        const numB = parseInt(b.numero_recomendacao?.replace('R', '') || '999');
                        return numA - numB;
                    });
                    
                    if (yPos + rowHeight > pageHeight - bottomMargin) {
                        pdf.addPage();
                        addTimbradoToPage(pdf, timbradoBase64);
                        yPos = topMargin;
                    }
                    drawCell('Recomendações', margin, yPos, tableWidth, rowHeight, true, true, [189, 214, 238]);
                    yPos += rowHeight;

                    recsSorted.forEach((rec) => {
                         const descricaoComPonto = rec.descricao.endsWith('.') ? rec.descricao : rec.descricao + '.';
                         const restLines = pdf.splitTextToSize(descricaoComPonto, tableWidth - 15);
                         const cellHeight = Math.max(rowHeight, restLines.length * 5 + 4);

                         if (yPos + cellHeight > pageHeight - bottomMargin) {
                             pdf.addPage();
                             addTimbradoToPage(pdf, timbradoBase64);
                             yPos = topMargin;
                         }

                         pdf.rect(margin, yPos, tableWidth, cellHeight, 'S');
                         pdf.setFont('helvetica', 'bold');
                         pdf.text(rec.numero_recomendacao + '.', margin + 2, yPos + 5);
                         pdf.setFont('helvetica', 'normal');
                         pdf.text(restLines, margin + 12, yPos + 5);

                         yPos += cellHeight;
                     });
                }

                // Determinações
                if (yPos + rowHeight > pageHeight - bottomMargin) {
                    pdf.addPage();
                    addTimbradoToPage(pdf, timbradoBase64);
                    yPos = topMargin;
                }
                drawCell('Determinações', margin, yPos, tableWidth, rowHeight, true, true, [189, 214, 238]);
                yPos += rowHeight;

                if (determinacoes.length > 0) {
                    const detsSorted = [...determinacoes].sort((a, b) => {
                        const numA = parseInt(a.numero_determinacao?.replace('D', '') || '999');
                        const numB = parseInt(b.numero_determinacao?.replace('D', '') || '999');
                        return numA - numB;
                    });

                    detsSorted.forEach((det) => {
                        const texto = `${det.descricao} Prazo: ${det.prazo_dias} dias.`;
                        const restLines = pdf.splitTextToSize(texto, tableWidth - 15);
                        const cellHeight = Math.max(rowHeight, restLines.length * 5 + 4);

                        if (yPos + cellHeight > pageHeight - bottomMargin) {
                            pdf.addPage();
                            addTimbradoToPage(pdf, timbradoBase64);
                            yPos = topMargin;
                        }

                        pdf.rect(margin, yPos, tableWidth, cellHeight, 'S');
                        pdf.setFont('helvetica', 'bold');
                        pdf.text(det.numero_determinacao + '.', margin + 2, yPos + 5);
                        pdf.setFont('helvetica', 'normal');
                        pdf.text(restLines, margin + 12, yPos + 5);

                        yPos += cellHeight;
                    });
                } else {
                    const cellHeight = rowHeight;
                    pdf.rect(margin, yPos, tableWidth, cellHeight, 'S');
                    pdf.setFont('helvetica', 'normal');
                    pdf.text('Não se aplica.', margin + 12, yPos + 4.5);
                    yPos += cellHeight;
                }

                // Registros Fotográficos
                if (fotos.length > 0) {
                    if (yPos + rowHeight > pageHeight - bottomMargin) {
                        pdf.addPage();
                        addTimbradoToPage(pdf, timbradoBase64);
                        yPos = topMargin;
                    }
                    drawCell('Registros Fotográficos', margin, yPos, tableWidth, rowHeight, true, true, [189, 214, 238]);
                    yPos += rowHeight;

                    // Converter todas as imagens para base64 primeiro
                    const fotosBase64 = [];
                    for (const foto of fotos) {
                        try {
                            const fotoUrl = typeof foto === 'string' ? foto : foto.url;
                            const base64 = await loadImageAsBase64(fotoUrl);
                            fotosBase64.push({ 
                                url: fotoUrl,
                                legenda: typeof foto === 'object' ? foto.legenda : null,
                                base64 
                            });
                        } catch (err) {
                            console.error('Erro ao carregar imagem:', err, foto);
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
                        if (yPos + totalCellHeight + 10 > pageHeight - bottomMargin) {
                            pdf.addPage();
                            addTimbradoToPage(pdf, timbradoBase64);
                            yPos = topMargin;
                        }

                        // Desenhar células do grid 2x2
                        const leftX = margin;
                        const rightX = margin + imgCellWidth;

                        // Célula esquerda
                        pdf.rect(leftX, yPos, imgCellWidth, totalCellHeight, 'S');
                        if (fotosBase64[i]?.base64) {
                            try {
                                pdf.addImage(fotosBase64[i].base64, 'JPEG', leftX + 2, yPos + 2, imgWidth, imgHeight);
                                pdf.setFontSize(7);
                                pdf.setFont('helvetica', 'normal');
                                const numFigura = offsetGlobalFiguras + i + 1;
                                const legenda = fotosBase64[i].legenda ? `Figura ${numFigura} – ${fotosBase64[i].legenda}` : `Figura ${numFigura} – ${unidade.tipo_unidade_nome}.`;
                                const lines = pdf.splitTextToSize(legenda, imgCellWidth - 4);
                                pdf.text(lines, leftX + imgCellWidth / 2, yPos + imgHeight + 5, { align: 'center' });
                            } catch (err) {
                                console.error('Erro ao adicionar foto:', err);
                            }
                        }

                        // Célula direita
                        pdf.rect(rightX, yPos, imgCellWidth, totalCellHeight, 'S');
                        if (fotosBase64[i + 1]?.base64) {
                            try {
                                pdf.addImage(fotosBase64[i + 1].base64, 'JPEG', rightX + 2, yPos + 2, imgWidth, imgHeight);
                                pdf.setFontSize(7);
                                pdf.setFont('helvetica', 'normal');
                                const numFigura = offsetGlobalFiguras + i + 2;
                                const legenda = fotosBase64[i + 1].legenda ? `Figura ${numFigura} – ${fotosBase64[i + 1].legenda}` : `Figura ${numFigura} – ${unidade.tipo_unidade_nome}.`;
                                const lines = pdf.splitTextToSize(legenda, imgCellWidth - 4);
                                pdf.text(lines, rightX + imgCellWidth / 2, yPos + imgHeight + 5, { align: 'center' });
                            } catch (err) {
                                console.error('Erro ao adicionar foto:', err);
                            }
                        }

                        yPos += totalCellHeight;
                    }

                    // Atualizar offset para próxima unidade
                    offsetGlobalFiguras += fotosBase64.length;
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