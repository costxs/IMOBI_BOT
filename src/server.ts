import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { connectDB, PropertyModel } from './database';
import { analisarMensagemComGemini, FiltrosImovel } from './gemini';

// Load environment variables
dotenv.config({ override: true });

console.log("Minha chave foi carregada?", process.env.GEMINI_API_KEY ? "SIM! ✅" : "NÃO (está undefined) ❌");

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());
app.use(cors());

// Basic route to check if server is running
app.get('/', (req: Request, res: Response) => {
    res.send('Imobi.bot.ai Server is Running!');
});

// Helper function to send messages using Official WhatsApp API
async function sendWhatsAppMessage(phoneNumberID: string, to: string, text: string) {
    const url = `https://graph.facebook.com/v19.0/${phoneNumberID}/messages`;
    const token = process.env.WHATSAPP_TOKEN;

    try {
        await axios.post(
            url,
            {
                messaging_product: 'whatsapp',
                to: to,
                type: 'text',
                text: { body: text }
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(`[Message Sent] to ${to}`);
    } catch (error: any) {
        console.error('Error sending message:', error.response?.data || error.message);
    }
}

// ============================================
// WHATSAPP WEBHOOK VERIFICATION (GET)
// ============================================
app.get('/webhook', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            console.log('Verification failed: tokens do not match.');
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// ============================================
// WHATSAPP MESSAGE RECEIVER (POST)
// ============================================
app.post('/webhook', async (req: Request, res: Response) => {
    const body = req.body;

    if (body.object) {
        if (
            body.entry &&
            body.entry[0].changes &&
            body.entry[0].changes[0] &&
            body.entry[0].changes[0].value.messages &&
            body.entry[0].changes[0].value.messages[0]
        ) {
            const metadata = body.entry[0].changes[0].value.metadata;
            const phoneNumberID = metadata ? metadata.phone_number_id : null;
            const message = body.entry[0].changes[0].value.messages[0];
            const from = message.from; // sender's phone number

            let msgBody = '';
            if (message.type === 'text') {
                msgBody = message.text.body;
            }

            console.log(`[Message Received] from ${from}: ${message.type === 'location' ? 'Location Pin' : msgBody}`);

            if (phoneNumberID) {
                if (message.type === 'location') {
                    const latitude = message.location.latitude;
                    const longitude = message.location.longitude;

                    await sendWhatsAppMessage(phoneNumberID, from, `📍 Recebi sua localização (Lat: ${latitude}, Lng: ${longitude}).\n\nBuscando imóveis num raio de 5km... 🔎`);

                    try {
                        const properties = await PropertyModel.find({
                            location: {
                                $near: {
                                    $geometry: {
                                        type: "Point",
                                        coordinates: [longitude, latitude] // Mongoose/GeoJSON uses [longitude, latitude]
                                    },
                                    $maxDistance: 5000 // In meters (5km)
                                }
                            }
                        }).limit(3);

                        if (properties.length > 0) {
                            let responseText = `✨ Encontrei ${properties.length} imóveis perto de você:\n\n`;
                            properties.forEach((prop, index) => {
                                responseText += `*${index + 1}. ${prop.title}*\n💰 R$ ${prop.price}\n📝 ${prop.description}\n\n`;
                            });
                            await sendWhatsAppMessage(phoneNumberID, from, responseText);
                        } else {
                            // AUTO POPULADOR MÁGICO PARA WOW EFFECT
                            await sendWhatsAppMessage(phoneNumberID, from, '⚠️ Notei que a base de dados do MongoDB está vazia para esta região! Como este é um teste, acabei de criar automaticamente 2 imóveis falsos pertinho de você.\n\nPor favor, *envie sua localização novamente* para ver a mágica geoespacial funcionar! 🚀');

                            // Adicionamos pequenos offsets geográficos para criar propriedades bem próximas ao usuário
                            await PropertyModel.create([
                                {
                                    title: "Apartamento Luxo (Demonstração)",
                                    description: "3 quartos, suíte e varanda gourmet. Imóvel gerado automaticamente para testes.",
                                    price: 850000,
                                    type: "apartamento",
                                    location: { type: "Point", coordinates: [longitude + 0.002, latitude + 0.002] }
                                },
                                {
                                    title: "Casa de Vila aconchegante (Demonstração)",
                                    description: "Casa pronta para morar com quintal e garagem para 2 carros.",
                                    price: 450000,
                                    type: "casa",
                                    location: { type: "Point", coordinates: [longitude - 0.003, latitude + 0.001] }
                                }
                            ]);
                            console.log('✅ Imóveis mock gerados e salvos no MongoDB com sucesso!');
                        }
                    } catch (error) {
                        console.error('Erro na busca geoespacial:', error);
                        await sendWhatsAppMessage(phoneNumberID, from, '⚠️ Como ainda não inserimos o `MONGO_URI` no arquivo `.env`, o banco não conectou de verdade. (Esse é o comportamento esperado por enquanto!)');
                    }
                } else if (msgBody) {
                    const texto = msgBody.toLowerCase();
                    const saudacoes = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'menu'];

                    if (saudacoes.includes(texto)) {
                        const msgBoasVindas = `👋 Olá! Eu sou o *Imobi Bot*, seu assistente virtual imobiliário.\n\nComo posso ajudar você hoje?\n\n*1️⃣* - Comprar imóvel📍\n*2️⃣* - Alugar imóvel\n\nOu simplesmente *descreva o que procura* (ex: "Quero comprar uma casa de 3 quartos no Centro por até 400 mil") e a nossa IA fará a busca pra você! 🤖`;
                        await sendWhatsAppMessage(phoneNumberID, from, msgBoasVindas);
                    } else if (texto === '1') {
                        await sendWhatsAppMessage(phoneNumberID, from, '📍 Ótimo! Por favor, clique no botão de "Anexo" (+) do WhatsApp e me envie a sua **Localização atual** para eu buscar os imóveis próximos a você!');
                    } else if (texto === '2') {
                        await sendWhatsAppMessage(phoneNumberID, from, '🔑 Perfeito para locação! Você está buscando um imóvel comercial ou residencial?');
                    } else {
                        // ============================================
                        // ANÁLISE INTELIGENTE COM GEMINI AI
                        // ============================================
                        await sendWhatsAppMessage(phoneNumberID, from, '🤖 Analisando sua mensagem com IA... Um momento!');

                        const filtros = await analisarMensagemComGemini(msgBody);

                        if (filtros) {
                            // Monta a query do MongoDB dinamicamente com os filtros extraídos
                            const query: any = {};

                            if (filtros.tipo_imovel) {
                                query.type = filtros.tipo_imovel;
                            }
                            if (filtros.orcamento_maximo) {
                                query.price = { $lte: filtros.orcamento_maximo };
                            }

                            // Resumo dos filtros para o usuário
                            let resumo = '🔍 *Filtros detectados pela IA:*\n';
                            resumo += `• Negócio: ${filtros.tipo_negocio || 'Não especificado'}\n`;
                            resumo += `• Tipo: ${filtros.tipo_imovel || 'Qualquer'}\n`;
                            resumo += `• Orçamento máx: ${filtros.orcamento_maximo ? `R$ ${filtros.orcamento_maximo.toLocaleString('pt-BR')}` : 'Não informado'}\n`;
                            resumo += `• Quartos: ${filtros.quartos || 'Qualquer'}\n`;
                            resumo += `• Bairro: ${filtros.bairro_desejado || 'Qualquer'}\n`;

                            await sendWhatsAppMessage(phoneNumberID, from, resumo);

                            try {
                                const properties = await PropertyModel.find(query).limit(5);

                                if (properties.length > 0) {
                                    let responseText = `✨ Encontrei ${properties.length} imóveis para você:\n\n`;
                                    properties.forEach((prop, index) => {
                                        responseText += `*${index + 1}. ${prop.title}*\n💰 R$ ${prop.price.toLocaleString('pt-BR')}\n📝 ${prop.description}\n\n`;
                                    });
                                    await sendWhatsAppMessage(phoneNumberID, from, responseText);
                                } else {
                                    await sendWhatsAppMessage(phoneNumberID, from, '😕 Não encontrei imóveis com esses critérios no momento. Tente ajustar os filtros ou envie sua *localização* para buscar por proximidade!');
                                }
                            } catch (dbError) {
                                console.error('Erro ao buscar imóveis com filtros Gemini:', dbError);
                                await sendWhatsAppMessage(phoneNumberID, from, '⚠️ Ocorreu um erro ao buscar no banco de dados. Tente novamente em instantes.');
                            }
                        } else {
                            await sendWhatsAppMessage(phoneNumberID, from, '🤔 Não consegui entender sua mensagem. Tente descrever o imóvel que busca ou envie *menu* para ver as opções.');
                        }
                    }
                }
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// Start the Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Waiting for WhatsApp Webhook requests on http://localhost:${PORT}/webhook...`);
});
