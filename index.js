// Worker Cloudflare — Sincronização de slides em tempo real
// Usa Durable Objects para manter estado da sessão

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Rota WebSocket: /ws/:sessao
    if (url.pathname.startsWith('/ws/')) {
      const sessao = url.pathname.split('/')[2];
      if (!sessao) return new Response('Sessão inválida', { status: 400 });

      const id = env.SESSAO.idFromName(sessao);
      const obj = env.SESSAO.get(id);
      return obj.fetch(request);
    }

    // Rota para criar/verificar sessão: POST /sessao
    if (url.pathname === '/sessao' && request.method === 'POST') {
      const body = await request.json();
      const sessao = body.sessao || gerarCodigo();
      return new Response(JSON.stringify({ sessao }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('PregaApp Worker OK', { headers: corsHeaders });
  }
};

function gerarCodigo() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Durable Object — mantém estado da sessão
export class Sessao {
  constructor(state, env) {
    this.state = state;
    this.connections = new Map(); // id -> { ws, role }
    this.slideAtual = 0;
    this.totalSlides = 0;
    this.slides = [];
    this.ativo = false;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade');

    if (upgradeHeader !== 'websocket') {
      return new Response('Esperado WebSocket', { status: 426 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();

    const role = url.searchParams.get('role') || 'projetor'; // 'pregador' ou 'projetor'
    const connId = crypto.randomUUID();

    this.connections.set(connId, { ws: server, role });

    // Envia estado atual para quem acabou de conectar
    server.send(JSON.stringify({
      tipo: 'estado',
      slideAtual: this.slideAtual,
      totalSlides: this.totalSlides,
      ativo: this.ativo,
      slides: this.slides,
    }));

    // Avisa outros que alguém conectou
    this.broadcast({
      tipo: 'conexao',
      role,
      total: this.connections.size,
    }, connId);

    server.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg, connId, role);
      } catch (e) {
        // ignora mensagem inválida
      }
    });

    server.addEventListener('close', () => {
      this.connections.delete(connId);
      this.broadcast({
        tipo: 'desconexao',
        role,
        total: this.connections.size,
      }, connId);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  handleMessage(msg, connId, role) {
    switch (msg.tipo) {
      case 'slides_carregados':
        // Pregador enviou lista de slides
        if (role === 'pregador') {
          this.slides = msg.slides || [];
          this.totalSlides = this.slides.length;
          this.slideAtual = 0;
          this.ativo = true;
          this.broadcast({
            tipo: 'slides_carregados',
            slides: this.slides,
            totalSlides: this.totalSlides,
            slideAtual: 0,
          });
        }
        break;

      case 'mudar_slide':
        // Pregador avançou/voltou slide
        if (role === 'pregador') {
          this.slideAtual = msg.indice;
          this.broadcast({
            tipo: 'mudar_slide',
            indice: msg.indice,
          });
        }
        break;

      case 'encerrar':
        if (role === 'pregador') {
          this.ativo = false;
          this.broadcast({ tipo: 'encerrar' });
        }
        break;

      case 'ping':
        // keepalive
        const { ws } = this.connections.get(connId) || {};
        if (ws) ws.send(JSON.stringify({ tipo: 'pong' }));
        break;
    }
  }

  broadcast(msg, excluirId = null) {
    const json = JSON.stringify(msg);
    for (const [id, { ws }] of this.connections) {
      if (id !== excluirId) {
        try { ws.send(json); } catch (e) { this.connections.delete(id); }
      }
    }
  }
}
