# Financial Wallet API

> **⚠️ Nota Importante:** Este repositório contém apenas a **API backend** do projeto. A **interface frontend** está disponível em um repositório separado: [Fake News Detector](https://github.com/icarocaiquecaiq/fake-news-detector.git)

## Descrição

Esta é uma API RESTful desenvolvida em NestJS para simular uma carteira financeira. O sistema permite cadastro de usuários, autenticação via JWT e operações financeiras como depósito, transferência entre usuários e reversão de transações.

## Requisitos do Projeto

- **Cadastro e Autenticação**: Criação de conta e login (email ou username) com JWT.
- **Carteira Digital**: Todo usuário possui uma carteira criada automaticamente.
- **Operações Financeiras**:
  - Depósito (com suporte a idempotência).
  - Transferência (validação de saldo, atômica e segura).
  - Reversão (estorno de transações dentro de um prazo limite).
- **Segurança**:
  - Senhas criptografadas com Bcrypt.
  - Rotas protegidas por Guardas JWT.
  - Validação de dados com DTOs.
- **Arquitetura**:
  - Padrão Modular do NestJS.
  - SOLID Principles.
  - Tratamento robusto de erros.

## Tecnologias Utilizadas

- [NestJS](https://nestjs.com/) - Framework Node.js
- [Prisma ORM](https://www.prisma.io/) - Database ORM
- [Docker](https://www.docker.com/) - Containerização
- [MySQL](https://www.mysql.com/) - Banco de Dados (via Docker)
- [Jest](https://jestjs.io/) - Testes Automatizados

## Como Rodar

### Pré-requisitos

- Docker e Docker Compose instalados.
- Node.js (opcional, se quiser rodar fora do Docker).

### Passos

1. **Clone o repositório:**

   ```bash
   git clone <url-do-repositorio>
   cd financial-wallet-api
   ```

2. **Crie o arquivo de ambiente:**
   Crie um arquivo `.env` na raiz do projeto (use o `.env.example` se houver, ou o modelo abaixo):

   ```env
   DATABASE_URL="mysql://root:root@db:3306/financial-wallet"
   JWT_SECRET="sua-chave-secreta-super-segura"
   ```

3. **Suba a aplicação com Docker:**
   ```bash
   docker compose up --build
   ```
   A aplicação estará disponível em `http://localhost:3000`.

### Documentação da API (Postman)

Você pode acessar a documentação completa e testar as rotas através da nossa coleção do Postman:

[**Acessar Documentação Postman**](https://.postman.co/workspace/My-Workspace~242610de-a161-451d-8365-06c59867d4a9/collection/39371881-788d821f-7451-4813-83fa-dee91ca8e983?action=share&creator=39371881)

## Funcionalidades Principais

### Autenticação

- `POST /auth/register`: Cria usuário e retorna token.
- `POST /auth/login`: Autentica usuário (email/username) e retorna token.

### Carteira (Requer Token Bearer)

- `GET /wallet/balance`: Consulta saldo atual.
- `GET /wallet/transactions`: Histórico de transações.
- `POST /wallet/deposit`: Realiza um depósito.
- `POST /wallet/transfer`: Transfere valor para outro usuário.
- `POST /wallet/revert/:id`: Solicita estorno de uma transação.

## Testes

Para rodar os testes automatizados (unitários e integração):

```bash
# Rodar testes de integração
npm run test:e2e
```

## Diferenciais Técnicos

Este projeto foi desenvolvido com foco em **segurança**, **precisão financeira** e **resiliência**. Abaixo estão os principais diferenciais técnicos implementados:

### 1. **Armazenamento de Valores em Centavos (Integer)**

**Por quê?** Tipos `Float` ou `Decimal` podem causar erros de arredondamento em operações financeiras, levando a inconsistências e perda de precisão.

**Solução:** Todos os valores monetários são armazenados como **inteiros** (em centavos). Por exemplo, R$ 10,50 é armazenado como `1050`.

**Benefício:** Precisão absoluta em cálculos financeiros, facilidade de implementação, evitando bugs críticos relacionados a arredondamento.

fonte: https://www.moderntreasury.com/journal/floats-dont-work-for-storing-cents

### 2. **Controle de Concorrência Otimista (Versioning)**

**Por quê?** Em sistemas financeiros, múltiplas requisições simultâneas podem causar **race conditions** (condições de corrida), resultando em saldos incorretos.

**Solução:** Um campo `version` na tabela `Wallet`. Cada operação incrementa a versão e valida que a versão atual corresponde à esperada antes de atualizar.

**Benefício:** Garante integridade dos dados mesmo em ambientes de alta concorrência, rejeitando operações conflitantes.

### 3. **Idempotência em Transações**

**Por quê?** Requisições duplicadas (ex: falhas de rede, retry automático) podem gerar depósitos ou transferências duplicadas.

**Solução:** Implementamos `idempotencyKey` único para cada operação. Se a mesma chave for enviada novamente, o sistema retorna a transação original sem criar duplicatas.

**Benefício:** Operações seguras mesmo em cenários de falha, prevenindo cobranças ou créditos duplicados.

### 4. **Janela de Reversão (revertExpiresAt)**

**Por quê?** Sistemas financeiros precisam permitir estornos, mas não indefinidamente, para evitar fraudes e garantir auditoria.

**Solução:** Cada transação possui um campo `revertExpiresAt` (padrão: 30 dias). Após esse prazo, a transação não pode mais ser revertida.

**Benefício:** Equilíbrio entre flexibilidade para correção de erros e segurança contra fraudes históricas.

### 5. **Transações Atômicas (ACID)**

**Por quê?** Operações financeiras envolvem múltiplas etapas (débito, crédito, criação de registro). Se uma falhar, o sistema pode ficar inconsistente.

**Solução:** Utilizamos `prisma.$transaction` para garantir que todas as operações sejam executadas com sucesso ou todas sejam revertidas.

**Benefício:** Integridade total dos dados, mesmo em cenários de falha parcial.

### 6. **Auditoria Completa de Transações**

**Por quê?** Sistemas financeiros exigem rastreabilidade total para conformidade, depuração e análise.

**Solução:** Cada transação registra:

- `beforeBalanceInCents` e `afterBalanceInCents` (snapshot do saldo antes/depois)
- `type` (DEPOSIT, TRANSFER, REVERSAL)
- `status` (PENDING, COMPLETED, REVERSED)
- `originalTransactionId` (para reversões)
- `createdAt` (timestamp)

**Benefício:** Histórico imutável e completo de todas as operações, facilitando auditoria e resolução de disputas.

### 7. **Validação de Regras de Negócio Rigorosas**

**Por quê?** Operações financeiras exigem múltiplas validações antes de serem executadas.

**Solução:** Implementamos validações em camadas:

- **DTOs** (Class-validator): Validação de tipos e formatos.
- **Service Layer**: Regras de negócio (saldo suficiente, usuário existe, não pode transferir para si mesmo, etc.).
- **Guards**: Autenticação e autorização.

**Benefício:** Prevenção proativa de erros e operações inválidas, com mensagens de erro claras.

### 8. **Tratamento de Erros e Logging Estruturado**

**Por quê?** Erros financeiros precisam ser rastreados e diagnosticados rapidamente.

**Solução:** Implementamos o padrão **Fail Fast** com:

- Mensagens de erro padronizadas e armazenadas como constantes.
- Logging estruturado com `Logger` do NestJS em todas as operações críticas.
- Exceptions HTTP específicas (`BadRequestException`, `UnauthorizedException`, etc.).

**Benefício:** Depuração rápida, monitoramento eficiente e melhor experiência do desenvolvedor.

### 9. **Arquitetura Modular e SOLID**

**Por quê?** Sistemas complexos precisam ser escaláveis e fáceis de manter.

**Solução:** O projeto segue os princípios **SOLID**:

- **Single Responsibility**: Cada classe tem uma única responsabilidade.
- **Open/Closed**: Código aberto para extensão, fechado para modificação.
- **Liskov Substitution**: Subtipos podem substituir tipos base.
- **Interface Segregation**: Interfaces específicas em vez de genéricas.
- **Dependency Inversion**: Dependência de abstrações, não de implementações concretas.

**Benefício:** Código limpo, testável e fácil de evoluir.
