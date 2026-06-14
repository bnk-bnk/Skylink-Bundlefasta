Implement BingwaZone and Pesatrix webhook ingestion, source-aware transaction analytics, transaction detail views, reconciliation, and configurable SMS/WhatsApp admin notifications in the existing Skylink Paybill Dashboard.

This is an implementation task, not a planning-only task.

Inspect the repository first, understand the existing architecture, database schema, Supabase integration, transaction processing, authentication, audit logging, UI components, analytics queries, SMS service, and coding conventions, then implement the changes directly.

Do not replace working functionality unnecessarily. Extend and migrate the existing system without losing historical data.

The dashboard already contains financial operations such as:

* Transactions
* STK
* C2B
* B2C
* B2B
* Reversals
* Analytics
* Audit Logs
* Existing SMS alerts
* Admin settings

Use the existing framework, component system, authentication, repository pattern, Supabase utilities, styling, and error-handling conventions.

==================================================
PRIMARY OBJECTIVE
=================

The Skylink Paybill Dashboard must receive signed transaction notifications from:

1. BingwaZone
2. Pesatrix

The dashboard must:

* Securely verify both webhook signatures.
* Preserve the exact raw webhook payload.
* Process events idempotently.
* Attribute transactions to the correct application, module, payment type, user, agent, and service.
* Avoid creating duplicate financial transactions when the same payment already exists from a Safaricom callback.
* Show complete transaction details through a View Transaction action.
* Provide advanced source, module, payment-type, direction, and time-based analytics.
* Allow the admin to choose either SMS or WhatsApp as the notification channel.
* Send notifications only after the financial transaction has been safely persisted.
* Never let notification delivery failures change transaction status or webhook acknowledgement.

==================================================
CRITICAL ACCOUNTING RULE
========================

Do not blindly insert every incoming application webhook as a new transaction.

The dashboard may already have received the same payment through:

* Safaricom C2B callback
* STK callback
* B2C result callback
* B2B result callback
* Reversal callback

BingwaZone and Pesatrix webhooks provide application-level attribution and business context. Safaricom callbacks provide payment-provider evidence.

These may describe the same financial movement.

There must be one canonical financial transaction, with one or more evidence events linked to it.

Incorrect implementation:

Safaricom callback creates KES 500 transaction.

BingwaZone webhook creates another KES 500 transaction.

Dashboard analytics show KES 1,000.

This must never happen.

Correct implementation:

Safaricom callback creates one KES 500 canonical transaction.

BingwaZone webhook matches it by receipt and enriches it with:

* source_system = bingwazone
* module = mini_site
* payment_type = subscription
* service_source = mini_site_subscription
* agent details
* application reference
* raw webhook evidence

Analytics still count KES 500 only once.

==================================================
TARGET DATA ARCHITECTURE
========================

Use two layers:

1. Raw webhook event layer
2. Canonical transaction layer

Do not use raw webhook event rows directly for financial totals.

---

1. WEBHOOK EVENTS TABLE

---

Create or adapt a table named:

webhook_events

Recommended columns:

* id uuid primary key default gen_random_uuid()
* source_system text not null
* event_key text not null
* event_type text not null
* schema_version integer nullable
* payload_hash text not null
* occurred_at timestamptz nullable
* received_at timestamptz not null default now()
* processing_status text not null
* processing_error text nullable
* raw_payload jsonb not null
* transaction_id uuid nullable references the canonical transactions table
* reconciliation_status text nullable
* created_at timestamptz not null default now()
* updated_at timestamptz not null default now()

Create a unique constraint on:

(source_system, event_key)

Allowed processing statuses should include:

* received
* processed
* duplicate
* validation_failed
* reconciliation_conflict
* processing_failed

Do not store secrets or the full signature value in the database.

Store a SHA-256 payload hash so a repeated event key with a changed payload can be detected.

Only authenticated administrators and trusted server-side service-role operations may access raw webhook payloads.

Apply proper Supabase RLS policies and explicit database grants using the same conventions already used by the project.

---

2. CANONICAL TRANSACTIONS TABLE

---

Inspect the existing transactions table before changing it.

Do not create a second competing ledger if the existing transactions table can be safely extended.

Preserve all historical data.

Add or map the following concepts:

* source_system
* provider
* origin
* direction
* transaction_type
* payment_type
* product_stream
* module
* service_source
* account_reference
* amount
* currency
* payer_phone
* recipient_phone
* counterparty_phone
* receipt
* external_reference_id
* external_user_id
* external_agent_id
* agent_name
* agent_business_name
* agent_username
* status
* occurred_at
* initiated_at
* completed_at
* metadata jsonb
* reconciliation_status
* reconciliation_key
* created_at
* updated_at

