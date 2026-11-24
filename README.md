# PregaApp 🎙️

App para pregadores cristãos — crie mensagens, gere slides e projete em tempo real.

## Funcionalidades

- 📖 Bíblia completa embutida (sem internet)
- 📝 Editor de mensagens com tópicos e versículos
- 🎨 6 modelos de slides visuais
- 📡 **Projeção remota em tempo real** — controle do tablet, exibe no PC do projetor
- 📄 Exportação PDF e PPT
- 🎵 Integração Holyrics

## Como usar a Projeção Remota

1. Abra o app no **tablet** (você — pregador)
2. Gere os slides no Editor
3. Vá em **QR Code** → clique **Iniciar Sessão QR**
4. No **PC da igreja** (ligado no projetor), escaneie o QR Code ou abra o link exibido
5. Avance os slides no tablet — o PC atualiza automaticamente!

## Deploy

### Worker (sincronização em tempo real)

```bash
cd prega-app
npm install -g wrangler
wrangler login
wrangler deploy
```

### Cloudflare Pages (app)

1. Faça push para o GitHub
2. No Cloudflare Pages, conecte o repositório `isaiasfacemp-boop/prega-app`
3. Build command: (deixe vazio)
4. Output directory: `/` (raiz)

## Estrutura

```
prega-app/
├── index.html          # App completo (inclui Bíblia ~19MB)
├── worker/
│   └── index.js        # Worker Cloudflare (WebSocket + Durable Objects)
├── wrangler.toml       # Config do Worker
└── README.md
```
