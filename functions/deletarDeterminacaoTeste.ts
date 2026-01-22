import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // Buscar a determinação de teste
        const determinacoes = await base44.asServiceRole.entities.Determinacao.filter({
            unidade_fiscalizada_id: "test-id"
        });

        if (determinacoes.length === 0) {
            return Response.json({ message: 'Determinação de teste não encontrada' });
        }

        const determinacaoId = determinacoes[0].id;

        // Deletar RespostaDeterminacao relacionadas
        const respostas = await base44.asServiceRole.entities.RespostaDeterminacao.filter({
            determinacao_id: determinacaoId
        });
        for (const resposta of respostas) {
            await base44.asServiceRole.entities.RespostaDeterminacao.delete(resposta.id);
        }

        // Deletar AutoInfracao relacionados
        const autos = await base44.asServiceRole.entities.AutoInfracao.filter({
            determinacao_id: determinacaoId
        });
        for (const auto of autos) {
            await base44.asServiceRole.entities.AutoInfracao.delete(auto.id);
        }

        // Deletar a determinação
        await base44.asServiceRole.entities.Determinacao.delete(determinacaoId);

        return Response.json({ 
            success: true, 
            message: 'Determinação de teste excluída com sucesso'
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});