# Resumo do Projeto — App de Agenda Automática

## 1. Problema a resolver

A usuária final organiza compromissos manualmente na agenda do celular, um por um, a partir de mensagens que recebe (principalmente no WhatsApp). O processo é lento e ela gostaria de simplesmente informar o evento em algum lugar e tê-lo criado automaticamente na agenda, com alarme, sem precisar preencher tudo manualmente no app de Calendário.

## 2. Solução definida

Um aplicativo **Android** (React Native + Expo) onde ela:

1. Digita o evento (texto livre ou formulário)
2. O app extrai o que consegue (título, data, hora)
3. Um formulário **pré-preenchido** aparece para ela revisar/completar e adicionar uma **tag livre**
4. Ao confirmar, o evento é:
   - Salvo na **agenda nativa do Android** (via `expo-calendar`), com alarme configurado — é o próprio sistema operacional que dispara a notificação, não o app
   - Registrado também no app, para aparecer no dashboard

## 3. Decisões de arquitetura (e o porquê)

| Decisão | Motivo |
|---|---|
| Quem dispara o alarme é o **sistema operacional**, não o app | Mais confiável — funciona mesmo com o app fechado ou o processo morto pelo Android |
| Tags **não** viram calendários nativos separados | Como as tags são livres e criadas aos poucos pela usuária, criar um calendário nativo por tag geraria dezenas de calendários poluindo o app de Calendário dela |
| Modelo híbrido de dados | Agenda nativa = fonte de verdade de título/data/hora. Banco local (SQLite) guarda **só** `id do evento nativo + tag`. Isso evita que o dashboard mostre dados desatualizados se ela editar/apagar algo direto no Google Calendar |
| Extração de texto livre: parser simples primeiro, IA depois | Permite ter o app funcionando ponta a ponta rapidamente antes de acrescentar a camada mais complexa (chamada a API de IA) |

### Modelo de dados local (SQLite)

```sql
CREATE TABLE eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  native_event_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

## 4. Funcionalidades e telas

1. **Tela de Input** — texto livre ou formulário manual
2. **Tela de Confirmação** — dados pré-preenchidos, editáveis, + campo de tag (com autocomplete de tags já usadas)
3. **Dashboard** — lista de eventos salvos, ordenados por proximidade, com contagem regressiva de dias e destaque visual para eventos urgentes (< 24–48h)
4. **Tela de Tags** — eventos agrupados por tag

## 5. Melhorias já incorporadas ao escopo

- Destaque visual de urgência no dashboard (não só número de dias)
- Estado vazio explicativo na tela de tags (antes de ela ter usado alguma)
- Exclusão sincronizada: apagar no app remove da agenda nativa também, evitando alarme "fantasma"
- Autocomplete de tags existentes ao criar uma nova, evitando duplicidade (ex: "Universidade" vs "universidade")

## 6. Stack técnica

- **React Native + Expo**
- `expo-calendar` — leitura/escrita na agenda nativa
- `expo-sqlite` — banco local (id do evento + tag)
- Extração de texto: parser de regras no início; migração futura para API de IA (ex: Anthropic API) para o modo texto livre mais robusto

## 7. Estrutura de pastas

```
agenda-app/
├── App.tsx
├── src/
│   ├── screens/
│   │   ├── InputScreen.tsx
│   │   ├── ConfirmScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   └── TagsScreen.tsx
│   ├── services/
│   │   ├── calendarService.ts
│   │   ├── eventParser.ts
│   │   └── database.ts
│   ├── types/
│   │   └── event.ts
│   └── navigation/
│       └── AppNavigator.tsx
├── app.json
└── package.json
```

## 8. Ordem de implementação recomendada

1. `calendarService.ts` (base: criar/ler/apagar evento nativo)
2. `database.ts` (schema + CRUD do SQLite)
3. `InputScreen` + `eventParser.ts` (começando manual, sem IA)
4. `ConfirmScreen` (integra parser + calendarService + database)
5. `DashboardScreen`
6. `TagsScreen`
7. Por último: substituir parser manual por extração via IA

## 9. Pesquisa de mercado (concorrentes)

Apps semelhantes já existentes (Android/iOS): **Text2Calendar (AI Text To Calendar)**, **A+Calendar (recurso Wizard)**, **Text2Cal** (só iPhone), **Dola** (via WhatsApp/chatbot). Todos são apps de calendário completos com a extração de texto como um recurso a mais — nenhum é focado exclusivamente nesse fluxo enxuto. Esse é o principal diferencial do projeto: escopo mínimo, feito sob medida para o padrão real de uso da usuária, e valor de portfólio por resolver um problema específico e real.
