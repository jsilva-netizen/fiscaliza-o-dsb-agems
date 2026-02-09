/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
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
import TesteOffline from './pages/TesteOffline';
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
    "TesteOffline": TesteOffline,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};