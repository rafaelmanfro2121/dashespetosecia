import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Handle cost recalculation
    if (type === "recalculate-costs") {
      return await handleCostRecalculation(financialData, LOVABLE_API_KEY);
    }

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
- IMPORTANTE: Quando o usuário mencionar compra de material, calcule como isso impacta o custo de produção por unidade
- Se o custo do material subiu, informe EXATAMENTE quanto deve subir o preço de cada produto afetado para manter margem ≥30%
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

      if (!response.ok) return handleAIError(response);

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

IMPORTANTE sobre compras de material:
- Compare o custo unitário atual com compras anteriores
- Se o preço do material subiu, calcule o impacto no custo de cada produto
- Sugira o novo preço de venda para manter margem ≥30%
- Exemplo: "Inox subiu de R$X para R$Y por chapa. Cada churrasqueira usa Z chapas. Custo adicional: R$W. Novo preço sugerido: R$V"

Use dados concretos em R$ e %. Português brasileiro com markdown.`;
      userPrompt = `Dados do mês:\n${JSON.stringify(financialData, null, 2)}`;
    } else {
      // NLP parsing — enhanced to detect material purchases
      shouldStream = false;
      systemPrompt = `Você é um assistente financeiro da Espetos & Cia (churrasqueiras rotativas).
A empresa compra materiais como: aço inox, chapas, tubos, motores, tintas, parafusos, etc.

Extraia informações da mensagem e retorne APENAS JSON:
{
  "description": "descrição",
  "amount": número total gasto,
  "type": "entrada" ou "saida",
  "category": "Materiais, Aço, Mão de Obra, Energia, Aluguel, Manutenção, Vendas, Transporte, Alimentação, Outros",
  "payment_method": "Dinheiro, Pix, Cartão, Transferência ou Não especificado",
  "is_material_purchase": true/false (se é compra de material para produção),
  "material_name": "nome do material se for compra (ex: 'Chapa de Inox', 'Tubo de Aço')" ou null,
  "quantity": número de unidades compradas ou null,
  "unit_price": preço por unidade ou null
}

Exemplos:
- "Comprei 5 chapas de inox por 800" → is_material_purchase: true, material_name: "Chapa de Inox", quantity: 5, unit_price: 160, amount: 800
- "Paguei a conta de luz 350" → is_material_purchase: false
- "Comprei 10 metros de tubo por 500" → is_material_purchase: true, material_name: "Tubo de Aço", quantity: 10, unit_price: 50, amount: 500`;
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

    if (!response.ok) return handleAIError(response);

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

async function handleCostRecalculation(financialData: any, apiKey: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, supabaseKey);

  // Get current products
  const { data: products } = await sb.from("products").select("*").eq("is_active", true);
  if (!products || products.length === 0) {
    return new Response(JSON.stringify({ message: "Nenhum produto para recalcular" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { materialName, newCost, quantity } = financialData;
  const unitCost = quantity > 0 ? newCost / quantity : newCost;

  // Ask AI to figure out which products are affected and how to update costs
  const prompt = `Dado que a empresa comprou "${materialName}" (${quantity} unidades por R$${newCost} total, custo unitário R$${unitCost.toFixed(2)}), analise os produtos abaixo e retorne APENAS um JSON array com os produtos que devem ter o custo de material atualizado.

Produtos atuais:
${JSON.stringify(products.map(p => ({
  id: p.id, name: p.name, material_cost: p.material_cost, sale_price: p.sale_price
})), null, 2)}

Retorne APENAS JSON array (sem texto extra):
[{"id": "uuid", "new_material_cost": número}]

Regras:
- Se o material comprado é usado na fabricação de churrasqueiras (aço, inox, chapas, tubos, motores, etc), atualize todos os produtos ativos
- O novo custo de material deve refletir o custo unitário atualizado
- Se o material não é relevante para nenhum produto, retorne []`;

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Você é um assistente de custo de produção. Retorne APENAS JSON válido." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!aiResponse.ok) {
    return new Response(JSON.stringify({ error: "Erro ao recalcular custos" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const aiData = await aiResponse.json();
  const aiContent = aiData.choices?.[0]?.message?.content || "[]";
  
  try {
    const arrayMatch = aiContent.match(/\[[\s\S]*\]/);
    const updates: Array<{id: string, new_material_cost: number}> = arrayMatch ? JSON.parse(arrayMatch[0]) : [];

    for (const update of updates) {
      await sb.from("products").update({ material_cost: update.new_material_cost }).eq("id", update.id);
    }

    return new Response(JSON.stringify({ 
      message: `${updates.length} produto(s) atualizado(s)`,
      updates 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Erro ao processar recálculo" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleAIError(response: Response) {
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
