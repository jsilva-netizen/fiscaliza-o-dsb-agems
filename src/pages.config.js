import Home from './pages/Home';
import Municipios from './pages/Municipios';
import TiposUnidade from './pages/TiposUnidade';
import Checklists from './pages/Checklists';
import NovaFiscalizacao from './pages/NovaFiscalizacao';
import ExecutarFiscalizacao from './pages/ExecutarFiscalizacao';
import AdicionarUnidade from './pages/AdicionarUnidade';
import VistoriarUnidade from './pages/VistoriarUnidade';
import Fiscalizacoes from './pages/Fiscalizacoes';
import Relatorios from './pages/Relatorios';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "Municipios": Municipios,
    "TiposUnidade": TiposUnidade,
    "Checklists": Checklists,
    "NovaFiscalizacao": NovaFiscalizacao,
    "ExecutarFiscalizacao": ExecutarFiscalizacao,
    "AdicionarUnidade": AdicionarUnidade,
    "VistoriarUnidade": VistoriarUnidade,
    "Fiscalizacoes": Fiscalizacoes,
    "Relatorios": Relatorios,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};