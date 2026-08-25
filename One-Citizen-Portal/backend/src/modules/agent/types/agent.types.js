// Domain type definitions (Phase 9 — TypeScript-style patterns in JS via JSDoc).
// Importing this file is not required at runtime; it documents the shapes the service,
// gateway and controllers exchange so editors give inference and contributors have a
// single source of truth for the module's contracts.

/**
 * @typedef {Object} AgentPage  Shared-state page context (AG-UI `state`).
 * @property {string} [currentPage]
 * @property {string} [route]
 * @property {string} [serviceId]
 * @property {string} [serviceName]
 * @property {Array<{name:string,label?:string,type?:string,required?:boolean,options?:any[]}>} [formFields]
 * @property {Record<string, any>} [formValues]
 */

/**
 * @typedef {Object} ChatDto
 * @property {string} [threadId]
 * @property {string} message
 * @property {AgentPage} [page]
 * @property {'user_message'|'page_context'|'field_changed'|'prefill_applied'|'prefill_dismissed'} trigger
 */

/**
 * @typedef {Object} RunAgentInput  Body POSTed to the Python engine.
 * @property {string} threadId
 * @property {string} runId
 * @property {Array<{id:string,role:string,content:string}>} messages
 * @property {Object} state
 * @property {{trigger:string}} forwardedProps
 */

/**
 * @typedef {Object} ExtractedEntity  One field the agent proposes for a form.
 * @property {string} field
 * @property {any} value
 * @property {string} [label]
 * @property {'high'|'medium'|'low'|'review'} confidence
 * @property {string} source
 * @property {boolean} overridden
 * @property {string} timestamp        ISO-8601
 * @property {'pending'|'applied'|'valid'|'invalid'} validationState
 */

/**
 * @typedef {Object} AgentThread  Persisted conversation (messages embedded).
 * @property {string} id
 * @property {string} ownerId
 * @property {string|null} title
 * @property {string|null} serviceId
 * @property {Record<string, any>} formState
 * @property {Object|null} proposedPrefill
 * @property {Array<Object>} messages
 * @property {number} version
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export {};
