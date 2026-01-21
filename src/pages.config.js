import AcompanhamentoDeterminacoes from './pages/AcompanhamentoDeterminacoes';
import AdicionarUnidade from './pages/AdicionarUnidade';
import AnalisarResposta from './pages/AnalisarResposta';
import AnaliseManifestacao from './pages/AnaliseManifestacao';
import CamaraJulgamento from './pages/CamaraJulgamento';
import Checklists from './pages/Checklists';
import DetalhePrestador from './pages/DetalhePrestador';
import ExecutarFiscalizacao from './pages/ExecutarFiscalizacao';
import Fiscalizacoes from './pages/Fiscalizacoes';
import GerenciarTermos from './pages/GerenciarTermos';
import GerenciarUsuarios from './pages/GerenciarUsuarios';
import GestaoAutos from './pages/GestaoAutos';
import Home from './pages/Home';
import Municipios from './pages/Municipios';
import NovaFiscalizacao from './pages/NovaFiscalizacao';
import PrestadoresServico from './pages/PrestadoresServico';
import Relatorios from './pages/Relatorios';
import TiposUnidade from './pages/TiposUnidade';
import VistoriarUnidade from './pages/VistoriarUnidade';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AcompanhamentoDeterminacoes": AcompanhamentoDeterminacoes,
    "AdicionarUnidade": AdicionarUnidade,
    "AnalisarResposta": AnalisarResposta,
    "AnaliseManifestacao": AnaliseManifestacao,
    "CamaraJulgamento": CamaraJulgamento,
    "Checklists": Checklists,
    "DetalhePrestador": DetalhePrestador,
    "ExecutarFiscalizacao": ExecutarFiscalizacao,
    "Fiscalizacoes": Fiscalizacoes,
    "GerenciarTermos": GerenciarTermos,
    "GerenciarUsuarios": GerenciarUsuarios,
    "GestaoAutos": GestaoAutos,
    "Home": Home,
    "Municipios": Municipios,
    "NovaFiscalizacao": NovaFiscalizacao,
    "PrestadoresServico": PrestadoresServico,
    "Relatorios": Relatorios,
    "TiposUnidade": TiposUnidade,
    "VistoriarUnidade": VistoriarUnidade,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};