Do not duplicate an existing column merely because it has a slightly different name. Use migrations and mappings appropriate to the current codebase.

Use these concepts distinctly:

source_system:
The business application that generated or owns the transaction context.

Examples:

* bingwazone
* pesatrix
* unknown
* manual

provider:
The payment provider.

Examples:

* mpesa
* safaricom
* manual

origin:
How the dashboard first learned about the transaction.

Examples:

* safaricom_callback
* bingwazone_webhook
* pesatrix_webhook
* dashboard_operation
* manual_entry

A transaction may have:

provider = mpesa
source_system = bingwazone
origin = safaricom_callback

Do not confuse the business source with the payment provider.

Recommended reconciliation statuses:

* matched
* app_only
* provider_only
* conflict
* not_applicable

Store all financial amounts in an appropriate fixed-precision numeric/decimal database type. Do not use floating-point values for money.

Store timestamps in UTC. Display them in the dashboard using Africa/Nairobi time.

==================================================
WEBHOOK SECURITY UTILITIES
==========================

Create a reusable server-side HMAC verification utility.

Suggested location:

lib/webhooks/verify-hmac.ts

It must:

* Accept the exact raw request body.
* Compute HMAC-SHA256.
* Validate signature format before using timingSafeEqual.
* Avoid timingSafeEqual exceptions caused by buffers of different lengths.
* Reject malformed hex.
* Use constant-time comparison for valid equal-length values.
* Never log secrets.
* Never expose expected signatures in responses.
* Support:

  * BingwaZone format: sha256=<64 lowercase or uppercase hex characters>
  * Pesatrix format: <64 lowercase or uppercase hex characters>

Signature verification must happen before JSON parsing.

For Next.js App Router routes:

* Call request.text() exactly once.
* Verify the returned raw string.
* Parse JSON only after signature verification succeeds.
* Use Node.js runtime where required for node:crypto.

For Express:

* Use express.raw({ type: "application/json" }) for these routes.
* Do not use JSON.stringify(req.body) for signature verification.

Add an appropriate request body size limit.

==================================================
ENVIRONMENT VARIABLES
=====================

Support these server-side environment variables:

BINGWAZONE_WEBHOOK_SECRET=

PESATRIX_WEBHOOK_SECRET=

Use separate secret names even if the current deployment initially uses the same value. This allows future secret rotation without coupling both applications.

Existing SMS variables should remain supported:

SCOPE_SMS_API_KEY=
SCOPE_SMS_SENDER_ID=

Evolution variables:

EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=bingwazone
EVOLUTION_WEBHOOK_SECRET=

The dashboard should store the admin notification phone in database settings, not only in an environment variable.

EVOLUTION_API_URL must be only the Evolution server base URL, for example:

http://84.8.129.199:8080 but for us its i will provide the url, do not hardcoee any url format here.

Do not accept or construct malformed URLs such as:

https://http:8080//84.8.129.199:8080

Normalize trailing slashes before constructing API paths.

EVOLUTION_WEBHOOK_SECRET is reserved for verifying incoming Evolution webhook callbacks. It is not used as authentication for the outbound sendText request.

Do not expose any of these environment variables to browser code.

==================================================
BINGWAZONE WEBHOOK
==================

Create a production route following the existing Next.js route conventions, preferably:

POST /api/webhooks/bingwazone

Expected headers:

Content-Type: application/json

X-BingwaZone-Event:
payment:<uuid>:completed

or:

wallet-withdrawal:<uuid>:completed

X-BingwaZone-Signature:
sha256=<hex-hmac>

The HMAC must be computed from the exact raw request body using:

BINGWAZONE_WEBHOOK_SECRET

---

## SUPPORTED BINGWAZONE EVENTS

1. payment.completed

Example payload:

{
"schema_version": 1,
"event": "payment.completed",
"source_system": "bingwazone",
"occurred_at": "2026-06-13T10:00:00.000Z",
"payment": {
"id": "uuid",
"type": "subscription",
"module": "mini_site",
"amount": 500,
"currency": "KES",
"payer_phone": "0712345678",
"recipient_phone": null,
"receipt": "TFA1234567",
"provider": "mpesa",
"paybill_id": "skylink_bundlefasta",
"account_reference": "Mini Site",
"service_source": "mini_site_subscription",
"initiated_at": "2026-06-13T09:59:30.000Z",
"completed_at": "2026-06-13T10:00:00.000Z",
"metadata": {}
},
"agent": {
"id": "uuid",
"name": "Agent Name",
"business_name": "Agent Shop",
"username": "agentshop"
}
}

Map it as:

