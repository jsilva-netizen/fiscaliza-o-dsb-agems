import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    ClipboardCheck, 
    Settings, 
    MapPin, 
    BarChart3, 
    Plus,
    History,
    Building2,
    Users,
    FileText,
    AlertTriangle
} from 'lucide-react';

export default function Home() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkAdmin = async () => {
            try {
                const user = await base44.auth.me();
                setIsAdmin(user?.role === 'admin');
            } catch (error) {
                setIsAdmin(false);
            }
        };
        checkAdmin();
    }, []);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900">
            {/* Header */}
            <div className="bg-white/10 backdrop-blur-sm border-b border-white/20">
                <div className="max-w-6xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center p-2">
                            <img 
                                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69331445067a2821c02acff8/680310e1f_ChatGPTImage22dejande202609_12_54.png" 
                                alt="Logo AGEMS" 
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <div className="text-white">
                            <h1 className="text-2xl font-bold">Fiscalização AGEMS</h1>
                            <p className="text-blue-200 text-sm">Sistema de Fiscalização de Saneamento</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <Link to={createPageUrl('NovaFiscalizacao')}>
                        <Card className="bg-green-500 hover:bg-green-600 transition-all cursor-pointer border-none h-full">
                            <CardContent className="p-6 flex items-center gap-4">
                                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                                    <Plus className="h-8 w-8 text-white" />
                                </div>
                                <div className="text-white">
                                    <h3 className="text-xl font-bold">Nova Fiscalização</h3>
                                    <p className="text-green-100 text-sm">Iniciar vistoria em campo</p>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link to={createPageUrl('Fiscalizacoes')}>
                        <Card className="bg-white/10 hover:bg-white/20 transition-all cursor-pointer border-white/20 h-full">
                            <CardContent className="p-6 flex items-center gap-4">
                                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                                    <History className="h-8 w-8 text-white" />
                                </div>
                                <div className="text-white">
                                    <h3 className="text-xl font-bold">Fiscalizações</h3>
                                    <p className="text-blue-200 text-sm">Ver histórico e continuar</p>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                </div>

                {/* Menu Grid */}
                {!isMobile && (
                <>
                <h2 className="text-white text-lg font-semibold mb-4">Menu Principal</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <Link to={createPageUrl('TiposUnidade')}>
                        <Card className="bg-white/10 hover:bg-white/20 transition-all cursor-pointer border-white/20 h-full">
                            <CardContent className="p-4 text-center">
                                <Building2 className="h-8 w-8 text-blue-300 mx-auto mb-2" />
                                <h3 className="text-white font-medium text-sm">Tipos de Unidade</h3>
                                <p className="text-blue-300 text-xs">ETA, ETE, etc</p>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link to={createPageUrl('Checklists')}>
                        <Card className="bg-white/10 hover:bg-white/20 transition-all cursor-pointer border-white/20 h-full">
                            <CardContent className="p-4 text-center">
                                <ClipboardCheck className="h-8 w-8 text-blue-300 mx-auto mb-2" />
                                <h3 className="text-white font-medium text-sm">Checklists</h3>
                                <p className="text-blue-300 text-xs">Configurar perguntas</p>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link to={createPageUrl('PrestadoresServico')}>
                        <Card className="bg-white/10 hover:bg-white/20 transition-all cursor-pointer border-white/20 h-full">
                            <CardContent className="p-4 text-center">
                                <Users className="h-8 w-8 text-blue-300 mx-auto mb-2" />
                                <h3 className="text-white font-medium text-sm">Prestadores</h3>
                                <p className="text-blue-300 text-xs">Titulares e Empresas</p>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link to={createPageUrl('Relatorios')}>
                        <Card className="bg-white/10 hover:bg-white/20 transition-all cursor-pointer border-white/20 h-full">
                            <CardContent className="p-4 text-center">
                                <BarChart3 className="h-8 w-8 text-blue-300 mx-auto mb-2" />
                                <h3 className="text-white font-medium text-sm">Relatórios</h3>
                                <p className="text-blue-300 text-xs">Indicadores e BI</p>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link to={createPageUrl('GerenciarTermos')}>
                        <Card className="bg-white/10 hover:bg-white/20 transition-all cursor-pointer border-white/20 h-full">
                            <CardContent className="p-4 text-center">
                                <FileText className="h-8 w-8 text-blue-300 mx-auto mb-2" />
                                <h3 className="text-white font-medium text-sm">Termos</h3>
                                <p className="text-blue-300 text-xs">Notificação</p>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link to={createPageUrl('AnaliseManifestacao')}>
                        <Card className="bg-white/10 hover:bg-white/20 transition-all cursor-pointer border-white/20 h-full">
                            <CardContent className="p-4 text-center">
                                <FileText className="h-8 w-8 text-blue-300 mx-auto mb-2" />
                                <h3 className="text-white font-medium text-sm">Análise Manifestação</h3>
                                <p className="text-blue-300 text-xs">Processos</p>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link to={createPageUrl('GestaoAutos')}>
                        <Card className="bg-white/10 hover:bg-white/20 transition-all cursor-pointer border-white/20 h-full">
                            <CardContent className="p-4 text-center">
                                <AlertTriangle className="h-8 w-8 text-red-300 mx-auto mb-2" />
                                <h3 className="text-white font-medium text-sm">Autos</h3>
                                <p className="text-blue-300 text-xs">Infrações</p>
                            </CardContent>
                        </Card>
                    </Link>

                    {isAdmin && (
                        <Link to={createPageUrl('GerenciarUsuarios')}>
                            <Card className="bg-white/10 hover:bg-white/20 transition-all cursor-pointer border-white/20 h-full">
                                <CardContent className="p-4 text-center">
                                    <Users className="h-8 w-8 text-blue-300 mx-auto mb-2" />
                                    <h3 className="text-white font-medium text-sm">Usuários</h3>
                                    <p className="text-blue-300 text-xs">Gestão e Permissões</p>
                                </CardContent>
                            </Card>
                        </Link>
                    )}
                </div>
                </>
                )}
            </div>

            {/* Footer */}
            <div className="mt-auto py-6 text-center text-blue-300 text-sm">
                <p>AGEMS - Agência Estadual de Regulação de Serviços Públicos</p>
                <p className="text-xs text-blue-400 mt-1">Mato Grosso do Sul</p>
            </div>
        </div>
    );
}