import { base44 } from '@/api/base44Client';
import db from '../functions/offlineDb.js';

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

  /**
   * Configura listeners para mudanças de conexão
   */
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

  /**
   * Verifica se está online
   */
  isConnected() {
    return this.isOnline && navigator.onLine;
  }

  /**
   * ============================================
   * LEITURA DE DADOS
   * ============================================
   */

  /**
   * Lê dados de uma entidade
   * Para referência: cache first, depois servidor
   * Para transacionais: sempre local (pode ter pendências)
   */
  async read(entityName, filter = {}, sort = '-created_date', limit = 100) {
    const mapping = this.entityMappings[entityName];
    if (!mapping) throw new Error(`Entity ${entityName} não mapeada`);

    const { table, isReference } = mapping;

    // Para tabelas de referência: sempre tenta servidor primeiro se online
    if (isReference) {
      return this.readReferenceData(entityName, table, filter);
    }

    // Para tabelas transacionais: retorna dados locais
    return this.readLocalData(table, filter);
  }

  /**
   * Lê dados de tabela de referência com fallback ao servidor
   */
  async readReferenceData(entityName, tableName, filter = {}) {
    try {
      let results = [];

      // Se online, sempre tenta buscar do servidor primeiro
      if (this.isConnected()) {
        try {
          const serverData = await base44.entities[entityName].list();
          if (serverData && serverData.length > 0) {
            // Atualiza cache com dados do servidor
            await db[tableName].clear();
            await db[tableName].bulkPut(serverData);
            results = serverData;
          } else {
            // Se servidor retornar vazio, usa cache
            results = await db[tableName].toArray();
          }
          return this.applyFilter(results, filter);
        } catch (serverError) {
          // Se falhar no servidor, usa cache
          results = await db[tableName].toArray();
          return this.applyFilter(results, filter);
        }
      } else {
        // Se offline, usa cache
        results = await db[tableName].toArray();
        return this.applyFilter(results, filter);
      }
    } catch (error) {
      console.error(`Erro ao ler ${tableName}:`, error);
      return [];
    }
  }

  /**
   * Lê dados locais (transacionais) - sempre retorna do Dexie
   */
  async readLocalData(tableName, filter = {}) {
    try {
      let results = await db[tableName].toArray();
      return this.applyFilter(results, filter);
    } catch (error) {
      console.error(`Erro ao ler dados locais ${tableName}:`, error);
      return [];
    }
  }

  /**
   * Aplica filtro simples aos dados
   */
  applyFilter(data, filter = {}) {
    if (!filter || Object.keys(filter).length === 0) return data;

    return data.filter(item => {
      return Object.entries(filter).every(([key, value]) => {
        return item[key] === value;
      });
    });
  }

  /**
   * ============================================
   * ESCRITA DE DADOS
   * ============================================
   */

  /**
   * Cria um novo registro
   */
  async create(entityName, data) {
    const mapping = this.entityMappings[entityName];
    if (!mapping) throw new Error(`Entity ${entityName} não mapeada`);

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
      // 1. Salva no Dexie
      await db[table].put(record);

      // 2. Adiciona à fila de sync
      await db.syncQueue.add({
        id: crypto.randomUUID(),
        operation: 'create',
        entityName,
        localId,
        payload: JSON.stringify(record),
        timestamp: new Date(),
        status: 'pending',
        attempts: 0,
      });

      return record;
    } catch (error) {
      console.error(`Erro ao criar ${entityName}:`, error);
      throw error;
    }
  }

  /**
   * Atualiza um registro existente
   */
  async update(entityName, id, data) {
    const mapping = this.entityMappings[entityName];
    if (!mapping) throw new Error(`Entity ${entityName} não mapeada`);

    const { table } = mapping;
    const isLocal = id.toString().startsWith('temp_') || id.length === 36; // UUID

    try {
      // 1. Obtém registro atual
      const current = await db[table].get(id);
      if (!current) throw new Error(`Registro ${id} não encontrado em ${table}`);

      const updated = {
        ...current,
        ...data,
        _syncStatus: 'pending',
        _syncError: null,
        updated_at: new Date(),
      };

      // 2. Atualiza no Dexie
      await db[table].put(updated);

      // 3. Adiciona à fila de sync
      await db.syncQueue.add({
        id: crypto.randomUUID(),
        operation: 'update',
        entityName,
        localId: isLocal ? id : current._localId || id,
        remoteId: isLocal ? null : id,
        payload: JSON.stringify(updated),
        timestamp: new Date(),
        status: 'pending',
        attempts: 0,
      });

      return updated;
    } catch (error) {
      console.error(`Erro ao atualizar ${entityName}:`, error);
      throw error;
    }
  }

  /**
   * Deleta um registro
   */
  async delete(entityName, id) {
    const mapping = this.entityMappings[entityName];
    if (!mapping) throw new Error(`Entity ${entityName} não mapeada`);

    const { table } = mapping;
    const isLocal = id.toString().startsWith('temp_') || id.length === 36;

    try {
      const current = await db[table].get(id);

      // 1. Remove do Dexie
      await db[table].delete(id);

      // 2. Adiciona à fila de sync
      await db.syncQueue.add({
        id: crypto.randomUUID(),
        operation: 'delete',
        entityName,
        localId: isLocal ? id : current?._localId || id,
        remoteId: isLocal ? null : id,
        payload: JSON.stringify({ id }),
        timestamp: new Date(),
        status: 'pending',
        attempts: 0,
      });
    } catch (error) {
      console.error(`Erro ao deletar ${entityName}:`, error);
      throw error;
    }
  }

  /**
   * ============================================
   * SINCRONIZAÇÃO
   * ============================================
   */

  /**
   * Baixa forçadamente todos os dados auxiliares do servidor
   * Ideal para preparar tablet offline antes de viagem
   */
  async downloadAllReferenceData() {
    if (!this.isConnected()) {
      throw new Error('Sem conexão de internet. Não é possível baixar dados.');
    }

    try {
      const referenceEntities = [
        'Municipio',
        'PrestadorServico',
        'TipoUnidade',
        'ItemChecklist',
      ];

      const results = {
        success: [],
        failed: [],
      };

      for (const entityName of referenceEntities) {
        try {
          const data = await base44.entities[entityName].list();
          const mapping = this.entityMappings[entityName];
          await db[mapping.table].clear();
          await db[mapping.table].bulkPut(data);
          results.success.push(entityName);
        } catch (error) {
          console.error(`Erro ao baixar ${entityName}:`, error);
          results.failed.push({ entity: entityName, error: error.message });
        }
      }

      window.dispatchEvent(
        new CustomEvent('data-service:download-complete', { detail: results })
      );
      return results;
    } catch (error) {
      console.error('Erro no download de dados de referência:', error);
      throw error;
    }
  }

  /**
   * Processa fila de sincronização
   * Envia dados pendentes para o servidor
   */
  async uploadPendingData() {
    if (!this.isConnected()) {
      console.warn('Offline: não é possível sincronizar agora');
      return { success: 0, failed: 0, errors: [] };
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    try {
      const pending = await db.syncQueue
        .where('status')
        .equals('pending')
        .toArray();

      for (const item of pending) {
        try {
          await this.processSyncItem(item);
          results.success++;
        } catch (error) {
          console.error(`Erro ao sincronizar item:`, error);
          results.failed++;
          results.errors.push({
            itemId: item.id,
            error: error.message,
          });

          // Atualiza status do item
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

  /**
   * Processa um item individual da fila
   */
  async processSyncItem(syncItem) {
    const { operation, entityName, localId, remoteId, payload } = syncItem;
    const data = JSON.parse(payload);

    switch (operation) {
      case 'create': {
        // Remove campos locais antes de enviar
        const { _localId, _syncStatus, _syncError, created_at, updated_at, ...createData } = data;
        const result = await base44.entities[entityName].create(createData);

        // Atualiza Dexie com ID remoto
        const mapping = this.entityMappings[entityName];
        await db[mapping.table].delete(localId);
        const updated = { ...result, _syncStatus: 'synced', _syncError: null };
        await db[mapping.table].put(updated);

        // Registra mapeamento de IDs
        await db.idMappings.put({
          localId,
          remoteId: result.id,
          entityName,
          timestamp: new Date(),
        });

        break;
      }

      case 'update': {
        const { _localId, _syncStatus, _syncError, created_at, updated_at, ...updateData } = data;
        const result = await base44.entities[entityName].update(remoteId || localId, updateData);

        // Atualiza Dexie
        const mapping = this.entityMappings[entityName];
        const updated = { ...result, _syncStatus: 'synced', _syncError: null };
        await db[mapping.table].put(updated);

        break;
      }

      case 'delete': {
        await base44.entities[entityName].delete(remoteId || localId);

        // Remove do Dexie
        const mapping = this.entityMappings[entityName];
        await db[mapping.table].delete(localId);

        break;
      }

      default:
        throw new Error(`Operação ${operation} não suportada`);
    }

    // Remove da fila de sync
    await db.syncQueue.delete(syncItem.id);
  }

  /**
   * ============================================
   * UTILITÁRIOS
   * ============================================
   */

  /**
   * Retorna status de sincronização
   */
  async getSyncStatus() {
    try {
      const pending = await db.syncQueue.where('status').equals('pending').toArray();
      const failed = await db.syncQueue.where('status').equals('failed').toArray();

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

  /**
   * Limpa a fila de sincronização (usar com cuidado!)
   */
  async clearSyncQueue() {
    await db.syncQueue.clear();
  }

  /**
   * Limpa cache de dados de referência
   */
  async clearReferenceCache(entityName = null) {
    const referenceEntities = ['municipios', 'prestadores_servico', 'tipos_unidade', 'item_checklist'];

    if (entityName) {
      const mapping = this.entityMappings[entityName];
      if (mapping && mapping.isReference) {
        await db[mapping.table].clear();
      }
    } else {
      for (const table of referenceEntities) {
        await db[table].clear();
      }
    }
  }

  /**
   * ============================================
   * OPERAÇÕES TRANSACIONAIS (OFFLINE-FIRST)
   * ============================================
   */

  /**
   * Cria Resposta do Checklist + NC + Determinação + Recomendação de forma transacional
   * Tudo é salvo localmente no Dexie, preparado para sincronização
   */
  async createRespostaComNCeDeterminacao(unidadeId, itemChecklistId, itemData, respostaData) {
    try {
      // 1. Criar Resposta do Checklist
      const resposta = await this.create('RespostaChecklist', {
        unidade_fiscalizada_id: unidadeId,
        item_checklist_id: itemChecklistId,
        pergunta: respostaData.textoConstatacao || '',
        resposta: respostaData.resposta,
        gera_nc: itemData.gera_nc,
        numero_constatacao: respostaData.numeroConstatacao,
        observacao: respostaData.observacao || ''
      });

      // 2. Se gera NC e resposta é NÃO, criar NC + Determinação + Recomendação
      if (itemData.gera_nc && respostaData.resposta === 'NAO') {
        // Criar NC
        const ncDescricao = itemData.texto_nc || 
          `A constatação ${respostaData.numeroConstatacao} não cumpre o disposto no ${itemData.artigo_portaria || 'artigo não especificado'}.`;

        const nc = await this.create('NaoConformidade', {
          unidade_fiscalizada_id: unidadeId,
          resposta_checklist_id: resposta.id,
          numero_nc: respostaData.numeroNC,
          artigo_portaria: itemData.artigo_portaria || '',
          descricao: ncDescricao,
          fotos: []
        });

        // Criar Determinação
        const textoDet = itemData.texto_determinacao || 'regularizar a situação identificada';
        const textoFinalDet = `Para sanar a ${respostaData.numeroNC} ${textoDet}. Prazo: 30 dias.`;

        await this.create('Determinacao', {
          unidade_fiscalizada_id: unidadeId,
          nao_conformidade_id: nc.id,
          numero_determinacao: respostaData.numeroDeterminacao,
          descricao: textoFinalDet,
          prazo_dias: 30,
          status: 'pendente'
        });

        // Criar Recomendação se existir
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
      console.error('Erro ao criar resposta com NC e determinação:', error);
      throw error;
    }
  }

  /**
   * Calcula próxima numeração para C, NC, D, R lendo dados locais
   */
  async calcularProximaNumeracao(unidadeId) {
    try {
      // Ler todas as respostas com constatação
      const respostas = await this.readLocalData('respostas_checklist', { 
        unidade_fiscalizada_id: unidadeId 
      });
      const respostasComConstatacao = respostas.filter(r => 
        (r.resposta === 'SIM' || r.resposta === 'NAO') && r.pergunta?.trim()
      ).length;

      // Ler constatações manuais
      const constatacoes = await this.readLocalData('constatacoes_manuais', { 
        unidade_fiscalizada_id: unidadeId 
      });

      // Ler NCs, Determinações e Recomendações
      const ncs = await this.readLocalData('nao_conformidades', { 
        unidade_fiscalizada_id: unidadeId 
      });
      const dets = await this.readLocalData('determinacoes', { 
        unidade_fiscalizada_id: unidadeId 
      });
      const recs = await this.readLocalData('recomendacoes', { 
        unidade_fiscalizada_id: unidadeId 
      });

      return {
        C: respostasComConstatacao + constatacoes.length + 1,
        NC: ncs.length + 1,
        D: dets.length + 1,
        R: recs.length + 1
      };
    } catch (error) {
      console.error('Erro ao calcular próxima numeração:', error);
      return { C: 1, NC: 1, D: 1, R: 1 };
    }
  }
}

export const DataService = new DataServiceClass();
export default DataService;