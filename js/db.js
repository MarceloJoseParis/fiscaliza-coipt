/* Banco local (IndexedDB) - funciona 100% offline */
(function (root) {
  const NOME = 'notificacoes-app';
  const VERSAO = 2;
  const STORES = ['registros', 'pessoas', 'notificacoes', 'fotos', 'visitas', 'config', 'blobs', 'arquivos', 'kv'];
  let dbp = null;

  function abrir() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const rq = indexedDB.open(NOME, VERSAO);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) {
            const os = db.createObjectStore(s, { keyPath: s === 'blobs' || s === 'arquivos' || s === 'kv' ? 'k' : 'id' });
            if (s === 'notificacoes' || s === 'fotos' || s === 'visitas') os.createIndex('registroId', 'registroId');
          }
        }
        const fotos = rq.transaction.objectStore('fotos');
        if (!fotos.indexNames.contains('visitaId')) fotos.createIndex('visitaId', 'visitaId');
      };
      rq.onsuccess = () => {
        const db = rq.result;
        // o iPhone pode derrubar a conexão com o banco quando o app fica em segundo plano:
        // esquece a conexão para reabrir na próxima operação (antes, tudo falhava até fechar o app)
        const esquecer = () => { try { db.close(); } catch (e) { /* */ } dbp = null; };
        db.onclose = esquecer;
        db.onversionchange = esquecer;
        res(db);
      };
      rq.onerror = () => { dbp = null; rej(rq.error || new Error('Não foi possível abrir o banco local.')); };
      rq.onblocked = () => { dbp = null; rej(new Error('Banco local bloqueado por outra aba do app. Feche as outras abas e abra de novo.')); };
    });
    return dbp;
  }

  function tx(store, mode, fn, tentativa) {
    return abrir().then((db) => new Promise((res, rej) => {
      let t;
      try { t = db.transaction(store, mode); } catch (e) {
        // conexão perdida (InvalidStateError): reabre e tenta uma vez
        dbp = null;
        if (!tentativa) { tx(store, mode, fn, 1).then(res, rej); return; }
        rej(e); return;
      }
      const os = t.objectStore(store);
      let out, erroFn = null;
      // erro dentro da operação: cancela a transação e avisa quem chamou (antes o erro sumia e parecia "salvo")
      Promise.resolve(fn(os)).then((v) => { out = v; }, (e) => { erroFn = e || new Error('Falha no banco local'); try { t.abort(); } catch (x) { /* já terminou */ } });
      t.oncomplete = () => (erroFn ? rej(erroFn) : res(out));
      t.onerror = (ev) => rej(erroFn || (ev && ev.target && ev.target.error) || t.error || new Error('Falha no banco local'));
      t.onabort = () => rej(erroFn || t.error || new Error('Operação no banco local cancelada'));
    }));
  }
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  const DB = {
    get: (store, id) => tx(store, 'readonly', (os) => req(os.get(id))),
    all: (store) => tx(store, 'readonly', (os) => req(os.getAll())),
    byIndex: (store, idx, val) => tx(store, 'readonly', (os) => req(os.index(idx).getAll(val))),
    put: (store, obj) => tx(store, 'readwrite', (os) => req(os.put(obj))),
    putMany: (store, arr) => tx(store, 'readwrite', (os) => Promise.all(arr.map((o) => req(os.put(o))))),
    del: (store, id) => tx(store, 'readwrite', (os) => req(os.delete(id))),
    clear: (store) => tx(store, 'readwrite', (os) => req(os.clear())),
    async kvGet(k, def) { const r = await DB.get('kv', k); return r ? r.v : def; },
    kvSet: (k, v) => DB.put('kv', { k, v }),
    async blobGet(id) { const r = await DB.get('blobs', id); return r ? r.blob : null; },
    blobSet: (id, blob) => DB.put('blobs', { k: id, blob }),
    async arquivoGet(k) { return DB.get('arquivos', k); },
    arquivoSet: (k, blob, info) => DB.put('arquivos', Object.assign({ k, blob }, info || {})),
  };

  DB.uuid = function () {
    if (root.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  };

  /* Lê e grava o mesmo registro numa única transação (ninguém grava no meio).
     fn(atual) devolve o novo objeto, ou undefined para não gravar. Não use await dentro de fn. */
  DB.atualizar = (store, id, fn) => tx(store, 'readwrite', (os) => new Promise((res, rej) => {
    const g = os.get(id);
    g.onerror = () => rej(g.error);
    g.onsuccess = () => {
      let novo;
      try { novo = fn(g.result); } catch (e) { rej(e); return; }
      if (novo === undefined) { res(g.result); return; }
      const p = os.put(novo);
      p.onsuccess = () => res(novo);
      p.onerror = () => rej(p.error);
    };
  }));

  /* Carimbo de alteração: nunca anterior ao da versão atual (relógio do celular atrasado não pode
     fazer uma edição "perder" para a versão que ela mesma está alterando). */
  DB.carimbo = function (anterior) {
    const agora = Date.now();
    const ant = Date.parse(anterior || '') || 0;
    return new Date(Math.max(agora, ant + 1)).toISOString();
  };

  /* Controle por campo: enquanto um registro está pendente, guarda QUAIS campos foram alterados neste
     aparelho (_campos: campo -> hora da alteração) e o valor que tinham antes (_base, em JSON).
     Assim, se outro aparelho alterou OUTROS campos do mesmo registro, as duas alterações são mantidas
     (antes, a versão inteira mais nova vencia e a outra alteração se perdia). */
  const SISTEMA = new Set(['id', 'atualizadoEm', 'atualizadoPor', 'criadoEm', 'criadoPor', '_pendente', '_campos', '_base']);
  const js = (v) => String(JSON.stringify(v));
  DB.CAMPOS_LOCAIS = ['_pendente', '_campos', '_base'];
  DB.marcarCampos = function (antes, depois, quando) {
    if (!antes || !depois) return depois;
    if (antes._pendente && !antes._campos) { delete depois._campos; delete depois._base; return depois; } // pendente de versão antiga: sem controle
    const campos = Object.assign({}, antes._pendente ? antes._campos : null);
    const base = Object.assign({}, antes._pendente ? antes._base : null);
    for (const k of new Set([...Object.keys(antes), ...Object.keys(depois)])) {
      if (SISTEMA.has(k)) continue;
      const a = js(antes[k]);
      if (a === js(depois[k])) continue;
      if (!(k in campos)) base[k] = a;
      campos[k] = quando;
    }
    depois._campos = campos; depois._base = base;
    return depois;
  };

  /* Grava um registro sincronizavel (marca como pendente de envio) */
  DB.salvar = async function (store, obj, usuario) {
    obj.id = obj.id || DB.uuid();
    await DB.atualizar(store, obj.id, (antes) => {
      const ref = antes && String(antes.atualizadoEm || '') > String(obj.atualizadoEm || '') ? antes.atualizadoEm : obj.atualizadoEm;
      const agora = DB.carimbo(ref);
      obj.criadoEm = obj.criadoEm || agora;
      obj.criadoPor = obj.criadoPor || usuario || '';
      obj.atualizadoEm = agora;
      obj.atualizadoPor = usuario || '';
      if (antes) DB.marcarCampos(antes, obj, agora); else { delete obj._campos; delete obj._base; }
      obj._pendente = true;
      return obj;
    });
    if (root.App && App.agendarSync) App.agendarSync();
    return obj;
  };

  DB.excluir = async function (store, id, usuario) {
    const o = await DB.get(store, id);
    if (!o) return;
    o.excluido = true;
    return DB.salvar(store, o, usuario);
  };

  DB.listar = async function (store, filtro) {
    const arr = (await DB.all(store)).filter((o) => !o.excluido);
    return filtro ? arr.filter(filtro) : arr;
  };

  root.DB = DB;
})(self);
