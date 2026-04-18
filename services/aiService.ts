import { GoogleGenAI } from '@google/genai';

let ai: GoogleGenAI | null = null;

export const getAI = () => {
    if (!ai) {
        const apiKey = (window as any).process?.env?.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn("No Gemini API key found. AI features will be disabled.");
            return null;
        }
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
};

export const generateMenuEngineeringStrategy = async (productsData: any) => {
    const aiClient = getAI();
    if (!aiClient) {
        throw new Error("La API Key de Gemini no está configurada. Por favor, añádela en la configuración.");
    }

    const prompt = `
Eres un consultor experto en hostelería y finanzas de restaurantes.
He analizado los productos de mi restaurante y calculado su "Food Cost" (coste de materia prima sobre el precio de venta).
Aquí tienes los datos de mis productos compuestos (recetas):

${JSON.stringify(productsData, null, 2)}

Por favor, actúa como un asesor y dame un informe estratégico basado en la Matriz BCG (Estrellas, Vacas, Perros, Interrogantes).
Identifica qué platos son muy rentables, cuáles están perdiendo dinero (Food Cost > 35%), y dame consejos accionables para mejorar la rentabilidad general del menú.
Usa un tono profesional pero cercano y motivador. Formatea la respuesta en Markdown.
`;

    try {
        const response = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error generating AI strategy:", error);
        throw new Error("No se pudo generar la estrategia. Revisa tu conexión o la cuota de la API.");
    }
};
