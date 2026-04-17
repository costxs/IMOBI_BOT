import { GoogleGenerativeAI } from '@google/generative-ai';

// Colocando a chave DIRETO no código apenas para esse teste
const API_KEY = "AIzaSyBwDOgXHkQA7qjLUSz8sRh2AR41P8THA7o";

async function testarChave() {
    console.log("Iniciando teste...");
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        // Vou usar o 1.5-flash como você pediu, mas o erro de API key invalid acontece ANTES da checagem do modelo
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        console.log("Enviando mensagem para a IA...");
        const result = await model.generateContent("Responda apenas com a palavra: Sucesso");

        console.log("🟢 RESPOSTA DA IA:", result.response.text());
    } catch (erro) {
        console.error("🔴 ERRO:", erro);
    }
}

testarChave();