* direction = incoming
* source_system = bingwazone
* event_type = payment.completed
* transaction_type/payment_type = payload.payment.type
* module = payload.payment.module
* product_stream = payload.payment.module
* service_source = payload.payment.service_source
* provider = payload.payment.provider
* amount = payload.payment.amount
* currency = payload.payment.currency
* payer_phone = normalized payload.payment.payer_phone
* recipient_phone = normalized payload.payment.recipient_phone
* receipt = normalized uppercase payload.payment.receipt
* account_reference = payload.payment.account_reference
* external_reference_id = payload.payment.id
* occurred_at = payload.occurred_at
* initiated_at = payload.payment.initiated_at
* completed_at = payload.payment.completed_at
* status = completed
* agent details from payload.agent
* metadata = payload.payment.metadata

2. wallet.withdrawal.completed

The payload contains a withdrawal object.

Map it as:

* direction = outgoing
* source_system = bingwazone
* event_type = wallet.withdrawal.completed
* transaction_type = wallet_withdrawal
* payment_type = wallet_withdrawal
* module = wallet
* service_source = payload.withdrawal.service_source when supplied
* amount = payload.withdrawal.amount
* currency = payload.withdrawal.currency or KES
* recipient_phone from withdrawal destination
* external_reference_id = payload.withdrawal.id
* provider reference or transaction ID where supplied
* occurred_at = payload.occurred_at
* completed_at from the withdrawal object where supplied
* status = completed
* agent details when present

---

## BINGWAZONE VALIDATION

Validate payloads using the validation library already used in the project. If none exists, use Zod.

Require:

* supported schema_version
* supported event type
* source_system exactly equal to bingwazone
* valid event header
* header event category matching payload event
* valid ISO timestamps
* positive monetary amount
* supported currency
* required payment or withdrawal object
* required external ID
* valid phone fields when supplied

Only successful BingwaZone paybill transactions are expected.

Direct agent-till purchases must not be represented as Skylink paybill transactions.

---

## BINGWAZONE IDEMPOTENCY

Use the exact X-BingwaZone-Event header as the event_key.

Examples:

payment:<payment_id>:completed

wallet-withdrawal:<withdrawal_id>:completed

Insert the webhook event using a unique constraint.

If the same event key and same payload hash already exist:

* Do not process the financial transaction again.
* Do not send another notification.
* Return HTTP 200.
* Return JSON similar to:
  {
  "received": true,
  "duplicate": true
  }

If the same event key exists with a different payload hash:

* Do not overwrite the original event.
* Create an audit entry for WEBHOOK_IDEMPOTENCY_CONFLICT.
* Mark or record the conflict safely.
* Do not create another transaction.
* Return an appropriate permanent client error such as 409.

==================================================
PESATRIX WEBHOOK
================

Create:

POST /api/webhooks/pesatrix

Expected headers:

Content-Type: application/json

X-Pesatrix-Event:
activation

or:

withdrawal

X-Pesatrix-Signature:
<64-character hex HMAC SHA-256>

The signature must be verified against the exact raw request body using:

PESATRIX_WEBHOOK_SECRET

Do not use:

JSON.stringify(parsedPayload)

for signature verification.

---

## PESATRIX ACTIVATION EVENT

Example:

{
"event": "activation",
"transaction_id": "MPESA_RECEIPT_CODE",
"amount": 500,
"phone": "2547XXXXXXXX",
"platform": "pesatrix",
"timestamp": "2026-06-13T10:32:00.000Z",
"reference_id": "activation_payment_uuid",
"user_id": "user_account_uuid"
}

Map it as:

* direction = incoming
* source_system = pesatrix
* provider = mpesa
* event_type = activation
* transaction_type = activation
* payment_type = activation
* module = account_activation
* product_stream = activation
* service_source = pesatrix_activation
* amount = payload.amount
* currency = KES
* payer_phone = normalized payload.phone
* receipt = normalized uppercase payload.transaction_id
* external_reference_id = payload.reference_id
* external_user_id = payload.user_id
* occurred_at = payload.timestamp
* completed_at = payload.timestamp
* status = completed

---

## PESATRIX WITHDRAWAL EVENT

Example:

{
"event": "withdrawal",
"transaction_id": "MPESA_B2C_TXN_ID",
"amount": 1000,
"phone": "2547XXXXXXXX",
"platform": "pesatrix",
"timestamp": "2026-06-13T10:32:00.000Z",
"reference_id": "withdrawal_request_uuid",
"user_id": "user_account_uuid"
}

Map it as:

* direction = outgoing
* source_system = pesatrix
* provider = mpesa
* event_type = withdrawal
* transaction_type = withdrawal
* payment_type = withdrawal
* module = wallet
* product_stream = withdrawal
* service_source = pesatrix_wallet_withdrawal
* amount = payload.amount
* currency = KES
* recipient_phone = normalized payload.phone
* receipt/provider transaction ID = normalized payload.transaction_id
* external_reference_id = payload.reference_id
* external_user_id = payload.user_id
* occurred_at = payload.timestamp
* completed_at = payload.timestamp
* status = completed

