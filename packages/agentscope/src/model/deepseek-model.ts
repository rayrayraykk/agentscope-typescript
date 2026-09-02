/* eslint-disable jsdoc/require-jsdoc */

import { DeepSeekCredential } from '../credential/providers';
import { DeepSeekChatFormatter } from '../formatter';
import type { FormatterBase } from '../formatter';
import { ToolChoice } from '../tool/types';
import type { ToolChoice as LegacyToolChoice, ToolSchema } from '../type';
import { ChatModelBase } from './base';
import type { ChatModelRequestOptions } from './base';
import type { FetchLike } from './http-transport';
import {
    createOpenAICompatibleHTTPClient,
    formatOpenAITools,
    OpenAICompatibleClient,
    parseOpenAICompletion,
    parseOpenAIStream,
} from './openai-compatible';
import { ChatResponse } from './response';

export interface DeepSeekParameters extends Record<string, unknown> {
    maxTokens?: number | null;
    thinkingEnable?: boolean;
    reasoningEffort?: 'high' | 'max' | null;
    temperature?: number | null;
    topP?: number | null;
}

export interface DeepSeekChatModelOptions {
    credential?: DeepSeekCredential;
    model?: string;
    parameters?: DeepSeekParameters;
    stream?: boolean;
    maxRetries?: number;
    retryDelay?: number;
    contextSize?: number;
    formatter?: FormatterBase;
    client?: OpenAICompatibleClient;
    fetch?: FetchLike;
    modelName?: string;
    apiKey?: string;
    thinkingConfig?: { enableThinking: boolean };
    presetGenParams?: Record<string, unknown>;
    presetHeaders?: Record<string, string>;
    fallbackModelName?: string;
}

/** DeepSeek OpenAI-compatible chat model. */
export class DeepSeekChatModel extends ChatModelBase {
    readonly type = 'deepseek_chat' as const;
    readonly deepSeekParameters: DeepSeekParameters;
    private readonly client: OpenAICompatibleClient;
    private readonly legacyParameters: Record<string, unknown>;

    constructor(options: DeepSeekChatModelOptions) {
        const credential =
            options.credential ??
            new DeepSeekCredential({ apiKey: required(options.apiKey, 'apiKey') });
        const model = options.model ?? required(options.modelName, 'model');
        const parameters = {
            ...(options.parameters ?? {}),
            ...(options.thinkingConfig
                ? { thinkingEnable: options.thinkingConfig.enableThinking }
                : {}),
        };
        super({
            modelName: model,
            credential,
            parameters,
            stream: options.stream ?? true,
            maxRetries: options.maxRetries ?? 3,
            retryDelay: options.retryDelay ?? 1,
            contextSize: options.contextSize ?? 65536,
            fallbackModelName: options.fallbackModelName,
            formatter: options.formatter ?? new DeepSeekChatFormatter(),
        });
        this.deepSeekParameters = parameters;
        this.legacyParameters = options.presetGenParams ?? {};
        this.client =
            options.client ??
            createOpenAICompatibleHTTPClient({
                apiKey: credential.apiKey,
                baseUrl: credential.baseUrl,
                headers: options.presetHeaders,
                fetch: options.fetch,
            });
    }

    protected isRetryableError(error: unknown): boolean {
        return isOpenAIRetryable(error);
    }

    protected isStructuredOutputFallbackError(error: unknown): boolean {
        return (
            super.isStructuredOutputFallbackError(error) ||
            (error instanceof Error && error.name === 'HTTP400Error')
        );
    }

    protected getDisableThinkingOptions(): Record<string, unknown> {
        return { extra_body: { thinking: { type: 'disabled' } } };
    }

    async _callAPI(
        modelName: string,
        options: ChatModelRequestOptions<unknown>
    ): Promise<ChatResponse | AsyncGenerator<ChatResponse, ChatResponse>> {
        const startedAt = Date.now();
        const { messages, tools, normalizedToolChoice, signal, ...callOptions } = options;
        delete callOptions.toolChoice;
        delete callOptions.schema;
        const parameters = this.deepSeekParameters;
        const body: Record<string, unknown> = {
            model: modelName,
            messages,
            stream: this.stream,
        };
        if (parameters.maxTokens != null) body.max_tokens = parameters.maxTokens;
        if (parameters.temperature != null) body.temperature = parameters.temperature;
        if (parameters.topP != null) body.top_p = parameters.topP;
        if (parameters.reasoningEffort) body.reasoning_effort = parameters.reasoningEffort;
        Object.assign(body, this.legacyParameters, callOptions);
        const extraBody = asRecord(body.extra_body);
        const thinking = asRecord(extraBody.thinking);
        if (thinking.type === undefined) {
            thinking.type = parameters.thinkingEnable ? 'enabled' : 'disabled';
        }
        extraBody.thinking = thinking;
        body.extra_body = extraBody;

        const [formattedTools, formattedChoice] = formatOpenAITools(
            tools,
            normalizedToolChoice ?? null
        );
        if (formattedTools) body.tools = formattedTools;
        if (formattedChoice) body.tool_choice = formattedChoice;
        if (this.stream) body.stream_options = { include_usage: true };
        const raw = await this.client.create(body, signal as AbortSignal | undefined);
        const parserOptions = {
            cacheTokens: (usage: Record<string, unknown>) =>
                Number(usage.prompt_cache_hit_tokens ?? 0),
        };
        return this.stream
            ? parseOpenAIStream(
                  raw as AsyncIterable<Record<string, unknown>>,
                  startedAt,
                  parserOptions
              )
            : parseOpenAICompletion(raw, startedAt, parserOptions);
    }

    _formatToolChoice(toolChoice?: LegacyToolChoice): unknown {
        if (!toolChoice) return 'auto';
        return formatOpenAITools(undefined, new ToolChoice({ mode: toolChoice }))[1];
    }

    _formatToolSchemas(tools?: ToolSchema[]): ToolSchema[] {
        return tools ?? [];
    }
}

function isOpenAIRetryable(error: unknown): boolean {
    return (
        error instanceof TypeError ||
        (error instanceof Error &&
            ['RateLimitError', 'HTTP500Error', 'HTTP502Error', 'HTTP503Error'].includes(error.name))
    );
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? structuredClone(value as Record<string, unknown>)
        : {};
}

function required(value: string | undefined, name: string): string {
    if (!value) throw new Error(`${name} is required.`);
    return value;
}
