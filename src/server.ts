import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());
app.use(cors());

// Basic route to check if server is running
app.get('/', (req: Request, res: Response) => {
    res.send('Imobi.bot.ai Server is Running!');
});

// ============================================
// WHATSAPP WEBHOOK VERIFICATION (GET)
// ============================================
// Meta will hit this URL with a GET request to verify your webhook.
app.get('/webhook', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

    // Check if a token and mode were sent
    if (mode && token) {
        // Check the mode and token sent are correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            console.log('Verification failed: tokens do not match.');
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    } else {
        // Responds with '400 Bad Request' if no token or mode
        res.sendStatus(400);
    }
});

// ============================================
// WHATSAPP MESSAGE RECEIVER (POST)
// ============================================
// Meta will POST to this URL when a user sends a message to your bot.
app.post('/webhook', (req: Request, res: Response) => {
    const body = req.body;

    console.log('Incoming webhook message:', JSON.stringify(body, null, 2));

    // Check if the webhook event is from a Page subscription (WhatsApp API sends it under 'whatsapp_business_account')
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

            // Extract message body safely
            let msgBody = '';
            if (message.type === 'text') {
                msgBody = message.text.body;
            } else {
                msgBody = `[Received message of type: ${message.type}]`;
            }

            console.log(`Message received from ${from}: ${msgBody}`);

            // TODO: Process this message in the AI Agent pipeline!
        }

        // Returns a '200 OK' response to all requests
        res.sendStatus(200);
    } else {
        // Return a '404 Not Found' if event is not from a WhatsApp API
        res.sendStatus(404);
    }
});

// Start the Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Waiting for WhatsApp Webhook requests on http://localhost:${PORT}/webhook...`);
});
