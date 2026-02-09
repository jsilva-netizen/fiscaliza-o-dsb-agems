import { base44 } from '@/api/base44Client';
import db from '@/functions/offlineDb';

/**
 * DataService - Fachada centralizada para todas as operações de dados
 * Gerencia sincronização offline/online, cache e fila de operações
 */
class DataServiceClass {
  constructor() {
    this.isOnline = navigator.onLine;
    this.setupConnectionListeners();
    this.entityMappings = {
      'Municipio': { table: 'municipios', isReference: true },
      'PrestadorServico': { table: 'prestadores_servico', isReference: true },
      'TipoUnidade': { table: 'tipos_unidade', isReference: true },
      'ItemChecklist': { table: 'item_checklist', isReference: true },
      'Fiscalizacao': { table: 'fiscalizacoes', isReference: false },
      'UnidadeFiscalizada': { table: 'unidades_fiscalizadas', isReference: false },
      'RespostaChecklist': { table: 'respostas_checklist', isReference: false },
      'NaoConformidade': { table: 'nao_conformidades', isReference: false },
      'Determinacao': { table: 'determinacoes', isReference: false },
      'Recomendacao': { table: 'recomendacoes', isReference: false },
      'ConstatacaoManual': { table: 'constatacoes_manuais', isReference: false },
    };
  }

  setupConnectionListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      window.dispatchEvent(new CustomEvent('data-service:online'));
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      window.dispatchEvent(new CustomEvent('data-service:offline'));
    });
  }

  isConnected() {
    return this.isOnline && navigator.onLine;
  }

  // ============================================
  // LEITURA DE DADOS
  // ============================================

  async read(entityName, filter = {}, sort = '-created_date', limit = 100) {
    const mapping = this.entityMappings[entityName];
    if (!mapping) throw new Error('Entity ' + entityName + ' nao mapeada');

    const { table, isReference } = mapping;

    if (isReference) {
      return this.readReferenceData(entityName, table, filter);
    }

    return this.readLocalData(table, filter);
  }

  async readReferenceData(entityName, tableName, filter = {}) {
    try {
      let results = [];

      console.log('[DataService] Lendo ' + entityName + ' de ' + tableName);

      if (this.isConnected()) {
        try {
          console.log('[DataService] Online - buscando ' + entityName + ' do servidor...');
          const serverData = await base44.entities[entityName].list('nome', 500);
          console.log('[DataService] Servidor retornou: ' + (serverData ? serverData.length : 0) + ' registros de ' + entityName);

          if (serverData && serverData.length > 0) {
            await db[tableName].clear();
            await db[tableName].bulkPut(serverData);
            console.log('[DataService] ' + entityName + ' salvo no cache (' + serverData.length + ' itens)');
            results = serverData;
          } else {
            results = await db[tableName].toArray();
            console.log('[DataService] Servidor vazio para ' + entityName + ', usando ' + results.length + ' do cache');
          }
          return this.applyFilter(results, filter);
        } catch (serverError) {
          console.error('[DataService] Erro ao buscar ' + entityName + ' do servidor:', serverError.message);
          results = await db[tableName].toArray();
          console.log('[DataService] Usando cache apos erro: ' + results.length + ' itens de ' + entityName);
          return this.applyFilter(results, filter);
        }
      } else {
        console.log('[DataService] Offline - usando cache para ' + entityName);
        results = await db[tableName].toArray();
        console.log('[DataService] Cache retornou: ' + results.length + ' itens de ' + entityName);
        return this.applyFilter(results, filter);
      }
    } catch (error) {
      console.error('[DataService] Erro critico ao ler ' + tableName + ':', error);
      return [];
    }
  }

  async readLocalData(tableName, filter = {}) {
    try {
      let results = await db[tableName].toArray();
      return this.applyFilter(results, filter);
    } catch (error) {
      console.error('Erro ao ler dados locais ' + tableName + ':', error);
      return [];
    }
  }

  applyFilter(data, filter = {}) {
    if (!filter || Object.keys(filter).length === 0) return data;

    return data.filter(function(item) {
      return Object.entries(filter).every(function([key, value]) {
        return item[key] === value;
      });
    });
  }

  // ============================================
  // ESCRITA DE DADOS
  // ============================================

  async create(entityName, data) {
    const mapping = this.entityMappings[entityName];
    if (!mapping) throw new Error('Entity ' + entityName + ' nao mapeada');

    const { table } = mapping;
    const localId = crypto.randomUUID();

    const record = {
      id: localId,
      ...data,
      _localId: localId,
      _syncStatus: 'pending',
      _syncError: null,
      created_at: new Date(),
    };

    try {
      await db[table].put(record);

      await db.syncQueue.add({
        operation: 'create',
        entityName: entityName,
        localId: localId,
        payload: JSON.stringify(record),
        timestamp: new Date(),
        status: 'pending',
        attempts: 0,
      });

      return record;
    } catch (error) {
      console.error('Erro ao criar ' + entityName + ':', error);
      throw error;
    }
  }

  async update(entityName, id, data) {
    const mapping = this.entityMappings[entityName];
    if (!mapping) throw new Error('Entity ' + entityName + ' nao mapeada');

    const { table } = mapping;
    const isLocal = id.toString().startsWith('temp_') || id.length === 36;

    try {
      const current = await db[table].get(id);
      if (!current) throw new Error('Registro ' + id + ' nao encontrado em ' + table);

      const updated = {
        ...current,
        ...data,
        _syncStatus: 'pending',
        _syncError: null,
        updated_at: new Date(),
      };

      await db[table].put(updated);

      await db.syncQueue.add({
        operation: 'update',
        entityName: entityName,
        localId: isLocal ? id : (current._localId || id),
        remoteId: isLocal ? null : id,
        payload: JSON.stringify(updated),
        timestamp: new Date(),
        status: 'pending',
        attempts: 0,
      });

      return updated;
    } catch (error) {
      console.error('Erro ao atualizar ' + entityName + ':', error);
      throw error;
    }
  }

  async delete(entityName, id) {
    const mapping = this.entityMappings[entityName];
    if (!mapping) throw new Error('Entity ' + entityName + ' nao mapeada');

    const { table } = mapping;
    const isLocal = id.toString().startsWith('temp_') || id.length === 36;

    try {
      const current = await db[table].get(id);

      await db[table].delete(id);

      await db.syncQueue.add({
        operation: 'delete',
        entityName: entityName,
        localId: isLocal ? id : (current ? current._localId || id : id),
        remoteId: isLocal ? null : id,
        payload: JSON.stringify({ id: id }),
        timestamp: new Date(),
        status: 'pending',
        attempts: 0,
      });
    } catch (error) {
      console.error('Erro ao deletar ' + entityName + ':', error);
      throw error;
    }
  }

  // ============================================
  // SINCRONIZACAO
  // ============================================

  async downloadAllReferenceData() {
    if (!this.isConnected()) {
      throw new Error('Sem conexao de internet. Nao e possivel baixar dados.');
    }

    try {
      var referenceEntities = [
        { name: 'Municipio', sort: 'nome', limit: 500 },
        { name: 'PrestadorServico', sort: 'nome', limit: 500 },
        { name: 'TipoUnidade', sort: 'nome', limit: 500 },
        { name: 'ItemChecklist', sort: 'ordem', limit: 1000 },
      ];

      var results = {
        success: [],
        failed: [],
      };

      for (var i = 0; i < referenceEntities.length; i++) {
        var entityConfig = referenceEntities[i];
        try {
          var entityName = entityConfig.name;
          console.log('[DownloadRef] Iniciando download de ' + entityName + '...');

          var data = await base44.entities[entityName].list(entityConfig.sort, entityConfig.limit);

          if (!data || data.length === 0) {
            console.warn('[DownloadRef] ' + entityName + ' retornou vazio do servidor');
          }

          var mapping = this.entityMappings[entityName];
          await db[mapping.table].clear();

          if (data && data.length > 0) {
            await db[mapping.table].bulkPut(data);
          }

          console.log('[DownloadRef] OK ' + entityName + ': ' + (data ? data.length : 0) + ' registros');
          results.success.push(entityName);
        } catch (error) {
          console.error('[DownloadRef] Erro ao baixar ' + entityConfig.name + ':', error);
          results.failed.push({
            entity: entityConfig.name,
            error: error.message || 'Erro desconhecido'
          });
        }
      }

      window.dispatchEvent(
        new CustomEvent('data-service:download-complete', { detail: results })
      );
      return results;
    } catch (error) {
      console.error('Erro no download de dados de referencia:', error);
      throw error;
    }
  }

  async uploadPendingData() {
    if (!this.isConnected()) {
      console.warn('Offline: nao e possivel sincronizar agora');
      return { success: 0, failed: 0, errors: [] };
    }

    var results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    try {
      var pending = await db.syncQueue
        .where('status')
        .equals('pending')
        .toArray();

      for (var i = 0; i < pending.length; i++) {
        var item = pending[i];
        try {
          await this.processSyncItem(item);
          results.success++;
        } catch (error) {
          console.error('Erro ao sincronizar item:', error);
          results.failed++;
          results.errors.push({
            itemId: item.id,
            error: error.message,
          });

          await db.syncQueue.update(item.id, {
            status: 'failed',
            attempts: item.attempts + 1,
            error: error.message,
          });
        }
      }

      window.dispatchEvent(
        new CustomEvent('data-service:sync-complete', { detail: results })
      );
      return results;
    } catch (error) {
      console.error('Erro ao processar fila de sync:', error);
      throw error;
    }
  }

  async processSyncItem(syncItem) {
    var operation = syncItem.operation;
    var entityName = syncItem.entityName;
    var localId = syncItem.localId;
    var remoteId = syncItem.remoteId;
    var data = JSON.parse(syncItem.payload);

    if (operation === 'create') {
      var _localId = data._localId;
      var _syncStatus = data._syncStatus;
      var _syncError = data._syncError;
      var created_at = data.created_at;
      var updated_at = data.updated_at;
      var createData = Object.assign({}, data);
      delete createData._localId;
      delete createData._syncStatus;
      delete createData._syncError;
      delete createData.created_at;
      delete createData.updated_at;

      var result = await base44.entities[entityName].create(createData);

      var mapping = this.entityMappings[entityName];
      await db[mapping.table].delete(localId);
      var updated = Object.assign({}, result, { _syncStatus: 'synced', _syncError: null });
      await db[mapping.table].put(updated);

      await db.idMappings.put({
        localId: localId,
        remoteId: result.id,
        entityName: entityName,
        timestamp: new Date(),
      });

    } else if (operation === 'update') {
      var updateData = Object.assign({}, data);
      delete updateData._localId;
      delete updateData._syncStatus;
      delete updateData._syncError;
      delete updateData.created_at;
      delete updateData.updated_at;

      var result = await base44.entities[entityName].update(remoteId || localId, updateData);

      var mapping = this.entityMappings[entityName];
      var updated = Object.assign({}, result, { _syncStatus: 'synced', _syncError: null });
      await db[mapping.table].put(updated);

    } else if (operation === 'delete') {
      await base44.entities[entityName].delete(remoteId || localId);

      var mapping = this.entityMappings[entityName];
      await db[mapping.table].delete(localId);

    } else {
      throw new Error('Operacao ' + operation + ' nao suportada');
    }

    await db.syncQueue.delete(syncItem.id);
  }

  // ============================================
  // UTILITARIOS
  // ============================================

  async getSyncStatus() {
    try {
      if (!db || !db.syncQueue) {
        return {
          isOnline: this.isConnected(),
          pendingCount: 0,
          failedCount: 0,
          hasPending: false,
          hasFailed: false,
        };
      }

      var pending = await db.syncQueue.where('status').equals('pending').toArray();
      var failed = await db.syncQueue.where('status').equals('failed').toArray();

      return {
        isOnline: this.isConnected(),
        pendingCount: pending.length,
        failedCount: failed.length,
        hasPending: pending.length > 0,
        hasFailed: failed.length > 0,
      };
    } catch (error) {
      console.error('Erro ao obter status de sync:', error);
      return {
        isOnline: this.isConnected(),
        pendingCount: 0,
        failedCount: 0,
        hasPending: false,
        hasFailed: false,
      };
    }
  }

  async clearSyncQueue() {
    await db.syncQueue.clear();
  }

  async clearReferenceCache(entityName) {
    var referenceEntities = ['municipios', 'prestadores_servico', 'tipos_unidade', 'item_checklist'];

    if (entityName) {
      var mapping = this.entityMappings[entityName];
      if (mapping && mapping.isReference) {
        await db[mapping.table].clear();
      }
    } else {
      for (var i = 0; i < referenceEntities.length; i++) {
        await db[referenceEntities[i]].clear();
      }
    }
  }

  // ============================================
  // OPERACOES TRANSACIONAIS (OFFLINE-FIRST)
  // ============================================

  async createRespostaComNCeDeterminacao(unidadeId, itemChecklistId, itemData, respostaData) {
    try {
      var resposta = await this.create('RespostaChecklist', {
        unidade_fiscalizada_id: unidadeId,
        item_checklist_id: itemChecklistId,
        pergunta: respostaData.textoConstatacao || '',
        resposta: respostaData.resposta,
        gera_nc: itemData.gera_nc,
        numero_constatacao: respostaData.numeroConstatacao,
        observacao: respostaData.observacao || ''
      });

      if (itemData.gera_nc && respostaData.resposta === 'NAO') {
        var ncDescricao = itemData.texto_nc ||
          ('A constatacao ' + respostaData.numeroConstatacao + ' nao cumpre o disposto no ' + (itemData.artigo_portaria || 'artigo nao especificado') + '.');

        var nc = await this.create('NaoConformidade', {
          unidade_fiscalizada_id: unidadeId,
          resposta_checklist_id: resposta.id,
          numero_nc: respostaData.numeroNC,
          artigo_portaria: itemData.artigo_portaria || '',
          descricao: ncDescricao,
          fotos: []
        });

        var textoDet = itemData.texto_determinacao || 'regularizar a situacao identificada';
        var textoFinalDet = 'Para sanar a ' + respostaData.numeroNC + ' ' + textoDet + '. Prazo: 30 dias.';

        await this.create('Determinacao', {
          unidade_fiscalizada_id: unidadeId,
          nao_conformidade_id: nc.id,
          numero_determinacao: respostaData.numeroDeterminacao,
          descricao: textoFinalDet,
          prazo_dias: 30,
          status: 'pendente'
        });

        if (itemData.texto_recomendacao) {
          await this.create('Recomendacao', {
            unidade_fiscalizada_id: unidadeId,
            numero_recomendacao: respostaData.numeroRecomendacao,
            descricao: itemData.texto_recomendacao,
            origem: 'checklist'
          });
        }
      }

      return resposta;
    } catch (error) {
      console.error('Erro ao criar resposta com NC e determinacao:', error);
      throw error;
    }
  }

  async calcularProximaNumeracao(unidadeId) {
    try {
      var respostas = await this.readLocalData('respostas_checklist', {
        unidade_fiscalizada_id: unidadeId
      });
      var respostasComConstatacao = respostas.filter(function(r) {
        return (r.resposta === 'SIM' || r.resposta === 'NAO') && r.pergunta && r.pergunta.trim();
      }).length;

      var constatacoes = await this.readLocalData('constatacoes_manuais', {
        unidade_fiscalizada_id: unidadeId
      });

      var ncs = await this.readLocalData('nao_conformidades', {
        unidade_fiscalizada_id: unidadeId
      });
      var dets = await this.readLocalData('determinacoes', {
        unidade_fiscalizada_id: unidadeId
      });
      var recs = await this.readLocalData('recomendacoes', {
        unidade_fiscalizada_id: unidadeId
      });

      return {
        C: respostasComConstatacao + constatacoes.length + 1,
        NC: ncs.length + 1,
        D: dets.length + 1,
        R: recs.length + 1
      };
    } catch (error) {
      console.error('Erro ao calcular proxima numeracao:', error);
      return { C: 1, NC: 1, D: 1, R: 1 };
    }
  }
}

var DataService = new DataServiceClass();
export { DataService };
export default DataService;