import Dexie from 'dexie';

let dbInstance = null;

function initializeDb() {
  if (dbInstance) return dbInstance;

  const db = new Dexie('AgemsFiscalizacaoOffline');

  db.version(1).stores({
    // Dados de referência (somente leitura local)
    municipios: 'id, nome',
    prestadores_servico: 'id, nome, ativo',
    tipos_unidade: 'id, nome, &tipo_unidade_codigo',
    item_checklist: 'id, tipo_unidade_id, ordem',
    
    // Dados de fiscalização (offline-first)
    fiscalizacoes: 'id, status, municipio_id, fiscal_email, _syncStatus, _localId',
    unidades_fiscalizadas: 'id, fiscalizacao_id, tipo_unidade_id, status, _syncStatus, _localId',
    respostas_checklist: 'id, unidade_fiscalizada_id, item_checklist_id, _syncStatus, _localId',
    nao_conformidades: 'id, unidade_fiscalizada_id, numero_nc, resposta_checklist_id, _syncStatus, _localId',
    determinacoes: 'id, unidade_fiscalizada_id, nao_conformidade_id, numero_determinacao, _syncStatus, _localId',
    recomendacoes: 'id, unidade_fiscalizada_id, numero_recomendacao, origem, _syncStatus, _localId',
    constatacoes_manuais: 'id, unidade_fiscalizada_id, ordem, numero_constatacao, _syncStatus, _localId',
    
    // Fotos armazenadas como blobs
    fotos: '++autoId, unidade_id, fiscalizacao_id, _syncStatus',
    
    // Fila de sincronização
    syncQueue: '++id, operation, entityName, entityId, timestamp, status',
    
    // Mapeamento de IDs locais -> remotos
    idMappings: 'localId, entityName',
    
    // Metadados de sincronização
    syncMeta: 'key',

    // Log de notificações
    notificationLog: '++id, type, timestamp, read'
  });

  dbInstance = db;
  return db;
}

// Inicializa imediatamente
const db = initializeDb();

export default db;