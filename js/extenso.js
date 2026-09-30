/* Numeros e datas por extenso (pt-BR) */
(function (root) {
  const UN = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze',
    'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const DZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const CT = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos',
    'oitocentos', 'novecentos'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro',
    'novembro', 'dezembro'];

  function ate999(n) {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    const c = Math.floor(n / 100), r = n % 100, p = [];
    if (c) p.push(CT[c]);
    if (r) {
      if (r < 20) p.push(UN[r]);
      else {
        const d = Math.floor(r / 10), u = r % 10;
        p.push(u ? DZ[d] + ' e ' + UN[u] : DZ[d]);
      }
    }
    return p.join(' e ');
  }

  const ESC = [['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões'], ['trilhão', 'trilhões']];

  function inteiro(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'zero';
    const grupos = [];
    while (n > 0) { grupos.push(n % 1000); n = Math.floor(n / 1000); }
    const partes = [];
    for (let i = grupos.length - 1; i >= 0; i--) {
      const g = grupos[i];
      if (!g) continue;
      let txt;
      if (i === 1 && g === 1) txt = 'mil';
      else txt = ate999(g) + (i ? ' ' + (g === 1 ? ESC[i][0] : ESC[i][1]) : '');
      partes.push({ txt, g, i });
    }
    // conector: " e " antes do ultimo grupo se ele for < 100 ou multiplo de 100; senao ", "
    let out = '';
    partes.forEach((p, k) => {
      if (k === 0) out = p.txt;
      else {
        const ultimo = k === partes.length - 1;
        const usaE = ultimo && (p.g < 100 || p.g % 100 === 0);
        out += (usaE ? ' e ' : ', ') + p.txt;
      }
    });
    return out;
  }

  function moeda(valor) {
    if (valor === null || valor === undefined || valor === '' || isNaN(valor)) return '';
    const v = Math.round(Number(valor) * 100);
    const reais = Math.floor(v / 100), cent = v % 100;
    let s = '';
    if (reais) {
      s = inteiro(reais);
      const deReais = reais >= 1000000 && reais % 1000000 === 0;
      s += deReais ? ' de reais' : (reais === 1 ? ' real' : ' reais');
    }
    if (cent) s += (reais ? ' e ' : '') + inteiro(cent) + (cent === 1 ? ' centavo' : ' centavos');
    return s || 'zero reais';
  }

  function formatarMoeda(valor) {
    if (valor === null || valor === undefined || valor === '' || isNaN(valor)) return '';
    return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function parseMoeda(txt) {
    if (typeof txt === 'number') return txt;
    if (!txt) return null;
    const s = String(txt).replace(/[^\d,.-]/g, '');
    if (!s) return null;
    const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
    return isNaN(n) ? null : n;
  }

  // 'aaaa-mm-dd' -> Date local
  function toDate(iso) {
    if (!iso) return null;
    if (iso instanceof Date) return iso;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  function dataBR(iso) {
    const d = toDate(iso);
    if (!d) return '';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }

  function dataExtenso(iso) {
    const d = toDate(iso);
    if (!d) return '';
    return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
  }

  function hojeISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  const api = { inteiro, moeda, formatarMoeda, parseMoeda, dataBR, dataExtenso, hojeISO, toDate, MESES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Extenso = api;
})(typeof self !== 'undefined' ? self : this);
