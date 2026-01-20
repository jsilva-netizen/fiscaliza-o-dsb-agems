// Sistema centralizado de numeração para Constatações, NC e Determinações
// Evita duplicações e fornece números únicos em tempo real

export const getNumerationCounters = (respostas, ncs, determinacoes) => {
    const constatacoes = respostas
        .filter(r => r.numero_constatacao)
        .map(r => parseInt(r.numero_constatacao.replace('C', '')))
        .filter(n => !isNaN(n));
    
    const numerosNC = ncs
        .map(nc => parseInt(nc.numero_nc?.replace('NC', '') || '0'))
        .filter(n => !isNaN(n));
    
    const numerosDet = determinacoes
        .map(d => parseInt(d.numero_determinacao?.replace('D', '') || '0'))
        .filter(n => !isNaN(n));

    return {
        proximaConstatacao: constatacoes.length > 0 ? Math.max(...constatacoes) + 1 : 1,
        proximaNC: numerosNC.length > 0 ? Math.max(...numerosNC) + 1 : 1,
        proximaDeterminacao: numerosDet.length > 0 ? Math.max(...numerosDet) + 1 : 1
    };
};

export const gerarNumeroConstatacao = (respostas) => {
    const numeros = respostas
        .filter(r => r.numero_constatacao)
        .map(r => parseInt(r.numero_constatacao.replace('C', '')))
        .filter(n => !isNaN(n));
    
    const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
    return `C${proximo}`;
};

export const gerarNumeroNC = (ncs) => {
    const numeros = ncs
        .map(nc => parseInt(nc.numero_nc?.replace('NC', '') || '0'))
        .filter(n => !isNaN(n));
    
    const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
    return `NC${proximo}`;
};

export const gerarNumeroDeterminacao = (determinacoes) => {
    const numeros = determinacoes
        .map(d => parseInt(d.numero_determinacao?.replace('D', '') || '0'))
        .filter(n => !isNaN(n));
    
    const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
    return `D${proximo}`;
};