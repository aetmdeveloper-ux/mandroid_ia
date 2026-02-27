# 🤖 MANDROID.IA

> **Assistente de Inteligência Artificial Futurista**  
> by **mandroidapp; Adão Everton Tavares**

---

## ✨ Funcionalidades

- 🌧️ **Animação Matrix** — chuva de caracteres em tempo real
- 🔐 **Login com Google** — OAuth 2.0, sem digitar email ou senha
- 🤖 **IA Conversacional** — powered by OpenAI GPT
- 💬 **Chat em tempo real** — caixa de perguntas + respostas
- 🗑️ **Limpar conversa** — com confirmação
- ⏻ **Botão sair** — logout seguro
- 🎨 **Design Futurista** — tema neon verde/cyan/roxo
- 📱 **Responsivo** — funciona em desktop e mobile

---

## 📁 Estrutura de Arquivos

```
mandroid-ia/
├── server.js              ← Servidor Express + APIs
├── package.json           ← Dependências
├── .env.example           ← Variáveis de ambiente (modelo)
├── .env                   ← Suas configurações (NÃO commitar)
├── .gitignore
├── config/
│   └── passport.js        ← Configuração Google OAuth
└── public/
    ├── index.html         ← Página de Login
    └── chat.html          ← Interface de Chat
```

---

## 🚀 Como Instalar e Executar

### 1. Instalar dependências

```bash
cd mandroid-ia
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` com seus dados:

```env
PORT=3000
SESSION_SECRET=qualquer_string_secreta_longa

# Google OAuth
GOOGLE_CLIENT_ID=seu_client_id
GOOGLE_CLIENT_SECRET=seu_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# OpenAI
OPENAI_API_KEY=sua_chave_openai
OPENAI_MODEL=gpt-3.5-turbo
```

### 3. Executar

```bash
# Produção
npm start

# Desenvolvimento (auto-reload)
npm run dev
```

Acesse: **http://localhost:3000**

---

## 🔧 Como Obter as Credenciais

### Google OAuth 2.0

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/)
2. Crie ou selecione um projeto
3. Vá em **APIs & Services → Credentials**
4. Clique em **+ CREATE CREDENTIALS → OAuth 2.0 Client IDs**
5. Tipo: **Web application**
6. **Authorized redirect URIs**: `http://localhost:3000/auth/google/callback`
7. Copie o **Client ID** e **Client Secret** para o `.env`

> ⚠️ Para produção, adicione seu domínio real nas URIs autorizadas.

### OpenAI API Key

1. Acesse [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Clique em **Create new secret key**
3. Copie a chave para `OPENAI_API_KEY` no `.env`

> 💡 O app funciona em **modo demonstração** sem a chave OpenAI — mostra mensagem informativa.

---

## 🌐 Deploy em Produção

### Variáveis a atualizar no `.env`:

```env
NODE_ENV=production
GOOGLE_CALLBACK_URL=https://seudominio.com/auth/google/callback
```

### Plataformas recomendadas:
- **Railway** — `railway up`
- **Render** — conecte o GitHub
- **Heroku** — `git push heroku main`
- **VPS** — com `pm2 start server.js`

---

## 👤 Créditos

**mandroidapp; Adão Everton Tavares**  
MANDROID.IA © 2024 — Todos os direitos reservados