---

## PESATRIX VALIDATION

Require:

* event is activation or withdrawal
* X-Pesatrix-Event matches payload.event
* platform is pesatrix
* valid timestamp
* positive amount
* valid reference_id
* valid user_id
* transaction_id is present
* phone can be normalized to Kenyan E.164 format

---

## PESATRIX IDEMPOTENCY

The X-Pesatrix-Event header is not unique by itself.

Generate a deterministic event key:

pesatrix:<event>:<reference_id>

Examples:

pesatrix:activation:activation_payment_uuid

pesatrix:withdrawal:withdrawal_request_uuid

Use this value with the unique constraint on:

(source_system, event_key)

Apply the same duplicate and changed-payload handling rules used for BingwaZone.

==================================================
PHONE NORMALIZATION
===================

Create or reuse one server-side Kenyan phone normalization utility.

Normalize formats such as:

0712345678
712345678
+254712345678
254712345678

into:

254712345678

Do not silently modify invalid numbers into guessed values.

Return validation errors for numbers that cannot be safely normalized.

Display numbers consistently in the UI.

==================================================
CANONICAL TRANSACTION RECONCILIATION
====================================

Implement a service such as:

reconcileWebhookTransaction()

or follow the repository naming conventions already present.

The process must be:

1. Store the verified raw webhook event.
2. Derive the normalized transaction candidate.
3. Try to match an existing canonical transaction.
4. Enrich or insert the canonical transaction.
5. Link webhook_events.transaction_id to the canonical transaction.
6. Commit the financial data.
7. Create audit entries.
8. Queue notification separately.
9. Return webhook acknowledgement.

---

## AUTOMATIC MATCHING RULES

Use strong deterministic identifiers only.

Primary automatic match:

* exact normalized receipt or provider transaction ID
* compatible direction
* compatible amount

Also use exact existing source/reference identifiers where applicable.

If an existing transaction has the same receipt, direction, and amount:

* Link the webhook event to it.
* Enrich missing business attribution.
* Do not create a second transaction.
* Do not overwrite trusted non-null values with null.
* Set reconciliation_status = matched.

If the existing transaction has the same receipt but a conflicting amount or direction:

* Do not insert another normal transaction.
* Preserve the raw webhook event.
* Mark reconciliation_status = conflict.
* Create an audit event.
* Surface the conflict in the UI.
* Exclude the conflicting duplicate evidence from financial totals.

If no deterministic match exists:

* Insert a new canonical transaction.
* Set origin to the application webhook.
* Set reconciliation_status = app_only.

Do not automatically merge transactions using only:

* same phone
* same amount
* nearby timestamp

Those can produce false matches.

Such similarities may be shown later as suggested reconciliation candidates, but they must not be auto-merged.

---

## ATTRIBUTION ENRICHMENT

When an existing Safaricom transaction is matched:

* Preserve the provider and provider callback information.
* Add source_system from BingwaZone or Pesatrix.
* Add payment type.
* Add module/product stream.
* Add service source.
* Add agent or user identifiers.
* Add application reference.
* Link the raw webhook event.

If an existing transaction already has a different non-null source_system:

* Do not silently replace it.
* Mark an attribution conflict.
* Create an audit entry.
* Show the conflict in transaction details.

==================================================
TRANSACTIONS UI
===============

Update the Transactions page.

The current table has columns similar to:

* Dir
* Type
* Product Stream
* Acc Ref
* Phone
* Amount
* Receipt
* Status
* Date

Change it to clearly support multiple systems and modules.

Recommended desktop columns:

* Source
* Direction
* Type
* Module
* Service
* Account Reference
* Counterparty
* Amount
* Receipt
* Status
* Occurred At
* Actions

The exact responsive column behavior should follow the existing design system.

For Source, show clear badges such as:

* BingwaZone
* Pesatrix
* Unknown
* Manual

For Direction:

* Incoming
* Outgoing

For Module, support BingwaZone values:

* mini_site
* whatsapp_bot
* whatsapp_agents
* whatsapp_auto_post
* requested_poster
* bundle
* wallet

Support Pesatrix values:

* account_activation
* wallet

Convert machine values to readable labels in the UI without changing the stored values.

Examples:

mini_site → Mini Sites

whatsapp_auto_post → WhatsApp Auto Post

requested_poster → Requested Posters

account_activation → Account Activations

wallet_withdrawal → Wallet Withdrawal

==================================================
VIEW TRANSACTION ACTION
=======================

Add a View action for every transaction.

Use the existing modal, drawer, page, or sheet pattern used by the dashboard.

