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
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    return dbp;
  }

  function tx(store, mode, fn) {
    return abrir().then((db) => new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const os = t.objectStore(store);
      let out;
      Promise.resolve(fn(os)).then((v) => { out = v; });
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
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

  /* Grava um registro sincronizavel (marca como pendente de envio) */
  DB.salvar = async function (store, obj, usuario) {
    obj.id = obj.id || DB.uuid();
    const agora = new Date().toISOString();
    obj.criadoEm = obj.criadoEm || agora;
    obj.criadoPor = obj.criadoPor || usuario || '';
    obj.atualizadoEm = agora;
    obj.atualizadoPor = usuario || '';
    obj._pendente = true;
    await DB.put(store, obj);
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
