# 🛠️ Como modificar seu Lapidare usando Claude Code

Guia pra você adicionar páginas novas, mudar cores além das paletas prontas, alterar textos, criar campos extras — **sem saber programar**.

A IA (Claude Code) **escreve o código por você**. Você só conversa em português, descreve o que quer, e ela faz.

> 💡 **Quando NÃO precisa disso?**
> Pra mudar logo, cores e tipografia, use a tela **Personalização** dentro do próprio app — não precisa de Claude Code.

---

## ✅ Pré-requisitos

1. **Conta no Claude Pro** — US$ 20/mês em [claude.ai](https://claude.ai/upgrade)
2. **Conta GitHub** com seu fork do `lapidare-app` (já feito no Dia 01)
3. **Computador com Mac, Linux ou Windows**
4. **30 minutos** pra fazer o setup uma vez (depois disso, cada mudança leva ~5 min)

---

## 🚀 Setup do ambiente — UMA vez só

### 1. Instalar Node.js
Necessário pra rodar o app no seu computador.

- Baixa: [nodejs.org/download](https://nodejs.org/download/)
- Escolhe a versão **LTS** (botão verde)
- Instala (next, next, next)

**Pra confirmar que instalou:** abre o Terminal e digita:
```bash
node --version
```
Se aparecer `v20.x.x` ou similar, deu certo.

### 2. Instalar Git
Necessário pra baixar/enviar código do GitHub.

- **Mac:** já vem instalado. Confere com `git --version`.
- **Windows:** baixa em [git-scm.com/download/win](https://git-scm.com/download/win)

### 3. Instalar Claude Code
```bash
npm install -g @anthropic-ai/claude-code
```

Depois faz login:
```bash
claude login
```
Vai abrir o navegador → autoriza a Claude.

### 4. Baixar SEU fork do app
No Terminal:
```bash
cd ~/Desktop
git clone https://github.com/SEU_USUARIO/lapidare-app.git
cd lapidare-app
npm install
```
*(troca `SEU_USUARIO` pelo seu nome no GitHub)*

### 5. Configurar o `.env` local
```bash
cp .env.example .env
```

Abre o arquivo `.env` (no Finder, clica direito → "Abrir com" → TextEdit) e cola suas credenciais do Supabase:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 6. Testar que roda
```bash
npm run dev
```
Abre `http://localhost:5173` no navegador. Se ver seu app, **deu certo!** ✅

Aperta `Ctrl+C` no Terminal pra parar o app quando quiser.

---

## 💬 Como usar o Claude Code pra modificar

Sempre que quiser mexer em algo:

### 1. Abre o Terminal na pasta do projeto
```bash
cd ~/Desktop/lapidare-app
```

### 2. Inicia o Claude Code
```bash
claude
```

Vai aparecer uma caixa pra você conversar. **Escreve em português normal**, como se fosse WhatsApp.

### 3. Descreve a mudança que quer
Quanto mais específica, melhor. Exemplos abaixo.

### 4. Aceita ou rejeita as mudanças
A Claude vai mostrar exatamente o que vai mudar e pedir sua confirmação. Você lê e aprova.

### 5. Testa localmente
Em outro Terminal (Cmd+T pra abrir aba nova):
```bash
npm run dev
```
Abre `localhost:5173` → testa a mudança.

### 6. Subir pro ar
Quando estiver feliz:

```bash
git add .
git commit -m "Descrição breve da mudança"
git push
```

O Netlify detecta automaticamente e faz redeploy em 2-3 minutos. Seu app no ar já tem a mudança.

---

## 📚 Exemplos de mudanças comuns

Copia esses prompts e cola no Claude Code, ajustando pro seu caso.

### Exemplo 1 — Adicionar uma área nova
> *"Adiciona uma área chamada Receitas no painel da nutri, onde ela pode criar e organizar receitas com nome, ingredientes, modo de preparo e fotos. Coloca no menu lateral entre Biblioteca e Check-ins."*

### Exemplo 2 — Mudar texto
> *"Na tela inicial da paciente, troca a mensagem 'Bem-vinda ao seu app' por 'Olá, seu acompanhamento começa aqui'."*

### Exemplo 3 — Adicionar campo no cadastro
> *"No formulário de cadastro de paciente, adiciona dois campos novos: telefone (obrigatório) e endereço completo (opcional)."*

### Exemplo 4 — Mudar layout
> *"Na tela Pacientes, em vez de tabela, mostra as pacientes como cards em grid com foto, nome e objetivo."*

### Exemplo 5 — Remover uma funcionalidade
> *"Remove completamente a aba Suplementação do perfil da paciente — não vou usar."*

### Exemplo 6 — Mudar cor específica
> *"Os botões de check-in respondido devem ser verde-claro (#a8d5a8) em vez de verde-escuro."*

### Exemplo 7 — Adicionar relatório
> *"Cria uma tela de relatório mensal mostrando: número de pacientes ativas, consultas realizadas, check-ins respondidos, e receita do mês. Adiciona um botão pra exportar em PDF."*

### Exemplo 8 — Notificação por email
> *"Configura envio de email automático quando a nutri publica um plano novo. Use Resend, vou te passar a API key."*

---

## ⚠️ Cuidados importantes

### Sempre testa local antes de subir
Antes de fazer `git push`, abre `localhost:5173` e confere se está como você quer. **Nunca sobe sem testar.**

### Se quebrar, dá pra desfazer
Se algo quebrar e você quiser voltar:
```bash
git reset --hard HEAD~1
```
*(volta pra última versão funcional)*

### Não compartilha credenciais
Nunca cola seu arquivo `.env` em lugar público (Claude Code é OK, ChatGPT online NÃO).

### Mantém o app atualizado
De vez em quando, eu (Daniela) vou lançar melhorias no template. Pra pegar:
1. No GitHub, abre seu fork
2. Botão **"Sync fork"** no topo
3. No seu Terminal, roda: `git pull` + `npm install`
4. Se tiver SQL novo, rodar no Supabase

---

## 🆘 Quando algo dá errado

### Claude Code não entendeu o que quero
Reformula com mais detalhe. Ex:
- ❌ "Muda o botão"
- ✅ "Muda o botão 'Salvar' da tela Cadastrar paciente: aumenta o tamanho e coloca um ícone de check antes do texto"

### Mudança quebrou o app
1. No Terminal: `git status` (vê o que tá pendente)
2. `git reset --hard HEAD~1` (desfaz última mudança)
3. Testa local pra ver se voltou ao normal
4. Tenta de novo com prompt mais claro

### Não sei o que pedir
Tira print da tela atual e descreve: *"Olha esse print. Quero que [mudança]. Como ficaria?"*
A Claude consegue ver e propor.

### Erro de "permission denied" no push
Seu token expirou. Cria um novo:
- Acessa [github.com/settings/tokens](https://github.com/settings/tokens)
- Gera novo token (clássico) com permissão `repo`
- Quando fizer push, usa o token como senha

---

## 💡 Dicas de ouro

1. **Faça mudanças pequenas, uma de cada vez.** Se quebrar, é fácil reverter.
2. **Comece com mudanças visuais** (texto, cor) antes de tentar features novas (área nova, integrações).
3. **Salve seus prompts que deram certo.** Vão te ajudar nas próximas vezes.
4. **Antes de pedir feature complexa, descreva o caso de uso.** Ex: *"Toda segunda preciso enviar um resumo das pacientes ativas pro meu email — como posso fazer isso?"*
5. **Não tenha medo de errar.** O Git deixa você reverter qualquer coisa em segundos.

---

## 📞 Quando contratar um dev

Pra coisas além do Claude Code, vale contratar um freelancer (~R$ 100-300/hora):
- **Integrações complexas** (TISS pra plano de saúde, gateway de pagamento, app mobile nativo)
- **Migração de dados grande** (mover de outro sistema)
- **Auditoria de segurança** quando passar de 50 pacientes ativas
- **App mobile** (esse template é responsivo mas não é app instalável de loja)

Recomendo [99freelas.com.br](https://99freelas.com.br) ou [workana.com](https://workana.com) — busca por "React + Supabase".

---

**Última coisa:** o Lapidare é **seu**. Modifica, quebra, reconstrói. O código é livre e a sua paciente é a única que importa. 💛
