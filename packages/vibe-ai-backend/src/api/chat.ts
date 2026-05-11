import * as jose from "jose";

declare const awslambda: any;

// Handler para Lambda con AWS Response Streaming (hasta 15 minutos)
export const handler = awslambda.streamifyResponse(
  async (event: any, responseStream: any, _context: any) => {
    // 1.4 Validación JWT (Básica para esta fase)
    const authHeader = event.headers?.authorization || "";
    
    if (!authHeader.startsWith("Bearer ")) {
      responseStream.setContentType("application/json");
      responseStream.write(JSON.stringify({ error: "Unauthorized: Falta token Bearer" }));
      responseStream.end();
      return;
    }

    const token = authHeader.split(" ")[1];
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);

    try {
      // Verificamos la firma del JWT usando 'jose'
      await jose.jwtVerify(token, secret);
    } catch (error) {
      responseStream.setContentType("application/json");
      responseStream.write(JSON.stringify({ error: "Unauthorized: Token inválido o expirado" }));
      responseStream.end();
      return;
    }

    // 1.3 Lógica Dummy Streaming (Server-Sent Events)
    responseStream.setContentType("text/event-stream");
    
    // Enviamos 5 mensajes simulando "escritura" en tiempo real de una IA
    for (let i = 1; i <= 5; i++) {
      const payload = JSON.stringify({
        id: "msg_dummy_123",
        role: "assistant",
        content: `Palabra ${i}... `
      });
      
      responseStream.write(`data: ${payload}\n\n`);
      
      // Esperamos 1 segundo entre mensajes para probar que la conexión sigue viva
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Cerramos el stream elegantemente con el estándar SSE
    responseStream.write("event: done\ndata: [DONE]\n\n");
    responseStream.end();
  }
);
