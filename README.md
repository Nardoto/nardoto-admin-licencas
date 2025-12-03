# Nardoto Tools - Admin de Licenças

Painel de administração para gerenciar licenças dos produtos Nardoto.

## Hospedagem

- **Frontend**: Vercel
- **Banco de Dados**: Firebase Firestore (mesmo do Tradutor)

## Deploy na Vercel

### Opção 1: Via CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### Opção 2: Via GitHub

1. Faça push para GitHub
2. Acesse [vercel.com](https://vercel.com)
3. Importe o repositório
4. Deploy automático!

## Comandos Git

```bash
# Salvar alterações
git add .
git commit -m "Descrição"
git push
```

## Estrutura

```
admin-licencas/
├── index.html      # Página principal
├── admin.js        # Lógica do painel
├── package.json    # Configuração npm
├── vercel.json     # Configuração Vercel
└── README.md       # Este arquivo
```

## Administradores

Edite em `admin.js` linha 11:

```javascript
const ADMIN_EMAILS = [
    'tharcisionardoto@gmail.com',
    'nardotoengenharia@gmail.com'
];
```

## Firebase (Mesma base do Tradutor)

- **Projeto**: tradutor-profissional-ai
- **Console**: https://console.firebase.google.com/project/tradutor-profissional-ai

## Funcionalidades

- ✅ Visualizar todos os usuários
- ✅ Ordenar por data de criação
- ✅ Ativar/Desativar PRO
- ✅ Ativar teste grátis (3 dias)
- ✅ Buscar usuários
- ✅ Estatísticas em tempo real

---

**Desenvolvido por Nardoto**
