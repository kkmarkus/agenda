<div align="center">

# 📅 Agenda

**Transforme texto livre em português em eventos reais na agenda do Android.**

`reunião com o time quinta às 15h` → título, data, hora e alarme, prontos pra revisar e confirmar.

[![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB?logo=react&logoColor=white)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-SDK_52-000020?logo=expo&logoColor=white)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tested with Jest](https://img.shields.io/badge/Tested_with-Jest-C21325?logo=jest&logoColor=white)](https://jestjs.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

</div>

---

## Sumário

- [Visão geral](#visão-geral)
- [Principais funcionalidades](#principais-funcionalidades)
- [Arquitetura](#arquitetura)
- [Stack](#stack)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Testes e qualidade](#testes-e-qualidade)
- [Build Android](#build-android)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Decisões técnicas relevantes](#decisões-técnicas-relevantes)
- [Testes](#testes)
- [Status](#status)
- [Licença](#licença)

---

## Visão geral

O **Agenda** foi construído em torno de um fluxo simples:

```text
Texto livre
    ↓
Parser
    ↓
Evento estruturado
    ↓
Revisão pelo usuário
    ↓
Agenda nativa do Android
    ↓
Dashboard
```

O aplicativo não tenta substituir um calendário completo. A proposta é reduzir o atrito de criar compromissos manualmente, facilitando a criação e o acompanhamento de eventos a partir de uma entrada rápida em linguagem natural.

## Principais funcionalidades

| Categoria | Funcionalidades |
|---|---|
| **Criação de eventos** | Texto livre em português · preenchimento manual · tela de confirmação antes de salvar |
| **Parser** | Datas, horários, intervalos e recorrências · suporte a múltiplos eventos numa mesma entrada |
| **Agenda nativa** | Criação direta na agenda do Android · alarmes configurados automaticamente · sincronização com calendários do dispositivo |
| **Organização** | Dashboard com eventos próximos · destaque para eventos urgentes · fixação de eventos importantes |
| **Tags** | Múltiplas tags por evento · autocomplete das tags já utilizadas |
| **Personalização** | Tema claro, escuro e automático · múltiplas cores de destaque |
| **Dados** | Persistência local com SQLite · backup e restauração dos metadados do app |

## Arquitetura

O projeto separa apresentação, regras de negócio e infraestrutura:

```text
src/
├── components/       # Componentes reutilizáveis da interface
├── navigation/       # Configuração da navegação
├── screens/          # Telas e fluxos principais
├── services/         # Integrações e persistência
│   ├── database/     # SQLite, migrations e repositories
│   └── eventParser/  # Parser de texto para eventos
├── theme/            # Tokens visuais e gerenciamento de tema
├── types/            # Tipos compartilhados
└── utils/            # Funções auxiliares
```

### Fonte da verdade dos eventos

Uma decisão importante do projeto é **não duplicar no SQLite os dados completos dos eventos**.

A agenda nativa do Android é a fonte da verdade para:

- título
- data e horário
- descrição
- recorrência
- alarmes

O SQLite armazena apenas informações específicas do aplicativo:

- identificador do evento nativo
- tags
- estado de fixação
- preferências
- informações de sincronização

Isso reduz o risco de inconsistência quando um evento é alterado ou removido diretamente em outro aplicativo de calendário.

### Parser

O parser é baseado em **regras determinísticas**, não em um modelo de IA. Possui módulos separados para tratar:

`normalização` · `datas` · `horários` · `intervalos` · `recorrência` · `múltiplos eventos`

Essa divisão permite testar as regras individualmente e facilita a evolução do parser.

### Persistência

A camada de banco utiliza SQLite por meio do `expo-sqlite`, com:

- repositories para acesso aos dados
- migrations para evolução do schema
- testes dos repositories e das migrations
- mocks para cenários de teste

## Stack

**Aplicação**

| Tecnologia | Versão |
|---|---|
| React Native | 0.76 |
| Expo SDK | 52 |
| TypeScript | 5.3 |
| React Navigation | 6 |

**APIs e recursos nativos**

| Pacote | Uso |
|---|---|
| `expo-calendar` | Leitura e criação de eventos na agenda do dispositivo |
| `expo-sqlite` | Persistência local |
| `expo-file-system` | Manipulação de arquivos |
| `expo-document-picker` | Seleção de arquivos para backup/restauração |
| `expo-sharing` | Compartilhamento de arquivos |
| `expo-font` | Carregamento das fontes da interface (Noto Serif, Yeseva One) |
| `expo-build-properties` | Configuração do ambiente Android, incluindo versão do Kotlin do build |

**Qualidade**

`Jest` · `jest-expo` · `ESLint` · `TypeScript`

## Requisitos

- Node.js
- npm
- Android Studio/SDK ou um dispositivo Android compatível
- Ambiente Expo configurado

> O projeto utiliza **Expo Dev Client** — o fluxo de desenvolvimento principal não é baseado apenas no Expo Go.

## Instalação

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/kkmarkus/agenda.git
cd agenda
npm install
```

Inicie o projeto:

```bash
npm start
```

Para executar diretamente no Android:

```bash
npm run android
```

## Testes e qualidade

| Comando | O que faz |
|---|---|
| `npm test` | Executa a suite de testes |
| `npm run typecheck` | Executa o TypeScript em modo de verificação |
| `npm run lint` | Executa o ESLint |

Verificação completa:

```bash
npm run typecheck && npm run lint && npm test
```

## Build Android

O projeto utiliza **EAS Build** para gerar o APK de distribuição interna:

```bash
eas build --profile preview --platform android
```

As configurações de build estão em `eas.json`.

## Estrutura do projeto

```text
agenda-app/
├── assets/
│   ├── fonts/
│   └── icon/
│
├── src/
│   ├── components/
│   ├── navigation/
│   ├── screens/
│   ├── services/
│   │   ├── database/
│   │   └── eventParser/
│   ├── theme/
│   ├── types/
│   └── utils/
│
├── .gitignore
├── app.json
├── App.tsx
├── babel.config.js
├── eas.json
├── LICENSE
├── package.json
├── package-lock.json
├── README.md
└── tsconfig.json
```

## Decisões técnicas relevantes

<details>
<summary><strong>Agenda nativa como fonte da verdade</strong></summary>
<br>

O aplicativo evita manter uma segunda cópia completa dos eventos no banco local. Isso permite que alterações feitas por outros aplicativos de calendário sejam refletidas no Agenda automaticamente.
</details>

<details>
<summary><strong>Migrations do SQLite</strong></summary>
<br>

O banco possui migrations para permitir a evolução do schema sem depender da recriação completa das tabelas.
</details>

<details>
<summary><strong>Tema baseado em tokens</strong></summary>
<br>

A interface utiliza tokens de design para cores, superfícies, bordas e textos. A cor de destaque escolhida pelo usuário influencia a geração dos demais tokens visuais.
</details>

<details>
<summary><strong>Eventos de intervalo</strong></summary>
<br>

Eventos que representam intervalos podem resultar em dois eventos nativos independentes, representando início e prazo final, permitindo alarmes separados.
</details>

<details>
<summary><strong>Inicialização do banco</strong></summary>
<br>

A inicialização do banco ocorre fora do ciclo de efeitos dos componentes, garantindo que as tabelas necessárias existam antes de componentes que dependem das preferências persistidas.
</details>

## Testes

Os testes estão distribuídos próximos às áreas que cobrem, incluindo:

`parser de eventos` · `datas e horários` · `recorrência` · `intervalos` · `múltiplos eventos` · `repositories SQLite` · `migrations` · `serviço de calendário` · `tema` · `hooks e regras específicas das telas`

## Status

> 🚧 O projeto está em desenvolvimento e representa uma implementação de MVP para estudo e portfólio.

## Licença

Este projeto está licenciado sob a licença MIT. Consulte o arquivo [LICENSE](./LICENSE).

---

<div align="center">
<sub>Desenvolvido por <a href="https://github.com/kkmarkus">kkmarkus</a></sub>
</div>
