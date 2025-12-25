# Prompt – Implementação do Frontend (React + Vite)

Você é um agente de desenvolvimento frontend trabalhando com **React + TypeScript usando Vite** (SPA, **sem Next.js**).  
Implemente a seguinte funcionalidade seguindo rigorosamente as instruções abaixo.

---

## 📁 Organização de Prompts

1. Crie duas pastas na raiz do projeto:
   - `prompts_pendentes`
   - `prompts_finalizados`

2. Para cada atividade iniciada:
   - Crie um arquivo `.md` dentro de `prompts_pendentes` descrevendo a atividade.
   - **Não mova o arquivo** para `prompts_finalizados` automaticamente.
   - A movimentação para `prompts_finalizados` **só deve acontecer após confirmação explícita do usuário**.

---

## 🌐 Roteamento da Aplicação

- A aplicação é uma **SPA com React + Vite**.
- Utilize **React Router DOM** para roteamento.
- Crie a rota:
  ```
  /simulate
  ```

---

## 📄 Página `/simulate`

Esta página será responsável pela **seleção e listagem de pools de liquidez**.

### Estrutura Geral da Página

- Um seletor de modo de filtro com duas abas ou radio buttons:
  - **Pair**
  - **Address**
- Inicialmente, implemente **apenas o modo Pair**
  - O modo **Address** pode aparecer desabilitado ou com o texto “em breve”.

---

## 🔎 Fluxo do Filtro por **Pair**

### 1️⃣ Seleção de Exchange

- Exiba um **ComboBox (select)** para seleção da exchange.
- Carregue as exchanges a partir do endpoint:
  ```
  GET /v1/exchanges
  ```
- Exemplo de resposta:
  ```json
  [
    { "id": 1, "name": "uniswap" },
    { "id": 2, "name": "sushiswap" }
  ]
  ```

---

### 2️⃣ Seleção de Network

- Após a seleção da exchange:
  - Carregue automaticamente as networks disponíveis:
    ```
    GET /v1/exchanges/{exchange_id}/networks
    ```

---

### 3️⃣ Seleção de Tokens (token0 e token1)

- Após selecionar a network:
  - Exiba dois ComboBoxes:
    - **Token0**
    - **Token1**

---

### 4️⃣ Listagem de Pools

- Após selecionar **token0 e token1**:
  - Busque os pools disponíveis:
    ```
    GET /v1/exchanges/{exchange_id}/networks/{network_id}/pools?token0=0x...&token1=0x...
    ```

---

## ❗ Importante

- **Não implementar lógica de simulação ou APR**
- Implementar apenas **seleção e listagem de pools**
