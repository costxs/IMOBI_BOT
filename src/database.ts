import mongoose from 'mongoose';

export interface IProperty extends mongoose.Document {
    title: string;
    description: string;
    price: number;
    type: 'casa' | 'apartamento' | 'terreno' | 'comercial';
    location: {
        type: string;
        coordinates: [number, number];
    };
    imageUrl?: string;
}
const PropertySchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    type: { type: String, enum: ['casa', 'apartamento', 'terreno', 'comercial'], required: true },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    imageUrl: { type: String }
});

PropertySchema.index({ location: '2dsphere' });

export const PropertyModel = mongoose.models.Property || mongoose.model<IProperty>('Property', PropertySchema);
export const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI;
        if (!mongoURI) {
            console.log('⚠️ Aviso: Variável MONGO_URI não encontrada no arquivo .env.');
            console.log('O banco não foi iniciado, então devolveremos resultados falsos (MOCK) nas buscas geográficas.');
            return;
        }

        await mongoose.connect(mongoURI);
        console.log('✅ Banco de dados MongoDB conectado com sucesso e pronto para operações Geoespaciais!');
    } catch (error) {
        console.error('❌ Erro fatal ao conectar no MongoDB:', error);
    }
};