The detail view should contain:

1. Summary

* Amount
* Currency
* Direction
* Status
* Source system
* Provider
* Origin
* Transaction type
* Payment type
* Module
* Service source

2. Payment details

* Receipt/provider transaction ID
* Account reference
* Payer phone
* Recipient phone
* External reference ID
* User ID
* Agent ID

3. Agent details when available

* Agent name
* Business name
* Username

4. Timeline

* Initiated at
* Occurred at
* Completed at
* Dashboard received at
* Database created at
* Updated at

5. Reconciliation

* Reconciliation status
* Provider evidence
* Application evidence
* Conflicts
* Linked webhook event IDs or readable event keys

6. Metadata

Show structured metadata in a readable key/value layout.

7. Raw payload

Provide a collapsible JSON viewer for related webhook raw payloads.

Raw payloads must be admin-only.

Do not show secrets or internal credentials.

==================================================
TRANSACTION FILTERS
===================

Rebuild filters to match the new data model.

Support:

* Date range
* Source system
* Direction
* Status
* Transaction type
* Payment type
* Module
* Product stream
* Service source
* Currency
* Minimum amount
* Maximum amount
* Reconciliation status
* Receipt search
* Phone search
* Account reference search
* Agent name or username search
* User ID or agent ID search

Add useful date presets:

* Today
* Yesterday
* Last 7 days
* Last 30 days
* This month
* Custom

All filters must operate on canonical transactions, not raw webhook event counts.

CSV export, if already present, must respect the active filters.

The URL query string should preserve filters if the existing dashboard follows that pattern.

==================================================
DASHBOARD AND ANALYTICS
=======================

Rewire analytics to use the canonical transactions table.

Never calculate financial totals by summing webhook_events.

Add a period selector and previous-period comparison where consistent with the existing design.

---

## GLOBAL KPI CARDS

Show:

* Total Incoming
* Total Outgoing
* Net Flow
* Transaction Count
* Average Transaction Value
* Incoming Transaction Count
* Outgoing Transaction Count
* Reconciliation Conflicts

Net Flow:

total incoming minus total outgoing

Use canonical completed/successful transactions only unless the user explicitly selects another status.

---

## SOURCE SYSTEM CARDS

Create summary cards for:

* BingwaZone
* Pesatrix
* Unknown/Unattributed

Each card should show:

* Incoming amount
* Outgoing amount
* Net amount
* Transaction count
* Percentage of total incoming
* Change from previous comparable period

---

## BINGWAZONE MODULE CARDS

Create module cards for:

* Mini Sites
* WhatsApp Bot
* WhatsApp Agents
* WhatsApp Auto Post
* Requested Posters
* Bundles

Each module card should show:

* Total incoming revenue
* Number of incoming transactions
* Average transaction value
* Percentage of BingwaZone revenue
* Previous-period change

Do not count wallet withdrawals as module revenue.

Show wallet withdrawals separately in outgoing analytics.

---

## PESATRIX CARDS

Show:

* Activation Revenue
* Activation Count
* Average Activation Amount
* Wallet Withdrawals
* Withdrawal Count
* Net Pesatrix Flow
* Withdrawal-to-Activation Ratio

Do not imply that withdrawals are expenses belonging to an activation module. They are separate outgoing wallet movements.

---

## ANALYTICS VISUALIZATIONS

Add useful, readable analytics such as:

* Incoming vs outgoing time series
* Net cash-flow time series
* Revenue by source system
* BingwaZone revenue by module
* Transactions by payment type
* Transactions by service source
* Incoming versus outgoing by source
* Top BingwaZone agents by transaction amount
* Top BingwaZone agents by transaction count
* Reconciliation status distribution
* Unattributed transaction trend

Use the existing chart library.

Do not add decorative charts with no operational value.

Charts and cards must respect:

* Date filters
* Source filters
* Module filters
* Transaction type filters
* Direction filters
* Status filters

==================================================
RECONCILIATION VISIBILITY
=========================

Add an analytics or operational section showing:

* Matched application and Safaricom transactions
* Application-only transactions
* Provider-only transactions
* Conflicts
* Duplicate webhook attempts

Allow administrators to open the relevant transaction or raw webhook event from this section.

Do not allow raw webhook duplicates to increase money totals.

==================================================
ADMIN NOTIFICATION SETTINGS
===========================

Update Admin Settings.

The administrator must be able to select the notification channel:

* SMS
* WhatsApp

Do not send both channels unless this capability is explicitly added later.

Create or extend a table such as:

notification_preferences

Recommended fields:

* id uuid primary key
* admin_user_id uuid nullable if the dashboard currently supports one owner
* notification_channel text not null
* admin_phone text not null
* incoming_alerts_enabled boolean not null default true
* outgoing_alerts_enabled boolean not null default true
* sms_sender_id text nullable
* created_at timestamptz
* updated_at timestamptz

