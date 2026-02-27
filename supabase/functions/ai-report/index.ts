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

    if (type === "daily") {
      systemPrompt = `Você é um analista financeiro especializado em negócios de churrasqueiras rotativas (Espetos & Cia).
Analise os dados financeiros do dia fornecidos e gere um relatório conciso com:
1. Resumo das entradas e saídas do dia
2. Observações sobre os gastos
3. Alertas se houver gastos atípicos
4. Sugestão rápida para o dia seguinte
Tom: profissional, direto, focado em números. Responda em português brasileiro com formatação markdown.`;
      userPrompt = `Dados financeiros do dia:\n${JSON.stringify(financialData, null, 2)}`;
    } else if (type === "monthly") {
      systemPrompt = `Você é um consultor financeiro sênior especializado em empresas de churrasqueiras rotativas (Espetos & Cia).
Gere um relatório estratégico mensal completo com:
1. **Diagnóstico Financeiro**: análise detalhada de receitas, despesas e lucro
2. **Análise de Custos de Produção por Produto**: para cada produto/modelo de churrasqueira, calcule custo total de produção, margem de lucro por unidade, e se o preço de venda está adequado
3. **Análise de Matéria-Prima**: compare os custos de materiais pagos com os preços de mercado. Se estiver pagando mais caro, INFORME EXATAMENTE quanto deve subir o preço do produto para manter a margem desejada (mínimo 30%)
4. **Identificação de Desperdícios**: aponte onde há gastos excessivos com valores concretos
5. **Alertas Críticos**: situações que precisam de atenção imediata
6. **Sugestões de Precificação**: se algum produto tem margem abaixo de 30%, calcule exatamente o novo preço de venda necessário
7. **Sugestões Estratégicas**: ações concretas para aumentar margem de lucro
8. **Projeção**: com base na tendência, projete o próximo mês

IMPORTANTE: Use dados concretos com valores em R$, percentuais e comparações específicas. 
Se os dados de produtos estiverem disponíveis, calcule a margem de contribuição de cada um e sugira ajustes de preço quando necessário.
Tom: profissional, analítico, direto. Responda em português brasileiro com formatação markdown.`;
      userPrompt = `Dados financeiros do mês:\n${JSON.stringify(financialData, null, 2)}`;
    } else {
      // NLP transaction parsing
      systemPrompt = `Você é um assistente financeiro da Espetos & Cia (churrasqueiras rotativas).
O usuário vai enviar uma mensagem descrevendo uma movimentação financeira.
Extraia as informações e retorne APENAS um JSON válido com:
{
  "description": "descrição da movimentação",
  "amount": número (valor em reais),
  "type": "entrada" ou "saida",
  "category": "uma dessas categorias: Alimentação, Bebidas, Carne, Funcionários, Energia, Água, Aluguel, Manutenção, Materiais, Vendas, Outros",
  "payment_method": "Dinheiro, Pix, Cartão, Transferência ou Não especificado"
}
Não inclua nenhum texto antes ou depois do JSON.`;
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
        stream: type === "monthly" || type === "daily",
      }),
    });

    if (!response.ok) {
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

    if (type === "monthly" || type === "daily") {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // For NLP parsing, return JSON directly
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Try to parse the JSON from the AI response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      return new Response(JSON.stringify({ result: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ error: "Não consegui interpretar a mensagem", raw: content }), {
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
