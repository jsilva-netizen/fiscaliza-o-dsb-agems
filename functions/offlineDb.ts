import Dexie from 'dexie';

console.log('>>> [OFFLINE DB] Inicializando instância do Dexie...');

// Verificar se IndexedDB é suportado
const isIndexedDBSupported = () => {
  try {
    const test = 'indexeddb-test-' + Date.now();
    const request = indexedDB.open(test);
    request.onsuccess = () => {
      indexedDB.deleteDatabase(test);
    };
    return true;
  } catch (e) {
    console.error('>>> [OFFLINE DB] IndexedDB não suportado:', e);
    return false;
  }
};

console.log('>>> [OFFLINE DB] IndexedDB suportado?', isIndexedDBSupported());

export const db = new Dexie('AgemsFiscalizacaoOffline');

// Forçando versão alta para garantir atualização do schema
db.version(10).stores({
  municipios: 'id, nome',
  prestadores_servico: 'id, nome, ativo',
  tipos_unidade: 'id, nome',
  item_checklist: 'id, tipo_unidade_id, ordem',
  fiscalizacoes: 'id, status, municipio_id, fiscal_email, _syncStatus, _localId',
  unidades_fiscalizadas: 'id, fiscalizacao_id, tipo_unidade_id, status, _syncStatus, _localId',
  respostas_checklist: 'id, unidade_fiscalizada_id, item_checklist_id, _syncStatus, _localId',
  nao_conformidades: 'id, unidade_fiscalizada_id, numero_nc, _syncStatus, _localId',
  determinacoes: 'id, unidade_fiscalizada_id, nao_conformidade_id, _syncStatus, _localId',
  recomendacoes: 'id, unidade_fiscalizada_id, numero_recomendacao, _syncStatus, _localId',
  constatacoes_manuais: 'id, unidade_fiscalizada_id, ordem, _syncStatus, _localId',
  fotos: '++autoId, entityType, entityId, _syncStatus',
  syncQueue: '++id, operation, entityName, localId, timestamp, status',
  idMappings: 'localId, remoteId, entityName',
  syncMeta: 'key'
});

// Hook para logar quando o banco abrir
db.on('ready', () => {
  console.log('>>> [OFFLINE DB] Banco de dados pronto e aberto!');
  console.log('>>> [OFFLINE DB] Tabelas disponíveis:', Object.keys(db.tables).map(t => db.tables[t].name).join(', '));
});

// Hook para logar erros
db.on('error', (error) => {
  console.error('>>> [OFFLINE DB] ERRO:', error);
});

// Abrir banco imediatamente ao carregar o módulo
db.open()
  .then(() => {
    console.log('>>> [OFFLINE DB] Banco aberto com sucesso na inicialização');
  })
  .catch((error) => {
    console.error('>>> [OFFLINE DB] ERRO ao abrir banco na inicialização:', error);
  });

// Exportar como padrão para compatibilidade com imports antigos
export default db;