Allowed notification_channel values:

* sms
* whatsapp

If the project currently uses a singleton settings record, follow that architecture.

The settings UI should include:

* Notification Channel
* Admin Alert Phone
* Incoming Alerts Enabled
* Outgoing Alerts Enabled
* SMS Sender ID where currently supported
* Save Changes
* Send Test Notification

Secrets and API keys must never appear in the settings UI.

Validate and normalize the admin phone before saving.

Audit settings changes.

==================================================
UNIFIED NOTIFICATION DELIVERY MODEL
===================================

Do not create separate business logic for SMS and WhatsApp.

Create a generic notification service with provider adapters.

Suggested structure:

lib/notifications/
send-transaction-alert.ts
build-transaction-alert.ts
notification-repository.ts
providers/
scope-sms.ts
evolution-whatsapp.ts

Create or adapt a generic table:

notification_deliveries

Recommended columns:

* id uuid primary key
* transaction_id uuid nullable
* webhook_event_id uuid nullable
* notification_type text not null
* channel text not null
* recipient text not null
* message text not null
* deduplication_key text not null unique
* status text not null
* provider_message_id text nullable
* provider_response jsonb nullable
* error_message text nullable
* attempt_count integer not null default 0
* next_attempt_at timestamptz nullable
* created_at timestamptz not null default now()
* updated_at timestamptz not null default now()
* sent_at timestamptz nullable

Suggested statuses:

* queued
* processing
* sent
* failed
* permanently_failed

If an sms_notifications table already exists:

* Do not drop historical data.
* Migrate it, preserve it, or provide backward-compatible access.
* Update the Notifications UI to show both historical and new records correctly.

==================================================
NOTIFICATION DEDUPLICATION
==========================

A repeated webhook must not trigger repeated notifications.

Use a deterministic notification deduplication key.

Example:

transaction:<transaction_id>:incoming-alert:<channel>

or:

transaction:<transaction_id>:outgoing-alert:<channel>

Create the notification only after a canonical transaction is successfully created or confirmed.

If an application webhook merely enriches an existing transaction that was already notified:

* Do not notify again.

If the transaction was never previously notified:

* Queue one notification according to the current preferences.

==================================================
NOTIFICATION EXECUTION ORDER
============================

The required order is:

1. Verify webhook.
2. Validate payload.
3. Store webhook event.
4. Reconcile or create canonical transaction.
5. Commit financial database changes.
6. Write audit records.
7. Queue notification.
8. Acknowledge webhook.

Notification delivery must never happen before the financial transaction is committed.

Notification failure must never:

* Roll back the transaction.
* Change the transaction from completed to failed.
* Cause duplicate money records.
* Cause an otherwise valid webhook to be processed twice.

Use the project’s existing queue, job, or cron architecture if available.

If no background delivery mechanism exists, implement a database-backed outbox and a protected processor route or scheduled worker.

Do not rely on an unawaited promise after returning a serverless response because execution may be terminated.

Retry only transient delivery failures.

Do not retry permanent 4xx validation failures indefinitely.

Preserve the existing SMS provider rule that an “Invalid phone number” response must not automatically trigger aggressive retries because the provider has previously returned misleading errors even when delivery occurred.

==================================================
SMS PROVIDER
============

Keep the existing BlazeTech Scope SMS implementation working.

Base URL:

https://sms.blazetechscope.com/v1/

Send endpoint:

POST /sendsms

Authentication remains server-side through the existing API key and sender ID.

Store:

* provider response
* provider message ID
* delivery status
* exact error message

SMS failure is informational only and must not affect financial processing.

==================================================
EVOLUTION WHATSAPP PROVIDER
===========================

Create:

lib/notifications/providers/evolution-whatsapp.ts

Send WhatsApp text messages using:

POST ${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}

Headers:

apikey: ${EVOLUTION_API_KEY}
Content-Type: application/json

Use a minimal request body:

{
"number": "2547XXXXXXXX",
"text": "message text",
"delay": 1000,
"linkPreview": false
}

Do not send these fields unless a future feature actually requires them:

* mentionsEveryOne
* mentioned
* quoted

They are not needed for an admin transaction alert and may cause unexpected behavior.

Normalize the base URL to avoid duplicate slashes.

Use a reasonable server-side timeout.

Capture:

* HTTP status
* provider response
* provider message ID when available
* error body
* delivery attempt time

Do not log the Evolution API key.

The Evolution instance is:

bingwazone

Read it from:

EVOLUTION_INSTANCE

Do not hardcode it in multiple files.

==================================================
NOTIFICATION MESSAGE TEMPLATES
==============================

