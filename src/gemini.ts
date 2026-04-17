import { GoogleGenerativeAI } from '@google/generative-ai';

export interface FiltrosImovel {
    tipo_negocio: 'compra' | 'aluguel' | null;
    tipo_imovel: 'casa' | 'apartamento' | 'terreno' | null;
    orcamento_maximo: number | null;
    quartos: number | null;
    bairro_desejado: string | null;
}


export async function analisarMensagemComGemini(mensagemCliente: string): Promise<FiltrosImovel | null> {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const prompt = `Você é um assistente de imobiliária. Sua única função é ler a mensagem do usuário e extrair os filtros de busca de imóveis. 
    Você deve responder estritamente com um objeto JSON contendo as seguintes chaves: 
    - tipo_negocio (compra ou aluguel)
    - tipo_imovel (casa, apartamento, terreno)
    - orcamento_maximo (numero inteiro)
    - quartos (numero inteiro)
    - bairro_desejado (texto). 
    Se o usuário não informar um dado, preencha o valor como null.

    Mensagem do cliente: "${mensagemCliente}"`;

    
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        
        const filtros = JSON.parse(responseText) as FiltrosImovel;

        console.log("🤖 Filtros extraídos pelo Gemini:", JSON.stringify(filtros, null, 2));

        return filtros;

    } catch (error) {
        console.error("❌ Erro na API do Gemini:", error);
        return null;
    }
}
