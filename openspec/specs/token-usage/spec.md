# Delta for Token Usage

## ADDED Requirements

### Requirement: Prompt Counter

The system MUST track the number of AI prompts sent by the authenticated user per billing period (month). The counter SHALL increment on each `provider.chat()` call via the `chat-assistant`. The counter MUST reset at the start of each billing cycle.

#### Scenario: Counter increments and displays

- GIVEN a free-tier user has used 12 of 30 monthly prompts
- WHEN the user sends a new prompt
- THEN the counter updates to 13/30
- AND the UI displays "13 de 30 prompts usados este mes"

### Requirement: Plan Limit Enforcement

The system MUST block prompts when the monthly limit is reached. Free users SHALL see: "Llegaste al límite de 30 prompts este mes. Actualizá a Estudiante para prompts ilimitados o usá BYOK sin límite." BYOK prompts MUST NOT count toward the free limit.

#### Scenario: Free limit reached

- GIVEN a free user reached 30/30 prompts
- WHEN the user attempts to send a prompt
- THEN the request is blocked
- AND a modal appears with upgrade options: Estudiante plan or "Configurá tu propia API key (BYOK)"
- AND the chat input is disabled until plan change or BYOK configured

### Requirement: Token Estimation Display

The chat interface SHALL display estimated token usage for the current conversation: input tokens sent + output tokens received. Estimation MUST use provider `countTokens()`. The display refreshes after each AI response.

#### Scenario: Token estimate shown in chat footer

- GIVEN a conversation with 3 messages
- WHEN the AI completes a response
- THEN the chat footer displays "~450 tokens usados en esta conversación"
- AND the count includes both input and output tokens

### Requirement: Renewal Display

The system SHALL display the billing period renewal date. For free users: "Se renuevan el [date]" next to the counter. For paid users: plan name + next billing date.

#### Scenario: Renewal date visible on free plan

- GIVEN a free user on May 4 with a June 4 renewal
- WHEN the user views the token counter
- THEN "Se renuevan el 4 de junio" is displayed