Create separate formatting appropriate for SMS and WhatsApp while keeping the same facts.

---

## INCOMING SMS

SKYLINK PAYBILL
Received KES {amount}
Source: {source}
Module: {module}
Type: {type}
Phone: {payer_phone}
Receipt: {receipt}
Time: {time}

Keep SMS concise.

Omit unavailable fields rather than displaying “undefined” or “null”.

---

## OUTGOING SMS

SKYLINK PAYBILL
Sent KES {amount}
Source: {source}
Type: {type}
To: {recipient_phone}
Ref: {receipt_or_reference}
Time: {time}

---

## INCOMING WHATSAPP

*SKYLINK PAYBILL ALERT*

Money received: *KES {amount}*
Source: {source}
Module: {module}
Type: {type}
From: {payer_phone}
Account: {account_reference}
Receipt: {receipt}
Time: {time}

---

## OUTGOING WHATSAPP

*SKYLINK PAYBILL ALERT*

Money sent: *KES {amount}*
Source: {source}
Type: {type}
To: {recipient_phone}
Reference: {receipt_or_reference}
Time: {time}

Use readable source and module labels.

Display time in Africa/Nairobi.

Do not include raw metadata or private internal identifiers in notification messages.

==================================================
NOTIFICATIONS PAGE
==================

Update the Notifications page to support both channels.

Columns:

* Date
* Channel
* Direction/Event
* Recipient
* Message
* Provider Message ID
* Status
* Error
* Actions

Filters:

* Date
* Channel
* Status
* Incoming/Outgoing
* Source system
* Recipient

The details action should show:

* Message
* Provider request metadata without secrets
* Provider response
* Attempts
* Related transaction
* Related webhook event
* Error history

==================================================
DASHBOARD NOTIFICATION WIDGET
=============================

Update the existing notification widget.

Show:

* Selected Channel
* Sent Today
* Failed Today
* Queued
* Last Successful Notification

Do not mix notification delivery counts with financial transaction counts.

==================================================
AUDIT LOGGING
=============

Create audit events following existing conventions.

Include at least:

* BINGWAZONE_WEBHOOK_RECEIVED
* BINGWAZONE_WEBHOOK_PROCESSED
* BINGWAZONE_WEBHOOK_DUPLICATE
* PESATRIX_WEBHOOK_RECEIVED
* PESATRIX_WEBHOOK_PROCESSED
* PESATRIX_WEBHOOK_DUPLICATE
* WEBHOOK_SIGNATURE_REJECTED
* WEBHOOK_VALIDATION_FAILED
* WEBHOOK_IDEMPOTENCY_CONFLICT
* TRANSACTION_RECONCILED
* TRANSACTION_RECONCILIATION_CONFLICT
* TRANSACTION_ATTRIBUTION_UPDATED
* NOTIFICATION_QUEUED
* NOTIFICATION_SENT
* NOTIFICATION_FAILED
* NOTIFICATION_SETTINGS_UPDATED
* TEST_NOTIFICATION_SENT
* TEST_NOTIFICATION_FAILED

Do not put secrets or full sensitive payloads in general audit messages.

Link audit records to the transaction or webhook event where the schema supports it.

==================================================
HTTP RESPONSE RULES
===================

For valid newly processed webhook:

200
{
"received": true,
"duplicate": false
}

For valid duplicate:

200
{
"received": true,
"duplicate": true
}

For missing or invalid signature:

401

For malformed JSON or invalid supported payload:

400

For conflicting reuse of an event key with a changed payload:

409

For temporary database or internal processing failure:

500 or 503

Do not return non-2xx merely because SMS or WhatsApp notification delivery failed.

Webhook acknowledgement concerns transaction ingestion, not notification delivery.

==================================================
DATABASE CONSISTENCY
====================

Webhook event insertion, reconciliation, canonical transaction update, and event-to-transaction linkage must be atomic where possible.

If the current Supabase client does not support multi-statement transactions directly:

* Use a database function/RPC.
* Or use the project’s server-side database driver.
* Do not pretend separate independent Supabase calls are atomic.

Notification queue creation may occur after the financial transaction commit, but it must be idempotent.

==================================================
INDEXES
=======

Add indexes appropriate to actual query patterns.

At minimum consider indexes for:

* webhook_events(source_system, event_key)
* webhook_events(received_at)
* webhook_events(processing_status)
* transactions(source_system)
* transactions(direction)
* transactions(status)
* transactions(module)
* transactions(payment_type)
* transactions(service_source)
* transactions(occurred_at)
* transactions(receipt)
* transactions(external_reference_id)
* transactions(reconciliation_status)
* notification_deliveries(status, next_attempt_at)
* notification_deliveries(created_at)
* notification_deliveries(channel)

