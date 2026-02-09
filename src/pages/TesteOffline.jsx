import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, Trash2, Save, Download } from 'lucide-react';
import db from '@/functions/offlineDb';

export default function TesteOffline() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [status, setStatus] = useState('idle');

    const handleStatusBanco = async () => {
        try {
            setLoading(true);
            setStatus('loading');
            const isOpen = db.isOpen();
            const dbName = db.name;
            const tables = Object.keys(db.tables).map(t => db.tables[t].name);
            
            setResult({
                isOpen,
                dbName,
                version: db.verno,
                tables: tables,
                timestamp: new Date().toISOString()
            });
            setStatus('success');
        } catch (error) {
            setResult({ error: error.message });
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    const handleGravarTeste = async () => {
        try {
            setLoading(true);
            setStatus('loading');
            
            if (!db.isOpen()) await db.open();
            
            const testData = {
                id: 'teste_' + Date.now(),
                nome: 'Cidade Teste ' + new Date().toLocaleTimeString(),
                codigo_ibge: '9999999',
                latitude: -20.4697,
                longitude: -54.6201
            };
            
            await db.municipios.add(testData);
            
            setResult({
                success: true,
                message: 'Registro adicionado com sucesso',
                data: testData
            });
            setStatus('success');
        } catch (error) {
            setResult({ error: error.message });
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    const handleLerTeste = async () => {
        try {
            setLoading(true);
            setStatus('loading');
            
            if (!db.isOpen()) await db.open();
            
            const data = await db.municipios.toArray();
            
            setResult({
                count: data.length,
                data: data,
                timestamp: new Date().toISOString()
            });
            setStatus('success');
        } catch (error) {
            setResult({ error: error.message });
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    const handleResetarBanco = async () => {
        try {
            setLoading(true);
            setStatus('loading');
            
            await db.delete();
            await db.open();
            
            setResult({
                success: true,
                message: 'Banco de dados resetado com sucesso',
                timestamp: new Date().toISOString()
            });
            setStatus('success');
        } catch (error) {
            setResult({ error: error.message });
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    const handleLimparMunicipios = async () => {
        try {
            setLoading(true);
            setStatus('loading');
            
            if (!db.isOpen()) await db.open();
            
            const count = await db.municipios.count();
            await db.municipios.clear();
            
            setResult({
                success: true,
                message: `${count} registros deletados da tabela municipios`,
                timestamp: new Date().toISOString()
            });
            setStatus('success');
        } catch (error) {
            setResult({ error: error.message });
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <Card className="mb-6 bg-blue-50 border-blue-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-900">
                            <Download className="h-5 w-5" />
                            Teste de Banco de Dados Offline (Dexie)
                        </CardTitle>
                    </CardHeader>
                </Card>

                {/* Status Badge */}
                <div className="mb-6 flex items-center gap-2">
                    <Badge variant={status === 'success' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}>
                        {status === 'loading' ? 'Processando...' : status === 'success' ? 'Sucesso' : status === 'error' ? 'Erro' : 'Pronto'}
                    </Badge>
                </div>

                {/* Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <Button 
                        onClick={handleStatusBanco}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Status do Banco
                    </Button>

                    <Button 
                        onClick={handleGravarTeste}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Save className="h-4 w-4 mr-2" />
                        Gravar Teste
                    </Button>

                    <Button 
                        onClick={handleLerTeste}
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-700"
                    >
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Download className="h-4 w-4 mr-2" />
                        Ler Dados
                    </Button>

                    <Button 
                        onClick={handleLimparMunicipios}
                        disabled={loading}
                        variant="outline"
                        className="text-orange-600 border-orange-300 hover:bg-orange-50"
                    >
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Trash2 className="h-4 w-4 mr-2" />
                        Limpar Municipios
                    </Button>

                    <Button 
                        onClick={handleResetarBanco}
                        disabled={loading}
                        variant="destructive"
                        className="md:col-span-2"
                    >
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Resetar Banco Completo
                    </Button>
                </div>

                {/* Result Display */}
                {result && (
                    <Card className={status === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sm">
                                {status === 'error' ? (
                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                ) : (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                )}
                                Resultado
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <pre className={`p-4 rounded text-xs overflow-auto max-h-96 ${
                                status === 'error' 
                                    ? 'bg-red-100 text-red-800' 
                                    : 'bg-green-100 text-green-900'
                            }`}>
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        </CardContent>
                    </Card>
                )}

                {/* Info */}
                <Card className="mt-6 bg-yellow-50 border-yellow-200">
                    <CardContent className="p-4 text-sm text-yellow-900">
                        <p className="font-medium mb-2">⚠️ Nota Importante:</p>
                        <ul className="list-disc ml-5 space-y-1">
                            <li>Esta página é isolada e não afeta as páginas de produção</li>
                            <li>Use "Resetar Banco" apenas se houver problemas de schema</li>
                            <li>Os dados aqui são locais ao navegador (IndexedDB)</li>
                            <li>Abra o DevTools (F12) para mais detalhes no console</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}