import AdicionarUnidade from './pages/AdicionarUnidade';
import Checklists from './pages/Checklists';
import ExecutarFiscalizacao from './pages/ExecutarFiscalizacao';
import Fiscalizacoes from './pages/Fiscalizacoes';
import Home from './pages/Home';
import Municipios from './pages/Municipios';
import NovaFiscalizacao from './pages/NovaFiscalizacao';
import Relatorios from './pages/Relatorios';
import TiposUnidade from './pages/TiposUnidade';
import VistoriarUnidade from './pages/VistoriarUnidade';
import PrestadoresServico from './pages/PrestadoresServico';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdicionarUnidade": AdicionarUnidade,
    "Checklists": Checklists,
    "ExecutarFiscalizacao": ExecutarFiscalizacao,
    "Fiscalizacoes": Fiscalizacoes,
    "Home": Home,
    "Municipios": Municipios,
    "NovaFiscalizacao": NovaFiscalizacao,
    "Relatorios": Relatorios,
    "TiposUnidade": TiposUnidade,
    "VistoriarUnidade": VistoriarUnidade,
    "PrestadoresServico": PrestadoresServico,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};