Use partial or composite indexes where they materially improve the dashboard’s real queries.

Do not create redundant indexes blindly.

==================================================
TESTING
=======

Add automated tests using the project’s existing test framework.

Test at least:

1. Valid BingwaZone payment signature.
2. Invalid BingwaZone signature.
3. Valid BingwaZone wallet withdrawal.
4. BingwaZone duplicate event returns 200 and does not duplicate the transaction.
5. Same BingwaZone event key with changed payload is rejected.
6. Valid Pesatrix activation signature.
7. Valid Pesatrix withdrawal signature.
8. Pesatrix signature verification uses exact raw body.
9. Pesatrix duplicate reference does not duplicate the transaction.
10. Header event type mismatch is rejected.
11. Invalid payload amount is rejected.
12. Invalid phone is rejected.
13. Existing Safaricom receipt is enriched instead of duplicated.
14. Same receipt with conflicting amount is flagged.
15. Analytics count a matched Safaricom/application transaction once.
16. Duplicate webhook does not create another notification.
17. SMS channel calls the existing SMS provider.
18. WhatsApp channel calls the correct Evolution URL.
19. Evolution API key remains server-side.
20. WhatsApp failure does not change transaction status.
21. SMS failure does not change transaction status.
22. Incoming and outgoing preference toggles are respected.
23. Test notification uses the selected channel.
24. Transaction detail view loads linked raw webhook evidence.
25. Admin-only access protects webhook payloads and notification settings.

Use fixed test fixtures for signatures so verification is deterministic.

==================================================
DOCUMENTATION
=============

Add or update documentation covering:

* Required environment variables
* BingwaZone webhook URL
* Pesatrix webhook URL
* Signature formats
* Event formats
* Secret rotation
* Local testing instructions
* Example curl or test scripts that correctly sign raw JSON
* Database migrations
* Evolution API configuration
* Notification channel settings
* Reconciliation behavior
* Duplicate event behavior
* Deployment steps

Document the production webhook URLs based on the dashboard domain:

https://skylink.pesatrix.co.ke/api/webhooks/bingwazone

https://skylink.pesatrix.co.ke/api/webhooks/pesatrix

Do not expose actual secret values in documentation.

==================================================
MIGRATION SAFETY
================

Before modifying the schema:

* Inspect current tables and migrations.
* Preserve existing transaction rows.
* Preserve existing SMS logs.
* Backfill new columns safely.
* Use nullable columns during backfill where required.
* Add constraints only after existing rows are compatible.
* Avoid destructive table recreation.
* Keep rollback considerations in mind.

If existing transaction records lack source attribution, use:

source_system = unknown

Do not guess that historical rows belong to BingwaZone or Pesatrix.

==================================================
CODE QUALITY
============

Use:

* TypeScript
* Strict typing
* Server-only provider clients
* Shared validation schemas
* Shared normalization helpers
* Repository/service separation consistent with the project
* Existing UI components
* Existing authentication
* Existing audit logging
* Existing formatting helpers
* Responsive, mobile-first UI

Avoid:

* duplicated mapping logic
* unsafe any types
* client-side secrets
* floating-point money calculations
* raw SQL interpolation
* silent catches
* console logging full webhook payloads in production
* inserting duplicate ledger rows
* sending notifications before transaction persistence
* relying on source-system webhook rows for financial totals

==================================================
FINAL ACCEPTANCE CRITERIA
=========================

The work is complete only when:

1. BingwaZone signed webhooks are accepted and stored.
2. Pesatrix signed webhooks are accepted and stored.
3. Invalid signatures are rejected before JSON processing.
4. Duplicate events are harmless and return HTTP 200.
5. Application webhooks do not double-count existing Safaricom transactions.
6. BingwaZone transactions are visibly separated by module and payment type.
7. Pesatrix activations and withdrawals are clearly separated.
8. Transactions have a View action with full normalized and raw details.
9. Filters support source, module, type, direction, status, and dates.
10. Dashboard analytics use canonical transactions only.
11. BingwaZone module cards show accurate revenue totals.
12. Pesatrix activation and withdrawal analytics are accurate.
13. The admin can switch the alert channel between SMS and WhatsApp.
14. WhatsApp alerts are sent through the Evolution instance named bingwazone.
15. Notification failures never affect financial processing.
16. Repeated webhooks never create repeated alerts.
17. Existing SMS functionality continues working.
18. Database migrations preserve all historical data.
19. Tests pass.
20. Build, lint, and type-check pass.

After implementation, provide:

* A concise summary of files changed.
* Database migrations created.
* Environment variables required.
* Routes created.
* Important architectural decisions.
* Tests executed and their results.
* Any unresolved issue that genuinely requires external credentials or production access.
