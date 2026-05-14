export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const targetUrl = new URL(env.TARGET_URL);
    
    // Mantener la ruta original pero cambiar el dominio al de AWS Lambda
    targetUrl.pathname = url.pathname;
    targetUrl.search = url.search;
    
    // Clonar la request para no mutar la original, pero ajustando cabeceras
    const newRequest = new Request(targetUrl.toString(), request);
    
    // AWS Lambda Function URLs fallan si el host no corresponde a su propio host
    newRequest.headers.set("Host", targetUrl.host);
    
    // Realizar fetch hacia AWS Lambda
    const response = await fetch(newRequest);
    
    return response;
  },
};
