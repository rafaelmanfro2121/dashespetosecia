import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { financialData, type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let userPrompt = "";
    let shouldStream = true;

    if (type === "chat") {
      systemPrompt = `Você é o consultor financeiro IA da Espetos & Cia, empresa que fabrica churrasqueiras rotativas sob medida.
Você tem acesso completo aos dados financeiros da empresa e deve responder de forma estratégica, sempre buscando maximizar o retorno financeiro.

DADOS FINANCEIROS ATUAIS:
${JSON.stringify({
  faturamento: financialData.closing?.totalRevenue,
  despesas: financialData.closing?.totalExpenses,
  lucroLiquido: financialData.closing?.netProfit,
  margem: financialData.closing?.margin,
  categorias: financialData.categoryBreakdown,
  produtos: financialData.products,
  funcionarios: financialData.employeeCount,
}, null, 2)}

REGRAS:
- Sempre use valores em R$ e percentuais concretos
- Seja direto e estratégico
- Sugira ações práticas para aumentar lucro
- Se perguntarem sobre preço, calcule com margem mínima de 30%
- Analise custos de matéria-prima e sugira otimizações
- Compare margens entre produtos e destaque os mais rentáveis
- Identifique desperdícios e oportunidades
- Responda em português brasileiro com markdown`;

      const chatHistory = financialData.chatHistory || [];
      const messages = [
        { role: "system", content: systemPrompt },
        ...chatHistory.map((m: any) => ({ role: m.role, content: m.content })),
      ];

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        return handleAIError(response);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });

    } else if (type === "daily") {
      systemPrompt = `Você é um analista financeiro da Espetos & Cia (churrasqueiras rotativas sob medida).
Analise os dados do dia e gere um relatório conciso:
1. Resumo das entradas e saídas
2. Observações sobre gastos
3. Alertas de gastos atípicos
4. Sugestão para o dia seguinte
Tom: profissional, direto. Português brasileiro com markdown.`;
      userPrompt = `Dados do dia:\n${JSON.stringify(financialData, null, 2)}`;
    } else if (type === "monthly") {
      systemPrompt = `Você é um consultor financeiro sênior da Espetos & Cia (churrasqueiras rotativas sob medida).
Gere um relatório estratégico mensal:
1. **Diagnóstico Financeiro**: receitas, despesas, lucro detalhado
2. **Análise por Produto**: custo total, margem por modelo de churrasqueira, se o preço está adequado
3. **Análise de Matéria-Prima**: se custos estão altos, informe EXATAMENTE quanto subir no preço para manter margem ≥30%
4. **Desperdícios**: gastos excessivos com valores concretos
5. **Alertas Críticos**: situações urgentes
6. **Precificação**: para margem <30%, calcule o novo preço necessário
7. **Estratégias**: ações concretas para aumentar lucro
8. **Projeção**: tendência para o próximo mês

Use dados concretos em R$ e %. Português brasileiro com markdown.`;
      userPrompt = `Dados do mês:\n${JSON.stringify(financialData, null, 2)}`;
    } else {
      // NLP parsing
      shouldStream = false;
      systemPrompt = `Você é um assistente financeiro da Espetos & Cia (churrasqueiras rotativas).
Extraia informações da mensagem e retorne APENAS JSON:
{
  "description": "descrição",
  "amount": número,
  "type": "entrada" ou "saida",
  "category": "Materiais, Aço, Mão de Obra, Energia, Aluguel, Manutenção, Vendas, Transporte, Alimentação, Outros",
  "payment_method": "Dinheiro, Pix, Cartão, Transferência ou Não especificado"
}`;
      userPrompt = financialData.message;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: shouldStream,
      }),
    });

    if (!response.ok) {
      return handleAIError(response);
    }

    if (shouldStream) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      return new Response(JSON.stringify({ result: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ error: "Não consegui interpretar", raw: content }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleAIError(response: Response) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  };

  if (response.status === 429) {
    return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (response.status === 402) {
    return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
      status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const t = await response.text();
  console.error("AI error:", response.status, t);
  return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
    status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
